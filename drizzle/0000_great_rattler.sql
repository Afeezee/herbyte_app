CREATE TYPE "public"."category" AS ENUM('Adaptogen', 'Anti-inflammatory', 'Digestive', 'Immune Support', 'Cardiovascular', 'Respiratory', 'Nervous System', 'Antimicrobial', 'Pain Relief', 'Skin Health', 'Other');--> statement-breakpoint
CREATE TYPE "public"."comment_entity_type" AS ENUM('Herb', 'Remedy', 'Product', 'Event');--> statement-breakpoint
CREATE TYPE "public"."event_location_type" AS ENUM('In-Person', 'Virtual', 'Hybrid');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('Upcoming', 'Ongoing', 'Completed', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('Workshop', 'Webinar', 'Conference', 'Community Gathering', 'Plant Walk', 'Wellness Fair', 'Education Session', 'Other');--> statement-breakpoint
CREATE TYPE "public"."product_moderation" AS ENUM('Pending', 'Approved', 'Rejected');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('Tincture', 'Tea Blend', 'Salve', 'Capsules', 'Extract', 'Powder', 'Oil', 'Cream', 'Other');--> statement-breakpoint
CREATE TYPE "public"."region" AS ENUM('Africa', 'Asia', 'Europe', 'North America', 'South America', 'Australia', 'Middle East', 'Global');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('Low', 'Moderate', 'High', 'Critical');--> statement-breakpoint
CREATE TYPE "public"."safety_rating" AS ENUM('Generally Safe', 'Use with Caution', 'High Risk - Expert Guidance Required');--> statement-breakpoint
CREATE TYPE "public"."seller_moderation" AS ENUM('Pending', 'Approved', 'Rejected');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('Pending Review', 'Approved', 'Flagged - Risk Identified', 'Rejected');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."wishlist_entity_type" AS ENUM('Herb', 'Remedy', 'Product', 'Event');--> statement-breakpoint
CREATE TABLE "ai_response_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint" text NOT NULL,
	"input_hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"author_email" text NOT NULL,
	"author_name" text NOT NULL,
	"entity_type" "comment_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_name" text,
	"parent_comment_id" uuid,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"legacy_id" text,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"event_type" "event_type" NOT NULL,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text,
	"location_type" "event_location_type" NOT NULL,
	"location_address" text,
	"city" text,
	"country" text,
	"organizer_name" text NOT NULL,
	"organizer_email" text NOT NULL,
	"organizer_phone" text,
	"image_url" text,
	"max_attendees" integer,
	"registration_required" boolean DEFAULT false NOT NULL,
	"registration_link" text,
	"is_free" boolean DEFAULT true NOT NULL,
	"price" double precision,
	"currency" text DEFAULT 'USD',
	"topics_covered" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"benefits" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"target_audience" text,
	"status" "event_status" DEFAULT 'Upcoming' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"legacy_id" text,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "herb_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"common_name" text NOT NULL,
	"botanical_name" text,
	"description" text NOT NULL,
	"region" "region",
	"category" "category",
	"submitter_name" text,
	"submitter_contact" text,
	"moderation_status" "submission_status" DEFAULT 'Pending Review' NOT NULL,
	"ai_feedback" text,
	"risk_level" "risk_level",
	"expert_review_required" boolean DEFAULT false NOT NULL,
	"draft_payload" jsonb,
	"ready_to_publish" boolean DEFAULT false NOT NULL,
	"published_herb_id" uuid,
	"references_pending_review" boolean DEFAULT true NOT NULL,
	"legacy_id" text,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "herbs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"common_name" text NOT NULL,
	"botanical_name" text NOT NULL,
	"local_names" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"description" text NOT NULL,
	"image_url" text,
	"region" "region" NOT NULL,
	"category" "category" NOT NULL,
	"health_benefits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conditions_treated" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"preparation_methods" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dosage" text,
	"drug_interactions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"contraindications" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"side_effects" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"major_compounds" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"research_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"safety_rating" "safety_rating",
	"featured" boolean DEFAULT false NOT NULL,
	"submitted_by" text,
	"community_contributed" boolean DEFAULT false NOT NULL,
	"legacy_id" text,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "llm_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint" text NOT NULL,
	"model" text NOT NULL,
	"bucket_minute" timestamp with time zone NOT NULL,
	"bucket_day" timestamp with time zone NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint" text NOT NULL,
	"user_email" text,
	"submission_id" uuid,
	"input_hash" text,
	"verdict" text,
	"model" text,
	"provider" text,
	"search_provider" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"error_code" text,
	"summary" jsonb,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_name" text NOT NULL,
	"description" text NOT NULL,
	"seller_id" uuid NOT NULL,
	"seller_business_name" text,
	"price" double precision NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"image_urls" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"purchase_url" text,
	"linked_remedy_id" uuid,
	"linked_remedy_name" text,
	"linked_herbs" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"product_type" "product_type" NOT NULL,
	"size" text,
	"availability" boolean DEFAULT true NOT NULL,
	"moderation_status" "product_moderation" DEFAULT 'Pending' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"legacy_id" text,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remedies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"primary_herb_id" uuid,
	"primary_herb_name" text NOT NULL,
	"herbs_used" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"health_condition" text NOT NULL,
	"conditions_treated" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"preparation_method" text NOT NULL,
	"dosage" text,
	"duration_of_use" text,
	"observed_effects" text,
	"risk_warnings" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"drug_interactions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"contraindications" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"side_effects" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"safety_rating" "safety_rating" DEFAULT 'Use with Caution',
	"category" "category",
	"region" "region",
	"research_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_url" text,
	"submitted_by" text,
	"approved_by_ai" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"legacy_id" text,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "remedy_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"herbs_used" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"health_condition" text NOT NULL,
	"preparation_method" text NOT NULL,
	"dosage" text,
	"duration_of_use" text,
	"observed_effects" text NOT NULL,
	"submitter_name" text,
	"submitter_contact" text,
	"moderation_status" "submission_status" DEFAULT 'Pending Review' NOT NULL,
	"ai_feedback" text,
	"risk_level" "risk_level",
	"expert_review_required" boolean DEFAULT false NOT NULL,
	"draft_payload" jsonb,
	"ready_to_publish" boolean DEFAULT false NOT NULL,
	"published_remedy_id" uuid,
	"references_pending_review" boolean DEFAULT true NOT NULL,
	"legacy_id" text,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "search_response_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_hash" text NOT NULL,
	"provider" text NOT NULL,
	"results" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"bucket_day" timestamp with time zone NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"phone_number" text,
	"website_url" text,
	"description" text NOT NULL,
	"logo_url" text,
	"location" text,
	"certifications" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"specialties" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"years_in_practice" integer,
	"terms_accepted" boolean DEFAULT false NOT NULL,
	"moderation_status" "seller_moderation" DEFAULT 'Pending' NOT NULL,
	"legacy_id" text,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text,
	"email" text NOT NULL,
	"full_name" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"is_seller" boolean DEFAULT false NOT NULL,
	"seller_profile_id" uuid,
	"legacy_id" text,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"entity_type" "wishlist_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_name" text NOT NULL,
	"entity_image_url" text,
	"entity_metadata" jsonb,
	"legacy_id" text,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_response_cache_lookup" ON "ai_response_cache" USING btree ("endpoint","input_hash");--> statement-breakpoint
CREATE INDEX "ai_response_cache_expires_idx" ON "ai_response_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "comments_target_idx" ON "comments" USING btree ("entity_type","entity_id","created_date");--> statement-breakpoint
CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "comments_author_idx" ON "comments" USING btree ("author_email");--> statement-breakpoint
CREATE UNIQUE INDEX "comments_legacy_id_unique" ON "comments" USING btree ("legacy_id") WHERE "comments"."legacy_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "events_status_date_idx" ON "events" USING btree ("status","date");--> statement-breakpoint
CREATE INDEX "events_featured_idx" ON "events" USING btree ("featured");--> statement-breakpoint
CREATE INDEX "events_created_by_idx" ON "events" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "events_legacy_id_unique" ON "events" USING btree ("legacy_id") WHERE "events"."legacy_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "herb_submissions_status_idx" ON "herb_submissions" USING btree ("moderation_status");--> statement-breakpoint
CREATE INDEX "herb_submissions_created_by_idx" ON "herb_submissions" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "herb_submissions_ready_idx" ON "herb_submissions" USING btree ("ready_to_publish");--> statement-breakpoint
CREATE UNIQUE INDEX "herb_submissions_legacy_id_unique" ON "herb_submissions" USING btree ("legacy_id") WHERE "herb_submissions"."legacy_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "herbs_category_idx" ON "herbs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "herbs_region_idx" ON "herbs" USING btree ("region");--> statement-breakpoint
CREATE INDEX "herbs_featured_idx" ON "herbs" USING btree ("featured");--> statement-breakpoint
CREATE UNIQUE INDEX "herbs_legacy_id_unique" ON "herbs" USING btree ("legacy_id") WHERE "herbs"."legacy_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "llm_usage_bucket_idx" ON "llm_usage" USING btree ("bucket_minute","bucket_day");--> statement-breakpoint
CREATE INDEX "moderation_events_endpoint_idx" ON "moderation_events" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "moderation_events_submission_idx" ON "moderation_events" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "moderation_events_user_idx" ON "moderation_events" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "products_seller_id_idx" ON "products" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "products_moderation_idx" ON "products" USING btree ("moderation_status");--> statement-breakpoint
CREATE INDEX "products_featured_idx" ON "products" USING btree ("featured");--> statement-breakpoint
CREATE UNIQUE INDEX "products_legacy_id_unique" ON "products" USING btree ("legacy_id") WHERE "products"."legacy_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limits_lookup" ON "rate_limits" USING btree ("key","bucket_start");--> statement-breakpoint
CREATE INDEX "remedies_category_idx" ON "remedies" USING btree ("category");--> statement-breakpoint
CREATE INDEX "remedies_region_idx" ON "remedies" USING btree ("region");--> statement-breakpoint
CREATE INDEX "remedies_primary_herb_idx" ON "remedies" USING btree ("primary_herb_id");--> statement-breakpoint
CREATE INDEX "remedies_approved_idx" ON "remedies" USING btree ("approved_by_ai");--> statement-breakpoint
CREATE INDEX "remedies_featured_idx" ON "remedies" USING btree ("featured");--> statement-breakpoint
CREATE UNIQUE INDEX "remedies_legacy_id_unique" ON "remedies" USING btree ("legacy_id") WHERE "remedies"."legacy_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "remedy_submissions_status_idx" ON "remedy_submissions" USING btree ("moderation_status");--> statement-breakpoint
CREATE INDEX "remedy_submissions_created_by_idx" ON "remedy_submissions" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "remedy_submissions_ready_idx" ON "remedy_submissions" USING btree ("ready_to_publish");--> statement-breakpoint
CREATE UNIQUE INDEX "remedy_submissions_legacy_id_unique" ON "remedy_submissions" USING btree ("legacy_id") WHERE "remedy_submissions"."legacy_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "search_response_cache_lookup" ON "search_response_cache" USING btree ("query_hash");--> statement-breakpoint
CREATE INDEX "search_response_cache_expires_idx" ON "search_response_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "search_usage_day_idx" ON "search_usage" USING btree ("bucket_day","provider");--> statement-breakpoint
CREATE INDEX "seller_profiles_created_by_idx" ON "seller_profiles" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "seller_profiles_moderation_idx" ON "seller_profiles" USING btree ("moderation_status");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_profiles_legacy_id_unique" ON "seller_profiles" USING btree ("legacy_id") WHERE "seller_profiles"."legacy_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_unique" ON "users" USING btree ("clerk_user_id") WHERE "users"."clerk_user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_legacy_id_unique" ON "users" USING btree ("legacy_id") WHERE "users"."legacy_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "wishlists_user_entity_unique" ON "wishlists" USING btree ("user_email","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "wishlists_user_idx" ON "wishlists" USING btree ("user_email");--> statement-breakpoint
CREATE UNIQUE INDEX "wishlists_legacy_id_unique" ON "wishlists" USING btree ("legacy_id") WHERE "wishlists"."legacy_id" IS NOT NULL;