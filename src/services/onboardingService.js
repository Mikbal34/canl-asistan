/**
 * Onboarding Service
 * Tenant onboarding sureci yonetimi
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');
const tenantService = require('./tenantService');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

// VAPI Service - lazy load to avoid circular dependency
let vapiService = null;
function getVapiService() {
  if (!vapiService) {
    vapiService = require('./vapiService');
  }
  return vapiService;
}

/**
 * Slug olustur (URL-safe)
 * @param {string} name - Firma adi
 * @returns {string} - Slug
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[ıİ]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's')
    .replace(/[üÜ]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Slug unique kontrolu ve alternatif olusturma
 * @param {string} baseSlug - Base slug
 * @returns {string} - Unique slug
 */
async function ensureUniqueSlug(baseSlug) {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;

    if (counter > 100) {
      throw new Error('Could not generate unique slug');
    }
  }
}

// Default use cases per industry
const DEFAULT_USE_CASES = {
  automotive: ['test_drive', 'service', 'vehicle_inquiry', 'price_inquiry', 'callback'],
  beauty: ['beauty_services', 'appointment', 'staff_selection', 'price_inquiry', 'promotions', 'loyalty'], // Legacy - maps to beauty_salon
  beauty_salon: ['beauty_services', 'appointment', 'staff_selection', 'price_inquiry', 'promotions', 'loyalty'],
  hairdresser: ['hairdresser_services', 'appointment', 'staff_selection', 'price_inquiry', 'customer_history', 'callback'],
};

/**
 * ADIM 1: Firma kaydı (Sadeleştirilmiş)
 * Yeni tenant olustur, varsayilan ayarlari ata ve VAPI assistant olustur
 * Teknik ayarlar (ses, use case, calisma saatleri) admin tarafindan yapilir
 */
