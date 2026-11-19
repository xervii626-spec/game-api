-- CreateTable
CREATE TABLE IF NOT EXISTS "bonus_claims" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "claim_date" CHAR(10) NOT NULL,
    "amount_usd" DECIMAL(18,4) NOT NULL,
    "ledger_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonus_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "bonus_claims_player_id_kind_claim_date_key"
  ON "bonus_claims"("player_id", "kind", "claim_date");

CREATE INDEX IF NOT EXISTS "bonus_claims_player_id_kind_created_at_idx"
  ON "bonus_claims"("player_id", "kind", "created_at" DESC);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "bonus_claims"
    ADD CONSTRAINT "bonus_claims_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "players"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
