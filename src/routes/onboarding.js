/**
 * Onboarding Routes
 * Tenant onboarding sureci API endpoint'leri
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const onboardingService = require('../services/onboardingService');
const useCaseService = require('../services/useCaseService');

// Multer config for CSV upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// ==========================================
// PUBLIC ONBOARDING ROUTES
// ==========================================

/**
 * Industry Presets Listesi
 * GET /api/onboarding/industries
 */
router.get('/industries', async (req, res) => {
  try {
    const presets = await onboardingService.getIndustryPresets();
    res.json(presets);
  } catch (error) {
    console.error('[Onboarding] Industries error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Onboarding Config (JSON-driven steps)
 * GET /api/onboarding/config/:industry
 *
 * Returns the dynamic onboarding configuration for an industry
 * Config includes steps, fields, validation rules, etc.
 */
router.get('/config/:industry', async (req, res) => {
  try {
    const { industry } = req.params;
    const config = await onboardingService.getOnboardingConfig(industry);

    if (!config || !config.steps || config.steps.length === 0) {
      // Return default fallback config if none found
      return res.json({
        version: '1.0',
        steps: [
          {
            id: 'company',
            title: 'Firma Bilgileri',
            description: 'Isletmeniz hakkinda temel bilgiler',
            icon: 'Building2',
            required: true,
            fields: [
              { name: 'name', label: 'Firma Adi', type: 'text', required: true },
              { name: 'phone', label: 'Telefon', type: 'tel', required: true },
              { name: 'email', label: 'Email', type: 'email', required: true },
              { name: 'password', label: 'Sifre', type: 'password', required: true, validation: { minLength: 6 } },
            ],
          },
          {
            id: 'hours',
            title: 'Calisma Saatleri',
            icon: 'Clock',
            required: true,
            type: 'working_hours',
          },
          {
            id: 'voice',
            title: 'Ses Ayarlari',
            icon: 'Mic',
            required: true,
            type: 'voice_settings',
            component: 'VoiceSettings',
          },
          {
            id: 'test',
            title: 'Test & Aktivasyon',
            icon: 'PhoneCall',
            required: true,
            type: 'activation',
            component: 'TestActivation',
          },
        ],
      });
    }

    res.json(config);
  } catch (error) {
    console.error('[Onboarding] Config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generic Catalog Upload (Config-driven)
 * POST /api/onboarding/catalog
 *
 * Body: {
 *   tableName: string (vehicles, beauty_services, etc.),
 *   items: Array<object>
 * }
 */
router.post('/catalog', authenticate(), async (req, res) => {
  try {
    const { tableName, items } = req.body;

    if (!tableName) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Table name is required',
      });
    }

    const result = await onboardingService.uploadCatalog(
      req.tenantId,
      tableName,
      items || []
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Onboarding] Catalog upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generic Catalog CSV Upload (Config-driven)
 * POST /api/onboarding/catalog/csv
 */
router.post('/catalog/csv', authenticate(), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'CSV file is required',
      });
    }

    const tableName = req.body.tableName;
    if (!tableName) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Table name is required',
      });
    }

    // CSV'yi parse et
    const csvContent = req.file.buffer.toString('utf-8');
    const items = onboardingService.parseGenericCSV(csvContent);

    if (items.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'No valid items found in CSV',
      });
    }

    // Upload items
    const result = await onboardingService.uploadCatalog(req.tenantId, tableName, items);

    res.json({
      success: true,
      items,
      ...result,
    });
  } catch (error) {
    console.error('[Onboarding] Catalog CSV upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ADIM 1: Firma Kaydı
 * POST /api/onboarding/register
 *
 * Body: {
 *   name: string (required),
 *   email: string (required),
 *   password: string (required),
 *   phone: string,
 *   language: string (tr|en|de),
 *   region: string (tr|de|global),
 *   assistantName: string,
 *   industry: string (automotive|beauty_salon|hairdresser)
 * }
 */
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      language,
      region,
      assistantName,
      industry,
    } = req.body;

    // Validation
    if (!name || name.length < 2) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Company name must be at least 2 characters',
      });
    }

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Valid email is required',
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Password must be at least 6 characters',
      });
    }

    const result = await onboardingService.registerTenant({
      name,
      email,
      password,
      phone,
      language,
      region,
      assistantName,
      industry,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Onboarding] Register error:', error);

    if (error.message === 'Email already registered') {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

// ==========================================
// AUTHENTICATED ONBOARDING ROUTES
// ==========================================

/**
 * Onboarding durumunu ve ozeti getir
 * GET /api/onboarding/status
 */
router.get('/status', authenticate(), async (req, res) => {
  try {
    const summary = await onboardingService.getOnboardingSummary(req.tenantId);
    res.json(summary);
  } catch (error) {
    console.error('[Onboarding] Status error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Onboarding checklist
 * GET /api/onboarding/checklist
 */
router.get('/checklist', authenticate(), async (req, res) => {
  try {
    const checklist = await onboardingService.validateOnboardingChecklist(req.tenantId);
    res.json(checklist);
  } catch (error) {
    console.error('[Onboarding] Checklist error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ADIM 2A: Araç Kataloğu - JSON
 * POST /api/onboarding/vehicles
 *
 * Body: {
 *   vehicles: Array<{
 *     brand: string,
 *     model: string,
 *     year: number,
 *     color: string,
 *     fuel_type: string,
 *     transmission: string,
 *     price: number,
 *     is_available: boolean
 *   }>,
 *   skip: boolean
 * }
 */
router.post('/vehicles', authenticate(), async (req, res) => {
  try {
    const { vehicles, skip } = req.body;

    const result = await onboardingService.uploadVehicles(
      req.tenantId,
      vehicles,
      { skipIfEmpty: skip }
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Onboarding] Vehicles upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ADIM 2A: Araç Kataloğu - CSV Upload
 * POST /api/onboarding/vehicles/csv
 */
router.post('/vehicles/csv', authenticate(), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'CSV file is required',
      });
    }

    // CSV'yi parse et
    const csvContent = req.file.buffer.toString('utf-8');
    const vehicles = onboardingService.parseVehiclesCSV(csvContent);

    if (vehicles.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'No valid vehicles found in CSV',
      });
    }

    // Araclari yukle
    const result = await onboardingService.uploadVehicles(req.tenantId, vehicles);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Onboarding] CSV upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ADIM 2A (Beauty): Hizmet Katalogu - JSON
 * POST /api/onboarding/services
 *
 * Body: {
 *   services: Array<{
 *     name: string,
 *     category: string,
 *     duration_minutes: number,
 *     price: number,
 *     description: string,
 *     is_active: boolean
 *   }>,
 *   skip: boolean
 * }
 */
router.post('/services', authenticate(), async (req, res) => {
  try {
    const { services, skip } = req.body;

    const result = await onboardingService.uploadServices(
      req.tenantId,
      services,
      { skipIfEmpty: skip }
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Onboarding] Services upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ADIM 2A (Beauty): Hizmet Katalogu - CSV Upload
 * POST /api/onboarding/services/csv
 */
router.post('/services/csv', authenticate(), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'CSV file is required',
      });
    }

    // CSV'yi parse et
    const csvContent = req.file.buffer.toString('utf-8');
    const services = onboardingService.parseServicesCSV(csvContent);

    if (services.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'No valid services found in CSV',
      });
    }

    // Hizmetleri yukle
    const result = await onboardingService.uploadServices(req.tenantId, services);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Onboarding] Services CSV upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test Senaryolari (Sektore ozel)
 * GET /api/onboarding/test-scenarios
 */
router.get('/test-scenarios', authenticate(), async (req, res) => {
  try {
    const { industry } = req.query;
    const scenarios = onboardingService.getTestScenarios(industry || 'automotive');
    res.json(scenarios);
  } catch (error) {
    console.error('[Onboarding] Test scenarios error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ADIM 2B: Çalışma Saatleri
 * POST /api/onboarding/hours
 *
 * Body: {
 *   workingHours: Array<{
 *     day_of_week: number (0-6),
 *     open_time: string (HH:MM),
 *     close_time: string (HH:MM),
 *     is_open: boolean,
 *     break_start?: string,
 *     break_end?: string
 *   }>
 * }
 */
router.post('/hours', authenticate(), async (req, res) => {
  try {
    const { workingHours } = req.body;

    if (!workingHours || !Array.isArray(workingHours)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Working hours array is required',
      });
    }

    const result = await onboardingService.setWorkingHours(req.tenantId, workingHours);

    res.json({
      success: true,
      workingHours: result,
    });
  } catch (error) {
    console.error('[Onboarding] Hours save error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Çalışma Saatlerini Getir
 * GET /api/onboarding/hours
 */
router.get('/hours', authenticate(), async (req, res) => {
  try {
    const workingHours = await onboardingService.getWorkingHours(req.tenantId);
    res.json(workingHours);
  } catch (error) {
    console.error('[Onboarding] Get hours error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ADIM 3: Ses Ayarları
 * PUT /api/onboarding/voice
 *
 * Body: {
 *   assistantName: string,
 *   voicePresetId: string,
 *   voiceId: string,
 *   greetingMessage: string
 * }
 */
router.put('/voice', authenticate(), async (req, res) => {
  try {
    const { assistantName, voicePresetId, voiceId, greetingMessage } = req.body;

    const result = await onboardingService.updateVoiceSettings(req.tenantId, {
      assistantName,
      voicePresetId,
      voiceId,
      greetingMessage,
    });

    res.json({
      success: true,
      tenant: result,
    });
  } catch (error) {
    console.error('[Onboarding] Voice settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Voice Preset Listesi
 * GET /api/onboarding/voice-presets
 */
router.get('/voice-presets', async (req, res) => {
  try {
    const { language } = req.query;
    const presets = await onboardingService.getVoicePresets(language);
    res.json(presets);
  } catch (error) {
    console.error('[Onboarding] Voice presets error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ADIM 4: Test Çağrısı Başlat
 * POST /api/onboarding/test-call
 */
router.post('/test-call', authenticate(), async (req, res) => {
  try {
    const result = await onboardingService.initiateTestCall(req.tenantId);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Onboarding] Test call error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ADIM 4: Aktivasyon
 * POST /api/onboarding/activate
 */
router.post('/activate', authenticate(), async (req, res) => {
  try {
    const result = await onboardingService.activateTenant(req.tenantId);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Onboarding] Activation error:', error);

    if (error.message.startsWith('Missing required')) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message,
      });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * USE CASE: Tenant için use case'leri kaydet
 * POST /api/onboarding/use-cases
 *
 * Body: {
 *   useCaseIds: string[]
 * }
 */
router.post('/use-cases', authenticate(), async (req, res) => {
  try {
    const { useCaseIds } = req.body;

    if (!Array.isArray(useCaseIds)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'useCaseIds must be an array',
      });
    }

    const result = await useCaseService.setTenantUseCases(req.tenantId, useCaseIds);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Onboarding] Use cases error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Slug kontrolü
 * GET /api/onboarding/check-slug/:slug
 */
router.get('/check-slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { createClient } = require('@supabase/supabase-js');
    const config = require('../config/env');
    const supabase = createClient(config.supabase.url, config.supabase.anonKey);

    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    res.json({
      available: !existing,
      slug,
    });
  } catch (error) {
    res.json({ available: true, slug: req.params.slug });
  }
});

/**
 * Slug önerisi
 * GET /api/onboarding/suggest-slug
 */
router.get('/suggest-slug', async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Name is required',
      });
    }

    const baseSlug = onboardingService.generateSlug(name);
    const uniqueSlug = await onboardingService.ensureUniqueSlug(baseSlug);

    res.json({
      suggested: uniqueSlug,
      base: baseSlug,
    });
  } catch (error) {
    console.error('[Onboarding] Suggest slug error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
