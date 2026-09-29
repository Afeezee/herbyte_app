/**
 * Generic entity API. One router mounts at /api/entities and dispatches to
 * the right table via the policy table in ../policies.
 *
 * URL shapes:
 *   GET    /api/entities/:name?sort=-created_date&limit=50&<field>=<value>...
 *   GET    /api/entities/:name/:id
 *   POST   /api/entities/:name        (body = fields)
 *   PATCH  /api/entities/:name/:id    (body = partial fields)
 *   DELETE /api/entities/:name/:id
 *
 * Response shape: list → array, get/create/update → object, delete →
 * {ok: true}. Fields that don't exist in schema are dropped silently
 * (defence in depth on top of writable_fields).
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { getDb } from "../db";
import type { Variables } from "../router";
import {
  combineFilters,
  pickWritable,
  policies,
  type EntityName,
  type Policy,
} from "../policies";

export const entitiesRoutes = new Hono<{ Variables: Variables }>();

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function resolvePolicy(name: string): { key: EntityName; policy: Policy } {
  const key = name as EntityName;
  const policy = policies[key];
  if (!policy) {
    throw new HTTPException(404, {
      message: `Unknown entity: ${name}`,
      cause: { code: "unknown_entity" },
    });
  }
  return { key, policy };
}

function tableColumn(policy: Policy, field: string): unknown {
  // Drizzle tables expose columns as properties; only return the ones the
  // policy has whitelisted.
  const col = (policy.table as unknown as Record<string, unknown>)[field];
  if (!col) {
    throw new HTTPException(400, {
      message: `Unknown column: ${field}`,
      cause: { code: "unknown_field" },
    });
  }
  return col;
}

function parseSort(policy: Policy, sortParam: string | undefined): SQL {
  const raw = sortParam ?? "-created_date";
  const desc_ = raw.startsWith("-");
  const field = desc_ ? raw.slice(1) : raw;
  if (!policy.sortable_fields.includes(field)) {
    throw new HTTPException(400, {
      message: `Sort not allowed on field: ${field}`,
      cause: { code: "unsortable_field" },
    });
  }
  const col = tableColumn(policy, field);
  return desc_ ? desc(col as never) : asc(col as never);
}

function parseLimit(param: string | undefined): number {
  if (!param) return DEFAULT_LIMIT;
  const n = Number(param);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function parseOffset(param: string | undefined): number {
  if (!param) return 0;
  const n = Number(param);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Turn ?field=value into a WHERE clause fragment, honouring the entity's
 * filterable_fields. Coerces booleans (`true`/`false`) and numbers.
 */
function buildQueryFilter(
  policy: Policy,
  params: URLSearchParams,
): SQL | null {
  const parts: SQL[] = [];
  for (const [k, v] of params.entries()) {
    if (k === "sort" || k === "limit" || k === "offset") continue;
    if (!policy.filterable_fields.includes(k)) continue;
    const col = tableColumn(policy, k);
    const coerced = coerce(v);
    parts.push(eq(col as never, coerced as never));
  }
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0]! : and(...parts)!;
}

function coerce(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (/^-?\d+\.\d+$/.test(raw)) return Number(raw);
  return raw;
}

// ---------------------------------------------------------------------------
// GET /api/entities/:name  — list/filter
// ---------------------------------------------------------------------------

entitiesRoutes.get("/:name", async (c) => {
  const user = c.get("user");
  const { policy } = resolvePolicy(c.req.param("name"));
  const params = new URL(c.req.url).searchParams;

  const readWhere = policy.readFilter?.(user) ?? null;
  const queryWhere = buildQueryFilter(policy, params);
  const where = combineFilters(readWhere, queryWhere);

  const sort = parseSort(policy, params.get("sort") ?? undefined);
  const limit = parseLimit(params.get("limit") ?? undefined);
  const offset = parseOffset(params.get("offset") ?? undefined);

  const db = getDb();
  const q = db
    .select()
    .from(policy.table as never)
    .orderBy(sort)
    .limit(limit)
    .offset(offset);
  const rows = where ? await q.where(where) : await q;
  return c.json(rows);
});

