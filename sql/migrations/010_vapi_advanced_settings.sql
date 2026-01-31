-- Migration: 010_vapi_advanced_settings.sql
-- Purpose: Add advanced VAPI settings with language-specific defaults
-- Date: 2026-01-29

-- ============================================
-- VAPI Advanced Settings Migration
-- ============================================

-- This migration updates the industry_presets config JSONB columns
-- to include advanced VAPI settings for voice, conversation, and recording

-- Note: JSONB columns already exist (config_tr, config_en, config_de)
-- We're adding default values for new advanced settings

-- ============================================
-- Update Automotive Preset with Advanced Settings
-- ============================================

UPDATE industry_presets
SET
  config_tr = config_tr || jsonb_build_object(
    -- Voice Settings (ElevenLabs specific)
    'voice_stability', 0.5,
    'voice_similarity_boost', 0.75,
    'voice_style', 0.0,
    'voice_use_speaker_boost', true,

    -- Transcriber Settings (Turkish)
    'transcriber_provider', 'deepgram',
    'transcriber_model', 'nova-2',
    'transcriber_language', 'tr',
    'transcriber_keywords', '["randevu", "test sürüşü", "servis", "araç"]'::jsonb,
    'transcriber_endpointing', 255,

    -- Conversation Settings (Turkish specific)
    'silence_timeout_seconds', 10,
    'max_duration_seconds', 1800,
    'response_delay_seconds', 0.4,
    'interruptions_enabled', true,
    'num_words_to_interrupt', 2,

    -- Backchannel Settings (Turkish)
    'backchannel_enabled', true,
    'backchannel_words', '["evet", "anlıyorum", "tabii", "tamam"]'::jsonb,

    -- Model Advanced Settings
    'emotion_recognition_enabled', true,
    'top_p', 0.95,
    'presence_penalty', 0,
    'frequency_penalty', 0,

    -- Recording Settings
    'recording_enabled', false,
    'hipaa_enabled', false,

    -- End Call Settings (Turkish)
    'end_call_message', 'Görüşmek üzere, iyi günler!',
    'end_call_phrases', '["hoşçakalın", "güle güle", "iyi günler", "görüşürüz"]'::jsonb
  ),

  config_en = config_en || jsonb_build_object(
    -- Voice Settings (ElevenLabs specific)
    'voice_stability', 0.5,
    'voice_similarity_boost', 0.75,
    'voice_style', 0.0,
    'voice_use_speaker_boost', true,

    -- Transcriber Settings (English)
    'transcriber_provider', 'deepgram',
    'transcriber_model', 'nova-2',
    'transcriber_language', 'en-US',
    'transcriber_keywords', '["appointment", "test drive", "service", "vehicle"]'::jsonb,
    'transcriber_endpointing', 255,

    -- Conversation Settings (English specific)
    'silence_timeout_seconds', 8,
    'max_duration_seconds', 1800,
    'response_delay_seconds', 0.2,
    'interruptions_enabled', true,
    'num_words_to_interrupt', 1,

    -- Backchannel Settings (English)
    'backchannel_enabled', true,
    'backchannel_words', '["yes", "I see", "okay", "right"]'::jsonb,

    -- Model Advanced Settings
    'emotion_recognition_enabled', true,
    'top_p', 0.95,
    'presence_penalty', 0,
    'frequency_penalty', 0,

    -- Recording Settings
    'recording_enabled', false,
    'hipaa_enabled', false,

    -- End Call Settings (English)
    'end_call_message', 'Thank you for calling. Goodbye!',
    'end_call_phrases', '["goodbye", "bye", "thanks", "see you"]'::jsonb
  ),

  config_de = config_de || jsonb_build_object(
    -- Voice Settings (ElevenLabs specific)
    'voice_stability', 0.6,
    'voice_similarity_boost', 0.75,
    'voice_style', 0.0,
    'voice_use_speaker_boost', true,

    -- Transcriber Settings (German)
    'transcriber_provider', 'deepgram',
    'transcriber_model', 'nova-2',
    'transcriber_language', 'de',
    'transcriber_keywords', '["Termin", "Probefahrt", "Service", "Fahrzeug"]'::jsonb,
    'transcriber_endpointing', 255,

    -- Conversation Settings (German specific)
    'silence_timeout_seconds', 10,
    'max_duration_seconds', 1800,
    'response_delay_seconds', 0.3,
    'interruptions_enabled', true,
    'num_words_to_interrupt', 2,

    -- Backchannel Settings (German)
    'backchannel_enabled', true,
    'backchannel_words', '["ja", "verstehe", "okay", "genau"]'::jsonb,

    -- Model Advanced Settings
    'emotion_recognition_enabled', true,
    'top_p', 0.95,
    'presence_penalty', 0,
    'frequency_penalty', 0,

    -- Recording Settings
    'recording_enabled', false,
    'hipaa_enabled', false,

    -- End Call Settings (German)
    'end_call_message', 'Vielen Dank für Ihren Anruf. Auf Wiedersehen!',
    'end_call_phrases', '["auf wiedersehen", "tschüss", "danke", "bis bald"]'::jsonb
  ),

  updated_at = NOW()