async function registerTenant(registrationData) {
  const {
    name,
    phone,
    email,
    password,
    language = 'tr',
    region = 'tr',
    assistantName,
    industry = 'automotive', // Multi-industry support
  } = registrationData;

  // Validation
  if (!name || !email || !password) {
    throw new Error('Name, email and password are required');
  }

  // Email unique kontrolu
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existingUser) {
    throw new Error('Email already registered');
  }

  // Slug olustur
  const baseSlug = generateSlug(name);
  const slug = await ensureUniqueSlug(baseSlug);

  // Sektore gore varsayilan asistan adini belirle
  const defaultAssistantNames = {
    automotive: 'Ayse',
    beauty: 'Elif', // Legacy - maps to beauty_salon
    beauty_salon: 'Elif',
    hairdresser: 'Selin',
  };
  const defaultAssistant = assistantName || defaultAssistantNames[industry] || 'Ayse';

  // Sektore gore varsayilan use case'leri al
  const defaultUseCases = DEFAULT_USE_CASES[industry] || DEFAULT_USE_CASES.automotive;

  // Tenant olustur (artik direkt aktif - onboarding sadece kayit)
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name,
      slug,
      industry, // Dinamik sektor secimi
      region,
      default_language: language,
      supported_languages: [language],
      assistant_name: defaultAssistant,
      phone,
      email,
      plan: 'starter',
      onboarding_status: 'active', // Artik direkt aktif
      onboarding_completed_at: new Date().toISOString(),
      is_active: true, // Direkt aktif - admin sonradan ayarlar
      enabled_use_cases: defaultUseCases, // Varsayilan use case'ler
    })
    .select()
    .single();

  if (tenantError) {
    console.error('[OnboardingService] Tenant creation error:', tenantError);
    throw new Error('Failed to create tenant');
  }

  // Varsayilan calisma saatlerini olustur (Pazartesi-Cuma 09:00-18:00)
  try {
    await supabase.rpc('create_default_working_hours', { p_tenant_id: tenant.id });
    console.log(`[OnboardingService] Default working hours created for tenant ${tenant.id}`);
  } catch (err) {
    console.error('[OnboardingService] Working hours creation error:', err);
    // Hata olsa bile devam et - admin sonra ayarlayabilir
  }

  // Admin kullanici olustur
  let user = null;

  // Development mode - demo user olustur
  if (process.env.NODE_ENV !== 'production') {
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        tenant_id: tenant.id,
        email,
        name: name, // Firma adi ile ayni
        role: 'tenant_admin',
        is_active: true,
      })
      .select()
      .single();

    if (userError) {
      // Rollback: Tenant'i sil
      await supabase.from('tenants').delete().eq('id', tenant.id);
      console.error('[OnboardingService] User creation error:', userError);
      throw new Error('Failed to create user');
    }

    user = newUser;
  } else {
    // Production - Supabase Auth kullan
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        // Rollback: Tenant'i sil
        await supabase.from('tenants').delete().eq('id', tenant.id);
        throw new Error(`Auth error: ${authError.message}`);
      }

      // DB'de kullanici olustur
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          auth_user_id: authData.user.id,
          tenant_id: tenant.id,
          email,
          name: name,
          role: 'tenant_admin',
          is_active: true,
        })
        .select()
        .single();

      if (userError) {
        // Rollback
        await supabase.auth.admin.deleteUser(authData.user.id);
        await supabase.from('tenants').delete().eq('id', tenant.id);
        throw new Error('Failed to create user');
      }

      user = newUser;
    } catch (err) {
      await supabase.from('tenants').delete().eq('id', tenant.id);
      throw err;
    }
  }

  // Industry preset'ten varsayilan prompt template'leri olustur
  try {
    await tenantService.createDefaultPromptTemplates(tenant.id, industry);
  } catch (err) {
    console.error('[OnboardingService] Prompt templates creation error:', err);
  }

  // Guzellik sektoru veya kuafor ise varsayilan hizmetleri olustur
  if (industry === 'beauty' || industry === 'beauty_salon' || industry === 'hairdresser') {
    try {
      await tenantService.createDefaultBeautyServices(tenant.id, industry);
    } catch (err) {
      console.error('[OnboardingService] Beauty/Hairdresser services creation error:', err);
    }
  }

  // VAPI Assistant olustur (varsayilan ayarlarla)
  // Admin sonradan ses ayarlarini ve use case'leri degistirebilir
  try {
    const vapi = getVapiService();
    await vapi.syncTenantToVapi(tenant.id);
    console.log(`[OnboardingService] VAPI assistant created for tenant ${tenant.id}`);
  } catch (err) {
    console.error('[OnboardingService] VAPI assistant creation error:', err);
    // Hata olsa bile devam et - admin sonra sync yapabilir
  }

  // Demo token olustur (development)
  let token = null;
  if (process.env.NODE_ENV !== 'production') {
    token = Buffer.from(JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      tenant_id: tenant.id,
      exp: Date.now() + (24 * 60 * 60 * 1000), // 24 saat
    })).toString('base64');
    token = `demo_${token}`;
  }

  console.log(`[OnboardingService] Tenant registered and activated: ${tenant.name} (${tenant.id})`);

  return {
    tenant,
    user,
    token,
    nextStep: 'dashboard', // Artik direkt dashboard'a yonlendir
  };
}

/**
 * ADIM 2A: Araç kataloğu yükle
 * CSV veya JSON formatında araç listesi
 */
