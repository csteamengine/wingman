-- Migration: Add is_dev column to licenses table
-- Date: 2026-01-25
-- Description: Add support for development licenses that enable dev tier switcher

-- Add is_dev column to licenses table
ALTER TABLE licenses
ADD COLUMN IF NOT EXISTS is_dev BOOLEAN DEFAULT false;

-- Create index for quick lookup of dev licenses
CREATE INDEX IF NOT EXISTS idx_licenses_is_dev ON licenses(is_dev) WHERE is_dev = true;

-- Add comment
COMMENT ON COLUMN licenses.is_dev IS 'If true, enables dev mode tier switcher for QA/testing purposes';
