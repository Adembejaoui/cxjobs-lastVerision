-- Align the database gender constraint with the application's final gender
-- contract: exactly "Male" or "Female", stored with that capitalization.
--
-- Supersedes the constraint created in 20260915130000_normalize_gender_values,
-- which allowed the lowercase values 'male' / 'female' plus the removed
-- 'Prefer not to say'. Historical migrations are left untouched.

BEGIN;

-- The old constraint rejects 'Male' / 'Female', so it has to be dropped BEFORE
-- the rows below can be normalized. Dropping it is safe on its own: the column
-- is nullable and the new constraint is re-added in the same transaction.
ALTER TABLE "candidates" DROP CONSTRAINT IF EXISTS "candidates_gender_check";

-- Normalize existing rows to the two values the application now writes:
--   'male' / 'MALE'   -> 'Male'
--   'female' / 'FEMALE' -> 'Female'
-- Anything else that is not already valid - including the removed
-- 'Prefer not to say' and the old enum spellings NON_BINARY / OTHER - becomes
-- NULL, so no row keeps a value the application no longer accepts, stores or
-- displays. NULL is the honest representation of "no gender recorded".
-- Rows already holding 'Male' / 'Female' are left untouched by the WHERE clause.
UPDATE "candidates"
SET "gender" = CASE
    WHEN "gender" IN ('male', 'MALE') THEN 'Male'
    WHEN "gender" IN ('female', 'FEMALE') THEN 'Female'
    ELSE NULL
  END
WHERE "gender" IS NOT NULL
  AND "gender" NOT IN ('Male', 'Female');

-- Re-assert the constraint against exactly what the application writes.
ALTER TABLE "candidates"
  ADD CONSTRAINT "candidates_gender_check"
  CHECK ("gender" IS NULL OR "gender" IN ('Male', 'Female'));

COMMIT;
