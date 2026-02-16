/**
 * API Routes - Multi-tenant
 * Dashboard ve admin için REST API endpoint'leri
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');

// Multer config for tenant asset upload (logo, favicon)
const assetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
    const allowedExts = ['.png', '.jpg', '.jpeg', '.svg', '.ico'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPG, SVG, and ICO files are allowed'));
    }
  },
});

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

    // Kullanıcı bilgilerini veritabanından al (login sonrası, admin client gerekli)
    const { data: user } = await supabaseAdmin
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

    // DB'de kullanıcı oluştur (admin işlemi, RLS bypass gerekli)
    const { data: user, error: dbError } = await supabaseAdmin
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

/**
 * Change password
 * PUT /api/auth/change-password
 */
router.put('/auth/change-password', authenticate(), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'New password must be at least 6 characters',
      });
    }

    // Verify current password by attempting sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: req.user.email,
      password: currentPassword,
    });

    if (signInError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Current password is incorrect',
      });
    }

    // Update password via admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      req.user.auth_user_id,
      { password: newPassword }
    );

    if (updateError) {
      throw updateError;
    }

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('[API] Change password error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Change email
 * PUT /api/auth/change-email
 */
router.put('/auth/change-email', authenticate(), async (req, res) => {
  try {
    const { password, newEmail } = req.body;

    if (!password || !newEmail) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password and new email are required',
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid email format',
      });
    }

    // Verify password by attempting sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: req.user.email,
      password,
    });

    if (signInError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Password is incorrect',
      });
    }

    // Update email in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      req.user.auth_user_id,
      { email: newEmail }
    );

    if (updateError) {
      throw updateError;
    }

    // Update email in users table
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({ email: newEmail })
      .eq('id', req.user.id);

    if (dbError) {
      console.error('[API] Failed to update email in users table:', dbError);
    }

    res.json({ success: true, message: 'Email changed successfully' });
  } catch (error) {
    console.error('[API] Change email error:', error);
    res.status(500).json({ error: error.message });
  }
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
    const client = req.token ? supabaseService.createAuthClient(req.token) : supabaseAdmin;
    const { data, error } = await client
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
// TENANT SLOT MANAGEMENT ROUTES
// ==========================================

/**
 * Get slots for a specific date (tenant)
 * GET /api/tenant/slots?date=YYYY-MM-DD
 */
