-- Flashcards: cada questão ativa do banco é um cartão. Guardamos só o que o aluno já separou:
-- "learning" (ainda aprendendo) ou "known" (já sei). Sem linha = cartão novo.
CREATE TABLE "simulai_service"."flashcard_progress" (
    "user_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "flashcard_progress_pkey" PRIMARY KEY ("user_id", "question_id"),
    CONSTRAINT "flashcard_progress_status_chk" CHECK ("status" IN ('learning', 'known'))
);

CREATE INDEX "flashcard_progress_question_id_idx" ON "simulai_service"."flashcard_progress"("question_id");

ALTER TABLE "simulai_service"."flashcard_progress"
    ADD CONSTRAINT "flashcard_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "simulai_service"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "flashcard_progress_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "simulai_service"."questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
