/**
 * Template Service
 * Asistan şablonları yönetimi
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

// Lazy load VapiSyncService to avoid circular dependencies
let _vapiSyncService = null;
function getVapiSyncService() {
  if (!_vapiSyncService) {
    _vapiSyncService = require('./vapiSyncService');
  }
  return _vapiSyncService;
}

/**
 * Tüm şablonları getir
 * @param {Object} filters - Filtreler
 * @param {string} filters.industry - Sektör filtresi
 * @param {string} filters.tier - Seviye filtresi (basic, standard, premium)
 * @param {boolean} filters.isActive - Aktif mi
 * @returns {Array} - Şablon listesi
 */
async function getTemplates(filters = {}) {
  let query = supabase
    .from('assistant_templates')
    .select('*')
    .order('display_order', { ascending: true });

  if (filters.industry) {
    query = query.eq('industry', filters.industry);
  }

  if (filters.tier) {
    query = query.eq('tier', filters.tier);
  }

  if (filters.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive);
  } else {
    // Default: only active templates
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[TemplateService] Error fetching templates:', error);
    throw error;
  }

  return data || [];
}

/**
 * Tek bir şablonu ID'ye göre getir
 * @param {string} templateId - Şablon ID
 * @returns {Object} - Şablon
 */
async function getTemplateById(templateId) {
  const { data, error } = await supabase
    .from('assistant_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) {
    console.error('[TemplateService] Error fetching template:', error);
    throw error;
  }

  return data;
}

/**
 * Tenant'a şablon ata (Admin işlemi)
 * @param {string} tenantId - Tenant UUID
 * @param {string} templateId - Şablon ID
 * @returns {Object} - İşlem sonucu
 */
async function selectTemplate(tenantId, templateId) {
  // Get template to verify it exists
  const template = await getTemplateById(templateId);
  if (!template) {
    throw new Error('Template not found');
  }

  // Use the assign function or manual upsert
  // First, upsert the tenant_assistant_template record
  const { error: tatError } = await supabase
    .from('tenant_assistant_template')
    .upsert({
      tenant_id: tenantId,
      template_id: templateId,
      added_use_cases: [],
      removed_use_cases: [],
      selected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'tenant_id',
    });

  if (tatError) {
    console.error('[TemplateService] Error upserting tenant_assistant_template:', tatError);
    throw tatError;
  }

  // Note: tenants.selected_template_id is removed in migration 021
  // tenant_assistant_template is now the single source of truth

  // Sync use cases: Clear existing and add template use cases
  // First, disable all existing use cases
  const { error: deleteError } = await supabase
    .from('tenant_use_cases')
    .delete()
    .eq('tenant_id', tenantId);

  if (deleteError) {
    console.error('[TemplateService] Error clearing tenant use cases:', deleteError);
    // Don't throw, continue with insert
  }

  // Insert template use cases
  if (template.included_use_cases && template.included_use_cases.length > 0) {
    const useCaseInserts = template.included_use_cases.map(ucId => ({
      tenant_id: tenantId,
      use_case_id: ucId,
      enabled: true,
    }));

    const { error: insertError } = await supabase
      .from('tenant_use_cases')
      .upsert(useCaseInserts, {
        onConflict: 'tenant_id,use_case_id',
      });

    if (insertError) {
      console.error('[TemplateService] Error inserting use cases:', insertError);
      throw insertError;
    }
  }

  console.log(`[TemplateService] Assigned template ${templateId} to tenant ${tenantId}`);

  // Sync to VAPI using centralized sync service
  try {
    const vapiSyncService = getVapiSyncService();
    await vapiSyncService.syncTenant(tenantId, vapiSyncService.SYNC_REASONS.TEMPLATE_CHANGE);
    console.log(`[TemplateService] VAPI synced after template change`);
  } catch (vapiError) {
    console.error('[TemplateService] Failed to sync VAPI after template change:', vapiError);
    // Don't throw - template change was successful
  }

  return {
    success: true,
    template,
    useCaseCount: template.included_use_cases?.length || 0,
  };
}

/**
 * Tenant şablon özelleştirmesi (Tenant işlemi)
 * Use case ekleyip çıkarabilir
 * @param {string} tenantId - Tenant UUID
 * @param {Object} customization - Özelleştirme
 * @param {Array} customization.addUseCases - Eklenecek use case ID'leri
 * @param {Array} customization.removeUseCases - Çıkarılacak use case ID'leri
 * @returns {Object} - İşlem sonucu
 */
