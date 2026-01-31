/**
 * Webhook Service
 * Tenant webhook entegrasyonu - CRM/ERP bildirimler
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

/**
 * Tenant'in aktif webhook'larini getir
 * @param {string} tenantId - Tenant UUID
 * @param {string} eventType - Event tipi (appointment.created, customer.created, etc.)
 */
async function getTenantWebhooks(tenantId, eventType) {
  const { data, error } = await supabase
    .from('tenant_webhooks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('event_type', eventType)
    .eq('is_active', true);

  if (error) {
    console.error('[WebhookService] Error fetching webhooks:', error);
    return [];
  }

  return data || [];
}

/**
 * Webhook cagrisini logla
 */
async function logWebhookCall(webhookId, tenantId, eventType, payload, response) {
  try {
    const { error } = await supabase
      .from('webhook_logs')
      .insert({
        webhook_id: webhookId,
        tenant_id: tenantId,
        event_type: eventType,
        payload,
        response_status: response.status,
        response_body: response.body,
        status: response.success ? 'success' : 'failed',
        error_message: response.error,
        completed_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[WebhookService] Error logging webhook call:', error);
    }

    // Webhook istatistiklerini guncelle
    const updateData = {
      last_triggered_at: new Date().toISOString(),
      total_calls: supabase.sql`total_calls + 1`,
    };

    if (response.success) {
      updateData.last_success_at = new Date().toISOString();
    } else {
      updateData.last_error = response.error;
      updateData.total_failures = supabase.sql`total_failures + 1`;
    }

    await supabase
      .from('tenant_webhooks')
      .update({
        last_triggered_at: new Date().toISOString(),
        total_calls: supabase.rpc('increment_webhook_calls', { webhook_id: webhookId }),
      })
      .eq('id', webhookId);

  } catch (err) {
    console.error('[WebhookService] Error in logWebhookCall:', err);
  }
}

/**
 * Webhook'a HTTP istegi gonder
 * @param {Object} webhook - Webhook config
 * @param {Object} payload - Gonderilecek veri
 */
async function sendWebhookRequest(webhook, payload) {
  const headers = {
    'Content-Type': 'application/json',
    ...webhook.custom_headers,
  };

  // Authentication header ekle
  if (webhook.auth_type === 'bearer' && webhook.auth_value) {
    headers['Authorization'] = `Bearer ${webhook.auth_value}`;
  } else if (webhook.auth_type === 'api_key' && webhook.auth_value) {
    headers['X-API-Key'] = webhook.auth_value;
  } else if (webhook.auth_type === 'basic' && webhook.auth_value) {
    headers['Authorization'] = `Basic ${Buffer.from(webhook.auth_value).toString('base64')}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 saniye timeout

    const response = await fetch(webhook.webhook_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseBody = await response.text().catch(() => '');

    return {
      success: response.ok,
      status: response.status,
      body: responseBody,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    console.error(`[WebhookService] Request failed to ${webhook.webhook_url}:`, error.message);
    return {
      success: false,
      status: 0,
      body: null,
      error: error.message,
    };
  }
}

/**
 * Tenant webhook'larina event bildir
 * @param {string} tenantId - Tenant UUID
 * @param {string} eventType - Event tipi
 * @param {Object} data - Event verisi
 */
async function triggerWebhooks(tenantId, eventType, data) {
  if (!tenantId) {
    console.warn('[WebhookService] No tenantId provided, skipping webhooks');
    return { triggered: 0, results: [] };
  }

  // Tenant'in bu event icin aktif webhook'larini al
  const webhooks = await getTenantWebhooks(tenantId, eventType);

  if (webhooks.length === 0) {
    console.log(`[WebhookService] No active webhooks for ${eventType} in tenant ${tenantId}`);
    return { triggered: 0, results: [] };
  }

  console.log(`[WebhookService] Triggering ${webhooks.length} webhook(s) for ${eventType}`);

  // Payload olustur
  const payload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    tenant_id: tenantId,
    data,
  };

  // Tum webhook'lara paralel olarak gonder
  const results = await Promise.all(
    webhooks.map(async (webhook) => {
      const response = await sendWebhookRequest(webhook, payload);

      // Loglama (async, beklemiyoruz)
      logWebhookCall(webhook.id, tenantId, eventType, payload, response).catch(() => {});

      return {
        webhookId: webhook.id,
        webhookName: webhook.name,
        success: response.success,
        status: response.status,
        error: response.error,
      };
    })
  );

  const successCount = results.filter(r => r.success).length;
  console.log(`[WebhookService] ${successCount}/${results.length} webhook(s) succeeded for ${eventType}`);

  return {
    triggered: webhooks.length,
    results,
  };
}

/**
 * Randevu olusturuldu bildirimi
 */
async function notifyAppointmentCreated(tenantId, appointmentType, appointmentData) {
  return triggerWebhooks(tenantId, 'appointment.created', {
    type: appointmentType,
    appointment: appointmentData,
  });
}

/**
 * Randevu iptal edildi bildirimi
 */
async function notifyAppointmentCancelled(tenantId, appointmentType, appointmentData) {
  return triggerWebhooks(tenantId, 'appointment.cancelled', {
    type: appointmentType,
    appointment: appointmentData,
  });
}

/**
 * Randevu guncellendi bildirimi
 */
async function notifyAppointmentUpdated(tenantId, appointmentType, appointmentData) {
  return triggerWebhooks(tenantId, 'appointment.updated', {
    type: appointmentType,
    appointment: appointmentData,
  });
}

/**
 * Musteri olusturuldu bildirimi
 */
async function notifyCustomerCreated(tenantId, customerData) {
  return triggerWebhooks(tenantId, 'customer.created', {
    customer: customerData,
  });
}

/**
 * Arama tamamlandi bildirimi
 */
async function notifyCallCompleted(tenantId, callData) {
  return triggerWebhooks(tenantId, 'call.completed', {
    call: callData,
  });
}

module.exports = {
  triggerWebhooks,
  notifyAppointmentCreated,
  notifyAppointmentCancelled,
  notifyAppointmentUpdated,
  notifyCustomerCreated,
  notifyCallCompleted,
  getTenantWebhooks,
};