router.get('/tenant/slots', authenticate(), resolveTenant(), requireTenantAccess, async (req, res) => {
  try {
    const { date } = req.query;
    const tenantId = req.tenantId;

    if (!date) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Date parameter is required (YYYY-MM-DD)',
      });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    const tenant = await tenantService.getTenantById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Not Found', message: 'Tenant not found' });
    }

    // Try to get existing slots
    const { data, error } = await supabaseAdmin
      .from('appointment_slots')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('slot_date', date)
      .order('slot_time', { ascending: true });

    if (!error && data && data.length > 0) {
      return res.json(data);
    }

    // Generate default slots based on working hours
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const workingHours = tenant.working_hours || {};
    const defaultWH = {
      monday: { open: '09:00', close: '18:00', closed: false },
      tuesday: { open: '09:00', close: '18:00', closed: false },
      wednesday: { open: '09:00', close: '18:00', closed: false },
      thursday: { open: '09:00', close: '18:00', closed: false },
      friday: { open: '09:00', close: '18:00', closed: false },
      saturday: { open: '10:00', close: '16:00', closed: false },
      sunday: { open: '00:00', close: '00:00', closed: true },
    };

    const effectiveHours = workingHours[dayOfWeek] || defaultWH[dayOfWeek];
    if (effectiveHours && effectiveHours.closed) {
      return res.json([]);
    }

    const openTime = effectiveHours?.open || '09:00';
    const closeTime = effectiveHours?.close || '18:00';
    const [openHour] = openTime.split(':').map(Number);
    const [closeHour] = closeTime.split(':').map(Number);

    const defaultSlots = [];
    for (let hour = openHour; hour < closeHour; hour++) {
      const slotTime = `${hour.toString().padStart(2, '0')}:00`;
      defaultSlots.push({
        id: `default-${date}-${slotTime}`,
        tenant_id: tenantId,
        slot_date: date,
        slot_time: slotTime,
        is_available: true,
        is_default: true,
      });
    }

    res.json(defaultSlots);
  } catch (error) {
    console.error('[API] Tenant get slots error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get slot summary for a month (tenant)
 * GET /api/tenant/slots/summary?month=YYYY-MM
 */
router.get('/tenant/slots/summary', authenticate(), resolveTenant(), requireTenantAccess, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { month } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Month parameter is required (YYYY-MM)' });
    }

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = `${month}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

    const { data: slots, error } = await supabaseAdmin
      .from('appointment_slots')
      .select('slot_date, is_available')
      .eq('tenant_id', tenantId)
      .gte('slot_date', startDate)
      .lte('slot_date', endDate);

    if (error) {
      if (error.code === '42P01') return res.json({});
      throw error;
    }

    const summary = {};
    for (const slot of (slots || [])) {
      const date = slot.slot_date;
      if (!summary[date]) {
        summary[date] = { hasSlots: true, availableCount: 0, totalCount: 0 };
      }
      summary[date].totalCount++;
      if (slot.is_available) summary[date].availableCount++;
    }

    res.json(summary);
  } catch (error) {
    console.error('[API] Tenant slot summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Bulk create/update slots (tenant)
 * POST /api/tenant/slots
 */
router.post('/tenant/slots', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { slots } = req.body;

    if (!Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'slots must be a non-empty array' });
    }

    const slotDate = slots[0].slot_date;

    // Delete existing slots for this date
    await supabaseAdmin
      .from('appointment_slots')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('slot_date', slotDate);

    const slotsToInsert = slots.map(slot => ({
      tenant_id: tenantId,
      slot_date: slot.slot_date,
      slot_time: slot.slot_time,
      is_available: slot.is_available,
    }));

    const { data, error } = await supabaseAdmin
      .from('appointment_slots')
      .insert(slotsToInsert)
      .select();

    if (error) throw error;

    res.json({ success: true, message: `${data.length} slots saved`, slots: data });
  } catch (error) {
    console.error('[API] Tenant bulk slots error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update a single slot (tenant)
 * PUT /api/tenant/slots/:slotId
 */
router.put('/tenant/slots/:slotId', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const { slotId } = req.params;
    const { is_available } = req.body;

    if (typeof is_available !== 'boolean') {
      return res.status(400).json({ error: 'Bad Request', message: 'is_available must be a boolean' });
    }

    const { data, error } = await supabaseAdmin
      .from('appointment_slots')
      .update({ is_available, updated_at: new Date().toISOString() })
      .eq('id', slotId)
      .eq('tenant_id', req.tenantId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[API] Tenant update slot error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a slot (tenant)
 * DELETE /api/tenant/slots/:slotId
 */
router.delete('/tenant/slots/:slotId', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('appointment_slots')
      .delete()
      .eq('id', req.params.slotId)
      .eq('tenant_id', req.tenantId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Tenant delete slot error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate slots for a date range (tenant)
 * POST /api/tenant/slots/generate
 */
router.post('/tenant/slots/generate', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { days = 7 } = req.body;
    const numDays = Math.min(Math.max(1, parseInt(days) || 7), 60);

    const tenant = await tenantService.getTenantById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const workingHours = tenant.working_hours || {};
    const defaultWH = {
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
      const dayHours = workingHours[dayOfWeek] || defaultWH[dayOfWeek];

      if (dayHours?.closed) continue;

      const openTime = dayHours?.open || '09:00';
      const closeTime = dayHours?.close || '18:00';
      const [openHour] = openTime.split(':').map(Number);
      const [closeHour] = closeTime.split(':').map(Number);

      for (let hour = openHour; hour < closeHour; hour++) {
        allSlots.push({
          tenant_id: tenantId,
          slot_date: dateStr,
          slot_time: `${hour.toString().padStart(2, '0')}:00`,
          is_available: true,
        });
      }
    }

    if (allSlots.length === 0) {
      return res.json({ success: true, message: 'No slots to generate (all days closed)', count: 0 });
    }

    const dates = [...new Set(allSlots.map(s => s.slot_date))];
    for (const dateStr of dates) {
      await supabaseAdmin.from('appointment_slots').delete().eq('tenant_id', tenantId).eq('slot_date', dateStr);
    }

    const batchSize = 100;
    let inserted = 0;
    for (let i = 0; i < allSlots.length; i += batchSize) {
      const batch = allSlots.slice(i, i + batchSize);
      const { data, error } = await supabaseAdmin.from('appointment_slots').insert(batch).select();
      if (error) throw error;
      inserted += data.length;
    }

    res.json({ success: true, message: `${inserted} slots generated for ${dates.length} days`, count: inserted, days: dates.length });
  } catch (error) {
    console.error('[API] Tenant generate slots error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update working hours (tenant)
 * PUT /api/tenant/working-hours
 */
router.put('/tenant/working-hours', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const { working_hours } = req.body;
    if (!working_hours || typeof working_hours !== 'object') {
      return res.status(400).json({ error: 'Bad Request', message: 'working_hours object is required' });
    }

    const tenant = await tenantService.updateTenant(req.tenantId, { working_hours });
    res.json(tenant);
  } catch (error) {
    console.error('[API] Update working hours error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// TENANT CAMPAIGNS & PROMOTIONS ROUTES
// ==========================================

/**
 * List campaigns (tenant)
 * GET /api/tenant/campaigns
 */
router.get('/tenant/campaigns', authenticate(), resolveTenant(), requireTenantAccess, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('tenant_id', req.tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map DB fields to frontend fields
    const mapped = (data || []).map(c => ({
      ...c,
      start_date: c.valid_from,
      end_date: c.valid_until,
    }));

    res.json({ data: mapped });
  } catch (error) {
    console.error('[API] Get campaigns error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create campaign (tenant)
 * POST /api/tenant/campaigns
 */
router.post('/tenant/campaigns', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const { name, description, discount_type, discount_value, start_date, end_date, is_active } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Bad Request', message: 'Campaign name is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .insert({
        tenant_id: req.tenantId,
        name,
        description: description || null,
        discount_type: discount_type || 'percentage',
        discount_value: discount_value ? parseFloat(discount_value) : null,
        valid_from: start_date || null,
        valid_until: end_date || null,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ ...data, start_date: data.valid_from, end_date: data.valid_until });
  } catch (error) {
    console.error('[API] Create campaign error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update campaign (tenant)
 * PUT /api/tenant/campaigns/:id
 */
router.put('/tenant/campaigns/:id', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const { name, description, discount_type, discount_value, start_date, end_date, is_active } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (discount_type !== undefined) updates.discount_type = discount_type;
    if (discount_value !== undefined) updates.discount_value = parseFloat(discount_value);
    if (start_date !== undefined) updates.valid_from = start_date || null;
    if (end_date !== undefined) updates.valid_until = end_date || null;
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .update(updates)
      .eq('id', req.params.id)
      .eq('tenant_id', req.tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({ ...data, start_date: data.valid_from, end_date: data.valid_until });
  } catch (error) {
    console.error('[API] Update campaign error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete campaign (tenant)
 * DELETE /api/tenant/campaigns/:id
 */
router.delete('/tenant/campaigns/:id', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('campaigns')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.tenantId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Delete campaign error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * List promotion codes (tenant)
 * GET /api/tenant/promotion-codes
 */
router.get('/tenant/promotion-codes', authenticate(), resolveTenant(), requireTenantAccess, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('promotion_codes')
      .select('*')
      .eq('tenant_id', req.tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data: data || [] });
  } catch (error) {
    console.error('[API] Get promotion codes error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create promotion code (tenant)
 * POST /api/tenant/promotion-codes
 */
router.post('/tenant/promotion-codes', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const { code, discount_type, discount_value, max_uses, expires_at, is_active } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Bad Request', message: 'Promotion code is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('promotion_codes')
      .insert({
        tenant_id: req.tenantId,
        code: code.toUpperCase(),
        discount_type: discount_type || 'percentage',
        discount_value: discount_value ? parseFloat(discount_value) : null,
        max_uses: max_uses ? parseInt(max_uses) : null,
        expires_at: expires_at || null,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('[API] Create promotion code error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update promotion code (tenant)
 * PUT /api/tenant/promotion-codes/:id
 */
router.put('/tenant/promotion-codes/:id', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const { code, discount_type, discount_value, max_uses, expires_at, is_active } = req.body;

    const updates = {};
    if (code !== undefined) updates.code = code.toUpperCase();
    if (discount_type !== undefined) updates.discount_type = discount_type;
    if (discount_value !== undefined) updates.discount_value = parseFloat(discount_value);
    if (max_uses !== undefined) updates.max_uses = max_uses ? parseInt(max_uses) : null;
    if (expires_at !== undefined) updates.expires_at = expires_at || null;
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('promotion_codes')
      .update(updates)
      .eq('id', req.params.id)
      .eq('tenant_id', req.tenantId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[API] Update promotion code error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete promotion code (tenant)
 * DELETE /api/tenant/promotion-codes/:id
 */
router.delete('/tenant/promotion-codes/:id', authenticate(), resolveTenant(), requireTenantAccess, requireTenantAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('promotion_codes')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.tenantId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Delete promotion code error:', error);
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
    console.log(`[API] Update tenant ${req.params.id}:`, Object.keys(req.body));
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
 * Upload tenant asset (logo or favicon)
 * POST /api/admin/tenants/:id/upload
 * Body: multipart/form-data { file, type: 'logo' | 'favicon' }
 */
router.post('/admin/tenants/:id/upload', authenticate(), requireSuperAdmin, assetUpload.single('file'), async (req, res) => {
  try {
    const tenantId = req.params.id;
    const assetType = req.body.type; // 'logo' or 'favicon'

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (!['logo', 'favicon'].includes(assetType)) {
      return res.status(400).json({ error: 'Type must be "logo" or "favicon"' });
    }

    const tenant = await tenantService.getTenantById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
    const fileName = `${tenantId}/${assetType}${ext}`;

    // Upload to Supabase Storage (upsert to overwrite existing)
    const { error: uploadError } = await supabaseAdmin.storage
      .from('tenant-assets')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error('[API] Storage upload error:', uploadError);
      return res.status(500).json({ error: 'Upload failed: ' + uploadError.message });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('tenant-assets')
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    // Update tenant record
    const fieldName = assetType === 'logo' ? 'logo_url' : 'favicon_url';
    await tenantService.updateTenant(tenantId, { [fieldName]: publicUrl });

    res.json({ url: publicUrl, type: assetType });
  } catch (error) {
    console.error('[API] Upload tenant asset error:', error);
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

// ==========================================
// SIP TRUNK / PHONE NUMBER MANAGEMENT
// ==========================================

/**
 * Create shared SIP trunk credential in VAPI (one-time setup)
 * POST /api/admin/sip-credential
 */
router.post('/admin/sip-credential', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const credential = await vapiService.createSipTrunkCredential();
    res.json({
      success: true,
      message: 'SIP trunk credential created. Save the credentialId to VERIMOR_VAPI_CREDENTIAL_ID env var.',
      credential,
    });
  } catch (error) {
    console.error('[API] Create SIP credential error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Assign phone number to tenant (BYO SIP)
 * POST /api/admin/tenants/:id/phone-number
 */
router.post('/admin/tenants/:id/phone-number', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'phoneNumber is required (E.164 format, e.g. +905551234567)',
      });
    }

    // Validate E.164 format
    if (!/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'phoneNumber must be in E.164 format (e.g. +905551234567)',
      });
    }

    const result = await vapiService.assignPhoneNumberToTenant(req.params.id, phoneNumber);
    res.json({
      success: true,
      message: 'Phone number assigned successfully',
      data: result,
    });
  } catch (error) {
    console.error('[API] Assign phone number error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get phone number status for tenant
 * GET /api/admin/tenants/:id/phone-number
 */
router.get('/admin/tenants/:id/phone-number', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await tenantService.getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (!tenant.vapi_phone_number_id) {
      return res.json({
        assigned: false,
        phoneNumber: null,
        sipInboundEnabled: false,
      });
    }

    let vapiStatus = null;
    try {
      vapiStatus = await vapiService.getPhoneNumberStatus(tenant.vapi_phone_number_id);
    } catch (statusError) {
      console.warn('[API] Could not fetch VAPI phone status:', statusError.message);
    }

    const credentialId = tenant.vapi_credential_id || config.verimor?.vapiCredentialId;

    res.json({
      assigned: true,
      phoneNumber: tenant.sip_phone_number,
      vapiPhoneNumberId: tenant.vapi_phone_number_id,
      credentialId: credentialId,
      sipInboundEnabled: tenant.sip_inbound_enabled,
      sipUri: credentialId ? `${tenant.sip_phone_number}@${credentialId}.sip.vapi.ai` : null,
      vapiStatus,
    });
  } catch (error) {
    console.error('[API] Get phone number status error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Remove phone number from tenant
 * DELETE /api/admin/tenants/:id/phone-number
 */
router.delete('/admin/tenants/:id/phone-number', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const result = await vapiService.removePhoneNumberFromTenant(req.params.id);
    res.json({
      success: true,
      message: 'Phone number removed successfully',
      data: result,
    });
  } catch (error) {
    console.error('[API] Remove phone number error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Admin Dashboard Stats
 * GET /api/admin/dashboard-stats
 */
router.get('/admin/dashboard-stats', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    // Get all tenants
    const tenants = await tenantService.getAllTenants();

    const totalTenants = tenants.length;
    const activeTenants = tenants.filter(t => t.is_active === true).length;

    // Get total users count grouped by tenant_id
    const { data: usersData } = await supabaseAdmin
      .from('users')
      .select('tenant_id');
    const totalUsers = (usersData || []).length;

    // Get call_logs counts grouped by tenant_id
    const { data: callLogsData } = await supabaseAdmin
      .from('call_logs')
      .select('tenant_id');
    const callCountMap = {};
    for (const row of (callLogsData || [])) {
      callCountMap[row.tenant_id] = (callCountMap[row.tenant_id] || 0) + 1;
    }

    // Get appointment counts from all appointment tables
    const appointmentCountMap = {};

    const appointmentTables = ['test_drive_appointments', 'service_appointments', 'beauty_appointments'];
    for (const table of appointmentTables) {
      try {
        const { data } = await supabaseAdmin.from(table).select('tenant_id');
        for (const row of (data || [])) {
          appointmentCountMap[row.tenant_id] = (appointmentCountMap[row.tenant_id] || 0) + 1;
        }
      } catch (e) {
        // Table may not exist, skip
      }
    }

    // Build tenantStats
    const tenantStats = tenants.map(t => ({
      id: t.id,
      name: t.name,
      industry: t.industry,
      is_active: t.is_active,
      callCount: callCountMap[t.id] || 0,
      appointmentCount: appointmentCountMap[t.id] || 0,
    }));

    res.json({
      totalTenants,
      activeTenants,
      totalUsers,
      tenantStats,
    });
  } catch (error) {
    console.error('[API] Dashboard stats error:', error);
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
 * Get slot summary for a month (for calendar coloring)
 * GET /api/admin/tenants/:id/slots/summary?month=YYYY-MM
 */
router.get('/admin/tenants/:id/slots/summary', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = req.params.id;
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Month parameter is required (YYYY-MM)',
      });
    }

    // Validate month format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid month format. Use YYYY-MM',
      });
    }

    // Calculate date range for the month
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = `${month}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

    // Get all slots for the month
    const { data: slots, error } = await supabaseAdmin
      .from('appointment_slots')
      .select('slot_date, is_available')
      .eq('tenant_id', tenantId)
      .gte('slot_date', startDate)
      .lte('slot_date', endDate);

    if (error) {
      // Table might not exist, return empty summary
      if (error.code === '42P01') {
        return res.json({});
      }
      throw error;
    }

    // Group by date and calculate summary
    const summary = {};
    for (const slot of (slots || [])) {
      const date = slot.slot_date;
      if (!summary[date]) {
        summary[date] = { hasSlots: true, availableCount: 0, totalCount: 0 };
      }
      summary[date].totalCount++;
      if (slot.is_available) {
        summary[date].availableCount++;
      }
    }

    res.json(summary);
  } catch (error) {
    console.error('[API] Get slot summary error:', error);
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

// ==========================================
// ADMIN CAMPAIGNS & PROMOTIONS ROUTES
// ==========================================

/**
 * List campaigns for a tenant (admin)
 * GET /api/admin/tenants/:id/campaigns
 */
router.get('/admin/tenants/:id/campaigns', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('tenant_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const mapped = (data || []).map(c => ({
      ...c,
      start_date: c.valid_from,
      end_date: c.valid_until,
    }));

    res.json({ data: mapped });
  } catch (error) {
    console.error('[API] Admin get campaigns error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create campaign for a tenant (admin)
 * POST /api/admin/tenants/:id/campaigns
 */
router.post('/admin/tenants/:id/campaigns', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { name, description, discount_type, discount_value, start_date, end_date, is_active } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Bad Request', message: 'Campaign name is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .insert({
        tenant_id: req.params.id,
        name,
        description: description || null,
        discount_type: discount_type || 'percentage',
        discount_value: discount_value ? parseFloat(discount_value) : null,
        valid_from: start_date || null,
        valid_until: end_date || null,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ ...data, start_date: data.valid_from, end_date: data.valid_until });
  } catch (error) {
    console.error('[API] Admin create campaign error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update campaign for a tenant (admin)
 * PUT /api/admin/tenants/:id/campaigns/:campaignId
 */
router.put('/admin/tenants/:id/campaigns/:campaignId', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { name, description, discount_type, discount_value, start_date, end_date, is_active } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (discount_type !== undefined) updates.discount_type = discount_type;
    if (discount_value !== undefined) updates.discount_value = parseFloat(discount_value);
    if (start_date !== undefined) updates.valid_from = start_date || null;
    if (end_date !== undefined) updates.valid_until = end_date || null;
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .update(updates)
      .eq('id', req.params.campaignId)
      .eq('tenant_id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ ...data, start_date: data.valid_from, end_date: data.valid_until });
  } catch (error) {
    console.error('[API] Admin update campaign error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete campaign for a tenant (admin)
 * DELETE /api/admin/tenants/:id/campaigns/:campaignId
 */
router.delete('/admin/tenants/:id/campaigns/:campaignId', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('campaigns')
      .delete()
      .eq('id', req.params.campaignId)
      .eq('tenant_id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Admin delete campaign error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * List promotion codes for a tenant (admin)
 * GET /api/admin/tenants/:id/promotion-codes
 */
router.get('/admin/tenants/:id/promotion-codes', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('promotion_codes')
      .select('*')
      .eq('tenant_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data: data || [] });
  } catch (error) {
    console.error('[API] Admin get promotion codes error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create promotion code for a tenant (admin)
 * POST /api/admin/tenants/:id/promotion-codes
 */
router.post('/admin/tenants/:id/promotion-codes', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { code, discount_type, discount_value, max_uses, expires_at, is_active } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Bad Request', message: 'Promotion code is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('promotion_codes')
      .insert({
        tenant_id: req.params.id,
        code: code.toUpperCase(),
        discount_type: discount_type || 'percentage',
        discount_value: discount_value ? parseFloat(discount_value) : null,
        max_uses: max_uses ? parseInt(max_uses) : null,
        expires_at: expires_at || null,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('[API] Admin create promotion code error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update promotion code for a tenant (admin)
 * PUT /api/admin/tenants/:id/promotion-codes/:codeId
 */
router.put('/admin/tenants/:id/promotion-codes/:codeId', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { code, discount_type, discount_value, max_uses, expires_at, is_active } = req.body;

    const updates = {};
    if (code !== undefined) updates.code = code.toUpperCase();
    if (discount_type !== undefined) updates.discount_type = discount_type;
    if (discount_value !== undefined) updates.discount_value = parseFloat(discount_value);
    if (max_uses !== undefined) updates.max_uses = max_uses ? parseInt(max_uses) : null;
    if (expires_at !== undefined) updates.expires_at = expires_at || null;
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('promotion_codes')
      .update(updates)
      .eq('id', req.params.codeId)
      .eq('tenant_id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[API] Admin update promotion code error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete promotion code for a tenant (admin)
 * DELETE /api/admin/tenants/:id/promotion-codes/:codeId
 */
router.delete('/admin/tenants/:id/promotion-codes/:codeId', authenticate(), requireSuperAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('promotion_codes')
      .delete()
      .eq('id', req.params.codeId)
      .eq('tenant_id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Admin delete promotion code error:', error);
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
      // Tenant ID zorunlu - güvenlik için tüm veri döndürmeyi engelle
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant ID is required',
      });
    }

    const data = await supabaseService.getTestDriveAppointments(req.tenantId, null, req.token, { useAdmin: true });
    res.json(data);
  } catch (error) {
    console.error('[API] Test drives fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test Sürüşü Güncelle (tam düzenleme)
 * PUT /api/test-drives/:id
 */
router.put('/test-drives/:id', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant ID is required',
      });
    }

    const { id } = req.params;
    const { appointment_date, appointment_time, status } = req.body;

    const updateData = {};
    if (appointment_date) updateData.appointment_date = appointment_date;
    if (appointment_time) updateData.appointment_time = appointment_time;
    if (status) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'No fields to update' });
    }

    const { data, error } = await supabaseAdmin
      .from('test_drive_appointments')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', req.tenantId)
      .select();

    if (error) {
      console.error('[API] Test drive update supabase error:', error);
      throw error;
    }
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Appointment not found' });
    }
    res.json(data[0]);
  } catch (error) {
    console.error('[API] Test drive update error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test Sürüşü Durumu Güncelle
 * PATCH /api/test-drives/:id
 */
router.patch('/test-drives/:id', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant ID is required',
      });
    }

    const { id } = req.params;
    const { status } = req.body;

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
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant ID is required',
      });
    }

    const data = await supabaseService.getServiceAppointments(req.tenantId, null, req.token, { useAdmin: true });
    res.json(data);
  } catch (error) {
    console.error('[API] Services fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Servis Randevusu Güncelle (tam düzenleme)
 * PUT /api/services/:id
 */
router.put('/services/:id', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant ID is required',
      });
    }

    const { id } = req.params;
    const { appointment_date, appointment_time, status } = req.body;

    const updateData = { updated_at: new Date().toISOString() };
    if (appointment_date) updateData.appointment_date = appointment_date;
    if (appointment_time) updateData.appointment_time = appointment_time;
    if (status) updateData.status = status;

    const { data, error } = await supabaseAdmin
      .from('service_appointments')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', req.tenantId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[API] Service update error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Servis Durumu Güncelle
 * PATCH /api/services/:id
 */
router.patch('/services/:id', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant ID is required',
      });
    }

    const { id } = req.params;
    const { status } = req.body;

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
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant ID is required',
      });
    }

    const data = await supabaseService.getAllCustomers(req.tenantId, req.token, { useAdmin: true });
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

    if (!tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant ID is required',
      });
    }

    // Token ile RLS aktif client kullan
    const data = await supabaseService.getAllVehicles(tenantId, req.token);

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
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const { brand, model, year, price, color, fuel_type, transmission, is_available } = req.body;

    // Yazma işlemleri için token ile auth client kullan (RLS ile)
    const client = req.token ? supabaseService.createAuthClient(req.token) : supabaseAdmin;
    const { data, error } = await client
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

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const { brand, model, year, price, color, fuel_type, transmission, is_available } = req.body;

    // Yazma işlemleri için token ile auth client kullan (RLS ile)
    const client = req.token ? supabaseService.createAuthClient(req.token) : supabaseAdmin;
    const { data, error } = await client
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
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

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

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    // Yazma işlemleri için token ile auth client kullan (RLS ile)
    const client = req.token ? supabaseService.createAuthClient(req.token) : supabaseAdmin;
    const { error } = await client
      .from('vehicles')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

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
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant ID is required',
      });
    }

    const data = await supabaseService.getCallLogs(req.tenantId, 50, req.token, { useAdmin: true });

    // VAPI ham end_reason değerlerini normalize et (keyword tabanlı)
    const normalizeEndReason = (reason) => {
      if (!reason) return 'completed';
      // Tüm ayırıcıları (tire, alt çizgi, nokta) boşluğa çevir, sonra keyword ara
      const normalized = reason.toLowerCase().replace(/[-_.]/g, ' ');
      const keywordMap = [
        { keyword: 'not receive customer audio', key: 'no-customer-audio' },
      ];
      for (const entry of keywordMap) {
        if (normalized.includes(entry.keyword)) return entry.key;
      }
      return reason;
    };

    // Frontend formatına dönüştür
    const mappedData = data.map(log => ({
      id: log.id,
      callerPhone: log.caller_phone || 'Bilinmiyor',
      callerName: log.customer?.name || null,
      timestamp: log.created_at,
      duration: log.duration_seconds || 0,
      outcome: normalizeEndReason(log.end_reason),
      // Ek bilgiler
      direction: log.call_type,
      transcript: log.transcript,
      summary: log.summary,
      callSid: log.call_id,
    }));

    res.json(mappedData);
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
    const data = await supabaseService.getBeautyServices(req.tenantId, { category }, { token: req.token, useAdmin: true });
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
    const client = req.token ? supabaseService.createAuthClient(req.token) : supabaseAdmin;
    const { data, error } = await client
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
    const client = req.token ? supabaseService.createAuthClient(req.token) : supabaseAdmin;
    const { data, error } = await client
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
    const client = req.token ? supabaseService.createAuthClient(req.token) : supabaseAdmin;
    const { data, error } = await client
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
        message: 'Tenant ID is required',
      });
    }

    const data = await supabaseService.getBeautyAppointments(req.tenantId, null, req.token, { useAdmin: true });
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
 * Güzellik Randevusu Güncelle (tam düzenleme)
 * PUT /api/beauty/appointments/:id
 */
