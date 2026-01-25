-- Create individual_wheels table
CREATE TABLE public.individual_wheels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    name TEXT NOT NULL, -- 'Paw Patrol', 'Emojis', etc.
    theme_category TEXT, -- 'infantil', 'adultos', 'deportes'
    segment_count INTEGER DEFAULT 12,
    is_active BOOLEAN DEFAULT true,
    image_preview TEXT
);

-- Create individual_wheel_segments table
CREATE TABLE public.individual_wheel_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wheel_id UUID REFERENCES public.individual_wheels(id) ON DELETE CASCADE,
    
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    image_path TEXT,
    color TEXT,
    
    UNIQUE(wheel_id, position)
);

-- RLS Checks (Public read, Admin write)
ALTER TABLE public.individual_wheels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individual_wheel_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read wheels" ON public.individual_wheels
    FOR SELECT USING (true);

CREATE POLICY "Public read segments" ON public.individual_wheel_segments
    FOR SELECT USING (true);
