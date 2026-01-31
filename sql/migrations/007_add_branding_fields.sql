-- Migration 007: Add branding fields to tenants table
-- Adds favicon_url, login_message, and ssl_verified columns

-- Add favicon_url column
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS favicon_url TEXT;

-- Add login_message column
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS login_message TEXT;

-- Add ssl_verified column for custom domain SSL status
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS ssl_verified BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN tenants.favicon_url IS 'URL to tenant favicon (displayed in browser tab)';
COMMENT ON COLUMN tenants.login_message IS 'Custom message displayed on tenant login page';
COMMENT ON COLUMN tenants.ssl_verified IS 'Whether SSL certificate is verified for custom domain';

-- Create index on custom_domain for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain ON tenants(custom_domain) WHERE custom_domain IS NOT NULL;
