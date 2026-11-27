CREATE TABLE IF NOT EXISTS "faqs" (
    "id" SERIAL NOT NULL,
    "question" VARCHAR(255) NOT NULL,
    "answer" VARCHAR(2000) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "faqs_is_active_sort_order_id_idx"
  ON "faqs"("is_active", "sort_order", "id");

CREATE TABLE IF NOT EXISTS "chat_threads" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "mode" VARCHAR(20) NOT NULL DEFAULT 'faq',
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_threads_player_id_status_updated_at_idx"
  ON "chat_threads"("player_id", "status", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "chat_threads_mode_status_idx"
  ON "chat_threads"("mode", "status");

CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" SERIAL NOT NULL,
    "thread_id" INTEGER NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'faq',
    "faq_id" INTEGER,
    "body" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_messages_thread_id_created_at_idx"
  ON "chat_messages"("thread_id", "created_at");

CREATE INDEX IF NOT EXISTS "chat_messages_faq_id_idx"
  ON "chat_messages"("faq_id");

DO $$ BEGIN
  ALTER TABLE "chat_threads"
    ADD CONSTRAINT "chat_threads_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "players"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_thread_id_fkey"
    FOREIGN KEY ("thread_id") REFERENCES "chat_threads"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_faq_id_fkey"
    FOREIGN KEY ("faq_id") REFERENCES "faqs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
