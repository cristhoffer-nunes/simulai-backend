-- Import previews are stored server-side between "validate" and "commit" (API contract: the
-- preview must not be tampered with and expires).

-- AlterTable
ALTER TABLE "simulai_service"."question_imports" ADD COLUMN     "expires_at" TIMESTAMPTZ,
ADD COLUMN     "preview" JSONB;

-- AlterTable
ALTER TABLE "simulai_service"."questions" ADD COLUMN     "source_reference" VARCHAR(500);

-- CreateIndex
CREATE INDEX "question_imports_owner_user_id_created_at_idx" ON "simulai_service"."question_imports"("owner_user_id", "created_at" DESC);

-- Manual: a validated import always has its preview and deadline.
ALTER TABLE "simulai_service"."question_imports" ADD CONSTRAINT "question_imports_preview_chk"
    CHECK ("status" <> 'validated' OR ("preview" IS NOT NULL AND "expires_at" IS NOT NULL));
