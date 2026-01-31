/**
 * Use Case Service
 * Use case bazlı tool ve prompt yönetimi
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');
const { getToolsFromUseCases, buildUseCasePromptSections } = require('../prompts/useCasePrompts');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

// Lazy load tool definitions to avoid circular dependencies
let _automotiveFunctionDefinitions = null;
let _beautyFunctionDefinitions = null;

function getAutomotiveFunctionDefinitions() {
  if (!_automotiveFunctionDefinitions) {
    const { automotiveFunctionDefinitions } = require('../prompts/functions');
    _automotiveFunctionDefinitions = automotiveFunctionDefinitions;
  }
  return _automotiveFunctionDefinitions;
}

function getBeautyFunctionDefinitions() {
  if (!_beautyFunctionDefinitions) {
    const { beautyFunctionDefinitions } = require('../prompts/beauty/functions');
    _beautyFunctionDefinitions = beautyFunctionDefinitions;
  }
  return _beautyFunctionDefinitions;
}

/**
 * TÜM tool tanımlarını tek bir master listede birleştir
 * Industry'den bağımsız, tüm mevcut tool'lar
 * Lazy initialization to avoid circular dependency issues
 */
let _masterToolDefinitions = null;

function getMasterToolDefinitions() {
  if (!_masterToolDefinitions) {
    _masterToolDefinitions = {};

    // Automotive tool'larını ekle
    getAutomotiveFunctionDefinitions().forEach(def => {
      _masterToolDefinitions[def.function.name] = def;
    });

    // Beauty tool'larını ekle (aynı isimli olanlar override edilir - bu beklenen davranış)
    getBeautyFunctionDefinitions().forEach(def => {
      _masterToolDefinitions[def.function.name] = def;
    });
  }
  return _masterToolDefinitions;
}

// Export için getter (backward compatibility)
const masterToolDefinitions = new Proxy({}, {
  get: (target, prop) => getMasterToolDefinitions()[prop],
  has: (target, prop) => prop in getMasterToolDefinitions(),
  ownKeys: () => Object.keys(getMasterToolDefinitions()),
  getOwnPropertyDescriptor: (target, prop) => {
    const defs = getMasterToolDefinitions();
    if (prop in defs) {
      return { configurable: true, enumerable: true, value: defs[prop] };
    }
  },
});

/**
 * Tüm use case'leri getir
 * @param {Object} filters - Filtreler
 * @param {string} filters.category - Kategori filtresi (core, automotive, beauty, addon)
 * @param {string} filters.industry - Industry bazlı filtreleme (core + industry + addon)
 * @returns {Array} - Use case listesi
 */
async function getUseCases(filters = {}) {
  let query = supabase
    .from('use_cases')
    .select('*')
    .order('display_order', { ascending: true });

  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  if (filters.industry) {
    // Industry bazlı filtreleme: core + ilgili industry + addon
    query = query.or(`category.eq.core,category.eq.${filters.industry},category.eq.addon`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[UseCaseService] Error fetching use cases:', error);
    throw error;
  }

  return data || [];
}

/**
 * Tek bir use case'i ID'ye göre getir
 * @param {string} useCaseId - Use case ID
 * @returns {Object} - Use case
 */
async function getUseCaseById(useCaseId) {
  const { data, error } = await supabase
    .from('use_cases')
    .select('*')
    .eq('id', useCaseId)
    .single();

  if (error) {
    console.error('[UseCaseService] Error fetching use case:', error);
    throw error;
  }

  return data;
}

/**
 * Tenant'ın aktif use case'lerini getir
 * @param {string} tenantId - Tenant UUID
 * @returns {Array} - Tenant'ın use case'leri (use_cases tablosu ile join)
 */
async function getTenantUseCases(tenantId) {
  const { data, error } = await supabase
    .from('tenant_use_cases')
    .select(`
      tenant_id,
      use_case_id,
      enabled,
      use_case:use_cases(*)
    `)
    .eq('tenant_id', tenantId)
    .eq('enabled', true);

  if (error) {
    console.error('[UseCaseService] Error fetching tenant use cases:', error);
    throw error;
  }

  // Flatten the result
  return (data || []).map(item => ({
    ...item.use_case,
    tenant_id: item.tenant_id,
    enabled: item.enabled,
  }));
}

/**
 * Tenant'ın tüm use case ilişkilerini getir (enabled/disabled dahil)
 * @param {string} tenantId - Tenant UUID
 * @returns {Array} - Tüm use case ilişkileri
 */
async function getTenantUseCaseRelations(tenantId) {
  const { data, error } = await supabase
    .from('tenant_use_cases')
    .select(`
      tenant_id,
      use_case_id,
      enabled,
      created_at
    `)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[UseCaseService] Error fetching tenant use case relations:', error);
    throw error;
  }

  return data || [];
}

