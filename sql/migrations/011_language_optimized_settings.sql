-- Migration: 011_language_optimized_settings.sql
-- Purpose: Dil bazlı doğal konuşma optimizasyonları
-- Date: 2026-01-29
--
-- Bu migration, TR/EN/DE dilleri ve sektörler için optimal konuşma
-- deneyimi sağlayacak ayarları içerir.
--
-- Referans: Dil Bazlı Doğal Konuşma Optimizasyonu planı

-- ============================================
-- KUAFÖR/GÜZELLİK (BEAUTY) PRESET - Samimi/Arkadaşça Ton
-- ============================================

UPDATE industry_presets
SET
  config_tr = config_tr || jsonb_build_object(
    -- Voice Settings - Biraz yavaş, samimi
    'voice_speed', 0.95,
    'voice_stability', 0.4,       -- Daha değişken = daha doğal
    'voice_style', 0.3,           -- Biraz ifadeli

    -- Conversation Settings - Türkçe için optimize
    'silence_timeout_seconds', 8, -- Kısa bekleme
    'response_delay_seconds', 0.5, -- Doğal düşünme süresi
    'num_words_to_interrupt', 3,  -- Zor kesme (3+ kelime)

    -- Transcriber Settings - Türkçe cümleler için
    'transcriber_endpointing', 280, -- Türkçe için biraz uzun

    -- AI Settings - Daha yaratıcı/samimi cevaplar
    'temperature', 0.8
  ),

  config_en = config_en || jsonb_build_object(
    -- Voice Settings - Normal hız
    'voice_speed', 1.0,
    'voice_stability', 0.45,      -- Biraz değişken
    'voice_style', 0.2,           -- Hafif ifadeli

    -- Conversation Settings - İngilizce için optimize
    'silence_timeout_seconds', 6, -- Kısa
    'response_delay_seconds', 0.4, -- Doğal
    'num_words_to_interrupt', 2,  -- İngilizce daha kısa

    -- Transcriber Settings - İngilizce net bitiyor
    'transcriber_endpointing', 220,

    -- AI Settings - Samimi ama tutarlı
    'temperature', 0.75
  ),

  config_de = config_de || jsonb_build_object(
    -- Voice Settings - Yavaş, anlaşılır
    'voice_speed', 0.9,
    'voice_stability', 0.5,       -- Tutarlı
    'voice_style', 0.15,          -- Minimal ifade

    -- Conversation Settings - Almanca için optimize
    'silence_timeout_seconds', 8, -- Orta
    'response_delay_seconds', 0.45, -- Doğal
    'num_words_to_interrupt', 3,  -- Almanca uzun kelimeler

    -- Transcriber Settings - Uzun kelime bitişleri
    'transcriber_endpointing', 300,

    -- AI Settings - Tutarlı
    'temperature', 0.7
  ),

  updated_at = NOW()
WHERE industry = 'beauty';

-- ============================================
-- OTOMOTİV (AUTOMOTIVE) PRESET - Profesyonel/Güven Veren Ton
-- ============================================

UPDATE industry_presets
SET
  config_tr = config_tr || jsonb_build_object(
    -- Voice Settings - Normal, profesyonel
    'voice_speed', 1.0,
    'voice_stability', 0.55,      -- Tutarlı ses
    'voice_style', 0.1,           -- Minimal ifade, ciddi

    -- Conversation Settings - Türkçe için optimize
    'silence_timeout_seconds', 8, -- Kısa bekleme
    'response_delay_seconds', 0.45, -- Doğal
    'num_words_to_interrupt', 3,  -- Zor kesme

    -- Transcriber Settings - Türkçe için
    'transcriber_endpointing', 280,

    -- AI Settings - Tutarlı, profesyonel
    'temperature', 0.7
  ),

  config_en = config_en || jsonb_build_object(
    -- Voice Settings - Biraz hızlı, profesyonel
    'voice_speed', 1.05,
    'voice_stability', 0.55,      -- Tutarlı
    'voice_style', 0.05,          -- Çok minimal

    -- Conversation Settings - İngilizce için optimize
    'silence_timeout_seconds', 6, -- Kısa
    'response_delay_seconds', 0.4, -- Hızlı ama doğal
    'num_words_to_interrupt', 2,

    -- Transcriber Settings
    'transcriber_endpointing', 200,

    -- AI Settings - Çok tutarlı
    'temperature', 0.65
  ),

  config_de = config_de || jsonb_build_object(
    -- Voice Settings - Yavaş, güvenilir
    'voice_speed', 0.95,
    'voice_stability', 0.6,       -- Çok tutarlı
    'voice_style', 0.0,           -- Tamamen nötr

    -- Conversation Settings - Almanca için optimize
    'silence_timeout_seconds', 8, -- Orta
    'response_delay_seconds', 0.5, -- Düşünceli
    'num_words_to_interrupt', 3,

    -- Transcriber Settings
    'transcriber_endpointing', 300,

    -- AI Settings - Çok tutarlı/resmi
    'temperature', 0.6
  ),

  updated_at = NOW()
