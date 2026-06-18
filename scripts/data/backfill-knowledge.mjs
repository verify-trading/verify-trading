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
  const isBroker = row.entity_type === "broker";
  // BTS broker rows store inputs and compute the score on read, so trust_score
  // is often null — only state a hard score when one is actually stored.
  const hasScore = row.trust_score !== null && row.trust_score !== undefined;
  const lines = [
    `${row.name} is a ${ENTITY_TYPE_LABELS[row.entity_type] ?? "entity"} with status "${row.status}"${
      hasScore ? ` and trust score ${Number(row.trust_score).toFixed(1)}/10` : ""
    }.`,
    isBroker && row.final_tier
      ? `BTS tier: ${row.final_tier}${row.founder_verified ? " (founder-verified, locked)" : ""}.${
          row.leverage ? ` Advertised max retail leverage ${row.leverage}.` : ""
        }`
      : null,
    isBroker && row.regulators_listed
      ? `Regulators listed (unverified research; the live register is the source of truth): ${row.regulators_listed}.`
      : null,
    isBroker
      ? `FCA registered: ${row.fca_registered ? `yes${row.fca_reference ? ` (FRN ${row.fca_reference})` : ""}` : "not confirmed"}.${row.fca_warning ? " The FCA has published a warning about this firm." : ""}`
      : null,
    row.founder_notes ? `Founder note: ${row.founder_notes}` : null,
    row.notes && row.notes !== row.founder_notes ? row.notes : null,
  ];

  return {
    kind: "entity",
    title: row.name,
    content: lines.filter(Boolean).join("\n"),
    tags: {
      entity_type: row.entity_type,
      status: row.status,
      fca_registered: Boolean(row.fca_registered),
      fca_warning: Boolean(row.fca_warning),
      final_tier: row.final_tier ?? null,
      founder_verified: Boolean(row.founder_verified),
      ...(hasScore ? { trust_score: Number(row.trust_score) } : {}),
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
    client.from("verified_entities").select("*"),
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
