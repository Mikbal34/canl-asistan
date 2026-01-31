const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const config = require('../config/env');

const deepgram = createClient(config.deepgram.apiKey);

/**
 * Deepgram realtime transcription bağlantısı oluşturur
 * @param {Function} onTranscript - Transcript geldiğinde çağrılacak callback
 * @param {Function} onError - Hata olduğunda çağrılacak callback
 * @returns {Object} Deepgram live connection
 */
function createLiveTranscription(onTranscript, onError) {
  const connection = deepgram.listen.live({
    model: 'nova-2',
    language: 'tr', // Türkçe ana dil
    smart_format: true,
    punctuate: true,
    interim_results: true,
    endpointing: 800, // 800ms sessizlik sonrası cümle bitir (daha doğal)
    utterance_end_ms: 1200,
    encoding: 'mulaw', // Twilio mulaw format
    sample_rate: 8000, // Twilio 8kHz
    channels: 1,
  });

  // Bağlantı açıldığında
  connection.on(LiveTranscriptionEvents.Open, () => {
    console.log('[Deepgram] Bağlantı açıldı');
  });

  // Transcript geldiğinde
  connection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const transcript = data.channel?.alternatives?.[0]?.transcript;
    const isFinal = data.is_final;
    const speechFinal = data.speech_final;

    if (transcript && transcript.trim()) {
      onTranscript({
        text: transcript,
        isFinal,
        speechFinal,
        confidence: data.channel?.alternatives?.[0]?.confidence || 0,
      });
    }
  });

  // Cümle sonlandığında (utterance end)
  connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
    onTranscript({
      text: '',
      isFinal: true,
      speechFinal: true,
      isUtteranceEnd: true,
    });
  });

  // Hata durumunda
  connection.on(LiveTranscriptionEvents.Error, (error) => {
    console.error('[Deepgram] Hata:', error);
    if (onError) onError(error);
  });

  // Bağlantı kapandığında
  connection.on(LiveTranscriptionEvents.Close, () => {
    console.log('[Deepgram] Bağlantı kapandı');
  });

  return connection;
}

/**
 * Deepgram bağlantısına ses verisi gönderir
 * @param {Object} connection - Deepgram live connection
 * @param {Buffer} audioData - Base64 encoded audio data
 */
function sendAudio(connection, audioData) {
  if (connection && connection.getReadyState() === 1) {
    const buffer = Buffer.from(audioData, 'base64');
    connection.send(buffer);
  }
}

/**
 * Deepgram bağlantısını kapatır
 * @param {Object} connection - Deepgram live connection
 */
function closeConnection(connection) {
  if (connection) {
    connection.finish();
  }
}

/**
 * Deepgram Aura TTS - Metni sese dönüştürür (Streaming)
 * @param {string} text - Sese dönüştürülecek metin
 * @param {Function} onAudioChunk - Her ses parçası geldiğinde çağrılacak callback
 * @returns {Promise<void>}
 */
async function textToSpeechStream(text, onAudioChunk) {
  try {
    const response = await fetch(
      'https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=mulaw&sample_rate=8000',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${config.deepgram.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Deepgram TTS hatası: ${response.status} - ${error}`);
    }

    const reader = response.body.getReader();
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (onAudioChunk && value) {
        const base64Chunk = Buffer.from(value).toString('base64');
        onAudioChunk(base64Chunk);
        chunkCount++;
      }
    }

    console.log(`[Deepgram TTS] "${text.substring(0, 30)}..." (${chunkCount} chunk)`);
  } catch (error) {
    console.error('[Deepgram TTS] Hata:', error);
    throw error;
  }
}

module.exports = {
  createLiveTranscription,
  sendAudio,
  closeConnection,
  textToSpeechStream,
};