async function customizeTemplate(tenantId, customization) {
  const { addUseCases = [], removeUseCases = [] } = customization;

  // Get current customization
  const { data: currentData, error: fetchError } = await supabase
    .from('tenant_assistant_template')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 = not found
    console.error('[TemplateService] Error fetching current customization:', fetchError);
    throw fetchError;
  }

  if (!currentData) {
    throw new Error('No template assigned to this tenant');
  }

  // Merge customizations
  const currentAdded = currentData.added_use_cases || [];
  const currentRemoved = currentData.removed_use_cases || [];

  // Add new use cases (remove from removed if present, add to added)
  const newAdded = [...new Set([...currentAdded, ...addUseCases])];
  const newRemoved = currentRemoved.filter(uc => !addUseCases.includes(uc));

  // Remove use cases (add to removed, remove from added)
  const finalRemoved = [...new Set([...newRemoved, ...removeUseCases])];
  const finalAdded = newAdded.filter(uc => !removeUseCases.includes(uc));

  // Update the customization record
  const { error: updateError } = await supabase
    .from('tenant_assistant_template')
    .update({
      added_use_cases: finalAdded,
      removed_use_cases: finalRemoved,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);

  if (updateError) {
    console.error('[TemplateService] Error updating customization:', updateError);
    throw updateError;
  }

  // Sync to tenant_use_cases table
  await syncEffectiveUseCases(tenantId);

  console.log(`[TemplateService] Customized template for tenant ${tenantId}`);

  // Sync to VAPI using centralized sync service
  try {
    const vapiSyncService = getVapiSyncService();
    await vapiSyncService.syncTenant(tenantId, vapiSyncService.SYNC_REASONS.USECASE_CHANGE);
    console.log(`[TemplateService] VAPI synced after template customization`);
  } catch (vapiError) {
    console.error('[TemplateService] Failed to sync VAPI after customization:', vapiError);
    // Don't throw - customization was successful
  }

  return {
    success: true,
    addedUseCases: finalAdded,
    removedUseCases: finalRemoved,
  };
}

/**
 * Tenant'ın efektif use case listesini hesapla
 * Şablon + eklenen - çıkarılan = final liste
 * @param {string} tenantId - Tenant UUID
 * @returns {Array} - Efektif use case ID listesi
 */
async function getEffectiveUseCases(tenantId) {
  // Get tenant's template and customizations
  const { data, error } = await supabase
    .from('tenant_assistant_template')
    .select(`
      template_id,
      added_use_cases,
      removed_use_cases,
      template:assistant_templates(included_use_cases)
    `)
    .eq('tenant_id', tenantId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[TemplateService] Error fetching tenant template:', error);
    throw error;
  }

  // No template assigned
  if (!data || !data.template_id) {
    return [];
  }

  const templateUseCases = data.template?.included_use_cases || [];
  const addedUseCases = data.added_use_cases || [];
  const removedUseCases = data.removed_use_cases || [];

  // Calculate effective: (template + added) - removed
  const allUseCases = [...new Set([...templateUseCases, ...addedUseCases])];
  const effectiveUseCases = allUseCases.filter(uc => !removedUseCases.includes(uc));

  return effectiveUseCases;
}

/**
 * Efektif use case'leri tenant_use_cases tablosuna senkronize et
 * @param {string} tenantId - Tenant UUID
 */
async function syncEffectiveUseCases(tenantId) {
  const effectiveUseCases = await getEffectiveUseCases(tenantId);

  // Get current tenant use cases
  const { data: currentUseCases, error: fetchError } = await supabase
    .from('tenant_use_cases')
    .select('use_case_id, enabled')
    .eq('tenant_id', tenantId);

  if (fetchError) {
    console.error('[TemplateService] Error fetching current use cases:', fetchError);
    throw fetchError;
  }

  const currentMap = new Map((currentUseCases || []).map(uc => [uc.use_case_id, uc.enabled]));
  const effectiveSet = new Set(effectiveUseCases);

  const toUpsert = [];
  const toDisable = [];

  // Enable all effective use cases
  for (const ucId of effectiveUseCases) {
    if (!currentMap.has(ucId) || !currentMap.get(ucId)) {
      toUpsert.push({
        tenant_id: tenantId,
        use_case_id: ucId,
        enabled: true,
      });
    }
  }

  // Disable use cases not in effective list
  for (const [ucId, enabled] of currentMap) {
    if (!effectiveSet.has(ucId) && enabled) {
      toDisable.push({
        tenant_id: tenantId,
        use_case_id: ucId,
        enabled: false,
      });
    }
  }

  // Batch upsert
  if (toUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from('tenant_use_cases')
      .upsert(toUpsert, { onConflict: 'tenant_id,use_case_id' });

    if (upsertError) {
      console.error('[TemplateService] Error upserting use cases:', upsertError);
      throw upsertError;
    }
  }

  // Batch disable
  if (toDisable.length > 0) {
    const { error: disableError } = await supabase
      .from('tenant_use_cases')
      .upsert(toDisable, { onConflict: 'tenant_id,use_case_id' });

    if (disableError) {
      console.error('[TemplateService] Error disabling use cases:', disableError);
      throw disableError;
    }
  }

  console.log(`[TemplateService] Synced ${toUpsert.length} enabled, ${toDisable.length} disabled use cases for tenant ${tenantId}`);
}