router.put('/beauty/appointments/:id', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant ID required',
      });
    }

    const { id } = req.params;
    const { appointment_date, appointment_time, status } = req.body;

    const updateData = {};
    if (appointment_date) updateData.appointment_date = appointment_date;
    if (appointment_time) updateData.appointment_time = appointment_time;
    if (status) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'No fields to update' });
    }

    const { data, error } = await supabaseAdmin
      .from('beauty_appointments')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', req.tenantId)
      .select();

    if (error) {
      console.error('[API] Beauty appointment update supabase error:', error);
      throw error;
    }
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Appointment not found' });
    }
    res.json(data[0]);
  } catch (error) {
    console.error('[API] Beauty appointment update error:', error);
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

    if (!appointment_type) {
      return res.status(400).json({ error: 'appointment_type is required (beauty, test_drive, or service)' });
    }

    const validTypes = ['beauty', 'test_drive', 'service'];
    if (!validTypes.includes(appointment_type)) {
      return res.status(400).json({ error: `Invalid appointment_type: ${appointment_type}. Must be: beauty, test_drive, or service` });
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
      .update({ status })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error(`[API] Appointment update failed: table=${tableName}, id=${appointmentId}, tenant=${tenantId}`, error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Randevu bulunamadı', message: `${tableName} tablosunda id=${appointmentId} bulunamadı` });
      }
      throw error;
    }

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

    // Super admin - RLS bypass gerekli
    let query = supabaseAdmin
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

    // Super admin - RLS bypass gerekli
    const { data, error } = await supabaseAdmin
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
    const client = req.token ? supabaseService.createAuthClient(req.token) : supabaseAdmin;
    const { data, error } = await client
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
    const client = req.token ? supabaseService.createAuthClient(req.token) : supabaseAdmin;

    if (id) {
      // Update existing
      const { data, error } = await client
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
    const { data, error } = await client
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

// ==========================================
// NOTIFICATION ROUTES
// ==========================================

/**
 * Get notifications (paginated + filtered)
 * GET /api/tenant/notifications
 * Query params: ?page=1&limit=20&type=appointment_created&is_read=false
 */
router.get('/tenant/notifications', authenticate(), resolveTenant(), requireTenantAccess, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, is_read } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('tenant_id', req.tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (type) {
      query = query.eq('type', type);
    }
    if (is_read !== undefined && is_read !== '') {
      query = query.eq('is_read', is_read === 'true');
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      data: data || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('[API] Get notifications error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get unread notification count
 * GET /api/tenant/notifications/unread-count
 */
router.get('/tenant/notifications/unread-count', authenticate(), resolveTenant(), requireTenantAccess, async (req, res) => {
  try {
    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', req.tenantId)
      .eq('is_read', false);

    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (error) {
    console.error('[API] Get unread count error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Mark single notification as read
 * PATCH /api/tenant/notifications/:id/read
 */
router.patch('/tenant/notifications/:id/read', authenticate(), resolveTenant(), requireTenantAccess, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('tenant_id', req.tenantId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[API] Mark notification read error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Mark all notifications as read
 * PATCH /api/tenant/notifications/read-all
 */
router.patch('/tenant/notifications/read-all', authenticate(), resolveTenant(), requireTenantAccess, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('tenant_id', req.tenantId)
      .eq('is_read', false);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Mark all read error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
