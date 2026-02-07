/**
 * VAPI Service
 * VAPI API entegrasyonu ve assistant yonetimi
 *
 * NOTE: For syncing tenants to VAPI, prefer using VapiSyncService.syncTenant()
 * which uses PromptCompiler as the single source of truth.
 * This service provides low-level VAPI API access.
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');
const { getFunctionDefinitions } = require('../prompts/functions');
const useCaseService = require('./useCaseService');
const { buildUseCasePromptSections } = require('../prompts/useCasePrompts');

// VAPI service manages tenants and syncs to VAPI API, needs serviceRoleKey
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
const supabaseAdmin = supabase; // Alias for backward compatibility

// Lazy load PromptCompiler to avoid circular dependencies
let _promptCompiler = null;
function getPromptCompiler() {
  if (!_promptCompiler) {
    _promptCompiler = require('./promptCompiler');
  }
  return _promptCompiler;
}

const VAPI_API_BASE = 'https://api.vapi.ai';

/**
 * Türkçe ünlü uyumuna göre "-dan/-den/-tan/-ten" ekini belirle
 * @param {string} name - Firma adı
 * @returns {string} - Uygun ek ("'dan", "'den", "'tan", "'ten")
 */
function getTurkishSuffix(name) {
  if (!name) return "'dan";

  const lastChar = name.slice(-1).toLowerCase();
  const hardConsonants = ['p', 'ç', 't', 'k', 's', 'ş', 'h', 'f'];

  // Son ünlüyü bul
  const vowels = name.match(/[aeıioöuü]/gi);
  const lastVowel = vowels ? vowels[vowels.length - 1].toLowerCase() : 'a';
  const isHardVowel = ['a', 'ı', 'o', 'u'].includes(lastVowel);

  // Sert ünsüzle mi bitiyor?
  const isHardConsonant = hardConsonants.includes(lastChar);

  if (isHardVowel) {
    return isHardConsonant ? "'tan" : "'dan";
  } else {
    return isHardConsonant ? "'ten" : "'den";
  }
}

/**
 * Dil kodunu transcriber language formatına çevir
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
 * Tool çağrılırken kullanılacak doğal geçiş mesajı
 * @param {string} toolName - Tool adı
 * @param {string} language - Dil kodu (tr, en, de)
 * @returns {string} - Doğal geçiş mesajı
 */
function getToolStartMessage(toolName, language) {
  // Daha doğal, konuşma dilinde mesajlar - "..." ile biten cümleler TTS'de daha yumuşak okunur
  const messages = {
    tr: {
      // Automotive tools - doğal, düşünür gibi
      get_available_time_slots: 'Bakayım müsait saatlere...',
      get_available_vehicles: 'Bakayım araçlara...',
      create_test_drive_appointment: 'Randevunuzu oluşturuyorum...',
      create_service_appointment: 'Servis randevunuzu oluşturuyorum...',
      get_my_appointments: 'Bakayım randevularınıza...',
      cancel_appointment: 'İptal ediyorum...',
      reschedule_appointment: 'Güncelliyorum...',
      get_business_info: 'Bakayım...',
      get_working_hours: 'Bakayım çalışma saatlerine...',
      get_service_price: 'Bakayım fiyata...',
      get_customer_history: 'Bakayım geçmişinize...',
      get_active_promotions: 'Bakayım kampanyalara...',
      get_loyalty_points: 'Bakayım puanınıza...',
      apply_promo_code: 'Kontrol ediyorum...',
      submit_complaint: 'Kaydediyorum...',
      // Beauty/Hairdresser tools
      get_beauty_services: 'Bakayım hizmetlere...',
      get_hairdresser_services: 'Bakayım hizmetlere...',
      create_beauty_appointment: 'Randevunuzu oluşturuyorum...',
      get_available_staff: 'Bakayım personellere...',
      book_with_staff: 'Randevunuzu oluşturuyorum...',
      default: 'Bakayım...',
    },
    en: {
      // Automotive tools - natural, thinking style
      get_available_time_slots: 'Let me check the available times...',
      get_available_vehicles: 'Let me check the vehicles...',
      create_test_drive_appointment: 'Creating your appointment...',
      create_service_appointment: 'Creating your service appointment...',
      get_my_appointments: 'Let me check your appointments...',
      cancel_appointment: 'Cancelling...',
      reschedule_appointment: 'Updating...',
      get_business_info: 'Let me check...',
      get_working_hours: 'Let me check the hours...',
      get_service_price: 'Let me check the price...',
      get_customer_history: 'Let me check your history...',
      get_active_promotions: 'Let me check the promotions...',
      get_loyalty_points: 'Let me check your points...',
      apply_promo_code: 'Checking the code...',
      submit_complaint: 'Recording...',
      // Beauty/Hairdresser tools
      get_beauty_services: 'Let me check the services...',
      get_hairdresser_services: 'Let me check the services...',
      create_beauty_appointment: 'Creating your appointment...',
      get_available_staff: 'Let me check the staff...',
      book_with_staff: 'Creating your appointment...',
      default: 'Let me check...',
    },
    de: {
      // Automotive tools - natural German
      get_available_time_slots: 'Moment, ich schaue nach den Zeiten...',
      get_available_vehicles: 'Moment, ich schaue nach den Fahrzeugen...',
      create_test_drive_appointment: 'Ich erstelle Ihren Termin...',
      create_service_appointment: 'Ich erstelle Ihren Servicetermin...',
      get_my_appointments: 'Moment, ich schaue nach Ihren Terminen...',
      cancel_appointment: 'Ich storniere...',
      reschedule_appointment: 'Ich aktualisiere...',
      get_business_info: 'Moment...',
      get_working_hours: 'Moment, ich schaue nach den Arbeitszeiten...',
      get_service_price: 'Moment, ich schaue nach dem Preis...',
      get_customer_history: 'Moment, ich schaue in Ihre Historie...',
      get_active_promotions: 'Moment, ich schaue nach den Aktionen...',
      get_loyalty_points: 'Moment, ich prüfe Ihre Punkte...',
      apply_promo_code: 'Ich prüfe den Code...',
      submit_complaint: 'Ich speichere...',
      // Beauty/Hairdresser tools
      get_beauty_services: 'Moment, ich schaue nach den Dienstleistungen...',
      get_hairdresser_services: 'Moment, ich schaue nach den Dienstleistungen...',
      create_beauty_appointment: 'Ich erstelle Ihren Termin...',
      get_available_staff: 'Moment, ich schaue nach dem Personal...',
      book_with_staff: 'Ich erstelle Ihren Termin...',
      default: 'Moment...',
    },
  };

  const langMessages = messages[language] || messages.tr;
  return langMessages[toolName] || langMessages.default;
}

