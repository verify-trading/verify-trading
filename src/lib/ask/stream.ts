import { z } from "zod";

import type { AskStreamSession, AskUiMeta } from "@/lib/ask/contracts";

export const askToolStatusSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().min(1).optional(),
  phase: z.enum(["thinking", "working", "finalizing"]),
  toolName: z.string().min(1).optional(),
});

export type AskToolStatus = z.infer<typeof askToolStatusSchema>;

export type AskStreamData = {
  "ui-meta": AskUiMeta;
  session: AskStreamSession;
  "tool-status": AskToolStatus;
};
