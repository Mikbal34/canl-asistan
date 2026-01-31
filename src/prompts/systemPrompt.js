/**
 * AI asistan için sistem promptu - Multi-tenant
 * Bu dosya geriye dönük uyumluluk için korunmuştur
 * Yeni kod için src/services/promptService.js kullanın
 */

const promptService = require('../services/promptService');

/**
 * AI asistan için sistem promptu (Legacy)
 * @param {string} language - 'tr', 'en' veya 'de'
 * @returns {string} Sistem promptu
 */
function getSystemPrompt(language = 'tr') {
  return promptService.getDefaultPrompt(language);
}

/**
 * Dil algılama için basit kontrol
 * @param {string} text - Kontrol edilecek metin
 * @returns {string} 'tr', 'en' veya 'de'
 */
function detectLanguage(text) {
  return promptService.detectLanguage(text);
}

/**
 * Tenant için dinamik sistem promptu (Yeni)
 * @param {string} tenantId - Tenant ID
 * @param {string} language - Dil kodu
 * @returns {Promise<Object>} - { systemPrompt, welcomeMessage, assistantName }
 */
async function getTenantSystemPrompt(tenantId, language = 'tr') {
  return promptService.getSystemPrompt(tenantId, language);
}

/**
 * Vapi için dinamik sistem promptu (Tenant-aware)
 * @param {string} tenantId - Tenant ID
 * @param {string} language - Dil kodu
 * @returns {Promise<string>} - Tarih bilgisi eklenmiş sistem promptu
 */
async function getVapiSystemPrompt(tenantId, language = 'tr') {
  return promptService.getVapiSystemPrompt(tenantId, language);
}

module.exports = {
  getSystemPrompt,
  detectLanguage,
  getTenantSystemPrompt,
  getVapiSystemPrompt,
};