WHERE industry = 'automotive';

-- ============================================
-- Update Beauty Preset with Advanced Settings
-- ============================================

UPDATE industry_presets
SET
  config_tr = config_tr || jsonb_build_object(
    -- Voice Settings
    'voice_stability', 0.5,
    'voice_similarity_boost', 0.75,
    'voice_style', 0.0,
    'voice_use_speaker_boost', true,

    -- Conversation Settings (Turkish specific)
    'silence_timeout_seconds', 10,
    'max_duration_seconds', 1800,
    'response_delay_seconds', 0.4,
    'interruptions_enabled', true,
    'num_words_to_interrupt', 2,

    -- Backchannel Settings (Turkish)
    'backchannel_enabled', true,
    'backchannel_words', '["evet", "anlıyorum", "tabii", "tamam"]'::jsonb,

    -- Model Advanced Settings
    'emotion_recognition_enabled', true,
    'top_p', 0.95,
    'presence_penalty', 0,
    'frequency_penalty', 0,

    -- Recording Settings
    'recording_enabled', false,
    'hipaa_enabled', false,

    -- End Call Settings (Turkish)
    'end_call_message', 'Randevunuzda görüşmek üzere, iyi günler!',
    'end_call_phrases', '["hoşçakalın", "güle güle", "iyi günler", "görüşürüz"]'::jsonb
  ),

  config_en = config_en || jsonb_build_object(
    -- Voice Settings
    'voice_stability', 0.5,
    'voice_similarity_boost', 0.75,
    'voice_style', 0.0,
    'voice_use_speaker_boost', true,

    -- Conversation Settings (English specific)
    'silence_timeout_seconds', 8,
    'max_duration_seconds', 1800,
    'response_delay_seconds', 0.2,
    'interruptions_enabled', true,
    'num_words_to_interrupt', 1,

    -- Backchannel Settings (English)
    'backchannel_enabled', true,
    'backchannel_words', '["yes", "I see", "okay", "right"]'::jsonb,

    -- Model Advanced Settings
    'emotion_recognition_enabled', true,
    'top_p', 0.95,
    'presence_penalty', 0,
    'frequency_penalty', 0,

    -- Recording Settings
    'recording_enabled', false,
    'hipaa_enabled', false,

    -- End Call Settings (English)
    'end_call_message', 'See you at your appointment. Goodbye!',
    'end_call_phrases', '["goodbye", "bye", "thanks", "see you"]'::jsonb
  ),

  config_de = config_de || jsonb_build_object(
    -- Voice Settings
    'voice_stability', 0.6,
    'voice_similarity_boost', 0.75,
    'voice_style', 0.0,
    'voice_use_speaker_boost', true,

    -- Conversation Settings (German specific)
    'silence_timeout_seconds', 10,
    'max_duration_seconds', 1800,
    'response_delay_seconds', 0.3,
    'interruptions_enabled', true,
    'num_words_to_interrupt', 2,

    -- Backchannel Settings (German)
    'backchannel_enabled', true,
    'backchannel_words', '["ja", "verstehe", "okay", "genau"]'::jsonb,

    -- Model Advanced Settings
    'emotion_recognition_enabled', true,
    'top_p', 0.95,
    'presence_penalty', 0,
    'frequency_penalty', 0,

    -- Recording Settings
    'recording_enabled', false,
    'hipaa_enabled', false,

    -- End Call Settings (German)
    'end_call_message', 'Wir sehen uns bei Ihrem Termin. Auf Wiedersehen!',
    'end_call_phrases', '["auf wiedersehen", "tschüss", "danke", "bis bald"]'::jsonb
  ),

  updated_at = NOW()
