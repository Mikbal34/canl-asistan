/**
 * Authentication Middleware
 * JWT doğrulama ve kullanıcı bilgisi ekleme
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');

// Supabase client (admin için service role key kullanılabilir)
const supabase = createClient(config.supabase.url, config.supabase.anonKey);

/**
 * JWT token'ı doğrular ve kullanıcı bilgisini req.user'a ekler
 * @param {Object} options - Ayarlar
 * @param {boolean} options.required - Auth zorunlu mu? (default: true)
 */
function authenticate(options = { required: true }) {
  return async (req, res, next) => {
    try {
      // Authorization header'dan token al
      const authHeader = req.headers.authorization;
      let token = null;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }

      // Token yoksa
      if (!token) {
        if (options.required) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication token is required',
          });
        }
        // Optional auth - devam et
        return next();
      }

      // Supabase ile token'ı doğrula
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        if (options.required) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired token',
          });
        }
        return next();
      }

      // Kullanıcı bilgilerini veritabanından al
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select(`
          *,
          tenant:tenants(*)
        `)
        .eq('auth_user_id', user.id)
        .single();

      if (dbError || !dbUser) {
        // Auth user var ama DB'de kayıt yok - yeni kullanıcı olabilir
        // Super admin kontrolü yap
        const { data: adminCheck } = await supabase
          .from('users')
          .select('id, role')
          .eq('email', user.email)
          .single();

        if (adminCheck) {
          // Email ile bul ve auth_user_id'yi güncelle
          await supabase
            .from('users')
            .update({ auth_user_id: user.id })
            .eq('email', user.email);

          // Tekrar dene
          const { data: updatedUser } = await supabase
            .from('users')
            .select(`*, tenant:tenants(*)`)
            .eq('auth_user_id', user.id)
            .single();

          req.user = updatedUser;
          req.authUser = user;
          return next();
        }

        if (options.required) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'User not found in system',
          });
        }
        return next();
      }

      // Kullanıcı aktif mi?
      if (!dbUser.is_active) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'User account is deactivated',
        });
      }

      // Request'e kullanıcı bilgilerini ekle
      req.user = dbUser;
      req.authUser = user;
      req.tenantId = dbUser.tenant_id;

      next();
    } catch (error) {
      console.error('[Auth] Error:', error);
      if (options.required) {
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Authentication failed',
        });
      }
      next();
    }
  };
}

/**
 * API Key ile authentication (webhook'lar için)
 */
function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required',
    });
  }

  // TODO: API key'i veritabanından doğrula
  // Şimdilik basit bir kontrol
  if (apiKey === process.env.INTERNAL_API_KEY) {
    req.isInternalCall = true;
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Invalid API key',
  });
}

/**
 * Super admin kontrolü
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Super admin access required',
    });
  }

  next();
}

/**
 * Tenant admin veya super admin kontrolü
 */
function requireTenantAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  if (!['super_admin', 'tenant_admin'].includes(req.user.role)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required',
    });
  }

  next();
}

module.exports = {
  authenticate,
  authenticateApiKey,
  requireSuperAdmin,
  requireTenantAdmin,
};
