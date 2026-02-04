/**
 * Onboarding Agent Service
 * LLM tabanlı müşteri kurulum chat asistanı
 */

const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');
const tenantService = require('./tenantService');
const templateService = require('./templateService');

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

// Steps for onboarding flow
// onboarding_mode: template (şablon seç) veya dynamic (ihtiyaç analizi)
// template_or_analysis: şablon modunda template seçimi, dinamik modda use case sorgusu
const STEPS = ['industry', 'company_info', 'onboarding_mode', 'template_or_analysis', 'use_cases', 'custom_rules', 'services', 'working_hours', 'staff', 'password', 'summary'];

// Industry options
const INDUSTRIES = {
  automotive: { label: 'Otomotiv / Galeri', icon: '🚗' },
  beauty_salon: { label: 'Güzellik Salonu', icon: '💅' },
  hairdresser: { label: 'Kuaför', icon: '✂️' },
};

// System prompt for the onboarding agent
const SYSTEM_PROMPT = `Sen bir müşteri kurulum asistanısın. Yeni müşteri kaydı oluşturmak için bilgi topluyorsun.

Görevin:
1. Kullanıcıdan doğal bir şekilde bilgi topla
2. Her adımda gerekli bilgileri al ve kaydet
3. Bilgileri onaylatarak devam et
4. Sonunda özet göster ve onay al

Adımlar:
1. Sektör seçimi (automotive, beauty_salon, hairdresser)
2. Firma bilgileri (ad, telefon, email)
3. Onboarding modu seçimi: "Hazır paket" veya "Kendim belirleyeyim"
4. Template seçimi VEYA İhtiyaç analizi (moda bağlı)
5. Use case özelleştirme (şablon modunda) veya devam (dinamik modda)
6. Özel iş kuralları (yaş sınırı, ödeme koşulları, iptal politikası vb.)
7. Hizmetler (isim, süre, fiyat)
8. Çalışma saatleri
9. Personel (isim, uzmanlık)
10. Giriş şifresi
11. Özet ve onay

## Onboarding Modu Seçimi:
Firma bilgileri alındıktan sonra kullanıcıya sor:
"Nasıl ilerlemek istersiniz?"
- "Hazır paket seç" → select_onboarding_mode('template') çağır, sonra şablon listesi sun
- "Kendim belirleyeyim" → select_onboarding_mode('dynamic') çağır, sonra ihtiyaç analizi başlat

## Şablon Modu (onboardingMode = 'template'):
- Sektöre ait şablonları sun
- Her şablonun özelliklerini ve use case'lerini açıkla
- Önerilen (featured) şablonu vurgula ve tavsiye et
- Şablon tier'ları: basic (temel), standard (profesyonel), premium (VIP)
- Şablon seçildikten sonra, kullanıcıya ek özellik eklemek isteyip istemediğini sor
- toggle_use_case ile özellik ekle/çıkar
- Tamamlandığında finish_use_cases çağır

## Dinamik Mod (onboardingMode = 'dynamic'):
- Şablon KULLANMA, direkt use case'leri belirle
- Her use case için sektöre uygun bir soru sor
- Cevaba göre set_use_case_from_analysis çağır
- Tüm sorular bitince finish_use_case_analysis çağır

İhtiyaç Analizi Örnek Sorular:
- Otomotiv: "Müşterileriniz telefonda randevu alıyor mu?", "Test sürüşü hizmeti veriyor musunuz?", "Fiyat bilgisi veriyor musunuz telefonda?", "Kampanya duyurusu yapar mısınız?"
- Güzellik Salonu: "Randevu sistemi kullanıyor musunuz?", "Hizmet fiyatlarını telefonda söylüyor musunuz?", "Kampanya ve indirim duyuruları yapıyor musunuz?", "VIP müşteri programınız var mı?"
- Kuaför: "Randevu alıyor musunuz?", "Fiyat listesi paylaşıyor musunuz?", "Ürün satışı yapıyor musunuz?"

Use Case Listesi:
- business_info: Firma bilgileri sağlama
- appointments_core: Randevu alma
- pricing: Fiyat bilgisi
- promotions: Kampanya/promosyon duyuruları
- test_drive: Test sürüşü (otomotiv)
- service_appointment: Servis randevusu (otomotiv)
- vehicle_inquiry: Araç sorgulama (otomotiv)
- product_catalog: Ürün kataloğu
- vip_services: VIP hizmetler

## Özel Kurallar Toplama:
- Use case belirlendikten sonra, firmanın özel kurallarını sor
- Örnek: "Firmanızın özel kuralları var mı? Yaş sınırı, ödeme koşulları, iptal politikası gibi..."
- Her kuralı add_custom_rule ile kaydet
- Kural yoksa veya tamamlandığında finish_custom_rules çağır

## Genel Kurallar:
- Türkçe konuş, samimi ve profesyonel ol
- Eksik bilgi varsa tekrar sor
- Bilgileri doğrulatmak için özet göster
- Function call'ları kullanarak bilgileri kaydet
- Her adımda bir sonraki adıma geçmeden önce bilgilerin doğru olduğunu kontrol et

{{AVAILABLE_TEMPLATES}}

Mevcut durum: {{CURRENT_STATE}}`;

