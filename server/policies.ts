/**
 * Per-entity authorisation, field allow-lists, and server-owned field
 * overrides. This file is the single source of truth for what a signed-in
 * caller can read, write and change on each entity.
 *
 * Design notes (from section 3.2 of the migration prompt):
 * - Every write strips fields not in `writable_fields` before it touches
 *   the DB. That includes `moderation_status`, `role`, `created_by`,
 *   `approved_by_ai`, etc., which must never be trusted from the client.
 * - Identity-forcing fields (comment author, wishlist user_email, product
 *   seller_id) are OVERWRITTEN from the session rather than validated —
 *   whatever the client sent is discarded (fix F1 in the prompt).
 * - `read` filters return a Drizzle `SQL` fragment or `null` (public).
 * - `create`/`update`/`delete` return {ok: true} or {ok: false, code}.
 */
import { and, eq, or, sql, type SQL } from "drizzle-orm";
import * as schema from "./schema";
import type { SessionUser } from "./auth";

export type EntityName =
  | "Herb"
  | "Remedy"
  | "Product"
  | "Event"
  | "Comment"
  | "RemedySubmission"
  | "HerbSubmission"
  | "SellerProfile"
  | "Wishlist"
  | "User";

type Table =
  | typeof schema.herbs
  | typeof schema.remedies
  | typeof schema.products
  | typeof schema.events
  | typeof schema.comments
  | typeof schema.remedySubmissions
  | typeof schema.herbSubmissions
  | typeof schema.sellerProfiles
  | typeof schema.wishlists
  | typeof schema.users;

type PolicyDecision = { ok: true } | { ok: false; code: string; message: string };

type CreateInput = Record<string, unknown>;
type UpdateInput = Record<string, unknown>;
type ExistingRow = Record<string, unknown> & {
  id: string;
  created_by?: string | null;
};

