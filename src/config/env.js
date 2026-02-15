require('dotenv').config();

module.exports = {
  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },

  // Deepgram
  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY,
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  // ElevenLabs
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
  },

  // VAPI
  vapi: {
    apiKey: process.env.VAPI_API_KEY,
    webhookSecret: process.env.VAPI_WEBHOOK_SECRET,
    serverUrl: process.env.VAPI_SERVER_URL || process.env.SERVER_URL,
  },

  // Verimor SIP Trunk
  verimor: {
    sipUsername: process.env.VERIMOR_SIP_USERNAME,
    sipPassword: process.env.VERIMOR_SIP_PASSWORD,
    sipServer: process.env.VERIMOR_SIP_SERVER || 'sip.verimor.com.tr',
    vapiCredentialId: process.env.VERIMOR_VAPI_CREDENTIAL_ID,
  },

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  // Server
  server: {
    port: process.env.PORT || 3000,
    url: process.env.SERVER_URL,
  },
};
