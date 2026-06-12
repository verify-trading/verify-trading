export type KnowledgeKind = "entity" | "rule" | "playbook" | "policy";

export interface KnowledgeChunk {
  id: string;
  kind: KnowledgeKind;
  title: string;
  content: string;
  tags: Record<string, unknown>;
  score: number;
}

export type EntityMatchType = "exact" | "fuzzy";

export interface EntityCandidate {
  id: string;
  title: string;
  tags: Record<string, unknown>;
  /** Slug of the verified_entities row this document was synced from. */
  sourceId: string | null;
  matchType: EntityMatchType;
  similarity: number;
}

export interface RetrievedAskKnowledge {
  entityCandidates: EntityCandidate[];
  chunks: KnowledgeChunk[];
}
