// Shared helpers for the data-loading scripts (scripts/data/*.mjs).
//
// These run as plain `node`, so they cannot import the TypeScript app code in
// src/lib/ask. The small primitives they all need — CSV parsing, name
// normalization, alias generation, the guru publish gate — live here once
// instead of being copy-pasted into every loader.

// Same status list the read path (src/lib/ask/gurus.ts) imports — single source.
import publishableStatuses from "../../src/lib/ask/guru-publishable-statuses.json" with { type: "json" };

/** Split one CSV line, honoring double-quoted fields and "" escapes. */
export function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  values.push(current);
  return values.map((value) => value.trim());
}

/** Lowercased, punctuation-collapsed, single-spaced form of a name. */
export function normalizeEntityText(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

/** Normalized form with all spaces removed (e.g. "ic markets" -> "icmarkets"). */
export function collapseEntityText(value) {
  return normalizeEntityText(value).replace(/\s+/g, "");
}

/** Parse a noisy numeric cell ("~21,000", "4.6") to a number, or null. */
export function numOrNull(raw) {
  const digits = String(raw ?? "").replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

/** True only for a non-empty http(s) URL — the guru Caution citation rule. */
export function isValidCitation(source) {
  const trimmed = String(source ?? "").trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Platform descriptors that are not real handles (e.g. "Social / Telegram"). */
const PLATFORM_HANDLE = /\b(telegram|youtube|instagram|discord|tiktok|twitter|facebook|website|social)\b/i;

/**
 * Split a compound name like "Amanat (ex-Astro FX / Natts Insider)" into its
 * individual brands so each is searchable on its own. Keeps the full name and
 * the lead name, and strips "ex-/aka/formerly" markers from the alternates.
 */
function brandFragments(name) {
  const fragments = [name];
  const lead = name.replace(/\s*\(.*$/, "").trim();
  if (lead && lead !== name) fragments.push(lead);
  const inner = (name.match(/\(([^)]*)\)/) || [])[1] ?? "";
  for (const part of inner.split(/[/,;]| and /i)) {
    const cleaned = part.replace(/^\s*(ex|aka|formerly|prev|previously|now)[-\s]+/i, "").trim();
    if (cleaned.length >= 4) fragments.push(cleaned);
  }
  return fragments;
}

/**
 * All searchable aliases for any entity name (broker, prop firm, or guru):
 * normalized + collapsed forms, digit/letter-spacing and "the "/" group"
 * variants, compound-name fragments (rebrands, "X (formerly Y)"), FX<->Forex
 * spellings, and an optional social handle. One generator for every type so a
 * firm is as findable by a rebrand or FX spelling as a guru is.
 */
export function createAliases(name, handle) {
  const fragments = brandFragments(name);
  const handleText = String(handle ?? "").replace(/^@/, "").trim();
  if (handleText && !handleText.includes("/") && !PLATFORM_HANDLE.test(handleText)) {
    fragments.push(handleText);
  }

  const aliases = new Set();
  const addVariant = (text) => {
    const base = normalizeEntityText(text);
    if (!base) return;
    aliases.add(base);
    aliases.add(base.replace(/\s+/g, ""));
    const spacedDigits = base.replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2");
    aliases.add(spacedDigits);
    aliases.add(spacedDigits.replace(/\s+/g, ""));
    if (base.startsWith("the ")) {
      aliases.add(base.slice(4));
      aliases.add(base.slice(4).replace(/\s+/g, ""));
    }
    if (base.endsWith(" group")) {
      aliases.add(base.replace(/ group$/, ""));
    }
  };

  for (const fragment of fragments) {
    addVariant(fragment);
    // FX and Forex are used interchangeably in this space; index both spellings.
    if (/\bfx\b/i.test(fragment)) addVariant(fragment.replace(/\bfx\b/gi, "forex"));
    else if (/\bforex\b/i.test(fragment)) addVariant(fragment.replace(/\bforex\b/gi, "fx"));
  }
  return [...aliases].filter(Boolean);
}

// Guru publish gate — a guru publishes only when research is complete and its
// identity is confirmed.
export const GURU_PUBLISHABLE_STATUSES = new Set(publishableStatuses);

export function isGuruPublishable(row) {
  if (row.entity_type !== "guru") {
    return true;
  }
  const status = String(row.research_status ?? "").trim().toLowerCase();
  return (
    GURU_PUBLISHABLE_STATUSES.has(status) &&
    Boolean(row.identity_confirmed)
  );
}
