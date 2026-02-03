-- Migration: Create commercial_assets table for Copy-Hub
-- Description: Stores high-impact marketing assets generated from educational briefings.

CREATE TABLE IF NOT EXISTS public.commercial_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- e.g., 'headline', 'benefit', 'social_post', 'target_profile', 'differentiation'
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commercial_assets ENABLE ROW LEVEL SECURITY;

-- RLS Policies (consistent with documents and proposals)
CREATE POLICY "Users can view assets of their agency"
    ON public.commercial_assets
    FOR SELECT
    USING (agency_id = get_my_agency_id());

CREATE POLICY "Users can insert assets for their agency"
    ON public.commercial_assets
    FOR INSERT
    WITH CHECK (agency_id = get_my_agency_id());

CREATE POLICY "Users can update assets of their agency"
    ON public.commercial_assets
    FOR UPDATE
    USING (agency_id = get_my_agency_id());

CREATE POLICY "Users can delete assets of their agency"
    ON public.commercial_assets
    FOR DELETE
    USING (agency_id = get_my_agency_id());

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_commercial_assets_document_id ON public.commercial_assets(document_id);
CREATE INDEX IF NOT EXISTS idx_commercial_assets_agency_id ON public.commercial_assets(agency_id);
CREATE INDEX IF NOT EXISTS idx_commercial_assets_type ON public.commercial_assets(type);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_commercial_assets_updated_at
    BEFORE UPDATE ON public.commercial_assets
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
