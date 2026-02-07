/**
 * VAPI Sync Service
 * Centralized VAPI synchronization for all tenant changes
 * Single entry point for all VAPI assistant updates
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');

// VAPI sync service manages tenant syncs, needs serviceRoleKey
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

// Lazy load dependencies to avoid circular imports
let _promptCompiler = null;
let _vapiService = null;

function getPromptCompiler() {
  if (!_promptCompiler) {
    _promptCompiler = require('./promptCompiler');
  }
  return _promptCompiler;
}

function getVapiService() {
  if (!_vapiService) {
    _vapiService = require('./vapiService');
  }
  return _vapiService;
}

/**
 * Lazy load tool definitions from useCaseService
 */
let _useCaseService = null;
function getUseCaseService() {
  if (!_useCaseService) {
    _useCaseService = require('./useCaseService');
  }
  return _useCaseService;
}

/**
 * Sync reasons for audit log
 */
const SYNC_REASONS = {
  MANUAL: 'manual',
  TENANT_UPDATE: 'tenant_update',
  TEMPLATE_CHANGE: 'template_change',
  USECASE_CHANGE: 'usecase_change',
  PROMPT_CHANGE: 'prompt_change',
  PRESET_CHANGE: 'preset_change',
  AUTO_TRIGGER: 'auto_trigger',
  INITIAL_SETUP: 'initial_setup',
};

/**
 * Get tenant info
 * @param {string} tenantId - Tenant UUID
 * @returns {Object} - Tenant data
 */
async function getTenantInfo(tenantId) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (error) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  return data;
}

/**
 * Get industry preset
 * @param {string} industry - Industry code
 * @returns {Object} - Preset data
 */
async function getIndustryPreset(industry) {
  const { data, error } = await supabase
    .from('industry_presets')
    .select('*')
    .eq('industry', industry)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[VapiSyncService] Error fetching preset:', error);
  }

  return data;
}

/**
 * Build VAPI assistant config using PromptCompiler
 * @param {Object} tenant - Tenant object
 * @param {string} language - Language code
 * @param {Object} promptData - Data from PromptCompiler
 * @returns {Object} - VAPI assistant config
 */
