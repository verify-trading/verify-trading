import { z } from "zod";

const psychologySectionScoresSchema = z.object({
  wrong: z.number().int().min(0).max(15),
  fear: z.number().int().min(0).max(15),
  compulsion: z.number().int().min(0).max(15),
  awareness: z.number().int().min(0).max(15),
  discipline: z.number().int().min(0).max(15),
});

const psychologyFlagsSchema = z.object({
  chasing: z.boolean(),
  compulsive: z.boolean(),
  financialPressure: z.boolean(),
  sleepPoor: z.boolean(),
  rebuilding: z.boolean(),
});

export const psychologyAssessmentCreateSchema = z.object({
  sectionScores: psychologySectionScoresSchema,
  answers: z.record(z.string(), z.unknown()),
  q1TradingSituation: z.string().trim().min(1),
  q2StressLevel: z.string().trim().min(1),
  q3FinancialSituation: z.string().trim().min(1),
  q4SleepQuality: z.string().trim().min(1),
  q5EnergyLevel: z.string().trim().min(1),
  q29Focus: z.string().trim().min(1),
  flags: psychologyFlagsSchema,
});

export const psychologyAssessmentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
});

export type PsychologySectionScores = z.infer<typeof psychologySectionScoresSchema>;

export type PsychologyAssessmentRow = {
  id: string;
  section_scores: PsychologySectionScores;
  total_score: number;
  max_score: number;
  zone_label: string;
  focus_area: keyof PsychologySectionScores;
  summary: string;
  answers: Record<string, unknown> | null;
  q29_focus: string;
  created_at: string;
  updated_at: string;
};

export type PsychologyAssessment = {
  id: string;
  sectionScores: PsychologySectionScores;
  totalScore: number;
  maxScore: 75;
  zoneLabel: string;
  focusArea: keyof PsychologySectionScores;
  summary: string;
  q29Focus: string;
  answers: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

// Read back in the assessment summary and in the coach's prompt — one table so they agree.
export const sectionLabels: Record<keyof PsychologySectionScores, string> = {
  wrong: "Being Wrong",
  fear: "Fear",
  compulsion: "Chasing and Compulsion",
  awareness: "Self Awareness",
  discipline: "Discipline and Process",
};

function zoneLabel(totalScore: number) {
  if (totalScore <= 18) return "Disciplined Trader";
  if (totalScore <= 37) return "Developing Trader";
  if (totalScore <= 56) return "Reactive Trader";
  return "At-Risk Trader";
}

function pickFocusArea(sectionScores: PsychologySectionScores): keyof PsychologySectionScores {
  return Object.entries(sectionScores).reduce<keyof PsychologySectionScores>(
    (highest, [key, score]) => score > sectionScores[highest] ? key as keyof PsychologySectionScores : highest,
    "wrong",
  );
}

export function scorePsychologyAssessment(sectionScores: PsychologySectionScores) {
  const totalScore = Object.values(sectionScores).reduce((sum, score) => sum + score, 0);
  const focusArea = pickFocusArea(sectionScores);
  const zone = zoneLabel(totalScore);
  return {
    sectionScores,
    totalScore,
    maxScore: 75,
    zoneLabel: zone,
    focusArea,
    summary: `${sectionLabels[focusArea]} is the strongest pattern right now.`,
  };
}

export function toPsychologyAssessment(row: PsychologyAssessmentRow): PsychologyAssessment {
  return {
    id: row.id,
    sectionScores: row.section_scores,
    totalScore: row.total_score,
    maxScore: 75,
    zoneLabel: row.zone_label,
    focusArea: row.focus_area,
    summary: row.summary,
    q29Focus: row.q29_focus,
    answers: row.answers,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