/**
 * Tenant'ın use case'lerini ayarla
 * Seçilen use case'leri enabled, seçilmeyenleri disabled yapar
 * @param {string} tenantId - Tenant UUID
 * @param {Array} useCaseIds - Aktif edilecek use case ID'leri
 * @returns {Object} - İşlem sonucu
 */
async function setTenantUseCases(tenantId, useCaseIds) {
  // Önce mevcut ilişkileri al
  const existingRelations = await getTenantUseCaseRelations(tenantId);
  const existingMap = new Map(existingRelations.map(r => [r.use_case_id, r]));

  const toInsert = [];
  const toUpdate = [];

  // Seçilen use case'ler için
  for (const useCaseId of useCaseIds) {
    if (existingMap.has(useCaseId)) {
      // Mevcut ama disabled olabilir
      const existing = existingMap.get(useCaseId);
      if (!existing.enabled) {
        toUpdate.push({ tenant_id: tenantId, use_case_id: useCaseId, enabled: true });
      }
    } else {
      // Yeni eklenecek
      toInsert.push({ tenant_id: tenantId, use_case_id: useCaseId, enabled: true });
    }
  }

  // Seçilmeyenleri disable et
  for (const [useCaseId, relation] of existingMap) {
    if (!useCaseIds.includes(useCaseId) && relation.enabled) {
      toUpdate.push({ tenant_id: tenantId, use_case_id: useCaseId, enabled: false });
    }
  }

  // Toplu insert
  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('tenant_use_cases')
      .insert(toInsert);

    if (insertError) {
      console.error('[UseCaseService] Error inserting tenant use cases:', insertError);
      throw insertError;
    }
  }

  // Toplu update (upsert kullanarak)
  if (toUpdate.length > 0) {
    const { error: updateError } = await supabase
      .from('tenant_use_cases')
      .upsert(toUpdate, { onConflict: 'tenant_id,use_case_id' });

    if (updateError) {
      console.error('[UseCaseService] Error updating tenant use cases:', updateError);
      throw updateError;
    }
  }

  console.log(`[UseCaseService] Updated use cases for tenant ${tenantId}: ${useCaseIds.length} active`);

  return {
    inserted: toInsert.length,
    updated: toUpdate.length,
    activeUseCases: useCaseIds,
  };
}

/**
 * Tek bir use case'i tenant için toggle et
 * @param {string} tenantId - Tenant UUID
 * @param {string} useCaseId - Use case ID
 * @param {boolean} enabled - Aktif mi
 */
async function toggleTenantUseCase(tenantId, useCaseId, enabled) {
  const { data, error } = await supabase
    .from('tenant_use_cases')
    .upsert({
      tenant_id: tenantId,
      use_case_id: useCaseId,
      enabled,
    }, {
      onConflict: 'tenant_id,use_case_id',
    })
    .select()
    .single();

  if (error) {
    console.error('[UseCaseService] Error toggling use case:', error);
    throw error;
  }

  return data;
}

/**
 * Industry için varsayılan use case'leri getir
 * @param {string} industry - Industry kodu
 * @returns {Array} - Varsayılan use case'ler
 */
async function getDefaultUseCasesForIndustry(industry) {
  const { data, error } = await supabase
    .from('use_cases')
    .select('*')
    .eq('is_default', true)
    .or(`category.eq.core,category.eq.${industry},category.eq.addon`)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[UseCaseService] Error fetching default use cases:', error);
    throw error;
  }

  // Addon'lar için sadece is_default true olanlar
  return (data || []).filter(uc =>
    uc.category === 'core' ||
    uc.category === industry ||
    (uc.category === 'addon' && uc.is_default)
  );
}

/**
 * Tenant için varsayılan use case'leri kur
 * @param {string} tenantId - Tenant UUID
 * @param {string} industry - Industry kodu
 */
async function setupDefaultUseCases(tenantId, industry) {
  const defaultUseCases = await getDefaultUseCasesForIndustry(industry);
  const useCaseIds = defaultUseCases.map(uc => uc.id);

  await setTenantUseCases(tenantId, useCaseIds);

  console.log(`[UseCaseService] Setup default use cases for tenant ${tenantId}: ${useCaseIds.join(', ')}`);

  return defaultUseCases;
}