WHERE industry = 'automotive';

-- ============================================
-- DİĞER SEKTÖRLER İÇİN VARSAYILAN DEĞERLER
-- (Beauty preset'e benzer - samimi ton)
-- ============================================

UPDATE industry_presets
SET
  config_tr = config_tr || jsonb_build_object(
    'voice_speed', 0.95,
    'voice_stability', 0.45,
    'voice_style', 0.2,
    'silence_timeout_seconds', 8,
    'response_delay_seconds', 0.5,
    'num_words_to_interrupt', 3,
    'transcriber_endpointing', 280,
    'temperature', 0.75
  ),

  config_en = config_en || jsonb_build_object(
    'voice_speed', 1.0,
    'voice_stability', 0.5,
    'voice_style', 0.15,
    'silence_timeout_seconds', 6,
    'response_delay_seconds', 0.4,
    'num_words_to_interrupt', 2,
    'transcriber_endpointing', 220,
    'temperature', 0.7
  ),

  config_de = config_de || jsonb_build_object(
    'voice_speed', 0.9,
    'voice_stability', 0.55,
    'voice_style', 0.1,
    'silence_timeout_seconds', 8,
    'response_delay_seconds', 0.45,
    'num_words_to_interrupt', 3,
    'transcriber_endpointing', 300,
    'temperature', 0.65
  ),

  updated_at = NOW()
WHERE industry NOT IN ('automotive', 'beauty');

-- ============================================
-- ÖZET: DİL VE SEKTÖR BAZLI OPTİMAL AYARLAR
-- ============================================
--
-- KUAFÖR (BEAUTY) - Samimi/Arkadaşça:
-- +------+-------+----------+-------+---------+--------+--------+------------+------+
-- | Dil  | Speed | Stability| Style | Timeout | Delay  | Words  | Endpointing| Temp |
-- +------+-------+----------+-------+---------+--------+--------+------------+------+
-- | TR   | 0.95  | 0.40     | 0.30  | 8s      | 0.50s  | 3      | 280ms      | 0.80 |
-- | EN   | 1.00  | 0.45     | 0.20  | 6s      | 0.40s  | 2      | 220ms      | 0.75 |
-- | DE   | 0.90  | 0.50     | 0.15  | 8s      | 0.45s  | 3      | 300ms      | 0.70 |
-- +------+-------+----------+-------+---------+--------+--------+------------+------+
--
-- OTOMOTİV (AUTOMOTIVE) - Profesyonel:
-- +------+-------+----------+-------+---------+--------+--------+------------+------+
-- | Dil  | Speed | Stability| Style | Timeout | Delay  | Words  | Endpointing| Temp |
-- +------+-------+----------+-------+---------+--------+--------+------------+------+
-- | TR   | 1.00  | 0.55     | 0.10  | 8s      | 0.45s  | 3      | 280ms      | 0.70 |
-- | EN   | 1.05  | 0.55     | 0.05  | 6s      | 0.40s  | 2      | 200ms      | 0.65 |
-- | DE   | 0.95  | 0.60     | 0.00  | 8s      | 0.50s  | 3      | 300ms      | 0.60 |
-- +------+-------+----------+-------+---------+--------+--------+------------+------+
--
-- NOTLAR:
-- - TR: Türkçe'de heceler uzun, yavaşlatmak doğallık katar
-- - EN: İngilizce doğal konuşma daha hızlı
-- - DE: Almanca'da uzun bileşik kelimeler var, yavaş daha anlaşılır
-- - Beauty: Daha değişken ses (düşük stability) = daha samimi
-- - Automotive: Daha tutarlı ses (yüksek stability) = daha profesyonel

-- ============================================
-- Verification Query
-- ============================================
-- SELECT
--   industry,
--   config_tr->>'voice_speed' as tr_speed,
--   config_tr->>'voice_stability' as tr_stability,
--   config_tr->>'temperature' as tr_temp,
--   config_en->>'voice_speed' as en_speed,
--   config_en->>'temperature' as en_temp,
--   config_de->>'voice_speed' as de_speed,
--   config_de->>'temperature' as de_temp
-- FROM industry_presets;
