/**
 * VAPI Tools Handler
 * VAPI server URL tool calls handler (multi-tenant, industry-aware)
 */

const { processFunctionCall } = require('../prompts/functions');
const vapiService = require('../services/vapiService');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

// Service role client - RLS'i bypass eder (VAPI tool calls icin gerekli)
const supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceRoleKey);

/**
 * Tenant'i cagri bilgisinden coz
 * @param {Object} callInfo - VAPI call bilgisi
 * @param {Object} assistantInfo - VAPI assistant bilgisi (body.assistant)
 */
async function resolveTenantFromCall(callInfo, assistantInfo = null) {
  // 1. Body.assistant'dan ID ile tenant bul (en güvenilir)
  if (assistantInfo?.id) {
    console.log('[VapiTools] Trying to find tenant by body.assistant.id:', assistantInfo.id);
    const tenant = await vapiService.getTenantByVapiAssistant(assistantInfo.id);
    if (tenant) {
      console.log('[VapiTools] Found tenant by assistant ID:', tenant.id, tenant.name);
      return tenant;
    }
  }

  // 2. Body.assistant.metadata'dan tenant ID al
  if (assistantInfo?.metadata?.tenantId) {
    console.log('[VapiTools] Trying to find tenant by assistant metadata:', assistantInfo.metadata.tenantId);
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', assistantInfo.metadata.tenantId)
      .single();

    if (!error && tenant) {
      console.log('[VapiTools] Found tenant by metadata:', tenant.id, tenant.name);
      return tenant;
    }
  }

  // 3. call.assistantOverrides.metadata'dan tenant ID al (VAPI webhook format)
  const overridesTenantId = callInfo.assistantOverrides?.metadata?.tenantId;
  if (overridesTenantId) {
    console.log('[VapiTools] Trying to find tenant by assistantOverrides:', overridesTenantId);
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', overridesTenantId)
      .single();

    if (!error && tenant) {
      console.log('[VapiTools] Found tenant by assistantOverrides:', tenant.id, tenant.name);
      return tenant;
    }
  }

  // 4. callInfo.assistantId ile tenant bul
  if (callInfo.assistantId) {
    console.log('[VapiTools] Trying callInfo.assistantId:', callInfo.assistantId);
    const tenant = await vapiService.getTenantByVapiAssistant(callInfo.assistantId);
    if (tenant) {
      console.log('[VapiTools] Found tenant by callInfo.assistantId:', tenant.id, tenant.name);
      return tenant;
    }
  }

  // 5. call.assistant.id ile tenant bul
  if (callInfo.assistant?.id) {
    console.log('[VapiTools] Trying call.assistant.id:', callInfo.assistant.id);
    const tenant = await vapiService.getTenantByVapiAssistant(callInfo.assistant.id);
    if (tenant) {
      console.log('[VapiTools] Found tenant by call.assistant.id:', tenant.id, tenant.name);
      return tenant;
    }
  }

  console.log('[VapiTools] No tenant found by any method');
  return null;
}

/**
 * Dil kodunu cagri bilgisinden coz
 * @param {Object} callInfo - VAPI call bilgisi
 * @param {Object} tenant - Tenant bilgisi
 */
function resolveLanguageFromCall(callInfo, tenant) {
  // 1. Metadata'dan dil al
  if (callInfo.assistant?.metadata?.language) {
    return callInfo.assistant.metadata.language;
  }

  // 2. Tenant default dili
  if (tenant?.default_language) {
    return tenant.default_language;
  }

  // 3. Fallback
  return 'tr';
}

/**
 * VAPI tool call'i isle
 * POST /vapi/tools
 */