async function uploadVehicles(tenantId, vehicles, options = {}) {
  const { skipIfEmpty = false } = options;

  // Skip secilmisse
  if (skipIfEmpty && (!vehicles || vehicles.length === 0)) {
    await updateOnboardingStatus(tenantId, 'vehicles');
    return { skipped: true, count: 0 };
  }

  if (!vehicles || vehicles.length === 0) {
    throw new Error('No vehicles provided');
  }

  // Araclari tenant_id ile isle
  const vehicleRecords = vehicles.map(v => ({
    tenant_id: tenantId,
    brand: v.brand || v.marka,
    model: v.model,
    year: v.year || v.yil,
    color: v.color || v.renk,
    fuel_type: v.fuel_type || v.yakit,
    transmission: v.transmission || v.vites,
    price: v.price || v.fiyat,
    is_available: v.is_available !== false && v.test_surusu !== false,
    stock_count: v.stock_count || v.stok || 1,
    features: v.features || v.ozellikler || [],
  }));

  // Toplu insert
  const { data, error } = await supabase
    .from('vehicles')
    .insert(vehicleRecords)
    .select();

  if (error) {
    console.error('[OnboardingService] Vehicles upload error:', error);
    throw new Error('Failed to upload vehicles');
  }

  // Onboarding durumunu guncelle
  await updateOnboardingStatus(tenantId, 'vehicles');

  console.log(`[OnboardingService] ${data.length} vehicles uploaded for tenant ${tenantId}`);

  return {
    count: data.length,
    vehicles: data,
  };
}

/**
 * ADIM 2A (Beauty): Hizmet katalogu yukle
 * JSON formatinda hizmet listesi
 */
async function uploadServices(tenantId, services, options = {}) {
  const { skipIfEmpty = false } = options;

  // Skip secilmisse
  if (skipIfEmpty && (!services || services.length === 0)) {
    await updateOnboardingStatus(tenantId, 'vehicles');
    return { skipped: true, count: 0 };
  }

  if (!services || services.length === 0) {
    throw new Error('No services provided');
  }

  // Hizmetleri tenant_id ile isle
  const serviceRecords = services.map(s => ({
    tenant_id: tenantId,
    name: s.name || s.hizmet,
    category: s.category || s.kategori || 'general',
    duration_minutes: s.duration_minutes || s.sure || 60,
    price: s.price || s.fiyat || 0,
    description: s.description || s.aciklama || '',
    is_active: s.is_active !== false,
  }));

  // Toplu insert
  const { data, error } = await supabase
    .from('beauty_services')
    .insert(serviceRecords)
    .select();

  if (error) {
    console.error('[OnboardingService] Services upload error:', error);
    throw new Error('Failed to upload services');
  }

  // Onboarding durumunu guncelle
  await updateOnboardingStatus(tenantId, 'vehicles');

  console.log(`[OnboardingService] ${data.length} services uploaded for tenant ${tenantId}`);

  return {
    count: data.length,
    services: data,
  };
}

/**
 * CSV'den hizmet parse et (Beauty)
 */
function parseServicesCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const services = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const service = {};

    headers.forEach((header, index) => {
      const value = values[index] || '';

      // Header mapping
      switch (header) {
        case 'hizmet':
        case 'name':
        case 'service':
          service.name = value;
          break;
        case 'kategori':
        case 'category':
          service.category = value;
          break;
        case 'sure':
        case 'duration':
        case 'duration_minutes':
          service.duration_minutes = parseInt(value) || 60;
          break;
        case 'fiyat':
        case 'price':
          service.price = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
          break;
        case 'aciklama':
        case 'description':
          service.description = value;
          break;
        case 'aktif':
        case 'active':
          service.is_active = value.toLowerCase() !== 'hayir' && value.toLowerCase() !== 'no' && value !== '0';
          break;
      }
    });

    // Zorunlu alanlar kontrolu
    if (service.name) {
      services.push(service);
    }
  }

  return services;
}

/**
 * Generic katalog yukleme (tablo-agnostik)
 * Config-driven onboarding icin
 */
