import { ASK_ATTACHMENT_MAX_BYTES } from "@/lib/ask/config";
import { AskValidationError } from "@/lib/ask/validation-error";

const IMAGE_DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,([\s\S]+)$/;

/** Max base64 payload length before decode (~5MB binary + padding). */
const MAX_BASE64_CHARS = Math.ceil((ASK_ATTACHMENT_MAX_BYTES * 4) / 3) + 8;

/**
 * Validates and decodes an image data URL. Enforces MIME allowlist and byte cap
 * before allocating large buffers (DoS mitigation).
 */
export function decodeImageDataUrl(dataUrl: string): {
  mimeType: string;
  bytes: Buffer;
} {
  const match = dataUrl.match(IMAGE_DATA_URL_RE);
  if (!match) {
    throw new AskValidationError(
      "Image must be a base64 data URL (PNG, JPEG, or WebP).",
    );
  }

  const base64Payload = match[2].replace(/\s/g, "");
  if (base64Payload.length > MAX_BASE64_CHARS) {
    throw new AskValidationError(
      `Image must be at most ${ASK_ATTACHMENT_MAX_BYTES} bytes.`,
    );
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(base64Payload, "base64");
  } catch {
    throw new AskValidationError("Image data is not valid base64.");
  }

  if (bytes.length > ASK_ATTACHMENT_MAX_BYTES) {
    throw new AskValidationError(
      `Image must be at most ${ASK_ATTACHMENT_MAX_BYTES} bytes.`,
    );
  }

  if (bytes.length === 0) {
    throw new AskValidationError("Image data is empty.");
  }

  return { mimeType: match[1], bytes };
}
