-- Migration: 027_tenant_assets_bucket
-- Description: Create tenant-assets storage bucket for logo/favicon uploads
-- Date: 2026-02-12

-- Create public bucket for tenant assets (logos, favicons)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-assets',
  'tenant-assets',
  true,
  2097152, -- 2MB
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access (logos/favicons are public)
CREATE POLICY "Public read access for tenant assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tenant-assets');

-- Allow authenticated users (admin) to upload
CREATE POLICY "Authenticated users can upload tenant assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'tenant-assets');

-- Allow authenticated users (admin) to update/overwrite
CREATE POLICY "Authenticated users can update tenant assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'tenant-assets');

-- Allow authenticated users (admin) to delete
CREATE POLICY "Authenticated users can delete tenant assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'tenant-assets');