async function handleToolCall(req, res) {
  try {
    const body = req.body;
    console.log('[VapiTools] Tool call alindi:', JSON.stringify(body, null, 2));

    // VAPI message tipini kontrol et
    const messageType = body.message?.type;

    if (messageType === 'tool-calls') {
      return handleToolCalls(req, res, body);
    }

    if (messageType === 'function-call') {
      return handleFunctionCall(req, res, body);
    }

    // Direkt tool call formati (server URL)
    if (body.function || body.toolCall) {
      return handleDirectToolCall(req, res, body);
    }

    console.log('[VapiTools] Bilinmeyen format:', messageType || 'unknown');
    return res.json({ success: true });

  } catch (error) {
    console.error('[VapiTools] Handler hatasi:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Tool-calls formatini isle (yeni VAPI formati)
 */
async function handleToolCalls(req, res, body) {
  const toolCalls = body.message?.toolCalls || [];
  const callInfo = body.call || {};
  const assistantInfo = body.assistant || {};
  const customerPhone = callInfo.customer?.number || 'unknown';

  // Debug: Request bilgilerini logla
  console.log('[VapiTools] handleToolCalls - query:', req.query);
  console.log('[VapiTools] handleToolCalls - x-tenant-id header:', req.headers['x-tenant-id']);

  // Tenant'i coz
  let tenant = await resolveTenantFromCall(callInfo, assistantInfo);

  // Query parameter'dan tenant ID kontrol et (supabaseAdmin ile RLS bypass)
  if (!tenant && req.query?.tenantId) {
    console.log('[VapiTools] DEBUG: Trying query param tenantId:', req.query.tenantId);
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', req.query.tenantId)
      .single();

    console.log('[VapiTools] DEBUG: Supabase query result:', {
      data: data ? { id: data.id, name: data.name } : null,
      error: error
    });

    if (!error && data) {
      console.log('[VapiTools] Found tenant by query param:', data.id, data.name);
      tenant = data;
    } else if (error) {
      console.error('[VapiTools] DEBUG: Supabase error:', error);
    }
  }

  // Header'dan tenant ID kontrol et (fallback)
  if (!tenant && req.headers['x-tenant-id']) {
    console.log('[VapiTools] DEBUG: Trying header x-tenant-id:', req.headers['x-tenant-id']);
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', req.headers['x-tenant-id'])
      .single();

    if (!error && data) {
      console.log('[VapiTools] Found tenant by header:', data.id, data.name);
      tenant = data;
    }
  }

  if (!tenant) {
    console.error('[VapiTools] Tenant bulunamadi - tum yontemler denendi');
    return res.json({
      results: toolCalls.map(tc => ({
        toolCallId: tc.id,
        result: JSON.stringify({
          success: false,
          error: 'tenant_not_found',
          message: 'Tenant bulunamadi',
        }),
      })),
    });
  }

  const results = [];

  for (const toolCall of toolCalls) {
    const { name, arguments: args } = toolCall.function;
    console.log(`[VapiTools] Tool call: ${name}`, args);

    const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;

    // Musteri telefon numarasini ekle
    if (!parsedArgs.customer_phone && customerPhone !== 'unknown') {
      parsedArgs.customer_phone = customerPhone;
    }

    // Function call'i isle
    const result = await processFunctionCall(
      tenant.id,
      tenant.industry,
      name,
      parsedArgs || {},
      customerPhone
    );

    console.log(`[VapiTools] Tool sonuc:`, result);
    results.push({
      toolCallId: toolCall.id,
      result: JSON.stringify(result),
    });
  }

  return res.json({ results });
}

/**
 * Eski function-call formatini isle
 */
async function handleFunctionCall(req, res, body) {
  const { name, parameters } = body.message?.functionCall || {};
  const callInfo = body.call || {};
  const assistantInfo = body.assistant || {};
  const customerPhone = callInfo.customer?.number || 'unknown';

  // Tenant'i coz
  const tenant = await resolveTenantFromCall(callInfo, assistantInfo);
  if (!tenant) {
    console.error('[VapiTools] Tenant bulunamadi');
    return res.json({
      result: JSON.stringify({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant bulunamadi',
      }),
    });
  }

  console.log(`[VapiTools] Function call: ${name}`, parameters);

  const params = parameters || {};
  if (!params.customer_phone && customerPhone !== 'unknown') {
    params.customer_phone = customerPhone;
  }

  const result = await processFunctionCall(
    tenant.id,
    tenant.industry,
    name,
    params,
    customerPhone
  );

  console.log(`[VapiTools] Function sonuc:`, result);
  return res.json({ result: JSON.stringify(result) });
}

/**
 * Direkt tool call formatini isle (server URL)
 */
async function handleDirectToolCall(req, res, body) {
  const functionName = body.function?.name || body.toolCall?.function?.name;
  const args = body.function?.arguments || body.toolCall?.function?.arguments;
  const callInfo = body.call || {};
  const assistantInfo = body.assistant || {};
  const customerPhone = callInfo.customer?.number || req.headers['x-customer-phone'] || 'unknown';

  // Debug: Request'i logla
  console.log('[VapiTools] Direct tool call - headers:', JSON.stringify(req.headers, null, 2));
  console.log('[VapiTools] Direct tool call - query:', req.query);
  console.log('[VapiTools] x-tenant-id header:', req.headers['x-tenant-id']);
  console.log('[VapiTools] tenantId query param:', req.query?.tenantId);

  // Tenant'i coz
  let tenant = await resolveTenantFromCall(callInfo, assistantInfo);

  // Query parameter'dan tenant ID kontrol et (en güvenilir yol)
  // supabaseAdmin kullaniyoruz cunku RLS politikasi anon key'i engelleyebilir
  if (!tenant && req.query?.tenantId) {
    console.log('[VapiTools] DEBUG: Trying query param tenantId:', req.query.tenantId);
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', req.query.tenantId)
      .single();

    // DEBUG: Sonucu logla
    console.log('[VapiTools] DEBUG: Supabase query result:', {
      data: data ? { id: data.id, name: data.name } : null,
      error: error
    });

    if (!error && data) {
      console.log('[VapiTools] Found tenant by query param:', data.id, data.name);
      tenant = data;
    } else if (error) {
      console.error('[VapiTools] DEBUG: Supabase error details:', error);
    }
  }

  // Header'dan tenant ID kontrol et (fallback)
  // supabaseAdmin kullaniyoruz cunku RLS politikasi anon key'i engelleyebilir
  if (!tenant && req.headers['x-tenant-id']) {
    console.log('[VapiTools] DEBUG: Trying header x-tenant-id:', req.headers['x-tenant-id']);
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', req.headers['x-tenant-id'])
      .single();

    // DEBUG: Sonucu logla
    console.log('[VapiTools] DEBUG: Header query result:', {
      data: data ? { id: data.id, name: data.name } : null,
      error: error
    });

    if (!error && data) {
      console.log('[VapiTools] Found tenant by header:', data.id, data.name);
      tenant = data;
    } else if (error) {
      console.error('[VapiTools] DEBUG: Header query error:', error);
    }
  }

  if (!tenant) {
    console.error('[VapiTools] Tenant bulunamadi');
    return res.json({
      result: {
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant bulunamadi',
      },
    });
  }

  console.log(`[VapiTools] Direct tool call: ${functionName}`, args);

  const parsedArgs = typeof args === 'string' ? JSON.parse(args) : (args || {});
  if (!parsedArgs.customer_phone && customerPhone !== 'unknown') {
    parsedArgs.customer_phone = customerPhone;
  }

  const result = await processFunctionCall(
    tenant.id,
    tenant.industry,
    functionName,
    parsedArgs,
    customerPhone
  );

  console.log(`[VapiTools] Direct tool sonuc:`, result);
  return res.json({ result });
}

/**
 * VAPI webhook secret dogrulama middleware
 */
function verifyVapiWebhook(req, res, next) {
  const webhookSecret = config.vapi.webhookSecret;

  // Secret yoksa dogrulamayi atla (development)
  if (!webhookSecret) {
    return next();
  }

  const providedSecret = req.headers['x-vapi-secret'] || req.headers['authorization']?.replace('Bearer ', '');

  if (providedSecret !== webhookSecret) {
    console.warn('[VapiTools] Invalid webhook secret');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid webhook secret',
    });
  }

  next();
}

module.exports = {
  handleToolCall,
  verifyVapiWebhook,
  resolveTenantFromCall,
  resolveLanguageFromCall,
};
