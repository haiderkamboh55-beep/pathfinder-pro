-- ============================================================
-- COMPLETE FIX FOR PROFILES TABLE
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================

-- Step 1: Check current table structure (optional - for debugging)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles';

-- Step 2: Add ALL missing columns with correct types
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT '+92';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS education_level TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_role TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS experience TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 3: Fix the skills column - change from array to text if needed
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'skills' 
        AND data_type = 'ARRAY'
    ) THEN
        ALTER TABLE profiles ALTER COLUMN skills TYPE TEXT USING array_to_string(skills, ', ');
    END IF;
END $$;

-- Step 4: Ensure skills column exists as TEXT
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skills TEXT;

-- Step 5: Delete duplicate rows (keep most recent)
DELETE FROM profiles a USING profiles b
WHERE a.ctid < b.ctid 
AND a.user_id IS NOT NULL 
AND a.user_id = b.user_id;

-- Step 6: Create unique constraint on user_id
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
    END IF;
EXCEPTION WHEN others THEN
    NULL;
END $$;

-- Step 7: Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 8: Drop and recreate ALL policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for users" ON profiles;
DROP POLICY IF EXISTS "Enable insert access for users" ON profiles;
DROP POLICY IF EXISTS "Enable update access for users" ON profiles;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON profiles;

-- Create new policies
CREATE POLICY "Users can read own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
ON profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = user_id);

-- Step 9: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- Step 10: Verify the table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
