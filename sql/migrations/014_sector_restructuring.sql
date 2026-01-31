-- Migration 014: Sector Restructuring
-- Beauty sektorunu ikiye ayir: beauty_salon ve hairdresser
-- Healthcare ve restaurant referanslarini temizle

-- =====================================================
-- 1. INDUSTRY_PRESETS: Yeni sektorler ekle
-- =====================================================

-- Beauty Salon preset ekle
INSERT INTO industry_presets (
  industry,
  name_tr, name_en, name_de,
  default_prompt_tr,
  default_prompt_en,
  default_prompt_de,
  default_welcome_tr,
  default_welcome_en,
  default_welcome_de,
  default_assistant_name_tr,
  default_assistant_name_en,
  default_assistant_name_de,
  default_functions,
  icon, color,
  is_active
) VALUES (
  'beauty_salon',
  'Guzellik Salonu', 'Beauty Salon', 'Schonheitssalon',
  'Sen {COMPANY_NAME} guzellik salonunun sesli asistanisin. Adin "{ASSISTANT_NAME}".

## Gorevlerin:
1. **Randevu Olusturma**: Cilt bakimi, manikur, pedikur, makyaj ve SPA hizmetleri icin randevu al
2. **Hizmet Bilgisi**: Sunulan hizmetler, sureler ve fiyatlar hakkinda bilgi ver
3. **Musaitlik Kontrolu**: Bos randevu saatlerini kontrol et

## Konusma Kurallari:
- Kisa ve net cumleler kur
- Samimi ama profesyonel ol
- Musterinin adini sor ve konusma boyunca kullan
- Bir seferde sadece bir bilgi iste
- Onay almadan randevu olusturma',

  'You are the voice assistant of {COMPANY_NAME} beauty salon. Your name is "{ASSISTANT_NAME}".

## Your Tasks:
1. **Create Appointments**: Book appointments for skin care, manicure, pedicure, makeup and SPA services
2. **Service Information**: Provide information about services, durations and prices
3. **Availability Check**: Check available appointment times

## Conversation Rules:
- Use short and clear sentences
- Be friendly but professional
- Ask for customer name and use it throughout
- Ask for only one piece of information at a time
- Never create appointment without confirmation',

  'Sie sind der Sprachassistent des Schonheitssalons {COMPANY_NAME}. Ihr Name ist "{ASSISTANT_NAME}".',

  'Merhaba, ben {ASSISTANT_NAME}, {COMPANY_NAME} guzellik salonu asistaniyim. Size nasil yardimci olabilirim? Cilt bakimi, manikur veya SPA randevusu icin buradayim.',
  'Hello, I am {ASSISTANT_NAME}, your {COMPANY_NAME} beauty salon assistant. How can I help you? I am here for skin care, manicure or SPA appointments.',
  'Hallo, ich bin {ASSISTANT_NAME}, Ihr Schonheitssalon-Assistent von {COMPANY_NAME}.',

  'Elif', 'Elif', 'Elif',

  '["get_beauty_services", "get_available_time_slots", "create_beauty_appointment", "get_my_appointments", "cancel_appointment", "reschedule_appointment", "get_business_info", "get_working_hours", "get_service_price", "get_active_promotions", "get_loyalty_points"]',
  '💅', '#EC4899',
  true
)
ON CONFLICT (industry) DO UPDATE SET
  name_tr = EXCLUDED.name_tr,
  name_en = EXCLUDED.name_en,
  name_de = EXCLUDED.name_de,
  default_prompt_tr = EXCLUDED.default_prompt_tr,
  default_prompt_en = EXCLUDED.default_prompt_en,
  default_welcome_tr = EXCLUDED.default_welcome_tr,
  default_welcome_en = EXCLUDED.default_welcome_en,
  default_assistant_name_tr = EXCLUDED.default_assistant_name_tr,
  default_functions = EXCLUDED.default_functions,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Hairdresser preset ekle
