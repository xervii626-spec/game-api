-- CreateTable
CREATE TABLE "players" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "nickname" VARCHAR(50) NOT NULL,
    "password_hash" TEXT,
    "currency" CHAR(3) NOT NULL,
    "country" CHAR(2),
    "gender" BOOLEAN,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "real_balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "bonus_money" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "frozen_money" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "bonus_win" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "token" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "rgs_transaction_id" BIGINT NOT NULL,
    "rgs_related_transaction_id" BIGINT,
    "platform_transaction_id" BIGINT,
    "type_id" INTEGER NOT NULL,
    "direction" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "game_id" INTEGER,
    "bonus_def_id" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'completed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "player_id" INTEGER,
    "request" JSONB,
    "response" JSONB,
    "ip" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_username_key" ON "players"("username");

-- CreateIndex
CREATE UNIQUE INDEX "players_nickname_key" ON "players"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_player_id_key" ON "wallets"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_player_id_idx" ON "sessions"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_rgs_transaction_id_key" ON "transactions"("rgs_transaction_id");

-- CreateIndex
CREATE INDEX "transactions_player_id_idx" ON "transactions"("player_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_player_id_idx" ON "audit_logs"("player_id");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