export type Policy = {
  table: Table;
  /** Fields the client may set on create/update. */
  writable_fields: readonly string[];
  /** Fields the client may filter on via ?field=value. */
  filterable_fields: readonly string[];
  /** Fields the client may sort by. */
  sortable_fields: readonly string[];
  /**
   * If present, added to every list/get query. Returns null → no filter
   * (public read). Return an SQL fragment → applied with AND.
   */
  readFilter?(user: SessionUser | null): SQL | null;
  canCreate(user: SessionUser | null): PolicyDecision;
  canUpdate(user: SessionUser | null, row: ExistingRow): PolicyDecision;
  canDelete(user: SessionUser | null, row: ExistingRow): PolicyDecision;
  /**
   * Apply server-owned overrides to a create payload. Called AFTER
   * writable_fields filtering, so it can also inject values the caller
   * couldn't have set.
   */
  onCreate?(user: SessionUser, input: CreateInput): CreateInput;
  onUpdate?(user: SessionUser, patch: UpdateInput, row: ExistingRow): UpdateInput;
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const denySignedInRequired: PolicyDecision = {
  ok: false,
  code: "unauthorized",
  message: "Sign-in required",
};
const denyAdminOnly: PolicyDecision = {
  ok: false,
  code: "forbidden",
  message: "Admin only",
};
const denyNotOwner: PolicyDecision = {
  ok: false,
  code: "forbidden",
  message: "You do not own this record",
};
const allow: PolicyDecision = { ok: true };

const isAdmin = (u: SessionUser | null) => u?.role === "admin";
const ownedBy = (u: SessionUser | null, row: ExistingRow) =>
  !!u && !!row.created_by && row.created_by.toLowerCase() === u.email;

// ---------------------------------------------------------------------------
// Herb — public read, admin-only writes.
// ---------------------------------------------------------------------------

const herbPolicy: Policy = {
  table: schema.herbs,
  writable_fields: [
    "common_name",
    "botanical_name",
    "local_names",
    "description",
    "image_url",
    "region",
    "category",
    "health_benefits",
    "conditions_treated",
    "preparation_methods",
    "dosage",
    "drug_interactions",
    "contraindications",
    "side_effects",
    "major_compounds",
    "research_references",
    "safety_rating",
    "featured",
    "submitted_by",
    "community_contributed",
  ],
  filterable_fields: [
    "id",
    "category",
    "region",
    "featured",
    "safety_rating",
    "community_contributed",
  ],
  sortable_fields: ["created_date", "updated_date", "common_name", "featured"],
  canCreate: (u) => (isAdmin(u) ? allow : denyAdminOnly),
  canUpdate: (u) => (isAdmin(u) ? allow : denyAdminOnly),
  canDelete: (u) => (isAdmin(u) ? allow : denyAdminOnly),
};

// ---------------------------------------------------------------------------
// Remedy — public read, admin-only writes. `approved_by_ai` is server-set
// by the submission pipeline; never accepted from the client here.
// ---------------------------------------------------------------------------

const remedyPolicy: Policy = {
  table: schema.remedies,
  writable_fields: [
    "name",
    "description",
    "primary_herb_id",
    "primary_herb_name",
    "herbs_used",
    "health_condition",
    "conditions_treated",
    "preparation_method",
    "dosage",
    "duration_of_use",
    "observed_effects",
    "risk_warnings",
    "drug_interactions",
    "contraindications",
    "side_effects",
    "safety_rating",
    "category",
    "region",
    "research_references",
    "image_url",
    "submitted_by",
    "featured",
    // Admin can flip approval + featured — allowed because canCreate/Update
    // already restrict to admin.
    "approved_by_ai",
  ],
  filterable_fields: [
    "id",
    "category",
    "region",
    "featured",
    "approved_by_ai",
    "primary_herb_id",
    "safety_rating",
  ],
  sortable_fields: ["created_date", "updated_date", "name", "featured"],
  canCreate: (u) => (isAdmin(u) ? allow : denyAdminOnly),
  canUpdate: (u) => (isAdmin(u) ? allow : denyAdminOnly),
  canDelete: (u) => (isAdmin(u) ? allow : denyAdminOnly),
};

// ---------------------------------------------------------------------------
// Product — owned by seller (via seller_profile_id on the caller).
// ---------------------------------------------------------------------------

const productPolicy: Policy = {
  table: schema.products,
  writable_fields: [
    "product_name",
    "description",
    "seller_business_name",
    "price",
    "currency",
    "image_urls",
    "purchase_url",
    "linked_remedy_id",
    "linked_remedy_name",
    "linked_herbs",
    "product_type",
    "size",
    "availability",
    "featured",
    // moderation_status is admin-only; see onUpdate/onCreate for the guard.
  ],
  filterable_fields: [
    "id",
    "seller_id",
    "moderation_status",
    "featured",
    "product_type",
    "availability",
    "linked_remedy_id",
  ],
  sortable_fields: ["created_date", "updated_date", "price", "product_name"],
  canCreate: (u) => {
    if (!u) return denySignedInRequired;
    if (!u.seller_profile_id) {
      return { ok: false, code: "no_seller_profile", message: "Create a seller profile first" };
    }
    return allow;
  },
  canUpdate: (u, row) => {
    if (!u) return denySignedInRequired;
    if (isAdmin(u)) return allow;
    if (u.seller_profile_id && row.seller_id === u.seller_profile_id) return allow;
    return denyNotOwner;
  },
  canDelete: (u, row) => {
    if (!u) return denySignedInRequired;
    if (isAdmin(u)) return allow;
    if (u.seller_profile_id && row.seller_id === u.seller_profile_id) return allow;
    return denyNotOwner;
  },
  onCreate: (u, input) => ({
    ...input,
    // Force seller_id from the session — never trust the body (F2).
    seller_id: u.seller_profile_id,
    // Force initial moderation_status to Pending; admin flips it later.
    moderation_status: "Pending",
    // Featured never trusted from a seller.
    featured: false,
  }),
  onUpdate: (u, patch) => {
    const out = { ...patch };
    // A non-admin cannot flip these — silently strip.
    if (!isAdmin(u)) {
      delete out.moderation_status;
      delete out.featured;
      // Also strip seller_id — a seller cannot reassign a product.
      delete out.seller_id;
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// Event — anyone signed-in creates; owner or admin edits.
// ---------------------------------------------------------------------------

const eventPolicy: Policy = {
  table: schema.events,
  writable_fields: [
    "title",
    "description",
    "event_type",
    "date",
    "start_time",
    "end_time",
    "location_type",
    "location_address",
    "city",
    "country",
    "organizer_name",
    // organizer_email is optionally forced-from-session in onCreate; see
    // section 3.1 default of the migration prompt.
    "organizer_email",
    "organizer_phone",
    "image_url",
    "max_attendees",
    "registration_required",
    "registration_link",
    "is_free",
    "price",
    "currency",
    "topics_covered",
    "benefits",
    "target_audience",
    "status",
    // featured is admin-only; stripped in onUpdate for non-admins.
  ],
  filterable_fields: [
    "id",
    "event_type",
    "status",
    "location_type",
    "city",
    "country",
    "featured",
    "is_free",
    "date",
  ],
  sortable_fields: ["date", "created_date", "updated_date", "title"],
  canCreate: (u) => (u ? allow : denySignedInRequired),
  canUpdate: (u, row) => {
    if (!u) return denySignedInRequired;
    if (isAdmin(u) || ownedBy(u, row)) return allow;
    return denyNotOwner;
  },
  canDelete: (u, row) => {
    if (!u) return denySignedInRequired;
    if (isAdmin(u) || ownedBy(u, row)) return allow;
    return denyNotOwner;
  },
  onCreate: (_u, input) => ({
    // Event.status defaults to Upcoming; take whatever the form sent but
    // fall back to that if missing.
    status: "Upcoming",
    ...input,
  }),
  onUpdate: (u, patch) => {
    const out = { ...patch };
    if (!isAdmin(u)) {
      delete out.featured;
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// Comment — F1 fix: author_email/author_name are ALWAYS taken from session.
// ---------------------------------------------------------------------------

const commentPolicy: Policy = {
  table: schema.comments,
  writable_fields: [
    "content",
    "entity_type",
    "entity_id",
    "entity_name",
    "parent_comment_id",
  ],
  filterable_fields: [
    "id",
    "entity_type",
    "entity_id",
    "author_email",
    "parent_comment_id",
  ],
  sortable_fields: ["created_date", "updated_date"],
  canCreate: (u) => (u ? allow : denySignedInRequired),
  canUpdate: (u, row) => {
    if (!u) return denySignedInRequired;
    if (isAdmin(u) || ownedBy(u, row)) return allow;
    return denyNotOwner;
  },
  canDelete: (u, row) => {
    if (!u) return denySignedInRequired;
    if (isAdmin(u) || ownedBy(u, row)) return allow;
    return denyNotOwner;
  },
  onCreate: (u, input) => ({
    ...input,
    // Force from session — F1 fix. Never trust the body.
    author_email: u.email,
    author_name: u.full_name ?? u.email,
    reply_count: 0,
  }),
  onUpdate: (_u, patch) => {
    const out = { ...patch };
    // Even the owner cannot change who they are.
    delete out.author_email;
    delete out.author_name;
    delete out.entity_type;
    delete out.entity_id;
    return out;
  },
};

// ---------------------------------------------------------------------------
// RemedySubmission — own or admin; moderation fields are server-owned.
// ---------------------------------------------------------------------------

const remedySubmissionPolicy: Policy = {
  table: schema.remedySubmissions,
  writable_fields: [
    "herbs_used",
    "health_condition",
    "preparation_method",
    "dosage",
    "duration_of_use",
    "observed_effects",
    "submitter_name",
    "submitter_contact",
  ],
  filterable_fields: [
    "id",
    "moderation_status",
    "risk_level",
    "expert_review_required",
    "ready_to_publish",
    "created_by",
  ],
  sortable_fields: ["created_date", "updated_date"],
  readFilter: (u) => {
    if (!u) return sql`false`;
    if (isAdmin(u)) return null;
    return eq(schema.remedySubmissions.created_by, u.email);
  },
  canCreate: (u) => (u ? allow : denySignedInRequired),
  canUpdate: (u, row) => {
    if (!u) return denySignedInRequired;
    if (isAdmin(u) || ownedBy(u, row)) return allow;
    return denyNotOwner;
  },
  canDelete: (u, row) => {
    if (!u) return denySignedInRequired;
    if (isAdmin(u) || ownedBy(u, row)) return allow;
    return denyNotOwner;
  },
  onCreate: (_u, input) => ({
    ...input,
    moderation_status: "Pending Review",
    ai_feedback: null,
    risk_level: null,
    expert_review_required: false,
    draft_payload: null,
    ready_to_publish: false,
    published_remedy_id: null,
    references_pending_review: true,
  }),
  onUpdate: (u, patch) => {
    const out = { ...patch };
    if (!isAdmin(u)) {
      delete out.moderation_status;
      delete out.ai_feedback;
      delete out.risk_level;
      delete out.draft_payload;
      delete out.ready_to_publish;
      delete out.published_remedy_id;
      delete out.references_pending_review;
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// HerbSubmission — same pattern as RemedySubmission.
// ---------------------------------------------------------------------------

const herbSubmissionPolicy: Policy = {
  table: schema.herbSubmissions,
  writable_fields: [
    "common_name",
    "botanical_name",
    "description",
    "region",
    "category",
    "submitter_name",
    "submitter_contact",
  ],
  filterable_fields: [
    "id",
    "moderation_status",
    "risk_level",
    "ready_to_publish",
    "created_by",
  ],
  sortable_fields: ["created_date", "updated_date"],
  readFilter: (u) => {
    if (!u) return sql`false`;
    if (isAdmin(u)) return null;
    return eq(schema.herbSubmissions.created_by, u.email);
  },
  canCreate: (u) => (u ? allow : denySignedInRequired),
  canUpdate: (u, row) => {
    if (!u) return denySignedInRequired;
    if (isAdmin(u) || ownedBy(u, row)) return allow;
    return denyNotOwner;
  },
  canDelete: (u, row) => {
    if (!u) return denySignedInRequired;
    if (isAdmin(u) || ownedBy(u, row)) return allow;
    return denyNotOwner;
  },
  onCreate: (_u, input) => ({
    ...input,
    moderation_status: "Pending Review",
    ai_feedback: null,
    risk_level: null,
    expert_review_required: false,
    draft_payload: null,
    ready_to_publish: false,
    published_herb_id: null,
    references_pending_review: true,
  }),
  onUpdate: (u, patch) => {
    const out = { ...patch };
    if (!isAdmin(u)) {
      delete out.moderation_status;
      delete out.ai_feedback;
      delete out.risk_level;
      delete out.draft_payload;
      delete out.ready_to_publish;
      delete out.published_herb_id;
      delete out.references_pending_review;
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// SellerProfile — public read; owner or admin edits.
// ---------------------------------------------------------------------------

const sellerProfilePolicy: Policy = {
  table: schema.sellerProfiles,
  writable_fields: [
    "business_name",
    "contact_email",
    "phone_number",
    "website_url",
    "description",
    "logo_url",
    "location",
    "certifications",
    "specialties",
    "years_in_practice",
    "terms_accepted",
    // moderation_status admin-only; stripped for non-admins in onUpdate.
  ],
  filterable_fields: [
    "id",
    "moderation_status",
    "created_by",
  ],
  sortable_fields: ["created_date", "updated_date", "business_name"],
  canCreate: (u) => (u ? allow : denySignedInRequired),
  canUpdate: (u, row) => {
    if (!u) return denySignedInRequired;
    if (isAdmin(u) || ownedBy(u, row)) return allow;
    return denyNotOwner;
  },
  canDelete: (u, row) => {
    if (!u) return denySignedInRequired;
    if (isAdmin(u) || ownedBy(u, row)) return allow;
    return denyNotOwner;
  },
  onCreate: (_u, input) => ({
    ...input,
    moderation_status: "Pending",
  }),
  onUpdate: (u, patch) => {
    const out = { ...patch };
    if (!isAdmin(u)) {
      delete out.moderation_status;
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// Wishlist — read/write own only; user_email forced from session.
// ---------------------------------------------------------------------------

const wishlistPolicy: Policy = {
  table: schema.wishlists,
  writable_fields: [
    "entity_type",
    "entity_id",
    "entity_name",
    "entity_image_url",
    "entity_metadata",
  ],
  filterable_fields: [
    "id",
    "entity_type",
    "entity_id",
    "user_email", // client-supplied value is ignored; readFilter forces own only
  ],
  sortable_fields: ["created_date", "updated_date"],
  readFilter: (u) => {
    if (!u) return sql`false`;
    return eq(schema.wishlists.user_email, u.email);
  },
  canCreate: (u) => (u ? allow : denySignedInRequired),
  canUpdate: (u, row) => {
    if (!u) return denySignedInRequired;
    return ownedBy(u, row) || row.user_email === u.email
      ? allow
      : denyNotOwner;
  },
  canDelete: (u, row) => {
    if (!u) return denySignedInRequired;
    return ownedBy(u, row) || row.user_email === u.email
      ? allow
      : denyNotOwner;
  },
  onCreate: (u, input) => ({
    ...input,
    user_email: u.email,
  }),
  onUpdate: (_u, patch) => {
    const out = { ...patch };
    delete out.user_email;
    return out;
  },
};

// ---------------------------------------------------------------------------
// User — admin listing only. Self is /api/auth/me. This entity is here so
// AdminDashboard can list users; canCreate is always denied because Clerk
// owns user creation.
// ---------------------------------------------------------------------------

const userPolicy: Policy = {
  table: schema.users,
  writable_fields: ["role", "is_seller", "full_name"],
  filterable_fields: ["id", "email", "role", "is_seller"],
  sortable_fields: ["created_date", "updated_date", "email"],
  readFilter: (u) => (isAdmin(u) ? null : sql`false`),
  canCreate: () => ({ ok: false, code: "forbidden", message: "Users are created via Clerk" }),
  canUpdate: (u) => (isAdmin(u) ? allow : denyAdminOnly),
  canDelete: () => ({ ok: false, code: "forbidden", message: "Delete users via Clerk" }),
};

// ---------------------------------------------------------------------------

export const policies: Record<EntityName, Policy> = {
  Herb: herbPolicy,
  Remedy: remedyPolicy,
  Product: productPolicy,
  Event: eventPolicy,
  Comment: commentPolicy,
  RemedySubmission: remedySubmissionPolicy,
  HerbSubmission: herbSubmissionPolicy,
  SellerProfile: sellerProfilePolicy,
  Wishlist: wishlistPolicy,
  User: userPolicy,
};

/**
 * Filter a create/update payload to only the writable fields on this entity.
 * Uses a fresh object — safe to caller.
 */
export function pickWritable(policy: Policy, input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const allowed = new Set<string>(policy.writable_fields);
  for (const [k, v] of Object.entries(input)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

/**
 * Combine a policy's readFilter with an additional caller-supplied SQL
 * fragment (from ?field=value). Returns undefined when both are null.
 */
export function combineFilters(
  ...parts: (SQL | null | undefined)[]
): SQL | undefined {
  const real = parts.filter((p): p is SQL => !!p);
  if (real.length === 0) return undefined;
  if (real.length === 1) return real[0];
  return and(...real);
}

// re-export for callers that build filters inline
export { or, eq };
