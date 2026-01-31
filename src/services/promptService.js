/**
 * Prompt Service
 * Dinamik prompt yükleme ve template değişken değiştirme
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');
const tenantService = require('./tenantService');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

/**
 * Tenant için sistem promptunu getir
 * @param {string} tenantId - Tenant ID
 * @param {string} language - Dil kodu (tr, en, de)
 * @returns {Object} - { systemPrompt, welcomeMessage, assistantName }
 */
async function getSystemPrompt(tenantId, language = 'tr') {
  // Tenant bilgisini al
  const tenant = await tenantService.getTenantById(tenantId);

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // Prompt template'i al
  const template = await tenantService.getTenantPromptTemplate(tenantId, language);

  if (!template) {
    // Fallback: Industry preset'ten default prompt
    const preset = await getIndustryPreset(tenant.industry);
    const promptField = `default_prompt_${language}` || 'default_prompt_tr';

    return {
      systemPrompt: applyTemplateVariables(preset?.[promptField] || getDefaultPrompt(language), tenant),
      welcomeMessage: applyTemplateVariables(preset?.[`default_welcome_${language}`] || getDefaultWelcome(language), tenant),
      assistantName: tenant.assistant_name || preset?.[`default_assistant_name_${language}`] || 'Asistan',
    };
  }

  // Template değişkenlerini uygula
  return {
    systemPrompt: applyTemplateVariables(template.system_prompt, tenant),
    welcomeMessage: applyTemplateVariables(template.welcome_message, tenant),
    assistantName: template.assistant_name || tenant.assistant_name || 'Asistan',
  };
}

/**
 * Industry preset'ini getir
 */
async function getIndustryPreset(industry) {
  const { data, error } = await supabase
    .from('industry_presets')
    .select('*')
    .eq('industry', industry)
    .single();

  if (error) return null;
  return data;
}

/**
 * Template değişkenlerini uygula
 */
function applyTemplateVariables(template, tenant) {
  if (!template) return '';

  const variables = {
    '{COMPANY_NAME}': tenant.name || 'Company',
    '{ASSISTANT_NAME}': tenant.assistant_name || 'Asistan',
    '{PHONE}': tenant.phone || '',
    '{EMAIL}': tenant.email || '',
    '{ADDRESS}': tenant.address || '',
    '{WEBSITE}': tenant.website || '',
  };

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(key, 'g'), value);
  }

  return result;
}

/**
 * Varsayılan prompt (fallback)
 */
function getDefaultPrompt(language = 'tr') {
  const prompts = {
    tr: `Sen profesyonel bir sesli asistansın. Müşterilere yardımcı olmak için buradasın.

## Konuşma Kuralları:
- Kısa ve net cümleler kur
- Samimi ama profesyonel ol
- Müşterinin adını sor ve kullan
- Bir seferde sadece bir bilgi iste`,

    en: `You are a professional voice assistant. You are here to help customers.

## Conversation Rules:
- Use short and clear sentences
- Be friendly but professional
- Ask for the customer's name and use it
- Ask for only one piece of information at a time`,

    de: `Sie sind ein professioneller Sprachassistent. Sie sind hier, um Kunden zu helfen.

## Gesprächsregeln:
- Verwenden Sie kurze und klare Sätze
- Seien Sie freundlich aber professionell
- Fragen Sie nach dem Namen des Kunden
- Fragen Sie nur nach einer Information auf einmal`,
  };

  return prompts[language] || prompts.tr;
}

/**
 * Varsayılan karşılama mesajı (fallback)
 */
function getDefaultWelcome(language = 'tr') {
  const messages = {
    tr: 'Merhaba, ben sesli asistanınız. Size nasıl yardımcı olabilirim?',
    en: 'Hello, I am your voice assistant. How can I help you today?',
    de: 'Hallo, ich bin Ihr Sprachassistent. Wie kann ich Ihnen heute helfen?',
  };

  return messages[language] || messages.tr;
}

/**
 * Dil algılama için basit kontrol
 */
function detectLanguage(text) {
  const turkishWords = ['merhaba', 'selam', 'nasıl', 'randevu', 'araç', 'servis', 'test', 'sürüş', 'evet', 'hayır', 'tamam', 'teşekkür', 'saç', 'kuaför', 'güzellik'];
  const englishWords = ['hello', 'hi', 'how', 'appointment', 'car', 'service', 'test', 'drive', 'yes', 'no', 'okay', 'thank', 'hair', 'salon', 'beauty'];
  const germanWords = ['hallo', 'guten', 'tag', 'wie', 'termin', 'auto', 'service', 'probefahrt', 'ja', 'nein', 'danke', 'haar', 'salon', 'schönheit'];

  const lowerText = text.toLowerCase();

  let turkishScore = 0;
  let englishScore = 0;
  let germanScore = 0;

  turkishWords.forEach(word => {
    if (lowerText.includes(word)) turkishScore++;
  });

  englishWords.forEach(word => {
    if (lowerText.includes(word)) englishScore++;
  });

  germanWords.forEach(word => {
    if (lowerText.includes(word)) germanScore++;
  });

  const maxScore = Math.max(turkishScore, englishScore, germanScore);

  if (maxScore === germanScore && germanScore > 0) return 'de';
  if (maxScore === englishScore && englishScore > 0) return 'en';
  return 'tr';
}

/**
 * Vapi için dinamik prompt oluştur (tarih bilgisi ile)
 */
async function getVapiSystemPrompt(tenantId, language = 'tr') {
  const { systemPrompt, assistantName } = await getSystemPrompt(tenantId, language);

  // Türkçe tarih formatı
  const now = new Date();
  const turkishMonths = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const turkishDays = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  let dateInfo = '';
  if (language === 'tr') {
    dateInfo = `Bugünün tarihi: ${now.getDate()} ${turkishMonths[now.getMonth()]} ${now.getFullYear()}, ${turkishDays[now.getDay()]}`;
  } else if (language === 'de') {
    const germanMonths = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const germanDays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    dateInfo = `Heute ist: ${germanDays[now.getDay()]}, ${now.getDate()}. ${germanMonths[now.getMonth()]} ${now.getFullYear()}`;
  } else {
    dateInfo = `Today's date: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  }

  return `${systemPrompt}

## Güncel Bilgi:
${dateInfo}

## Önemli Kurallar:
- "Bir dakika", "Bekleyin" gibi bekleme ifadeleri kullanma
- Hemen cevap ver
- Sessizlik olmadan konuş`;
}

/**
 * Tenant'ın desteklediği dilleri getir
 */
async function getSupportedLanguages(tenantId) {
  const tenant = await tenantService.getTenantById(tenantId);
  return tenant?.supported_languages || ['tr'];
}

module.exports = {
  getSystemPrompt,
  getVapiSystemPrompt,
  getIndustryPreset,
  applyTemplateVariables,
  detectLanguage,
  getSupportedLanguages,
  getDefaultPrompt,
  getDefaultWelcome,
};
