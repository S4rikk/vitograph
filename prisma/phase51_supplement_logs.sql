CREATE TABLE "supplement_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "supplement_name" TEXT NOT NULL,
    "dosage_taken" TEXT NOT NULL,
    "taken_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "was_on_time" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'manual',
    CONSTRAINT "supplement_logs_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "supplement_logs_user_id_taken_at_idx" ON "supplement_logs"("user_id", "taken_at");
-- AddForeignKey
ALTER TABLE "supplement_logs"
ADD CONSTRAINT "supplement_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;