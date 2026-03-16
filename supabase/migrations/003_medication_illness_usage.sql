-- Add illness and usage_note columns to medications table
ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS illness text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS usage_note text DEFAULT NULL;

-- Optional: add comment for documentation
COMMENT ON COLUMN medications.illness IS '治疗病症，如 感冒、高血压';
COMMENT ON COLUMN medications.usage_note IS '服用方式，如 饭后服用、空腹服用';
