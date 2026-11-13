-- AlterTable
ALTER TABLE "auth_sessions" ADD COLUMN "refresh_token_hash" VARCHAR(128),
ADD COLUMN "refresh_expires_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "admin_auth_sessions" ADD COLUMN "refresh_token_hash" VARCHAR(128),
ADD COLUMN "refresh_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "auth_sessions_refresh_token_hash_idx" ON "auth_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "admin_auth_sessions_refresh_token_hash_idx" ON "admin_auth_sessions"("refresh_token_hash");
