-- Migration 006: Config-Driven Onboarding
-- Dinamik onboarding sistemi icin JSON config

-- ==========================================
-- INDUSTRY_PRESETS: Onboarding Config JSONB
-- ==========================================

ALTER TABLE industry_presets
  ADD COLUMN IF NOT EXISTS onboarding_config JSONB DEFAULT '{}';

-- ==========================================
-- AUTOMOTIVE ONBOARDING CONFIG
-- ==========================================

UPDATE industry_presets
SET onboarding_config = '{
  "version": "1.0",
  "steps": [
    {
      "id": "company",
      "title": "Firma Bilgileri",
      "description": "Isletmeniz hakkinda temel bilgiler",
      "icon": "Building2",
      "required": true,
      "fields": [
        {
          "name": "name",
          "label": "Firma Adi",
          "type": "text",
          "placeholder": "Ornek: Prestige Auto",
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
          "placeholder": "info@firma.com",
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
          "name": "address",
          "label": "Adres",
          "type": "textarea",
          "placeholder": "Isletme adresi",
          "required": false,
          "rows": 2
        },
        {
          "name": "language",
          "label": "Dil",
          "type": "select",
          "required": true,
          "default": "tr",
          "options": [
            { "value": "tr", "label": "Turkce" },
            { "value": "en", "label": "English" },
            { "value": "de", "label": "Deutsch" }
          ]
        },
        {
          "name": "assistantName",
          "label": "Asistan Adi",
          "type": "select",
          "required": true,
          "default": "Ayse",
          "options": [
            { "value": "Ayse", "label": "Ayse" },
            { "value": "Elif", "label": "Elif" },
            { "value": "Zeynep", "label": "Zeynep" }
          ],
          "allowCustom": true
        }
      ]
    },
    {
      "id": "catalog",
      "title": "Arac Katalogu",
      "description": "Sattaginiz veya servis verdiginiz araclar",
      "icon": "Car",
      "required": false,
      "skippable": true,
      "skipLabel": "Sonra ekleyecegim",
      "type": "catalog",
      "catalogTable": "vehicles",
      "csvSupport": true,
      "fields": [
        {
          "name": "brand",
          "label": "Marka",
          "type": "text",
          "placeholder": "Toyota",
          "required": true,
          "width": "25%"
        },
        {
          "name": "model",
          "label": "Model",
          "type": "text",
          "placeholder": "Corolla",
          "required": true,
          "width": "25%"
        },
        {
          "name": "year",
          "label": "Yil",
          "type": "number",
          "placeholder": "2024",
          "required": true,
          "width": "15%",
          "validation": { "min": 1990, "max": 2030 }
        },
        {
          "name": "color",
          "label": "Renk",
          "type": "text",
          "placeholder": "Beyaz",
          "required": false,
          "width": "15%"
        },
        {
          "name": "fuel_type",
          "label": "Yakit",
          "type": "select",
          "required": false,
          "width": "20%",
          "options": [
            { "value": "benzin", "label": "Benzin" },
            { "value": "dizel", "label": "Dizel" },
            { "value": "hibrit", "label": "Hibrit" },
            { "value": "elektrik", "label": "Elektrik" },
            { "value": "lpg", "label": "LPG" }
          ]
        },
        {
          "name": "transmission",
          "label": "Vites",
          "type": "select",
          "required": false,
          "options": [
            { "value": "otomatik", "label": "Otomatik" },
            { "value": "manuel", "label": "Manuel" }
          ]
        },
        {
          "name": "price",
          "label": "Fiyat",
          "type": "currency",
          "placeholder": "1.250.000",
          "required": false,
          "currency": "TRY"
        },
        {
          "name": "km",
          "label": "Kilometre",
          "type": "number",
          "placeholder": "0",
          "required": false
        },
        {
          "name": "is_available",
          "label": "Test Surusu Icin Musait",
          "type": "checkbox",
          "default": true,
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
        "Test surusu randevusu almak istiyorum",
        "Hangi araclariniz var?",
        "Yarin saat 14:00 musait misiniz?",
        "Servis randevusu almak istiyorum"
      ]
    }
  ],
  "features": {
    "test_drive": true,
    "service_appointment": true,
    "vehicle_inquiry": true,
    "price_inquiry": true
  }
}'::jsonb
WHERE industry = 'automotive';

