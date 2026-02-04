/**
 * Tenant Service
 * Tenant CRUD operasyonlari ve yardimci fonksiyonlar
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

// VAPI Service - lazy load to avoid circular dependency
let vapiService = null;
function getVapiService() {
  if (!vapiService) {
    vapiService = require('./vapiService');
  }
  return vapiService;
}

// VapiSyncService - lazy load to avoid circular dependency
let _vapiSyncService = null;
function getVapiSyncService() {
  if (!_vapiSyncService) {
    _vapiSyncService = require('./vapiSyncService');
  }
  return _vapiSyncService;
}

// PromptCompiler - lazy load
let _promptCompiler = null;
function getPromptCompiler() {
  if (!_promptCompiler) {
    _promptCompiler = require('./promptCompiler');
  }
  return _promptCompiler;
}

/**
 * Tüm tenant'ları listele
 */
async function getAllTenants(filters = {}) {
  let query = supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.industry) {
    query = query.eq('industry', filters.industry);
  }

  if (filters.region) {
    query = query.eq('region', filters.region);
  }

  if (filters.plan) {
    query = query.eq('plan', filters.plan);
  }

  if (filters.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Tenant detayı getir
 */
async function getTenantById(tenantId) {
  const { data, error } = await supabase
    .from('tenants')
    .select(`
      *,
      users:users(id, name, email, role, is_active),
      prompt_templates:prompt_templates(*)
    `)
    .eq('id', tenantId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Slug ile tenant getir
 */
async function getTenantBySlug(slug) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

/**
 * Twilio numarası ile tenant getir
 */
async function getTenantByPhoneNumber(phoneNumber) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('twilio_phone_number', phoneNumber)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Yeni tenant oluştur
 */
async function createTenant(tenantData) {
  const {
    name,
    slug,
    industry,
    region = 'tr',
    defaultLanguage = 'tr',
    language, // Frontend'den gelen dil parametresi
    supportedLanguages = ['tr'],
    assistantName,
    phone,
    email,
    plan = 'starter',
    primaryColor,
    logoUrl,
    // Admin panel için ek alanlar (inline setup)
    createUser = false,
    userEmail,
    userPassword,
    password, // Frontend'den gelen şifre parametresi (alternatif)
    sendOnboardingLink = false,
  } = tenantData;

  // Dil parametresini normalize et
  const finalLanguage = language || defaultLanguage;
  const finalSupportedLanguages = supportedLanguages.includes(finalLanguage)
    ? supportedLanguages
    : [finalLanguage, ...supportedLanguages];

  // Email parametresini normalize et (hem email hem userEmail olabilir)
  const finalUserEmail = userEmail || email;
  const finalPassword = userPassword || password;

  // Slug unique kontrolü
  const existingSlug = await getTenantBySlug(slug);
  if (existingSlug) {
    throw new Error('Slug already exists');
  }

  // Tenant oluştur
  const { data: tenant, error } = await supabase
    .from('tenants')
    .insert({
      name,
      slug,
      industry,
      region,
      default_language: finalLanguage,
      supported_languages: finalSupportedLanguages,
      assistant_name: assistantName,
      phone,
      email,
      plan,
      primary_color: primaryColor,
      logo_url: logoUrl,
    })
    .select()
    .single();

  if (error) throw error;

  // Industry preset'ten varsayılan ayarları al ve prompt template oluştur
  await createDefaultPromptTemplates(tenant.id, industry);

  // Varsayılan hizmetler artık otomatik eklenmiyor - kullanıcı kendisi ekleyecek
  // if (industry === 'beauty' || industry === 'beauty_salon' || industry === 'hairdresser') {
  //   await createDefaultBeautyServices(tenant.id, industry);
  // }

  // Varsayılan slotları oluştur
  await generateDefaultSlots(tenant.id, industry);

  // VAPI assistant'larını oluştur (her desteklenen dil için)
  try {
    const vapi = getVapiService();
    await vapi.syncTenantToVapi(tenant.id);
    console.log(`[TenantService] VAPI assistants created for tenant: ${tenant.id}`);
  } catch (vapiError) {
    console.error('[TenantService] Failed to create VAPI assistants:', vapiError);
    // VAPI hatası tenant oluşturmayı engellemeyecek
  }

  // Admin panelden kullanıcı oluşturma isteği varsa (Supabase Auth + DB)
  if (createUser && finalUserEmail && finalPassword) {
    try {
      // 1. Supabase Auth'da kullanıcı oluştur
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: finalUserEmail,
        password: finalPassword,
        email_confirm: true, // Email doğrulamasını atla
      });

      if (authError) {
        console.error('[TenantService] Supabase Auth error:', authError);
        throw authError;
      }

      // 2. DB'de users tablosuna kayıt ekle
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          auth_user_id: authData.user.id,
          tenant_id: tenant.id,
          email: finalUserEmail,
          name: name,
          role: 'tenant_admin',
          is_active: true,
        })
        .select()
        .single();

      if (userError) {
        console.error('[TenantService] DB user creation error:', userError);
        // Rollback: Auth user'ı sil
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw userError;
      }

      console.log(`[TenantService] Created user for tenant: ${user.email} (auth_id: ${authData.user.id})`);
    } catch (userErr) {
      console.error('[TenantService] Failed to create user:', userErr);
      // Kullanıcı oluşturma hatası tenant oluşturmayı engellemeyecek ama loglayacak
    }
  }

  return tenant;
}

