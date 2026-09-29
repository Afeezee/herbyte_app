/**
 * The real Vercel Function entry — kept under server/ (not api/) so the
 * build script can bundle it and its whole import tree into a single
 * api/_bundle.js. See scripts/build-api.mjs.
 *
 * api/index.ts (the file Vercel actually calls) is a thin re-export
 * from the built bundle.
 *
 * Vercel's Node runtime calls default export as `(req, res)` — legacy
 * Node http-server style — so we adapt to/from Fetch API here rather
 * than using `hono/vercel`'s `handle`, which only fits the Edge
 * runtime's fetch-style handler contract.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { app } from "./router";

export const config = { runtime: "nodejs" };

/**
 * Read the raw body of a Node request as a Buffer. Bodyless methods
 * (GET/HEAD) don't wait on data.
 */
async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
  const m = (req.method ?? "GET").toUpperCase();
  if (m === "GET" || m === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function buildRequest(req: IncomingMessage, body: Buffer | undefined): Request {
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ??
    "https";
  const host =
    (req.headers["x-forwarded-host"] as string | undefined) ??
    (req.headers.host as string | undefined) ??
    "localhost";
  const url = new URL(req.url ?? "/", `${proto}://${host}`);

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(name, v);
    } else {
      headers.append(name, value);
    }
  }

  return new Request(url.toString(), {
    method: req.method ?? "GET",
    headers,
    body: body ? new Uint8Array(body) : undefined,
    // @ts-expect-error — Node's Request supports `duplex` for streaming
    // bodies; the type in older lib versions doesn't include it.
    duplex: body ? "half" : undefined,
  });
}

async function writeResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    // Node lower-cases these automatically; setHeader accepts any casing.
    res.setHeader(key, value);
  });

  if (!response.body) {
    res.end();
    return;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const body = await readBody(req);
    const request = buildRequest(req, body);
    const response = await app.fetch(request);
    await writeResponse(res, response);
  } catch (err) {
    console.error("[api] fatal", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          error: { code: "internal", message: "Internal server error" },
        }),
      );
    } else {
      res.end();
    }
  }
}
