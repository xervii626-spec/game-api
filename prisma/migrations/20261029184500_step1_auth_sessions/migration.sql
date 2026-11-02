-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "jti" VARCHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_jti_key" ON "auth_sessions"("jti");

-- CreateIndex
CREATE INDEX "auth_sessions_player_id_idx" ON "auth_sessions"("player_id");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