/**
 * Tenant güncelle
 */
async function updateTenant(tenantId, updates) {
  // Slug değişiyorsa unique kontrolü yap
  if (updates.slug) {
    const existing = await getTenantBySlug(updates.slug);
    if (existing && existing.id !== tenantId) {
      throw new Error('Slug already exists');
    }
  }

  const { data, error } = await supabase
    .from('tenants')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId)
    .select()
    .single();

  if (error) throw error;

  // VAPI ayarları değiştiyse sync et (using centralized VapiSyncService)
  const vapiRelatedFields = ['name', 'assistant_name', 'supported_languages', 'voice_config_override'];
  const needsVapiSync = vapiRelatedFields.some(field => updates[field] !== undefined);

  if (needsVapiSync) {
    try {
      // Invalidate prompt cache first
      const promptCompiler = getPromptCompiler();
      promptCompiler.invalidate(tenantId);

      // Use centralized sync service
      const vapiSyncService = getVapiSyncService();
      await vapiSyncService.syncTenant(tenantId, vapiSyncService.SYNC_REASONS.TENANT_UPDATE);
      console.log(`[TenantService] VAPI assistants synced for tenant: ${tenantId}`);
    } catch (vapiError) {
      console.error('[TenantService] Failed to sync VAPI assistants:', vapiError);
    }
  }

  return data;
}

/**
 * Tenant sil (soft delete - is_active = false)
 */