INSERT INTO industry_presets (
  industry,
  name_tr, name_en, name_de,
  default_prompt_tr,
  default_prompt_en,
  default_prompt_de,
  default_welcome_tr,
  default_welcome_en,
  default_welcome_de,
  default_assistant_name_tr,
  default_assistant_name_en,
  default_assistant_name_de,
  default_functions,
  icon, color,
  is_active
) VALUES (
  'hairdresser',
  'Kuafor', 'Hairdresser', 'Friseur',
  'Sen {COMPANY_NAME} kuaforunun sesli asistanisin. Adin "{ASSISTANT_NAME}".

## Gorevlerin:
1. **Randevu Olusturma**: Sac kesimi, boyama, fon hizmetleri icin randevu al
2. **Kuafor Secimi**: Musterinin tercih ettigi kuaforle randevu olustur (onemli!)
3. **Hizmet Bilgisi**: Sunulan hizmetler, sureler ve fiyatlar hakkinda bilgi ver
4. **Musteri Gecmisi**: Onceki randevulari ve stilleri hatirla

## Konusma Kurallari:
- Kisa ve net cumleler kur
- Samimi ama profesyonel ol
- Musterinin adini sor ve konusma boyunca kullan
- Kuafor tercihi olup olmadigini mutlaka sor
- Onay almadan randevu olusturma',

  'You are the voice assistant of {COMPANY_NAME} hairdresser. Your name is "{ASSISTANT_NAME}".

## Your Tasks:
1. **Create Appointments**: Book appointments for haircut, coloring and styling services
2. **Stylist Selection**: Create appointment with customer preferred stylist (important!)
3. **Service Information**: Provide information about services, durations and prices
4. **Customer History**: Remember previous appointments and styles

## Conversation Rules:
- Use short and clear sentences
- Be friendly but professional
- Ask for customer name and use it throughout
- Always ask if they have stylist preference
- Never create appointment without confirmation',

  'Sie sind der Sprachassistent des Friseursalons {COMPANY_NAME}. Ihr Name ist "{ASSISTANT_NAME}".',

  'Merhaba, ben {ASSISTANT_NAME}, {COMPANY_NAME} kuaforu asistaniyim. Size nasil yardimci olabilirim? Sac kesimi, boyama veya fon randevusu icin buradayim.',
  'Hello, I am {ASSISTANT_NAME}, your {COMPANY_NAME} hairdresser assistant. How can I help you? I am here for haircut, coloring or styling appointments.',
  'Hallo, ich bin {ASSISTANT_NAME}, Ihr Friseur-Assistent von {COMPANY_NAME}.',

  'Selin', 'Selin', 'Selin',

  '["get_hairdresser_services", "get_available_time_slots", "create_beauty_appointment", "get_my_appointments", "cancel_appointment", "reschedule_appointment", "get_business_info", "get_working_hours", "get_service_price", "get_available_staff", "book_with_staff", "get_customer_history"]',
  '✂️', '#8B5CF6',
  true
)
ON CONFLICT (industry) DO UPDATE SET
  name_tr = EXCLUDED.name_tr,
  name_en = EXCLUDED.name_en,
  name_de = EXCLUDED.name_de,
  default_prompt_tr = EXCLUDED.default_prompt_tr,
  default_prompt_en = EXCLUDED.default_prompt_en,
  default_welcome_tr = EXCLUDED.default_welcome_tr,
  default_welcome_en = EXCLUDED.default_welcome_en,
  default_assistant_name_tr = EXCLUDED.default_assistant_name_tr,
  default_functions = EXCLUDED.default_functions,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- =====================================================
-- 2. UPDATE USE_CASES CATEGORY: beauty -> beauty_salon
-- =====================================================

-- Alter category check constraint to include new values
ALTER TABLE use_cases DROP CONSTRAINT IF EXISTS use_cases_category_check;
ALTER TABLE use_cases ADD CONSTRAINT use_cases_category_check
  CHECK (category IN ('core', 'automotive', 'beauty', 'beauty_salon', 'hairdresser', 'addon'));

-- Update existing beauty use cases to beauty_salon
UPDATE use_cases
SET category = 'beauty_salon', updated_at = NOW()
WHERE category = 'beauty';

-- =====================================================
-- 3. HAIRDRESSER USE CASES EKLE
-- =====================================================

