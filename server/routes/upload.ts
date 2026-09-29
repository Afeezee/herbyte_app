/**
 * POST /api/upload — signed-in image upload to Vercel Blob.
 *
 * Frontend expects the response shape { file_url: string }.
 * Restricts to a small MIME allow-list, caps at 5 MB, and gives every
 * upload a random suffix so filenames from the client aren't authoritative.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { put } from "@vercel/blob";
import { getEnv } from "../env";
import type { Variables } from "../router";

export const uploadRoutes = new Hono<{ Variables: Variables }>();

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

uploadRoutes.post("/", async (c) => {
  const env = getEnv();
  if (!env.BLOB_READ_WRITE_TOKEN) {
    throw new HTTPException(500, { message: "BLOB_READ_WRITE_TOKEN not configured" });
  }

  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    throw new HTTPException(415, {
      message: "Expected multipart/form-data",
      cause: { code: "unsupported_media_type" },
    });
  }

  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new HTTPException(400, {
      message: "Missing 'file' field",
      cause: { code: "invalid_body" },
    });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    throw new HTTPException(415, {
      message: `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, WEBP, GIF.`,
      cause: { code: "unsupported_media_type" },
    });
  }

  if (file.size > MAX_BYTES) {
    throw new HTTPException(413, {
      message: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB); max is 5 MB.`,
      cause: { code: "payload_too_large" },
    });
  }

  const extFromMime =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "gif";
  // Ignore whatever filename the client supplied — use a random one.
  const randomName = `${crypto.randomUUID()}.${extFromMime}`;
  const path = `uploads/${new Date().toISOString().slice(0, 10)}/${randomName}`;

  const buffer = await file.arrayBuffer();
  const blob = await put(path, buffer, {
    access: "public",
    contentType: file.type,
    token: env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false, // We already randomised.
  });

  return c.json({ file_url: blob.url });
});
