-- AI Multichannel System - Database Initialization
-- This script creates the initial database schema and extensions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS public;

-- Set search path
SET search_path = public;

-- Create tables (these will be created by SQLAlchemy migrations)
-- This file is just for initial setup

-- Create a function to check if a table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        RAISE NOTICE 'Tables will be created by SQLAlchemy migrations';
    END IF;
END $$;

-- Create indexes for better performance
-- These will be created by SQLAlchemy models

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Grant permissions (for production)
GRANT ALL PRIVILEGES ON DATABASE ai_multichannel TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
