-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "simulai_service";

-- CreateTable
CREATE TABLE "simulai_service"."users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulai_service"."roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulai_service"."permissions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulai_service"."user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "simulai_service"."role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "simulai_service"."knowledge_areas" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulai_service"."subjects" (
    "id" UUID NOT NULL,
    "knowledge_area_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulai_service"."topics" (
    "id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "parent_topic_id" UUID,
    "owner_user_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulai_service"."questions" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "topic_id" UUID,
    "type" TEXT NOT NULL DEFAULT 'multiple_choice',
    "statement" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "content_hash" TEXT NOT NULL,
    "source_import_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulai_service"."question_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "option_key" VARCHAR(1) NOT NULL,
    "text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulai_service"."question_collections" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulai_service"."collection_questions" (
    "collection_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_questions_pkey" PRIMARY KEY ("collection_id","question_id")
);

-- CreateTable
CREATE TABLE "simulai_service"."question_imports" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "schema_version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "total_count" INTEGER NOT NULL,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committed_at" TIMESTAMPTZ,

    CONSTRAINT "question_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulai_service"."simulations" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'exam',
    "status" TEXT NOT NULL DEFAULT 'ready',
    "question_count" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'all',
    "timed" BOOLEAN NOT NULL,
    "duration_seconds" INTEGER,
    "configuration" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulai_service"."simulation_questions" (
    "id" UUID NOT NULL,
    "simulation_id" UUID NOT NULL,
    "source_question_id" UUID,
    "position" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulai_service"."simulation_attempts" (
    "id" UUID NOT NULL,
    "simulation_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "finished_at" TIMESTAMPTZ,
    "finish_reason" TEXT,
    "correct_count" INTEGER,
    "incorrect_count" INTEGER,
    "unanswered_count" INTEGER,
    "score_percentage" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulai_service"."attempt_answers" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "simulation_id" UUID NOT NULL,
    "simulation_question_id" UUID NOT NULL,
    "selected_option_key" VARCHAR(1),
    "answered_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "simulai_service"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "simulai_service"."roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "simulai_service"."permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_areas_name_key" ON "simulai_service"."knowledge_areas"("name");

-- CreateIndex
CREATE INDEX "subjects_owner_user_id_idx" ON "simulai_service"."subjects"("owner_user_id");

-- CreateIndex
CREATE INDEX "topics_subject_id_idx" ON "simulai_service"."topics"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "topics_id_subject_id_key" ON "simulai_service"."topics"("id", "subject_id");

-- CreateIndex
CREATE INDEX "questions_owner_user_id_status_idx" ON "simulai_service"."questions"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "questions_owner_user_id_content_hash_idx" ON "simulai_service"."questions"("owner_user_id", "content_hash");

