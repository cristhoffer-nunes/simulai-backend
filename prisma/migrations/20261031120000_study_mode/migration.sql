-- Modo estudo: a correção aparece depois de cada resposta confirmada, sem cronômetro.
ALTER TABLE "simulai_service"."simulations"
  DROP CONSTRAINT "simulations_mode_chk",
  ADD CONSTRAINT "simulations_mode_chk" CHECK ("mode" IN ('exam', 'study')),
  ADD CONSTRAINT "simulations_study_untimed_chk" CHECK ("mode" <> 'study' OR ("timed" = false AND "duration_seconds" IS NULL));

-- Momento em que o aluno confirmou a resposta no modo estudo: a partir daí ela não muda.
-- Nulo no modo prova e para respostas ainda não confirmadas.
ALTER TABLE "simulai_service"."attempt_answers"
  ADD COLUMN "confirmed_at" TIMESTAMPTZ;
