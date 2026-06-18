import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { backfillKnowledge } from "./backfill-knowledge.mjs";
import { collapseEntityText, createAliases, parseCsvLine } from "./_shared.mjs";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const filePath = path.join(process.cwd(), "verified_entities_seed-1.csv");
  const raw = await readFile(filePath, "utf8");
  const [headerLine, ...lines] = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(headerLine);

  const rows = lines.map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const slug = collapseEntityText(row.name);

    return {
      slug,
      name: row.name.trim(),
      entity_type: row.type,
      status: row.status,
      fca_registered: row.fca_registered === "true",
      fca_reference: row.fca_reference.trim() || null,
      fca_warning: row.fca_warning === "true",
      trust_score: Number.parseFloat(row.trust_score),
      notes: row.notes.trim(),
      source: row.source.trim(),
      aliases: createAliases(row.name),
    };
  });

  const brokerEntityMapRows = rows
    .filter((row) => row.entity_type === "broker" && row.fca_reference)
    .map((row) => ({
      entity_slug: row.slug,
      broker_name: row.name,
      fca_reference: row.fca_reference,
    }));

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await supabase
    .from("verified_entities")
    .upsert(rows, { onConflict: "slug" });

  if (error) {
    throw error;
  }

  if (brokerEntityMapRows.length > 0) {
    const { error: brokerMapError } = await supabase
      .from("broker_entity_map")
      .upsert(brokerEntityMapRows, { onConflict: "broker_name" });

    if (brokerMapError) {
      throw brokerMapError;
    }
  }

  console.log(
    `Synced ${rows.length} verified entities and ${brokerEntityMapRows.length} broker mappings.`,
  );

  // Keep the retrieval index in sync — never leave it stale after a load.
  await backfillKnowledge(supabase);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
