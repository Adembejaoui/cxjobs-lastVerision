-- Additive and backward compatible: existing rows get 0, matching tokens
-- issued before this column existed (they carry no "sv" claim = 0).
ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
