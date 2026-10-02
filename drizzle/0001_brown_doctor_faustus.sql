ALTER TABLE "herbs" ADD COLUMN "agent_generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "remedies" ADD COLUMN "agent_generated" boolean DEFAULT false NOT NULL;