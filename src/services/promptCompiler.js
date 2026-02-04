/**
 * Prompt Compiler Service
 * Single source of truth for prompt building
 * Consolidates prompt logic from promptService, useCaseService, templateService
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');
const { buildUseCasePromptSections, getToolsFromUseCases } = require('../prompts/useCasePrompts');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

/**
 * In-memory cache for compiled prompts
 * Key format: `${tenantId}:${language}`
 */
const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Cache entry structure
 * @typedef {Object} CacheEntry
 * @property {Object} data - Cached prompt data
 * @property {number} timestamp - Cache entry timestamp
 */

/**
 * Get tenant by ID
 * @param {string} tenantId - Tenant UUID
 * @returns {Object} - Tenant data
 */
async function getTenant(tenantId) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (error) {
    console.error('[PromptCompiler] Error fetching tenant:', error);
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  return data;
}

/**
 * Get industry preset
 * @param {string} industry - Industry code
 * @returns {Object} - Industry preset data
 */
async function getIndustryPreset(industry) {
  const { data, error } = await supabase
    .from('industry_presets')
    .select('*')
    .eq('industry', industry)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[PromptCompiler] Error fetching industry preset:', error);
  }

  return data;
}

/**
 * Get effective use cases for a tenant
 * Calculates: (template use cases + added) - removed
 * Falls back to tenant_use_cases if no template assigned
 * @param {string} tenantId - Tenant UUID
 * @returns {Array} - Array of use case IDs
 */
async function getEffectiveUseCases(tenantId) {
  // Try template-based approach first
  const { data: templateData, error: templateError } = await supabase
    .from('tenant_assistant_template')
    .select(`
      template_id,
      added_use_cases,
      removed_use_cases,
      template:assistant_templates(included_use_cases)
    `)
    .eq('tenant_id', tenantId)
    .single();

  if (!templateError && templateData && templateData.template_id) {
    const templateUseCases = templateData.template?.included_use_cases || [];
    const addedUseCases = templateData.added_use_cases || [];
    const removedUseCases = templateData.removed_use_cases || [];

    // Calculate: (template + added) - removed
    const allUseCases = [...new Set([...templateUseCases, ...addedUseCases])];
    const effectiveUseCases = allUseCases.filter(uc => !removedUseCases.includes(uc));

    return effectiveUseCases;
  }

  // Fallback: Get from tenant_use_cases table directly
  const { data: directUseCases, error: directError } = await supabase
    .from('tenant_use_cases')
    .select('use_case_id')
    .eq('tenant_id', tenantId)
    .eq('enabled', true);

  if (directError) {
    console.error('[PromptCompiler] Error fetching tenant use cases:', directError);
    return [];
  }

  return (directUseCases || []).map(uc => uc.use_case_id);
}

/**
 * Get full use case objects from IDs
 * @param {Array} useCaseIds - Array of use case IDs
 * @returns {Array} - Array of use case objects
 */
