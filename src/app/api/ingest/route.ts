import { NextRequest } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import type { SourceKind } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_CHARS = 60_000;

export interface IngestedSource {
  kind: SourceKind;
  title: string;
  locator: string;
  url: string;
  text: string;
  pages?: number;
  truncated: boolean;
}

/* --------------------------------------------------------------- PDF */

async function ingestPdf(file: File): Promise<IngestedSource> {
  if (file.size > MAX_BYTES) {
    throw new Error(
      `That PDF is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 12 MB.`,
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocumentProxy(buffer);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });

  const body = Array.isArray(text) ? text.join("\n") : text;
  if (!body.trim()) {
    throw new Error(
      "No text could be read from that PDF. Scanned documents need OCR before they can be extracted.",
    );
  }

  return {
    kind: "manufacturer_datasheet",
    title: file.name.replace(/\.pdf$/i, ""),
    locator: `${totalPages} page${totalPages === 1 ? "" : "s"}, text layer`,
    url: `upload://${file.name}`,
    text: body.slice(0, MAX_CHARS),
    pages: totalPages,
    truncated: body.length > MAX_CHARS,
  };
}

/* --------------------------------------------------------------- URL */

/**
 * Strips a page down to readable text. Deliberately dependency-free:
 * scripts, styles and markup go, entities come back, whitespace
 * collapses to something the line-based extractor can work with.
 */
function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/td>\s*<td[^>]*>/gi, "  ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function titleFrom(html: string, url: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = match?.[1]?.replace(/\s+/g, " ").trim();
  if (title) return title.slice(0, 140);
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function ingestUrl(target: string): Promise<IngestedSource> {
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    throw new Error("That does not look like a URL.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http and https URLs can be fetched.");
  }

  // Block the metadata and loopback ranges a server-side fetcher should
  // never be pointed at.
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "169.254.169.254" ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error("That host is not reachable from the ingest service.");
  }

  const response = await fetch(parsed.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; UnifyProductIntelligence/0.1)",
      Accept: "text/html,application/xhtml+xml,application/pdf",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `The page returned ${response.status}. It may block automated fetches.`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/pdf")) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    const pdf = await getDocumentProxy(buffer);
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const body = Array.isArray(text) ? text.join("\n") : text;
    return {
      kind: "manufacturer_datasheet",
      title: parsed.pathname.split("/").pop() || parsed.hostname,
      locator: `${totalPages} pages, fetched PDF`,
      url: parsed.toString(),
      text: body.slice(0, MAX_CHARS),
      pages: totalPages,
      truncated: body.length > MAX_CHARS,
    };
  }

  const html = await response.text();
  const body = htmlToText(html);

  if (body.length < 40) {
    throw new Error(
      "That page rendered almost no text. It is probably a client-side app the fetcher cannot execute.",
    );
  }

  return {
    kind: "manufacturer_web",
    title: titleFrom(html, parsed.toString()),
    locator: parsed.hostname + parsed.pathname,
    url: parsed.toString(),
    text: body.slice(0, MAX_CHARS),
    truncated: body.length > MAX_CHARS,
  };
}

/* ------------------------------------------------------------- route */

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return Response.json({ error: "No file was uploaded." }, { status: 400 });
      }
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        // Plain text and CSV are useful too and need no parsing at all.
        const text = await file.text();
        if (!text.trim()) {
          return Response.json({ error: "That file is empty." }, { status: 400 });
        }
        return Response.json({
          source: {
            kind: "catalog_pdf" satisfies SourceKind,
            title: file.name,
            locator: "uploaded text",
            url: `upload://${file.name}`,
            text: text.slice(0, MAX_CHARS),
            truncated: text.length > MAX_CHARS,
          },
        });
      }
      return Response.json({ source: await ingestPdf(file) });
    }

    const body = await request.json();

    if (typeof body.url === "string" && body.url.trim()) {
      return Response.json({ source: await ingestUrl(body.url.trim()) });
    }

    if (typeof body.text === "string" && body.text.trim()) {
      return Response.json({
        source: {
          kind: (body.kind as SourceKind) ?? "manufacturer_datasheet",
          title: (body.title as string) || "Pasted document",
          locator: "pasted text",
          url: "paste://document",
          text: body.text.slice(0, MAX_CHARS),
          truncated: body.text.length > MAX_CHARS,
        },
      });
    }

    return Response.json(
      { error: "Send a file, a url, or a text body." },
      { status: 400 },
    );
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "The document could not be read.",
      },
      { status: 400 },
    );
  }
}
