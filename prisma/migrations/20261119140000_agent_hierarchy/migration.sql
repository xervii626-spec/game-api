-- AlterTable AdminUser: agent hierarchy
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "parent_id" INTEGER;

-- AlterTable Player: owning agent
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "agent_id" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_users_parent_id_idx" ON "admin_users"("parent_id");
CREATE INDEX IF NOT EXISTS "players_agent_id_idx" ON "players"("agent_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "admin_users"
    ADD CONSTRAINT "admin_users_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "admin_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "players"
    ADD CONSTRAINT "players_agent_id_fkey"
    FOREIGN KEY ("agent_id") REFERENCES "admin_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