async function buildVapiConfig(tenant, language, promptData) {
  const preset = await getIndustryPreset(tenant.industry);
  const configColumn = `config_${language}`;
  const presetConfig = preset?.[configColumn] || preset?.config_tr || {};

  // Merge config with tenant overrides
  const mergedConfig = {
    ...presetConfig,
    ...(tenant.voice_config_override || {}),
  };

  const serverUrl = config.vapi?.serverUrl || config.server?.url;

  // Get tool definitions for the use cases
  const useCaseService = getUseCaseService();
  const toolDefinitions = useCaseService.getToolDefinitionsForUseCases(promptData.useCases);

  // Build tool configs for VAPI
  const vapiService = getVapiService();
  const tools = toolDefinitions.map(def => ({
    type: 'function',
    function: {
      name: def.function.name,
      description: def.function.description,
      parameters: def.function.parameters || { type: 'object', properties: {} },
    },
    server: {
      url: `${serverUrl}/vapi/tools?tenantId=${tenant.id}`,
      headers: {
        'x-tenant-id': tenant.id,
      },
    },
    messages: [
      {
        type: 'request-start',
        content: vapiService.getToolStartMessage(def.function.name, language),
      },
      {
        type: 'request-failed',
        content: vapiService.getToolFailMessage(language),
      },
    ],
  }));

  // Build voice config
  const voiceConfig = {
    provider: mergedConfig.voice_provider || '11labs',
    voiceId: mergedConfig.voice_id,
    speed: mergedConfig.voice_speed || 1.0,
    language: language, // Force TTS language to prevent code-switching on alphanumeric strings
  };

  if (voiceConfig.provider === '11labs' || voiceConfig.provider === 'elevenlabs') {
    voiceConfig.model = mergedConfig.voice_model || 'eleven_multilingual_v2';
    if (mergedConfig.voice_stability !== undefined) voiceConfig.stability = mergedConfig.voice_stability;
    if (mergedConfig.voice_similarity_boost !== undefined) voiceConfig.similarityBoost = mergedConfig.voice_similarity_boost;
    if (mergedConfig.voice_style !== undefined) voiceConfig.style = mergedConfig.voice_style;
    if (mergedConfig.voice_use_speaker_boost !== undefined) voiceConfig.useSpeakerBoost = mergedConfig.voice_use_speaker_boost;
  }

  // Build transcriber config
  const transcriberConfig = {
    provider: mergedConfig.transcriber_provider || 'deepgram',
    model: mergedConfig.transcriber_model || 'nova-2',
    language: mergedConfig.transcriber_language || getTranscriberLanguage(language),
  };

  if (mergedConfig.transcriber_keywords?.length > 0) {
    transcriberConfig.keywords = mergedConfig.transcriber_keywords;
  }
  if (mergedConfig.transcriber_endpointing !== undefined) {
    transcriberConfig.endpointing = mergedConfig.transcriber_endpointing;
  }

  // Build model config
  const modelConfig = {
    provider: 'openai',
    model: mergedConfig.model || 'gpt-4o-mini',
    temperature: mergedConfig.temperature || 0.7,
    maxTokens: mergedConfig.max_tokens || 500,
    messages: [
      {
        role: 'system',
        content: promptData.systemPrompt,
      },
    ],
    tools,
  };

  // Build first message
  let firstMessage = mergedConfig.first_message || '';
  if (firstMessage) {
    firstMessage = firstMessage
      .replace(/{FIRMA_ADI}/g, tenant.name || 'Firma')
      .replace(/{ASISTAN_ADI}/g, tenant.assistant_name || 'Asistan');
  }

  // Build final assistant config
  const assistantConfig = {
    name: `${tenant.name} - ${language.toUpperCase()}`,
    transcriber: transcriberConfig,
    model: modelConfig,
    voice: voiceConfig,
    firstMessage,
    serverUrl: `${serverUrl}/vapi/webhook`,
    serverUrlSecret: config.vapi?.webhookSecret,
    // VAPI'ye hangi webhook event'lerini göndereceğini açıkça belirt
    serverMessages: [
      'end-of-call-report',
      'tool-calls',
      'status-update',
      'transfer-update',
    ],
    metadata: {
      tenantId: tenant.id,
      industry: tenant.industry,
      language,
    },
  };

  // Add optional configs
  if (mergedConfig.silence_timeout_seconds !== undefined) {
    assistantConfig.silenceTimeoutSeconds = Math.max(10, mergedConfig.silence_timeout_seconds);
  }
  if (mergedConfig.max_duration_seconds !== undefined) {
    assistantConfig.maxDurationSeconds = mergedConfig.max_duration_seconds;
  }
  if (mergedConfig.response_delay_seconds !== undefined) {
    assistantConfig.responseDelaySeconds = mergedConfig.response_delay_seconds;
  }
  if (mergedConfig.interruptions_enabled !== undefined) {
    assistantConfig.interruptionsEnabled = mergedConfig.interruptions_enabled;
  }
  if (mergedConfig.num_words_to_interrupt !== undefined) {
    assistantConfig.numWordsToInterruptAssistant = mergedConfig.num_words_to_interrupt;
  }
  if (mergedConfig.recording_enabled !== undefined) {
    assistantConfig.recordingEnabled = mergedConfig.recording_enabled;
  }
  if (mergedConfig.hipaa_enabled !== undefined) {
    assistantConfig.hipaaEnabled = mergedConfig.hipaa_enabled;
  }
  if (mergedConfig.end_call_message) {
    assistantConfig.endCallMessage = mergedConfig.end_call_message;
  }
  if (mergedConfig.end_call_phrases?.length > 0) {
    assistantConfig.endCallPhrases = mergedConfig.end_call_phrases;
  }

  return assistantConfig;
}

/**
 * Get transcriber language code
 * @param {string} langCode - Language code
 * @returns {string} - Transcriber language code
 */
function getTranscriberLanguage(langCode) {
  const languageMap = {
    'tr': 'tr',
    'en': 'en-US',
    'de': 'de',
  };
  return languageMap[langCode] || 'en-US';
}

/**
 * Main sync function - single entry point for all VAPI syncs
 * @param {string} tenantId - Tenant UUID
 * @param {string} reason - Sync reason for audit log
 * @param {string|null} language - Optional: sync specific language only
 * @returns {Object} - Sync results
 */
