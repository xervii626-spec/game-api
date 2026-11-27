CREATE TABLE IF NOT EXISTS "leaderboard_stats" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "agent_id" INTEGER,
    "period" VARCHAR(10) NOT NULL,
    "period_key" VARCHAR(16) NOT NULL,
    "total_win_usd" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_bet_usd" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "net_usd" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "biggest_win_usd" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "username" VARCHAR(50) NOT NULL,
    "nickname" VARCHAR(50) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_stats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leaderboard_stats_player_id_period_period_key_key"
  ON "leaderboard_stats"("player_id", "period", "period_key");

CREATE INDEX IF NOT EXISTS "leaderboard_stats_period_period_key_total_win_usd_idx"
  ON "leaderboard_stats"("period", "period_key", "total_win_usd" DESC);

CREATE INDEX IF NOT EXISTS "leaderboard_stats_period_period_key_total_bet_usd_idx"
  ON "leaderboard_stats"("period", "period_key", "total_bet_usd" DESC);

CREATE INDEX IF NOT EXISTS "leaderboard_stats_period_period_key_net_usd_idx"
  ON "leaderboard_stats"("period", "period_key", "net_usd" DESC);

CREATE INDEX IF NOT EXISTS "leaderboard_stats_period_period_key_biggest_win_usd_idx"
  ON "leaderboard_stats"("period", "period_key", "biggest_win_usd" DESC);

CREATE INDEX IF NOT EXISTS "leaderboard_stats_period_period_key_agent_id_total_win_usd_idx"
  ON "leaderboard_stats"("period", "period_key", "agent_id", "total_win_usd" DESC);

CREATE INDEX IF NOT EXISTS "leaderboard_stats_period_period_key_agent_id_total_bet_usd_idx"
  ON "leaderboard_stats"("period", "period_key", "agent_id", "total_bet_usd" DESC);

CREATE INDEX IF NOT EXISTS "leaderboard_stats_period_period_key_agent_id_net_usd_idx"
  ON "leaderboard_stats"("period", "period_key", "agent_id", "net_usd" DESC);

CREATE INDEX IF NOT EXISTS "leaderboard_stats_period_period_key_agent_id_biggest_win_usd_idx"
  ON "leaderboard_stats"("period", "period_key", "agent_id", "biggest_win_usd" DESC);

DO $$ BEGIN
  ALTER TABLE "leaderboard_stats"
    ADD CONSTRAINT "leaderboard_stats_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "players"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