async function uploadCatalog(tenantId, tableName, items, options = {}) {
  const { skipIfEmpty = false } = options;

  // Skip secilmisse
  if (skipIfEmpty && (!items || items.length === 0)) {
    return { skipped: true, count: 0 };
  }

  if (!items || items.length === 0) {
    return { count: 0, items: [] };
  }

  // Tablo ismine gore ozel islem
  if (tableName === 'vehicles') {
    return uploadVehicles(tenantId, items, options);
  }

  if (tableName === 'beauty_services') {
    return uploadServices(tenantId, items, options);
  }

  // Generic insert - diger tablolar icin
  const records = items.map(item => ({
    tenant_id: tenantId,
    ...item,
  }));

  const { data, error } = await supabase
    .from(tableName)
    .insert(records)
    .select();

  if (error) {
    console.error(`[OnboardingService] Catalog upload error for ${tableName}:`, error);
    throw new Error(`Failed to upload to ${tableName}`);
  }

  console.log(`[OnboardingService] ${data.length} items uploaded to ${tableName} for tenant ${tenantId}`);

  return {
    count: data.length,
    items: data,
  };
}

/**
 * Generic CSV parser
 * Header satirini otomatik okur ve objelere donusturur
 */
function parseGenericCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const items = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const item = {};

    headers.forEach((header, index) => {
      const value = values[index] || '';

      // Sayi kontrolu
      if (/^\d+$/.test(value)) {
        item[header] = parseInt(value);
      } else if (/^\d+\.\d+$/.test(value)) {
        item[header] = parseFloat(value);
      } else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'evet') {
        item[header] = true;
      } else if (value.toLowerCase() === 'false' || value.toLowerCase() === 'hayir') {
        item[header] = false;
      } else {
        item[header] = value;
      }
    });

    // En az bir deger doluysa ekle
    if (Object.values(item).some(v => v !== '')) {
      items.push(item);
    }
  }

  return items;
}

/**
 * Onboarding config'ini industry'ye gore getir
 * Config-driven onboarding icin
 */
async function getOnboardingConfig(industry) {
  const { data, error } = await supabase
    .from('industry_presets')
    .select('onboarding_config')
    .eq('industry', industry)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('[OnboardingService] Get onboarding config error:', error);
    return null;
  }

  return data?.onboarding_config || null;
}

/**
 * CSV'den araç parse et
 */
function parseVehiclesCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const vehicles = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const vehicle = {};

    headers.forEach((header, index) => {
      const value = values[index] || '';

      // Header mapping
      switch (header) {
        case 'marka':
        case 'brand':
          vehicle.brand = value;
          break;
        case 'model':
          vehicle.model = value;
          break;
        case 'yil':
        case 'year':
          vehicle.year = parseInt(value) || new Date().getFullYear();
          break;
        case 'renk':
        case 'color':
          vehicle.color = value;
          break;
        case 'yakit':
        case 'fuel':
        case 'fuel_type':
          vehicle.fuel_type = value;
          break;
        case 'vites':
        case 'transmission':
          vehicle.transmission = value;
          break;
        case 'fiyat':
        case 'price':
          vehicle.price = parseFloat(value.replace(/[^0-9.]/g, '')) || null;
          break;
        case 'stok':
        case 'stock':
          vehicle.stock_count = parseInt(value) || 1;
          break;
        case 'test_surusu':
        case 'available':
          vehicle.is_available = value.toLowerCase() !== 'hayir' && value.toLowerCase() !== 'no' && value !== '0';
          break;
      }
    });

    // Zorunlu alanlar kontrolu
    if (vehicle.brand && vehicle.model) {
      vehicles.push(vehicle);
    }
  }

  return vehicles;
}

/**
 * ADIM 2B: Çalışma saatlerini kaydet
 */
async function setWorkingHours(tenantId, workingHours) {
  if (!workingHours || !Array.isArray(workingHours)) {
    throw new Error('Working hours must be an array');
  }

  // Mevcut kayitlari sil
  await supabase
    .from('working_hours')
    .delete()
    .eq('tenant_id', tenantId);

  // Yeni kayitlari ekle
  const records = workingHours.map(wh => ({
    tenant_id: tenantId,
    day_of_week: wh.day_of_week,
    open_time: wh.is_open ? wh.open_time : null,
    close_time: wh.is_open ? wh.close_time : null,
    is_open: wh.is_open !== false,
    break_start: wh.break_start || null,
    break_end: wh.break_end || null,
  }));

  const { data, error } = await supabase
    .from('working_hours')
    .insert(records)
    .select();

  if (error) {
    console.error('[OnboardingService] Working hours save error:', error);
    throw new Error('Failed to save working hours');
  }

  console.log(`[OnboardingService] Working hours saved for tenant ${tenantId}`);

  return data;
}

