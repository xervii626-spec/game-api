CREATE TABLE IF NOT EXISTS "announcements" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "created_by_admin_id" INTEGER,
    "total_targets" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "cursor_player_id" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(255),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "announcements_status_created_at_idx"
  ON "announcements"("status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "announcements_created_at_idx"
  ON "announcements"("created_at" DESC);

CREATE TABLE IF NOT EXISTS "announcement_deliveries" (
    "id" SERIAL NOT NULL,
    "announcement_id" INTEGER NOT NULL,
    "player_id" INTEGER NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "announcement_deliveries_announcement_id_player_id_key"
  ON "announcement_deliveries"("announcement_id", "player_id");

CREATE INDEX IF NOT EXISTS "announcement_deliveries_player_id_created_at_idx"
  ON "announcement_deliveries"("player_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "announcement_deliveries_player_id_read_at_idx"
  ON "announcement_deliveries"("player_id", "read_at");

CREATE INDEX IF NOT EXISTS "announcement_deliveries_announcement_id_id_idx"
  ON "announcement_deliveries"("announcement_id", "id");

DO $$ BEGIN
  ALTER TABLE "announcement_deliveries"
    ADD CONSTRAINT "announcement_deliveries_announcement_id_fkey"
    FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "announcement_deliveries"
    ADD CONSTRAINT "announcement_deliveries_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "players"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
