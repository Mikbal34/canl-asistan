/**
 * VAPI Routes
 * VAPI webhook ve tool call endpoint'leri
 */

const express = require('express');
const router = express.Router();
const config = require('../config/env');

const { processFunctionCall, getFunctionDefinitions } = require('../prompts/functions');
const { saveCallLog } = require('../services/supabase');
const vapiService = require('../services/vapiService');
const { handleToolCall, verifyVapiWebhook, resolveTenantFromCall } = require('../handlers/vapiToolsHandler');

/**
 * VAPI Tools Endpoint - Server URL tool calls
 * POST /vapi/tools
 */
router.post('/tools', verifyVapiWebhook, handleToolCall);

/**
 * VAPI Webhook - Function call'lari ve assistant request isler
 * POST /vapi/webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    console.log('[Vapi] Webhook alindi:', JSON.stringify(body, null, 2));

    // Arayan numarasini al
    const customerPhone = body.call?.customer?.number || 'unknown';
    const messageType = body.message?.type;
    console.log(`[Vapi] Message type: ${messageType}, Arayan: ${customerPhone}`);

    // Debug: tool-calls için metadata konumunu bul
    if (messageType === 'tool-calls') {
      console.log(`[Vapi] Tool-calls metadata debug:`);
      console.log(`  - body.assistant?.metadata:`, body.assistant?.metadata);
      console.log(`  - body.call?.assistantOverrides?.metadata:`, body.call?.assistantOverrides?.metadata);
      console.log(`  - body.call?.assistant?.metadata:`, body.call?.assistant?.metadata);
    }

    // Tenant'i coz - call.assistantOverrides.metadata'yi da gonder
    const assistantInfo = body.assistant || body.call?.assistantOverrides || {};
    const tenant = await resolveTenantFromCall(body.call || {}, assistantInfo);
    console.log(`[Vapi] Resolved tenant:`, tenant?.id, tenant?.name);
    const tenantId = tenant?.id;
    const industry = tenant?.industry || 'automotive';

    // Vapi tool-call formati (server-side tools)
    if (body.message?.type === 'tool-calls') {
      const toolCalls = body.message.toolCalls || [];
      const results = [];

      for (const toolCall of toolCalls) {
        const { name, arguments: args } = toolCall.function;
        console.log(`[Vapi] Tool call: ${name}`, args);

        const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;

        // Musteri telefon numarasini ekle
        if (!parsedArgs.customer_phone && customerPhone !== 'unknown') {
          parsedArgs.customer_phone = customerPhone;
        }

        const result = await processFunctionCall(
          tenantId,
          industry,
          name,
          parsedArgs || {},
          customerPhone
        );

        console.log(`[Vapi] Tool sonuc:`, result);
        results.push({
          toolCallId: toolCall.id,
          result: JSON.stringify(result),
        });
      }

      return res.json({ results });
    }

    // Eski function-call formati
    if (body.message?.type === 'function-call') {
      const { name, parameters } = body.message.functionCall;
      console.log(`[Vapi] Function call: ${name}`, parameters);

      const params = parameters || {};
      if (!params.customer_phone && customerPhone !== 'unknown') {
        params.customer_phone = customerPhone;
      }

      const result = await processFunctionCall(
        tenantId,
        industry,
        name,
        params,
        customerPhone
      );

      console.log(`[Vapi] Function sonuc:`, result);
      return res.json({ result });
    }

    // Assistant request - Dinamik prompt ile yanit ver
    if (body.message?.type === 'assistant-request') {
      console.log('[Vapi] Assistant request alindi');
      return handleAssistantRequest(req, res, body, tenant);
    }

    // End of call report - Aramayi kaydet
    if (body.message?.type === 'end-of-call-report') {
      console.log('[Vapi] Arama bitti:', {
        callId: body.message.call?.id,
        reason: body.message.endedReason,
        summary: body.message.summary,
      });

      try {
        await saveCallLog(tenantId, {
          call: body.message.call,
          summary: body.message.summary,
          transcript: body.message.transcript,
          endedReason: body.message.endedReason,
        });
        console.log('[Vapi] Arama kaydi Supabase\'e kaydedildi');
      } catch (saveError) {
        console.error('[Vapi] Arama kaydi kaydetme hatasi:', saveError);
      }

      return res.json({ success: true });
    }

    // Bilinmeyen format
    console.log('[Vapi] Bilinmeyen mesaj tipi:', body.message?.type || 'unknown');
    return res.json({ success: true });

  } catch (error) {
    console.error('[Vapi] Webhook hatasi:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Assistant request handler
 * Tenant'a gore dinamik prompt olusturur
 */