/**
 * Tool çağrısı başarısız olduğunda kullanılacak mesaj
 * @param {string} language - Dil kodu (tr, en, de)
 * @returns {string} - Hata mesajı
 */
function getToolFailMessage(language) {
  const messages = {
    tr: 'Şu an buna ulaşamadım, başka bir konuda yardımcı olabilir miyim?',
    en: "I couldn't get that information right now, is there anything else I can help with?",
    de: 'Das konnte ich gerade nicht abrufen, kann ich Ihnen anders helfen?',
  };
  return messages[language] || messages.tr;
}

/**
 * VAPI API istegi gonder
 */
async function vapiRequest(endpoint, options = {}) {
  const { method = 'GET', body } = options;

  // Validate VAPI API key
  if (!config.vapi?.apiKey) {
    throw new Error('VAPI API key is not configured. Please set VAPI_API_KEY environment variable.');
  }

  const response = await fetch(`${VAPI_API_BASE}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${config.vapi.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`VAPI API Error: ${response.status} - ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Preset ve tenant bilgilerini merge et
 * @param {Object} presetConfig - Industry preset config
 * @param {Object} tenantOverride - Tenant override config
 * @param {Object} tenantInfo - Tenant bilgileri
 * @returns {Object} - Final config
 */
function mergeConfig(presetConfig, tenantOverride, tenantInfo) {
  // Base config'i kopyala
  const config = { ...presetConfig };

  // Tenant override varsa uzerine yaz
  if (tenantOverride) {
    Object.keys(tenantOverride).forEach(key => {
      if (tenantOverride[key] !== null && tenantOverride[key] !== undefined) {
        config[key] = tenantOverride[key];
      }
    });
  }

  // Tarih ve saat bilgisi
  const now = new Date();
  const dateStr = now.toLocaleDateString('tr-TR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Placeholder'lari degistir
  if (config.system_prompt) {
    config.system_prompt = config.system_prompt
      .replace(/{FIRMA_ADI}/g, tenantInfo.name || 'Firma')
      .replace(/{ASISTAN_ADI}/g, tenantInfo.assistant_name || 'Asistan')
      .replace(/{TELEFON}/g, tenantInfo.phone || '')
      .replace(/{EMAIL}/g, tenantInfo.email || '')
      .replace(/{ADRES}/g, tenantInfo.address || '')
      .replace(/{TARIH}/g, dateStr)
      .replace(/{SAAT}/g, timeStr);
  }

  if (config.first_message) {
    // Türkçe ünlü uyumlu firma adı eki
    const firmaSuffix = getTurkishSuffix(tenantInfo.name);
    config.first_message = config.first_message
      .replace(/{FIRMA_ADI_DAN}/g, (tenantInfo.name || 'Firma') + firmaSuffix)
      .replace(/{FIRMA_ADI}/g, tenantInfo.name || 'Firma')
      .replace(/{ASISTAN_ADI}/g, tenantInfo.assistant_name || 'Asistan');
  }

  return config;
}

/**
 * VAPI assistant config'ini olustur
 * Advanced settings dahil: voice, conversation, backchannel, recording
 */
function buildAssistantConfig(mergedConfig, tenantInfo, language, tools = []) {
  const serverUrl = config.vapi.serverUrl || config.server.url;

  // Tool definitions for VAPI
  // Note: VAPI'nin header desteği sınırlı olabilir, bu yüzden tenant ID'yi hem header hem query param olarak gönderiyoruz
  const toolDefinitions = tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters || { type: 'object', properties: {} },
    },
    server: {
      url: `${serverUrl}/vapi/tools?tenantId=${tenantInfo.id}`,
      headers: {
        'x-tenant-id': tenantInfo.id,
      },
    },
    // Doğal geçiş mesajları - "bir dakika" yerine context-aware mesajlar
    // NOT: request-complete tanımlanmıyor — VAPI default davranışıyla LLM tool sonucuna göre cevap üretir
    messages: [
      {
        type: 'request-start',
        content: getToolStartMessage(tool.name, language),
      },
      {
        type: 'request-failed',
        content: getToolFailMessage(language),
      },
    ],
  }));

  // Build voice config with advanced ElevenLabs settings
  const voiceConfig = {
    provider: mergedConfig.voice_provider || '11labs',
    voiceId: mergedConfig.voice_id,
    speed: mergedConfig.voice_speed || 1.0,
    language: language, // Force TTS language to prevent code-switching on alphanumeric strings
  };

  // Add ElevenLabs-specific voice settings if provider is 11labs/elevenlabs
  if (voiceConfig.provider === '11labs' || voiceConfig.provider === 'elevenlabs') {
    // Model is required for custom voice ID to work
    voiceConfig.model = mergedConfig.voice_model || 'eleven_multilingual_v2';

    if (mergedConfig.voice_stability !== undefined) {
      voiceConfig.stability = mergedConfig.voice_stability;
    }
    if (mergedConfig.voice_similarity_boost !== undefined) {
      voiceConfig.similarityBoost = mergedConfig.voice_similarity_boost;
    }
    if (mergedConfig.voice_style !== undefined) {
      voiceConfig.style = mergedConfig.voice_style;
    }
    if (mergedConfig.voice_use_speaker_boost !== undefined) {
      voiceConfig.useSpeakerBoost = mergedConfig.voice_use_speaker_boost;
    }
  }

  // Build model config with advanced settings
  const modelConfig = {
    provider: 'openai',
    model: mergedConfig.model || 'gpt-4o-mini',
    temperature: mergedConfig.temperature || 0.7,
    maxTokens: mergedConfig.max_tokens || 500,
    messages: [
      {
        role: 'system',
        content: mergedConfig.system_prompt,
      },
    ],
    tools: toolDefinitions,
  };

  // Note: Advanced model settings (topP, presencePenalty, frequencyPenalty)
  // are stored in DB but not sent to VAPI as they're not supported
  // emotionRecognitionEnabled is also not supported by VAPI currently

  // Build transcriber config
  const transcriberConfig = {
    provider: mergedConfig.transcriber_provider || 'deepgram',
    model: mergedConfig.transcriber_model || 'nova-2',
    language: mergedConfig.transcriber_language || getTranscriberLanguage(language),
  };

  // Add optional transcriber settings
  if (mergedConfig.transcriber_keywords && mergedConfig.transcriber_keywords.length > 0) {
    transcriberConfig.keywords = mergedConfig.transcriber_keywords;
  }
  if (mergedConfig.transcriber_endpointing !== undefined) {
    transcriberConfig.endpointing = mergedConfig.transcriber_endpointing;
  }

  // Build assistant config
  const assistantConfig = {
    name: `${tenantInfo.name} - ${language.toUpperCase()}`,
    transcriber: transcriberConfig,
    model: modelConfig,
    voice: voiceConfig,
    firstMessage: mergedConfig.first_message,
    serverUrl: `${serverUrl}/vapi/webhook`,
    serverUrlSecret: config.vapi.webhookSecret,
    // VAPI'ye hangi webhook event'lerini göndereceğini açıkça belirt
    serverMessages: [
      'end-of-call-report',
      'tool-calls',
      'status-update',
      'transfer-update',
    ],
    metadata: {
      tenantId: tenantInfo.id,
      industry: tenantInfo.industry,
      language: language,
    },
  };

  // Add conversation settings
  if (mergedConfig.silence_timeout_seconds !== undefined) {
    // VAPI requires minimum 10 seconds
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

  // Note: Backchannel settings stored in DB for future use
  // VAPI doesn't support backchannel directly yet
  // When VAPI adds support, uncomment below:
  // if (mergedConfig.backchannel_enabled) {
  //   assistantConfig.backchannel = {
  //     enabled: true,
  //     words: mergedConfig.backchannel_words || [],
  //   };
  // }

  // Add recording settings
  if (mergedConfig.recording_enabled !== undefined) {
    assistantConfig.recordingEnabled = mergedConfig.recording_enabled;
  }
  if (mergedConfig.hipaa_enabled !== undefined) {
    assistantConfig.hipaaEnabled = mergedConfig.hipaa_enabled;
  }

  // Add end call settings
  if (mergedConfig.end_call_message) {
    assistantConfig.endCallMessage = mergedConfig.end_call_message;
  }
  if (mergedConfig.end_call_phrases && mergedConfig.end_call_phrases.length > 0) {
    assistantConfig.endCallPhrases = mergedConfig.end_call_phrases;
  }

  return assistantConfig;
}

