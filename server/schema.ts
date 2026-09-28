import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// -----------------------------------------------------------------------------
// Enums — mirror the Base44 .jsonc enums exactly
// -----------------------------------------------------------------------------

export const regionEnum = pgEnum("region", [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Australia",
  "Middle East",
  "Global",
]);

export const categoryEnum = pgEnum("category", [
  "Adaptogen",
  "Anti-inflammatory",
  "Digestive",
  "Immune Support",
  "Cardiovascular",
  "Respiratory",
  "Nervous System",
  "Antimicrobial",
  "Pain Relief",
  "Skin Health",
  "Other",
]);

export const safetyRatingEnum = pgEnum("safety_rating", [
  "Generally Safe",
  "Use with Caution",
  "High Risk - Expert Guidance Required",
]);

export const productTypeEnum = pgEnum("product_type", [
  "Tincture",
  "Tea Blend",
  "Salve",
  "Capsules",
  "Extract",
  "Powder",
  "Oil",
  "Cream",
  "Other",
]);

export const productModerationEnum = pgEnum("product_moderation", [
  "Pending",
  "Approved",
  "Rejected",
]);

export const sellerModerationEnum = pgEnum("seller_moderation", [
  "Pending",
  "Approved",
  "Rejected",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "Workshop",
  "Webinar",
  "Conference",
  "Community Gathering",
  "Plant Walk",
  "Wellness Fair",
  "Education Session",
  "Other",
]);

export const eventLocationTypeEnum = pgEnum("event_location_type", [
  "In-Person",
  "Virtual",
  "Hybrid",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "Upcoming",
  "Ongoing",
  "Completed",
  "Cancelled",
]);

export const commentEntityTypeEnum = pgEnum("comment_entity_type", [
  "Herb",
  "Remedy",
  "Product",
  "Event",
]);

export const wishlistEntityTypeEnum = pgEnum("wishlist_entity_type", [
  "Herb",
  "Remedy",
  "Product",
  "Event",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "Pending Review",
  "Approved",
  "Flagged - Risk Identified",
  "Rejected",
]);

export const riskLevelEnum = pgEnum("risk_level", [
  "Low",
  "Moderate",
  "High",
  "Critical",
]);

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

// -----------------------------------------------------------------------------
// Shared columns (id, timestamps, created_by) — Base44-compatible shape so the
// UI keeps working without changes.
// -----------------------------------------------------------------------------

const id = () =>
  uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdDate = () =>
  timestamp("created_date", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow();
const updatedDate = () =>
  timestamp("updated_date", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow();
const createdBy = () => text("created_by"); // author email; nullable for imported rows
const legacyId = () => text("legacy_id"); // unique constraint added per-table for idempotent import

// -----------------------------------------------------------------------------
// Users — Clerk-backed. Roles never trusted from the client.
// -----------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: id(),
    clerk_user_id: text("clerk_user_id"),
    email: text("email").notNull(),
    full_name: text("full_name"),
    role: userRoleEnum("role").notNull().default("user"),
    is_seller: boolean("is_seller").notNull().default(false),
    seller_profile_id: uuid("seller_profile_id"),
    legacy_id: legacyId(),
    created_date: createdDate(),
    updated_date: updatedDate(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_lower_unique").on(sql`lower(${t.email})`),
    clerkIdx: uniqueIndex("users_clerk_user_id_unique")
      .on(t.clerk_user_id)
      .where(sql`${t.clerk_user_id} IS NOT NULL`),
    legacyIdx: uniqueIndex("users_legacy_id_unique")
      .on(t.legacy_id)
      .where(sql`${t.legacy_id} IS NOT NULL`),
  }),
);

// -----------------------------------------------------------------------------
// Herb
// -----------------------------------------------------------------------------