/**
 * Çalışma saatlerini getir
 */
async function getWorkingHours(tenantId) {
  const { data, error } = await supabase
    .from('working_hours')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('day_of_week');

  if (error) throw error;
  return data || [];
}

/**
 * ADIM 3: Ses ayarlarını güncelle
 */
async function updateVoiceSettings(tenantId, voiceSettings) {
  const {
    assistantName,
    voicePresetId,
    voiceId,
    greetingMessage,
  } = voiceSettings;

  const updates = {};

  // Assistant adi
  if (assistantName) {
    updates.assistant_name = assistantName;
  }

  // Voice preset secildiyse
  if (voicePresetId) {
    const { data: preset } = await supabase
      .from('voice_presets')
      .select('*')
      .eq('id', voicePresetId)
      .single();

    if (preset) {
      // Voice config override olustur
      updates.voice_config_override = {
        voice_provider: preset.provider,
        voice_id: preset.voice_id,
      };
    }
  } else if (voiceId) {
    // Direkt voice ID verilmisse
    updates.voice_config_override = {
      voice_id: voiceId,
    };
  }

  // Karsilama mesaji
  if (greetingMessage) {
    const existingOverride = (await supabase
      .from('tenants')
      .select('voice_config_override')
      .eq('id', tenantId)
      .single()).data?.voice_config_override || {};

    updates.voice_config_override = {
      ...existingOverride,
      ...(updates.voice_config_override || {}),
      first_message: greetingMessage,
    };
  }

  // Tenant'i guncelle
  const { data, error } = await supabase
    .from('tenants')
    .update(updates)
    .eq('id', tenantId)
    .select()
    .single();

  if (error) {
    console.error('[OnboardingService] Voice settings update error:', error);
    throw new Error('Failed to update voice settings');
  }

  // Onboarding durumunu guncelle
  await updateOnboardingStatus(tenantId, 'voice');

  console.log(`[OnboardingService] Voice settings updated for tenant ${tenantId}`);

  return data;
}

/**
 * Voice preset listesini getir
 */