async function syncTenant(tenantId, reason = SYNC_REASONS.MANUAL, language = null) {
  console.log(`[VapiSyncService] Starting sync for tenant ${tenantId}, reason: ${reason}`);

  const tenant = await getTenantInfo(tenantId);
  const promptCompiler = getPromptCompiler();
  const vapiService = getVapiService();

  // Invalidate prompt cache first
  promptCompiler.invalidate(tenantId);

  const results = [];
  const languagesToSync = language ? [language] : (tenant.supported_languages || ['tr']);

  for (const lang of languagesToSync) {
    const assistantIdColumn = `vapi_assistant_id_${lang}`;
    const existingAssistantId = tenant[assistantIdColumn];

    try {
      // Build prompt using PromptCompiler
      const promptData = await promptCompiler.buildFinalPrompt(tenantId, lang);

      // Build VAPI config
      const assistantConfig = await buildVapiConfig(tenant, lang, promptData);

      // Log prompt details for debugging
      console.log(`[VapiSyncService] Prompt length: ${promptData.systemPrompt.length}, ends with: ...${promptData.systemPrompt.slice(-100)}`);

      if (existingAssistantId) {
        // Update existing assistant - force update for startup sync
        const forceUpdate = reason === 'startup_sync';
        console.log(`[VapiSyncService] Updating assistant ${existingAssistantId} for ${lang} (force: ${forceUpdate})`);
        const updated = await vapiService.updateAssistant(existingAssistantId, assistantConfig, { force: forceUpdate });
        results.push({
          language: lang,
          action: 'updated',
          assistantId: existingAssistantId,
          toolCount: promptData.toolNames.length,
          useCaseCount: promptData.useCases.length,
        });

        // Log sync
        await logSync({
          tenantId,
          action: 'update_assistant',
          language: lang,
          reason,
          vapiAssistantId: existingAssistantId,
          status: 'success',
          details: {
            toolCount: promptData.toolNames.length,
            useCaseCount: promptData.useCases.length,
          },
        });
      } else {
        // Create new assistant
        console.log(`[VapiSyncService] Creating new assistant for ${lang}`);
        const created = await vapiService.createAssistant(tenantId, lang);
        results.push({
          language: lang,
          action: 'created',
          assistantId: created.id,
        });

        // Log sync
        await logSync({
          tenantId,
          action: 'create_assistant',
          language: lang,
          reason,
          vapiAssistantId: created.id,
          status: 'success',
        });
      }
    } catch (error) {
      console.error(`[VapiSyncService] Error syncing ${lang} for tenant ${tenantId}:`, error);
      results.push({
        language: lang,
        action: 'error',
        error: error.message,
      });

      // Log error
      await logSync({
        tenantId,
        action: 'sync_error',
        language: lang,
        reason,
        status: 'failed',
        errorMessage: error.message,
      });
    }
  }

  console.log(`[VapiSyncService] Completed sync for tenant ${tenantId}: ${results.length} languages processed`);
  return {
    tenantId,
    tenantName: tenant.name,
    reason,
    results,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Log sync operation for audit trail
 * @param {Object} logData - Log data
 */
async function logSync(logData) {
  const {
    tenantId,
    presetId,
    action,
    language,
    reason,
    vapiAssistantId,
    vapiResponse,
    status,
    errorMessage,
    details,
  } = logData;

  try {
    const { error } = await supabase
      .from('vapi_sync_log')
      .insert({
        tenant_id: tenantId,
        preset_id: presetId,
        action,
        language,
        vapi_assistant_id: vapiAssistantId,
        vapi_response: vapiResponse || details,
        status,
        error_message: errorMessage,
        completed_at: status !== 'pending' ? new Date().toISOString() : null,
      });

    if (error) {
      console.error('[VapiSyncService] Error logging sync:', error);
    }
  } catch (err) {
    console.error('[VapiSyncService] Error logging sync:', err);
  }
}

/**
 * Sync all tenants for a specific industry (after preset change)
 * @param {string} industry - Industry code
 * @param {string} language - Language to sync
 * @returns {Array} - Sync results for all tenants
 */
async function syncIndustryTenants(industry, language) {
  console.log(`[VapiSyncService] Syncing all tenants for industry ${industry}, language ${language}`);

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('industry', industry)
    .eq('is_active', true);

  if (error) {
    throw error;
  }

  const results = [];

  for (const tenant of tenants || []) {
    try {
      const syncResult = await syncTenant(tenant.id, SYNC_REASONS.PRESET_CHANGE, language);
      results.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        success: true,
        results: syncResult.results,
      });
    } catch (err) {
      console.error(`[VapiSyncService] Error syncing tenant ${tenant.id}:`, err);
      results.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        success: false,
        error: err.message,
      });
    }
  }

  console.log(`[VapiSyncService] Completed industry sync: ${results.length} tenants processed`);
  return results;
}

/**
 * Get sync logs for a tenant
 * @param {string} tenantId - Tenant UUID
 * @param {number} limit - Max results
 * @returns {Array} - Sync logs
 */
async function getSyncLogs(tenantId, limit = 20) {
  const { data, error } = await supabase
    .from('vapi_sync_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[VapiSyncService] Error fetching sync logs:', error);
    return [];
  }

  return data || [];
}

/**
 * Check if tenant needs sync (prompt or config changed)
 * @param {string} tenantId - Tenant UUID
 * @returns {boolean} - Whether sync is needed
 */
async function needsSync(tenantId) {
  // For now, always return true
  // Future: implement diff checking
  return true;
}

module.exports = {
  // Main sync function
  syncTenant,

  // Bulk sync
  syncIndustryTenants,

  // Logs
  getSyncLogs,
  logSync,

  // Helpers
  needsSync,
  buildVapiConfig,
  getTenantInfo,

  // Constants
  SYNC_REASONS,
};
