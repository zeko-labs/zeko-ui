CREATE TABLE "Actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid_v7() NOT NULL,
	"wallet" text NOT NULL,
	"actionType" text NOT NULL,
	"transactionHash" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Actions_transactionHash_unique" UNIQUE("transactionHash")
);
--> statement-breakpoint
CREATE TABLE "Leaderboard" (
	"wallet" text PRIMARY KEY NOT NULL,
	"score" smallint DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Manual_Adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid_v7() NOT NULL,
	"wallet" text NOT NULL,
	"pointsChange" smallint NOT NULL,
	"sidequest" text NOT NULL,
	"reason" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Zeko_Transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid_v7() NOT NULL,
	"transactionHash" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Zeko_Transactions_transactionHash_unique" UNIQUE("transactionHash")
);
--> statement-breakpoint
CREATE INDEX "wallet:action_type|index" ON "Actions" USING btree ("wallet","actionType");--> statement-breakpoint
CREATE INDEX "score_wallet|index" ON "Leaderboard" USING btree ("score","wallet");