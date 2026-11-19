-- CreateTable
CREATE TABLE IF NOT EXISTS "quests" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(255),
    "goal_type" VARCHAR(30) NOT NULL,
    "target_value" DECIMAL(18,4) NOT NULL,
    "reward_usd" DECIMAL(18,4) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "quest_progress" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "quest_id" INTEGER NOT NULL,
    "progress_value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "claimed_at" TIMESTAMP(3),
    "ledger_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quest_progress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quests_is_active_created_at_idx"
  ON "quests"("is_active", "created_at" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "quest_progress_player_id_quest_id_key"
  ON "quest_progress"("player_id", "quest_id");

CREATE INDEX IF NOT EXISTS "quest_progress_player_id_status_idx"
  ON "quest_progress"("player_id", "status");

CREATE INDEX IF NOT EXISTS "quest_progress_quest_id_idx"
  ON "quest_progress"("quest_id");

DO $$ BEGIN
  ALTER TABLE "quest_progress"
    ADD CONSTRAINT "quest_progress_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "players"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "quest_progress"
    ADD CONSTRAINT "quest_progress_quest_id_fkey"
    FOREIGN KEY ("quest_id") REFERENCES "quests"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