WHERE industry = 'beauty';

-- ============================================
-- Add default advanced settings to any other presets
-- ============================================

UPDATE industry_presets
SET
  config_tr = COALESCE(config_tr, '{}'::jsonb) || jsonb_build_object(
    'voice_stability', 0.5,
    'voice_similarity_boost', 0.75,
    'voice_style', 0.0,
    'voice_use_speaker_boost', true,
    'silence_timeout_seconds', 10,
    'max_duration_seconds', 1800,
    'response_delay_seconds', 0.4,
    'interruptions_enabled', true,
    'num_words_to_interrupt', 2,
    'backchannel_enabled', true,
    'backchannel_words', '["evet", "anlıyorum", "tabii", "tamam"]'::jsonb,
    'emotion_recognition_enabled', true,
    'top_p', 0.95,
    'presence_penalty', 0,
    'frequency_penalty', 0,
    'recording_enabled', false,
    'hipaa_enabled', false,
    'end_call_message', 'İyi günler!',
    'end_call_phrases', '["hoşçakalın", "güle güle"]'::jsonb
  ),

  config_en = COALESCE(config_en, '{}'::jsonb) || jsonb_build_object(
    'voice_stability', 0.5,
    'voice_similarity_boost', 0.75,
    'voice_style', 0.0,
    'voice_use_speaker_boost', true,
    'silence_timeout_seconds', 8,
    'max_duration_seconds', 1800,
    'response_delay_seconds', 0.2,
    'interruptions_enabled', true,
    'num_words_to_interrupt', 1,
    'backchannel_enabled', true,
    'backchannel_words', '["yes", "I see", "okay"]'::jsonb,
    'emotion_recognition_enabled', true,
    'top_p', 0.95,
    'presence_penalty', 0,
    'frequency_penalty', 0,
    'recording_enabled', false,
    'hipaa_enabled', false,
    'end_call_message', 'Goodbye!',
    'end_call_phrases', '["goodbye", "bye"]'::jsonb
  ),

  config_de = COALESCE(config_de, '{}'::jsonb) || jsonb_build_object(
    'voice_stability', 0.6,
    'voice_similarity_boost', 0.75,
    'voice_style', 0.0,
    'voice_use_speaker_boost', true,
    'silence_timeout_seconds', 10,
    'max_duration_seconds', 1800,
    'response_delay_seconds', 0.3,
    'interruptions_enabled', true,
    'num_words_to_interrupt', 2,
    'backchannel_enabled', true,
    'backchannel_words', '["ja", "verstehe", "okay"]'::jsonb,
    'emotion_recognition_enabled', true,
    'top_p', 0.95,
    'presence_penalty', 0,
    'frequency_penalty', 0,
    'recording_enabled', false,
    'hipaa_enabled', false,
    'end_call_message', 'Auf Wiedersehen!',
    'end_call_phrases', '["auf wiedersehen", "tschüss"]'::jsonb
  ),

  updated_at = NOW()
WHERE industry NOT IN ('automotive', 'beauty');

-- ============================================
-- Verification query (optional - for checking)
-- ============================================
-- SELECT industry,
--        config_tr->'voice_stability' as tr_stability,
--        config_tr->'backchannel_words' as tr_backchannel,
--        config_en->'silence_timeout_seconds' as en_timeout
-- FROM industry_presets;