-- CreateIndex
CREATE INDEX "questions_owner_user_id_subject_id_idx" ON "simulai_service"."questions"("owner_user_id", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_question_id_option_key_key" ON "simulai_service"."question_options"("question_id", "option_key");

-- CreateIndex
CREATE INDEX "question_collections_owner_user_id_idx" ON "simulai_service"."question_collections"("owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_imports_owner_user_id_idempotency_key_key" ON "simulai_service"."question_imports"("owner_user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "simulations_owner_user_id_created_at_idx" ON "simulai_service"."simulations"("owner_user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "simulation_questions_simulation_id_position_key" ON "simulai_service"."simulation_questions"("simulation_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_questions_simulation_id_source_question_id_key" ON "simulai_service"."simulation_questions"("simulation_id", "source_question_id");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_questions_id_simulation_id_key" ON "simulai_service"."simulation_questions"("id", "simulation_id");

-- CreateIndex
CREATE INDEX "simulation_attempts_owner_user_id_created_at_idx" ON "simulai_service"."simulation_attempts"("owner_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "simulation_attempts_status_expires_at_idx" ON "simulai_service"."simulation_attempts"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_attempts_id_simulation_id_key" ON "simulai_service"."simulation_attempts"("id", "simulation_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_answers_attempt_id_simulation_question_id_key" ON "simulai_service"."attempt_answers"("attempt_id", "simulation_question_id");

-- AddForeignKey
ALTER TABLE "simulai_service"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "simulai_service"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "simulai_service"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "simulai_service"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "simulai_service"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."subjects" ADD CONSTRAINT "subjects_knowledge_area_id_fkey" FOREIGN KEY ("knowledge_area_id") REFERENCES "simulai_service"."knowledge_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."subjects" ADD CONSTRAINT "subjects_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "simulai_service"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."topics" ADD CONSTRAINT "topics_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "simulai_service"."subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."topics" ADD CONSTRAINT "topics_parent_topic_id_fkey" FOREIGN KEY ("parent_topic_id") REFERENCES "simulai_service"."topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."topics" ADD CONSTRAINT "topics_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "simulai_service"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."questions" ADD CONSTRAINT "questions_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "simulai_service"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."questions" ADD CONSTRAINT "questions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "simulai_service"."subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."questions" ADD CONSTRAINT "questions_topic_id_subject_id_fkey" FOREIGN KEY ("topic_id", "subject_id") REFERENCES "simulai_service"."topics"("id", "subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."questions" ADD CONSTRAINT "questions_source_import_id_fkey" FOREIGN KEY ("source_import_id") REFERENCES "simulai_service"."question_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "simulai_service"."questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."question_collections" ADD CONSTRAINT "question_collections_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "simulai_service"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."collection_questions" ADD CONSTRAINT "collection_questions_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "simulai_service"."question_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."collection_questions" ADD CONSTRAINT "collection_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "simulai_service"."questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."question_imports" ADD CONSTRAINT "question_imports_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "simulai_service"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."simulations" ADD CONSTRAINT "simulations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "simulai_service"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."simulation_questions" ADD CONSTRAINT "simulation_questions_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulai_service"."simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."simulation_questions" ADD CONSTRAINT "simulation_questions_source_question_id_fkey" FOREIGN KEY ("source_question_id") REFERENCES "simulai_service"."questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."simulation_attempts" ADD CONSTRAINT "simulation_attempts_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulai_service"."simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."simulation_attempts" ADD CONSTRAINT "simulation_attempts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "simulai_service"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_id_simulation_id_fkey" FOREIGN KEY ("attempt_id", "simulation_id") REFERENCES "simulai_service"."simulation_attempts"("id", "simulation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulai_service"."attempt_answers" ADD CONSTRAINT "attempt_answers_simulation_question_id_simulation_id_fkey" FOREIGN KEY ("simulation_question_id", "simulation_id") REFERENCES "simulai_service"."simulation_questions"("id", "simulation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Regras que o Prisma não expressa (escritas à mão). Ao rodar `prisma migrate dev` no futuro,
-- revise o SQL gerado: se ele tentar remover qualquer índice/constraint abaixo, apague essas
-- linhas antes de aplicar.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- RN-005: exatamente uma alternativa correta por questão (a existência é validada na transação).
CREATE UNIQUE INDEX "question_options_one_correct_per_question"
    ON "simulai_service"."question_options"("question_id") WHERE "is_correct";

-- RN-023: no máximo uma tentativa em andamento por aluno e simulado.
CREATE UNIQUE INDEX "simulation_attempts_one_in_progress"
    ON "simulai_service"."simulation_attempts"("simulation_id", "owner_user_id")
    WHERE "status" = 'in_progress';

-- Taxonomia: nomes únicos no catálogo e dentro do espaço privado de cada aluno.
CREATE UNIQUE INDEX "subjects_catalog_name_key"
    ON "simulai_service"."subjects"("knowledge_area_id", lower("name")) WHERE "owner_user_id" IS NULL;
CREATE UNIQUE INDEX "subjects_owner_name_key"
    ON "simulai_service"."subjects"("owner_user_id", "knowledge_area_id", lower("name")) WHERE "owner_user_id" IS NOT NULL;
CREATE UNIQUE INDEX "topics_catalog_name_key"
    ON "simulai_service"."topics"("subject_id", lower("name")) WHERE "owner_user_id" IS NULL;
CREATE UNIQUE INDEX "topics_owner_name_key"
    ON "simulai_service"."topics"("owner_user_id", "subject_id", lower("name")) WHERE "owner_user_id" IS NOT NULL;

-- Domínios fechados (RN-004, RN-011, RN-015, estados de 02_BUSINESS_RULES).
ALTER TABLE "simulai_service"."users"
    ADD CONSTRAINT "users_email_lowercase_chk" CHECK ("email" = lower("email"));
ALTER TABLE "simulai_service"."questions"
    ADD CONSTRAINT "questions_type_chk" CHECK ("type" IN ('multiple_choice')),
    ADD CONSTRAINT "questions_difficulty_chk" CHECK ("difficulty" IN ('easy', 'medium', 'hard')),
    ADD CONSTRAINT "questions_status_chk" CHECK ("status" IN ('active', 'archived'));
ALTER TABLE "simulai_service"."question_options"
    ADD CONSTRAINT "question_options_key_chk" CHECK ("option_key" ~ '^[A-F]$');
ALTER TABLE "simulai_service"."question_imports"
    ADD CONSTRAINT "question_imports_status_chk" CHECK ("status" IN ('validated', 'committed', 'discarded')),
    ADD CONSTRAINT "question_imports_counts_chk" CHECK ("total_count" >= 0 AND "imported_count" >= 0 AND "rejected_count" >= 0 AND "duplicate_count" >= 0);
ALTER TABLE "simulai_service"."simulations"
    ADD CONSTRAINT "simulations_mode_chk" CHECK ("mode" IN ('exam')),
    ADD CONSTRAINT "simulations_status_chk" CHECK ("status" IN ('ready', 'archived')),
    ADD CONSTRAINT "simulations_difficulty_chk" CHECK ("difficulty" IN ('all', 'easy', 'medium', 'hard')),
    ADD CONSTRAINT "simulations_question_count_chk" CHECK ("question_count" BETWEEN 1 AND 200),
    ADD CONSTRAINT "simulations_duration_chk" CHECK (
        ("timed" AND "duration_seconds" IS NOT NULL AND "duration_seconds" > 0)
        OR (NOT "timed" AND "duration_seconds" IS NULL)
    );
ALTER TABLE "simulai_service"."simulation_questions"
    ADD CONSTRAINT "simulation_questions_position_chk" CHECK ("position" >= 1);
ALTER TABLE "simulai_service"."simulation_attempts"
    ADD CONSTRAINT "simulation_attempts_status_chk" CHECK ("status" IN ('in_progress', 'completed', 'expired')),
    ADD CONSTRAINT "simulation_attempts_finish_chk" CHECK (
        ("status" = 'in_progress' AND "finished_at" IS NULL AND "finish_reason" IS NULL)
        OR ("status" = 'completed' AND "finished_at" IS NOT NULL AND "finish_reason" = 'manual' AND "score_percentage" IS NOT NULL)
        OR ("status" = 'expired' AND "finished_at" IS NOT NULL AND "finish_reason" = 'timeout' AND "score_percentage" IS NOT NULL)
    ),
    ADD CONSTRAINT "simulation_attempts_score_chk" CHECK ("score_percentage" IS NULL OR "score_percentage" BETWEEN 0 AND 100);
ALTER TABLE "simulai_service"."attempt_answers"
    ADD CONSTRAINT "attempt_answers_key_chk" CHECK ("selected_option_key" IS NULL OR "selected_option_key" ~ '^[A-F]$');