async function getVoicePresets(language = null) {
  let query = supabase
    .from('voice_presets')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (language) {
    query = query.or(`language.eq.${language},language.eq.multi`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * ADIM 4: Test çağrısı başlat
 */
async function initiateTestCall(tenantId) {
  // VAPI assistant'larini olustur (henuz olusturulmadiysa)
  const vapi = getVapiService();

  try {
    const syncResults = await vapi.syncTenantToVapi(tenantId);
    console.log(`[OnboardingService] VAPI sync completed for tenant ${tenantId}:`, syncResults);
  } catch (err) {
    console.error('[OnboardingService] VAPI sync error:', err);
    throw new Error('Failed to create voice assistant');
  }

  // Tenant bilgisini al
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (error || !tenant) {
    throw new Error('Tenant not found');
  }

  // Onboarding durumunu guncelle
  await updateOnboardingStatus(tenantId, 'testing');

  // Test numarasi bilgisi dondur
  // Not: Gercek uygulamada VAPI'den telefon numarasi alinir
  // veya mevcut test numarasi kullanilir
  return {
    testPhoneNumber: tenant.phone || '+90 850 XXX XX XX', // Placeholder
    assistantId: tenant.vapi_assistant_id_tr,
    status: 'ready',
    testScenarios: [
      'Test surusu randevusu almak istiyorum',
      'Hangi araclariniz var?',
      'Yarin musait misiniz?',
    ],
  };
}

/**
 * ADIM 4: Aktivasyon
 * Onboarding'i tamamla ve tenant'i aktifle
 */
async function activateTenant(tenantId) {
  // Checklist kontrolu
  const checklist = await validateOnboardingChecklist(tenantId);

  // Zorunlu alanlar kontrolu
  const requiredFields = ['hasCompanyInfo', 'hasWorkingHours', 'hasVoiceSettings', 'hasVapiAssistant'];
  const missingFields = requiredFields.filter(field => !checklist[field]);

  if (missingFields.length > 0) {
    throw new Error(`Missing required steps: ${missingFields.join(', ')}`);
  }

  // Tenant'i aktifle
  const { data, error } = await supabase
    .from('tenants')
    .update({
      onboarding_status: 'active',
      onboarding_completed_at: new Date().toISOString(),
      is_active: true,
    })
    .eq('id', tenantId)
    .select()
    .single();

  if (error) {
    console.error('[OnboardingService] Activation error:', error);
    throw new Error('Failed to activate tenant');
  }

  console.log(`[OnboardingService] Tenant activated: ${data.name} (${tenantId})`);

  return {
    tenant: data,
    message: 'Tenant successfully activated',
    redirectUrl: '/dashboard',
  };
}

/**
 * Onboarding checklist doğrulama
 */
async function validateOnboardingChecklist(tenantId) {
  // Tenant bilgisini al
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (error || !tenant) {
    throw new Error('Tenant not found');
  }

  // Sektore gore katalog sayisi
  let catalogCount = 0;
  let catalogLabel = 'items';

  if (tenant.industry === 'beauty') {
    const { count } = await supabase
      .from('beauty_services')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    catalogCount = count || 0;
    catalogLabel = 'services';
  } else {
    // Automotive (default)
    const { count } = await supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    catalogCount = count || 0;
    catalogLabel = 'vehicles';
  }

  // Calisma saatleri
  const { count: workingHoursCount } = await supabase
    .from('working_hours')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_open', true);

  // Checklist
  return {
    industry: tenant.industry,
    hasCompanyInfo: !!(tenant.name && tenant.email),
    hasCatalog: catalogCount > 0,
    catalogCount: catalogCount,
    catalogLabel: catalogLabel,
    // Backward compatibility
    hasVehicles: tenant.industry === 'automotive' ? catalogCount > 0 : true,
    vehicleCount: tenant.industry === 'automotive' ? catalogCount : 0,
    hasServices: tenant.industry === 'beauty' ? catalogCount > 0 : true,
    serviceCount: tenant.industry === 'beauty' ? catalogCount : 0,
    hasWorkingHours: workingHoursCount > 0,
    workingHoursCount: workingHoursCount || 0,
    hasAssistantName: !!tenant.assistant_name,
    hasVoiceSettings: !!(tenant.voice_config_override || tenant.assistant_name),
    hasVapiAssistant: !!(tenant.vapi_assistant_id_tr || tenant.vapi_assistant_id_en),
    onboardingStatus: tenant.onboarding_status,
    isActive: tenant.is_active,
  };
}

/**
 * Onboarding durumunu güncelle
 */
async function updateOnboardingStatus(tenantId, status) {
  const { error } = await supabase
    .from('tenants')
    .update({ onboarding_status: status })
    .eq('id', tenantId);

  if (error) {
    console.error('[OnboardingService] Status update error:', error);
  }
}

/**
 * Onboarding özeti getir
 */
async function getOnboardingSummary(tenantId) {
  // Tenant bilgisi
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (tenantError || !tenant) {
    throw new Error('Tenant not found');
  }

  // Araclar
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model, year')
    .eq('tenant_id', tenantId)
    .limit(5);

  // Calisma saatleri
  const { data: workingHours } = await supabase
    .from('working_hours')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_open', true)
    .order('day_of_week');

  // Checklist
  const checklist = await validateOnboardingChecklist(tenantId);

  return {
    tenant: {
      name: tenant.name,
      slug: tenant.slug,
      industry: tenant.industry,
      language: tenant.default_language,
      assistantName: tenant.assistant_name,
      phone: tenant.phone,
      email: tenant.email,
    },
    vehicles: {
      count: checklist.vehicleCount,
      samples: vehicles || [],
    },
    workingHours: workingHours || [],
    voiceSettings: {
      assistantName: tenant.assistant_name,
      hasCustomConfig: !!tenant.voice_config_override,
      vapiAssistantId: tenant.vapi_assistant_id_tr,
    },
    checklist,
    onboardingStatus: tenant.onboarding_status,
    readyForActivation: checklist.hasCompanyInfo && checklist.hasWorkingHours && checklist.hasVapiAssistant,
  };
}

/**
 * Aktif industry presetlerini getir
 */
async function getIndustryPresets() {
  const { data, error } = await supabase
    .from('industry_presets')
    .select('industry, display_name, description, icon, primary_color, is_active')
    .eq('is_active', true)
    .order('industry');

  if (error) {
    console.error('[OnboardingService] Industry presets error:', error);
    throw error;
  }

  return data || [];
}

/**
 * Sektore ozel test senaryolari
 */
function getTestScenarios(industry) {
  const scenarios = {
    automotive: [
      { id: 1, text: 'Test surusu randevusu almak istiyorum', category: 'test_drive' },
      { id: 2, text: 'Hangi araclariniz var?', category: 'vehicles' },
      { id: 3, text: 'Yarin saat 14:00 musait misiniz?', category: 'availability' },
      { id: 4, text: 'Servis randevusu almak istiyorum', category: 'service' },
    ],
    beauty: [
      { id: 1, text: 'Cilt bakimi randevusu almak istiyorum', category: 'appointment' },
      { id: 2, text: 'Hangi hizmetleriniz var?', category: 'services' },
      { id: 3, text: 'Yarin saat 15:00 musait misiniz?', category: 'availability' },
      { id: 4, text: 'Manikur ve pedikur fiyatlari ne kadar?', category: 'pricing' },
    ],
    beauty_salon: [
      { id: 1, text: 'Cilt bakimi randevusu almak istiyorum', category: 'appointment' },
      { id: 2, text: 'Hangi guzellik hizmetleriniz var?', category: 'services' },
      { id: 3, text: 'Yarin saat 15:00 musait misiniz?', category: 'availability' },
      { id: 4, text: 'Manikur ve SPA fiyatlari ne kadar?', category: 'pricing' },
    ],
    hairdresser: [
      { id: 1, text: 'Sac kesimi randevusu almak istiyorum', category: 'appointment' },
      { id: 2, text: 'Hangi kuaforleriniz var?', category: 'staff' },
      { id: 3, text: 'Yarin saat 14:00 musait misiniz?', category: 'availability' },
      { id: 4, text: 'Sac boyama fiyati ne kadar?', category: 'pricing' },
    ],
  };

  return scenarios[industry] || scenarios.automotive;
}

module.exports = {
  // Registration
  registerTenant,
  generateSlug,
  ensureUniqueSlug,

  // Vehicles (Automotive)
  uploadVehicles,
  parseVehiclesCSV,

  // Services (Beauty)
  uploadServices,
  parseServicesCSV,

  // Generic catalog (config-driven)
  uploadCatalog,
  parseGenericCSV,

  // Config-driven onboarding
  getOnboardingConfig,

  // Working Hours
  setWorkingHours,
  getWorkingHours,

  // Voice Settings
  updateVoiceSettings,
  getVoicePresets,

  // Test & Activation
  initiateTestCall,
  activateTenant,

  // Industry
  getIndustryPresets,
  getTestScenarios,

  // Utilities
  validateOnboardingChecklist,
  getOnboardingSummary,
  updateOnboardingStatus,
};
