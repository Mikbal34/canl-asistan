/**
 * Kuafor Sektoru AI Function Definitions
 * Sac kesimi, boyama, fon randevu islemleri
 */

const supabaseService = require('../../services/supabase');
const webhookService = require('../../services/webhookService');

/**
 * Kuafor sektoru icin OpenAI Function tanimlari
 */
const hairdresserFunctionDefinitions = [
  {
    type: 'function',
    function: {
      name: 'get_hairdresser_services',
      description: 'Kuafordeki mevcut hizmetleri listeler. Kategori filtresi uygulanabilir.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['haircut', 'coloring', 'styling'],
            description: 'Hizmet kategorisi: haircut (sac kesimi), coloring (boyama), styling (fon/sekillendirme)',
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
      description: 'Belirli bir tarih icin musait randevu saatlerini getirir',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Tarih (YYYY-MM-DD formatinda)',
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
      description: 'Yeni bir kuafor randevusu olusturur',
      parameters: {
        type: 'object',
        properties: {
          customer_name: {
            type: 'string',
            description: 'Musterinin adi',
          },
          customer_phone: {
            type: 'string',
            description: 'Musterinin telefon numarasi',
          },
          service_id: {
            type: 'string',
            description: 'Secilen hizmetin ID\'si',
          },
          service_name: {
            type: 'string',
            description: 'Secilen hizmetin adi (service_id yoksa bununla eslestir)',
          },
          appointment_date: {
            type: 'string',
            description: 'Randevu tarihi (YYYY-MM-DD)',
          },
          appointment_time: {
            type: 'string',
            description: 'Randevu saati (HH:MM)',
          },
          staff_name: {
            type: 'string',
            description: 'Tercih edilen kuafor adi (opsiyonel)',
          },
          notes: {
            type: 'string',
            description: 'Ek notlar veya ozel istekler',
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
      description: 'Arayan musterinin aktif (bekleyen veya onaylanmis) randevularini listeler. Iptal veya degistirme islemi oncesi cagrilmali.',
      parameters: {
        type: 'object',
        properties: {
          customer_phone: {
            type: 'string',
            description: 'Musterinin telefon numarasi (otomatik eklenir)',
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
      description: 'Musterinin mevcut bir randevusunu iptal eder',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: {
            type: 'string',
            description: 'Iptal edilecek randevunun ID\'si',
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
      description: 'Musterinin mevcut bir randevusunun tarih ve saatini degistirir',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: {
            type: 'string',
            description: 'Degistirilecek randevunun ID\'si',
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
  {
    type: 'function',
    function: {
      name: 'get_business_info',
      description: 'Kuafor bilgilerini getirir (adres, telefon, email)',
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
      description: 'Calisma saatlerini getirir. Belirli bir gun veya tum hafta icin sorgulanabilir.',
      parameters: {
        type: 'object',
        properties: {
          day: {
            type: 'string',
            description: 'Gun (bugun, yarin, pazartesi, sali, carsamba, persembe, cuma, cumartesi, pazar)',
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
      description: 'Kuafor hizmeti fiyatini getirir',
      parameters: {
        type: 'object',
        properties: {
          service_name: {
            type: 'string',
            description: 'Hizmet adi (orn: sac kesimi, boyama, fon)',
          },
          category: {
            type: 'string',
            enum: ['haircut', 'coloring', 'styling'],
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
      name: 'get_available_staff',
      description: 'Belirli bir tarih icin musait kuaforleri listeler',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Tarih (YYYY-MM-DD formatinda)',
          },
          service_category: {
            type: 'string',
            enum: ['haircut', 'coloring', 'styling'],
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
      description: 'Belirli bir kuaforle randevu olusturur',
      parameters: {
        type: 'object',
        properties: {
          customer_name: {
            type: 'string',
            description: 'Musterinin adi',
          },
          customer_phone: {
            type: 'string',
            description: 'Musterinin telefon numarasi',
          },
          staff_name: {
            type: 'string',
            description: 'Kuafor adi',
          },
          service_name: {
            type: 'string',
            description: 'Hizmet adi',
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
  {
    type: 'function',
    function: {
      name: 'get_customer_history',
      description: 'Musterinin gecmis randevularini ve hizmet gecmisini getirir (onceki stili hatirlamak icin onemli)',
      parameters: {
        type: 'object',
        properties: {
          customer_phone: {
            type: 'string',
            description: 'Musteri telefon numarasi',
          },
          limit: {
            type: 'number',
            description: 'Kac kayit getirilecegi (varsayilan 5)',
          },
        },
        required: [],
      },
    },
  },
];

/**
 * Kuafor sektoru function call'larini isler
 * Beauty fonksiyonlariyla ayni isleri yapar, sadece kategori mapping farkli
 * @param {string} tenantId - Tenant ID
 * @param {string} functionName - Fonksiyon adi
 * @param {Object} args - Fonksiyon argumanlari
 * @param {string} callerPhone - Arayan telefon numarasi
 * @returns {Object} Fonksiyon sonucu
 */
async function processHairdresserFunctionCall(tenantId, functionName, args, callerPhone) {
  console.log(`[HairdresserFunctions] ${functionName} cagriliyor:`, args);

  // Kuafor hizmetleri icin kategori mapping
  const categoryNames = {
    haircut: 'Sac Kesimi',
    coloring: 'Boyama',
    styling: 'Fon & Sekillendirme',
  };

  try {
    switch (functionName) {
      case 'get_hairdresser_services': {
        const services = await supabaseService.getBeautyServices(tenantId, {
          category: args.category,
        });

        // Kategorilere gore grupla
        const categorizedServices = {};

        services.forEach(s => {
          const cat = s.category || 'haircut';
          if (!categorizedServices[cat]) {
            categorizedServices[cat] = {
              category_name: categoryNames[cat] || cat,
              services: [],
            };
          }
          categorizedServices[cat].services.push({
            id: s.id,
            name: s.name,
            duration: `${s.duration_minutes} dakika`,
            price: s.price ? `${s.price} ${s.currency || 'TRY'}` : 'Fiyat icin sorunuz',
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

      // Diger fonksiyonlar beauty/functions.js ile ayni mantikta calisir
      // Bu fonksiyonlar beauty modulunden re-export edilebilir
      default: {
        // Beauty modulune yonlendir
        const beautyFunctions = require('../beauty/functions');
        return await beautyFunctions.processBeautyFunctionCall(tenantId, functionName, args, callerPhone);
      }
    }
  } catch (error) {
    console.error(`[HairdresserFunctions] ${functionName} hatasi:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  hairdresserFunctionDefinitions,
  processHairdresserFunctionCall,
};
