import { readFile } from "node:fs/promises";
import path from "node:path";

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { parseCsvLine } from "./_shared.mjs";

const { loadEnvConfig } = nextEnv;

async function main() {
  loadEnvConfig(process.cwd());

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  // Defaults to the legacy seed; pass the ITVE v3 file as argv[2] to load it.
  //   node scripts/data/sync-analysis-rules.mjs ITVE_v3_rules.csv
  const filePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(process.cwd(), "analysis_rules_seed.csv");
  const raw = await readFile(filePath, "utf8");
  const [headerLine, ...lines] = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(headerLine);

  const rows = lines.map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));

    // ITVE v3 names the weight column priority_weight and uses TRUE/FALSE.
    const priority = row.priority_weight ?? row.priority ?? "";
    const active = String(row.active ?? "").trim().toLowerCase();

    return {
      rule_number: Number.parseInt(row.rule_number, 10),
      category: row.category.trim(),
      rule_name: row.rule_name.trim(),
      content: row.content.trim(),
      priority: Number.parseInt(priority, 10),
      active: active === "true" || active === "1" || active === "yes",
    };
  });

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await supabase
    .from("analysis_rules")
    .upsert(rows, { onConflict: "rule_number" });

  if (error) {
    throw error;
  }

  console.log(`Synced ${rows.length} analysis rules.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
