-- Wingman License System Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Licenses table
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    tier VARCHAR(50) DEFAULT 'pro',
    max_devices INTEGER DEFAULT 3,
    is_dev BOOLEAN DEFAULT false,
    stripe_session_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Device activations table
CREATE TABLE IF NOT EXISTS device_activations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    os VARCHAR(50),
    last_validated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(license_id, device_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);
CREATE INDEX IF NOT EXISTS idx_licenses_license_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_device_activations_license_id ON device_activations(license_id);
CREATE INDEX IF NOT EXISTS idx_device_activations_device_id ON device_activations(device_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for licenses table
DROP TRIGGER IF EXISTS update_licenses_updated_at ON licenses;
CREATE TRIGGER update_licenses_updated_at
    BEFORE UPDATE ON licenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to count active devices for a license
CREATE OR REPLACE FUNCTION count_active_devices(p_license_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM device_activations WHERE license_id = p_license_id);
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) Policies
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_activations ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role has full access to licenses"
    ON licenses FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to device_activations"
    ON device_activations FOR ALL
    USING (auth.role() = 'service_role');

-- Do not grant anonymous read access to license data.
-- Public validation happens via edge functions using service_role.
