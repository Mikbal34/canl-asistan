/**
 * Supabase Service - Multi-tenant aware
 * Tüm veritabanı operasyonları için tenant izolasyonu sağlar
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);
// Admin client for operations that need to bypass RLS
const supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceRoleKey);

// ==========================================
// MÜŞTERI İŞLEMLERİ
// ==========================================

/**
 * Müşteriyi getir veya oluştur (tenant-scoped)
 */
async function getOrCreateCustomer(tenantId, phone, name = null) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  // Önce mevcut müşteriyi kontrol et
  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('phone', phone)
    .single();

  if (existing) {
    return existing;
  }

  // Yeni müşteri oluştur
  const { data, error } = await supabaseAdmin
    .from('customers')
    .insert({ tenant_id: tenantId, phone, name })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Müşteri güncelle
 */
async function updateCustomer(tenantId, customerId, updates) {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', customerId)
    .eq('tenant_id', tenantId) // Tenant isolation
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Tüm müşterileri getir (tenant-scoped)
 * Soft delete filtresi uygulanır
 */
async function getAllCustomers(tenantId) {
  const { data, error } = await supabaseAdminAdmin
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null) // Soft delete filter
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ==========================================
// ARAÇ İŞLEMLERİ (Otomotiv)
// ==========================================

/**
 * Müsait araçları getir (tenant-scoped)
 */
async function getAvailableVehicles(tenantId, filters = {}) {
  console.log('[Supabase] getAvailableVehicles called with tenantId:', tenantId, 'filters:', filters);

  let query = supabaseAdmin
    .from('vehicles')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('available_for_test_drive', true);

  if (filters.brand) {
    query = query.ilike('brand', `%${filters.brand}%`);
  }
  if (filters.model) {
    query = query.ilike('model', `%${filters.model}%`);
  }
  if (filters.maxPrice) {
    query = query.lte('price', filters.maxPrice);
  }
  if (filters.fuelType) {
    query = query.eq('fuel_type', filters.fuelType);
  }

  const { data, error } = await query;
  console.log('[Supabase] getAvailableVehicles result - count:', data?.length, 'error:', error);
  if (data?.length > 0) {
    console.log('[Supabase] First vehicle:', data[0]);
  }
  if (error) throw error;
  return data || [];
}

/**
 * Araç detayı getir
 */
async function getVehicleById(tenantId, vehicleId) {
  const { data, error } = await supabaseAdmin
    .from('vehicles')
    .select('*')
    .eq('id', vehicleId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Tüm araçları getir (tenant-scoped)
 */
async function getAllVehicles(tenantId) {
  const { data, error } = await supabaseAdmin
    .from('vehicles')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('brand', { ascending: true });

  if (error) throw error;
  return data || [];
}

// ==========================================
// GÜZELLİK HİZMETLERİ
// ==========================================

/**
 * Güzellik hizmetlerini getir (tenant-scoped)
 */
async function getBeautyServices(tenantId, filters = {}) {
  let query = supabaseAdmin
    .from('beauty_services')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null) // Soft delete filter
    .order('display_order', { ascending: true });

  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Güzellik hizmeti detayı
 * Not: Silinmiş hizmetler de döndürülür (randevu geçmişi için)
 */
async function getBeautyServiceById(tenantId, serviceId) {
  const { data, error } = await supabaseAdmin
    .from('beauty_services')
    .select('*')
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw error;
  return data;
}

// ==========================================
// SLOT İŞLEMLERİ
// ==========================================

/**
 * Müsait slotları getir (tenant-scoped)
 * appointment_slots tablosunu kullanır
 */
async function getAvailableSlots(tenantId, date, slotType) {
  const { data, error } = await supabaseAdminAdmin
    .from('appointment_slots')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('slot_date', date)
    .eq('is_available', true)
    .order('slot_time');

  if (error) {
    console.error('[Supabase] getAvailableSlots error:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Müsait tarihleri getir (gelecek N gün için)
 * Her gün için müsait slot sayısını döner
 */
async function getAvailableDates(tenantId, days = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);

  const todayStr = today.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const { data, error } = await supabaseAdminAdmin
    .from('appointment_slots')
    .select('slot_date, is_available')
    .eq('tenant_id', tenantId)
    .eq('is_available', true)
    .gte('slot_date', todayStr)
    .lt('slot_date', endDateStr)
    .order('slot_date');

  if (error) {
    console.error('[Supabase] getAvailableDates error:', error.message);
    return [];
  }

  // Tarihlere göre grupla ve say
  const dateMap = {};
  const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  (data || []).forEach(slot => {
    if (!dateMap[slot.slot_date]) {
      const date = new Date(slot.slot_date);
      dateMap[slot.slot_date] = {
        date: slot.slot_date,
        day_name: dayNames[date.getDay()],
        slot_count: 0,
      };
    }
    dateMap[slot.slot_date].slot_count++;
  });

  return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Slot müsaitlik kontrolü ve rezervasyon (tenant-scoped)
 * appointment_slots tablosunu kullanır
 */
async function checkAndBookSlot(tenantId, date, time, slotType) {
  const timeWithSeconds = time.includes(':') && time.split(':').length === 2 ? time + ':00' : time;
  const timeWithoutSeconds = time.substring(0, 5);

  // appointment_slots'ta slot ara
  const { data: slot, error: findError } = await supabaseAdmin
    .from('appointment_slots')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('slot_date', date)
    .or(`slot_time.eq.${timeWithSeconds},slot_time.eq.${timeWithoutSeconds}`)
    .single();

  // Slot bulunamadı - müsait kabul et (admin henüz slot oluşturmamış olabilir)
  if (findError || !slot) {
    console.log(`[Supabase] Slot bulunamadı, müsait kabul ediliyor: ${date} ${time}`);
    return { available: true, slotId: null };
  }

  // Slot müsait değil
  if (!slot.is_available) {
    return { available: false, slotId: slot.id };
  }

  // Slot müsait - rezerve et
  const { error: updateError } = await supabaseAdmin
    .from('appointment_slots')
    .update({ is_available: false, updated_at: new Date().toISOString() })
    .eq('id', slot.id);

  if (updateError) throw updateError;

  return { available: true, slotId: slot.id };
}

/**
 * Aynı tarih/saat için mevcut randevu var mı kontrol et (tenant-scoped)
 */
async function checkExistingAppointment(tenantId, date, time, type) {
  const tables = {
    test_drive: 'test_drive_appointments',
    service: 'service_appointments',
    beauty: 'beauty_appointments',
  };

  const table = tables[type];
  if (!table) return false;

  const { data, error } = await supabaseAdmin
    .from(table)
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('appointment_date', date)
    .eq('appointment_time', time + ':00')
    .in('status', ['pending', 'confirmed']);

  if (error) throw error;
  return data && data.length > 0;
}

// ==========================================
// TEST SÜRÜŞÜ RANDEVULARI
// ==========================================

/**
 * Test sürüşü randevusu oluştur (tenant-scoped)
 */
async function createTestDriveAppointment(tenantId, customerId, vehicleId, date, time, notes = null) {
  const { data, error } = await supabaseAdmin
    .from('test_drive_appointments')
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      vehicle_id: vehicleId,
      appointment_date: date,
      appointment_time: time,
      notes,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Test sürüşü randevularını getir (tenant-scoped)
 */
async function getTestDriveAppointments(tenantId, customerId = null) {
  let query = supabaseAdminAdmin
    .from('test_drive_appointments')
    .select(`
      *,
      customer:customers(*),
      vehicle:vehicles(*)
    `)
    .eq('tenant_id', tenantId)
    .order('appointment_date', { ascending: true });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Test sürüşü durumu güncelle
 */
async function updateTestDriveStatus(tenantId, appointmentId, status) {
  const { data, error } = await supabaseAdmin
    .from('test_drive_appointments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', appointmentId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ==========================================
// SERVİS RANDEVULARI
// ==========================================

/**
 * Servis randevusu oluştur (tenant-scoped)
 */
async function createServiceAppointment(tenantId, customerId, vehiclePlate, vehicleBrand, vehicleModel, serviceType, date, time, notes = null) {
  const { data, error } = await supabaseAdmin
    .from('service_appointments')
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      vehicle_plate: vehiclePlate,
      vehicle_brand: vehicleBrand,
      vehicle_model: vehicleModel,
      service_type: serviceType,
      appointment_date: date,
      appointment_time: time,
      notes,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Servis randevularını getir (tenant-scoped)
 */
async function getServiceAppointments(tenantId, customerId = null) {
  let query = supabaseAdminAdmin
    .from('service_appointments')
    .select(`
      *,
      customer:customers(*)
    `)
    .eq('tenant_id', tenantId)
    .order('appointment_date', { ascending: true });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Servis durumu güncelle
 */
async function updateServiceStatus(tenantId, appointmentId, status) {
  const { data, error } = await supabaseAdmin
    .from('service_appointments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', appointmentId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ==========================================
// GÜZELLİK RANDEVULARI
// ==========================================

/**
 * Güzellik randevusu oluştur (tenant-scoped)
 */
async function createBeautyAppointment(tenantId, customerId, serviceId, date, time, notes = null) {
  // Hizmet bilgisini al
  const service = await getBeautyServiceById(tenantId, serviceId);

  const { data, error } = await supabaseAdmin
    .from('beauty_appointments')
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      service_id: serviceId,
      appointment_date: date,
      appointment_time: time,
      duration_minutes: service?.duration_minutes,
      price_at_booking: service?.price,
      currency: service?.currency || 'TRY',
      notes,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Güzellik randevularını getir (tenant-scoped)
 */
async function getBeautyAppointments(tenantId, customerId = null) {
  let query = supabaseAdmin
    .from('beauty_appointments')
    .select(`
      *,
      customer:customers(*),
      service:beauty_services(*)
    `)
    .eq('tenant_id', tenantId)
    .order('appointment_date', { ascending: true });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Güzellik randevusu durumu güncelle
 */
async function updateBeautyStatus(tenantId, appointmentId, status) {
  const { data, error } = await supabaseAdmin
    .from('beauty_appointments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', appointmentId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ==========================================
// ORTAK RANDEVU İŞLEMLERİ
// ==========================================

/**
 * Randevu iptal et (tenant-scoped)
 */
async function cancelAppointment(tenantId, appointmentId, type) {
  const tables = {
    test_drive: 'test_drive_appointments',
    service: 'service_appointments',
    beauty: 'beauty_appointments',
  };

  const table = tables[type];
  if (!table) throw new Error('Invalid appointment type');

  const { data, error } = await supabaseAdmin
    .from(table)
    .update({ status: 'cancelled' })
    .eq('id', appointmentId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Randevu tarih/saat değiştir (tenant-scoped)
 */
async function rescheduleAppointment(tenantId, appointmentId, type, newDate, newTime) {
  const tables = {
    test_drive: 'test_drive_appointments',
    service: 'service_appointments',
    beauty: 'beauty_appointments',
  };

  const table = tables[type];
  if (!table) throw new Error('Invalid appointment type');

  // Yeni tarih/saat müsait mi kontrol et
  const existingCheck = await checkExistingAppointment(tenantId, newDate, newTime, type);
  if (existingCheck) {
    return { success: false, error: 'slot_unavailable' };
  }

  const { data, error } = await supabaseAdmin
    .from(table)
    .update({
      appointment_date: newDate,
      appointment_time: newTime + ':00',
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return { success: true, appointment: data };
}

/**
 * Müşterinin aktif randevularını getir (tenant-scoped)
 */
async function getCustomerActiveAppointments(tenantId, customerPhone) {
  // Önce müşteriyi bul
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('phone', customerPhone)
    .single();

  if (!customer) {
    return { testDrives: [], services: [], beauty: [] };
  }

  const today = new Date().toISOString().split('T')[0];

  // Paralel sorgular
  const [testDriveResult, serviceResult, beautyResult] = await Promise.all([
    // Test sürüşü randevuları
    supabase
      .from('test_drive_appointments')
      .select(`*, vehicle:vehicles(brand, model)`)
      .eq('tenant_id', tenantId)
      .eq('customer_id', customer.id)
      .in('status', ['pending', 'confirmed'])
      .gte('appointment_date', today)
      .order('appointment_date'),

    // Servis randevuları
    supabase
      .from('service_appointments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customer.id)
      .in('status', ['pending', 'confirmed'])
      .gte('appointment_date', today)
      .order('appointment_date'),

    // Güzellik randevuları
    supabase
      .from('beauty_appointments')
      .select(`*, service:beauty_services(name)`)
      .eq('tenant_id', tenantId)
      .eq('customer_id', customer.id)
      .in('status', ['pending', 'confirmed'])
      .gte('appointment_date', today)
      .order('appointment_date'),
  ]);

  return {
    testDrives: testDriveResult.data || [],
    services: serviceResult.data || [],
    beauty: beautyResult.data || [],
  };
}

// ==========================================
// ARAMA KAYITLARI
// ==========================================

/**
 * Arama kaydı oluştur (tenant-scoped)
 */
async function createCallLog(tenantId, customerId, callData) {
  const { data, error } = await supabaseAdmin
    .from('call_logs')
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      call_sid: callData.callSid,
      from_number: callData.from,
      to_number: callData.to,
      direction: callData.direction || 'inbound',
      status: 'in_progress',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Arama kaydı güncelle
 */
async function updateCallLog(tenantId, callLogId, updates) {
  const { data, error } = await supabaseAdmin
    .from('call_logs')
    .update(updates)
    .eq('id', callLogId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Arama kayıtlarını getir (tenant-scoped)
 */
async function getCallLogs(tenantId, limit = 50) {
  const { data, error } = await supabaseAdmin
    .from('call_logs')
    .select(`
      *,
      customer:customers(name, phone)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Vapi formatında arama kaydı kaydet
 */
async function saveCallLog(tenantId, callReport) {
  const { call, summary, transcript, endedReason } = callReport;

  const callerPhone = call?.customer?.number || 'unknown';

  // Müşteriyi bul (varsa)
  let customerId = null;
  if (callerPhone !== 'unknown') {
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone', callerPhone)
      .single();

    if (customer) {
      customerId = customer.id;
    }
  }

  // Süreyi hesapla
  let durationSeconds = null;
  if (call?.startedAt && call?.endedAt) {
    const started = new Date(call.startedAt);
    const ended = new Date(call.endedAt);
    durationSeconds = Math.round((ended - started) / 1000);
  }

  const { data, error } = await supabaseAdmin
    .from('call_logs')
    .insert({
      tenant_id: tenantId,
      call_sid: call?.id,
      from_number: callerPhone,
      customer_id: customerId,
      direction: 'inbound',
      duration: durationSeconds,
      status: endedReason || 'completed',
      summary: summary,
      transcript: typeof transcript === 'string' ? transcript : JSON.stringify(transcript),
    })
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Call log kayıt hatası:', error);
    throw error;
  }

  console.log('[Supabase] Call log kaydedildi:', data.id);
  return data;
}

// ==========================================
// ISLETME BILGILERI
// ==========================================

/**
 * Tenant/işletme bilgilerini getir
 */
async function getTenantInfo(tenantId) {
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('id, name, address, phone, email, website, assistant_name, welcome_message')
    .eq('id', tenantId)
    .single();

  if (error) throw error;
  return data;
}

// ==========================================
// CALISMA SAATLERI
// ==========================================

/**
 * Çalışma saatlerini getir (tenant-scoped)
 */
async function getWorkingHours(tenantId, dayOfWeek = null) {
  let query = supabaseAdmin
    .from('working_hours')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('day_of_week');

  if (dayOfWeek !== null) {
    query = query.eq('day_of_week', dayOfWeek);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Özel günleri getir (tenant-scoped)
 */
async function getSpecialDays(tenantId, fromDate = null) {
  let query = supabaseAdmin
    .from('special_days')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('date');

  if (fromDate) {
    query = query.gte('date', fromDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ==========================================
// MUSTERI GECMISI
// ==========================================

/**
 * Müşterinin geçmiş randevularını getir (tenant-scoped)
 */
async function getCustomerHistory(tenantId, customerPhone, limit = 5) {
  // Önce müşteriyi bul
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('phone', customerPhone)
    .single();

  if (!customer) {
    return [];
  }

  // Tamamlanmış randevuları getir (en son tarihten başlayarak)
  const [testDriveResult, serviceResult, beautyResult] = await Promise.all([
    supabase
      .from('test_drive_appointments')
      .select(`*, vehicle:vehicles(brand, model)`)
      .eq('tenant_id', tenantId)
      .eq('customer_id', customer.id)
      .eq('status', 'completed')
      .order('appointment_date', { ascending: false })
      .limit(limit),

    supabase
      .from('service_appointments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customer.id)
      .eq('status', 'completed')
      .order('appointment_date', { ascending: false })
      .limit(limit),

    supabase
      .from('beauty_appointments')
      .select(`*, service:beauty_services(name)`)
      .eq('tenant_id', tenantId)
      .eq('customer_id', customer.id)
      .eq('status', 'completed')
      .order('appointment_date', { ascending: false })
      .limit(limit),
  ]);

  // Hepsini birleştir ve tarihe göre sırala
  const allHistory = [
    ...(testDriveResult.data || []).map(a => ({
      type: 'test_drive',
      date: a.appointment_date,
      time: a.appointment_time,
      description: a.vehicle ? `${a.vehicle.brand} ${a.vehicle.model} test sürüşü` : 'Test sürüşü',
      notes: a.notes,
    })),
    ...(serviceResult.data || []).map(a => ({
      type: 'service',
      date: a.appointment_date,
      time: a.appointment_time,
      description: `${a.vehicle_brand || ''} ${a.vehicle_model || ''} - ${a.service_type}`,
      notes: a.notes,
    })),
    ...(beautyResult.data || []).map(a => ({
      type: 'beauty',
      date: a.appointment_date,
      time: a.appointment_time,
      description: a.service?.name || 'Güzellik hizmeti',
      notes: a.notes,
    })),
  ];

  // Tarihe göre sırala ve limitle
  return allHistory
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}

// ==========================================
// KAMPANYALAR
// ==========================================

/**
 * Aktif kampanyaları getir (tenant-scoped)
 */
async function getActiveCampaigns(tenantId) {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .lte('valid_from', today)
    .gte('valid_until', today)
    .order('valid_until');

  if (error) throw error;
  return data || [];
}

// ==========================================
// PROMOSYON KODLARI
// ==========================================

/**
 * Promosyon kodunu kontrol et ve bilgilerini getir (tenant-scoped)
 */
async function getPromotionCode(tenantId, code) {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabaseAdmin
    .from('promotion_codes')
    .select(`
      *,
      campaign:campaigns(name, description, discount_type, discount_value)
    `)
    .eq('tenant_id', tenantId)
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return { valid: false, message: 'Geçersiz promosyon kodu' };
  }

  // Tarih kontrolü
  if (data.valid_from && data.valid_from > today) {
    return { valid: false, message: 'Bu kod henüz aktif değil' };
  }
  if (data.valid_until && data.valid_until < today) {
    return { valid: false, message: 'Bu kodun süresi dolmuş' };
  }

  // Kullanım limiti kontrolü
  if (data.max_uses && data.current_uses >= data.max_uses) {
    return { valid: false, message: 'Bu kod kullanım limitine ulaşmış' };
  }

  // Discount bilgisi
  const discountType = data.discount_type || data.campaign?.discount_type || 'percent';
  const discountValue = data.discount_value || data.campaign?.discount_value || 0;

  return {
    valid: true,
    code: data.code,
    discount_type: discountType,
    discount_value: discountValue,
    description: data.description || data.campaign?.description,
    message: discountType === 'percent'
      ? `%${discountValue} indirim uygulandı`
      : `${discountValue} TL indirim uygulandı`,
  };
}

/**
 * Promosyon kodu kullanımını kaydet
 */
async function usePromotionCode(tenantId, code, customerId, appointmentId, appointmentType, discountAmount) {
  // Önce kodu bul
  const { data: promoCode } = await supabaseAdmin
    .from('promotion_codes')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('code', code.toUpperCase())
    .single();

  if (!promoCode) return null;

  // Kullanımı kaydet
  const { data, error } = await supabaseAdmin
    .from('promotion_code_usage')
    .insert({
      promotion_code_id: promoCode.id,
      customer_id: customerId,
      appointment_id: appointmentId,
      appointment_type: appointmentType,
      discount_amount: discountAmount,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ==========================================
// SADAKAT PUANLARI
// ==========================================

/**
 * Müşterinin sadakat puanlarını getir (tenant-scoped)
 */
async function getLoyaltyPoints(tenantId, customerPhone) {
  // Önce müşteriyi bul
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('phone', customerPhone)
    .single();

  if (!customer) {
    return { points: 0, tier: 'bronze', message: 'Henüz puanınız bulunmuyor' };
  }

  // Sadakat puanlarını getir
  const { data: loyalty } = await supabaseAdmin
    .from('loyalty_points')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customer.id)
    .single();

  if (!loyalty) {
    return { points: 0, tier: 'bronze', message: 'Henüz puanınız bulunmuyor' };
  }

  // Sonraki hediye için kalan puan hesapla
  const settings = await getLoyaltySettings(tenantId);
  let nextReward = null;
  if (settings) {
    const nextTierThreshold =
      loyalty.tier === 'bronze' ? settings.silver_threshold :
      loyalty.tier === 'silver' ? settings.gold_threshold :
      loyalty.tier === 'gold' ? settings.platinum_threshold : null;

    if (nextTierThreshold) {
      nextReward = {
        points_needed: nextTierThreshold - loyalty.total_earned,
        next_tier: loyalty.tier === 'bronze' ? 'silver' :
                   loyalty.tier === 'silver' ? 'gold' : 'platinum',
      };
    }
  }

  const tierNames = {
    bronze: 'Bronz',
    silver: 'Gümüş',
    gold: 'Altın',
    platinum: 'Platin',
  };

  return {
    points: loyalty.points,
    tier: loyalty.tier,
    tier_name: tierNames[loyalty.tier],
    total_earned: loyalty.total_earned,
    total_redeemed: loyalty.total_redeemed,
    next_reward: nextReward,
  };
}

/**
 * Sadakat ayarlarını getir
 */
async function getLoyaltySettings(tenantId) {
  const { data } = await supabaseAdmin
    .from('loyalty_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  return data;
}

/**
 * Sadakat puanı ekle
 */
async function addLoyaltyPoints(tenantId, customerId, points, reason, appointmentId = null, appointmentType = null) {
  // Önce loyalty kaydını bul veya oluştur
  let { data: loyalty } = await supabaseAdmin
    .from('loyalty_points')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .single();

  if (!loyalty) {
    const { data: newLoyalty, error: createError } = await supabaseAdmin
      .from('loyalty_points')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        points: 0,
        tier: 'bronze',
        total_earned: 0,
        total_redeemed: 0,
      })
      .select()
      .single();

    if (createError) throw createError;
    loyalty = newLoyalty;
  }

  // Puanları güncelle
  const newPoints = loyalty.points + points;
  const newTotalEarned = points > 0 ? loyalty.total_earned + points : loyalty.total_earned;
  const newTotalRedeemed = points < 0 ? loyalty.total_redeemed + Math.abs(points) : loyalty.total_redeemed;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('loyalty_points')
    .update({
      points: newPoints,
      total_earned: newTotalEarned,
      total_redeemed: newTotalRedeemed,
    })
    .eq('id', loyalty.id)
    .select()
    .single();

  if (updateError) throw updateError;

  // Transaction kaydı oluştur
  await supabaseAdmin
    .from('loyalty_transactions')
    .insert({
      loyalty_id: loyalty.id,
      points: points,
      reason: reason,
      appointment_id: appointmentId,
      appointment_type: appointmentType,
      balance_after: newPoints,
    });

  return updated;
}

// ==========================================
// GERI BILDIRIM
// ==========================================

/**
 * Geri bildirim kaydet (tenant-scoped)
 */
async function submitFeedback(tenantId, feedbackData) {
  const { data, error } = await supabaseAdmin
    .from('feedback')
    .insert({
      tenant_id: tenantId,
      customer_id: feedbackData.customerId,
      appointment_id: feedbackData.appointmentId,
      appointment_type: feedbackData.appointmentType,
      rating: feedbackData.rating,
      message: feedbackData.message,
      feedback_type: feedbackData.type || 'general',
      contact_phone: feedbackData.contactPhone,
      contact_name: feedbackData.contactName,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Geri bildirimleri getir (tenant-scoped)
 */
async function getFeedback(tenantId, filters = {}) {
  let query = supabaseAdmin
    .from('feedback')
    .select(`
      *,
      customer:customers(name, phone)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.type) {
    query = query.eq('feedback_type', filters.type);
  }
  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ==========================================
// PERSONEL (Beauty Specific)
// ==========================================

/**
 * Müsait personeli getir (tenant-scoped)
 */
async function getAvailableStaff(tenantId, date, serviceCategory = null) {
  let query = supabaseAdmin
    .from('staff_members')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  const { data: allStaff, error } = await query;
  if (error) throw error;
  if (!allStaff || allStaff.length === 0) return [];

  // Kategori filtresi uygula
  let filteredStaff = allStaff;
  if (serviceCategory) {
    filteredStaff = allStaff.filter(staff =>
      !staff.specializations || staff.specializations.includes(serviceCategory)
    );
  }

  // Gün adını bul
  const dayOfWeek = new Date(date).getDay();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dayOfWeek];

  // Çalışma saatlerine göre filtrele
  const availableStaff = filteredStaff.map(staff => {
    const workingHours = staff.working_hours?.[dayName] || [];
    return {
      id: staff.id,
      name: staff.name,
      available_times: workingHours,
      specializations: staff.specializations,
    };
  }).filter(staff => staff.available_times.length > 0);

  return availableStaff;
}

/**
 * Personel bilgisini getir
 */
async function getStaffById(tenantId, staffId) {
  const { data, error } = await supabaseAdmin
    .from('staff_members')
    .select('*')
    .eq('id', staffId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Personeli isimle bul
 */
async function getStaffByName(tenantId, staffName) {
  const { data, error } = await supabaseAdmin
    .from('staff_members')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .ilike('name', `%${staffName}%`);

  if (error) throw error;
  return data?.[0] || null;
}

// ==========================================
// LEGACY SUPPORT (tenant_id olmadan çalışan eski fonksiyonlar)
// ==========================================

// Bu fonksiyonlar geriye dönük uyumluluk için
// Zamanla kaldırılacak

async function legacyGetOrCreateCustomer(phone, name = null) {
  console.warn('[Supabase] Using legacy getOrCreateCustomer without tenantId');

  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('phone', phone)
    .single();

  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from('customers')
    .insert({ phone, name })
    .select()
    .single();

  if (error) throw error;
  return data;
}

module.exports = {
  supabase,

  // Customer
  getOrCreateCustomer,
  updateCustomer,
  getAllCustomers,

  // Vehicles
  getAvailableVehicles,
  getVehicleById,
  getAllVehicles,

  // Beauty Services
  getBeautyServices,
  getBeautyServiceById,

  // Slots
  getAvailableSlots,
  getAvailableDates,
  checkAndBookSlot,
  checkExistingAppointment,

  // Test Drive
  createTestDriveAppointment,
  getTestDriveAppointments,
  updateTestDriveStatus,

  // Service
  createServiceAppointment,
  getServiceAppointments,
  updateServiceStatus,

  // Beauty Appointments
  createBeautyAppointment,
  getBeautyAppointments,
  updateBeautyStatus,

  // Common Appointment
  cancelAppointment,
  rescheduleAppointment,
  getCustomerActiveAppointments,

  // Call Logs
  createCallLog,
  updateCallLog,
  getCallLogs,
  saveCallLog,

  // Business Info
  getTenantInfo,

  // Working Hours
  getWorkingHours,
  getSpecialDays,

  // Customer History
  getCustomerHistory,

  // Campaigns
  getActiveCampaigns,

  // Promotion Codes
  getPromotionCode,
  usePromotionCode,

  // Loyalty Points
  getLoyaltyPoints,
  getLoyaltySettings,
  addLoyaltyPoints,

  // Feedback
  submitFeedback,
  getFeedback,

  // Staff
  getAvailableStaff,
  getStaffById,
  getStaffByName,

  // Legacy (will be deprecated)
  legacyGetOrCreateCustomer,
};