async function getUseCaseObjects(useCaseIds) {
  if (!useCaseIds || useCaseIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('use_cases')
    .select('*')
    .in('id', useCaseIds);

  if (error) {
    console.error('[PromptCompiler] Error fetching use case objects:', error);
    return [];
  }

  return data || [];
}

/**
 * Build use case prompt sections
 * @param {Array} useCases - Use case objects
 * @param {string} language - Language code (tr, en, de)
 * @returns {string} - Combined prompt sections
 */
function buildUseCaseSections(useCases, language = 'tr') {
  return buildUseCasePromptSections(useCases, language);
}

/**
 * Get tool names from use cases
 * @param {Array} useCases - Use case objects
 * @returns {Array} - Array of tool names
 */
function extractToolNames(useCases) {
  return getToolsFromUseCases(useCases);
}

/**
 * Apply template variables to prompt
 * @param {string} template - Prompt template
 * @param {Object} tenant - Tenant data
 * @param {string} useCaseSections - Use case prompt sections
 * @param {string} language - Language code
 * @returns {string} - Final prompt
 */
function applyVariables(template, tenant, useCaseSections = '', language = 'tr') {
  if (!template) return '';

  // Date and time in appropriate locale
  const now = new Date();
  let dateStr, timeStr;

  if (language === 'tr') {
    const turkishMonths = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const turkishDays = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    dateStr = `${now.getDate()} ${turkishMonths[now.getMonth()]} ${now.getFullYear()}, ${turkishDays[now.getDay()]}`;
    timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } else if (language === 'de') {
    const germanMonths = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const germanDays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    dateStr = `${germanDays[now.getDay()]}, ${now.getDate()}. ${germanMonths[now.getMonth()]} ${now.getFullYear()}`;
    timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } else {
    dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  const variables = {
    '{COMPANY_NAME}': tenant.name || 'Company',
    '{FIRMA_ADI}': tenant.name || 'Firma',
    '{ASSISTANT_NAME}': tenant.assistant_name || 'Asistan',
    '{ASISTAN_ADI}': tenant.assistant_name || 'Asistan',
    '{PHONE}': tenant.phone || '',
    '{TELEFON}': tenant.phone || '',
    '{EMAIL}': tenant.email || '',
    '{ADDRESS}': tenant.address || '',
    '{ADRES}': tenant.address || '',
    '{WEBSITE}': tenant.website || '',
    '{TARIH}': dateStr,
    '{DATE}': dateStr,
    '{SAAT}': timeStr,
    '{TIME}': timeStr,
    '{USE_CASE_SECTIONS}': useCaseSections,
  };

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  return result;
}

/**
 * Get base prompt from industry preset
 * @param {string} industry - Industry code
 * @param {string} language - Language code
 * @returns {string} - Base prompt template
 */
async function getIndustryBase(industry, language = 'tr') {
  const preset = await getIndustryPreset(industry);

  if (!preset) {
    return getDefaultPrompt(language);
  }

  const configColumn = `config_${language}`;
  const presetConfig = preset[configColumn] || preset.config_tr || {};

  return presetConfig.system_prompt || getDefaultPrompt(language);
}

/**
 * Default prompt fallback
 * @param {string} language - Language code
 * @returns {string} - Default prompt
 */
function getDefaultPrompt(language = 'tr') {
  const prompts = {
    tr: `Sen profesyonel bir sesli asistansın. Müşterilere yardımcı olmak için buradasın.

## Konuşma Kuralları:
- Kısa ve net cümleler kur
- Samimi ama profesyonel ol
- Müşterinin adını sor ve kullan
- Bir seferde sadece bir bilgi iste

{USE_CASE_SECTIONS}`,

    en: `You are a professional voice assistant. You are here to help customers.

## Conversation Rules:
- Use short and clear sentences
- Be friendly but professional
- Ask for the customer's name and use it
- Ask for only one piece of information at a time

{USE_CASE_SECTIONS}`,

    de: `Sie sind ein professioneller Sprachassistent. Sie sind hier, um Kunden zu helfen.

## Gesprächsregeln:
- Verwenden Sie kurze und klare Sätze
- Seien Sie freundlich aber professionell
- Fragen Sie nach dem Namen des Kunden
- Fragen Sie nur nach einer Information auf einmal

{USE_CASE_SECTIONS}`,
  };

  return prompts[language] || prompts.tr;
}

/**
 * Build final prompt for a tenant
 * Main entry point - single source of truth
 * @param {string} tenantId - Tenant UUID
 * @param {string} language - Language code (tr, en, de)
 * @returns {Object} - { systemPrompt, tools, useCases, assistantName }
 */
async function buildFinalPrompt(tenantId, language = 'tr') {
  console.log(`[PromptCompiler] Building prompt for tenant ${tenantId}, language ${language}`);

  // 1. Get tenant info
  const tenant = await getTenant(tenantId);

  // 2. Get effective use cases
  const useCaseIds = await getEffectiveUseCases(tenantId);
  const useCases = await getUseCaseObjects(useCaseIds);

  console.log(`[PromptCompiler] Found ${useCases.length} effective use cases`);

  // 3. Get base prompt from industry preset
  const basePrompt = await getIndustryBase(tenant.industry, language);

  // 4. Build use case prompt sections
  const useCaseSections = buildUseCaseSections(useCases, language);

  // 5. Extract tool names
  const toolNames = extractToolNames(useCases);

  // 6. Apply variables and build final prompt
  const systemPrompt = applyVariables(basePrompt, tenant, useCaseSections, language);

  // 7. Add VAPI-specific rules
  let finalPrompt = addVapiRules(systemPrompt, language);

  // 8. Add custom rules from voice_config_override (if any)
  if (tenant.voice_config_override?.system_prompt_suffix) {
    finalPrompt += tenant.voice_config_override.system_prompt_suffix;
    console.log(`[PromptCompiler] Added custom rules suffix for tenant ${tenantId}`);
  }

  return {
    systemPrompt: finalPrompt,
    toolNames,
    useCases,
    useCaseIds,
    assistantName: tenant.assistant_name || 'Asistan',
    tenant: {
      id: tenant.id,
      name: tenant.name,
      industry: tenant.industry,
      supportedLanguages: tenant.supported_languages || ['tr'],
    },
  };
}

/**
 * Add VAPI-specific rules to the prompt
 * @param {string} prompt - Base prompt
 * @param {string} language - Language code
 * @returns {string} - Prompt with VAPI rules
 */
function addVapiRules(prompt, language = 'tr') {
  const rules = {
    tr: `

## Önemli Kurallar:
- "Bir dakika", "Bekleyin" gibi bekleme ifadeleri kullanma
- Hemen cevap ver
- Sessizlik olmadan konuş`,

    en: `

## Important Rules:
- Don't use waiting phrases like "One moment", "Please wait"
- Respond immediately
- Speak without silence`,

    de: `

## Wichtige Regeln:
- Verwenden Sie keine Wartephrasen wie "Einen Moment", "Bitte warten"
- Antworten Sie sofort
- Sprechen Sie ohne Pausen`,
  };

  return prompt + (rules[language] || rules.tr);
}

/**
 * Get cached prompt or build new one
 * @param {string} tenantId - Tenant UUID
 * @param {string} language - Language code
 * @returns {Object} - Compiled prompt data
 */
async function getCachedPrompt(tenantId, language = 'tr') {
  const key = `${tenantId}:${language}`;

  // Check cache
  if (_cache.has(key)) {
    const entry = _cache.get(key);
    const age = Date.now() - entry.timestamp;

    if (age < CACHE_TTL_MS) {
      console.log(`[PromptCompiler] Cache hit for ${key}`);
      return entry.data;
    }

    // Cache expired
    _cache.delete(key);
  }

  // Build and cache
  const data = await buildFinalPrompt(tenantId, language);

  _cache.set(key, {
    data,
    timestamp: Date.now(),
  });

  console.log(`[PromptCompiler] Cached prompt for ${key}`);
  return data;
}

/**
 * Invalidate cache for a tenant
 * @param {string} tenantId - Tenant UUID
 */
function invalidate(tenantId) {
  let invalidated = 0;

  for (const key of _cache.keys()) {
    if (key.startsWith(tenantId)) {
      _cache.delete(key);
      invalidated++;
    }
  }

  console.log(`[PromptCompiler] Invalidated ${invalidated} cache entries for tenant ${tenantId}`);
}

/**
 * Clear all cache
 */
function clearAllCache() {
  const size = _cache.size;
  _cache.clear();
  console.log(`[PromptCompiler] Cleared all ${size} cache entries`);
}

/**
 * Get cache stats
 * @returns {Object} - Cache statistics
 */
function getCacheStats() {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;

  for (const [, entry] of _cache) {
    if (now - entry.timestamp < CACHE_TTL_MS) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }

  return {
    totalEntries: _cache.size,
    validEntries,
    expiredEntries,
    ttlMs: CACHE_TTL_MS,
  };
}

module.exports = {
  // Main functions
  buildFinalPrompt,
  getCachedPrompt,

  // Components (for testing/debugging)
  getTenant,
  getEffectiveUseCases,
  getUseCaseObjects,
  buildUseCaseSections,
  extractToolNames,
  applyVariables,
  getIndustryBase,
  getIndustryPreset,

  // Cache management
  invalidate,
  clearAllCache,
  getCacheStats,

  // Utilities
  getDefaultPrompt,
  addVapiRules,
};
