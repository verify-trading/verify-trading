import {
  askCardSchema,
  askSessionMemorySchema,
  type AskCard,
  type AskRequest,
  type AskSessionMemory,
} from "@/lib/ask/contracts";
import { extractJson } from "@/lib/ask/service/context";

type AskConversationMessage = NonNullable<AskRequest["history"]>[number];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clampWords(value: string, maxWords: number) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return "";
  }

  const words = normalized.split(" ");
  if (words.length <= maxWords) {
    return normalized;
  }

  return `${words.slice(0, maxWords).join(" ")}…`;
}

function inferTradeSideFromCard(card: AskCard): "buy" | "sell" | undefined {
  if (card.type !== "setup" && card.type !== "chart") {
    return undefined;
  }

  if (card.bias === "Bullish") {
    return "buy";
  }
  if (card.bias === "Bearish") {
    return "sell";
  }

  return undefined;
}

function mergeRecentUserGoals(
  latestGoals: string[],
  previousGoals: string[] | undefined,
): string[] | undefined {
  const merged = [...latestGoals];

  for (const goal of previousGoals ?? []) {
    if (!goal || merged.includes(goal)) {
      continue;
    }
    merged.push(goal);
    if (merged.length === 3) {
      break;
    }
  }

  return merged.length > 0 ? merged : undefined;
}

export function deriveAskSessionMemory(
  history: AskRequest["history"] | undefined,
  previousMemory: AskSessionMemory | null = null,
  options: { lastUpdatedAt?: string } = {},
): AskSessionMemory | null {
  const messages = history ?? [];
  const state: Partial<AskSessionMemory> = previousMemory
    ? JSON.parse(JSON.stringify(previousMemory))
    : {};
  const recentUserGoals: string[] = [];
  let latestUserMessage: string | null = null;
  let latestTurnRole: AskConversationMessage["role"] | null = null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const content = normalizeWhitespace(message.content);

    if (!content) {
      continue;
    }

    latestTurnRole ??= message.role;

    if (message.role === "user") {
      latestUserMessage ??= clampWords(content, 24);

      const goal = clampWords(content, 20);
      if (goal && !recentUserGoals.includes(goal) && recentUserGoals.length < 3) {
        recentUserGoals.push(goal);
      }
      continue;
    }

    const parsed = askCardSchema.safeParse(extractJson(content));
    if (!parsed.success) {
      continue;
    }

    const card = parsed.data;
    state.lastCardType ??= card.type;

    if ((card.type === "briefing" || card.type === "setup") && !state.activeAsset) {
      state.activeAsset = card.asset;
    }

    if (card.type === "setup" && !state.lastSetup) {
      state.lastSetup = {
        entry: card.entry,
        stop: card.stop,
        target: card.target,
        bias: card.bias,
      };
      state.activeSide ??= inferTradeSideFromCard(card);
    }

    if (card.type === "projection" && !state.lastProjection) {
      state.lastProjection = {
        months: card.months,
        startBalance: card.startBalance,
        monthlyAdd: card.monthlyAdd,
        totalReturn: card.totalReturn,
      };
    }

    if (card.type === "plan" && !state.lastPlan) {
      state.lastPlan = {
        startBalance: card.startBalance,
        monthlyAdd: card.monthlyAdd,
        dailyTarget: card.dailyTarget,
        monthlyTarget: card.monthlyTarget,
        projectionReturn: card.projectionReturn,
      };
    }

    if ((card.type === "broker" || card.type === "guru") && !state.lastVerifiedEntity) {
      state.lastVerifiedEntity = {
        name: card.name,
        status: card.status,
        kind: card.type,
      };
    }
  }

  const mergedRecentGoals = mergeRecentUserGoals(
    recentUserGoals,
    previousMemory?.recentUserGoals,
  );
  if (mergedRecentGoals) {
    state.recentUserGoals = mergedRecentGoals;
  } else {
    delete state.recentUserGoals;
  }

  if (latestTurnRole === "user" && latestUserMessage) {
    state.openQuestion = latestUserMessage;
  } else {
    delete state.openQuestion;
  }

  if (options.lastUpdatedAt) {
    state.lastUpdatedAt = options.lastUpdatedAt;
  }

  if (Object.keys(state).length === 0) {
    return null;
  }

  return askSessionMemorySchema.parse(state);
}

export function buildSessionMemoryMessage(memory: AskSessionMemory | null) {
  if (!memory) {
    return null;
  }

  const lines = [
    "SESSION MEMORY",
    "Use this only to resolve omitted context in follow-up questions. Explicit user input overrides it.",
  ];

  if (memory.activeAsset) {
    lines.push(`Active asset: ${memory.activeAsset}`);
  }
  if (memory.lastCardType) {
    lines.push(`Last card type: ${memory.lastCardType}`);
  }
  if (memory.activeSide) {
    lines.push(`Active trade side: ${memory.activeSide}`);
  }
  if (memory.lastSetup) {
    lines.push(
      `Last setup: bias ${memory.lastSetup.bias}, entry ${memory.lastSetup.entry}, stop ${memory.lastSetup.stop}, target ${memory.lastSetup.target}`,
    );
  }
  if (memory.lastProjection) {
    lines.push(
      `Last projection: ${memory.lastProjection.months} months, start ${memory.lastProjection.startBalance}, monthly add ${memory.lastProjection.monthlyAdd}, total return ${memory.lastProjection.totalReturn}`,
    );
  }
  if (memory.lastPlan) {
    lines.push(
      `Last plan: start ${memory.lastPlan.startBalance}, monthly add ${memory.lastPlan.monthlyAdd}, daily target ${memory.lastPlan.dailyTarget}, monthly target ${memory.lastPlan.monthlyTarget}, projection return ${memory.lastPlan.projectionReturn}`,
    );
  }
  if (memory.lastVerifiedEntity) {
    lines.push(
      `Last verified entity: ${memory.lastVerifiedEntity.name} (${memory.lastVerifiedEntity.kind}, ${memory.lastVerifiedEntity.status})`,
    );
  }
  if (memory.recentUserGoals?.length) {
    lines.push(`Recent user goals: ${memory.recentUserGoals.join(" | ")}`);
  }
  if (memory.openQuestion) {
    lines.push(`Open question: ${memory.openQuestion}`);
  }

  return lines.join("\n");
}

export function buildUpdatedSessionMemory(input: {
  history: AskRequest["history"] | undefined;
  userMessage: string;
  assistantCard: AskCard;
  previousMemory?: AskSessionMemory | null;
  lastUpdatedAt?: string;
}) {
  const nextHistory = [...(input.history ?? [])];
  const trimmedUserMessage = normalizeWhitespace(input.userMessage);

  if (trimmedUserMessage) {
    nextHistory.push({
      role: "user",
      content: trimmedUserMessage,
    });
  }

  nextHistory.push({
    role: "assistant",
    content: JSON.stringify(input.assistantCard),
  });

  return deriveAskSessionMemory(nextHistory, input.previousMemory ?? null, {
    lastUpdatedAt: input.lastUpdatedAt,
  });
}