INSERT INTO use_cases (id, name_tr, name_en, description_tr, description_en, category, tools, prompt_section_tr, prompt_section_en, is_default, display_order, icon) VALUES
(
  'hairdresser_services',
  'Kuafor Hizmetleri',
  'Hairdresser Services',
  'Sac kesimi, boyama ve fon randevusu',
  'Haircut, coloring and styling appointments',
  'hairdresser',
  '["get_hairdresser_services", "create_beauty_appointment", "get_available_time_slots"]',
  '## Kuafor Randevusu
1. Istenen hizmeti ogren (sac kesimi, boyama, fon)
2. Kuafor tercihi olup olmadigini sor (onemli!)
3. Hizmet suresini ve fiyatini belirt
4. Musait saatleri sun
5. Randevu detaylarini onayla',
  '## Hairdresser Appointment
1. Learn the requested service (haircut, coloring, styling)
2. Ask if customer has stylist preference (important!)
3. Specify service duration and price
4. Present available times
5. Confirm appointment details',
  true,
  25,
  'Scissors'
)
ON CONFLICT (id) DO UPDATE SET
  name_tr = EXCLUDED.name_tr,
  name_en = EXCLUDED.name_en,
  description_tr = EXCLUDED.description_tr,
  description_en = EXCLUDED.description_en,
  category = EXCLUDED.category,
  tools = EXCLUDED.tools,
  prompt_section_tr = EXCLUDED.prompt_section_tr,
  prompt_section_en = EXCLUDED.prompt_section_en,
  is_default = EXCLUDED.is_default,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  updated_at = NOW();

-- Kuafor icin staff_selection use case'i (onemli!)
INSERT INTO use_cases (id, name_tr, name_en, description_tr, description_en, category, tools, prompt_section_tr, prompt_section_en, is_default, display_order, icon) VALUES
(
  'hairdresser_staff_selection',
  'Kuafor Secimi',
  'Stylist Selection',
  'Musterinin tercih ettigi kuaforle randevu (onemli!)',
  'Appointment with customers preferred stylist (important!)',
  'hairdresser',
  '["get_available_staff", "book_with_staff", "get_customer_history"]',
  '## Kuafor Secimi
1. Musterinin kuafor tercihi olup olmadigini sor
2. Musait kuaforleri listele (isim ve uzmanlik alanlari)
3. Secilen kuaforun musait saatlerini sun
4. Onceki randevulari hatirla (varsa)
5. Kuafor adiyla birlikte randevu olustur',
  '## Stylist Selection
1. Ask if customer has stylist preference
2. List available stylists (name and specialties)
3. Present available times for selected stylist
4. Remember previous appointments (if any)
5. Create appointment with stylist name',
  true,
  26,
  'Users'
)
ON CONFLICT (id) DO UPDATE SET
  name_tr = EXCLUDED.name_tr,
  name_en = EXCLUDED.name_en,
  description_tr = EXCLUDED.description_tr,
  description_en = EXCLUDED.description_en,
  category = EXCLUDED.category,
  tools = EXCLUDED.tools,
  prompt_section_tr = EXCLUDED.prompt_section_tr,
  prompt_section_en = EXCLUDED.prompt_section_en,
  is_default = EXCLUDED.is_default,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  updated_at = NOW();

-- =====================================================
-- 4. BEAUTY_SALON ONBOARDING CONFIG EKLE
-- =====================================================

