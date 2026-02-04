/**
 * API Routes - Multi-tenant
 * Dashboard ve admin için REST API endpoint'leri
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');

const { authenticate, requireSuperAdmin, requireTenantAdmin } = require('../middleware/auth');
const { resolveTenant } = require('../middleware/tenantResolver');
const { requireTenantAccess, rateLimit } = require('../middleware/roleGuard');

const supabaseService = require('../services/supabase');
const tenantService = require('../services/tenantService');
const vapiService = require('../services/vapiService');
const useCaseService = require('../services/useCaseService');
const templateService = require('../services/templateService');

// Admin sub-routers
const presetsRouter = require('./admin/presets');
const onboardingAgentRouter = require('./onboardingAgent');

// Supabase client
const supabase = createClient(config.supabase.url, config.supabase.anonKey);
// Admin client for operations that bypass RLS (slot management, etc.)
const supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceRoleKey);

// ==========================================
// PUBLIC ROUTES (No Auth Required)
// ==========================================

/**
 * Get tenant branding by slug
 * GET /api/public/tenant/branding
 * Query params: ?slug=xxx
 */
router.get('/public/tenant/branding', async (req, res) => {
  try {
    const { slug } = req.query;

    if (!slug) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Slug parameter is required',
      });
    }

    const tenant = await tenantService.getTenantBySlug(slug);

    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found',
      });
    }

    // Return only branding-related fields (public data)
    res.json({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      industry: tenant.industry,
      logo_url: tenant.logo_url,
      primary_color: tenant.primary_color,
      favicon_url: tenant.favicon_url,
      login_message: tenant.login_message,
      assistant_name: tenant.assistant_name,
    });
  } catch (error) {
    console.error('[API] Get tenant branding error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get tenant data for onboarding (public - by tenant ID)
 * GET /api/public/onboarding/tenant/:id
 */
router.get('/public/onboarding/tenant/:id', async (req, res) => {
  try {
    const tenant = await tenantService.getTenantById(req.params.id);

    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found',
      });
    }

    // Return tenant data for onboarding (exclude sensitive fields)
    res.json({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      industry: tenant.industry,
      email: tenant.email,
      phone: tenant.phone,
      address: tenant.address,
      logo_url: tenant.logo_url,
      primary_color: tenant.primary_color,
      assistant_name: tenant.assistant_name,
      default_language: tenant.default_language,
      onboarding_step: tenant.onboarding_step,
      is_active: tenant.is_active,
    });
  } catch (error) {
    console.error('[API] Get tenant for onboarding error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// AUTH ROUTES
// ==========================================

/**
 * Login with email/password
 * POST /api/auth/login
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required',
      });
    }

    // Supabase Auth ile giriş yap
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: error.message,
      });
    }

    // Kullanıcı bilgilerini veritabanından al
    const { data: user } = await supabase
      .from('users')
      .select(`*, tenant:tenants(*)`)
      .eq('email', email)
      .single();

    res.json({
      success: true,
      session: data.session,
      user: user,
    });
  } catch (error) {
    console.error('[API] Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Register new user (tenant admin creates)
 * POST /api/auth/register
 */
router.post('/auth/register', authenticate(), requireTenantAdmin, async (req, res) => {
  try {
    const { email, password, name, role = 'tenant_admin' } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required',
      });
    }

    // Only super_admin can create super_admin
    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot create super admin users',
      });
    }

    // Supabase Auth'da kullanıcı oluştur
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return res.status(400).json({
        error: 'Registration failed',
        message: authError.message,
      });
    }

    // DB'de kullanıcı oluştur
    const { data: user, error: dbError } = await supabase
      .from('users')
      .insert({
        auth_user_id: authData.user.id,
        tenant_id: req.user.role === 'super_admin' ? req.body.tenant_id : req.tenantId,
        email,
        name,
        role,
      })
      .select()
      .single();

    if (dbError) {
      // Rollback: Auth user'ı sil
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw dbError;
    }

    res.status(201).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('[API] Register error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Logout
 * POST /api/auth/logout
 */
router.post('/auth/logout', authenticate({ required: false }), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await supabase.auth.admin.signOut(token);
    }

    res.json({ success: true });
  } catch (error) {
    res.json({ success: true }); // Logout always succeeds
  }
});

/**
 * Get current user
 * GET /api/auth/me
 */
router.get('/auth/me', authenticate(), async (req, res) => {
  res.json({
    user: req.user,
    tenant: req.user.tenant,
  });
});

// ==========================================
// TENANT ROUTES (Authenticated)
// ==========================================

/**
 * Get tenant settings
 * GET /api/tenant/settings
 */
