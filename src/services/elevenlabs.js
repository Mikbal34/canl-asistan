const config = require('../config/env');

/**
 * Metni sese dönüştürür (Streaming)
 * @param {string} text - Sese dönüştürülecek metin
 * @param {Function} onAudioChunk - Her ses parçası geldiğinde çağrılacak callback
 * @returns {Promise<void>}
 */
async function textToSpeechStream(text, onAudioChunk) {
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${config.elevenlabs.voiceId}/stream?output_format=ulaw_8000`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/basic',
          'Content-Type': 'application/json',
          'xi-api-key': config.elevenlabs.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5', // Daha hızlı model
          voice_settings: {
            stability: 0.3,
            similarity_boost: 0.8,
            style: 0.0,
            use_speaker_boost: true,
            speed: 1.15, // %15 daha hızlı konuşma
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API hatası: ${response.status}`);
    }

    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (onAudioChunk && value) {
        const base64Chunk = Buffer.from(value).toString('base64');
        onAudioChunk(base64Chunk);
      }
    }
  } catch (error) {
    console.error('[ElevenLabs] TTS Hatası:', error);
    throw error;
  }
}

/**
 * Metni sese dönüştürür (Tek seferde)
 * @param {string} text - Sese dönüştürülecek metin
 * @returns {Promise<Buffer>} Audio buffer
 */
async function textToSpeech(text) {
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${config.elevenlabs.voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': config.elevenlabs.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          output_format: 'ulaw_8000',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API hatası: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('[ElevenLabs] TTS Hatası:', error);
    throw error;
  }
}

/**
 * Mevcut sesleri listeler
 * @returns {Promise<Array>} Ses listesi
 */
async function listVoices() {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': config.elevenlabs.apiKey,
      },
    });
    const data = await response.json();
    return data.voices;
  } catch (error) {
    console.error('[ElevenLabs] Ses listesi hatası:', error);
    throw error;
  }
}

module.exports = {
  textToSpeechStream,
  textToSpeech,
  listVoices,
};
