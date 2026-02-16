/**
 * Notification Service
 * In-app bildirim olusturma (Supabase Realtime ile anlik)
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');

const supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceRoleKey);

/**
 * Bildirim olustur
 * @param {string} tenantId - Tenant UUID
 * @param {string} type - Bildirim tipi
 * @param {string} title - Baslik
 * @param {string} description - Aciklama
 * @param {Object} metadata - Ek veri (JSONB)
 */
async function createNotification(tenantId, type, title, description, metadata = {}) {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        tenant_id: tenantId,
        type,
        title,
        description,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.error('[NotificationService] Error creating notification:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[NotificationService] Unexpected error:', err);
    return null;
  }
}

/**
 * Randevu olusturuldu bildirimi
 */
async function notifyAppointmentCreated(tenantId, appointmentType, details) {
  const typeLabels = {
    test_drive: 'Test Sürüşü',
    service: 'Servis',
    beauty: 'Güzellik',
  };
  const label = typeLabels[appointmentType] || appointmentType;

  return createNotification(
    tenantId,
    'appointment_created',
    `Yeni ${label} Randevusu`,
    `${details.customer_name || 'Müşteri'} - ${details.date} ${details.time}`,
    { appointment_type: appointmentType, ...details }
  );
}

/**
 * Randevu iptal edildi bildirimi
 */
async function notifyAppointmentCancelled(tenantId, appointmentType, details) {
  const typeLabels = {
    test_drive: 'Test Sürüşü',
    service: 'Servis',
    beauty: 'Güzellik',
  };
  const label = typeLabels[appointmentType] || appointmentType;

  return createNotification(
    tenantId,
    'appointment_cancelled',
    `${label} Randevusu İptal Edildi`,
    details.customer_name ? `${details.customer_name} randevusunu iptal etti` : 'Bir randevu iptal edildi',
    { appointment_type: appointmentType, ...details }
  );
}

/**
 * Randevu guncellendi bildirimi
 */
async function notifyAppointmentUpdated(tenantId, appointmentType, details) {
  const typeLabels = {
    test_drive: 'Test Sürüşü',
    service: 'Servis',
    beauty: 'Güzellik',
  };
  const label = typeLabels[appointmentType] || appointmentType;

  return createNotification(
    tenantId,
    'appointment_updated',
    `${label} Randevusu Güncellendi`,
    details.new_date ? `Yeni tarih: ${details.new_date} ${details.new_time}` : 'Randevu bilgileri güncellendi',
    { appointment_type: appointmentType, ...details }
  );
}

/**
 * Yeni musteri olusturuldu bildirimi
 */
async function notifyCustomerCreated(tenantId, details) {
  return createNotification(
    tenantId,
    'customer_created',
    'Yeni Müşteri',
    `${details.name || details.phone || 'Yeni müşteri'} sisteme eklendi`,
    details
  );
}

/**
 * Arama tamamlandi bildirimi
 */
async function notifyCallCompleted(tenantId, details) {
  const duration = details.duration_seconds
    ? `${Math.floor(details.duration_seconds / 60)}:${(details.duration_seconds % 60).toString().padStart(2, '0')}`
    : '';

  return createNotification(
    tenantId,
    'call_completed',
    'Arama Tamamlandı',
    duration ? `${details.caller_phone || 'Bilinmeyen'} - Süre: ${duration}` : `${details.caller_phone || 'Bilinmeyen numara'}`,
    details
  );
}

module.exports = {
  createNotification,
  notifyAppointmentCreated,
  notifyAppointmentCancelled,
  notifyAppointmentUpdated,
  notifyCustomerCreated,
  notifyCallCompleted,
};