/**
 * VAPI Assistant olustur
 * @param {string} tenantId - Tenant UUID
 * @param {string} language - Dil kodu (tr, en, de)
 * @param {Object} customConfig - Ozel config (opsiyonel)
 * @returns {Object} - VAPI assistant
 */
async function createAssistant(tenantId, language, customConfig = null) {
  // Tenant bilgisini al
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (tenantError || !tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  // Industry preset'i al
  const { data: preset, error: presetError } = await supabaseAdmin
    .from('industry_presets')
    .select('*')
    .eq('industry', tenant.industry)
    .single();

  if (presetError || !preset) {
    throw new Error(`Industry preset not found: ${tenant.industry}`);
  }

  // Dil config'ini al
  const configColumn = `config_${language}`;
  const presetConfig = preset[configColumn] || preset.config_tr || {};

  // Config'i merge et
  const mergedConfig = mergeConfig(
    presetConfig,
    customConfig || tenant.voice_config_override,
    tenant
  );

  // Use Case bazlı tool ve prompt sistemi
  let tools = [];
  let useCasePromptSections = '';

  try {
    // Tenant'ın aktif use case'lerini al
    const tenantUseCases = await useCaseService.getTenantUseCases(tenantId);

    if (tenantUseCases && tenantUseCases.length > 0) {
      // Use case bazlı tool'ları al
      const toolDefs = useCaseService.getToolDefinitionsForUseCases(tenantUseCases);
      tools = toolDefs.map(def => ({
        name: def.function.name,
        description: def.function.description,
        parameters: def.function.parameters,
      }));

      // Use case bazlı prompt bölümlerini al
      useCasePromptSections = buildUseCasePromptSections(tenantUseCases, language);

      console.log(`[VapiService] Using ${tenantUseCases.length} use cases with ${tools.length} tools for tenant ${tenant.name}`);
    } else {
      // Fallback: Use case yoksa eski industry-based sistemi kullan
      console.log(`[VapiService] No use cases found for tenant ${tenant.name}, using industry-based tools`);
      const functionDefs = getFunctionDefinitions(tenant.industry);
      tools = functionDefs.map(def => ({
        name: def.function.name,
        description: def.function.description,
        parameters: def.function.parameters,
      }));
    }
  } catch (useCaseError) {
    // Use case sistemi hata verirse fallback olarak industry-based kullan
    console.warn(`[VapiService] Use case error, falling back to industry-based tools:`, useCaseError.message);
    const functionDefs = getFunctionDefinitions(tenant.industry);
    tools = functionDefs.map(def => ({
      name: def.function.name,
      description: def.function.description,
      parameters: def.function.parameters,
    }));
  }

  // Use case prompt bölümlerini sistem prompt'a ekle
  if (useCasePromptSections && mergedConfig.system_prompt) {
    if (mergedConfig.system_prompt.includes('{USE_CASE_SECTIONS}')) {
      // Placeholder varsa, yerine koy
      mergedConfig.system_prompt = mergedConfig.system_prompt
        .replace(/{USE_CASE_SECTIONS}/g, useCasePromptSections);
    } else {
      // Placeholder yoksa, prompt'un sonuna ekle (fallback)
      console.log(`[VapiService] No {USE_CASE_SECTIONS} placeholder found, appending to end`);
      mergedConfig.system_prompt = mergedConfig.system_prompt + '\n\n' + useCasePromptSections;
    }
  }

  // VAPI assistant config'i olustur
  const assistantConfig = buildAssistantConfig(mergedConfig, tenant, language, tools);

  // VAPI'de assistant olustur
  const assistant = await vapiRequest('/assistant', {
    method: 'POST',
    body: assistantConfig,
  });

  // Tenant'a assistant ID'yi kaydet
  const assistantIdColumn = `vapi_assistant_id_${language}`;
  await supabaseAdmin
    .from('tenants')
    .update({ [assistantIdColumn]: assistant.id })
    .eq('id', tenantId);

  // Sync log kaydet
  await logSync({
    tenantId,
    presetId: preset.id,
    action: 'create_assistant',
    language,
    vapiAssistantId: assistant.id,
    vapiResponse: assistant,
    status: 'success',
  });

  console.log(`[VapiService] Created assistant for ${tenant.name} (${language}): ${assistant.id}`);
  return assistant;
}

/**
 * VAPI Assistant guncelle
 * @param {string} assistantId - VAPI Assistant ID
 * @param {Object} config - Guncellenecek config
 */
/**
 * İki config'i karşılaştır - önemli alanlar değişmiş mi?
 */
function hasConfigChanged(currentConfig, newConfig) {
  // Karşılaştırılacak önemli alanlar
  const compareFields = [
    'name',
    'firstMessage',
    'silenceTimeoutSeconds',
    'maxDurationSeconds',
    'responseDelaySeconds',
    'interruptionsEnabled',
    'numWordsToInterruptAssistant',
    'recordingEnabled',
    'endCallMessage',
  ];

  // Basit alanları karşılaştır
  for (const field of compareFields) {
    if (JSON.stringify(currentConfig[field]) !== JSON.stringify(newConfig[field])) {
      console.log(`[VapiService] Config changed: ${field}`);
      return true;
    }
  }

  // Model karşılaştır
  if (currentConfig.model && newConfig.model) {
    const modelFields = ['model', 'temperature', 'maxTokens'];
    for (const field of modelFields) {
      if (currentConfig.model[field] !== newConfig.model[field]) {
        console.log(`[VapiService] Model config changed: ${field}`);
        return true;
      }
    }
    // System prompt karşılaştır
    const currentPrompt = currentConfig.model.messages?.[0]?.content || '';
    const newPrompt = newConfig.model.messages?.[0]?.content || '';
    if (currentPrompt !== newPrompt) {
      console.log(`[VapiService] System prompt changed`);
      return true;
    }
  }

  // Voice karşılaştır
  if (currentConfig.voice && newConfig.voice) {
    const voiceFields = ['provider', 'voiceId', 'speed', 'stability', 'similarityBoost', 'style', 'useSpeakerBoost'];
    for (const field of voiceFields) {
      if (currentConfig.voice[field] !== newConfig.voice[field]) {
        console.log(`[VapiService] Voice config changed: ${field}`);
        return true;
      }
    }
  }

  // Transcriber karşılaştır
  if (currentConfig.transcriber && newConfig.transcriber) {
    const transcriberFields = ['provider', 'model', 'language', 'endpointing'];
    for (const field of transcriberFields) {
      if (currentConfig.transcriber[field] !== newConfig.transcriber[field]) {
        console.log(`[VapiService] Transcriber config changed: ${field}`);
        return true;
      }
    }
  }

  return false;
}

async function updateAssistant(assistantId, updateConfig) {
  // Önce mevcut config'i al
  const currentAssistant = await getAssistant(assistantId);

  // Değişiklik var mı kontrol et
  if (!hasConfigChanged(currentAssistant, updateConfig)) {
    console.log(`[VapiService] No changes detected for assistant ${assistantId}, skipping update`);
    return currentAssistant;
  }

  // Debug: Kaç tool gönderildiğini logla
  const toolCount = updateConfig?.model?.tools?.length || 0;
  console.log(`[VapiService] Updating assistant ${assistantId} with ${toolCount} tools`);
  if (toolCount > 0) {
    console.log(`[VapiService] Tool names:`, updateConfig.model.tools.map(t => t.function?.name || t.name));
  }

  const assistant = await vapiRequest(`/assistant/${assistantId}`, {
    method: 'PATCH',
    body: updateConfig,
  });

  console.log(`[VapiService] Updated assistant: ${assistantId}`);
  return assistant;
}

/**
 * VAPI Assistant sil
 * @param {string} assistantId - VAPI Assistant ID
 */
async function deleteAssistant(assistantId) {
  await vapiRequest(`/assistant/${assistantId}`, {
    method: 'DELETE',
  });

  console.log(`[VapiService] Deleted assistant: ${assistantId}`);
  return { deleted: true };
}

/**
 * VAPI Assistant bilgisi al
 * @param {string} assistantId - VAPI Assistant ID
 */
async function getAssistant(assistantId) {
  return vapiRequest(`/assistant/${assistantId}`);
}

/**
 * Tenant'i VAPI'ye sync et
 * @param {string} tenantId - Tenant UUID
 * @param {string} language - Dil kodu (tr, en, de) - belirtilirse sadece o dil icin sync yapar
 */
async function syncTenantToVapi(tenantId, language = null) {
  // Tenant bilgisini al
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (tenantError || !tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  const results = [];

  // Belirli bir dil verilmisse sadece o dil, yoksa tum desteklenen diller
  const languagesToSync = language ? [language] : (tenant.supported_languages || ['tr']);

  for (const lang of languagesToSync) {
    const assistantIdColumn = `vapi_assistant_id_${lang}`;
    const existingAssistantId = tenant[assistantIdColumn];

    try {
      if (existingAssistantId) {
        // Mevcut assistant'i guncelle
        const { data: preset } = await supabaseAdmin
          .from('industry_presets')
          .select('*')
          .eq('industry', tenant.industry)
          .single();

        const configColumn = `config_${lang}`;
        const presetConfig = preset?.[configColumn] || preset?.config_tr || {};
        const mergedConfig = mergeConfig(presetConfig, tenant.voice_config_override, tenant);

        // Use Case bazlı tool ve prompt sistemi
        let tools = [];
        let useCasePromptSections = '';

        try {
          const tenantUseCases = await useCaseService.getTenantUseCases(tenantId);

          if (tenantUseCases && tenantUseCases.length > 0) {
            const toolDefs = useCaseService.getToolDefinitionsForUseCases(tenantUseCases);
            tools = toolDefs.map(def => ({
              name: def.function.name,
              description: def.function.description,
              parameters: def.function.parameters,
            }));
            useCasePromptSections = buildUseCasePromptSections(tenantUseCases, lang);
            console.log(`[VapiService] Sync: Using ${tenantUseCases.length} use cases with ${tools.length} tools`);
          } else {
            const functionDefs = getFunctionDefinitions(tenant.industry);
            tools = functionDefs.map(def => ({
              name: def.function.name,
              description: def.function.description,
              parameters: def.function.parameters,
            }));
          }
        } catch (useCaseError) {
          console.warn(`[VapiService] Sync: Use case error, falling back:`, useCaseError.message);
          const functionDefs = getFunctionDefinitions(tenant.industry);
          tools = functionDefs.map(def => ({
            name: def.function.name,
            description: def.function.description,
            parameters: def.function.parameters,
          }));
        }

        // Use case prompt bölümlerini sistem prompt'a ekle
        if (useCasePromptSections && mergedConfig.system_prompt) {
          if (mergedConfig.system_prompt.includes('{USE_CASE_SECTIONS}')) {
            // Placeholder varsa, yerine koy
            mergedConfig.system_prompt = mergedConfig.system_prompt
              .replace(/{USE_CASE_SECTIONS}/g, useCasePromptSections);
          } else {
            // Placeholder yoksa, prompt'un sonuna ekle (fallback)
            console.log(`[VapiService] No {USE_CASE_SECTIONS} placeholder found for ${lang}, appending to end`);
            mergedConfig.system_prompt = mergedConfig.system_prompt + '\n\n' + useCasePromptSections;
          }
        }

        const assistantConfig = buildAssistantConfig(mergedConfig, tenant, lang, tools);

        const updated = await updateAssistant(existingAssistantId, assistantConfig);
        results.push({ language: lang, action: 'updated', assistant: updated });

        await logSync({
          tenantId,
          presetId: preset?.id,
          action: 'update_assistant',
          language: lang,
          vapiAssistantId: existingAssistantId,
          vapiResponse: updated,
          status: 'success',
        });
      } else {
        // Yeni assistant olustur
        const assistant = await createAssistant(tenantId, lang);
        results.push({ language: lang, action: 'created', assistant });

        // Yeni dili tenant'in supported_languages'ina ekle
        const currentLanguages = tenant.supported_languages || [];
        if (!currentLanguages.includes(lang)) {
          await supabaseAdmin
            .from('tenants')
            .update({ supported_languages: [...currentLanguages, lang] })
            .eq('id', tenantId);
          console.log(`[VapiService] Added ${lang} to supported_languages for tenant ${tenantId}`);
        }
      }
    } catch (error) {
      console.error(`[VapiService] Error syncing ${lang} for tenant ${tenantId}:`, error);
      results.push({ language: lang, action: 'error', error: error.message });

      await logSync({
        tenantId,
        action: 'sync_tenant',
        language: lang,
        status: 'failed',
        errorMessage: error.message,
      });
    }
  }

  return results;
}

/**
 * Preset degisince tum tenant'lari guncelle
 * @param {string} industry - Industry kodu (automotive, beauty, etc.)
 * @param {string} language - Dil kodu (tr, en, de) - sadece bu dil icin sync yapar
 */
async function syncPresetToAllTenants(industry, language) {
  if (!language) {
    throw new Error('Language is required for preset sync');
  }

  // Industry preset'i al
  const { data: preset, error: presetError } = await supabaseAdmin
    .from('industry_presets')
    .select('*')
    .eq('industry', industry)
    .single();

  if (presetError || !preset) {
    throw new Error(`Industry preset not found: ${industry}`);
  }

  // Bu industry'deki tum aktif tenant'lari al
  const { data: tenants, error: tenantsError } = await supabaseAdmin
    .from('tenants')
    .select('id, name, supported_languages, vapi_assistant_id_tr, vapi_assistant_id_en, vapi_assistant_id_de')
    .eq('industry', industry)
    .eq('is_active', true);

  if (tenantsError) {
    throw tenantsError;
  }

  const results = [];

  for (const tenant of tenants || []) {
    try {
      // Sadece belirtilen dil icin sync yap
      const syncResult = await syncTenantToVapi(tenant.id, language);
      results.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        language,
        results: syncResult,
      });
    } catch (error) {
      console.error(`[VapiService] Error syncing tenant ${tenant.id} for ${language}:`, error);
      results.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        language,
        error: error.message,
      });
    }
  }

  // Sync log kaydet
  await logSync({
    presetId: preset.id,
    action: 'sync_preset',
    language,
    status: 'success',
    vapiResponse: { tenantsUpdated: results.length, language },
  });

  console.log(`[VapiService] Synced ${results.length} tenants for ${industry} preset (${language})`);
  return results;
}

