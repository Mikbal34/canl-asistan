/**
 * OpenAI Function Calling - Multi-tenant
 * Industry'ye göre function setleri yönetimi
 */

const supabaseService = require('../services/supabase');
const webhookService = require('../services/webhookService');
const { beautyFunctionDefinitions, processBeautyFunctionCall } = require('./beauty/functions');

/**
 * Otomotiv sektörü için OpenAI Function tanımlamaları
 */
const automotiveFunctionDefinitions = [
  {
    type: 'function',
    function: {
      name: 'get_available_vehicles',
      description: 'Test sürüşü için müsait araçları listeler. Marka veya model filtresi uygulanabilir.',
      parameters: {
        type: 'object',
        properties: {
          brand: {
            type: 'string',
            description: 'Araç markası (örn: Toyota, Honda, BMW)',
          },
          model: {
            type: 'string',
            description: 'Araç modeli (örn: Corolla, Civic, 320i)',
          },
          max_price: {
            type: 'number',
            description: 'Maksimum fiyat limiti (TL)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_available_time_slots',
      description: 'Müsait randevu saatlerini getirir. Tarih verilmezse gelecek 7 günün müsait tarihlerini listeler.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Tarih (YYYY-MM-DD formatında). Boş bırakılırsa müsait günler listelenir.',
          },
          slot_type: {
            type: 'string',
            enum: ['test_drive', 'service'],
            description: 'Randevu türü: test_drive veya service',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_test_drive_appointment',
      description: 'Yeni bir test sürüşü randevusu oluşturur',
      parameters: {
        type: 'object',
        properties: {
          customer_name: {
            type: 'string',
            description: 'Müşterinin adı',
          },
          customer_phone: {
            type: 'string',
            description: 'Müşterinin telefon numarası',
          },
          vehicle_id: {
            type: 'string',
            description: 'Seçilen aracın ID\'si',
          },
          appointment_date: {
            type: 'string',
            description: 'Randevu tarihi (YYYY-MM-DD)',
          },
          appointment_time: {
            type: 'string',
            description: 'Randevu saati (HH:MM)',
          },
          notes: {
            type: 'string',
            description: 'Ek notlar',
          },
        },
        required: ['customer_name', 'vehicle_id', 'appointment_date', 'appointment_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_service_appointment',
      description: 'Yeni bir servis randevusu oluşturur',
      parameters: {
        type: 'object',
        properties: {
          customer_name: {
            type: 'string',
            description: 'Müşterinin adı',
          },
          customer_phone: {
            type: 'string',
            description: 'Müşterinin telefon numarası',
          },
          vehicle_plate: {
            type: 'string',
            description: 'Araç plakası',
          },
          vehicle_brand: {
            type: 'string',
            description: 'Araç markası',
          },
          vehicle_model: {
            type: 'string',
            description: 'Araç modeli',
          },
          service_type: {
            type: 'string',
            enum: ['bakim', 'yag_degisimi', 'lastik', 'tamir', 'diger'],
            description: 'Servis türü',
          },
          appointment_date: {
            type: 'string',
            description: 'Randevu tarihi (YYYY-MM-DD)',
          },
          appointment_time: {
            type: 'string',
            description: 'Randevu saati (HH:MM)',
          },
          notes: {
            type: 'string',
            description: 'Ek notlar veya şikayetler',
          },
        },
        required: ['customer_name', 'vehicle_plate', 'service_type', 'appointment_date', 'appointment_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_appointments',
      description: 'Arayan müşterinin aktif (bekleyen veya onaylanmış) randevularını listeler.',
      parameters: {
        type: 'object',
        properties: {
          customer_phone: {
            type: 'string',
            description: 'Müşterinin telefon numarası',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description: 'Müşterinin mevcut bir randevusunu iptal eder',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: {
            type: 'string',
            description: 'İptal edilecek randevunun ID\'si',
          },
          appointment_type: {
            type: 'string',
            enum: ['test_drive', 'service'],
            description: 'Randevu türü',
          },
        },
        required: ['appointment_id', 'appointment_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_appointment',
      description: 'Müşterinin mevcut bir randevusunun tarih ve saatini değiştirir',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: {
            type: 'string',
            description: 'Değiştirilecek randevunun ID\'si',
          },
          appointment_type: {
            type: 'string',
            enum: ['test_drive', 'service'],
            description: 'Randevu türü',
          },
          new_date: {
            type: 'string',
            description: 'Yeni randevu tarihi (YYYY-MM-DD)',
          },
          new_time: {
            type: 'string',
            description: 'Yeni randevu saati (HH:MM)',
          },
        },
        required: ['appointment_id', 'appointment_type', 'new_date', 'new_time'],
      },
    },
  },
  // ==========================================
  // YENİ FONKSİYONLAR - Faz 1 (Mevcut veriden)
  // ==========================================
  {
    type: 'function',
    function: {
      name: 'get_business_info',
      description: 'İşletme bilgilerini getirir (adres, telefon, email, çalışma saatleri)',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_working_hours',
      description: 'Çalışma saatlerini getirir. Belirli bir gün veya tüm hafta için sorgulanabilir.',
      parameters: {
        type: 'object',
        properties: {
          day: {
            type: 'string',
            description: 'Gün (bugün, yarın, pazartesi, salı, çarşamba, perşembe, cuma, cumartesi, pazar)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_service_price',
      description: 'Araç veya servis fiyatını getirir',
      parameters: {
        type: 'object',
        properties: {
          vehicle_name: {
            type: 'string',
            description: 'Araç marka/model adı (örn: BMW 320i, Toyota Corolla)',
          },
          service_type: {
            type: 'string',
            enum: ['bakim', 'yag_degisimi', 'lastik', 'tamir', 'diger'],
            description: 'Servis türü',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_customer_history',
      description: 'Müşterinin geçmiş randevularını ve hizmet geçmişini getirir',
      parameters: {
        type: 'object',
        properties: {
          customer_phone: {
            type: 'string',
            description: 'Müşteri telefon numarası',
          },
          limit: {
            type: 'number',
            description: 'Kaç kayıt getirileceği (varsayılan 5)',
          },
        },
        required: [],
      },
    },
  },
  // ==========================================
  // YENİ FONKSİYONLAR - Faz 2 (Yeni tablolarla)
  // ==========================================
  {
    type: 'function',
    function: {
      name: 'get_active_promotions',
      description: 'Aktif kampanyaları ve indirimleri listeler',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_loyalty_points',
      description: 'Müşterinin sadakat puanını ve üyelik seviyesini sorgular',
      parameters: {
        type: 'object',
        properties: {
          customer_phone: {
            type: 'string',
            description: 'Müşteri telefon numarası',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_promo_code',
      description: 'Promosyon/indirim kodu uygular ve geçerliliğini kontrol eder',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'İndirim kodu',
          },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'submit_complaint',
      description: 'Şikayet, öneri veya geri bildirim kaydeder',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Şikayet veya öneri mesajı',
          },
          rating: {
            type: 'number',
            description: '1-5 arası memnuniyet puanı',
          },
          feedback_type: {
            type: 'string',
            enum: ['complaint', 'suggestion', 'praise', 'general'],
            description: 'Geri bildirim türü',
          },
        },
        required: ['message'],
      },
    },
  },
];

/**
 * Industry'ye göre function tanımlamalarını getir
 */
function getFunctionDefinitions(industry = 'automotive') {
  switch (industry) {
    case 'beauty':
    case 'beauty_salon':
    case 'hairdresser':
      return beautyFunctionDefinitions;
    case 'automotive':
    default:
      return automotiveFunctionDefinitions;
  }
}

/**
 * Otomotiv sektörü function call'larını işler
 */
async function processAutomotiveFunctionCall(tenantId, functionName, args, callerPhone) {
  console.log(`[AutomotiveFunctions] ${functionName} çağrılıyor:`, args);

  try {
    switch (functionName) {
      case 'get_available_vehicles': {
        const vehicles = await supabaseService.getAvailableVehicles(tenantId, {
          brand: args.brand,
          model: args.model,
          maxPrice: args.max_price,
        });

        return {
          success: true,
          vehicles: vehicles.map(v => ({
            id: v.id,
            brand: v.brand,
            model: v.model,
            year: v.year,
            color: v.color,
            price: v.price,
            fuelType: v.fuel_type,
            transmission: v.transmission,
            description: v.description,
          })),
          count: vehicles.length,
        };
      }

      case 'get_available_time_slots': {
        // slot_type yoksa varsayılan olarak 'test_drive' kullan
        const slotType = args.slot_type || 'test_drive';
        console.log(`[Functions] get_available_time_slots - date: ${args.date}, slot_type: ${slotType}`);

        // Tarih verilmemişse, gelecek 7 günün müsait tarihlerini listele
        if (!args.date) {
          const availableDates = await supabaseService.getAvailableDates(tenantId, 7);

          return {
            success: true,
            mode: 'available_dates',
            message: 'Müsait tarihler listelendi. Müşteriye bu tarihleri sunun.',
            available_dates: availableDates.map(d => ({
              date: d.date,
              day_name: d.day_name,
              slot_count: d.slot_count,
            })),
            count: availableDates.length,
          };
        }

        const slots = await supabaseService.getAvailableSlots(tenantId, args.date, slotType);

        return {
          success: true,
          mode: 'time_slots',
          date: args.date,
          slot_type: slotType,
          slots: slots.map(s => ({
            id: s.id,
            time: s.slot_time?.substring(0, 5),
          })),
          count: slots.length,
        };
      }

      case 'create_test_drive_appointment': {
        // Önce aynı tarih/saat için mevcut randevu var mı kontrol et
        const existingTestDrive = await supabaseService.checkExistingAppointment(
          tenantId,
          args.appointment_date,
          args.appointment_time,
          'test_drive'
        );

        if (existingTestDrive) {
          return {
            success: false,
            error: 'slot_unavailable',
            message: `Maalesef ${args.appointment_date} tarihinde saat ${args.appointment_time} için zaten bir randevu var. Lütfen başka bir saat seçin.`,
          };
        }

        // Slot müsaitliğini kontrol et ve rezerve et
        const slotCheck = await supabaseService.checkAndBookSlot(
          tenantId,
          args.appointment_date,
          args.appointment_time,
          'test_drive'
        );

        if (!slotCheck.available) {
          return {
            success: false,
            error: 'slot_unavailable',
            message: `Maalesef ${args.appointment_date} tarihinde saat ${args.appointment_time} müsait değil. Lütfen başka bir saat seçin.`,
          };
        }

        // Müşteriyi oluştur veya getir
        const customer = await supabaseService.getOrCreateCustomer(
          tenantId,
          args.customer_phone || callerPhone || 'unknown',
          args.customer_name
        );

        // Randevuyu oluştur
        const appointment = await supabaseService.createTestDriveAppointment(
          tenantId,
          customer.id,
          args.vehicle_id,
          args.appointment_date,
          args.appointment_time,
          args.notes
        );

        // Araç bilgisini al
        const vehicle = await supabaseService.getVehicleById(tenantId, args.vehicle_id);

        // Tenant webhook'a bildirim gonder (async, beklemiyoruz)
        webhookService.notifyAppointmentCreated(tenantId, 'test_drive', {
          id: appointment.id,
          customer_name: args.customer_name,
          customer_phone: args.customer_phone || callerPhone,
          vehicle: vehicle ? { brand: vehicle.brand, model: vehicle.model, id: vehicle.id } : null,
          date: args.appointment_date,
          time: args.appointment_time,
          notes: args.notes,
        }).catch(err => console.error('[Functions] Webhook error:', err));

        return {
          success: true,
          appointment_id: appointment.id,
          customer_name: args.customer_name,
          vehicle: `${vehicle?.brand || ''} ${vehicle?.model || ''}`,
          date: args.appointment_date,
          time: args.appointment_time,
          message: 'Test sürüşü randevunuz başarıyla oluşturuldu.',
        };
      }

      case 'create_service_appointment': {
        // Önce aynı tarih/saat için mevcut randevu var mı kontrol et
        const existingService = await supabaseService.checkExistingAppointment(
          tenantId,
          args.appointment_date,
          args.appointment_time,
          'service'
        );

        if (existingService) {
          return {
            success: false,
            error: 'slot_unavailable',
            message: `Maalesef ${args.appointment_date} tarihinde saat ${args.appointment_time} için zaten bir servis randevusu var. Lütfen başka bir saat seçin.`,
          };
        }

        // Slot müsaitliğini kontrol et ve rezerve et
        const slotCheck = await supabaseService.checkAndBookSlot(
          tenantId,
          args.appointment_date,
          args.appointment_time,
          'service'
        );

        if (!slotCheck.available) {
          return {
            success: false,
            error: 'slot_unavailable',
            message: `Maalesef ${args.appointment_date} tarihinde saat ${args.appointment_time} müsait değil. Lütfen başka bir saat seçin.`,
          };
        }

        // Müşteriyi oluştur veya getir
        const customer = await supabaseService.getOrCreateCustomer(
          tenantId,
          args.customer_phone || callerPhone || 'unknown',
          args.customer_name
        );

        // Randevuyu oluştur
        const appointment = await supabaseService.createServiceAppointment(
          tenantId,
          customer.id,
          args.vehicle_plate,
          args.vehicle_brand,
          args.vehicle_model,
          args.service_type,
          args.appointment_date,
          args.appointment_time,
          args.notes
        );

        const serviceTypeNames = {
          bakim: 'Periyodik Bakım',
          yag_degisimi: 'Yağ Değişimi',
          lastik: 'Lastik Servisi',
          tamir: 'Tamir',
          diger: 'Diğer',
        };

        // Tenant webhook'a bildirim gonder (async, beklemiyoruz)
        webhookService.notifyAppointmentCreated(tenantId, 'service', {
          id: appointment.id,
          customer_name: args.customer_name,
          customer_phone: args.customer_phone || callerPhone,
          vehicle_plate: args.vehicle_plate,
          vehicle_brand: args.vehicle_brand,
          vehicle_model: args.vehicle_model,
          service_type: args.service_type,
          service_type_name: serviceTypeNames[args.service_type] || args.service_type,
          date: args.appointment_date,
          time: args.appointment_time,
          notes: args.notes,
        }).catch(err => console.error('[Functions] Webhook error:', err));

        return {
          success: true,
          appointment_id: appointment.id,
          customer_name: args.customer_name,
          vehicle_plate: args.vehicle_plate,
          service_type: serviceTypeNames[args.service_type] || args.service_type,
          date: args.appointment_date,
          time: args.appointment_time,
          message: 'Servis randevunuz başarıyla oluşturuldu.',
        };
      }

      case 'get_my_appointments': {
        const phone = args.customer_phone || callerPhone;

        if (!phone || phone === 'unknown') {
          return {
            success: false,
            error: 'no_phone',
            message: 'Telefon numaranızı tespit edemedim. Randevularınızı görmek için telefon numaranızı söyler misiniz?',
          };
        }

        const appointments = await supabaseService.getCustomerActiveAppointments(tenantId, phone);

        const formatDate = (dateStr) => {
          const date = new Date(dateStr);
          return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
        };

        const testDriveList = appointments.testDrives.map(t => ({
          id: t.id,
          type: 'test_drive',
          vehicle: t.vehicle ? `${t.vehicle.brand} ${t.vehicle.model}` : 'Araç',
          date: formatDate(t.appointment_date),
          time: t.appointment_time?.substring(0, 5),
          status: t.status,
        }));

        const serviceList = appointments.services.map(s => ({
          id: s.id,
          type: 'service',
          vehicle_plate: s.vehicle_plate,
          service_type: s.service_type,
          date: formatDate(s.appointment_date),
          time: s.appointment_time?.substring(0, 5),
          status: s.status,
        }));

        const allAppointments = [...testDriveList, ...serviceList];

        if (allAppointments.length === 0) {
          return {
            success: true,
            has_appointments: false,
            message: 'Aktif randevunuz bulunmuyor.',
          };
        }

        return {
          success: true,
          has_appointments: true,
          appointments: allAppointments,
          count: allAppointments.length,
          message: `${allAppointments.length} adet aktif randevunuz var.`,
        };
      }

      case 'cancel_appointment': {
        try {
          const cancelled = await supabaseService.cancelAppointment(
            tenantId,
            args.appointment_id,
            args.appointment_type
          );

          const typeText = args.appointment_type === 'test_drive' ? 'Test sürüşü' : 'Servis';

          // Tenant webhook'a bildirim gonder (async, beklemiyoruz)
          webhookService.notifyAppointmentCancelled(tenantId, args.appointment_type, {
            id: args.appointment_id,
            type: args.appointment_type,
          }).catch(err => console.error('[Functions] Webhook error:', err));

          return {
            success: true,
            message: `${typeText} randevunuz başarıyla iptal edildi.`,
            cancelled_appointment: cancelled,
          };
        } catch (error) {
          return {
            success: false,
            error: 'cancel_failed',
            message: 'Randevu iptal edilirken bir hata oluştu. Lütfen tekrar deneyin.',
          };
        }
      }

      case 'reschedule_appointment': {
        const result = await supabaseService.rescheduleAppointment(
          tenantId,
          args.appointment_id,
          args.appointment_type,
          args.new_date,
          args.new_time
        );

        if (!result.success) {
          return {
            success: false,
            error: 'slot_unavailable',
            message: `Maalesef ${args.new_date} tarihinde saat ${args.new_time} müsait değil. Başka bir zaman seçebilir misiniz?`,
          };
        }

        const typeText = args.appointment_type === 'test_drive' ? 'Test sürüşü' : 'Servis';
        const formatDate = (dateStr) => {
          const date = new Date(dateStr);
          return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
        };

        // Tenant webhook'a bildirim gonder (async, beklemiyoruz)
        webhookService.notifyAppointmentUpdated(tenantId, args.appointment_type, {
          id: args.appointment_id,
          type: args.appointment_type,
          new_date: args.new_date,
          new_time: args.new_time,
        }).catch(err => console.error('[Functions] Webhook error:', err));

        return {
          success: true,
          message: `${typeText} randevunuz ${formatDate(args.new_date)} tarihine saat ${args.new_time}'e güncellendi.`,
          updated_appointment: result.appointment,
        };
      }

      // ==========================================
      // YENİ FONKSİYONLAR - Faz 1
      // ==========================================

      case 'get_business_info': {
        const tenantInfo = await supabaseService.getTenantInfo(tenantId);

        if (!tenantInfo) {
          return {
            success: false,
            error: 'not_found',
            message: 'İşletme bilgileri bulunamadı.',
          };
        }

        return {
          success: true,
          business: {
            name: tenantInfo.name,
            address: tenantInfo.address,
            phone: tenantInfo.phone,
            email: tenantInfo.email,
            website: tenantInfo.website,
          },
          message: tenantInfo.address
            ? `Adresimiz: ${tenantInfo.address}. Telefon: ${tenantInfo.phone || 'Belirtilmemiş'}`
            : 'Adres bilgisi henüz eklenmemiş.',
        };
      }

      case 'get_working_hours': {
        const dayNames = {
          'pazar': 0, 'pazartesi': 1, 'salı': 2, 'sali': 2,
          'çarşamba': 3, 'carsamba': 3, 'perşembe': 4, 'persembe': 4,
          'cuma': 5, 'cumartesi': 6,
        };
        const dayNamesTr = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

        let dayOfWeek = null;

        if (args.day) {
          const dayLower = args.day.toLowerCase();
          if (dayLower === 'bugün' || dayLower === 'bugun') {
            dayOfWeek = new Date().getDay();
          } else if (dayLower === 'yarın' || dayLower === 'yarin') {
            dayOfWeek = (new Date().getDay() + 1) % 7;
          } else if (dayNames[dayLower] !== undefined) {
            dayOfWeek = dayNames[dayLower];
          }
        }

        const workingHours = await supabaseService.getWorkingHours(tenantId, dayOfWeek);

        if (!workingHours || workingHours.length === 0) {
          return {
            success: true,
            message: 'Çalışma saatleri henüz belirlenmemiş. Lütfen bizimle iletişime geçin.',
          };
        }

        if (dayOfWeek !== null && workingHours.length === 1) {
          const wh = workingHours[0];
          if (!wh.is_open) {
            return {
              success: true,
              day: dayNamesTr[dayOfWeek],
              is_open: false,
              message: `${dayNamesTr[dayOfWeek]} günü kapalıyız.`,
            };
          }
          return {
            success: true,
            day: dayNamesTr[dayOfWeek],
            is_open: true,
            open_time: wh.open_time?.substring(0, 5),
            close_time: wh.close_time?.substring(0, 5),
            message: `${dayNamesTr[dayOfWeek]} günü ${wh.open_time?.substring(0, 5)} - ${wh.close_time?.substring(0, 5)} saatleri arasında açığız.`,
          };
        }

        // Tüm hafta
        const schedule = workingHours.map(wh => ({
          day: dayNamesTr[wh.day_of_week],
          is_open: wh.is_open,
          hours: wh.is_open ? `${wh.open_time?.substring(0, 5)} - ${wh.close_time?.substring(0, 5)}` : 'Kapalı',
        }));

        return {
          success: true,
          schedule,
          message: 'Haftalık çalışma saatlerimiz yukarıda belirtilmiştir.',
        };
      }

      case 'get_service_price': {
        // Araç fiyatı kontrolü
        if (args.vehicle_name) {
          const vehicles = await supabaseService.getAvailableVehicles(tenantId, {
            brand: args.vehicle_name.split(' ')[0],
            model: args.vehicle_name.split(' ').slice(1).join(' '),
          });

          if (vehicles && vehicles.length > 0) {
            const vehicle = vehicles[0];
            const priceFormatted = new Intl.NumberFormat('tr-TR').format(vehicle.price);
            return {
              success: true,
              type: 'vehicle',
              name: `${vehicle.brand} ${vehicle.model}`,
              price: vehicle.price,
              price_formatted: `${priceFormatted} TL`,
              year: vehicle.year,
              message: `${vehicle.brand} ${vehicle.model} ${vehicle.year} model aracımızın fiyatı ${priceFormatted} TL'dir.`,
            };
          }
        }

        // Servis fiyatları (sabit referans fiyatlar)
        const servicePrices = {
          bakim: { name: 'Periyodik Bakım', price: 'Aracınıza göre değişir', estimated: '2.000 - 5.000 TL' },
          yag_degisimi: { name: 'Yağ Değişimi', price: '500 - 1.500 TL', estimated: '500 - 1.500 TL' },
          lastik: { name: 'Lastik Servisi', price: '200 - 500 TL (işçilik)', estimated: '200 - 500 TL' },
          tamir: { name: 'Tamir', price: 'Arızaya göre değişir', estimated: 'Muayene sonrası belirlenir' },
          diger: { name: 'Diğer Hizmetler', price: 'Hizmete göre değişir', estimated: 'Detay için arayın' },
        };

        if (args.service_type && servicePrices[args.service_type]) {
          const service = servicePrices[args.service_type];
          return {
            success: true,
            type: 'service',
            name: service.name,
            price: service.price,
            estimated_range: service.estimated,
            message: `${service.name} hizmeti için tahmini fiyat aralığı: ${service.estimated}. Kesin fiyat aracınızın durumuna göre belirlenir.`,
          };
        }

        return {
          success: false,
          message: 'Fiyat bilgisi için lütfen araç adı veya servis türü belirtin.',
        };
      }

      case 'get_customer_history': {
        const phone = args.customer_phone || callerPhone;

        if (!phone || phone === 'unknown') {
          return {
            success: false,
            error: 'no_phone',
            message: 'Geçmiş randevularınızı görmek için telefon numaranız gerekli.',
          };
        }

        const history = await supabaseService.getCustomerHistory(tenantId, phone, args.limit || 5);

        if (!history || history.length === 0) {
          return {
            success: true,
            has_history: false,
            message: 'Geçmiş randevu kaydınız bulunmuyor.',
          };
        }

        const formatDate = (dateStr) => {
          const date = new Date(dateStr);
          return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
        };

        const historyList = history.map(h => ({
          date: formatDate(h.date),
          description: h.description,
          type: h.type === 'test_drive' ? 'Test Sürüşü' : h.type === 'service' ? 'Servis' : 'Randevu',
        }));

        return {
          success: true,
          has_history: true,
          history: historyList,
          count: historyList.length,
          message: `Son ${historyList.length} randevunuz listelendi.`,
        };
      }

      // ==========================================
      // YENİ FONKSİYONLAR - Faz 2
      // ==========================================

      case 'get_active_promotions': {
        const campaigns = await supabaseService.getActiveCampaigns(tenantId);

        if (!campaigns || campaigns.length === 0) {
          return {
            success: true,
            has_promotions: false,
            message: 'Şu anda aktif bir kampanyamız bulunmuyor.',
          };
        }

        const formatDate = (dateStr) => {
          const date = new Date(dateStr);
          return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
        };

        const promotions = campaigns.map(c => ({
          name: c.name,
          description: c.description,
          discount: c.discount_type === 'percent' ? `%${c.discount_value}` : `${c.discount_value} TL`,
          valid_until: formatDate(c.valid_until),
        }));

        return {
          success: true,
          has_promotions: true,
          promotions,
          count: promotions.length,
          message: `${promotions.length} adet aktif kampanyamız var.`,
        };
      }

      case 'get_loyalty_points': {
        const phone = args.customer_phone || callerPhone;

        if (!phone || phone === 'unknown') {
          return {
            success: false,
            error: 'no_phone',
            message: 'Puan sorgulamak için telefon numaranız gerekli.',
          };
        }

        const loyalty = await supabaseService.getLoyaltyPoints(tenantId, phone);

        return {
          success: true,
          ...loyalty,
          message: loyalty.points > 0
            ? `${loyalty.points} puanınız var. Üyelik seviyeniz: ${loyalty.tier_name || loyalty.tier}.`
            : 'Henüz sadakat puanınız bulunmuyor. Randevu aldıkça puan kazanırsınız!',
        };
      }

      case 'apply_promo_code': {
        if (!args.code) {
          return {
            success: false,
            error: 'no_code',
            message: 'Lütfen promosyon kodunu belirtin.',
          };
        }

        const result = await supabaseService.getPromotionCode(tenantId, args.code);

        return {
          success: result.valid,
          ...result,
        };
      }

      case 'submit_complaint': {
        if (!args.message) {
          return {
            success: false,
            error: 'no_message',
            message: 'Lütfen geri bildiriminizi belirtin.',
          };
        }

        // Müşteriyi bul
        let customerId = null;
        if (callerPhone && callerPhone !== 'unknown') {
          const customer = await supabaseService.getOrCreateCustomer(tenantId, callerPhone);
          customerId = customer?.id;
        }

        const feedback = await supabaseService.submitFeedback(tenantId, {
          customerId,
          message: args.message,
          rating: args.rating,
          type: args.feedback_type || 'general',
          contactPhone: callerPhone,
        });

        const typeMessages = {
          complaint: 'Şikayetiniz',
          suggestion: 'Öneriniz',
          praise: 'Teşekkürünüz',
          general: 'Geri bildiriminiz',
        };

        const typeText = typeMessages[args.feedback_type] || 'Geri bildiriminiz';

        return {
          success: true,
          feedback_id: feedback.id,
          message: `${typeText} kaydedildi. En kısa sürede sizinle iletişime geçeceğiz. İlginiz için teşekkür ederiz.`,
        };
      }

      default:
        return {
          success: false,
          error: `Bilinmeyen fonksiyon: ${functionName}`,
        };
    }
  } catch (error) {
    console.error(`[AutomotiveFunctions] ${functionName} hatası:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Industry'ye göre function call'ı işle
 */
async function processFunctionCall(tenantId, industry, functionName, args, callerPhone) {
  switch (industry) {
    case 'beauty':
    case 'beauty_salon':
    case 'hairdresser':
      return processBeautyFunctionCall(tenantId, functionName, args, callerPhone);
    case 'automotive':
    default:
      return processAutomotiveFunctionCall(tenantId, functionName, args, callerPhone);
  }
}

// Legacy export (tek tenant için geriye uyumluluk)
const functionDefinitions = automotiveFunctionDefinitions;

module.exports = {
  functionDefinitions,
  getFunctionDefinitions,
  processFunctionCall,
  processAutomotiveFunctionCall,
  processBeautyFunctionCall,
  automotiveFunctionDefinitions,
  beautyFunctionDefinitions,
};
