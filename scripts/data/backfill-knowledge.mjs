// Backfills public.knowledge_documents from verified_entities + analysis_rules.
//
// Usage:
//   node scripts/data/backfill-knowledge.mjs
//
// Env:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY      (required)

import { fileURLToPath } from "node:url";

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

import {
  collapseEntityText,
  createAliases,
  isGuruPublishable,
  normalizeEntityText,
} from "./_shared.mjs";

const { loadEnvConfig } = nextEnv;

function expandEntityAliases(name, existingAliases = []) {
  const aliases = new Set(createAliases(name));
  for (const alias of existingAliases) {
    const normalized = normalizeEntityText(alias);
    if (normalized) {
      aliases.add(normalized);
      aliases.add(collapseEntityText(alias));
    }
  }
  return [...aliases].filter(Boolean);
}

const ENTITY_TYPE_LABELS = {
  broker: "broker",
  guru: "trading guru",
  propfirm: "prop firm",
};

function entityToDocument(row) {
  const aliases = expandEntityAliases(row.name, row.aliases ?? []);
  const isGuru = row.entity_type === "guru";
  // Brokers and prop firms: the BTS engine row is the only source of verdict and score. Old score
  // columns (trust_score, final_tier, status) are never written into the index.
  const bts = row.bts ?? null;
  const verdict = isGuru ? row.status : (bts?.verdict ?? "UNDER REVIEW");
  const score = !isGuru && bts && !["UNDER REVIEW", "NOT ACTIVE"].includes(bts.verdict) ? bts.global_score : null;
  const lines = isGuru
    ? [
        `${row.name} is a ${ENTITY_TYPE_LABELS[row.entity_type] ?? "entity"} with status "${row.status}".`,
        row.founder_notes ? `Founder note: ${row.founder_notes}` : null,
        row.notes && row.notes !== row.founder_notes ? row.notes : null,
      ]
    : [
        `${row.name} is a ${ENTITY_TYPE_LABELS[row.entity_type] ?? "entity"}. BTS global verdict: ${verdict}${score !== null && score !== undefined ? `, score ${score}/100` : ", no score shown"}. Call verify_entity for the verdict in the user's country.`,
        bts?.verdict_reason ? `Reason: ${bts.verdict_reason}.` : null,
        bts?.details?.active_verified_licences ? `Licences verified on a register: ${bts.details.active_verified_licences}.` : null,
        row.fca_warning ? "The FCA has published a warning about this firm." : null,
      ];

  return {
    kind: "entity",
    title: row.name,
    content: lines.filter(Boolean).join("\n"),
    tags: {
      entity_type: row.entity_type,
      status: verdict,
      fca_warning: Boolean(row.fca_warning),
      ...(score !== null && score !== undefined ? { bts_score: score } : {}),
    },
    aliases,
    searchable_text: [normalizeEntityText(row.name), ...aliases].join(" "),
    source_table: "verified_entities",
    source_id: row.slug,
  };
}

function ruleToDocument(row) {
  return {
    kind: "rule",
    title: `Rule ${row.rule_number}: ${row.rule_name}`,
    content: row.content,
    tags: {
      category: row.category,
      priority: Number(row.priority),
      rule_number: Number(row.rule_number),
    },
    aliases: [],
    searchable_text: normalizeEntityText(`${row.category} ${row.rule_name}`),
    source_table: "analysis_rules",
    source_id: String(row.rule_number),
  };
}

/**
 * Rebuild the knowledge corpus from verified_entities + active analysis_rules.
 * Idempotent. Called standalone (CLI) and at the end of each entity loader so
 * the retrieval index can never drift out of sync with the source tables.
 */
export async function backfillKnowledge(client) {
  const [entities, rules] = await Promise.all([
    client.from("verified_entities").select("*, bts:bts_scores(verdict, global_score, verdict_reason, details)").range(0, 9999),
    client.from("analysis_rules").select("*").eq("active", true),
  ]);

  if (entities.error) {
    throw new Error(`Could not load verified_entities: ${entities.error.message}`);
  }
  if (rules.error) {
    throw new Error(`Could not load analysis_rules: ${rules.error.message}`);
  }

  // Partition once: publishable rows become docs, the rest are pruned below.
  const publishableEntities = [];
  const excludedSlugs = [];
  for (const row of entities.data ?? []) {
    if (isGuruPublishable(row)) {
      publishableEntities.push(row);
    } else {
      excludedSlugs.push(row.slug);
    }
  }

  const documents = [
    ...publishableEntities.map(entityToDocument),
    ...(rules.data ?? []).map(ruleToDocument),
  ];

  // A guru that went unpublishable (held, unreviewed) must leave the corpus, not
  // just stop being upserted — drop any stale docs for the excluded rows.
  if (excludedSlugs.length > 0) {
    const { error: deleteError } = await client
      .from("knowledge_documents")
      .delete()
      .eq("source_table", "verified_entities")
      .in("source_id", excludedSlugs);
    if (deleteError) {
      throw new Error(`Could not prune unpublishable docs: ${deleteError.message}`);
    }
  }

  const { error } = await client
    .from("knowledge_documents")
    .upsert(documents, { onConflict: "source_table,source_id" });
  if (error) {
    throw new Error(`Upsert failed: ${error.message}`);
  }

  console.log(
    `Knowledge index: ${documents.length} docs (${publishableEntities.length} entities, ` +
      `${rules.data?.length ?? 0} rules; pruned ${excludedSlugs.length} unpublishable).`,
  );
}

async function main() {
  loadEnvConfig(process.cwd());

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  await backfillKnowledge(client);
}

// Run main() only when invoked directly, not when a loader imports backfillKnowledge.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
