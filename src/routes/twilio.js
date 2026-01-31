const express = require('express');
const router = express.Router();
const config = require('../config/env');
const twilio = require('twilio');

const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);

/**
 * Test Arama - Twilio seni arasın
 * GET /voice/call-me?phone=+905xxxxxxxxx
 */
router.get('/call-me', async (req, res) => {
  const phoneNumber = req.query.phone;

  if (!phoneNumber) {
    return res.status(400).json({ error: 'phone parametresi gerekli. Örnek: /voice/call-me?phone=+905551234567' });
  }

  try {
    const call = await twilioClient.calls.create({
      url: `${config.server.url}/voice/voice`,
      to: phoneNumber,
      from: config.twilio.phoneNumber,
      statusCallback: `${config.server.url}/voice/status`,
    });

    console.log(`[Twilio] Arama başlatıldı: ${call.sid} -> ${phoneNumber}`);
    res.json({
      success: true,
      message: `${phoneNumber} numarası aranıyor...`,
      callSid: call.sid
    });
  } catch (error) {
    console.error('[Twilio] Arama hatası:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Twilio Webhook - Gelen aramayı karşılar
 * POST /voice
 */
router.post('/voice', (req, res) => {
  console.log('[Twilio] Gelen arama:', {
    from: req.body.From,
    to: req.body.To,
    callSid: req.body.CallSid,
  });

  // TwiML yanıtı oluştur - Media Streams başlat
  const serverUrl = config.server.url;
  const wsUrl = serverUrl.replace('https://', 'wss://').replace('http://', 'ws://');

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}/voice/stream">
      <Parameter name="callerNumber" value="${req.body.From || 'unknown'}" />
      <Parameter name="callSid" value="${req.body.CallSid}" />
    </Stream>
  </Connect>
</Response>`;

  res.type('text/xml');
  res.send(twiml);
});

/**
 * Twilio Status Callback - Arama durumu değişikliklerini izler
 * POST /voice/status
 */
router.post('/voice/status', (req, res) => {
  console.log('[Twilio] Arama durumu:', {
    callSid: req.body.CallSid,
    callStatus: req.body.CallStatus,
    callDuration: req.body.CallDuration,
  });

  res.sendStatus(200);
});

/**
 * Twilio Fallback - Hata durumunda
 * POST /voice/fallback
 */
router.post('/voice/fallback', (req, res) => {
  console.error('[Twilio] Fallback tetiklendi:', req.body);

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="tr-TR">Bir hata oluştu. Lütfen daha sonra tekrar arayın.</Say>
  <Hangup />
</Response>`;

  res.type('text/xml');
  res.send(twiml);
});

module.exports = router;