// ---------------------------------------------------------------------------
// GET /api/entities/:name/:id
// ---------------------------------------------------------------------------

entitiesRoutes.get("/:name/:id", async (c) => {
  const user = c.get("user");
  const { policy } = resolvePolicy(c.req.param("name"));
  const id = c.req.param("id");
  const db = getDb();
  const idCol = tableColumn(policy, "id");
  const readWhere = policy.readFilter?.(user) ?? null;
  const where = combineFilters(eq(idCol as never, id), readWhere);
  const [row] = await db
    .select()
    .from(policy.table as never)
    .where(where!)
    .limit(1);
  if (!row) {
    throw new HTTPException(404, {
      message: "Not found",
      cause: { code: "not_found" },
    });
  }
  return c.json(row);
});

// ---------------------------------------------------------------------------
// POST /api/entities/:name — create
// ---------------------------------------------------------------------------

entitiesRoutes.post("/:name", async (c) => {
  const user = c.get("user");
  const { policy } = resolvePolicy(c.req.param("name"));
  const decision = policy.canCreate(user);
  if (!decision.ok) {
    throw new HTTPException(decision.code === "unauthorized" ? 401 : 403, {
      message: decision.message,
      cause: { code: decision.code },
    });
  }

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const picked = pickWritable(policy, body);
  const withOverrides = policy.onCreate ? policy.onCreate(user, picked) : picked;

  // Every entity table shares created_by; force from session so
  // ownership checks work later.
  const values = { ...withOverrides, created_by: user.email };

  const db = getDb();
  const rows = (await db
    .insert(policy.table as never)
    .values(values as never)
    .returning()) as unknown[];
  return c.json(rows[0] ?? null, 201);
});

// ---------------------------------------------------------------------------
// PATCH /api/entities/:name/:id — update
// ---------------------------------------------------------------------------

entitiesRoutes.patch("/:name/:id", async (c) => {
  const user = c.get("user");
  const { policy } = resolvePolicy(c.req.param("name"));
  const id = c.req.param("id");

  const db = getDb();
  const idCol = tableColumn(policy, "id");
  const [existing] = await db
    .select()
    .from(policy.table as never)
    .where(eq(idCol as never, id))
    .limit(1);
  if (!existing) {
    throw new HTTPException(404, { message: "Not found", cause: { code: "not_found" } });
  }

  const decision = policy.canUpdate(user, existing as never);
  if (!decision.ok) {
    throw new HTTPException(decision.code === "unauthorized" ? 401 : 403, {
      message: decision.message,
      cause: { code: decision.code },
    });
  }

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const picked = pickWritable(policy, body);
  const withOverrides = policy.onUpdate
    ? policy.onUpdate(user, picked, existing as never)
    : picked;
  const values = { ...withOverrides, updated_date: sql`now()` };

  const rows = (await db
    .update(policy.table as never)
    .set(values as never)
    .where(eq(idCol as never, id))
    .returning()) as unknown[];
  return c.json(rows[0] ?? null);
});

// ---------------------------------------------------------------------------
// DELETE /api/entities/:name/:id
// ---------------------------------------------------------------------------

entitiesRoutes.delete("/:name/:id", async (c) => {
  const user = c.get("user");
  const { policy } = resolvePolicy(c.req.param("name"));
  const id = c.req.param("id");

  const db = getDb();
  const idCol = tableColumn(policy, "id");
  const [existing] = await db
    .select()
    .from(policy.table as never)
    .where(eq(idCol as never, id))
    .limit(1);
  if (!existing) {
    throw new HTTPException(404, { message: "Not found", cause: { code: "not_found" } });
  }

  const decision = policy.canDelete(user, existing as never);
  if (!decision.ok) {
    throw new HTTPException(decision.code === "unauthorized" ? 401 : 403, {
      message: decision.message,
      cause: { code: decision.code },
    });
  }

  await db.delete(policy.table as never).where(eq(idCol as never, id));
  return c.json({ ok: true });
});
