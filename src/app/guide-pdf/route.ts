import { readFile } from "node:fs/promises";
import path from "node:path";

const guidePdfPromise = readFile(path.join(process.cwd(), "public", "verify-trading-guide"));

export async function GET() {
  try {
    const pdf = await guidePdfPromise;
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="verify-trading-guide.pdf"',
        "Cache-Control": "public, max-age=3600",
        // Image-only PDF: /guide is the indexable HTML version of the same guide.
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    return new Response("Guide PDF not found.", { status: 404 });
  }
}
