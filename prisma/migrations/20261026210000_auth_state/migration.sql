-- Estado de autenticação que antes ficava no Redis: sessões (refresh tokens), links de senha e
-- limites de tentativa. O Redis compartilhado só é acessível de dentro da VPS.

-- CreateTable
CREATE TABLE "simulai_service"."auth_sessions" (
    "token_hash" CHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "simulai_service"."password_reset_links" (
    "user_id" UUID NOT NULL,
    "jti" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "password_reset_links_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "simulai_service"."rate_limit_buckets" (
    "key" VARCHAR(320) NOT NULL,
    "attempts" INTEGER NOT NULL,
    "window_ends_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "simulai_service"."auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "simulai_service"."auth_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "password_reset_links_expires_at_idx" ON "simulai_service"."password_reset_links"("expires_at");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_window_ends_at_idx" ON "simulai_service"."rate_limit_buckets"("window_ends_at");

-- AddForeignKey
ALTER TABLE "simulai_service"."auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "simulai_service"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."password_reset_links" ADD CONSTRAINT "password_reset_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "simulai_service"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Manual: keep the stored hash honest.
ALTER TABLE "simulai_service"."auth_sessions" ADD CONSTRAINT "auth_sessions_token_hash_hex" CHECK ("token_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "simulai_service"."rate_limit_buckets" ADD CONSTRAINT "rate_limit_buckets_attempts_positive" CHECK ("attempts" >= 1);
