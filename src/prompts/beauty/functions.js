/**
 * Guzellik Salonu AI Function Definitions
 * Cilt bakimi, manikur, makyaj, SPA randevu islemleri
 * Not: Bu modul beauty_salon icin kullanilir. Kuafor icin hairdresser/functions.js kullanin.
 */

const supabaseService = require('../../services/supabase');
const webhookService = require('../../services/webhookService');

/**
 * Güzellik sektörü için OpenAI Function tanımlamaları
 */
const beautyFunctionDefinitions = [
  {
    type: 'function',
    function: {
      name: 'get_beauty_services',
      description: 'Salondaki mevcut guzellik hizmetlerini listeler. Kategori filtresi uygulanabilir.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['nails', 'skin', 'makeup', 'spa', 'other'],
            description: 'Hizmet kategorisi: nails (tirnak), skin (cilt), makeup (makyaj), spa (SPA), other (diger)',
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
      description: 'Belirli bir tarih için müsait randevu saatlerini getirir',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Tarih (YYYY-MM-DD formatında)',
          },
        },
        required: ['date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_beauty_appointment',
      description: 'Yeni bir güzellik randevusu oluşturur',
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
          service_id: {
            type: 'string',
            description: 'Seçilen hizmetin ID\'si',
          },
          service_name: {
            type: 'string',
            description: 'Seçilen hizmetin adı (service_id yoksa bununla eşleştir)',
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
            description: 'Ek notlar veya özel istekler',
          },
        },
        required: ['customer_name', 'appointment_date', 'appointment_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_appointments',
      description: 'Arayan müşterinin aktif (bekleyen veya onaylanmış) randevularını listeler. İptal veya değiştirme işlemi öncesi çağrılmalı.',
      parameters: {
        type: 'object',
        properties: {
          customer_phone: {
            type: 'string',
            description: 'Müşterinin telefon numarası (otomatik eklenir)',
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
        },
        required: ['appointment_id'],
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
          new_date: {
            type: 'string',
            description: 'Yeni randevu tarihi (YYYY-MM-DD)',
          },
          new_time: {
            type: 'string',
            description: 'Yeni randevu saati (HH:MM)',
          },
        },
        required: ['appointment_id', 'new_date', 'new_time'],
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
      description: 'Salon bilgilerini getirir (adres, telefon, email)',
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
      description: 'Güzellik hizmeti fiyatını getirir',
      parameters: {
        type: 'object',
        properties: {
          service_name: {
            type: 'string',
            description: 'Hizmet adı (örn: saç kesimi, manikür, cilt bakımı)',
          },
          category: {
            type: 'string',
            enum: ['hair', 'nails', 'skin', 'makeup', 'other'],
            description: 'Hizmet kategorisi',
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
  {
    type: 'function',
    function: {
      name: 'get_available_staff',
      description: 'Belirli bir tarih için müsait personeli listeler',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Tarih (YYYY-MM-DD formatında)',
          },
          service_category: {
            type: 'string',
            enum: ['hair', 'nails', 'skin', 'makeup', 'other'],
            description: 'Hizmet kategorisi (opsiyonel)',
          },
        },
        required: ['date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_with_staff',
      description: 'Belirli bir personelle randevu oluşturur',
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
          staff_name: {
            type: 'string',
            description: 'Personel adı',
          },
          service_name: {
            type: 'string',
            description: 'Hizmet adı',
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
        required: ['customer_name', 'staff_name', 'service_name', 'appointment_date', 'appointment_time'],
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
 * Güzellik sektörü function call'larını işler
 * @param {string} tenantId - Tenant ID
 * @param {string} functionName - Fonksiyon adı
 * @param {Object} args - Fonksiyon argümanları
 * @param {string} callerPhone - Arayan telefon numarası
 * @returns {Object} Fonksiyon sonucu
 */
async function processBeautyFunctionCall(tenantId, functionName, args, callerPhone) {
  console.log(`[BeautyFunctions] ${functionName} çağrılıyor:`, args);

  try {
    switch (functionName) {
      case 'get_beauty_services': {
        // VAPI tool calls need admin access (bypass RLS)
        const services = await supabaseService.getBeautyServices(tenantId, {
          category: args.category,
        }, { useAdmin: true });

        // Kategorilere göre grupla
        const categorizedServices = {};
        const categoryNames = {
          hair: 'Saç Hizmetleri',
          nails: 'Tırnak Hizmetleri',
          skin: 'Cilt Bakımı',
          makeup: 'Makyaj',
          other: 'Diğer Hizmetler',
        };

        services.forEach(s => {
          const cat = s.category || 'other';
          if (!categorizedServices[cat]) {
            categorizedServices[cat] = {
              category_name: categoryNames[cat],
              services: [],
            };
          }
          categorizedServices[cat].services.push({
            id: s.id,
            name: s.name,
            duration: `${s.duration_minutes} dakika`,
            price: s.price ? `${s.price} ${s.currency || 'TRY'}` : 'Fiyat için sorunuz',
          });
        });

        return {
          success: true,
          services: Object.values(categorizedServices),
          total_count: services.length,
          message: args.category
            ? `${categoryNames[args.category]} kategorisinde ${services.length} hizmet bulundu.`
            : `Toplam ${services.length} hizmet mevcut.`,
        };
      }

      case 'get_available_time_slots': {
        const slots = await supabaseService.getAvailableSlots(tenantId, args.date, 'beauty');

        return {
          success: true,
          date: args.date,
          slots: slots.map(s => ({
            id: s.id,
            time: s.slot_time?.substring(0, 5),
          })),
          count: slots.length,
          message: slots.length > 0
            ? `${args.date} tarihinde ${slots.length} müsait saat var.`
            : `Maalesef ${args.date} tarihinde müsait saat bulunmuyor.`,
        };
      }

      case 'create_beauty_appointment': {
        // Hizmet ID'si yoksa isimden bul
        let serviceId = args.service_id;
        let serviceName = args.service_name;

        if (!serviceId && serviceName) {
          const services = await supabaseService.getBeautyServices(tenantId, {}, { useAdmin: true });
          const matchedService = services.find(s =>
            s.name.toLowerCase().includes(serviceName.toLowerCase()) ||
            serviceName.toLowerCase().includes(s.name.toLowerCase())
          );
          if (matchedService) {
            serviceId = matchedService.id;
            serviceName = matchedService.name;
          }
        }

        // Önce aynı tarih/saat için mevcut randevu var mı kontrol et
        const existingAppointment = await supabaseService.checkExistingAppointment(
          tenantId,
          args.appointment_date,
          args.appointment_time,
          'beauty'
        );

        if (existingAppointment) {
          return {
            success: false,
            error: 'slot_unavailable',
            message: `Maalesef ${args.appointment_date} tarihinde saat ${args.appointment_time} için zaten bir randevu var. Lütfen başka bir saat seçin.`,
          };
        }

        // Slot müsaitliğini kontrol et
        const slotCheck = await supabaseService.checkAndBookSlot(
          tenantId,
          args.appointment_date,
          args.appointment_time,
          'beauty'
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
        const appointment = await supabaseService.createBeautyAppointment(
          tenantId,
          customer.id,
          serviceId,
          args.appointment_date,
          args.appointment_time,
          args.notes
        );

        // Hizmet bilgisini al
        let serviceInfo = serviceName || 'Güzellik hizmeti';
        if (serviceId) {
          const service = await supabaseService.getBeautyServiceById(tenantId, serviceId);
          if (service) {
            serviceInfo = service.name;
          }
        }

        const formatDate = (dateStr) => {
          const date = new Date(dateStr);
          return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
        };

        // Tenant webhook'a bildirim gonder (async, beklemiyoruz)
        webhookService.notifyAppointmentCreated(tenantId, 'beauty', {
          id: appointment.id,
          customer_name: args.customer_name,
          customer_phone: args.customer_phone || callerPhone,
          service_id: serviceId,
          service_name: serviceInfo,
          date: args.appointment_date,
          time: args.appointment_time,
          notes: args.notes,
        }).catch(err => console.error('[BeautyFunctions] Webhook error:', err));

        return {
          success: true,
          appointment_id: appointment.id,
          customer_name: args.customer_name,
          service: serviceInfo,
          date: formatDate(args.appointment_date),
          time: args.appointment_time,
          message: `${args.customer_name} için ${serviceInfo} randevunuz ${formatDate(args.appointment_date)} tarihinde saat ${args.appointment_time}'da oluşturuldu.`,
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

        const beautyList = appointments.beauty.map(b => ({
          id: b.id,
          type: 'beauty',
          service: b.service?.name || 'Güzellik hizmeti',
          date: formatDate(b.appointment_date),
          time: b.appointment_time?.substring(0, 5),
          status: b.status,
        }));

        if (beautyList.length === 0) {
          return {
            success: true,
            has_appointments: false,
            message: 'Aktif randevunuz bulunmuyor.',
          };
        }

        return {
          success: true,
          has_appointments: true,
          appointments: beautyList,
          count: beautyList.length,
          message: `${beautyList.length} adet aktif randevunuz var.`,
        };
      }

      case 'cancel_appointment': {
        try {
          const cancelled = await supabaseService.cancelAppointment(
            tenantId,
            args.appointment_id,
            'beauty'
          );

          // Tenant webhook'a bildirim gonder (async, beklemiyoruz)
          webhookService.notifyAppointmentCancelled(tenantId, 'beauty', {
            id: args.appointment_id,
          }).catch(err => console.error('[BeautyFunctions] Webhook error:', err));

          return {
            success: true,
            message: 'Randevunuz başarıyla iptal edildi.',
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
          'beauty',
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

        const formatDate = (dateStr) => {
          const date = new Date(dateStr);
          return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
        };

        // Tenant webhook'a bildirim gonder (async, beklemiyoruz)
        webhookService.notifyAppointmentUpdated(tenantId, 'beauty', {
          id: args.appointment_id,
          new_date: args.new_date,
          new_time: args.new_time,
        }).catch(err => console.error('[BeautyFunctions] Webhook error:', err));

        return {
          success: true,
          message: `Randevunuz ${formatDate(args.new_date)} tarihine saat ${args.new_time}'e güncellendi.`,
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
            message: 'Salon bilgileri bulunamadı.',
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
        // Hizmet fiyatı kontrolü
        const filters = {};
        if (args.category) {
          filters.category = args.category;
        }

        const services = await supabaseService.getBeautyServices(tenantId, filters, { useAdmin: true });

        if (args.service_name) {
          const matchedService = services.find(s =>
            s.name.toLowerCase().includes(args.service_name.toLowerCase()) ||
            args.service_name.toLowerCase().includes(s.name.toLowerCase())
          );

          if (matchedService) {
            const priceFormatted = matchedService.price
              ? `${new Intl.NumberFormat('tr-TR').format(matchedService.price)} ${matchedService.currency || 'TL'}`
              : 'Fiyat için sorunuz';

            return {
              success: true,
              service: {
                name: matchedService.name,
                price: matchedService.price,
                price_formatted: priceFormatted,
                duration: `${matchedService.duration_minutes} dakika`,
                category: matchedService.category,
              },
              message: `${matchedService.name} hizmetimizin fiyatı ${priceFormatted}, süre yaklaşık ${matchedService.duration_minutes} dakikadır.`,
            };
          }
        }

        // Kategori bazlı fiyat listesi
        if (args.category && services.length > 0) {
          const categoryNames = {
            hair: 'Saç Hizmetleri',
            nails: 'Tırnak Hizmetleri',
            skin: 'Cilt Bakımı',
            makeup: 'Makyaj',
            other: 'Diğer Hizmetler',
          };

          const serviceList = services.map(s => ({
            name: s.name,
            price: s.price ? `${new Intl.NumberFormat('tr-TR').format(s.price)} ${s.currency || 'TL'}` : 'Fiyat için sorunuz',
            duration: `${s.duration_minutes} dk`,
          }));

          return {
            success: true,
            category: categoryNames[args.category],
            services: serviceList,
            message: `${categoryNames[args.category]} kategorisinde ${serviceList.length} hizmetimiz var.`,
          };
        }

        return {
          success: false,
          message: 'Fiyat bilgisi için lütfen hizmet adı veya kategori belirtin.',
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
        }));

        return {
          success: true,
          has_history: true,
          history: historyList,
          count: historyList.length,
          last_service: historyList[0],
          message: `Son ${historyList.length} randevunuz listelendi. En son ${historyList[0].date} tarihinde ${historyList[0].description} hizmeti aldınız.`,
        };
      }

      case 'get_available_staff': {
        const staff = await supabaseService.getAvailableStaff(
          tenantId,
          args.date,
          args.service_category
        );

        if (!staff || staff.length === 0) {
          return {
            success: true,
            has_available_staff: false,
            message: args.service_category
              ? `${args.date} tarihinde bu kategoride müsait personelimiz bulunmuyor.`
              : `${args.date} tarihinde müsait personelimiz bulunmuyor.`,
          };
        }

        const formatDate = (dateStr) => {
          const date = new Date(dateStr);
          return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
        };

        const staffList = staff.map(s => ({
          name: s.name,
          available_times: s.available_times,
        }));

        return {
          success: true,
          has_available_staff: true,
          date: formatDate(args.date),
          staff: staffList,
          count: staffList.length,
          message: `${formatDate(args.date)} tarihinde ${staffList.length} personelimiz müsait.`,
        };
      }

      case 'book_with_staff': {
        // Personeli bul
        const staff = await supabaseService.getStaffByName(tenantId, args.staff_name);

        if (!staff) {
          return {
            success: false,
            error: 'staff_not_found',
            message: `"${args.staff_name}" adında bir personelimiz bulunamadı. Müsait personellerimizi öğrenmek ister misiniz?`,
          };
        }

        // Hizmeti bul
        const services = await supabaseService.getBeautyServices(tenantId, {}, { useAdmin: true });
        const matchedService = services.find(s =>
          s.name.toLowerCase().includes(args.service_name.toLowerCase()) ||
          args.service_name.toLowerCase().includes(s.name.toLowerCase())
        );

        // Slot kontrolü
        const existingAppointment = await supabaseService.checkExistingAppointment(
          tenantId,
          args.appointment_date,
          args.appointment_time,
          'beauty'
        );

        if (existingAppointment) {
          return {
            success: false,
            error: 'slot_unavailable',
            message: `Maalesef ${args.appointment_date} tarihinde saat ${args.appointment_time} için zaten bir randevu var. Lütfen başka bir saat seçin.`,
          };
        }

        // Slot rezerve et
        const slotCheck = await supabaseService.checkAndBookSlot(
          tenantId,
          args.appointment_date,
          args.appointment_time,
          'beauty'
        );

        if (!slotCheck.available) {
          return {
            success: false,
            error: 'slot_unavailable',
            message: `Maalesef ${args.appointment_date} tarihinde saat ${args.appointment_time} müsait değil. Lütfen başka bir saat seçin.`,
          };
        }

        // Müşteri oluştur
        const customer = await supabaseService.getOrCreateCustomer(
          tenantId,
          args.customer_phone || callerPhone || 'unknown',
          args.customer_name
        );

        // Randevu oluştur (staff bilgisiyle)
        const { data: appointment, error: appointmentError } = await supabaseService.supabase
          .from('beauty_appointments')
          .insert({
            tenant_id: tenantId,
            customer_id: customer.id,
            service_id: matchedService?.id,
            appointment_date: args.appointment_date,
            appointment_time: args.appointment_time,
            duration_minutes: matchedService?.duration_minutes,
            price_at_booking: matchedService?.price,
            currency: matchedService?.currency || 'TRY',
            staff_name: staff.name,
            notes: args.notes,
            status: 'pending',
          })
          .select()
          .single();

        if (appointmentError) throw appointmentError;

        const formatDate = (dateStr) => {
          const date = new Date(dateStr);
          return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
        };

        // Webhook bildirimi
        webhookService.notifyAppointmentCreated(tenantId, 'beauty', {
          id: appointment.id,
          customer_name: args.customer_name,
          customer_phone: args.customer_phone || callerPhone,
          service_name: matchedService?.name || args.service_name,
          staff_name: staff.name,
          date: args.appointment_date,
          time: args.appointment_time,
          notes: args.notes,
        }).catch(err => console.error('[BeautyFunctions] Webhook error:', err));

        return {
          success: true,
          appointment_id: appointment.id,
          customer_name: args.customer_name,
          staff_name: staff.name,
          service: matchedService?.name || args.service_name,
          date: formatDate(args.appointment_date),
          time: args.appointment_time,
          message: `${args.customer_name} için ${staff.name} ile ${matchedService?.name || args.service_name} randevunuz ${formatDate(args.appointment_date)} tarihinde saat ${args.appointment_time}'da oluşturuldu.`,
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
    console.error(`[BeautyFunctions] ${functionName} hatası:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  beautyFunctionDefinitions,
  processBeautyFunctionCall,
};
