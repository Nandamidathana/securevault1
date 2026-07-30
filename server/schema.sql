-- SecureVault Supabase Database Schema

-- 1. Drop old foreign key linking public.users to auth.users if it exists
ALTER TABLE IF EXISTS public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- 2. Create / Align Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  pin_hash VARCHAR(255),
  storage_used BIGINT DEFAULT 0,
  otp_hash VARCHAR(255),
  otp_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Schema Alignment Commands for Users Table
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS storage_used BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 3. Create OTP Password Reset Table
CREATE TABLE IF NOT EXISTS otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Encrypted Files Table
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  encrypted_path VARCHAR(500),
  iv VARCHAR(64),
  auth_tag VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Schema Alignment Commands for Files Table
ALTER TABLE files ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE files ADD COLUMN IF NOT EXISTS iv VARCHAR(64);
ALTER TABLE files ADD COLUMN IF NOT EXISTS auth_tag VARCHAR(64);
ALTER TABLE files ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE files ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500);
ALTER TABLE files ADD COLUMN IF NOT EXISTS encrypted_path VARCHAR(500);
ALTER TABLE files ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);
ALTER TABLE files ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
ALTER TABLE files ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS file_type VARCHAR(100);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_category ON files(category);
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);

-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- Run these commands in Supabase SQL Editor if RLS is enabled:
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow user select files" ON files;
CREATE POLICY "Allow user select files" ON files FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow user insert files" ON files;
CREATE POLICY "Allow user insert files" ON files FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow user delete files" ON files;
CREATE POLICY "Allow user delete files" ON files FOR DELETE USING (true);

-- SUPABASE STORAGE BUCKET INSTRUCTIONS:
-- 1. Go to Supabase Dashboard -> Storage
-- 2. Create a new bucket named: "vault-storage"
-- 3. Make sure bucket is Private (only service role key or authenticated access allowed)
