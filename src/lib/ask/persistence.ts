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
const supabasePersistence = createSupabasePersistence();

export function getAskPersistence(): AskPersistence {
  if (getSupabaseAdminClient()) {
    return supabasePersistence;
  }

  return isTestEnvironment() ? memoryPersistence : supabasePersistence;
}

export { clearMemoryAskPersistence };

export type {
  AskCard,
  AskHistoryPage,
  AskHistoryPageMessage,
  AskUiMeta,
} from "@/lib/ask/contracts";