/**
 * Initiate outbound call via VAPI
 * @param {string} assistantId - VAPI Assistant ID
 * @param {string} phoneNumber - Phone number to call
 * @param {Object} options - Additional call options
 */
async function initiateOutboundCall(assistantId, phoneNumber, options = {}) {
  const callConfig = {
    assistantId,
    phoneNumber: {
      twilioPhoneNumber: config.vapi.defaultPhoneNumber,
    },
    customer: {
      number: phoneNumber,
    },
    ...options,
  };

  const call = await vapiRequest('/call/phone', {
    method: 'POST',
    body: callConfig,
  });

  console.log(`[VapiService] Initiated outbound call to ${phoneNumber}: ${call.id}`);
  return call;
}

/**
 * VAPI telefon numarasi olustur
 * @param {string} tenantId - Tenant UUID
 * @param {Object} options - Telefon numara ayarlari
 */
async function createPhoneNumber(tenantId, options = {}) {
  const { provider = 'twilio', areaCode } = options;

  // Tenant bilgisini al
  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (error || !tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  // Default assistant ID'yi belirle
  const defaultLang = tenant.default_language || 'tr';
  const assistantIdColumn = `vapi_assistant_id_${defaultLang}`;
  const assistantId = tenant[assistantIdColumn];

  if (!assistantId) {
    throw new Error(`No VAPI assistant found for tenant ${tenantId} (${defaultLang})`);
  }

  // VAPI'den telefon numarasi al
  const phoneNumber = await vapiRequest('/phone-number', {
    method: 'POST',
    body: {
      provider,
      number: areaCode ? { areaCode } : undefined,
      assistantId,
      name: `${tenant.name} - Phone`,
    },
  });

  // Tenant'a telefon numarasini kaydet
  await supabaseAdmin
    .from('tenants')
    .update({ vapi_phone_number_id: phoneNumber.id })
    .eq('id', tenantId);

  console.log(`[VapiService] Created phone number for ${tenant.name}: ${phoneNumber.number}`);
  return phoneNumber;
}

/**
 * VAPI assistant ID'ye gore tenant bul
 * @param {string} assistantId - VAPI Assistant ID
 */
async function getTenantByVapiAssistant(assistantId) {
  console.log('[VapiService] getTenantByVapiAssistant - searching for assistantId:', assistantId);

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .or(`vapi_assistant_id_tr.eq.${assistantId},vapi_assistant_id_en.eq.${assistantId},vapi_assistant_id_de.eq.${assistantId}`)
    .single();

  console.log('[VapiService] getTenantByVapiAssistant - result:', {
    found: !!data,
    tenantId: data?.id,
    tenantName: data?.name,
    vapi_assistant_id_tr: data?.vapi_assistant_id_tr,
    error: error?.code,
  });

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Tenant voice config'ini al (preset + override merged)
 * @param {string} tenantId - Tenant UUID
 * @param {string} language - Dil kodu
 */
async function getTenantVapiConfig(tenantId, language = 'tr') {
  // Tenant bilgisini al
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (tenantError || !tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  // Industry preset'i al
  const { data: preset, error: presetError } = await supabaseAdmin
    .from('industry_presets')
    .select('*')
    .eq('industry', tenant.industry)
    .single();

  if (presetError || !preset) {
    throw new Error(`Industry preset not found: ${tenant.industry}`);
  }

  const configColumn = `config_${language}`;
  const presetConfig = preset[configColumn] || preset.config_tr || {};

  // Tools al - getFunctionDefinitions'dan tam tanımları al
  const functionDefs = getFunctionDefinitions(tenant.industry);
  const tools = functionDefs.map(def => ({
    name: def.function.name,
    description: def.function.description,
    parameters: def.function.parameters,
  }));

  // Merged config dondur
  return {
    preset: presetConfig,
    override: tenant.voice_config_override,
    merged: mergeConfig(presetConfig, tenant.voice_config_override, tenant),
    tools: tools,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      industry: tenant.industry,
      assistantId: tenant[`vapi_assistant_id_${language}`],
    },
  };
}

/**
 * Tenant voice config'ini guncelle (override)
 * @param {string} tenantId - Tenant UUID
 * @param {Object} overrideConfig - Override edilecek ayarlar
 */
async function updateTenantVoiceConfig(tenantId, overrideConfig) {
  // Mevcut override'i al
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('voice_config_override')
    .eq('id', tenantId)
    .single();

  if (tenantError) throw tenantError;

  // Mevcut override ile merge et
  const newOverride = {
    ...(tenant?.voice_config_override || {}),
    ...overrideConfig,
  };

  // Kaydet
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .update({ voice_config_override: newOverride })
    .eq('id', tenantId)
    .select()
    .single();

  if (error) throw error;

  console.log(`[VapiService] Updated voice config override for tenant ${tenantId}`);
  return data;
}

/**
 * Sync log kaydet
 */
async function logSync(logData) {
  const {
    tenantId,
    presetId,
    action,
    language,
    vapiAssistantId,
    vapiResponse,
    status,
    errorMessage,
  } = logData;

  const { error } = await supabaseAdmin
    .from('vapi_sync_log')
    .insert({
      tenant_id: tenantId,
      preset_id: presetId,
      action,
      language,
      vapi_assistant_id: vapiAssistantId,
      vapi_response: vapiResponse,
      status,
      error_message: errorMessage,
      completed_at: status !== 'pending' ? new Date().toISOString() : null,
    });

  if (error) {
    console.error('[VapiService] Error logging sync:', error);
  }
}

/**
 * Sync log'larini getir
 */
async function getSyncLogs(filters = {}) {
  let query = supabase
    .from('vapi_sync_log')
    .select(`
      *,
      tenant:tenants(id, name, slug),
      preset:industry_presets(id, industry, name_tr)
    `)
    .order('created_at', { ascending: false });

  if (filters.tenantId) {
    query = query.eq('tenant_id', filters.tenantId);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Master asistan oluştur (Tenant'tan bağımsız, preset bazlı)
 * Bu asistan, yeni tenant geldiğinde duplicate edilecek ana şablondur.
 * @param {string} industry - Industry kodu (automotive, beauty, etc.)
 * @param {string} language - Dil kodu (tr, en, de)
 */
async function createMasterAssistant(industry, language) {
  // Industry preset'i al
  const { data: preset, error: presetError } = await supabaseAdmin
    .from('industry_presets')
    .select('*')
    .eq('industry', industry)
    .single();

  if (presetError || !preset) {
    throw new Error(`Industry preset not found: ${industry}`);
  }

  // Dil config'ini al
  const configColumn = `config_${language}`;
  const presetConfig = preset[configColumn] || preset.config_tr || {};

  // Master asistan için placeholder bilgiler
  const masterTenantInfo = {
    id: `master-${industry}`,
    name: '{FIRMA_ADI}', // Placeholder - tenant oluşturulunca değiştirilecek
    industry: industry,
    phone: '{TELEFON}',
    email: '{EMAIL}',
    address: '{ADRES}',
    assistant_name: preset[`default_assistant_name_${language}`] || 'Asistan',
  };

  // Config'i merge et (placeholder'lar korunacak)
  const mergedConfig = mergeConfig(presetConfig, null, masterTenantInfo);

  // Tools al
  const functionDefs = getFunctionDefinitions(industry);
  const tools = functionDefs.map(def => ({
    name: def.function.name,
    description: def.function.description,
    parameters: def.function.parameters,
  }));

  // VAPI assistant config'i oluştur
  const assistantConfig = buildAssistantConfig(mergedConfig, masterTenantInfo, language, tools);

  // Master asistan için ismi değiştir
  assistantConfig.name = `[MASTER] ${preset[`name_${language}`] || industry} - ${language.toUpperCase()}`;
  assistantConfig.metadata = {
    ...assistantConfig.metadata,
    isMaster: true,
    presetId: preset.id,
  };

  // Mevcut master asistan var mı kontrol et
  const existingAssistantId = preset[`vapi_master_assistant_id_${language}`];

  let assistant;
  if (existingAssistantId) {
    // Mevcut asistanı güncelle
    try {
      assistant = await updateAssistant(existingAssistantId, assistantConfig);
      console.log(`[VapiService] Updated master assistant for ${industry} (${language}): ${assistant.id}`);
    } catch (error) {
      // Asistan VAPI'de yoksa yeni oluştur
      console.log(`[VapiService] Master assistant not found in VAPI, creating new one...`);
      assistant = await vapiRequest('/assistant', {
        method: 'POST',
        body: assistantConfig,
      });
    }
  } else {
    // Yeni asistan oluştur
    assistant = await vapiRequest('/assistant', {
      method: 'POST',
      body: assistantConfig,
    });
  }

  // Preset'e master assistant ID'yi kaydet
  const assistantIdColumn = `vapi_master_assistant_id_${language}`;
  await supabaseAdmin
    .from('industry_presets')
    .update({ [assistantIdColumn]: assistant.id })
    .eq('industry', industry);

  // Sync log kaydet
  await logSync({
    presetId: preset.id,
    action: 'create_master_assistant',
    language,
    vapiAssistantId: assistant.id,
    vapiResponse: assistant,
    status: 'success',
  });

  console.log(`[VapiService] Created/Updated master assistant for ${industry} (${language}): ${assistant.id}`);
  return assistant;
}

/**
 * Master asistanı sil
 * @param {string} industry - Industry kodu
 * @param {string} language - Dil kodu
 */
async function deleteMasterAssistant(industry, language) {
  const { data: preset, error } = await supabaseAdmin
    .from('industry_presets')
    .select(`vapi_master_assistant_id_${language}`)
    .eq('industry', industry)
    .single();

  if (error || !preset) {
    throw new Error(`Preset not found: ${industry}`);
  }

  const assistantId = preset[`vapi_master_assistant_id_${language}`];
  if (!assistantId) {
    throw new Error(`No master assistant found for ${industry} (${language})`);
  }

  // VAPI'den sil
  await deleteAssistant(assistantId);

  // DB'den ID'yi temizle
  await supabaseAdmin
    .from('industry_presets')
    .update({ [`vapi_master_assistant_id_${language}`]: null })
    .eq('industry', industry);

  console.log(`[VapiService] Deleted master assistant for ${industry} (${language})`);
  return { deleted: true };
}

/**
 * Preset'in master asistan bilgilerini getir
 * @param {string} industry - Industry kodu
 */
async function getMasterAssistants(industry) {
  const { data: preset, error } = await supabaseAdmin
    .from('industry_presets')
    .select('vapi_master_assistant_id_tr, vapi_master_assistant_id_en, vapi_master_assistant_id_de')
    .eq('industry', industry)
    .single();

  if (error) throw error;
  return {
    tr: preset?.vapi_master_assistant_id_tr || null,
    en: preset?.vapi_master_assistant_id_en || null,
    de: preset?.vapi_master_assistant_id_de || null,
  };
}

/**
 * Master asistanı tenant için duplicate et
 * Yeni tenant oluşturulduğunda master asistan kopyalanır ve tenant bilgileriyle güncellenir
 * @param {string} industry - Industry kodu (automotive, beauty, etc.)
 * @param {string} language - Dil kodu (tr, en, de)
 * @param {string} tenantId - Tenant UUID
 * @returns {Object} - Yeni oluşturulan VAPI assistant
 */
async function duplicateMasterForTenant(industry, language, tenantId) {
  // Master asistan ID'sini al
  const { data: preset, error: presetError } = await supabaseAdmin
    .from('industry_presets')
    .select('*')
    .eq('industry', industry)
    .single();

  if (presetError || !preset) {
    throw new Error(`Industry preset not found: ${industry}`);
  }

  const masterAssistantId = preset[`vapi_master_assistant_id_${language}`];
  if (!masterAssistantId) {
    throw new Error(`No master assistant found for ${industry} (${language}). Please create a master assistant first.`);
  }

  // Tenant bilgisini al
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (tenantError || !tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  // Master asistanın config'ini al
  const masterAssistant = await getAssistant(masterAssistantId);

  // Dil config'ini al
  const configColumn = `config_${language}`;
  const presetConfig = preset[configColumn] || preset.config_tr || {};

  // Tenant bilgileriyle config'i merge et
  const mergedConfig = mergeConfig(presetConfig, tenant.voice_config_override, tenant);

  // Use Case bazlı tool ve prompt sistemi
  let tools = [];
  let useCasePromptSections = '';

  try {
    // Önce tenant için varsayılan use case'leri kur (eğer yoksa)
    let tenantUseCases = await useCaseService.getTenantUseCases(tenantId);

    if (!tenantUseCases || tenantUseCases.length === 0) {
      // Varsayılan use case'leri kur
      await useCaseService.setupDefaultUseCases(tenantId, industry);
      tenantUseCases = await useCaseService.getTenantUseCases(tenantId);
    }

    if (tenantUseCases && tenantUseCases.length > 0) {
      const toolDefs = useCaseService.getToolDefinitionsForUseCases(tenantUseCases);
      tools = toolDefs.map(def => ({
        name: def.function.name,
        description: def.function.description,
        parameters: def.function.parameters,
      }));
      useCasePromptSections = buildUseCasePromptSections(tenantUseCases, language);
      console.log(`[VapiService] Duplicate: Using ${tenantUseCases.length} use cases with ${tools.length} tools`);
    } else {
      const functionDefs = getFunctionDefinitions(industry);
      tools = functionDefs.map(def => ({
        name: def.function.name,
        description: def.function.description,
        parameters: def.function.parameters,
      }));
    }
  } catch (useCaseError) {
    console.warn(`[VapiService] Duplicate: Use case error, falling back:`, useCaseError.message);
    const functionDefs = getFunctionDefinitions(industry);
    tools = functionDefs.map(def => ({
      name: def.function.name,
      description: def.function.description,
      parameters: def.function.parameters,
    }));
  }

  // Use case prompt bölümlerini sistem prompt'a ekle
  if (useCasePromptSections && mergedConfig.system_prompt) {
    if (mergedConfig.system_prompt.includes('{USE_CASE_SECTIONS}')) {
      // Placeholder varsa, yerine koy
      mergedConfig.system_prompt = mergedConfig.system_prompt
        .replace(/{USE_CASE_SECTIONS}/g, useCasePromptSections);
    } else {
      // Placeholder yoksa, prompt'un sonuna ekle (fallback)
      console.log(`[VapiService] No {USE_CASE_SECTIONS} placeholder found, appending to end`);
      mergedConfig.system_prompt = mergedConfig.system_prompt + '\n\n' + useCasePromptSections;
    }
  }

  // Yeni tenant-specific assistant config'i oluştur
  const assistantConfig = buildAssistantConfig(mergedConfig, tenant, language, tools);

  // Tenant asistan için ismi güncelle
  assistantConfig.name = `${tenant.name} - ${language.toUpperCase()}`;
  assistantConfig.metadata = {
    tenantId: tenant.id,
    industry: tenant.industry,
    language: language,
    duplicatedFrom: masterAssistantId,
  };

  // VAPI'de yeni asistan oluştur (master'dan duplicate)
  const assistant = await vapiRequest('/assistant', {
    method: 'POST',
    body: assistantConfig,
  });

  // Tenant'a assistant ID'yi kaydet
  const assistantIdColumn = `vapi_assistant_id_${language}`;
  await supabaseAdmin
    .from('tenants')
    .update({ [assistantIdColumn]: assistant.id })
    .eq('id', tenantId);

  // Sync log kaydet
  await logSync({
    tenantId,
    presetId: preset.id,
    action: 'duplicate_master_assistant',
    language,
    vapiAssistantId: assistant.id,
    vapiResponse: assistant,
    status: 'success',
  });

  console.log(`[VapiService] Duplicated master assistant for tenant ${tenant.name} (${language}): ${assistant.id}`);
  return assistant;
}

/**
 * VAPI API'den son aramaları çek ve DB'ye kaydet (pull-based)
 * Webhook'a güvenmek yerine direkt VAPI API'den çeker
 */
async function fetchAndSaveRecentCalls() {
  try {
    // Son 50 aramayı çek
    const calls = await vapiRequest('/call?limit=50');

    if (!calls || !Array.isArray(calls)) {
      console.log('[VapiService] No calls returned from VAPI API');
      return { fetched: 0, saved: 0, errors: 0 };
    }

    console.log(`[VapiService] Fetched ${calls.length} calls from VAPI API`);

    let saved = 0;
    let skipped = 0;
    let errors = 0;

    for (const call of calls) {
      try {
        // call_sid (= vapi call.id) ile call_logs'da var mı kontrol et
        const { data: existing } = await supabaseAdmin
          .from('call_logs')
          .select('id')
          .eq('call_sid', call.id)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        // assistantId'den tenant bul
        const assistantId = call.assistantId;
        if (!assistantId) {
          continue;
        }

        const tenant = await getTenantByVapiAssistant(assistantId);
        if (!tenant) {
          continue;
        }

        // Süreyi hesapla
        let durationSeconds = null;
        if (call.startedAt && call.endedAt) {
          const started = new Date(call.startedAt);
          const ended = new Date(call.endedAt);
          durationSeconds = Math.round((ended - started) / 1000);
        }

        // Transcript'i string'e çevir
        let transcriptStr = null;
        if (call.transcript) {
          transcriptStr = typeof call.transcript === 'string'
            ? call.transcript
            : JSON.stringify(call.transcript);
        }

        // Müşteriyi bul (varsa)
        const callerPhone = call.customer?.number || 'unknown';
        let customerId = null;
        if (callerPhone !== 'unknown') {
          const { data: customer } = await supabaseAdmin
            .from('customers')
            .select('id')
            .eq('tenant_id', tenant.id)
            .eq('phone', callerPhone)
            .maybeSingle();

          if (customer) {
            customerId = customer.id;
          }
        }

        // call_logs'a insert et
        const { error: insertError } = await supabaseAdmin
          .from('call_logs')
          .insert({
            tenant_id: tenant.id,
            call_sid: call.id,
            from_number: callerPhone,
            customer_id: customerId,
            direction: 'inbound',
            duration: durationSeconds,
            status: call.endedReason || 'completed',
            summary: call.summary || null,
            transcript: transcriptStr,
          });

        if (insertError) {
          console.error(`[VapiService] Error saving call ${call.id}:`, insertError.message);
          errors++;
        } else {
          saved++;
        }
      } catch (callError) {
        console.error(`[VapiService] Error processing call ${call.id}:`, callError.message);
        errors++;
      }
    }

    console.log(`[VapiService] Call fetch complete: ${saved} saved, ${skipped} skipped, ${errors} errors`);
    return { fetched: calls.length, saved, skipped, errors };
  } catch (error) {
    console.error('[VapiService] Error fetching calls from VAPI:', error.message);
    return { fetched: 0, saved: 0, errors: 1 };
  }
}

module.exports = {
  // Assistant CRUD
  createAssistant,
  updateAssistant,
  deleteAssistant,
  getAssistant,

  // Sync operations
  syncTenantToVapi,
  syncPresetToAllTenants,

  // Master assistants
  createMasterAssistant,
  deleteMasterAssistant,
  getMasterAssistants,
  duplicateMasterForTenant,

  // Call operations
  initiateOutboundCall,
  fetchAndSaveRecentCalls,

  // Phone number
  createPhoneNumber,

  // Tenant operations
  getTenantByVapiAssistant,
  getTenantVapiConfig,
  updateTenantVoiceConfig,

  // Logs
  getSyncLogs,

  // Utilities
  mergeConfig,
  buildAssistantConfig,
};