UPDATE industry_presets
SET onboarding_config = '{
  "version": "1.0",
  "steps": [
    {
      "id": "company",
      "title": "Salon Bilgileri",
      "description": "Isletmeniz hakkinda temel bilgiler",
      "icon": "Building2",
      "required": true,
      "fields": [
        {
          "name": "name",
          "label": "Salon Adi",
          "type": "text",
          "placeholder": "Ornek: Guzellik Merkezi",
          "required": true,
          "validation": { "minLength": 2, "maxLength": 100 }
        },
        {
          "name": "phone",
          "label": "Telefon",
          "type": "tel",
          "placeholder": "+90 5XX XXX XX XX",
          "required": true
        },
        {
          "name": "email",
          "label": "Email",
          "type": "email",
          "placeholder": "info@salon.com",
          "required": true
        },
        {
          "name": "password",
          "label": "Sifre",
          "type": "password",
          "placeholder": "En az 6 karakter",
          "required": true,
          "validation": { "minLength": 6 }
        },
        {
          "name": "language",
          "label": "Dil",
          "type": "select",
          "required": true,
          "default": "tr",
          "options": [
            { "value": "tr", "label": "Turkce" },
            { "value": "en", "label": "English" }
          ]
        },
        {
          "name": "assistantName",
          "label": "Asistan Adi",
          "type": "select",
          "required": true,
          "default": "Elif",
          "options": [
            { "value": "Elif", "label": "Elif" },
            { "value": "Selin", "label": "Selin" },
            { "value": "Ayse", "label": "Ayse" }
          ],
          "allowCustom": true
        }
      ]
    },
    {
      "id": "catalog",
      "title": "Hizmetler",
      "description": "Cilt bakimi, manikur, makyaj ve SPA hizmetleri",
      "icon": "Sparkles",
      "required": false,
      "skippable": true,
      "skipLabel": "Varsayilan hizmetleri kullan",
      "type": "catalog",
      "catalogTable": "beauty_services",
      "csvSupport": true,
      "useDefaults": true,
      "fields": [
        {
          "name": "name",
          "label": "Hizmet Adi",
          "type": "text",
          "placeholder": "Cilt Bakimi",
          "required": true
        },
        {
          "name": "category",
          "label": "Kategori",
          "type": "select",
          "required": true,
          "options": [
            { "value": "nails", "label": "Tirnak Bakimi" },
            { "value": "skin", "label": "Cilt Bakimi" },
            { "value": "makeup", "label": "Makyaj" },
            { "value": "spa", "label": "SPA" },
            { "value": "other", "label": "Diger" }
          ]
        },
        {
          "name": "duration_minutes",
          "label": "Sure (dk)",
          "type": "number",
          "required": true,
          "default": 60
        },
        {
          "name": "price",
          "label": "Fiyat (TL)",
          "type": "currency",
          "required": false
        }
      ]
    },
    {
      "id": "hours",
      "title": "Calisma Saatleri",
      "description": "Haftalik calisma programiniz",
      "icon": "Clock",
      "required": true,
      "type": "working_hours",
      "component": "WorkingHours"
    },
    {
      "id": "voice",
      "title": "Ses Ayarlari",
      "description": "Asistan ses ve karsilama mesaji",
      "icon": "Mic",
      "required": true,
      "type": "voice_settings",
      "component": "VoiceSettings"
    },
    {
      "id": "test",
      "title": "Test & Aktivasyon",
      "description": "Asistani test edin ve aktif edin",
      "icon": "PhoneCall",
      "required": true,
      "type": "activation",
      "component": "TestActivation",
      "testScenarios": [
        "Cilt bakimi randevusu almak istiyorum",
        "Hangi guzellik hizmetleriniz var?",
        "Manikur fiyati ne kadar?",
        "Yarin saat 15:00 musait misiniz?"
      ]
    }
  ],
  "features": {
    "appointment": true,
    "service_inquiry": true,
    "price_inquiry": true,
    "promotions": true,
    "loyalty": true
  }
}'::jsonb
WHERE industry = 'beauty_salon';

-- =====================================================
-- 5. HAIRDRESSER ONBOARDING CONFIG EKLE
-- =====================================================