async function handleAssistantRequest(req, res, body, tenant) {
  try {
    // Tarih bilgisi
    const today = new Date();
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const todayFormatted = today.toLocaleDateString('tr-TR', options);
    const todayISO = today.toISOString().split('T')[0];

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowFormatted = tomorrow.toLocaleDateString('tr-TR', options);
    const tomorrowISO = tomorrow.toISOString().split('T')[0];

    // Saat bilgisi
    const currentTime = today.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Dili belirle
    const language = body.call?.assistant?.metadata?.language ||
                     tenant?.default_language || 'tr';

    // Tenant varsa VAPI config'i al
    if (tenant) {
      const vapiConfig = await vapiService.getTenantVapiConfig(tenant.id, language);

      // System prompt'a tarih/saat ekle
      let systemPrompt = vapiConfig.merged.system_prompt || '';
      systemPrompt = systemPrompt
        .replace(/{TARIH}/g, todayFormatted)
        .replace(/{SAAT}/g, currentTime);

      // Function definitions
      const functions = getFunctionDefinitions(tenant.industry);

      return res.json({
        assistant: {
          model: {
            provider: 'openai',
            model: vapiConfig.merged.model || 'gpt-4o-mini',
            temperature: vapiConfig.merged.temperature || 0.7,
            systemPrompt: systemPrompt,
            functions: functions,
          },
          voice: {
            provider: vapiConfig.merged.voice_provider || 'elevenlabs',
            voiceId: vapiConfig.merged.voice_id,
            speed: vapiConfig.merged.voice_speed || 1.0,
          },
          firstMessage: vapiConfig.merged.first_message,
        },
      });
    }

    // Fallback: Tenant yoksa default prompt
    const dynamicPrompt = buildDefaultPrompt(todayFormatted, todayISO, tomorrowFormatted, tomorrowISO);

    return res.json({
      assistant: {
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0.7,
          systemPrompt: dynamicPrompt,
        },
      },
    });

  } catch (error) {
    console.error('[Vapi] Assistant request hatasi:', error);

    // Hata durumunda basit bir prompt don
    return res.json({
      assistant: {
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0.7,
          systemPrompt: 'Merhaba, size nasil yardimci olabilirim?',
        },
      },
    });
  }
}

/**
 * Default prompt olustur (tenant yoksa)
 */
function buildDefaultPrompt(todayFormatted, todayISO, tomorrowFormatted, tomorrowISO) {
  return `Sen Ayse'sin. Otomotiv bayisinde calisan samimi bir danisman. Telefonda DOGAL konus.

## TARIH
Bugun: ${todayFormatted} (${todayISO})
Yarin: ${tomorrowFormatted} (${tomorrowISO})

## KONUSMA TARZI
- Arkadasinla konusur gibi samimi ol
- "Tabii canim", "Harika", "Super", "Anladim" gibi ifadeler kullan
- ASLA liste yapma, ASLA "bir, iki, uc" diye sayma
- Her seferinde TEK bir soru sor
- Kisa cumleler kur

## SERVIS RANDEVUSU

Musteri servis istediginde soyle ilerle:

ADIM 1: "Tabii, yardimci olayim. Adinizi alabilir miyim?"
ADIM 2: "Memnun oldum [isim]. Arabanizin plakasi neydi?"
ADIM 3: "Tamam, peki ne gibi bir sikinti var aracta?"
ADIM 4: Sorunu anla, sonra "Anladim. Hangi gun uygun olur sizin icin?"
ADIM 5: Gun soyleyince saat sor: "Saat kac civari dusunuyorsunuz?"
ADIM 6: Ozet ver ve onayla: "[isim], [tarih] [saat]'e [sorun] icin kaydediyorum, uygun mu?"
ADIM 7: Onay gelince create_service_appointment cagir

## TEST SURUSU RANDEVUSU

Musteri test surusu istediginde:

ADIM 1: "Harika! Adinizi alabilir miyim?"
ADIM 2: "Memnun oldum. Hangi araci denemek istersiniz?"
ADIM 3: Arac secilince: "Guzel secim! Hangi gun musaitsiniz?"
ADIM 4: Saat sor
ADIM 5: Ozet ve onay al
ADIM 6: create_test_drive_appointment cagir

## ONEMLI KURALLAR

- Tarih formati: ${todayISO} seklinde YYYY-MM-DD
- "Bugun" derse: ${todayISO}
- "Yarin" derse: ${tomorrowISO}
- Onay almadan ISLEM YAPMA
- Bekleme cumlesi kullanma ("bir dakika", "bekleyin" YASAK)
- Tool cagirinca direkt sonuca gore cevap ver`;
}

/**
 * VAPI Assistant sync endpoint
 * POST /vapi/sync/:tenantId
 */
router.post('/sync/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    // API key kontrolu
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (apiKey !== process.env.INTERNAL_API_KEY && apiKey !== config.vapi.webhookSecret) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid API key required',
      });
    }

    const results = await vapiService.syncTenantToVapi(tenantId);

    res.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('[Vapi] Sync hatasi:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get tenant VAPI config
 * GET /vapi/config/:tenantId
 */
router.get('/config/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { language = 'tr' } = req.query;

    const config = await vapiService.getTenantVapiConfig(tenantId, language);

    res.json(config);
  } catch (error) {
    console.error('[Vapi] Get config hatasi:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health check
 * GET /vapi/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'vapi-webhook',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