router.get('/tenant/settings', authenticate(), resolveTenant(), requireTenantAccess, async (req, res) => {
  try {
    const tenant = await tenantService.getTenantById(req.tenantId);
    res.json(tenant);
  } catch (error) {
    console.error('[API] Get tenant settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update tenant settings
 * PUT /api/tenant/settings
 */
router.put('/tenant/settings', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const allowedFields = [
      'name', 'logo_url', 'primary_color', 'phone', 'email', 'address', 'website',
      'assistant_name', 'welcome_message', 'default_language', 'supported_languages',
      'tts_provider', 'elevenlabs_voice_id',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const tenant = await tenantService.updateTenant(req.tenantId, updates);
    res.json(tenant);
  } catch (error) {
    console.error('[API] Update tenant settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get tenant statistics
 * GET /api/tenant/stats
 */
router.get('/tenant/stats', authenticate(), resolveTenant(), requireTenantAccess, async (req, res) => {
  try {
    const stats = await tenantService.getTenantStats(req.tenantId);
    res.json(stats);
  } catch (error) {
    console.error('[API] Get tenant stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// TENANT VOICE CONFIG ROUTES
// ==========================================

/**
 * Get tenant voice config (preset + override merged)
 * GET /api/tenant/voice-config
 */
router.get('/tenant/voice-config', authenticate(), resolveTenant(), requireTenantAccess, async (req, res) => {
  try {
    const { language = 'tr' } = req.query;
    const config = await vapiService.getTenantVapiConfig(req.tenantId, language);
    res.json(config);
  } catch (error) {
    console.error('[API] Get voice config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update tenant voice config override
 * PUT /api/tenant/voice-config
 */
router.put('/tenant/voice-config', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const allowedFields = [
      'voice_provider', 'voice_id', 'voice_speed',
      'system_prompt', 'first_message',
      'model', 'temperature', 'max_tokens',
    ];

    const overrideConfig = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        overrideConfig[field] = req.body[field];
      }
    }

    const tenant = await vapiService.updateTenantVoiceConfig(req.tenantId, overrideConfig);

    // VAPI'ye sync et (opsiyonel, auto_sync parametresi ile)
    if (req.body.auto_sync) {
      await vapiService.syncTenantToVapi(req.tenantId);
    }

    res.json(tenant);
  } catch (error) {
    console.error('[API] Update voice config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Sync tenant to VAPI
 * POST /api/tenant/voice-config/sync
 */
router.post('/tenant/voice-config/sync', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const results = await vapiService.syncTenantToVapi(req.tenantId);
    res.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('[API] Sync voice config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reset tenant voice config override (use preset defaults)
 * DELETE /api/tenant/voice-config
 */
router.delete('/tenant/voice-config', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .update({ voice_config_override: null })
      .eq('id', req.tenantId)
      .select()
      .single();

    if (error) throw error;

    // VAPI'ye sync et
    if (req.query.sync === 'true') {
      await vapiService.syncTenantToVapi(req.tenantId);
    }

    res.json({
      success: true,
      message: 'Voice config override cleared',
      tenant: data,
    });
  } catch (error) {
    console.error('[API] Reset voice config error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// SUPER ADMIN ROUTES
// ==========================================

/**
 * List all tenants
 * GET /api/admin/tenants
 */
router.get('/admin/tenants', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { industry, region, plan, isActive } = req.query;
    const tenants = await tenantService.getAllTenants({
      industry,
      region,
      plan,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
    res.json(tenants);
  } catch (error) {
    console.error('[API] List tenants error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get single tenant by ID
 * GET /api/admin/tenants/:id
 */
router.get('/admin/tenants/:id', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await tenantService.getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found',
      });
    }
    res.json(tenant);
  } catch (error) {
    console.error('[API] Get tenant error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create new tenant
 * POST /api/admin/tenants
 */
router.post('/admin/tenants', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await tenantService.createTenant(req.body);
    res.status(201).json(tenant);
  } catch (error) {
    console.error('[API] Create tenant error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update tenant
 * PUT /api/admin/tenants/:id
 */
router.put('/admin/tenants/:id', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await tenantService.updateTenant(req.params.id, req.body);
    res.json(tenant);
  } catch (error) {
    console.error('[API] Update tenant error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete tenant
 * DELETE /api/admin/tenants/:id
 */
router.delete('/admin/tenants/:id', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { hard } = req.query;
    const result = await tenantService.deleteTenant(req.params.id, hard === 'true');
    res.json(result);
  } catch (error) {
    console.error('[API] Delete tenant error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Sync tenant to VAPI
 * POST /api/admin/tenants/:id/sync
 */
router.post('/admin/tenants/:id/sync', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await tenantService.getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found',
      });
    }

    const results = await vapiService.syncTenantToVapi(req.params.id);
    res.json({
      success: true,
      message: 'VAPI sync completed',
      results,
    });
  } catch (error) {
    console.error('[API] Sync tenant error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Initiate test call for tenant
 * POST /api/admin/tenants/:id/test-call
 */
router.post('/admin/tenants/:id/test-call', authenticate(), requireSuperAdmin, rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // Max 5 test calls per minute
  keyGenerator: (req) => `test-call:${req.user.id}`,
}), async (req, res) => {
  try {
    const tenant = await tenantService.getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found',
      });
    }

    if (!tenant.phone) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant phone is required',
      });
    }

    // Get the assistant ID for the default language
    const lang = tenant.default_language || 'tr';
    const assistantId = tenant[`vapi_assistant_id_${lang}`];

    if (!assistantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'VAPI assistant not configured. Please sync first.',
      });
    }

    // Initiate call via VAPI
    const call = await vapiService.initiateOutboundCall(assistantId, tenant.phone);

    res.json({
      success: true,
      message: 'Test call initiated',
      call,
    });
  } catch (error) {
    console.error('[API] Test call error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Use the presets sub-router for all /admin/presets routes
router.use('/admin/presets', authenticate(), requireSuperAdmin, presetsRouter);

// Use the onboarding agent sub-router for AI-powered tenant creation
router.use('/admin/onboarding-agent', authenticate(), requireSuperAdmin, onboardingAgentRouter);

// ==========================================
// USE CASE ROUTES
// ==========================================

/**
 * Get all use cases (public - for onboarding)
 * GET /api/public/use-cases
 */
router.get('/public/use-cases', async (req, res) => {
  try {
    const { industry, category } = req.query;
    const useCases = await useCaseService.getUseCases({
      industry,
      category,
    });
    res.json(useCases);
  } catch (error) {
    console.error('[API] Get use cases error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get default use cases for an industry (public - for onboarding)
 * GET /api/public/use-cases/defaults/:industry
 */
router.get('/public/use-cases/defaults/:industry', async (req, res) => {
  try {
    const useCases = await useCaseService.getDefaultUseCasesForIndustry(req.params.industry);
    res.json(useCases);
  } catch (error) {
    console.error('[API] Get default use cases error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get tenant's active use cases
 * GET /api/tenant/use-cases
 */
router.get('/tenant/use-cases', authenticate(), resolveTenant(), requireTenantAccess, async (req, res) => {
  try {
    const useCases = await useCaseService.getTenantUseCases(req.tenantId);
    res.json(useCases);
  } catch (error) {
    console.error('[API] Get tenant use cases error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all use cases with tenant's selection status
 * GET /api/tenant/use-cases/available
 */
router.get('/tenant/use-cases/available', authenticate(), resolveTenant(), requireTenantAccess, async (req, res) => {
  try {
    // Tenant bilgisini al
    const tenant = await tenantService.getTenantById(req.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Tüm mevcut use case'leri al (industry'ye göre)
    const allUseCases = await useCaseService.getUseCases({ industry: tenant.industry });

    // Tenant'ın mevcut seçimlerini al
    const tenantRelations = await useCaseService.getTenantUseCaseRelations(req.tenantId);
    const relationMap = new Map(tenantRelations.map(r => [r.use_case_id, r.enabled]));

    // Her use case'e enabled durumunu ekle
    const useCasesWithStatus = allUseCases.map(uc => ({
      ...uc,
      enabled: relationMap.has(uc.id) ? relationMap.get(uc.id) : false,
    }));

    res.json(useCasesWithStatus);
  } catch (error) {
    console.error('[API] Get available use cases error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Set tenant's use cases
 * PUT /api/tenant/use-cases
 */
router.put('/tenant/use-cases', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const { useCaseIds } = req.body;

    if (!Array.isArray(useCaseIds)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'useCaseIds must be an array',
      });
    }

    const result = await useCaseService.setTenantUseCases(req.tenantId, useCaseIds);

    // VAPI'ye sync et (opsiyonel)
    if (req.body.autoSync) {
      await vapiService.syncTenantToVapi(req.tenantId);
    }

    res.json(result);
  } catch (error) {
    console.error('[API] Set tenant use cases error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Toggle single use case for tenant
 * PATCH /api/tenant/use-cases/:useCaseId
 */
router.patch('/tenant/use-cases/:useCaseId', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'enabled must be a boolean',
      });
    }

    const result = await useCaseService.toggleTenantUseCase(req.tenantId, req.params.useCaseId, enabled);

    // VAPI'ye sync et (opsiyonel)
    if (req.body.autoSync) {
      await vapiService.syncTenantToVapi(req.tenantId);
    }

    res.json(result);
  } catch (error) {
    console.error('[API] Toggle use case error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get tenant's active tools (based on use cases)
 * GET /api/tenant/tools
 */
router.get('/tenant/tools', authenticate(), resolveTenant(), requireTenantAccess, async (req, res) => {
  try {
    const tools = await useCaseService.getVapiToolsForTenant(req.tenantId);
    res.json(tools);
  } catch (error) {
    console.error('[API] Get tenant tools error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// ADMIN USE CASE ROUTES
// ==========================================

/**
 * List all use cases (admin)
 * GET /api/admin/use-cases
 */
router.get('/admin/use-cases', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { category } = req.query;
    const useCases = await useCaseService.getUseCases({ category });
    res.json(useCases);
  } catch (error) {
    console.error('[API] Admin get use cases error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get single use case (admin)
 * GET /api/admin/use-cases/:id
 */
router.get('/admin/use-cases/:id', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const useCase = await useCaseService.getUseCaseById(req.params.id);
    if (!useCase) {
      return res.status(404).json({ error: 'Use case not found' });
    }
    res.json(useCase);
  } catch (error) {
    console.error('[API] Admin get use case error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create use case (admin)
 * POST /api/admin/use-cases
 */
router.post('/admin/use-cases', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const useCase = await useCaseService.createUseCase(req.body);
    res.status(201).json(useCase);
  } catch (error) {
    console.error('[API] Admin create use case error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update use case (admin)
 * PUT /api/admin/use-cases/:id
 */
router.put('/admin/use-cases/:id', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const useCase = await useCaseService.updateUseCase(req.params.id, req.body);
    res.json(useCase);
  } catch (error) {
    console.error('[API] Admin update use case error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete use case (admin)
 * DELETE /api/admin/use-cases/:id
 */
router.delete('/admin/use-cases/:id', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const result = await useCaseService.deleteUseCase(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('[API] Admin delete use case error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all available tools (admin - for assigning to use cases)
 * GET /api/admin/tools
 */
router.get('/admin/tools', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const tools = useCaseService.getAllAvailableTools();
    res.json(tools);
  } catch (error) {
    console.error('[API] Admin get tools error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// TEMPLATE ROUTES (Admin)
// ==========================================

/**
 * Get all templates
 * GET /api/admin/templates
 */
router.get('/admin/templates', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { industry, tier, isActive } = req.query;
    const templates = await templateService.getTemplates({
      industry,
      tier,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
    res.json(templates);
  } catch (error) {
    console.error('[API] Get templates error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get single template
 * GET /api/admin/templates/:id
 */
router.get('/admin/templates/:id', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const template = await templateService.getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    console.error('[API] Get template error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create template
 * POST /api/admin/templates
 */
router.post('/admin/templates', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const template = await templateService.createTemplate(req.body);
    res.status(201).json(template);
  } catch (error) {
    console.error('[API] Create template error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update template
 * PUT /api/admin/templates/:id
 */
router.put('/admin/templates/:id', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const template = await templateService.updateTemplate(req.params.id, req.body);
    res.json(template);
  } catch (error) {
    console.error('[API] Update template error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete template
 * DELETE /api/admin/templates/:id
 */
router.delete('/admin/templates/:id', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const result = await templateService.deleteTemplate(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('[API] Delete template error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get tenant's template (Admin)
 * GET /api/admin/tenants/:id/template
 */
router.get('/admin/tenants/:id/template', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const tenantTemplate = await templateService.getTenantTemplate(req.params.id);
    res.json(tenantTemplate || { template: null, effectiveUseCases: [] });
  } catch (error) {
    console.error('[API] Get tenant template error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Assign template to tenant (Admin)
 * POST /api/admin/tenants/:id/template
 */
router.post('/admin/tenants/:id/template', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { templateId, autoSync = false } = req.body;

    if (!templateId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'templateId is required',
      });
    }

    const tenant = await tenantService.getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const result = await templateService.selectTemplate(req.params.id, templateId);

    // Optionally sync to VAPI
    if (autoSync) {
      await vapiService.syncTenantToVapi(req.params.id);
    }

    res.json({
      success: true,
      ...result,
      synced: autoSync,
    });
  } catch (error) {
    console.error('[API] Assign template error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// TEMPLATE ROUTES (Tenant)
// ==========================================

/**
 * Get own template
 * GET /api/tenant/template
 */
router.get('/tenant/template', authenticate(), resolveTenant(), requireTenantAccess, async (req, res) => {
  try {
    const tenantTemplate = await templateService.getTenantTemplate(req.tenantId);
    res.json(tenantTemplate || { template: null, effectiveUseCases: [] });
  } catch (error) {
    console.error('[API] Get tenant template error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Customize template (add/remove use cases)
 * PATCH /api/tenant/template/customize
 */
router.patch('/tenant/template/customize', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const { addUseCases, removeUseCases, autoSync = false } = req.body;

    const result = await templateService.customizeTemplate(req.tenantId, {
      addUseCases: addUseCases || [],
      removeUseCases: removeUseCases || [],
    });

    // Optionally sync to VAPI
    if (autoSync) {
      await vapiService.syncTenantToVapi(req.tenantId);
    }

    res.json({
      success: true,
      ...result,
      synced: autoSync,
    });
  } catch (error) {
    console.error('[API] Customize template error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get available templates for tenant's industry
 * GET /api/tenant/templates/available
 */
router.get('/tenant/templates/available', authenticate(), resolveTenant(), requireTenantAccess, async (req, res) => {
  try {
    const tenant = await tenantService.getTenantById(req.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const templates = await templateService.getTemplates({
      industry: tenant.industry,
      isActive: true,
    });

    res.json(templates);
  } catch (error) {
    console.error('[API] Get available templates error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Setup default use cases for a tenant (admin)
 * POST /api/admin/tenants/:id/setup-use-cases
 */
router.post('/admin/tenants/:id/setup-use-cases', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await tenantService.getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const useCases = await useCaseService.setupDefaultUseCases(req.params.id, tenant.industry);

    res.json({
      success: true,
      message: `Setup ${useCases.length} default use cases`,
      useCases,
    });
  } catch (error) {
    console.error('[API] Admin setup use cases error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// ADMIN SLOT MANAGEMENT ROUTES
// ==========================================

/**
 * Get slots for a specific date
 * GET /api/admin/tenants/:id/slots?date=YYYY-MM-DD
 */
router.get('/admin/tenants/:id/slots', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    const tenantId = req.params.id;

    if (!date) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Date parameter is required (YYYY-MM-DD)',
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    // Get tenant to check working hours for default slot generation
    const tenant = await tenantService.getTenantById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found',
      });
    }

    // Try to get existing slots for the date (table might not exist yet)
    let existingSlots = [];
    try {
      const { data, error } = await supabaseAdmin
        .from('appointment_slots')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('slot_date', date)
        .order('slot_time', { ascending: true });

      if (!error && data && data.length > 0) {
        return res.json(data);
      }
      existingSlots = data || [];
    } catch (dbError) {
      // Table might not exist, continue with default slots
      console.log('[API] appointment_slots table may not exist, generating defaults');
    }

    // Generate default slots based on working hours or defaults
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const workingHours = tenant.working_hours || {};
    const dayHours = workingHours[dayOfWeek];

    // Default working hours if not defined
    const defaultWorkingHours = {
      monday: { open: '09:00', close: '18:00', closed: false },
      tuesday: { open: '09:00', close: '18:00', closed: false },
      wednesday: { open: '09:00', close: '18:00', closed: false },
      thursday: { open: '09:00', close: '18:00', closed: false },
      friday: { open: '09:00', close: '18:00', closed: false },
      saturday: { open: '10:00', close: '16:00', closed: false },
      sunday: { open: '00:00', close: '00:00', closed: true },
    };

    // Use tenant's hours or defaults
    const effectiveHours = dayHours || defaultWorkingHours[dayOfWeek];

    // If day is explicitly closed, return empty
    if (effectiveHours && effectiveHours.closed) {
      return res.json([]);
    }

    // Generate default slots (hourly intervals)
    const defaultSlots = [];
    const openTime = effectiveHours?.open || '09:00';
    const closeTime = effectiveHours?.close || '18:00';

    const [openHour] = openTime.split(':').map(Number);
    const [closeHour] = closeTime.split(':').map(Number);

    for (let hour = openHour; hour < closeHour; hour++) {
      const slotTime = `${hour.toString().padStart(2, '0')}:00`;
      defaultSlots.push({
        id: `default-${date}-${slotTime}`,
        tenant_id: tenantId,
        slot_date: date,
        slot_time: slotTime,
        is_available: true,
        is_default: true, // Mark as not yet saved to DB
      });
    }

    res.json(defaultSlots);
  } catch (error) {
    console.error('[API] Get slots error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update a single slot
 * PUT /api/admin/tenants/:id/slots/:slotId
 */
router.put('/admin/tenants/:id/slots/:slotId', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { id: tenantId, slotId } = req.params;
    const { is_available } = req.body;

    if (typeof is_available !== 'boolean') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'is_available must be a boolean',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('appointment_slots')
      .update({ is_available, updated_at: new Date().toISOString() })
      .eq('id', slotId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('[API] Update slot error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Bulk create/update slots
 * POST /api/admin/tenants/:id/slots/bulk
 */
router.post('/admin/tenants/:id/slots/bulk', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = req.params.id;
    const { slots } = req.body;

    if (!Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'slots must be a non-empty array',
      });
    }

    // Validate tenant exists
    const tenant = await tenantService.getTenantById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found',
      });
    }

    // Get the date from first slot
    const slotDate = slots[0].slot_date;

    // Delete existing slots for this date
    await supabaseAdmin
      .from('appointment_slots')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('slot_date', slotDate);

    // Prepare slots for insertion
    const slotsToInsert = slots.map(slot => ({
      tenant_id: tenantId,
      slot_date: slot.slot_date,
      slot_time: slot.slot_time,
      is_available: slot.is_available,
    }));

    // Insert new slots
    const { data, error } = await supabaseAdmin
      .from('appointment_slots')
      .insert(slotsToInsert)
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: `${data.length} slots saved`,
      slots: data,
    });
  } catch (error) {
    console.error('[API] Bulk slots error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate slots for a date range
 * POST /api/admin/tenants/:id/slots/generate
 */
router.post('/admin/tenants/:id/slots/generate', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = req.params.id;
    const { days = 7 } = req.body; // Default: 7 days

    // Validate days (max 60 days)
    const numDays = Math.min(Math.max(1, parseInt(days) || 7), 60);

    // Get tenant for working hours
    const tenant = await tenantService.getTenantById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const workingHours = tenant.working_hours || {};
    const defaultWorkingHours = {
      monday: { open: '09:00', close: '18:00', closed: false },
      tuesday: { open: '09:00', close: '18:00', closed: false },
      wednesday: { open: '09:00', close: '18:00', closed: false },
      thursday: { open: '09:00', close: '18:00', closed: false },
      friday: { open: '09:00', close: '18:00', closed: false },
      saturday: { open: '10:00', close: '16:00', closed: false },
      sunday: { open: '00:00', close: '00:00', closed: true },
    };

    const allSlots = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < numDays; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

      const dayHours = workingHours[dayOfWeek] || defaultWorkingHours[dayOfWeek];

      // Skip closed days
      if (dayHours?.closed) continue;

      const openTime = dayHours?.open || '09:00';
      const closeTime = dayHours?.close || '18:00';

      const [openHour] = openTime.split(':').map(Number);
      const [closeHour] = closeTime.split(':').map(Number);

      for (let hour = openHour; hour < closeHour; hour++) {
        const slotTime = `${hour.toString().padStart(2, '0')}:00`;
        allSlots.push({
          tenant_id: tenantId,
          slot_date: dateStr,
          slot_time: slotTime,
          is_available: true,
        });
      }
    }

    if (allSlots.length === 0) {
      return res.json({
        success: true,
        message: 'No slots to generate (all days closed)',
        count: 0,
      });
    }

    // Get unique dates
    const dates = [...new Set(allSlots.map(s => s.slot_date))];

    // Delete existing slots for these dates
    for (const dateStr of dates) {
      await supabaseAdmin
        .from('appointment_slots')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('slot_date', dateStr);
    }

    // Insert all slots in batches
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < allSlots.length; i += batchSize) {
      const batch = allSlots.slice(i, i + batchSize);
      const { data, error } = await supabaseAdmin
        .from('appointment_slots')
        .insert(batch)
        .select();

      if (error) throw error;
      inserted += data.length;
    }

    res.json({
      success: true,
      message: `${inserted} slots generated for ${dates.length} days`,
      count: inserted,
      days: dates.length,
    });
  } catch (error) {
    console.error('[API] Generate slots error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get tenant's use cases (admin)
 * GET /api/admin/tenants/:id/use-cases
 */
router.get('/admin/tenants/:id/use-cases', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await tenantService.getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Tenant'ın mevcut use case ilişkilerini getir
    const tenantUseCases = await useCaseService.getTenantUseCases(req.params.id);

    // Sektöre göre mevcut tüm use case'leri getir
    const availableUseCases = await useCaseService.getUseCases({ industry: tenant.industry });

    // Aktif use case ID'lerini çıkar
    const enabledIds = tenantUseCases.map(uc => uc.id);

    res.json({
      available: availableUseCases,
      enabled: enabledIds,
      tenantUseCases,
    });
  } catch (error) {
    console.error('[API] Admin get tenant use cases error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Set tenant's use cases (admin)
 * PUT /api/admin/tenants/:id/use-cases
 */
router.put('/admin/tenants/:id/use-cases', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { useCaseIds, autoSync = false } = req.body;

    if (!Array.isArray(useCaseIds)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'useCaseIds must be an array',
      });
    }

    const tenant = await tenantService.getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Use case'leri kaydet
    const result = await useCaseService.setTenantUseCases(req.params.id, useCaseIds);

    // Opsiyonel VAPI sync
    if (autoSync) {
      await vapiService.syncTenantToVapi(req.params.id);
    }

    res.json({
      success: true,
      message: `Updated ${result.activeUseCases.length} use cases`,
      ...result,
      synced: autoSync,
    });
  } catch (error) {
    console.error('[API] Admin set tenant use cases error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// TENANT DATA ROUTES (All require tenant resolution)
// ==========================================

// Apply tenant resolution and access check to all routes below
router.use(authenticate({ required: false }));
router.use(resolveTenant({ required: false }));

/**
 * Test Sürüşü Randevuları
 * GET /api/test-drives
 */
router.get('/test-drives', async (req, res) => {
  try {
    if (!req.tenantId) {
      // Legacy: tenant olmadan tüm verileri getir
      const { data, error } = await supabase
        .from('test_drive_appointments')
        .select(`*, customer:customers(*), vehicle:vehicles(*)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json(data || []);
    }

    const data = await supabaseService.getTestDriveAppointments(req.tenantId);
    res.json(data);
  } catch (error) {
    console.error('[API] Test drives fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test Sürüşü Durumu Güncelle
 * PATCH /api/test-drives/:id
 */
router.patch('/test-drives/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!req.tenantId) {
      const { data, error } = await supabase
        .from('test_drive_appointments')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.json(data);
    }

    const data = await supabaseService.updateTestDriveStatus(req.tenantId, id, status);
    res.json(data);
  } catch (error) {
    console.error('[API] Test drive update error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Servis Randevuları
 * GET /api/services
 */
router.get('/services', async (req, res) => {
  try {
    if (!req.tenantId) {
      const { data, error } = await supabase
        .from('service_appointments')
        .select(`*, customer:customers(*)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json(data || []);
    }

    const data = await supabaseService.getServiceAppointments(req.tenantId);
    res.json(data);
  } catch (error) {
    console.error('[API] Services fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Servis Durumu Güncelle
 * PATCH /api/services/:id
 */
router.patch('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!req.tenantId) {
      const { data, error } = await supabase
        .from('service_appointments')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.json(data);
    }

    const data = await supabaseService.updateServiceStatus(req.tenantId, id, status);
    res.json(data);
  } catch (error) {
    console.error('[API] Service update error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Müşteriler
 * GET /api/customers
 */
router.get('/customers', async (req, res) => {
  try {
    if (!req.tenantId) {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json(data || []);
    }

    const data = await supabaseService.getAllCustomers(req.tenantId);
    res.json(data);
  } catch (error) {
    console.error('[API] Customers fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Araçlar
 * GET /api/vehicles
 */
router.get('/vehicles', async (req, res) => {
  try {
    // Admin için query param'dan, normal kullanıcı için req.tenantId'den al
    const tenantId = req.query.tenant_id || req.tenantId;

    let data, error;

    if (!tenantId) {
      // Hiç tenant_id yoksa tüm araçları getir (sadece super_admin için)
      const result = await supabase
        .from('vehicles')
        .select('*')
        .order('brand', { ascending: true });
      data = result.data;
      error = result.error;
    } else {
      // Belirli tenant'ın araçlarını getir
      const result = await supabase
        .from('vehicles')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('brand', { ascending: true });
      data = result.data;
      error = result.error;
    }

    if (error) throw error;

    // Frontend uyumluluğu için available_for_test_drive -> is_available
    const vehicles = (data || []).map(v => ({
      ...v,
      is_available: v.available_for_test_drive,
    }));

    res.json(vehicles);
  } catch (error) {
    console.error('[API] Vehicles fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Araç Oluştur
 * POST /api/vehicles
 */
router.post('/vehicles', async (req, res) => {
  try {
    // Admin için body'den tenant_id alınabilir, normal kullanıcı için req.tenantId
    const tenantId = req.body.tenant_id || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { brand, model, year, price, color, fuel_type, transmission, is_available } = req.body;

    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        tenant_id: tenantId,
        brand,
        model,
        year,
        price,
        color,
        fuel_type,
        transmission,
        available_for_test_drive: is_available !== false,
      })
      .select()
      .single();

    if (error) throw error;
    // Frontend uyumluluğu için is_available olarak dönder
    res.status(201).json({ ...data, is_available: data.available_for_test_drive });
  } catch (error) {
    console.error('[API] Vehicle create error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Araç Güncelle
 * PUT /api/vehicles/:id
 */
router.put('/vehicles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.body.tenant_id || req.tenantId;
    const { brand, model, year, price, color, fuel_type, transmission, is_available } = req.body;

    let query = supabase
      .from('vehicles')
      .update({
        brand,
        model,
        year,
        price,
        color,
        fuel_type,
        transmission,
        available_for_test_drive: is_available,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query.select().single();

    if (error) throw error;
    res.json({ ...data, is_available: data.available_for_test_drive });
  } catch (error) {
    console.error('[API] Vehicle update error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Araç Sil
 * DELETE /api/vehicles/:id
 */
router.delete('/vehicles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    let query = supabase.from('vehicles').delete().eq('id', id);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { error } = await query;

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Vehicle delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Arama Geçmişi
 * GET /api/call-logs
 */
router.get('/call-logs', async (req, res) => {
  try {
    if (!req.tenantId) {
      const { data, error } = await supabase
        .from('call_logs')
        .select(`*, customer:customers(name, phone)`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return res.json(data || []);
    }

    const data = await supabaseService.getCallLogs(req.tenantId, 50);
    res.json(data);
  } catch (error) {
    console.error('[API] Call logs fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// BEAUTY ROUTES
// ==========================================

/**
 * Güzellik Hizmetleri
 * GET /api/beauty/services
 */
router.get('/beauty/services', authenticate(), resolveTenant(), async (req, res) => {
  try {
    const { category } = req.query;
    const data = await supabaseService.getBeautyServices(req.tenantId, { category });
    res.json(data);
  } catch (error) {
    console.error('[API] Beauty services fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Güzellik Hizmeti Ekle
 * POST /api/beauty/services
 */
router.post('/beauty/services', authenticate(), resolveTenant(), requireTenantAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('beauty_services')
      .insert({
        tenant_id: req.tenantId,
        ...req.body,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('[API] Create beauty service error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Güzellik Hizmeti Güncelle
 * PUT /api/beauty/services/:id
 */
router.put('/beauty/services/:id', authenticate(), resolveTenant(), requireTenantAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('beauty_services')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('tenant_id', req.tenantId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[API] Update beauty service error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Güzellik Hizmeti Sil (Soft Delete)
 * DELETE /api/beauty/services/:id
 * Not: Randevular korunması için soft delete kullanılır
 */
router.delete('/beauty/services/:id', authenticate(), resolveTenant(), requireTenantAdmin, async (req, res) => {
  try {
    // Soft delete: deleted_at set edilir, is_active false yapılır
    const { data, error } = await supabase
      .from('beauty_services')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('tenant_id', req.tenantId)
      .is('deleted_at', null) // Zaten silinmemişse
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Service not found or already deleted' });
    }

    res.json({ success: true, softDeleted: true });
  } catch (error) {
    console.error('[API] Delete beauty service error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Güzellik Randevuları
 * GET /api/beauty/appointments
 */
router.get('/beauty/appointments', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant ID required',
      });
    }

    const data = await supabaseService.getBeautyAppointments(req.tenantId);
    res.json(data);
  } catch (error) {
    console.error('[API] Beauty appointments fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Güzellik Randevusu Oluştur
 * POST /api/beauty/appointments
 */
router.post('/beauty/appointments', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant ID required',
      });
    }

    const { customer_id, service_id, appointment_date, appointment_time, notes } = req.body;

    const data = await supabaseService.createBeautyAppointment(
      req.tenantId,
      customer_id,
      service_id,
      appointment_date,
      appointment_time,
      notes
    );

    res.status(201).json(data);
  } catch (error) {
    console.error('[API] Create beauty appointment error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Güzellik Randevusu Durumu Güncelle
 * PATCH /api/beauty/appointments/:id
 */
router.patch('/beauty/appointments/:id', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant ID required',
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    const data = await supabaseService.updateBeautyStatus(req.tenantId, id, status);
    res.json(data);
  } catch (error) {
    console.error('[API] Update beauty appointment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// ADMIN APPOINTMENTS ROUTES
// ==========================================

/**
 * Get all appointments for a tenant (unified view)
 * GET /api/admin/tenants/:id/appointments
 */
router.get('/admin/tenants/:id/appointments', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = req.params.id;
    const { type, status, startDate, endDate } = req.query;

    // Get tenant to check industry
    const tenant = await tenantService.getTenantById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const appointments = [];

    // Fetch beauty appointments
    try {
      let beautyQuery = supabaseAdmin
        .from('beauty_appointments')
        .select(`*, customer:customers(*), service:beauty_services(*)`)
        .eq('tenant_id', tenantId)
        .order('appointment_date', { ascending: false });

      if (status) beautyQuery = beautyQuery.eq('status', status);
      if (startDate) beautyQuery = beautyQuery.gte('appointment_date', startDate);
      if (endDate) beautyQuery = beautyQuery.lte('appointment_date', endDate);

      const { data: beautyData } = await beautyQuery;
      if (beautyData && (!type || type === 'beauty')) {
        appointments.push(...beautyData.map(a => ({ ...a, appointment_type: 'beauty' })));
      }
    } catch (e) {
      console.log('[API] beauty_appointments table may not exist');
    }

    // Fetch test drive appointments
    try {
      let testDriveQuery = supabaseAdmin
        .from('test_drive_appointments')
        .select(`*, customer:customers(*), vehicle:vehicles(*)`)
        .eq('tenant_id', tenantId)
        .order('appointment_date', { ascending: false });

      if (status) testDriveQuery = testDriveQuery.eq('status', status);
      if (startDate) testDriveQuery = testDriveQuery.gte('appointment_date', startDate);
      if (endDate) testDriveQuery = testDriveQuery.lte('appointment_date', endDate);

      const { data: testDriveData } = await testDriveQuery;
      if (testDriveData && (!type || type === 'test_drive')) {
        appointments.push(...testDriveData.map(a => ({ ...a, appointment_type: 'test_drive' })));
      }
    } catch (e) {
      console.log('[API] test_drive_appointments table may not exist');
    }

    // Fetch service appointments
    try {
      let serviceQuery = supabaseAdmin
        .from('service_appointments')
        .select(`*, customer:customers(*)`)
        .eq('tenant_id', tenantId)
        .order('appointment_date', { ascending: false });

      if (status) serviceQuery = serviceQuery.eq('status', status);
      if (startDate) serviceQuery = serviceQuery.gte('appointment_date', startDate);
      if (endDate) serviceQuery = serviceQuery.lte('appointment_date', endDate);

      const { data: serviceData } = await serviceQuery;
      if (serviceData && (!type || type === 'service')) {
        appointments.push(...serviceData.map(a => ({ ...a, appointment_type: 'service' })));
      }
    } catch (e) {
      console.log('[API] service_appointments table may not exist');
    }

    // Sort all appointments by date
    appointments.sort((a, b) => {
      const dateA = new Date(a.appointment_date + ' ' + (a.appointment_time || '00:00'));
      const dateB = new Date(b.appointment_date + ' ' + (b.appointment_time || '00:00'));
      return dateB - dateA;
    });

    res.json(appointments);
  } catch (error) {
    console.error('[API] Get appointments error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update appointment status
 * PUT /api/admin/tenants/:id/appointments/:aid
 */
router.put('/admin/tenants/:id/appointments/:aid', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { id: tenantId, aid: appointmentId } = req.params;
    const { status, appointment_type } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Determine which table to update based on appointment_type
    let tableName = 'beauty_appointments';
    if (appointment_type === 'test_drive') {
      tableName = 'test_drive_appointments';
    } else if (appointment_type === 'service') {
      tableName = 'service_appointments';
    }

    const { data, error } = await supabaseAdmin
      .from(tableName)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({ ...data, appointment_type });
  } catch (error) {
    console.error('[API] Update appointment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// ADMIN CUSTOMERS ROUTES
// ==========================================

/**
 * Get all customers for a tenant
 * GET /api/admin/tenants/:id/customers
 */
router.get('/admin/tenants/:id/customers', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = req.params.id;
    const { search } = req.query;

    let query = supabaseAdmin
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Enrich with appointment counts
    const customersWithStats = await Promise.all((data || []).map(async (customer) => {
      let totalAppointments = 0;
      let lastAppointmentDate = null;

      // Count beauty appointments
      try {
        const { count: beautyCount, data: beautyData } = await supabaseAdmin
          .from('beauty_appointments')
          .select('id, appointment_date', { count: 'exact' })
          .eq('customer_id', customer.id)
          .order('appointment_date', { ascending: false })
          .limit(1);
        totalAppointments += beautyCount || 0;
        if (beautyData && beautyData[0]) {
          lastAppointmentDate = beautyData[0].appointment_date;
        }
      } catch (e) { /* table may not exist */ }

      // Count test drive appointments
      try {
        const { count: testDriveCount, data: testDriveData } = await supabaseAdmin
          .from('test_drive_appointments')
          .select('id, appointment_date', { count: 'exact' })
          .eq('customer_id', customer.id)
          .order('appointment_date', { ascending: false })
          .limit(1);
        totalAppointments += testDriveCount || 0;
        if (testDriveData && testDriveData[0]) {
          if (!lastAppointmentDate || testDriveData[0].appointment_date > lastAppointmentDate) {
            lastAppointmentDate = testDriveData[0].appointment_date;
          }
        }
      } catch (e) { /* table may not exist */ }

      // Count service appointments
      try {
        const { count: serviceCount, data: serviceData } = await supabaseAdmin
          .from('service_appointments')
          .select('id, appointment_date', { count: 'exact' })
          .eq('customer_id', customer.id)
          .order('appointment_date', { ascending: false })
          .limit(1);
        totalAppointments += serviceCount || 0;
        if (serviceData && serviceData[0]) {
          if (!lastAppointmentDate || serviceData[0].appointment_date > lastAppointmentDate) {
            lastAppointmentDate = serviceData[0].appointment_date;
          }
        }
      } catch (e) { /* table may not exist */ }

      return {
        ...customer,
        total_appointments: totalAppointments,
        last_appointment_date: lastAppointmentDate,
      };
    }));

    res.json(customersWithStats);
  } catch (error) {
    console.error('[API] Get customers error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// ADMIN FEEDBACK ROUTES
// ==========================================

/**
 * Get all feedback for a tenant
 * GET /api/admin/tenants/:id/feedback
 */
router.get('/admin/tenants/:id/feedback', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = req.params.id;
    const { type, status } = req.query;

    let query = supabase
      .from('feedback')
      .select(`*, customer:customers(name, phone, email)`)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === '42P01') {
        return res.json([]);
      }
      throw error;
    }

    res.json(data || []);
  } catch (error) {
    console.error('[API] Get feedback error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update feedback status
 * PUT /api/admin/tenants/:id/feedback/:fid
 */
router.put('/admin/tenants/:id/feedback/:fid', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { id: tenantId, fid: feedbackId } = req.params;
    const { status, admin_notes } = req.body;

    const updateData = { updated_at: new Date().toISOString() };
    if (status) updateData.status = status;
    if (admin_notes !== undefined) updateData.admin_notes = admin_notes;

    const { data, error } = await supabase
      .from('feedback')
      .update(updateData)
      .eq('id', feedbackId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('[API] Update feedback error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PROMPT TEMPLATES ROUTES
// ==========================================

/**
 * Get tenant's prompt templates
 * GET /api/prompts
 */
router.get('/prompts', authenticate(), resolveTenant(), requireTenantAccess, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('tenant_id', req.tenantId)
      .order('language');

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('[API] Get prompts error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create/update prompt template
 * POST /api/prompts
 */
router.post('/prompts', authenticate(), resolveTenant(), requireTenantAdmin, async (req, res) => {
  try {
    const { id, ...promptData } = req.body;

    if (id) {
      // Update existing
      const { data, error } = await supabase
        .from('prompt_templates')
        .update(promptData)
        .eq('id', id)
        .eq('tenant_id', req.tenantId)
        .select()
        .single();

      if (error) throw error;
      return res.json(data);
    }

    // Create new
    const { data, error } = await supabase
      .from('prompt_templates')
      .insert({
        tenant_id: req.tenantId,
        ...promptData,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('[API] Save prompt error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
