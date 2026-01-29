-- Agencies: Stores core agency configuration
CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    branding JSONB DEFAULT '{}'::JSONB, -- colors, fonts, logo_url
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users: Extends Supabase Auth users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    agency_id UUID REFERENCES agencies(id),
    role TEXT CHECK (role IN ('admin', 'editor', 'supervisor')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents: Original PDF files
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, processed, error
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storage: Create 'documents' bucket if not exists (Idempotent insert)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies (Basic Structure - Disabled for initial setup to avoid lockouts)
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Storage Policy: Allow public access for now (dev mode) or authenticated
-- Note: Real production should be stricter.
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Allow authenticated reads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');