/**
 * Tenant'ın şablon bilgisini getir
 * @param {string} tenantId - Tenant UUID
 * @returns {Object} - Şablon bilgisi ve özelleştirmeler
 */
async function getTenantTemplate(tenantId) {
  const { data, error } = await supabase
    .from('tenant_assistant_template')
    .select(`
      tenant_id,
      template_id,
      added_use_cases,
      removed_use_cases,
      selected_at,
      updated_at,
      template:assistant_templates(*)
    `)
    .eq('tenant_id', tenantId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[TemplateService] Error fetching tenant template:', error);
    throw error;
  }

  if (!data) {
    return null;
  }

  // Also get effective use cases
  const effectiveUseCases = await getEffectiveUseCases(tenantId);

  return {
    ...data,
    effectiveUseCases,
  };
}

/**
 * Yeni şablon oluştur (Admin işlemi)
 * @param {Object} templateData - Şablon verileri
 * @returns {Object} - Oluşturulan şablon
 */
async function createTemplate(templateData) {
  const { data, error } = await supabase
    .from('assistant_templates')
    .insert(templateData)
    .select()
    .single();

  if (error) {
    console.error('[TemplateService] Error creating template:', error);
    throw error;
  }

  console.log(`[TemplateService] Created template: ${data.id}`);
  return data;
}

/**
 * Şablon güncelle (Admin işlemi)
 * @param {string} templateId - Şablon ID
 * @param {Object} updates - Güncellenecek alanlar
 * @returns {Object} - Güncellenen şablon
 */
async function updateTemplate(templateId, updates) {
  const { data, error } = await supabase
    .from('assistant_templates')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId)
    .select()
    .single();

  if (error) {
    console.error('[TemplateService] Error updating template:', error);
    throw error;
  }

  console.log(`[TemplateService] Updated template: ${templateId}`);
  return data;
}

/**
 * Şablon sil (Admin işlemi)
 * @param {string} templateId - Şablon ID
 * @returns {Object} - Silme sonucu
 */
async function deleteTemplate(templateId) {
  // Check if any tenants are using this template
  const { data: usageCounts, error: countError } = await supabase
    .from('tenant_assistant_template')
    .select('tenant_id', { count: 'exact' })
    .eq('template_id', templateId);

  if (countError) {
    console.error('[TemplateService] Error checking template usage:', countError);
    throw countError;
  }

  if (usageCounts && usageCounts.length > 0) {
    throw new Error(`Cannot delete template: ${usageCounts.length} tenant(s) are using it`);
  }

  const { error } = await supabase
    .from('assistant_templates')
    .delete()
    .eq('id', templateId);

  if (error) {
    console.error('[TemplateService] Error deleting template:', error);
    throw error;
  }

  console.log(`[TemplateService] Deleted template: ${templateId}`);
  return { deleted: true };
}

/**
 * Sektöre göre önerilen şablonu getir
 * @param {string} industry - Sektör
 * @returns {Object} - Öne çıkan şablon
 */
async function getFeaturedTemplate(industry) {
  const { data, error } = await supabase
    .from('assistant_templates')
    .select('*')
    .eq('industry', industry)
    .eq('is_featured', true)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[TemplateService] Error fetching featured template:', error);
    throw error;
  }

  return data;
}

module.exports = {
  // Template CRUD
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getFeaturedTemplate,

  // Tenant template operations
  selectTemplate,
  customizeTemplate,
  getTenantTemplate,

  // Use case calculations
  getEffectiveUseCases,
  syncEffectiveUseCases,
};
