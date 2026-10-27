-- "Revisar depois": o aluno marca questões para rever antes de finalizar a prova.
-- Só um lembrete: não muda a nota. Linhas existentes ficam sem marca.
ALTER TABLE "simulai_service"."attempt_answers"
  ADD COLUMN "flagged" BOOLEAN NOT NULL DEFAULT false;
