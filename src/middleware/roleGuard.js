/**
 * Role Guard Middleware
 * Role-based access control (RBAC)
 */

/**
 * Rol hiyerarşisi
 * super_admin > tenant_admin
 */
const ROLE_HIERARCHY = {
  super_admin: 2,
  tenant_admin: 1,
};

/**
 * Belirtilen rollerin herhangi birine sahip olmalı
 * @param {string[]} allowedRoles - İzin verilen roller
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userRole = req.user.role;

    // Super admin her şeye erişebilir
    if (userRole === 'super_admin') {
      return next();
    }

    // Kullanıcının rolü izin verilenler arasında mı?
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden',
      message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
    });
  };
}

/**
 * Minimum rol seviyesi kontrolü
 * @param {string} minimumRole - Minimum gerekli rol
 */
function requireMinimumRole(minimumRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] || 0;

    if (userLevel >= requiredLevel) {
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden',
      message: `Access denied. Minimum role required: ${minimumRole}`,
    });
  };
}

/**
 * Tenant erişim kontrolü
 * Kullanıcı sadece kendi tenant'ının verilerine erişebilir
 * (super_admin hariç)
 */
function requireTenantAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  // Super admin tüm tenant'lara erişebilir
  if (req.user.role === 'super_admin') {
    return next();
  }

  // Request'te tenant var mı?
  const requestedTenantId = req.tenantId || req.params.tenantId || req.body?.tenant_id;

  if (!requestedTenantId) {
    // Tenant belirlenmemişse, kullanıcının kendi tenant'ını kullan
    req.tenantId = req.user.tenant_id;
    return next();
  }

  // Kullanıcı kendi tenant'ına mı erişmeye çalışıyor?
  if (requestedTenantId !== req.user.tenant_id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied to this tenant',
    });
  }

  next();
}

/**
 * Kaynak sahibi kontrolü
 * Kullanıcı sadece kendi kayıtlarını düzenleyebilir
 * (admin'ler hariç)
 * @param {Function} getOwnerId - Kaynak sahibinin ID'sini döndüren fonksiyon
 */
function requireOwnership(getOwnerId) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Admin'ler her şeyi düzenleyebilir
    if (['super_admin', 'tenant_admin'].includes(req.user.role)) {
      return next();
    }

    try {
      const ownerId = await getOwnerId(req);

      if (ownerId !== req.user.id) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only modify your own resources',
        });
      }

      next();
    } catch (error) {
      console.error('[RoleGuard] Ownership check error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to verify ownership',
      });
    }
  };
}

/**
 * Plan bazlı özellik kontrolü
 * @param {string} feature - Özellik adı
 */
function requirePlanFeature(feature) {
  const PLAN_FEATURES = {
    starter: ['basic_appointments', 'call_logs', 'dashboard'],
    professional: ['custom_domain', 'white_label', 'advanced_analytics', 'api_access'],
    enterprise: ['multiple_locations', 'sso', 'dedicated_support', 'unlimited_calls'],
  };

  return (req, res, next) => {
    if (!req.tenant) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant not resolved',
      });
    }

    const tenantPlan = req.tenant.plan || 'starter';

    // Tüm planlar için temel özellikler
    const baseFeatures = PLAN_FEATURES.starter;

    // Plan'a göre eklenen özellikler
    let allowedFeatures = [...baseFeatures];

    if (tenantPlan === 'professional' || tenantPlan === 'enterprise') {
      allowedFeatures = [...allowedFeatures, ...PLAN_FEATURES.professional];
    }

    if (tenantPlan === 'enterprise') {
      allowedFeatures = [...allowedFeatures, ...PLAN_FEATURES.enterprise];
    }

    if (!allowedFeatures.includes(feature)) {
      return res.status(403).json({
        error: 'Plan Upgrade Required',
        message: `This feature requires ${feature}. Please upgrade your plan.`,
        currentPlan: tenantPlan,
        requiredFeature: feature,
      });
    }

    next();
  };
}

/**
 * Rate limiting (basit implementation)
 * TODO: Redis ile daha iyi bir rate limiter
 */
const rateLimitStore = new Map();

function rateLimit(options = {}) {
  const {
    windowMs = 60 * 1000, // 1 dakika
    maxRequests = 100,
    keyGenerator = (req) => req.tenantId || req.ip,
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    // Mevcut kayıt
    let record = rateLimitStore.get(key);

    if (!record || now - record.windowStart > windowMs) {
      // Yeni pencere başlat
      record = {
        windowStart: now,
        count: 0,
      };
    }

    record.count++;
    rateLimitStore.set(key, record);

    // Limit aşıldı mı?
    if (record.count > maxRequests) {
      const retryAfter = Math.ceil((record.windowStart + windowMs - now) / 1000);

      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter,
      });
    }

    // Rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - record.count);
    res.setHeader('X-RateLimit-Reset', Math.ceil((record.windowStart + windowMs) / 1000));

    next();
  };
}

module.exports = {
  requireRole,
  requireMinimumRole,
  requireTenantAccess,
  requireOwnership,
  requirePlanFeature,
  rateLimit,
  ROLE_HIERARCHY,
};
