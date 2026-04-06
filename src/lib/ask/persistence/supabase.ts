import { type AskAttachmentMeta, type AskUiMeta } from "@/lib/ask/contracts";
import {
  ASK_ATTACHMENTS_BUCKET,
  ASK_ATTACHMENT_SIGNED_URL_TTL_SECONDS,
} from "@/lib/ask/config";
import { decodeImageDataUrl } from "@/lib/ask/image-data-url";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

import {
  clampHistoryLimit,
  decodeSessionCursor,
  encodeSessionCursor,
  decodeHistoryCursor,
  encodeHistoryCursor,
  inferSessionTitleFromInput,
  parseStoredCard,
  toHistory,
} from "@/lib/ask/persistence/shared";
import {
  type AskPersistence,
  type PersistAskExchangeInput,
} from "@/lib/ask/persistence/types";

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-");

  return cleaned || "attachment";
}

async function signAttachmentPreview(storagePath: string) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client.storage
    .from(ASK_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, ASK_ATTACHMENT_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

async function uploadAttachment(
  input: PersistAskExchangeInput,
): Promise<AskAttachmentMeta | null> {
  if (!input.attachmentMeta || !input.userImageDataUrl) {
    return input.attachmentMeta ?? null;
  }

  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error("Supabase admin is not configured for Ask attachment storage.");
  }

  const parsedImage = decodeImageDataUrl(input.userImageDataUrl);
  const fileName = input.attachmentMeta.fileName ?? "attachment";
  const storagePath = `sessions/${input.sessionId}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;

  const { error } = await client.storage.from(ASK_ATTACHMENTS_BUCKET).upload(
    storagePath,
    parsedImage.bytes,
    {
      contentType: input.attachmentMeta.mimeType ?? parsedImage.mimeType,
      upsert: false,
    },
  );

  if (error) {
    throw new Error("Could not store Ask attachment.");
  }

  const previewUrl = await signAttachmentPreview(storagePath);

  return {
    ...input.attachmentMeta,
    mimeType: input.attachmentMeta.mimeType ?? parsedImage.mimeType,
    storagePath,
    previewUrl,
  };
}

async function hydrateAttachmentMeta(
  attachmentMeta: AskAttachmentMeta | null | undefined,
): Promise<AskAttachmentMeta | null> {
  if (!attachmentMeta) {
    return null;
  }

  if (!attachmentMeta.storagePath) {
    return attachmentMeta;
  }

  const previewUrl = await signAttachmentPreview(attachmentMeta.storagePath);

  return {
    ...attachmentMeta,
    previewUrl: previewUrl ?? attachmentMeta.previewUrl ?? null,
  };
}

export function createSupabasePersistence(): AskPersistence {
  const persistence: AskPersistence = {
    async listSessions(limit = 40, cursor = null) {
      const client = getSupabaseAdminClient();
      if (!client) {
        throw new Error("Supabase admin is not configured for Ask sessions.");
      }

      const pageSize = Math.max(1, Math.min(limit, 100));
      const decodedCursor = cursor ? decodeSessionCursor(cursor) : null;

      let query = client
        .from("chat_sessions")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(pageSize + 80);

      if (decodedCursor) {
        query = query.lte("updated_at", decodedCursor.updatedAt);
      }

      const { data, error } = await query;

      if (error || !data) {
        throw new Error("Could not load Ask sessions from Supabase.");
      }

      const filteredData = decodedCursor
        ? data.filter((session) => {
            const updatedAt = session.updated_at as string;
            const id = session.id as string;
            return (
              updatedAt < decodedCursor.updatedAt ||
              (updatedAt === decodedCursor.updatedAt && id < decodedCursor.id)
            );
          })
        : data;
      const hasMore = filteredData.length > pageSize;
      const pageRecords = hasMore ? filteredData.slice(0, pageSize) : filteredData;
      const sessions = pageRecords.map((session) => ({
        id: session.id as string,
        title: (session.title as string | null | undefined)?.trim() || "New Ask Session",
        updatedAt: session.updated_at as string,
      }));

      return {
        sessions,
        nextCursor: hasMore
          ? encodeSessionCursor({
              id: (pageRecords.at(pageRecords.length - 1)?.id as string | undefined) ?? "",
              updatedAt:
                (pageRecords.at(pageRecords.length - 1)?.updated_at as string | undefined) ?? "",
            })
          : null,
      };
    },
    async deleteSession(sessionId) {
      const client = getSupabaseAdminClient();
      if (!client) {
        throw new Error("Supabase admin is not configured for Ask sessions.");
      }

      const { error } = await client.from("chat_sessions").delete().eq("id", sessionId);

      if (error) {
        throw new Error("Could not delete the Ask session.");
      }
    },
    async loadHistory(sessionId) {
      const page = await persistence.loadThreadPage(sessionId, { limit: 10 });
      return toHistory(page.messages);
    },
    async loadThreadPage(sessionId, options = {}) {
      const client = getSupabaseAdminClient();
      if (!client) {
        throw new Error("Supabase admin is not configured for Ask history.");
      }

      const limit = clampHistoryLimit(options.limit);
      const decodedCursor = options.cursor ? decodeHistoryCursor(options.cursor) : null;
      let query = client
        .from("chat_messages")
        .select("id, role, content, card_payload, attachment_meta, ui_meta, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 80);

      if (decodedCursor) {
        query = query.lte("created_at", decodedCursor.createdAt);
      }

      const { data, error } = await query;

      if (error || !data) {
        throw new Error("Could not load Ask history from Supabase.");
      }

      const filteredData = decodedCursor
        ? data.filter((message) => {
            const createdAt = message.created_at as string;
            const id = message.id as string;
            return (
              createdAt < decodedCursor.createdAt ||
              (createdAt === decodedCursor.createdAt && id < decodedCursor.id)
            );
          })
        : data;

      const hasMore = filteredData.length > limit;
      const pageRecords = hasMore ? filteredData.slice(0, limit) : filteredData;
      const messages = await Promise.all(
        [...pageRecords]
        .reverse()
        .map(async (message) => ({
          id: message.id as string,
          role: message.role as "user" | "assistant",
          content: message.content as string,
          card: parseStoredCard(message.card_payload, message.content as string),
          uiMeta: (message.ui_meta as AskUiMeta | null | undefined) ?? null,
          attachmentMeta: await hydrateAttachmentMeta(
            (message.attachment_meta as AskAttachmentMeta | null | undefined) ?? null,
          ),
          createdAt: message.created_at as string,
        })),
      );

      return {
        messages,
        nextCursor: hasMore
          ? encodeHistoryCursor({
              id: (pageRecords.at(pageRecords.length - 1)?.id as string | undefined) ?? "",
              createdAt:
                (pageRecords.at(pageRecords.length - 1)?.created_at as string | undefined) ?? "",
            })
          : null,
      };
    },
    async saveExchange(input: PersistAskExchangeInput) {
      const client = getSupabaseAdminClient();
      if (!client) {
        throw new Error("Supabase admin is not configured for Ask persistence.");
      }

      const now = new Date().toISOString();
      const attachmentMeta = await uploadAttachment(input);
      const { data: existingSession, error: existingSessionError } = await client
        .from("chat_sessions")
        .select("title")
        .eq("id", input.sessionId)
        .maybeSingle();

      if (existingSessionError) {
        throw new Error("Could not load the Ask session.");
      }

      const sessionTitle =
        (existingSession?.title as string | null | undefined)?.trim() ||
        inferSessionTitleFromInput(input.userMessage, input.attachmentMeta?.fileName);
      const { error: sessionError } = await client.from("chat_sessions").upsert(
        {
          id: input.sessionId,
          title: sessionTitle,
          user_id: null,
          updated_at: now,
        },
        {
          onConflict: "id",
        },
      );

      if (sessionError) {
        throw new Error("Could not create or update the Ask session.");
      }

      const { error: messageError } = await client.from("chat_messages").insert([
        {
          session_id: input.sessionId,
          role: "user",
          content: input.userMessage,
          attachment_meta: attachmentMeta,
          created_at: now,
        },
        {
          session_id: input.sessionId,
          role: "assistant",
          content: JSON.stringify(input.assistantCard),
          card_payload: input.assistantCard,
          ui_meta: input.assistantUiMeta ?? null,
          attachment_meta: attachmentMeta,
          created_at: new Date(Date.parse(now) + 1).toISOString(),
        },
      ]);

      if (messageError) {
        throw new Error("Could not store Ask messages.");
      }
    },
  };

  return persistence;
}
