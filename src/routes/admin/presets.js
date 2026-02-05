/**
 * Admin Preset Routes
 * Industry preset yonetimi ve VAPI sync islemleri
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const config = require('../../config/env');
const vapiService = require('../../services/vapiService');
const { getFunctionDefinitions } = require('../../prompts/functions');

// Admin routes need serviceRoleKey to bypass RLS
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

/**
 * Tum preset'leri listele
 * GET /api/admin/presets
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('industry_presets')
      .select('*')
      .order('industry');

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('[PresetRoutes] List presets error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Tek preset detayi getir
 * GET /api/admin/presets/:industry
 */
router.get('/:industry', async (req, res) => {
  try {
    const { industry } = req.params;

    const { data, error } = await supabase
      .from('industry_presets')
      .select('*')
      .eq('industry', industry)
      .single();

    if (error && error.code === 'PGRST116') {
      return res.status(404).json({
        error: 'Not Found',
        message: `Preset not found: ${industry}`,
      });
    }

    if (error) throw error;

    // Tool tanımlarını getFunctionDefinitions'dan al
    const functionDefs = getFunctionDefinitions(industry);
    const tools = functionDefs.map(def => ({
      name: def.function.name,
      description: def.function.description,
      parameters: def.function.parameters,
    }));

    // Preset verisine tool'ları ekle
    res.json({
      ...data,
      default_tools: tools,
    });
  } catch (error) {
    console.error('[PresetRoutes] Get preset error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Preset guncelle
 * PUT /api/admin/presets/:industry
 */
router.put('/:industry', async (req, res) => {
  try {
    const { industry } = req.params;
    const updates = req.body;

    // Industry degistirilemez
    delete updates.industry;
    delete updates.id;
    delete updates.created_at;

    const { data, error } = await supabase
      .from('industry_presets')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('industry', industry)
      .select()
      .single();

    if (error && error.code === 'PGRST116') {
      return res.status(404).json({
        error: 'Not Found',
        message: `Preset not found: ${industry}`,
      });
    }

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[PresetRoutes] Update preset error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Yeni preset olustur
 * POST /api/admin/presets
 */
router.post('/', async (req, res) => {
  try {
    const presetData = req.body;

    if (!presetData.industry) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Industry is required',
      });
    }

    const { data, error } = await supabase
      .from('industry_presets')
      .insert(presetData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'Conflict',
          message: `Preset already exists: ${presetData.industry}`,
        });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('[PresetRoutes] Create preset error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Preset'i VAPI'ye sync et (belirli dil icin tum tenant'lari guncelle)
 * POST /api/admin/presets/:industry/sync
 * Body: { language: 'tr' | 'en' | 'de' }
 */
router.post('/:industry/sync', async (req, res) => {
  try {
    const { industry } = req.params;
    const { language } = req.body;

    // Language zorunlu
    if (!language || !['tr', 'en', 'de'].includes(language)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Language is required. Must be one of: tr, en, de',
      });
    }

    // Preset'in varligini kontrol et
    const { data: preset, error: presetError } = await supabase
      .from('industry_presets')
      .select('id, industry')
      .eq('industry', industry)
      .single();

    if (presetError && presetError.code === 'PGRST116') {
      return res.status(404).json({
        error: 'Not Found',
        message: `Preset not found: ${industry}`,
      });
    }

    if (presetError) throw presetError;

    // VAPI'ye sync et (sadece belirtilen dil icin)
    const results = await vapiService.syncPresetToAllTenants(industry, language);

    res.json({
      success: true,
      message: `Synced ${results.length} tenants for ${language.toUpperCase()}`,
      language,
      results,
    });
  } catch (error) {
    console.error('[PresetRoutes] Sync preset error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Preset sil (dikkatli kullan!)
 * DELETE /api/admin/presets/:industry
 */
router.delete('/:industry', async (req, res) => {
  try {
    const { industry } = req.params;

    // Bu industry'de tenant var mi kontrol et
    const { count, error: countError } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('industry', industry);

    if (countError) throw countError;

    if (count > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: `Cannot delete preset. ${count} tenant(s) are using this industry.`,
      });
    }

    const { error } = await supabase
      .from('industry_presets')
      .delete()
      .eq('industry', industry);

    if (error) throw error;

    res.json({
      success: true,
      message: `Preset deleted: ${industry}`,
    });
  } catch (error) {
    console.error('[PresetRoutes] Delete preset error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Sync log'larini getir
 * GET /api/admin/presets/logs
 */
router.get('/sync/logs', async (req, res) => {
  try {
    const { tenantId, status, limit = 50 } = req.query;

    const logs = await vapiService.getSyncLogs({
      tenantId,
      status,
      limit: parseInt(limit),
    });

    res.json(logs);
  } catch (error) {
    console.error('[PresetRoutes] Get sync logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Master asistan bilgilerini getir
 * GET /api/admin/presets/:industry/master-assistants
 */
router.get('/:industry/master-assistants', async (req, res) => {
  try {
    const { industry } = req.params;
    const assistants = await vapiService.getMasterAssistants(industry);
    res.json(assistants);
  } catch (error) {
    console.error('[PresetRoutes] Get master assistants error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Master asistan oluştur/güncelle
 * POST /api/admin/presets/:industry/master-assistant
 * Body: { language: 'tr' | 'en' | 'de' }
 */
router.post('/:industry/master-assistant', async (req, res) => {
  try {
    const { industry } = req.params;
    const { language } = req.body;

    if (!language || !['tr', 'en', 'de'].includes(language)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Language is required. Must be one of: tr, en, de',
      });
    }

    const assistant = await vapiService.createMasterAssistant(industry, language);

    res.json({
      success: true,
      message: `Master assistant created/updated for ${industry} (${language.toUpperCase()})`,
      assistant: {
        id: assistant.id,
        name: assistant.name,
      },
    });
  } catch (error) {
    console.error('[PresetRoutes] Create master assistant error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Tüm diller için master asistan oluştur
 * POST /api/admin/presets/:industry/master-assistants/all
 */
router.post('/:industry/master-assistants/all', async (req, res) => {
  try {
    const { industry } = req.params;
    const languages = ['tr', 'en', 'de'];
    const results = [];

    for (const lang of languages) {
      try {
        const assistant = await vapiService.createMasterAssistant(industry, lang);
        results.push({
          language: lang,
          success: true,
          assistantId: assistant.id,
        });
      } catch (error) {
        results.push({
          language: lang,
          success: false,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      message: `Master assistants created for ${industry}`,
      results,
    });
  } catch (error) {
    console.error('[PresetRoutes] Create all master assistants error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Master asistan sil
 * DELETE /api/admin/presets/:industry/master-assistant/:language
 */
router.delete('/:industry/master-assistant/:language', async (req, res) => {
  try {
    const { industry, language } = req.params;

    if (!['tr', 'en', 'de'].includes(language)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Language must be one of: tr, en, de',
      });
    }

    await vapiService.deleteMasterAssistant(industry, language);

    res.json({
      success: true,
      message: `Master assistant deleted for ${industry} (${language.toUpperCase()})`,
    });
  } catch (error) {
    console.error('[PresetRoutes] Delete master assistant error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