UPDATE industry_presets
SET onboarding_config = '{
  "version": "1.0",
  "steps": [
    {
      "id": "company",
      "title": "Kuafor Bilgileri",
      "description": "Isletmeniz hakkinda temel bilgiler",
      "icon": "Building2",
      "required": true,
      "fields": [
        {
          "name": "name",
          "label": "Kuafor Adi",
          "type": "text",
          "placeholder": "Ornek: Selin Kuafor",
          "required": true,
          "validation": { "minLength": 2, "maxLength": 100 }
        },
        {
          "name": "phone",
          "label": "Telefon",
          "type": "tel",
          "placeholder": "+90 5XX XXX XX XX",
          "required": true
        },
        {
          "name": "email",
          "label": "Email",
          "type": "email",
          "placeholder": "info@kuafor.com",
          "required": true
        },
        {
          "name": "password",
          "label": "Sifre",
          "type": "password",
          "placeholder": "En az 6 karakter",
          "required": true,
          "validation": { "minLength": 6 }
        },
        {
          "name": "language",
          "label": "Dil",
          "type": "select",
          "required": true,
          "default": "tr",
          "options": [
            { "value": "tr", "label": "Turkce" },
            { "value": "en", "label": "English" }
          ]
        },
        {
          "name": "assistantName",
          "label": "Asistan Adi",
          "type": "select",
          "required": true,
          "default": "Selin",
          "options": [
            { "value": "Selin", "label": "Selin" },
            { "value": "Elif", "label": "Elif" },
            { "value": "Ayse", "label": "Ayse" }
          ],
          "allowCustom": true
        }
      ]
    },
    {
      "id": "catalog",
      "title": "Hizmetler",
      "description": "Sac kesimi, boyama ve fon hizmetleri",
      "icon": "Scissors",
      "required": false,
      "skippable": true,
      "skipLabel": "Varsayilan hizmetleri kullan",
      "type": "catalog",
      "catalogTable": "beauty_services",
      "csvSupport": true,
      "useDefaults": true,
      "fields": [
        {
          "name": "name",
          "label": "Hizmet Adi",
          "type": "text",
          "placeholder": "Sac Kesimi",
          "required": true
        },
        {
          "name": "category",
          "label": "Kategori",
          "type": "select",
          "required": true,
          "options": [
            { "value": "haircut", "label": "Sac Kesimi" },
            { "value": "coloring", "label": "Boyama" },
            { "value": "styling", "label": "Fon & Sekillendirme" }
          ]
        },
        {
          "name": "duration_minutes",
          "label": "Sure (dk)",
          "type": "number",
          "required": true,
          "default": 45
        },
        {
          "name": "price",
          "label": "Fiyat (TL)",
          "type": "currency",
          "required": false
        }
      ]
    },
    {
      "id": "staff",
      "title": "Kuaforler",
      "description": "Calisan kuaforleriniz (onemli!)",
      "icon": "Users",
      "required": false,
      "skippable": true,
      "skipLabel": "Kuafor eklemeden devam et",
      "type": "catalog",
      "catalogTable": "staff_members",
      "fields": [
        {
          "name": "name",
          "label": "Isim",
          "type": "text",
          "placeholder": "Selin Yilmaz",
          "required": true
        },
        {
          "name": "phone",
          "label": "Telefon",
          "type": "tel",
          "required": false
        },
        {
          "name": "specializations",
          "label": "Uzmanlik Alanlari",
          "type": "multiselect",
          "required": false,
          "options": [
            { "value": "haircut", "label": "Sac Kesimi" },
            { "value": "coloring", "label": "Boyama" },
            { "value": "styling", "label": "Fon" },
            { "value": "bridal", "label": "Gelin Saci" }
          ]
        }
      ]
    },
    {
      "id": "hours",
      "title": "Calisma Saatleri",
      "description": "Haftalik calisma programiniz",
      "icon": "Clock",
      "required": true,
      "type": "working_hours",
      "component": "WorkingHours"
    },
    {
      "id": "voice",
      "title": "Ses Ayarlari",
      "description": "Asistan ses ve karsilama mesaji",
      "icon": "Mic",
      "required": true,
      "type": "voice_settings",
      "component": "VoiceSettings"
    },
    {
      "id": "test",
      "title": "Test & Aktivasyon",
      "description": "Asistani test edin ve aktif edin",
      "icon": "PhoneCall",
      "required": true,
      "type": "activation",
      "component": "TestActivation",
      "testScenarios": [
        "Sac kesimi randevusu almak istiyorum",
        "Hangi kuaforleriniz var?",
        "Sac boyama fiyati ne kadar?",
        "Yarin saat 14:00 musait misiniz?"
      ]
    }
  ],
  "features": {
    "appointment": true,
    "staff_selection": true,
    "price_inquiry": true,
    "customer_history": true
  }
}'::jsonb
WHERE industry = 'hairdresser';

-- =====================================================
-- 6. HEALTHCARE VE RESTAURANT PRESETLERINI DEAKTIF ET
-- =====================================================

UPDATE industry_presets
SET is_active = false, updated_at = NOW()
WHERE industry IN ('healthcare', 'restaurant');

-- =====================================================
-- 7. UPDATE SETUP FUNCTION FOR NEW INDUSTRIES
-- =====================================================

CREATE OR REPLACE FUNCTION setup_tenant_default_use_cases(p_tenant_id UUID, p_industry VARCHAR)
RETURNS void AS $$
DECLARE
  v_mapped_industry VARCHAR;
BEGIN
  -- Map legacy 'beauty' to 'beauty_salon' for use case lookup
  v_mapped_industry := CASE
    WHEN p_industry = 'beauty' THEN 'beauty_salon'
    ELSE p_industry
  END;

  INSERT INTO tenant_use_cases (tenant_id, use_case_id, enabled)
  SELECT p_tenant_id, uc.id, true
  FROM use_cases uc
  WHERE uc.is_default = true
  AND (
    uc.category = 'core'
    OR uc.category = v_mapped_industry
    OR (uc.category = 'addon' AND uc.is_default = true)
  )
  ON CONFLICT (tenant_id, use_case_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. MIGRATION LOG
-- =====================================================

-- Add comment for tracking
COMMENT ON TABLE industry_presets IS 'Industry presets: automotive, beauty_salon, hairdresser (healthcare/restaurant deactivated in migration 014)';