-- ==========================================
-- BEAUTY ONBOARDING CONFIG
-- ==========================================

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
          "name": "address",
          "label": "Adres",
          "type": "textarea",
          "placeholder": "Salon adresi",
          "required": false,
          "rows": 2
        },
        {
          "name": "language",
          "label": "Dil",
          "type": "select",
          "required": true,
          "default": "tr",
          "options": [
            { "value": "tr", "label": "Turkce" },
            { "value": "en", "label": "English" },
            { "value": "de", "label": "Deutsch" }
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
      "description": "Sundugunuz guzellik hizmetleri",
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
          "required": true,
          "width": "30%"
        },
        {
          "name": "category",
          "label": "Kategori",
          "type": "select",
          "required": true,
          "width": "20%",
          "options": [
            { "value": "hair", "label": "Sac", "icon": "scissors" },
            { "value": "nails", "label": "Tirnak", "icon": "hand" },
            { "value": "skin", "label": "Cilt Bakimi", "icon": "sparkles" },
            { "value": "makeup", "label": "Makyaj", "icon": "palette" },
            { "value": "massage", "label": "Masaj", "icon": "heart" },
            { "value": "other", "label": "Diger", "icon": "star" }
          ]
        },
        {
          "name": "duration_minutes",
          "label": "Sure (dk)",
          "type": "select",
          "required": true,
          "width": "15%",
          "default": 60,
          "options": [
            { "value": 15, "label": "15 dk" },
            { "value": 30, "label": "30 dk" },
            { "value": 45, "label": "45 dk" },
            { "value": 60, "label": "1 saat" },
            { "value": 90, "label": "1.5 saat" },
            { "value": 120, "label": "2 saat" }
          ]
        },
        {
          "name": "price",
          "label": "Fiyat",
          "type": "currency",
          "placeholder": "250",
          "required": false,
          "width": "15%",
          "currency": "TRY"
        },
        {
          "name": "description",
          "label": "Aciklama",
          "type": "text",
          "placeholder": "Hizmet detayi",
          "required": false,
          "width": "20%"
        }
      ]
    },
    {
      "id": "staff",
      "title": "Personel",
      "description": "Calisanlariniz (opsiyonel)",
      "icon": "Users",
      "required": false,
      "skippable": true,
      "skipLabel": "Personel eklemeden devam et",
      "type": "catalog",
      "catalogTable": "staff_members",
      "fields": [
        {
          "name": "name",
          "label": "Isim",
          "type": "text",
          "placeholder": "Ayse Yilmaz",
          "required": true
        },
        {
          "name": "phone",
          "label": "Telefon",
          "type": "tel",
          "placeholder": "+90 5XX XXX XX XX",
          "required": false
        },
        {
          "name": "specializations",
          "label": "Uzmanlik Alanlari",
          "type": "multiselect",
          "required": false,
          "options": [
            { "value": "hair", "label": "Sac" },
            { "value": "nails", "label": "Tirnak" },
            { "value": "skin", "label": "Cilt" },
            { "value": "makeup", "label": "Makyaj" }
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
        "Hangi hizmetleriniz var?",
        "Yarin saat 15:00 musait misiniz?",
        "Manikur fiyati ne kadar?"
      ]
    }
  ],
  "features": {
    "appointment": true,
    "service_inquiry": true,
    "price_inquiry": true,
    "staff_selection": true
  }
}'::jsonb
WHERE industry = 'beauty';

-- ==========================================
-- HELPER FUNCTION: Get Onboarding Config
-- ==========================================

CREATE OR REPLACE FUNCTION get_onboarding_config(p_industry VARCHAR)
RETURNS JSONB AS $$
DECLARE
  v_config JSONB;
BEGIN
  SELECT onboarding_config INTO v_config
  FROM industry_presets
  WHERE industry = p_industry AND is_active = true;

  RETURN COALESCE(v_config, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Grant execute
GRANT EXECUTE ON FUNCTION get_onboarding_config(VARCHAR) TO service_role;

-- ==========================================
-- INDEX for faster config lookups
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_industry_presets_config
ON industry_presets USING gin (onboarding_config);
