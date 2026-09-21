BEGIN;

ALTER TABLE "candidates"
  ALTER COLUMN "gender" TYPE TEXT
  USING CASE
    WHEN "gender"::text = 'MALE' THEN 'male'
    WHEN "gender"::text = 'FEMALE' THEN 'female'
    WHEN "gender"::text = 'PREFER_NOT_TO_SAY' THEN 'Prefer not to say'
    WHEN "gender" IS NULL THEN NULL
    ELSE 'Prefer not to say'
  END;

DROP TYPE "Gender";

ALTER TABLE "candidates"
  ADD CONSTRAINT "candidates_gender_check"
  CHECK ("gender" IS NULL OR "gender" IN ('male', 'female', 'Prefer not to say'));

COMMIT;
