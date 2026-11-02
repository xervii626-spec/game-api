-- AlterTable players indexes
CREATE INDEX IF NOT EXISTS "players_is_blocked_idx" ON "players"("is_blocked");
CREATE INDEX IF NOT EXISTS "players_created_at_idx" ON "players"("created_at");
CREATE INDEX IF NOT EXISTS "players_username_idx" ON "players"("username");

-- AlterTable auth_sessions
CREATE INDEX IF NOT EXISTS "auth_sessions_player_id_is_active_idx" ON "auth_sessions"("player_id", "is_active");
CREATE INDEX IF NOT EXISTS "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- AlterTable wallets
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable sessions
CREATE INDEX IF NOT EXISTS "sessions_player_id_is_active_idx" ON "sessions"("player_id", "is_active");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions"("expires_at");

-- AlterTable transactions indexes
CREATE INDEX IF NOT EXISTS "transactions_player_id_created_at_idx" ON "transactions"("player_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "transactions_direction_created_at_idx" ON "transactions"("direction", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "transactions_status_idx" ON "transactions"("status");
CREATE INDEX IF NOT EXISTS "transactions_game_id_idx" ON "transactions"("game_id");
CREATE INDEX IF NOT EXISTS "transactions_rgs_related_transaction_id_idx" ON "transactions"("rgs_related_transaction_id");

-- CreateTable wallet_ledgers
CREATE TABLE IF NOT EXISTS "wallet_ledgers" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "admin_id" INTEGER,
    "type" VARCHAR(30) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "balance_after" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "note" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wallet_ledgers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "wallet_ledgers_player_id_created_at_idx" ON "wallet_ledgers"("player_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "wallet_ledgers_admin_id_created_at_idx" ON "wallet_ledgers"("admin_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "wallet_ledgers_type_created_at_idx" ON "wallet_ledgers"("type", "created_at" DESC);

-- CreateTable admin_users
CREATE TABLE IF NOT EXISTS "admin_users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'admin',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_username_key" ON "admin_users"("username");
CREATE INDEX IF NOT EXISTS "admin_users_role_is_active_idx" ON "admin_users"("role", "is_active");

-- CreateTable admin_auth_sessions
CREATE TABLE IF NOT EXISTS "admin_auth_sessions" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "jti" VARCHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_auth_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "admin_auth_sessions_jti_key" ON "admin_auth_sessions"("jti");
CREATE INDEX IF NOT EXISTS "admin_auth_sessions_admin_id_is_active_idx" ON "admin_auth_sessions"("admin_id", "is_active");
CREATE INDEX IF NOT EXISTS "admin_auth_sessions_expires_at_idx" ON "admin_auth_sessions"("expires_at");

-- CreateTable platform_settings
CREATE TABLE IF NOT EXISTS "platform_settings" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "platform_settings_key_key" ON "platform_settings"("key");

-- AlterTable audit_logs
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "admin_id" INTEGER;
CREATE INDEX IF NOT EXISTS "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_player_id_created_at_idx" ON "audit_logs"("player_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_admin_id_created_at_idx" ON "audit_logs"("admin_id", "created_at" DESC);

-- FKs
ALTER TABLE "wallet_ledgers" DROP CONSTRAINT IF EXISTS "wallet_ledgers_player_id_fkey";
ALTER TABLE "wallet_ledgers" ADD CONSTRAINT "wallet_ledgers_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallet_ledgers" DROP CONSTRAINT IF EXISTS "wallet_ledgers_admin_id_fkey";
ALTER TABLE "wallet_ledgers" ADD CONSTRAINT "wallet_ledgers_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admin_auth_sessions" DROP CONSTRAINT IF EXISTS "admin_auth_sessions_admin_id_fkey";
ALTER TABLE "admin_auth_sessions" ADD CONSTRAINT "admin_auth_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
