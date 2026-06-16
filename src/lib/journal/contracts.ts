import { z } from "zod";

const journalMoodSchema = z.enum(["good", "okay", "tough"]);

export const journalEntryCreateSchema = z.object({
  entryDate: z.iso.date(),
  mood: journalMoodSchema,
  pnlAmount: z.number().finite().min(-9999999999.99).max(9999999999.99).nullable().optional(),
  pnlCurrency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional().default("GBP"),
  note: z.string().trim().max(4_000).optional().default(""),
  lesson: z.string().trim().max(2_000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional().default([]),
});

export const overheatLogCreateSchema = z.object({
  triggerType: z.enum(["winning_streak", "losing_streak", "pnl_overheat"]),
  triggerValue: z.number().finite(),
  userResponse: z.enum(["break", "reduced_size"]),
});

export const journalEntriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(60).optional().default(31),
  cursor: z.string().trim().min(1).optional(),
});

export type JournalEntryCreateInput = z.infer<typeof journalEntryCreateSchema>;

export type JournalEntryRow = {
  id: string;
  entry_date: string;
  mood: "good" | "okay" | "tough";
  pnl_amount: number | string | null;
  pnl_currency: string;
  note: string;
  lesson: string | null;
  challenge_status_note: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

export type JournalEntry = {
  id: string;
  entryDate: string;
  mood: "good" | "okay" | "tough";
  pnlAmount: number | null;
  pnlCurrency: string;
  note: string;
  lesson: string | null;
  challengeStatusNote: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export function toJournalEntry(row: JournalEntryRow): JournalEntry {
  return {
    id: row.id,
    entryDate: row.entry_date,
    mood: row.mood,
    pnlAmount: row.pnl_amount === null ? null : Number(row.pnl_amount),
    pnlCurrency: row.pnl_currency,
    note: row.note,
    lesson: row.lesson,
    challengeStatusNote: row.challenge_status_note,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
