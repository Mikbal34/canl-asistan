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
const STEPS = ['industry', 'company_info', 'template', 'services', 'working_hours', 'staff', 'password', 'summary'];

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
3. Asistan şablonu seçimi (basic, standard, premium)
4. Hizmetler (isim, süre, fiyat)
5. Çalışma saatleri
6. Personel (isim, uzmanlık)
7. Giriş şifresi
8. Özet ve onay

Şablon Seçimi Kuralları:
- Sektör seçildikten ve firma bilgileri alındıktan sonra, o sektöre ait şablonları sun
- Her şablonun özelliklerini ve use case'lerini açıkla
- Önerilen (featured) şablonu vurgula ve tavsiye et
- Şablon tier'ları: basic (temel), standard (profesyonel), premium (VIP)
- Şablon seçimi zorunlu, kullanıcı mutlaka bir paket seçmeli

Genel Kurallar:
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
      name: 'select_template',
      description: 'Asistan şablonu seç (basic, standard, premium paketler)',
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
  if (collected_data.templateId) {
    state += `- Şablon: ${collected_data.templateId}`;
    if (collected_data.templateName) {
      state += ` (${collected_data.templateName})`;
    }
    state += '\n';
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
        newStep = 'template';
      }
      result.message = 'Firma bilgileri kaydedildi.';
      break;

    case 'select_template':
      if (args.templateId) {
        try {
          const template = await templateService.getTemplateById(args.templateId);
          if (template) {
            collected_data.templateId = args.templateId;
            collected_data.templateName = template.name;
            collected_data.templateTier = template.tier;
            // Set assistant name from template if defined
            if (template.default_assistant_name) {
              collected_data.assistantName = template.default_assistant_name;
            }
            // Set language
            collected_data.language = template.default_language || 'tr';
            newStep = 'services';
            result.message = `${template.name} şablonu seçildi.`;
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

  // Apply template if selected
  if (data.templateId) {
    try {
      await templateService.selectTemplate(tenant.id, data.templateId);
      console.log(`[OnboardingAgent] Template ${data.templateId} applied to tenant ${tenant.id}`);
    } catch (err) {
      console.error('[OnboardingAgent] Error applying template:', err);
      // Don't fail tenant creation if template fails
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
