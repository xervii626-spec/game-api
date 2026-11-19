CREATE TABLE IF NOT EXISTS "big_win_events" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "agent_id" INTEGER,
    "game_id" INTEGER,
    "amount_usd" DECIMAL(18,4) NOT NULL,
    "amount_mmk" DECIMAL(18,2) NOT NULL,
    "rate_used" DECIMAL(18,4) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "nickname" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "big_win_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "big_win_events_created_at_idx"
  ON "big_win_events"("created_at" DESC);

CREATE INDEX IF NOT EXISTS "big_win_events_agent_id_created_at_idx"
  ON "big_win_events"("agent_id", "created_at" DESC);

DO $$ BEGIN
  ALTER TABLE "big_win_events"
    ADD CONSTRAINT "big_win_events_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "players"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