/**
 * Seçilen use case'ler için tool tanımlarını getir
 * @param {Array} useCases - Use case objeleri (tools array içeren)
 * @returns {Array} - Tool tanımları (OpenAI function format)
 */
function getToolDefinitionsForUseCases(useCases) {
  const toolNames = getToolsFromUseCases(useCases);
  const defs = getMasterToolDefinitions();

  // Master listeden ilgili tool tanımlarını al
  const toolDefinitions = toolNames
    .map(name => defs[name])
    .filter(def => def !== undefined);

  return toolDefinitions;
}

/**
 * Tenant için aktif tool tanımlarını getir
 * @param {string} tenantId - Tenant UUID
 * @returns {Array} - Tool tanımları
 */
async function getToolDefinitionsForTenant(tenantId) {
  const useCases = await getTenantUseCases(tenantId);
  return getToolDefinitionsForUseCases(useCases);
}

/**
 * Tenant için VAPI tool formatında tool listesi getir
 * @param {string} tenantId - Tenant UUID
 * @returns {Array} - VAPI tool formatı
 */
async function getVapiToolsForTenant(tenantId) {
  const definitions = await getToolDefinitionsForTenant(tenantId);

  return definitions.map(def => ({
    name: def.function.name,
    description: def.function.description,
    parameters: def.function.parameters,
  }));
}

/**
 * Seçilen use case'ler için dinamik sistem prompt oluştur
 * @param {Array} useCases - Use case objeleri
 * @param {string} language - Dil kodu (tr, en)
 * @returns {string} - Use case bölümleri (prompt'a eklenecek)
 */
function buildPromptSectionsForUseCases(useCases, language = 'tr') {
  return buildUseCasePromptSections(useCases, language);
}

/**
 * Tenant için dinamik prompt bölümlerini getir
 * @param {string} tenantId - Tenant UUID
 * @param {string} language - Dil kodu
 * @returns {string} - Prompt bölümleri
 */
async function getPromptSectionsForTenant(tenantId, language = 'tr') {
  const useCases = await getTenantUseCases(tenantId);
  return buildPromptSectionsForUseCases(useCases, language);
}

/**
 * Yeni use case oluştur (Admin işlemi)
 * @param {Object} useCaseData - Use case verileri
 */
async function createUseCase(useCaseData) {
  const { data, error } = await supabase
    .from('use_cases')
    .insert(useCaseData)
    .select()
    .single();

  if (error) {
    console.error('[UseCaseService] Error creating use case:', error);
    throw error;
  }

  console.log(`[UseCaseService] Created use case: ${data.id}`);
  return data;
}

/**
 * Use case güncelle (Admin işlemi)
 * @param {string} useCaseId - Use case ID
 * @param {Object} updates - Güncellenecek alanlar
 */
async function updateUseCase(useCaseId, updates) {
  const { data, error } = await supabase
    .from('use_cases')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', useCaseId)
    .select()
    .single();

  if (error) {
    console.error('[UseCaseService] Error updating use case:', error);
    throw error;
  }

  console.log(`[UseCaseService] Updated use case: ${useCaseId}`);
  return data;
}

/**
 * Use case sil (Admin işlemi)
 * @param {string} useCaseId - Use case ID
 */
async function deleteUseCase(useCaseId) {
  const { error } = await supabase
    .from('use_cases')
    .delete()
    .eq('id', useCaseId);

  if (error) {
    console.error('[UseCaseService] Error deleting use case:', error);
    throw error;
  }

  console.log(`[UseCaseService] Deleted use case: ${useCaseId}`);
  return { deleted: true };
}

/**
 * Tüm mevcut tool'ları listele
 * Admin panelinde use case'e tool atamak için
 */
function getAllAvailableTools() {
  const defs = getMasterToolDefinitions();
  return Object.keys(defs).map(name => ({
    name,
    description: defs[name].function.description,
    parameters: defs[name].function.parameters,
  }));
}

module.exports = {
  // Use case CRUD
  getUseCases,
  getUseCaseById,
  createUseCase,
  updateUseCase,
  deleteUseCase,

  // Tenant use cases
  getTenantUseCases,
  getTenantUseCaseRelations,
  setTenantUseCases,
  toggleTenantUseCase,

  // Defaults
  getDefaultUseCasesForIndustry,
  setupDefaultUseCases,

  // Tools
  getToolDefinitionsForUseCases,
  getToolDefinitionsForTenant,
  getVapiToolsForTenant,
  getAllAvailableTools,
  masterToolDefinitions,

  // Prompts
  buildPromptSectionsForUseCases,
  getPromptSectionsForTenant,
};
