-- CreateTable
CREATE TABLE "agent_payment_requests" (
    "id" SERIAL NOT NULL,
    "requester_id" INTEGER NOT NULL,
    "master_id" INTEGER NOT NULL,
    "player_id" INTEGER NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "amount_mmk" DECIMAL(18,2) NOT NULL,
    "amount_usd" DECIMAL(18,4) NOT NULL,
    "rate_used" DECIMAL(18,4) NOT NULL,
    "method" VARCHAR(50),
    "reference" VARCHAR(100),
    "requester_note" VARCHAR(255),
    "reviewer_note" VARCHAR(255),
    "reviewed_by_id" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "ledger_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_payment_requests_master_id_status_created_at_idx" ON "agent_payment_requests"("master_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "agent_payment_requests_requester_id_status_created_at_idx" ON "agent_payment_requests"("requester_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "agent_payment_requests_player_id_created_at_idx" ON "agent_payment_requests"("player_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "agent_payment_requests_status_created_at_idx" ON "agent_payment_requests"("status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "agent_payment_requests" ADD CONSTRAINT "agent_payment_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_payment_requests" ADD CONSTRAINT "agent_payment_requests_master_id_fkey" FOREIGN KEY ("master_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_payment_requests" ADD CONSTRAINT "agent_payment_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_payment_requests" ADD CONSTRAINT "agent_payment_requests_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
