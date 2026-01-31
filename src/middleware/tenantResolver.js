/**
 * Tenant Resolver Middleware
 * JWT veya header'dan tenant'ı çözümler
 * Domain-based resolution kaldırıldı - herkes aynı URL'den erişiyor
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

// Tenant cache (basit in-memory cache)
const tenantCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 dakika

/**
 * Cache'den tenant al veya DB'den çek
 */
async function getTenantFromCache(key, fetchFn) {
  const cached = tenantCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await fetchFn();
  if (data) {
    tenantCache.set(key, { data, timestamp: Date.now() });
  }
  return data;
}

/**
 * Tenant'ı çeşitli kaynaklardan çözümler:
 * 1. JWT'deki tenant_id (auth middleware'den)
 * 2. X-Tenant-ID header
 * 3. X-Tenant-Slug header
 * 4. URL path (/t/:slug/...)
 */
function resolveTenant(options = { required: true }) {
  return async (req, res, next) => {
    try {
      let tenant = null;
      let resolvedBy = null;

      // 1. Zaten auth middleware'den geldiyse
      if (req.tenantId) {
        tenant = req.user?.tenant || await getTenantFromCache(`id:${req.tenantId}`, async () => {
          const { data } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', req.tenantId)
            .eq('is_active', true)
            .single();
          return data;
        });
        resolvedBy = 'jwt';
      }

      // 2. X-Tenant-ID header (API çağrıları için)
      if (!tenant && req.headers['x-tenant-id']) {
        const tenantId = req.headers['x-tenant-id'];
        tenant = await getTenantFromCache(`id:${tenantId}`, async () => {
          const { data } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', tenantId)
            .eq('is_active', true)
            .single();
          return data;
        });
        resolvedBy = 'header';
      }

      // 3. X-Tenant-Slug header (alternatif)
      if (!tenant && req.headers['x-tenant-slug']) {
        const slug = req.headers['x-tenant-slug'];
        tenant = await getTenantFromCache(`slug:${slug}`, async () => {
          const { data } = await supabase
            .from('tenants')
            .select('*')
            .eq('slug', slug)
            .eq('is_active', true)
            .single();
          return data;
        });
        resolvedBy = 'header-slug';
      }

      // 4. URL path'den (/t/:slug/...)
      if (!tenant && req.path.startsWith('/t/')) {
        const pathParts = req.path.split('/');
        if (pathParts.length >= 3) {
          const slug = pathParts[2];
          tenant = await getTenantFromCache(`slug:${slug}`, async () => {
            const { data } = await supabase
              .from('tenants')
              .select('*')
              .eq('slug', slug)
              .eq('is_active', true)
              .single();
            return data;
          });
          resolvedBy = 'path';

          // Path'i temizle (slug'ı çıkar)
          if (tenant) {
            req.originalPath = req.path;
            req.path = '/' + pathParts.slice(3).join('/') || '/';
            req.url = req.path + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
          }
        }
      }

      // Tenant bulunamadı
      if (!tenant && options.required) {
        return res.status(404).json({
          error: 'Tenant Not Found',
          message: 'Could not resolve tenant from request',
        });
      }

      // Request'e tenant bilgisini ekle
      if (tenant) {
        req.tenant = tenant;
        req.tenantId = tenant.id;
        req.tenantResolvedBy = resolvedBy;

        // Debug log
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[TenantResolver] Resolved: ${tenant.name} (${tenant.slug}) via ${resolvedBy}`);
        }
      }

      next();
    } catch (error) {
      console.error('[TenantResolver] Error:', error);
      if (options.required) {
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to resolve tenant',
        });
      }
      next();
    }
  };
}

/**
 * Twilio webhook için tenant çözümleme
 * Custom parameter veya phone number'dan
 */
async function resolveTenantForCall(params) {
  const { tenantId, tenantSlug, toNumber } = params;

  // 1. Direkt tenant ID
  if (tenantId) {
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .eq('is_active', true)
      .single();
    return data;
  }

  // 2. Slug'dan
  if (tenantSlug) {
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('slug', tenantSlug)
      .eq('is_active', true)
      .single();
    return data;
  }

  // 3. Twilio telefon numarasından
  if (toNumber) {
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('twilio_phone_number', toNumber)
      .eq('is_active', true)
      .single();
    return data;
  }

  return null;
}

/**
 * Cache'i temizle
 */
function clearTenantCache(tenantId = null) {
  if (tenantId) {
    // Belirli tenant'ı temizle
    for (const [key, value] of tenantCache.entries()) {
      if (value.data?.id === tenantId) {
        tenantCache.delete(key);
      }
    }
  } else {
    // Tüm cache'i temizle
    tenantCache.clear();
  }
}

module.exports = {
  resolveTenant,
  resolveTenantForCall,
  clearTenantCache,
};