export const herbs = pgTable(
  "herbs",
  {
    id: id(),
    common_name: text("common_name").notNull(),
    botanical_name: text("botanical_name").notNull(),
    local_names: text("local_names").array().notNull().default(sql`ARRAY[]::text[]`),
    description: text("description").notNull(),
    image_url: text("image_url"),
    region: regionEnum("region").notNull(),
    category: categoryEnum("category").notNull(),
    health_benefits: jsonb("health_benefits").notNull().default(sql`'[]'::jsonb`),
    conditions_treated: text("conditions_treated").array().notNull().default(sql`ARRAY[]::text[]`),
    preparation_methods: jsonb("preparation_methods").notNull().default(sql`'[]'::jsonb`),
    dosage: text("dosage"),
    drug_interactions: text("drug_interactions").array().notNull().default(sql`ARRAY[]::text[]`),
    contraindications: text("contraindications").array().notNull().default(sql`ARRAY[]::text[]`),
    side_effects: text("side_effects").array().notNull().default(sql`ARRAY[]::text[]`),
    major_compounds: text("major_compounds").array().notNull().default(sql`ARRAY[]::text[]`),
    research_references: jsonb("research_references").notNull().default(sql`'[]'::jsonb`),
    safety_rating: safetyRatingEnum("safety_rating"),
    featured: boolean("featured").notNull().default(false),
    submitted_by: text("submitted_by"),
    community_contributed: boolean("community_contributed").notNull().default(false),
    legacy_id: legacyId(),
    created_date: createdDate(),
    updated_date: updatedDate(),
    created_by: createdBy(),
  },
  (t) => ({
    categoryIdx: index("herbs_category_idx").on(t.category),
    regionIdx: index("herbs_region_idx").on(t.region),
    featuredIdx: index("herbs_featured_idx").on(t.featured),
    legacyIdx: uniqueIndex("herbs_legacy_id_unique")
      .on(t.legacy_id)
      .where(sql`${t.legacy_id} IS NOT NULL`),
  }),
);

// -----------------------------------------------------------------------------
// Remedy
// -----------------------------------------------------------------------------

