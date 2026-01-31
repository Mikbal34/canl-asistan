/**
 * Ses formatı dönüşüm yardımcıları
 */

/**
 * Twilio Media mesajından audio payload'ı çıkarır
 * @param {Object} message - Twilio WebSocket mesajı
 * @returns {string|null} Base64 encoded audio veya null
 */
function extractAudioFromTwilioMessage(message) {
  try {
    const data = JSON.parse(message);
    if (data.event === 'media' && data.media?.payload) {
      return data.media.payload;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Twilio'ya gönderilecek media mesajı oluşturur
 * @param {string} streamSid - Twilio stream SID
 * @param {string} audioBase64 - Base64 encoded audio
 * @returns {string} JSON string
 */
function createTwilioMediaMessage(streamSid, audioBase64) {
  return JSON.stringify({
    event: 'media',
    streamSid,
    media: {
      payload: audioBase64,
    },
  });
}

/**
 * Twilio'ya mark mesajı gönderir (ses bittiğinde bildirim için)
 * @param {string} streamSid - Twilio stream SID
 * @param {string} markName - Mark adı
 * @returns {string} JSON string
 */
function createTwilioMarkMessage(streamSid, markName) {
  return JSON.stringify({
    event: 'mark',
    streamSid,
    mark: {
      name: markName,
    },
  });
}

/**
 * Twilio'ya clear mesajı gönderir (kuyruktaki sesleri temizler)
 * @param {string} streamSid - Twilio stream SID
 * @returns {string} JSON string
 */
function createTwilioClearMessage(streamSid) {
  return JSON.stringify({
    event: 'clear',
    streamSid,
  });
}

/**
 * Audio buffer'ı chunk'lara böler
 * @param {Buffer} audioBuffer - Ses buffer'ı
 * @param {number} chunkSize - Chunk boyutu (byte)
 * @returns {Array<Buffer>} Chunk dizisi
 */
function splitAudioIntoChunks(audioBuffer, chunkSize = 640) {
  const chunks = [];
  for (let i = 0; i < audioBuffer.length; i += chunkSize) {
    chunks.push(audioBuffer.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Base64 string'i buffer'a çevirir
 * @param {string} base64 - Base64 encoded string
 * @returns {Buffer} Buffer
 */
function base64ToBuffer(base64) {
  return Buffer.from(base64, 'base64');
}

/**
 * Buffer'ı base64 string'e çevirir
 * @param {Buffer} buffer - Buffer
 * @returns {string} Base64 encoded string
 */
function bufferToBase64(buffer) {
  return buffer.toString('base64');
}

module.exports = {
  extractAudioFromTwilioMessage,
  createTwilioMediaMessage,
  createTwilioMarkMessage,
  createTwilioClearMessage,
  splitAudioIntoChunks,
  base64ToBuffer,
  bufferToBase64,
};
