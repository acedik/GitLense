-- ==============================================================================
-- chitgit Supabase Database Schema & RLS Setup
-- Copy and paste this directly into Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. Create Profiles Table (Synced with Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    tier TEXT DEFAULT 'free',
    scans_remaining INT DEFAULT 20,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Scans Table (Logs Plagiarism Reports from Extension / Web)
CREATE TABLE IF NOT EXISTS public.scans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE SET NULL,
    repo TEXT NOT NULL,
    commit_sha TEXT NOT NULL,
    commit_message TEXT,
    author_name TEXT,
    verdict TEXT NOT NULL CHECK (verdict IN ('ORIGINAL', 'SUSPICIOUS', 'PLAGIARIZED', 'BOILERPLATE_OR_LIBRARY')),
    plagiarism_score INT NOT NULL CHECK (plagiarism_score >= 0 AND plagiarism_score <= 100),
    plagiarism_category TEXT,
    flagged_snippets JSONB DEFAULT '[]'::jsonb,
    reasoning TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- 4. Row Level Security Policies
-- Profiles: Users can view and edit only their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Scans: Public read access for repository audits, authenticated or anon insert
CREATE POLICY "Public read scans" ON public.scans
    FOR SELECT USING (true);

CREATE POLICY "Allow scan insertion" ON public.scans
    FOR INSERT WITH CHECK (true);

-- 5. Auto-Profile Trigger upon Email OTP Sign Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, tier, scans_remaining)
  VALUES (new.id, new.email, 'free', 20)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if already exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