export const remedies = pgTable(
  "remedies",
  {
    id: id(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    primary_herb_id: uuid("primary_herb_id"),
    primary_herb_name: text("primary_herb_name").notNull(),
    herbs_used: text("herbs_used").array().notNull().default(sql`ARRAY[]::text[]`),
    health_condition: text("health_condition").notNull(),
    conditions_treated: text("conditions_treated").array().notNull().default(sql`ARRAY[]::text[]`),
    preparation_method: text("preparation_method").notNull(),
    dosage: text("dosage"),
    duration_of_use: text("duration_of_use"),
    observed_effects: text("observed_effects"),
    risk_warnings: text("risk_warnings").array().notNull().default(sql`ARRAY[]::text[]`),
    drug_interactions: text("drug_interactions").array().notNull().default(sql`ARRAY[]::text[]`),
    contraindications: text("contraindications").array().notNull().default(sql`ARRAY[]::text[]`),
    side_effects: text("side_effects").array().notNull().default(sql`ARRAY[]::text[]`),
    safety_rating: safetyRatingEnum("safety_rating").default("Use with Caution"),
    category: categoryEnum("category"),
    region: regionEnum("region"),
    research_references: jsonb("research_references").notNull().default(sql`'[]'::jsonb`),
    image_url: text("image_url"),
    submitted_by: text("submitted_by"),
    approved_by_ai: boolean("approved_by_ai").notNull().default(false),
    featured: boolean("featured").notNull().default(false),
    legacy_id: legacyId(),
    created_date: createdDate(),
    updated_date: updatedDate(),
    created_by: createdBy(),
  },
  (t) => ({
    categoryIdx: index("remedies_category_idx").on(t.category),
    regionIdx: index("remedies_region_idx").on(t.region),
    primaryHerbIdx: index("remedies_primary_herb_idx").on(t.primary_herb_id),
    approvedIdx: index("remedies_approved_idx").on(t.approved_by_ai),
    featuredIdx: index("remedies_featured_idx").on(t.featured),
    legacyIdx: uniqueIndex("remedies_legacy_id_unique")
      .on(t.legacy_id)
      .where(sql`${t.legacy_id} IS NOT NULL`),
  }),
);

// -----------------------------------------------------------------------------
// SellerProfile
// -----------------------------------------------------------------------------

export const sellerProfiles = pgTable(
  "seller_profiles",
  {
    id: id(),
    business_name: text("business_name").notNull(),
    contact_email: text("contact_email").notNull(),
    phone_number: text("phone_number"),
    website_url: text("website_url"),
    description: text("description").notNull(),
    logo_url: text("logo_url"),
    location: text("location"),
    certifications: text("certifications").array().notNull().default(sql`ARRAY[]::text[]`),
    specialties: text("specialties").array().notNull().default(sql`ARRAY[]::text[]`),
    years_in_practice: integer("years_in_practice"),
    terms_accepted: boolean("terms_accepted").notNull().default(false),
    moderation_status: sellerModerationEnum("moderation_status").notNull().default("Pending"),
    legacy_id: legacyId(),
    created_date: createdDate(),
    updated_date: updatedDate(),
    created_by: createdBy(),
  },
  (t) => ({
    createdByIdx: index("seller_profiles_created_by_idx").on(t.created_by),
    moderationIdx: index("seller_profiles_moderation_idx").on(t.moderation_status),
    legacyIdx: uniqueIndex("seller_profiles_legacy_id_unique")
      .on(t.legacy_id)
      .where(sql`${t.legacy_id} IS NOT NULL`),
  }),
);

// -----------------------------------------------------------------------------
// Product
// -----------------------------------------------------------------------------

export const products = pgTable(
  "products",
  {
    id: id(),
    product_name: text("product_name").notNull(),
    description: text("description").notNull(),
    seller_id: uuid("seller_id").notNull(),
    seller_business_name: text("seller_business_name"),
    price: doublePrecision("price").notNull(),
    currency: text("currency").notNull().default("USD"),
    image_urls: text("image_urls").array().notNull().default(sql`ARRAY[]::text[]`),
    purchase_url: text("purchase_url"),
    linked_remedy_id: uuid("linked_remedy_id"),
    linked_remedy_name: text("linked_remedy_name"),
    linked_herbs: text("linked_herbs").array().notNull().default(sql`ARRAY[]::text[]`),
    product_type: productTypeEnum("product_type").notNull(),
    size: text("size"),
    availability: boolean("availability").notNull().default(true),
    moderation_status: productModerationEnum("moderation_status").notNull().default("Pending"),
    featured: boolean("featured").notNull().default(false),
    legacy_id: legacyId(),
    created_date: createdDate(),
    updated_date: updatedDate(),
    created_by: createdBy(),
  },
  (t) => ({
    sellerIdx: index("products_seller_id_idx").on(t.seller_id),
    moderationIdx: index("products_moderation_idx").on(t.moderation_status),
    featuredIdx: index("products_featured_idx").on(t.featured),
    legacyIdx: uniqueIndex("products_legacy_id_unique")
      .on(t.legacy_id)
      .where(sql`${t.legacy_id} IS NOT NULL`),
  }),
);

// -----------------------------------------------------------------------------
// Event
// -----------------------------------------------------------------------------

export const events = pgTable(
  "events",
  {
    id: id(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    event_type: eventTypeEnum("event_type").notNull(),
    date: text("date").notNull(), // stored as YYYY-MM-DD to mirror Base44
    start_time: text("start_time").notNull(),
    end_time: text("end_time"),
    location_type: eventLocationTypeEnum("location_type").notNull(),
    location_address: text("location_address"),
    city: text("city"),
    country: text("country"),
    organizer_name: text("organizer_name").notNull(),
    organizer_email: text("organizer_email").notNull(),
    organizer_phone: text("organizer_phone"),
    image_url: text("image_url"),
    max_attendees: integer("max_attendees"),
    registration_required: boolean("registration_required").notNull().default(false),
    registration_link: text("registration_link"),
    is_free: boolean("is_free").notNull().default(true),
    price: doublePrecision("price"),
    currency: text("currency").default("USD"),
    topics_covered: text("topics_covered").array().notNull().default(sql`ARRAY[]::text[]`),
    benefits: text("benefits").array().notNull().default(sql`ARRAY[]::text[]`),
    target_audience: text("target_audience"),
    status: eventStatusEnum("status").notNull().default("Upcoming"),
    featured: boolean("featured").notNull().default(false),
    legacy_id: legacyId(),
    created_date: createdDate(),
    updated_date: updatedDate(),
    created_by: createdBy(),
  },
  (t) => ({
    statusDateIdx: index("events_status_date_idx").on(t.status, t.date),
    featuredIdx: index("events_featured_idx").on(t.featured),
    createdByIdx: index("events_created_by_idx").on(t.created_by),
    legacyIdx: uniqueIndex("events_legacy_id_unique")
      .on(t.legacy_id)
      .where(sql`${t.legacy_id} IS NOT NULL`),
  }),
);

// -----------------------------------------------------------------------------
// Comment (polymorphic against Herb/Remedy/Product/Event)
// -----------------------------------------------------------------------------

export const comments = pgTable(
  "comments",
  {
    id: id(),
    content: text("content").notNull(),
    author_email: text("author_email").notNull(),
    author_name: text("author_name").notNull(),
    entity_type: commentEntityTypeEnum("entity_type").notNull(),
    entity_id: uuid("entity_id").notNull(),
    entity_name: text("entity_name"),
    parent_comment_id: uuid("parent_comment_id"),
    reply_count: integer("reply_count").notNull().default(0),
    legacy_id: legacyId(),
    created_date: createdDate(),
    updated_date: updatedDate(),
    created_by: createdBy(),
  },
  (t) => ({
    targetIdx: index("comments_target_idx").on(
      t.entity_type,
      t.entity_id,
      t.created_date,
    ),
    parentIdx: index("comments_parent_idx").on(t.parent_comment_id),
    authorIdx: index("comments_author_idx").on(t.author_email),
    legacyIdx: uniqueIndex("comments_legacy_id_unique")
      .on(t.legacy_id)
      .where(sql`${t.legacy_id} IS NOT NULL`),
  }),
);

// -----------------------------------------------------------------------------
// Wishlist
// -----------------------------------------------------------------------------

export const wishlists = pgTable(
  "wishlists",
  {
    id: id(),
    user_email: text("user_email").notNull(),
    entity_type: wishlistEntityTypeEnum("entity_type").notNull(),
    entity_id: uuid("entity_id").notNull(),
    entity_name: text("entity_name").notNull(),
    entity_image_url: text("entity_image_url"),
    entity_metadata: jsonb("entity_metadata"),
    legacy_id: legacyId(),
    created_date: createdDate(),
    updated_date: updatedDate(),
    created_by: createdBy(),
  },
  (t) => ({
    uniqPerUser: uniqueIndex("wishlists_user_entity_unique").on(
      t.user_email,
      t.entity_type,
      t.entity_id,
    ),
    userIdx: index("wishlists_user_idx").on(t.user_email),
    legacyIdx: uniqueIndex("wishlists_legacy_id_unique")
      .on(t.legacy_id)
      .where(sql`${t.legacy_id} IS NOT NULL`),
  }),
);

// -----------------------------------------------------------------------------
// RemedySubmission — extended with draft/publish fields for the new pipeline
// (section 7 of the migration prompt).
// -----------------------------------------------------------------------------

export const remedySubmissions = pgTable(
  "remedy_submissions",
  {
    id: id(),
    herbs_used: text("herbs_used").array().notNull().default(sql`ARRAY[]::text[]`),
    health_condition: text("health_condition").notNull(),
    preparation_method: text("preparation_method").notNull(),
    dosage: text("dosage"),
    duration_of_use: text("duration_of_use"),
    observed_effects: text("observed_effects").notNull(),
    submitter_name: text("submitter_name"),
    submitter_contact: text("submitter_contact"),
    moderation_status: submissionStatusEnum("moderation_status")
      .notNull()
      .default("Pending Review"),
    ai_feedback: text("ai_feedback"),
    risk_level: riskLevelEnum("risk_level"),
    expert_review_required: boolean("expert_review_required")
      .notNull()
      .default(false),
    // New in the migration — see section 7.
    draft_payload: jsonb("draft_payload"),
    ready_to_publish: boolean("ready_to_publish").notNull().default(false),
    published_remedy_id: uuid("published_remedy_id"),
    references_pending_review: boolean("references_pending_review")
      .notNull()
      .default(true),
    legacy_id: legacyId(),
    created_date: createdDate(),
    updated_date: updatedDate(),
    created_by: createdBy(),
  },
  (t) => ({
    statusIdx: index("remedy_submissions_status_idx").on(t.moderation_status),
    createdByIdx: index("remedy_submissions_created_by_idx").on(t.created_by),
    readyIdx: index("remedy_submissions_ready_idx").on(t.ready_to_publish),
    legacyIdx: uniqueIndex("remedy_submissions_legacy_id_unique")
      .on(t.legacy_id)
      .where(sql`${t.legacy_id} IS NOT NULL`),
  }),
);

// -----------------------------------------------------------------------------
// HerbSubmission — new table parallel to RemedySubmission. The current app
// runs its herb-submission form through InvokeLLM the same way, so we mirror
// the pipeline on our side even though Base44 had no HerbSubmission entity.
// -----------------------------------------------------------------------------

export const herbSubmissions = pgTable(
  "herb_submissions",
  {
    id: id(),
    common_name: text("common_name").notNull(),
    botanical_name: text("botanical_name"),
    description: text("description").notNull(),
    region: regionEnum("region"),
    category: categoryEnum("category"),
    submitter_name: text("submitter_name"),
    submitter_contact: text("submitter_contact"),
    moderation_status: submissionStatusEnum("moderation_status")
      .notNull()
      .default("Pending Review"),
    ai_feedback: text("ai_feedback"),
    risk_level: riskLevelEnum("risk_level"),
    expert_review_required: boolean("expert_review_required")
      .notNull()
      .default(false),
    draft_payload: jsonb("draft_payload"),
    ready_to_publish: boolean("ready_to_publish").notNull().default(false),
    published_herb_id: uuid("published_herb_id"),
    references_pending_review: boolean("references_pending_review")
      .notNull()
      .default(true),
    legacy_id: legacyId(),
    created_date: createdDate(),
    updated_date: updatedDate(),
    created_by: createdBy(),
  },
  (t) => ({
    statusIdx: index("herb_submissions_status_idx").on(t.moderation_status),
    createdByIdx: index("herb_submissions_created_by_idx").on(t.created_by),
    readyIdx: index("herb_submissions_ready_idx").on(t.ready_to_publish),
    legacyIdx: uniqueIndex("herb_submissions_legacy_id_unique")
      .on(t.legacy_id)
      .where(sql`${t.legacy_id} IS NOT NULL`),
  }),
);

// -----------------------------------------------------------------------------
// Infrastructure — usage ledger, cache, rate limits, moderation audit trail
// -----------------------------------------------------------------------------

export const llmUsage = pgTable(
  "llm_usage",
  {
    id: id(),
    endpoint: text("endpoint").notNull(),
    model: text("model").notNull(),
    // bucket_start truncated to the minute for RPM/TPM, to the day for TPD
    bucket_minute: timestamp("bucket_minute", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    bucket_day: timestamp("bucket_day", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    input_tokens: integer("input_tokens").notNull().default(0),
    output_tokens: integer("output_tokens").notNull().default(0),
    requests: integer("requests").notNull().default(0),
    created_date: createdDate(),
  },
  (t) => ({
    bucketIdx: index("llm_usage_bucket_idx").on(t.bucket_minute, t.bucket_day),
  }),
);

export const searchUsage = pgTable(
  "search_usage",
  {
    id: id(),
    provider: text("provider").notNull(),
    bucket_day: timestamp("bucket_day", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    requests: integer("requests").notNull().default(0),
    created_date: createdDate(),
  },
  (t) => ({
    dayIdx: index("search_usage_day_idx").on(t.bucket_day, t.provider),
  }),
);

export const aiResponseCache = pgTable(
  "ai_response_cache",
  {
    id: id(),
    endpoint: text("endpoint").notNull(),
    input_hash: text("input_hash").notNull(),
    response: jsonb("response").notNull(),
    expires_at: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    created_date: createdDate(),
  },
  (t) => ({
    lookup: uniqueIndex("ai_response_cache_lookup").on(
      t.endpoint,
      t.input_hash,
    ),
    expiresIdx: index("ai_response_cache_expires_idx").on(t.expires_at),
  }),
);

export const searchResponseCache = pgTable(
  "search_response_cache",
  {
    id: id(),
    query_hash: text("query_hash").notNull(),
    provider: text("provider").notNull(),
    results: jsonb("results").notNull(),
    expires_at: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    created_date: createdDate(),
  },
  (t) => ({
    lookup: uniqueIndex("search_response_cache_lookup").on(t.query_hash),
    expiresIdx: index("search_response_cache_expires_idx").on(t.expires_at),
  }),
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    id: id(),
    key: text("key").notNull(), // e.g. "ai-assistant:user:<user_id>"
    bucket_start: timestamp("bucket_start", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => ({
    lookup: uniqueIndex("rate_limits_lookup").on(t.key, t.bucket_start),
  }),
);

export const moderationEvents = pgTable(
  "moderation_events",
  {
    id: id(),
    endpoint: text("endpoint").notNull(),
    user_email: text("user_email"),
    submission_id: uuid("submission_id"),
    input_hash: text("input_hash"),
    verdict: text("verdict"),
    model: text("model"),
    provider: text("provider"),
    search_provider: text("search_provider"),
    input_tokens: integer("input_tokens"),
    output_tokens: integer("output_tokens"),
    error_code: text("error_code"),
    // Small structured summary — do NOT store full free-text health input here.
    summary: jsonb("summary"),
    created_date: createdDate(),
  },
  (t) => ({
    endpointIdx: index("moderation_events_endpoint_idx").on(t.endpoint),
    submissionIdx: index("moderation_events_submission_idx").on(t.submission_id),
    userIdx: index("moderation_events_user_idx").on(t.user_email),
  }),
);