async function deleteTenant(tenantId, hard = false) {
  if (hard) {
    // Önce VAPI assistant'larını sil
    try {
      const tenant = await getTenantById(tenantId);
      if (tenant) {
        const vapi = getVapiService();
        const languages = ['tr', 'en', 'de'];
        for (const lang of languages) {
          const assistantId = tenant[`vapi_assistant_id_${lang}`];
          if (assistantId) {
            await vapi.deleteAssistant(assistantId);
            console.log(`[TenantService] Deleted VAPI assistant: ${assistantId}`);
          }
        }
      }
    } catch (vapiError) {
      console.error('[TenantService] Failed to delete VAPI assistants:', vapiError);
    }

    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenantId);

    if (error) throw error;
    return { deleted: true };
  }

  // Soft delete
  const { data, error } = await supabase
    .from('tenants')
    .update({ is_active: false })
    .eq('id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Tenant istatistikleri
 */
async function getTenantStats(tenantId) {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  // Parallel queries
  const [
    customersResult,
    testDrivesResult,
    servicesResult,
    beautyResult,
    todayAppointmentsResult,
    callsResult,
  ] = await Promise.all([
    // Total customers
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),

    // Pending test drives
    supabase
      .from('test_drive_appointments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),

    // Pending services
    supabase
      .from('service_appointments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),

    // Pending beauty appointments
    supabase
      .from('beauty_appointments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),

    // Today's appointments (all types)
    supabase.rpc('get_today_appointment_count', { p_tenant_id: tenantId }),

    // This month's calls
    supabase
      .from('call_logs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart),
  ]);

  return {
    totalCustomers: customersResult.count || 0,
    pendingTestDrives: testDrivesResult.count || 0,
    pendingServices: servicesResult.count || 0,
    pendingBeauty: beautyResult.count || 0,
    todayAppointments: todayAppointmentsResult.data || 0,
    callsThisMonth: callsResult.count || 0,
  };
}

/**
 * Industry preset'lerden varsayılan prompt template'leri oluştur
 */
async function createDefaultPromptTemplates(tenantId, industry) {
  // Preset'i getir
  const { data: preset, error: presetError } = await supabase
    .from('industry_presets')
    .select('*')
    .eq('industry', industry)
    .single();

  if (presetError || !preset) {
    console.warn(`[TenantService] Industry preset not found: ${industry}`);
    return;
  }

  // Tenant bilgisini al
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, assistant_name, supported_languages')
    .eq('id', tenantId)
    .single();

  const templates = [];
  const languages = tenant?.supported_languages || ['tr'];

  for (const lang of languages) {
    const promptField = `default_prompt_${lang}`;
    const welcomeField = `default_welcome_${lang}`;
    const nameField = `default_assistant_name_${lang}`;

    if (preset[promptField]) {
      templates.push({
        tenant_id: tenantId,
        name: `Default ${lang.toUpperCase()}`,
        language: lang,
        system_prompt: preset[promptField]
          .replace(/{COMPANY_NAME}/g, tenant?.name || 'Company')
          .replace(/{ASSISTANT_NAME}/g, tenant?.assistant_name || preset[nameField] || 'Asistan'),
        welcome_message: preset[welcomeField]
          ?.replace(/{COMPANY_NAME}/g, tenant?.name || 'Company')
          .replace(/{ASSISTANT_NAME}/g, tenant?.assistant_name || preset[nameField] || 'Asistan'),
        assistant_name: tenant?.assistant_name || preset[nameField] || 'Asistan',
        is_default: true,
        is_active: true,
      });
    }
  }

  if (templates.length > 0) {
    const { error } = await supabase
      .from('prompt_templates')
      .insert(templates);

    if (error) {
      console.error('[TenantService] Error creating prompt templates:', error);
    }
  }
}

/**
 * Güzellik salonu veya kuaför için varsayılan hizmetleri oluştur
 */
async function createDefaultBeautyServices(tenantId, industry = 'beauty_salon') {
  // Kuaför için farklı default hizmetler
  if (industry === 'hairdresser') {
    const hairdresserServices = [
      { name: 'Kadın Saç Kesimi', category: 'haircut', duration_minutes: 45, price: 250 },
      { name: 'Erkek Saç Kesimi', category: 'haircut', duration_minutes: 30, price: 150 },
      { name: 'Çocuk Saç Kesimi', category: 'haircut', duration_minutes: 25, price: 100 },
      { name: 'Saç Boyama', category: 'coloring', duration_minutes: 90, price: 400 },
      { name: 'Röfle', category: 'coloring', duration_minutes: 120, price: 500 },
      { name: 'Balyaj', category: 'coloring', duration_minutes: 150, price: 700 },
      { name: 'Fön', category: 'styling', duration_minutes: 30, price: 100 },
      { name: 'Maşa/Topuz', category: 'styling', duration_minutes: 45, price: 200 },
      { name: 'Saç Bakım Maskesi', category: 'styling', duration_minutes: 30, price: 150 },
      { name: 'Gelin Saçı', category: 'styling', duration_minutes: 120, price: 1000 },
    ];

    const { error } = await supabase
      .from('beauty_services')
      .insert(hairdresserServices.map(s => ({
        tenant_id: tenantId,
        ...s,
        currency: 'TRY',
        is_active: true,
      })));

    if (error) {
      console.error('[TenantService] Error creating default hairdresser services:', error);
    }
    return;
  }

  // Güzellik salonu için database function'ı çağır (mevcut davranış)
  const { error } = await supabase.rpc('create_default_beauty_services', {
    p_tenant_id: tenantId,
  });

  if (error) {
    console.error('[TenantService] Error creating default beauty services:', error);
  }
}

/**
 * Varsayılan slotları oluştur (JavaScript ile)
 */
async function generateDefaultSlots(tenantId, industry, daysAhead = 30) {
  const slotTypes = (industry === 'beauty' || industry === 'beauty_salon' || industry === 'hairdresser')
    ? ['beauty']
    : ['test_drive', 'service'];

  // Slotları JavaScript ile oluştur
  const slots = [];
  const today = new Date();
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]; // 09:00 - 18:00

  for (let day = 0; day <= daysAhead; day++) {
    const date = new Date(today);
    date.setDate(today.getDate() + day);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

    for (const hour of hours) {
      const timeStr = `${hour.toString().padStart(2, '0')}:00:00`; // HH:00:00
      for (const slotType of slotTypes) {
        slots.push({
          tenant_id: tenantId,
          slot_date: dateStr,
          slot_time: timeStr,
          slot_type: slotType,
          is_available: true,
        });
      }
    }
  }

  // Batch insert (Supabase 1000 satır limiti var, parçalayalım)
  const batchSize = 500;
  for (let i = 0; i < slots.length; i += batchSize) {
    const batch = slots.slice(i, i + batchSize);
    const { error } = await supabase
      .from('available_slots')
      .insert(batch);

    if (error) {
      console.error('[TenantService] Error generating slots batch:', error);
      return;
    }
  }

  console.log(`[TenantService] Generated ${slots.length} slots for tenant ${tenantId}`);
}

/**
 * Industry preset'lerini getir
 */
async function getIndustryPresets() {
  const { data, error } = await supabase
    .from('industry_presets')
    .select('*')
    .eq('is_active', true)
    .order('industry');

  if (error) throw error;
  return data || [];
}

/**
 * Tenant'ın prompt template'ini getir
 */
async function getTenantPromptTemplate(tenantId, language = 'tr') {
  // Önce tenant'a özel template'i ara
  let { data: template, error } = await supabase
    .from('prompt_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('language', language)
    .eq('is_active', true)
    .eq('is_default', true)
    .single();

  if (error || !template) {
    // Default template yoksa herhangi bir aktif template'i al
    const { data: anyTemplate } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('language', language)
      .eq('is_active', true)
      .limit(1)
      .single();

    template = anyTemplate;
  }

  // Hala yoksa industry preset'ten al
  if (!template) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('industry, name, assistant_name')
      .eq('id', tenantId)
      .single();

    if (tenant) {
      const { data: preset } = await supabase
        .from('industry_presets')
        .select('*')
        .eq('industry', tenant.industry)
        .single();

      if (preset) {
        const promptField = `default_prompt_${language}`;
        const welcomeField = `default_welcome_${language}`;
        const nameField = `default_assistant_name_${language}`;

        template = {
          system_prompt: preset[promptField]
            ?.replace(/{COMPANY_NAME}/g, tenant.name)
            .replace(/{ASSISTANT_NAME}/g, tenant.assistant_name || preset[nameField]),
          welcome_message: preset[welcomeField]
            ?.replace(/{COMPANY_NAME}/g, tenant.name)
            .replace(/{ASSISTANT_NAME}/g, tenant.assistant_name || preset[nameField]),
          assistant_name: tenant.assistant_name || preset[nameField],
        };
      }
    }
  }

  return template;
}

/**
 * Tenant voice config'ini getir
 */
async function getTenantVoiceConfig(tenantId) {
  const { data, error } = await supabase
    .from('tenants')
    .select(`
      id,
      name,
      industry,
      default_language,
      supported_languages,
      assistant_name,
      tts_provider,
      elevenlabs_voice_id
    `)
    .eq('id', tenantId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get tenant's selected template ID from authoritative source
 * @param {string} tenantId - Tenant UUID
 * @returns {string|null} - Template ID or null
 */
async function getTenantTemplateId(tenantId) {
  // tenant_assistant_template is the single source of truth
  const { data, error } = await supabase
    .from('tenant_assistant_template')
    .select('template_id')
    .eq('tenant_id', tenantId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[TenantService] Error fetching template ID:', error);
    return null;
  }

  return data?.template_id || null;
}

module.exports = {
  getAllTenants,
  getTenantById,
  getTenantBySlug,
  getTenantByPhoneNumber,
  createTenant,
  updateTenant,
  deleteTenant,
  getTenantStats,
  getIndustryPresets,
  getTenantPromptTemplate,
  getTenantVoiceConfig,
  getTenantTemplateId,
  createDefaultPromptTemplates,
  createDefaultBeautyServices,
  generateDefaultSlots,
};
