-- Add title column to proposals table
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS title TEXT;

-- Set default title for existing proposals
UPDATE proposals SET title = 'Propuesta sin título' WHERE title IS NULL;
