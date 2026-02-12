-- =============================================
-- TÜRKÇE TELAFFUZ TALİMATI
-- Sayı ve model kodlarının Türkçe okunması için
-- =============================================
-- Problem: ElevenLabs eleven_multilingual_v2 modeli "320i", "A6" gibi
-- alfanumerik kodları İngilizce telaffuzla okuyor
-- Çözüm: System prompt'a Türkçe telaffuz talimatı ekle

-- Automotive preset için Türkçe config güncelle
UPDATE industry_presets
SET config_tr = jsonb_set(
  config_tr,
  '{system_prompt}',
  to_jsonb(
    config_tr->>'system_prompt' || E'\n\n## Sayı ve Model Kodları\n- Araç model kodlarını ve sayıları Türkçe telaffuzla oku\n- Örnek: "320i" → "üç yirmi i", "A6" → "a altı", "520d" → "beş yirmi d"\n- Tarihleri ve saatleri Türkçe formatında söyle'
  )
)
WHERE industry = 'automotive'
  AND config_tr->>'system_prompt' IS NOT NULL
  AND config_tr->>'system_prompt' NOT LIKE '%Sayı ve Model Kodları%';

-- Beauty/wellness için de aynı talimatı ekle (ürün kodları için)
UPDATE industry_presets
SET config_tr = jsonb_set(
  config_tr,
  '{system_prompt}',
  to_jsonb(
    config_tr->>'system_prompt' || E'\n\n## Sayı ve Kodlar\n- Ürün kodlarını ve sayıları Türkçe telaffuzla oku\n- Tarihleri ve saatleri Türkçe formatında söyle'
  )
)
WHERE industry = 'beauty'
  AND config_tr->>'system_prompt' IS NOT NULL
  AND config_tr->>'system_prompt' NOT LIKE '%Sayı ve Kodlar%';

-- Healthcare için
UPDATE industry_presets
SET config_tr = jsonb_set(
  config_tr,
  '{system_prompt}',
  to_jsonb(
    config_tr->>'system_prompt' || E'\n\n## Sayı ve Kodlar\n- Randevu numaralarını ve kodları Türkçe telaffuzla oku\n- Tarihleri ve saatleri Türkçe formatında söyle'
  )
)
WHERE industry = 'healthcare'
  AND config_tr->>'system_prompt' IS NOT NULL
  AND config_tr->>'system_prompt' NOT LIKE '%Sayı ve Kodlar%';

-- Restaurant için
UPDATE industry_presets
SET config_tr = jsonb_set(
  config_tr,
  '{system_prompt}',
  to_jsonb(
    config_tr->>'system_prompt' || E'\n\n## Sayı ve Kodlar\n- Rezervasyon numaralarını ve fiyatları Türkçe telaffuzla oku\n- Tarihleri ve saatleri Türkçe formatında söyle'
  )
)
WHERE industry = 'restaurant'
  AND config_tr->>'system_prompt' IS NOT NULL
  AND config_tr->>'system_prompt' NOT LIKE '%Sayı ve Kodlar%';

-- Real estate için
UPDATE industry_presets
SET config_tr = jsonb_set(
  config_tr,
  '{system_prompt}',
  to_jsonb(
    config_tr->>'system_prompt' || E'\n\n## Sayı ve Kodlar\n- Gayrimenkul kodlarını, fiyatları ve metrekareleri Türkçe telaffuzla oku\n- Tarihleri ve saatleri Türkçe formatında söyle'
  )
)
WHERE industry = 'real_estate'
  AND config_tr->>'system_prompt' IS NOT NULL
  AND config_tr->>'system_prompt' NOT LIKE '%Sayı ve Kodlar%';

-- Default preset için (eğer varsa)
UPDATE industry_presets
SET config_tr = jsonb_set(
  config_tr,
  '{system_prompt}',
  to_jsonb(
    config_tr->>'system_prompt' || E'\n\n## Sayı ve Kodlar\n- Tüm sayıları ve kodları Türkçe telaffuzla oku\n- Tarihleri ve saatleri Türkçe formatında söyle'
  )
)
WHERE industry = 'default'
  AND config_tr->>'system_prompt' IS NOT NULL
  AND config_tr->>'system_prompt' NOT LIKE '%Sayı ve Kodlar%';
