import { describe, expect, it } from "vitest";

import { ASK_ATTACHMENT_MAX_BYTES } from "@/lib/ask/config";
import { decodeImageDataUrl } from "@/lib/ask/image-data-url";
import { AskValidationError } from "@/lib/ask/validation-error";

function tinyPngBase64() {
  // 1×1 PNG
  return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
}

describe("decodeImageDataUrl", () => {
  it("decodes a valid PNG data URL", () => {
    const url = `data:image/png;base64,${tinyPngBase64()}`;
    const { mimeType, bytes } = decodeImageDataUrl(url);
    expect(mimeType).toBe("image/png");
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes.length).toBeLessThanOrEqual(ASK_ATTACHMENT_MAX_BYTES);
  });

  it("rejects oversized payloads before full decode", () => {
    const huge = "A".repeat(Math.ceil((ASK_ATTACHMENT_MAX_BYTES * 4) / 3) + 100);
    const url = `data:image/png;base64,${huge}`;
    expect(() => decodeImageDataUrl(url)).toThrow(AskValidationError);
  });

  it("rejects non-image MIME types", () => {
    expect(() =>
      decodeImageDataUrl("data:text/html;base64,PHNjcmlwdD4K"),
    ).toThrow(AskValidationError);
  });
});
