-- CreateTable payment_requests
CREATE TABLE IF NOT EXISTS "payment_requests" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "amount_mmk" DECIMAL(18,2) NOT NULL,
    "amount_usd" DECIMAL(18,4) NOT NULL,
    "rate_used" DECIMAL(18,4) NOT NULL,
    "method" VARCHAR(50),
    "reference" VARCHAR(100),
    "player_note" VARCHAR(255),
    "admin_id" INTEGER,
    "admin_note" VARCHAR(255),
    "reviewed_at" TIMESTAMP(3),
    "ledger_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payment_requests_player_id_created_at_idx" ON "payment_requests"("player_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "payment_requests_status_created_at_idx" ON "payment_requests"("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "payment_requests_type_status_idx" ON "payment_requests"("type", "status");
CREATE INDEX IF NOT EXISTS "payment_requests_admin_id_reviewed_at_idx" ON "payment_requests"("admin_id", "reviewed_at" DESC);

ALTER TABLE "payment_requests" DROP CONSTRAINT IF EXISTS "payment_requests_player_id_fkey";
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_requests" DROP CONSTRAINT IF EXISTS "payment_requests_admin_id_fkey";
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Default FX rate (MMK per 1 USD) — upsert-safe
INSERT INTO "platform_settings" ("key", "value", "updated_at")
VALUES ('mmk_per_usd', '4500', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
