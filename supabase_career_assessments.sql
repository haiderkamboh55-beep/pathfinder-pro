-- ============================================================
-- SQL SCRIPT FOR CAREER ASSESSMENTS TABLE
-- Run this in Supabase SQL Editor to create the table for assessment history
-- ============================================================

-- Create the career_assessments table
CREATE TABLE IF NOT EXISTS career_assessments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    education_level TEXT,
    target_role TEXT,
    country TEXT,
    skills TEXT[],
    holland_code TEXT,
    interests TEXT[],
    work_preferences JSONB,
    gad_responses JSONB,
    gad_total_score INTEGER DEFAULT 0,
    gad_severity TEXT,
    phq_responses JSONB,
    phq_total_score INTEGER DEFAULT 0,
    phq_severity TEXT,
    career_advice TEXT,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_career_assessments_user_id ON career_assessments(user_id);

-- Add index on completed_at for sorting
CREATE INDEX IF NOT EXISTS idx_career_assessments_completed_at ON career_assessments(completed_at DESC);

-- Enable Row Level Security
ALTER TABLE career_assessments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own assessments" ON career_assessments;
DROP POLICY IF EXISTS "Users can insert own assessments" ON career_assessments;
DROP POLICY IF EXISTS "Users can update own assessments" ON career_assessments;
DROP POLICY IF EXISTS "Users can delete own assessments" ON career_assessments;

-- Create RLS policies
CREATE POLICY "Users can read own assessments" 
ON career_assessments FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assessments" 
ON career_assessments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assessments" 
ON career_assessments FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assessments" 
ON career_assessments FOR DELETE 
USING (auth.uid() = user_id);

-- Verify the table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'career_assessments'
ORDER BY ordinal_position;
