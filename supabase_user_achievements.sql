-- SQL Script to create user_achievements table in Supabase
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Create the user_achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own achievements
CREATE POLICY "Users can read own achievements" 
ON user_achievements 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own achievements
CREATE POLICY "Users can insert own achievements" 
ON user_achievements 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own achievements
CREATE POLICY "Users can update own achievements" 
ON user_achievements 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);

-- Optional: Insert initial record for existing users (run after table is created)
-- INSERT INTO user_achievements (user_id, points)
-- SELECT id, 0 FROM auth.users
-- ON CONFLICT (user_id) DO NOTHING;