// Function definitions for OpenAI
const FUNCTION_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'select_industry',
      description: 'Sektör seç (otomotiv, güzellik salonu, kuaför)',
      parameters: {
        type: 'object',
        properties: {
          industry: {
            type: 'string',
            enum: ['automotive', 'beauty_salon', 'hairdresser'],
            description: 'Seçilen sektör',
          },
        },
        required: ['industry'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_company_info',
      description: 'Firma bilgilerini kaydet (ad, telefon, email)',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Firma adı' },
          phone: { type: 'string', description: 'Telefon numarası' },
          email: { type: 'string', description: 'Email adresi' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'select_onboarding_mode',
      description: 'Onboarding modunu seç: şablon (hazır paket) veya dinamik (ihtiyaç analizi)',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['template', 'dynamic'],
            description: 'template: hazır şablon seç, dynamic: ihtiyaç analizi yap',
          },
        },
        required: ['mode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'select_template',
      description: 'Asistan şablonu seç (basic, standard, premium paketler) - sadece template modunda kullan',
      parameters: {
        type: 'object',
        properties: {
          templateId: { type: 'string', description: 'Şablon ID (örn: beauty_standard, automotive_basic)' },
        },
        required: ['templateId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_use_case_from_analysis',
      description: 'İhtiyaç analizine göre use case aktifle/pasifle - sadece dynamic modunda kullan',
      parameters: {
        type: 'object',
        properties: {
          useCase: {
            type: 'string',
            description: 'Use case ID (örn: appointments_core, pricing, test_drive)',
          },
          enabled: {
            type: 'boolean',
            description: 'Aktifleştir (true) veya pasifleştir (false)',
          },
          reason: {
            type: 'string',
            description: 'Neden aktif/pasif (AI analiz notu)',
          },
        },
        required: ['useCase', 'enabled'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish_use_case_analysis',
      description: 'Dinamik ihtiyaç analizini tamamla ve bir sonraki adıma geç',
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
      name: 'toggle_use_case',
      description: 'Use case aktifle veya deaktifle (şablondaki özelliklere ek olarak)',
      parameters: {
        type: 'object',
        properties: {
          useCase: {
            type: 'string',
            description: 'Use case ID (örn: test_drive, service_appointment, promotions, appointment_booking)',
          },
          enabled: {
            type: 'boolean',
            description: 'Aktifleştir (true) veya deaktifle (false)',
          },
        },
        required: ['useCase', 'enabled'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_custom_rule',
      description: 'Özel iş kuralı ekle (yaş sınırı, ödeme koşulları, iptal politikası vb.)',
      parameters: {
        type: 'object',
        properties: {
          rule: {
            type: 'string',
            description: 'Kural açıklaması (örn: "18 yaş altına test sürüşü verilmez")',
          },
        },
        required: ['rule'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish_use_cases',
      description: 'Use case seçimini tamamla ve bir sonraki adıma geç',
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
      name: 'finish_custom_rules',
      description: 'Özel kuralları tamamla ve bir sonraki adıma geç',
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
      name: 'add_service',
      description: 'Hizmet ekle',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Hizmet adı' },
          duration: { type: 'number', description: 'Süre (dakika)' },
          price: { type: 'number', description: 'Fiyat (TL)' },
          category: { type: 'string', description: 'Kategori (opsiyonel)' },
        },
        required: ['name', 'duration', 'price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_working_hours',
      description: 'Çalışma saatlerini kaydet',
      parameters: {
        type: 'object',
        properties: {
          monday: { type: 'object', properties: { open: { type: 'string' }, close: { type: 'string' }, closed: { type: 'boolean' } } },
          tuesday: { type: 'object', properties: { open: { type: 'string' }, close: { type: 'string' }, closed: { type: 'boolean' } } },
          wednesday: { type: 'object', properties: { open: { type: 'string' }, close: { type: 'string' }, closed: { type: 'boolean' } } },
          thursday: { type: 'object', properties: { open: { type: 'string' }, close: { type: 'string' }, closed: { type: 'boolean' } } },
          friday: { type: 'object', properties: { open: { type: 'string' }, close: { type: 'string' }, closed: { type: 'boolean' } } },
          saturday: { type: 'object', properties: { open: { type: 'string' }, close: { type: 'string' }, closed: { type: 'boolean' } } },
          sunday: { type: 'object', properties: { open: { type: 'string' }, close: { type: 'string' }, closed: { type: 'boolean' } } },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_staff',
      description: 'Personel ekle',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Personel adı' },
          specialty: { type: 'string', description: 'Uzmanlık alanı' },
          phone: { type: 'string', description: 'Telefon (opsiyonel)' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_password',
      description: 'Giriş şifresini kaydet',
      parameters: {
        type: 'object',
        properties: {
          password: { type: 'string', description: 'Şifre (min 6 karakter)' },
        },
        required: ['password'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'confirm_and_complete',
      description: 'Bilgileri onayla ve tenant oluştur',
      parameters: {
        type: 'object',
        properties: {
          confirmed: { type: 'boolean', description: 'Kullanıcı onayladı mı?' },
        },
        required: ['confirmed'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'go_to_step',
      description: 'Belirli bir adıma git veya geri dön',
      parameters: {
        type: 'object',
        properties: {
          step: {
            type: 'string',
            enum: STEPS,
            description: 'Gidilecek adım',
          },
        },
        required: ['step'],
      },
    },
  },
];

/**
 * Create a new onboarding session
 */
async function createSession(userId) {
  const { data, error } = await supabase
    .from('onboarding_agent_sessions')
    .insert({
      created_by: userId,
      current_step: 'industry',
      collected_data: {},
      conversation_history: [],
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;

  // Add initial greeting
  const greeting = `Merhaba! 👋 Yeni müşteri kaydı oluşturmana yardımcı olacağım.

İlk olarak, müşterinizin hangi sektörde faaliyet gösterdiğini öğrenebilir miyim?

🚗 **Otomotiv / Galeri**
💅 **Güzellik Salonu**
✂️ **Kuaför**`;

  const history = [{
    role: 'assistant',
    content: greeting,
    timestamp: new Date().toISOString(),
  }];

  await supabase
    .from('onboarding_agent_sessions')
    .update({ conversation_history: history })
    .eq('id', data.id);

  return {
    ...data,
    conversation_history: history,
  };
}

/**
 * Get session by ID
 */
async function getSession(sessionId) {
  const { data, error } = await supabase
    .from('onboarding_agent_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update session data
 */
async function updateSession(sessionId, updates) {
  const { data, error } = await supabase
    .from('onboarding_agent_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Generate template information for the AI prompt
 */
async function generateTemplateInfo(industry) {
  if (!industry) {
    return '';
  }

  try {
    const templates = await templateService.getTemplates({ industry, isActive: true });
    if (!templates || templates.length === 0) {
      return '';
    }

    let info = `\nMevcut Şablonlar (${INDUSTRIES[industry]?.label || industry} sektörü için):\n`;

    for (const t of templates) {
      const icon = t.tier === 'premium' ? '💎' : t.tier === 'standard' ? '⭐' : '📦';
      const featured = t.is_featured ? ' - ÖNERİLEN' : '';
      info += `\n${icon} **${t.name}** (ID: ${t.id})${featured}\n`;
      info += `   Tier: ${t.tier}\n`;
      if (t.description) {
        info += `   Açıklama: ${t.description}\n`;
      }
      if (t.included_use_cases && t.included_use_cases.length > 0) {
        info += `   Özellikler: ${t.included_use_cases.join(', ')}\n`;
      }
    }

    return info;
  } catch (err) {
    console.error('[OnboardingAgent] Error fetching templates:', err);
    return '';
  }
}

/**
 * Generate current state description for the AI
 */
function generateStateDescription(session) {
  const { current_step, collected_data } = session;
  const stepIndex = STEPS.indexOf(current_step);

  let state = `Mevcut adım: ${current_step} (${stepIndex + 1}/${STEPS.length})\n\n`;
  state += 'Toplanan bilgiler:\n';

  if (collected_data.industry) {
    state += `- Sektör: ${INDUSTRIES[collected_data.industry]?.label || collected_data.industry}\n`;
  }
  if (collected_data.name) {
    state += `- Firma adı: ${collected_data.name}\n`;
  }
  if (collected_data.phone) {
    state += `- Telefon: ${collected_data.phone}\n`;
  }
  if (collected_data.email) {
    state += `- Email: ${collected_data.email}\n`;
  }
  if (collected_data.onboardingMode) {
    state += `- Onboarding modu: ${collected_data.onboardingMode === 'template' ? 'Şablon (Hazır Paket)' : 'Dinamik (İhtiyaç Analizi)'}\n`;
  }
  if (collected_data.onboardingMode === 'template') {
    if (collected_data.templateId) {
      state += `- Şablon: ${collected_data.templateId}`;
      if (collected_data.templateName) {
        state += ` (${collected_data.templateName})`;
      }
      state += '\n';
      if (collected_data.templateUseCases && collected_data.templateUseCases.length > 0) {
        state += `- Şablondaki özellikler: ${collected_data.templateUseCases.join(', ')}\n`;
      }
    }
    if (collected_data.addedUseCases && collected_data.addedUseCases.length > 0) {
      state += `- Eklenen özellikler: ${collected_data.addedUseCases.join(', ')}\n`;
    }
    if (collected_data.removedUseCases && collected_data.removedUseCases.length > 0) {
      state += `- Çıkarılan özellikler: ${collected_data.removedUseCases.join(', ')}\n`;
    }
  } else if (collected_data.onboardingMode === 'dynamic') {
    if (collected_data.dynamicUseCases && collected_data.dynamicUseCases.length > 0) {
      state += `- Belirlenen özellikler (dinamik): ${collected_data.dynamicUseCases.join(', ')}\n`;
    }
    if (collected_data.analysisNotes && Object.keys(collected_data.analysisNotes).length > 0) {
      state += `- Analiz notları:\n`;
      for (const [uc, note] of Object.entries(collected_data.analysisNotes)) {
        state += `  - ${uc}: ${note}\n`;
      }
    }
  }
  if (collected_data.customRules && collected_data.customRules.length > 0) {
    state += `- Özel kurallar:\n`;
    collected_data.customRules.forEach((rule, i) => {
      state += `  ${i + 1}. ${rule}\n`;
    });
  }
  if (collected_data.assistantName) {
    state += `- Asistan adı: ${collected_data.assistantName}\n`;
  }
  if (collected_data.language) {
    state += `- Dil: ${collected_data.language}\n`;
  }
  if (collected_data.services && collected_data.services.length > 0) {
    state += `- Hizmetler: ${collected_data.services.length} adet\n`;
    collected_data.services.forEach((s, i) => {
      state += `  ${i + 1}. ${s.name} (${s.duration}dk, ${s.price}TL)\n`;
    });
  }
  if (collected_data.workingHours) {
    state += `- Çalışma saatleri: Tanımlandı\n`;
  }
  if (collected_data.staff && collected_data.staff.length > 0) {
    state += `- Personel: ${collected_data.staff.length} kişi\n`;
    collected_data.staff.forEach((s, i) => {
      state += `  ${i + 1}. ${s.name}${s.specialty ? ` (${s.specialty})` : ''}\n`;
    });
  }
  if (collected_data.password) {
    state += `- Şifre: ******** (tanımlandı)\n`;
  }

  // Add next steps hint
  const remainingSteps = STEPS.slice(stepIndex);
  if (remainingSteps.length > 1) {
    state += `\nKalan adımlar: ${remainingSteps.slice(1).join(', ')}`;
  }

  return state;
}

/**
 * Process function call result
 */
async function processFunctionCall(session, functionName, args) {
  const collected_data = { ...session.collected_data };
  let newStep = session.current_step;
  let result = { success: true, message: '' };

  switch (functionName) {
    case 'select_industry':
      collected_data.industry = args.industry;
      newStep = 'company_info';
      result.message = `Sektör: ${INDUSTRIES[args.industry]?.label} olarak kaydedildi.`;
      break;

    case 'save_company_info':
      if (args.name) collected_data.name = args.name;
      if (args.phone) collected_data.phone = args.phone;
      if (args.email) collected_data.email = args.email;
      if (collected_data.name) {
        // Auto-generate slug from name
        collected_data.slug = args.name
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 30);
        newStep = 'onboarding_mode';
      }
      result.message = 'Firma bilgileri kaydedildi.';
      break;

    case 'select_onboarding_mode':
      collected_data.onboardingMode = args.mode;
      newStep = 'template_or_analysis';
      if (args.mode === 'dynamic') {
        // Initialize dynamic use case tracking
        collected_data.dynamicUseCases = [];
        collected_data.analysisNotes = {};
        result.message = 'Dinamik mod seçildi. İhtiyaç analizi başlıyor...';
      } else {
        result.message = 'Şablon modu seçildi. Şablon listesi sunulacak...';
      }
      break;

    case 'select_template':
      if (args.templateId) {
        try {
          const template = await templateService.getTemplateById(args.templateId);
          if (template) {
            collected_data.templateId = args.templateId;
            collected_data.templateName = template.name;
            collected_data.templateTier = template.tier;
            collected_data.templateUseCases = template.included_use_cases || [];
            // Initialize use case tracking arrays
            collected_data.addedUseCases = [];
            collected_data.removedUseCases = [];
            // Set assistant name from template if defined
            if (template.default_assistant_name) {
              collected_data.assistantName = template.default_assistant_name;
            }
            // Set language
            collected_data.language = template.default_language || 'tr';
            newStep = 'use_cases';
            result.message = `${template.name} şablonu seçildi. Şablonda dahil özellikler: ${(template.included_use_cases || []).join(', ') || 'Yok'}`;
            result.template = template;
          } else {
            result.success = false;
            result.message = 'Şablon bulunamadı.';
          }
        } catch (err) {
          console.error('[OnboardingAgent] Error selecting template:', err);
          result.success = false;
          result.message = 'Şablon seçilirken hata oluştu.';
        }
      }
      break;

    case 'set_use_case_from_analysis':
      // Dynamic mode: Set use case from needs analysis
      if (collected_data.onboardingMode !== 'dynamic') {
        result.success = false;
        result.message = 'Bu fonksiyon sadece dinamik modda kullanılabilir.';
        break;
      }
      if (args.useCase) {
        if (!collected_data.dynamicUseCases) collected_data.dynamicUseCases = [];
        if (!collected_data.analysisNotes) collected_data.analysisNotes = {};

        if (args.enabled) {
          // Add use case if not already in list
          if (!collected_data.dynamicUseCases.includes(args.useCase)) {
            collected_data.dynamicUseCases.push(args.useCase);
          }
          result.message = `"${args.useCase}" özelliği aktifleştirildi.`;
        } else {
          // Remove use case if in list
          collected_data.dynamicUseCases = collected_data.dynamicUseCases.filter(uc => uc !== args.useCase);
          result.message = `"${args.useCase}" özelliği pasifleştirildi.`;
        }

        // Store analysis note if provided
        if (args.reason) {
          collected_data.analysisNotes[args.useCase] = args.reason;
        }
      }
      break;

    case 'finish_use_case_analysis':
      // Dynamic mode: Finish needs analysis and move to custom_rules
      if (collected_data.onboardingMode !== 'dynamic') {
        result.success = false;
        result.message = 'Bu fonksiyon sadece dinamik modda kullanılabilir.';
        break;
      }
      // Always add business_info as a base use case
      if (!collected_data.dynamicUseCases) collected_data.dynamicUseCases = [];
      if (!collected_data.dynamicUseCases.includes('business_info')) {
        collected_data.dynamicUseCases.unshift('business_info');
      }
      newStep = 'custom_rules';
      result.message = `İhtiyaç analizi tamamlandı. Belirlenen özellikler: ${collected_data.dynamicUseCases.join(', ')}`;
      break;

    case 'toggle_use_case':
      if (args.useCase) {
        if (!collected_data.addedUseCases) collected_data.addedUseCases = [];
        if (!collected_data.removedUseCases) collected_data.removedUseCases = [];
        const templateUseCases = collected_data.templateUseCases || [];

        if (args.enabled) {
          // Add use case
          // If it was in removedUseCases, remove from there
          collected_data.removedUseCases = collected_data.removedUseCases.filter(uc => uc !== args.useCase);
          // If it's not in template, add to addedUseCases
          if (!templateUseCases.includes(args.useCase) && !collected_data.addedUseCases.includes(args.useCase)) {
            collected_data.addedUseCases.push(args.useCase);
          }
          result.message = `"${args.useCase}" özelliği aktifleştirildi.`;
        } else {
          // Remove use case
          // If it was in addedUseCases, remove from there
          collected_data.addedUseCases = collected_data.addedUseCases.filter(uc => uc !== args.useCase);
          // If it's in template, add to removedUseCases
          if (templateUseCases.includes(args.useCase) && !collected_data.removedUseCases.includes(args.useCase)) {
            collected_data.removedUseCases.push(args.useCase);
          }
          result.message = `"${args.useCase}" özelliği deaktifleştirildi.`;
        }
      }
      break;

    case 'finish_use_cases':
      newStep = 'custom_rules';
      result.message = 'Use case seçimi tamamlandı.';
      break;

    case 'add_custom_rule':
      if (args.rule && args.rule.trim()) {
        if (!collected_data.customRules) collected_data.customRules = [];
        collected_data.customRules.push(args.rule.trim());
        result.message = `Kural eklendi: "${args.rule.trim()}" (${collected_data.customRules.length} kural)`;
      } else {
        result.success = false;
        result.message = 'Kural boş olamaz.';
      }
      break;

    case 'finish_custom_rules':
      newStep = 'services';
      result.message = 'Özel kurallar tamamlandı.';
      break;

    case 'add_service':
      if (!collected_data.services) collected_data.services = [];
      collected_data.services.push({
        name: args.name,
        duration: args.duration,
        price: args.price,
        category: args.category || 'general',
      });
      result.message = `"${args.name}" hizmeti eklendi (${collected_data.services.length} hizmet).`;
      // Stay on services step until user says done
      break;

    case 'save_working_hours':
      collected_data.workingHours = {
        monday: args.monday || { open: '09:00', close: '18:00', closed: false },
        tuesday: args.tuesday || { open: '09:00', close: '18:00', closed: false },
        wednesday: args.wednesday || { open: '09:00', close: '18:00', closed: false },
        thursday: args.thursday || { open: '09:00', close: '18:00', closed: false },
        friday: args.friday || { open: '09:00', close: '18:00', closed: false },
        saturday: args.saturday || { open: '10:00', close: '16:00', closed: false },
        sunday: args.sunday || { open: '00:00', close: '00:00', closed: true },
      };
      newStep = 'staff';
      result.message = 'Çalışma saatleri kaydedildi.';
      break;

    case 'add_staff':
      if (!collected_data.staff) collected_data.staff = [];
      collected_data.staff.push({
        name: args.name,
        specialty: args.specialty || '',
        phone: args.phone || '',
      });
      result.message = `${args.name} personel olarak eklendi (${collected_data.staff.length} personel).`;
      // Stay on staff step until user says done
      break;

    case 'save_password':
      if (args.password && args.password.length >= 6) {
        collected_data.password = args.password;
        newStep = 'summary';
        result.message = 'Şifre kaydedildi.';
      } else {
        result.success = false;
        result.message = 'Şifre en az 6 karakter olmalıdır.';
      }
      break;

    case 'confirm_and_complete':
      if (args.confirmed) {
        result.createTenant = true;
        result.message = 'Onaylandı, tenant oluşturuluyor...';
      } else {
        result.message = 'İptal edildi.';
      }
      break;

    case 'go_to_step':
      if (STEPS.includes(args.step)) {
        newStep = args.step;
        result.message = `${args.step} adımına gidildi.`;
      }
      break;

    default:
      result.success = false;
      result.message = 'Bilinmeyen fonksiyon.';
  }

  // Update session
  await updateSession(session.id, {
    collected_data,
    current_step: newStep,
  });

  return {
    ...result,
    collected_data,
    current_step: newStep,
  };
}

/**
 * Process user message and get AI response
 */
async function processMessage(sessionId, userMessage) {
  // Get current session
  const session = await getSession(sessionId);

  if (!session) {
    throw new Error('Session not found');
  }

  if (session.status !== 'active') {
    throw new Error('Session is not active');
  }

  // Check if session expired
  if (new Date(session.expires_at) < new Date()) {
    await updateSession(sessionId, { status: 'expired' });
    throw new Error('Session expired');
  }

  // Add user message to history
  const history = [...(session.conversation_history || [])];
  history.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
  });

  // Generate state description
  const stateDescription = generateStateDescription(session);

  // Generate template info if industry is selected
  const templateInfo = await generateTemplateInfo(session.collected_data?.industry);

  // Build messages for OpenAI
  const messages = [
    {
      role: 'system',
      content: SYSTEM_PROMPT
        .replace('{{CURRENT_STATE}}', stateDescription)
        .replace('{{AVAILABLE_TEMPLATES}}', templateInfo),
    },
    // Include recent conversation history (last 20 messages)
    ...history.slice(-20).map(h => ({
      role: h.role,
      content: h.content,
    })),
  ];

  try {
    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools: FUNCTION_DEFINITIONS,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1000,
    });

    const assistantMessage = response.choices[0].message;
    let responseText = assistantMessage.content || '';
    let functionResults = [];
    let tenantCreated = null;

    // Process function calls if any
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`[OnboardingAgent] Function call: ${functionName}`, functionArgs);

        const result = await processFunctionCall(session, functionName, functionArgs);
        functionResults.push({
          name: functionName,
          args: functionArgs,
          result,
        });

        // If confirm_and_complete was called with confirmed=true, create the tenant
        if (result.createTenant) {
          try {
            tenantCreated = await createTenantFromSession(session.id);
          } catch (err) {
            console.error('[OnboardingAgent] Error creating tenant:', err);
            responseText = `Tenant oluşturulurken bir hata oluştu: ${err.message}`;
          }
        }
      }

      // Get updated session after function calls
      const updatedSession = await getSession(sessionId);
      const newStateDescription = generateStateDescription(updatedSession);
      const newTemplateInfo = await generateTemplateInfo(updatedSession.collected_data?.industry);

      // Call OpenAI again with function results
      const toolMessages = [];
      for (let i = 0; i < assistantMessage.tool_calls.length; i++) {
        toolMessages.push({
          role: 'tool',
          tool_call_id: assistantMessage.tool_calls[i].id,
          content: JSON.stringify(functionResults[i].result),
        });
      }

      const followUpResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
              .replace('{{CURRENT_STATE}}', newStateDescription)
              .replace('{{AVAILABLE_TEMPLATES}}', newTemplateInfo),
          },
          ...history.slice(-20).map(h => ({
            role: h.role,
            content: h.content,
          })),
          {
            role: 'assistant',
            content: assistantMessage.content,
            tool_calls: assistantMessage.tool_calls,
          },
          ...toolMessages,
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      responseText = followUpResponse.choices[0].message.content || responseText;
    }

    // If tenant was created, append success message
    if (tenantCreated) {
      responseText = `🎉 **${tenantCreated.name}** başarıyla oluşturuldu!

📧 **Giriş Email:** ${tenantCreated.email || session.collected_data.email}
🔑 **Şifre:** ********

Artık müşteriniz bu bilgilerle sisteme giriş yapabilir.`;

      // Update session status
      await updateSession(sessionId, { status: 'completed' });
    }

    // Add assistant response to history
    history.push({
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString(),
    });

    // Update session with new history
    await supabase
      .from('onboarding_agent_sessions')
      .update({ conversation_history: history })
      .eq('id', sessionId);

    // Get final session state
    const finalSession = await getSession(sessionId);

    return {
      message: responseText,
      session: finalSession,
      functionResults,
      tenantCreated,
    };
  } catch (error) {
    console.error('[OnboardingAgent] Error:', error);
    throw error;
  }
}

/**
 * Create tenant from session data
 */
async function createTenantFromSession(sessionId) {
  const session = await getSession(sessionId);
  const data = session.collected_data;

  if (!data.industry || !data.name || !data.email || !data.password) {
    throw new Error('Eksik bilgiler var: sektör, firma adı, email ve şifre gerekli.');
  }

  // Create tenant using tenantService
  const tenant = await tenantService.createTenant({
    name: data.name,
    slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    industry: data.industry,
    phone: data.phone,
    email: data.email,
    assistantName: data.assistantName || 'Asistan',
    defaultLanguage: data.language || 'tr',
    createUser: true,
    userEmail: data.email,
    userPassword: data.password,
  });

  // Handle use cases based on onboarding mode
  if (data.onboardingMode === 'dynamic') {
    // Dynamic mode: No template, directly insert use cases
    console.log(`[OnboardingAgent] Dynamic mode: inserting ${(data.dynamicUseCases || []).length} use cases directly`);

    const dynamicUseCases = data.dynamicUseCases || ['business_info'];

    if (dynamicUseCases.length > 0) {
      const useCasesToInsert = dynamicUseCases.map(uc => ({
        tenant_id: tenant.id,
        use_case_id: uc,
        enabled: true,
      }));

      try {
        // Clear existing use cases first
        await supabase
          .from('tenant_use_cases')
          .delete()
          .eq('tenant_id', tenant.id);

        // Insert new use cases
        await supabase.from('tenant_use_cases').insert(useCasesToInsert);
        console.log(`[OnboardingAgent] Inserted ${dynamicUseCases.length} dynamic use cases for tenant ${tenant.id}`);
      } catch (err) {
        console.error('[OnboardingAgent] Error inserting dynamic use cases:', err);
      }
    }

    // Store analysis notes in tenant metadata if available
    if (data.analysisNotes && Object.keys(data.analysisNotes).length > 0) {
      try {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('metadata')
          .eq('id', tenant.id)
          .single();

        const existingMetadata = tenantData?.metadata || {};
        await supabase
          .from('tenants')
          .update({
            metadata: {
              ...existingMetadata,
              onboarding_mode: 'dynamic',
              use_case_analysis_notes: data.analysisNotes,
            },
          })
          .eq('id', tenant.id);
      } catch (err) {
        console.error('[OnboardingAgent] Error storing analysis notes:', err);
      }
    }

  } else if (data.templateId) {
    // Template mode: Apply template and customize
    try {
      await templateService.selectTemplate(tenant.id, data.templateId);
      console.log(`[OnboardingAgent] Template ${data.templateId} applied to tenant ${tenant.id}`);

      // Sync effective use cases: (template + added) - removed
      const templateUseCases = data.templateUseCases || [];
      const addedUseCases = data.addedUseCases || [];
      const removedUseCases = data.removedUseCases || [];

      const effectiveUseCases = [...new Set([...templateUseCases, ...addedUseCases])]
        .filter(uc => !removedUseCases.includes(uc));

      if (effectiveUseCases.length > 0) {
        // Update tenant_assistant_template with added/removed use cases
        await supabase
          .from('tenant_assistant_template')
          .update({
            added_use_cases: addedUseCases,
            removed_use_cases: removedUseCases,
          })
          .eq('tenant_id', tenant.id);

        // Sync to tenant_use_cases
        try {
          await templateService.syncEffectiveUseCases(tenant.id, effectiveUseCases);
          console.log(`[OnboardingAgent] Synced ${effectiveUseCases.length} use cases to tenant ${tenant.id}`);
        } catch (err) {
          console.error('[OnboardingAgent] Error syncing use cases:', err);
        }
      }
    } catch (err) {
      console.error('[OnboardingAgent] Error applying template:', err);
      // Don't fail tenant creation if template fails
    }
  }

  // Save custom rules to voice_config_override
  if (data.customRules && data.customRules.length > 0) {
    const rulesSection = `\n\n## Özel Kurallar\n${data.customRules.map(r => `- ${r}`).join('\n')}`;

    try {
      await supabase
        .from('tenants')
        .update({
          voice_config_override: {
            system_prompt_suffix: rulesSection,
          },
        })
        .eq('id', tenant.id);
      console.log(`[OnboardingAgent] Saved ${data.customRules.length} custom rules to tenant ${tenant.id}`);
    } catch (err) {
      console.error('[OnboardingAgent] Error saving custom rules:', err);
    }
  }

  // Add services if any (for beauty/hairdresser)
  if (data.services && data.services.length > 0) {
    const servicesToInsert = data.services.map(s => ({
      tenant_id: tenant.id,
      name: s.name,
      duration_minutes: s.duration,
      price: s.price,
      category: s.category || 'general',
      currency: 'TRY',
      is_active: true,
    }));

    await supabase.from('beauty_services').insert(servicesToInsert);
  }

  // Add working hours if defined
  if (data.workingHours) {
    await supabase
      .from('tenants')
      .update({ working_hours: data.workingHours })
      .eq('id', tenant.id);
  }

  // Add staff if any
  if (data.staff && data.staff.length > 0) {
    const staffToInsert = data.staff.map(s => ({
      tenant_id: tenant.id,
      name: s.name,
      specialty: s.specialty || null,
      phone: s.phone || null,
      is_active: true,
    }));

    // Try to insert staff (table may not exist)
    try {
      await supabase.from('staff').insert(staffToInsert);
    } catch (e) {
      console.log('[OnboardingAgent] Staff table may not exist, skipping staff insert');
    }
  }

  return tenant;
}

/**
 * Cancel a session
 */
async function cancelSession(sessionId) {
  return await updateSession(sessionId, { status: 'cancelled' });
}

/**
 * Get sessions for a user
 */
async function getUserSessions(userId, status = null) {
  let query = supabase
    .from('onboarding_agent_sessions')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

module.exports = {
  createSession,
  getSession,
  processMessage,
  cancelSession,
  getUserSessions,
  createTenantFromSession,
  STEPS,
  INDUSTRIES,
};
