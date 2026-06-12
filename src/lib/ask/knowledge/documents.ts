import type { AnalysisRule } from "@/lib/ask/analysis-rules";
import type { VerifiedEntity } from "@/lib/ask/entities";
import type { KnowledgeKind } from "@/lib/ask/knowledge/types";

/** Row shape written to knowledge_documents by syncs and the backfill script. */
export interface KnowledgeDocumentInput {
  kind: KnowledgeKind;
  title: string;
  content: string;
  tags: Record<string, unknown>;
  aliases: string[];
  searchableText: string;
  sourceTable: string;
  sourceId: string;
}

export function normalizeAliasText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function collapseAliasText(value: string) {
  return normalizeAliasText(value).replace(/\s+/g, "");
}

/** Mirrors the alias expansion used by scripts/data/sync-verified-entities.mjs. */
export function expandEntityAliases(name: string, existingAliases: string[] = []) {
  const base = normalizeAliasText(name);
  const aliases = new Set<string>([base, collapseAliasText(name)]);
  const spacedDigits = base.replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2");
  aliases.add(spacedDigits);
  aliases.add(collapseAliasText(spacedDigits));

  if (base.startsWith("the ")) {
    aliases.add(base.slice(4));
    aliases.add(collapseAliasText(base.slice(4)));
  }

  if (base.endsWith(" group")) {
    aliases.add(base.replace(/ group$/, ""));
  }

  for (const alias of existingAliases) {
    const normalized = normalizeAliasText(alias);
    if (normalized) {
      aliases.add(normalized);
      aliases.add(collapseAliasText(alias));
    }
  }

  return [...aliases].filter(Boolean);
}

const ENTITY_TYPE_LABELS: Record<VerifiedEntity["type"], string> = {
  broker: "Broker",
  guru: "Trading guru",
  propfirm: "Prop firm",
};

export function entityToKnowledgeDocument(entity: VerifiedEntity): KnowledgeDocumentInput {
  const aliases = expandEntityAliases(entity.name, entity.aliases);
  const lines = [
    `${entity.name} is a ${ENTITY_TYPE_LABELS[entity.type].toLowerCase()} with status "${entity.status}" and trust score ${entity.trustScore.toFixed(1)}/10.`,
    entity.type === "broker"
      ? `FCA registered: ${entity.fcaRegistered ? `yes${entity.fcaReference ? ` (FRN ${entity.fcaReference})` : ""}` : "no"}.${entity.fcaWarning ? " The FCA has published a warning about this firm." : ""}`
      : null,
    entity.notes,
  ];

  return {
    kind: "entity",
    title: entity.name,
    content: lines.filter(Boolean).join("\n"),
    tags: {
      entity_type: entity.type,
      status: entity.status,
      fca_registered: entity.fcaRegistered,
      fca_warning: entity.fcaWarning,
      trust_score: entity.trustScore,
    },
    aliases,
    searchableText: [normalizeAliasText(entity.name), ...aliases].join(" "),
    sourceTable: "verified_entities",
    sourceId: entity.id,
  };
}

export function ruleToKnowledgeDocument(rule: AnalysisRule): KnowledgeDocumentInput {
  return {
    kind: "rule",
    title: `Rule ${rule.ruleNumber}: ${rule.ruleName}`,
    content: rule.content,
    tags: {
      category: rule.category,
      priority: rule.priority,
      rule_number: rule.ruleNumber,
    },
    aliases: [],
    searchableText: normalizeAliasText(`${rule.category} ${rule.ruleName}`),
    sourceTable: "analysis_rules",
    sourceId: String(rule.ruleNumber),
  };
}
