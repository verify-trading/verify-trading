import { getSupabaseAdminClient } from "@/lib/supabase/admin";

import { clearMemoryAskPersistence, createMemoryPersistence } from "@/lib/ask/persistence/memory";
import { createSupabasePersistence } from "@/lib/ask/persistence/supabase";
import type { AskPersistence } from "@/lib/ask/persistence/types";

export type { AskPersistence } from "@/lib/ask/persistence/types";
export type {
  PersistAskExchangeInput,
  PersistedAskHistoryMessage,
} from "@/lib/ask/persistence/types";

function isTestEnvironment() {
  return process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
}

const memoryPersistence = createMemoryPersistence();

export function getAskPersistence(options?: { userId?: string }): AskPersistence {
  if (!getSupabaseAdminClient()) {
    if (!isTestEnvironment()) {
      throw new Error("Supabase admin is not configured for Ask persistence.");
    }
    return memoryPersistence;
  }

  const userId = options?.userId;
  if (!userId) {
    throw new Error("Authenticated user id is required for Ask persistence.");
  }

  return createSupabasePersistence(userId);
}

export { clearMemoryAskPersistence };

export type {
  AskCard,
  AskHistoryPage,
  AskHistoryPageMessage,
  AskUiMeta,
} from "@/lib/ask/contracts";
