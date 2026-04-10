import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const pdfPath = path.join(process.cwd(), "verify-trading-guide.pdf");

  try {
    const pdf = await readFile(pdfPath);
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="verify-trading-guide.pdf"',
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Guide PDF not found.", { status: 404 });
  }
}
