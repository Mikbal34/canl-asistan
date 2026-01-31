import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 hatası - ama login sayfasındayken veya login API'si çağrılıyorken redirect yapma
    if (error.response?.status === 401) {
      const isLoginPage = window.location.pathname === '/login';
      const isAuthEndpoint = error.config?.url?.includes('/auth/');

      if (!isLoginPage && !isAuthEndpoint) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  register: (data) => api.post('/api/auth/register', data),
  getMe: () => api.get('/api/auth/me'),
  logout: () => api.post('/api/auth/logout'),
};

// Tenant APIs
export const tenantAPI = {
  getSettings: () => api.get('/api/tenant/settings'),
  updateSettings: (data) => api.put('/api/tenant/settings', data),
  getStats: () => api.get('/api/tenant/stats'),
};

// Public APIs (no auth required)
export const publicAPI = {
  getTenantBranding: (slug) => api.get('/api/public/tenant/branding', { params: { slug } }),
};

// Test Drives APIs (Automotive)
export const testDriveAPI = {
  getAll: (params) => api.get('/api/test-drives', { params }),
  getById: (id) => api.get(`/api/test-drives/${id}`),
  create: (data) => api.post('/api/test-drives', data),
  update: (id, data) => api.put(`/api/test-drives/${id}`, data),
  delete: (id) => api.delete(`/api/test-drives/${id}`),
};

// Beauty Appointments APIs
export const beautyAPI = {
  getAppointments: (params) => api.get('/api/beauty/appointments', { params }),
  getServices: () => api.get('/api/beauty/services'),
  createAppointment: (data) => api.post('/api/beauty/appointments', data),
  updateAppointment: (id, data) => api.put(`/api/beauty/appointments/${id}`, data),
};

// Services APIs (Beauty Services)
// tenantId parametresi admin panelden başka tenant yönetirken kullanılır
export const serviceAPI = {
  getAll: (tenantId) => api.get('/api/beauty/services', tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {}),
  create: (data, tenantId) => api.post('/api/beauty/services', data, tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {}),
  update: (id, data, tenantId) => api.put(`/api/beauty/services/${id}`, data, tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {}),
  delete: (id, tenantId) => api.delete(`/api/beauty/services/${id}`, tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {}),
};

// Vehicle APIs (Otomotiv sektörü için)
export const vehicleAPI = {
  getAll: (params) => api.get('/api/vehicles', { params }),
  getById: (id) => api.get(`/api/vehicles/${id}`),
  create: (data) => api.post('/api/vehicles', data),
  update: (id, data) => api.put(`/api/vehicles/${id}`, data),
  delete: (id) => api.delete(`/api/vehicles/${id}`),
  getAvailable: () => api.get('/api/vehicles', { params: { is_available: true } }),
};

// Customers APIs
export const customerAPI = {
  getAll: (params) => api.get('/api/customers', { params }),
  getById: (id) => api.get(`/api/customers/${id}`),
  create: (data) => api.post('/api/customers', data),
  update: (id, data) => api.put(`/api/customers/${id}`, data),
  delete: (id) => api.delete(`/api/customers/${id}`),
};

// Call Logs APIs
export const callLogAPI = {
  getAll: (params) => api.get('/api/call-logs', { params }),
  getById: (id) => api.get(`/api/call-logs/${id}`),
};

// Admin APIs
export const adminAPI = {
  // Tenants
  getTenants: (params) => api.get('/api/admin/tenants', { params }),
  getTenant: (id) => api.get(`/api/admin/tenants/${id}`),
  createTenant: (data) => api.post('/api/admin/tenants', data),
  updateTenant: (id, data) => api.put(`/api/admin/tenants/${id}`, data),
  deleteTenant: (id) => api.delete(`/api/admin/tenants/${id}`),
  syncTenant: (id) => api.post(`/api/admin/tenants/${id}/sync`),
  initiateTestCall: (id) => api.post(`/api/admin/tenants/${id}/test-call`),

  // Tenant Use Cases (Admin)
  getTenantUseCases: (tenantId) => api.get(`/api/admin/tenants/${tenantId}/use-cases`),
  setTenantUseCases: (tenantId, useCaseIds, autoSync = false) =>
    api.put(`/api/admin/tenants/${tenantId}/use-cases`, { useCaseIds, autoSync }),
  setupTenantDefaultUseCases: (tenantId) => api.post(`/api/admin/tenants/${tenantId}/setup-use-cases`),

  // Presets
  getPresets: () => api.get('/api/admin/presets'),
  getPreset: (industry) => api.get(`/api/admin/presets/${industry}`),
  updatePreset: (industry, data) => api.put(`/api/admin/presets/${industry}`, data),
  syncPreset: (industry, language) => api.post(`/api/admin/presets/${industry}/sync`, { language }),
  getSyncLogs: (params) => api.get('/api/admin/presets/sync/logs', { params }),

  // Master Assistants
  getMasterAssistants: (industry) => api.get(`/api/admin/presets/${industry}/master-assistants`),
  createMasterAssistant: (industry, language) => api.post(`/api/admin/presets/${industry}/master-assistant`, { language }),
  createAllMasterAssistants: (industry) => api.post(`/api/admin/presets/${industry}/master-assistants/all`),
  deleteMasterAssistant: (industry, language) => api.delete(`/api/admin/presets/${industry}/master-assistant/${language}`),
};

// Voice Config APIs (Tenant)
export const voiceConfigAPI = {
  get: (language = 'tr') => api.get('/api/tenant/voice-config', { params: { language } }),
  update: (data) => api.put('/api/tenant/voice-config', data),
  sync: () => api.post('/api/tenant/voice-config/sync'),
  reset: (sync = false) => api.delete('/api/tenant/voice-config', { params: { sync } }),
};

// Slot Management APIs (Admin)
export const slotAPI = {
  getSlots: (tenantId, date) => api.get(`/api/admin/tenants/${tenantId}/slots`, { params: { date } }),
  updateSlot: (tenantId, slotId, data) => api.put(`/api/admin/tenants/${tenantId}/slots/${slotId}`, data),
  bulkUpdate: (tenantId, slots) => api.post(`/api/admin/tenants/${tenantId}/slots/bulk`, { slots }),
};

// Use Case APIs
export const useCaseAPI = {
  // Public (for onboarding)
  getAll: (params) => api.get('/api/public/use-cases', { params }),
  getDefaults: (industry) => api.get(`/api/public/use-cases/defaults/${industry}`),

  // Tenant
  getTenantUseCases: () => api.get('/api/tenant/use-cases'),
  getAvailableUseCases: () => api.get('/api/tenant/use-cases/available'),
  setTenantUseCases: (useCaseIds, autoSync = false) => api.put('/api/tenant/use-cases', { useCaseIds, autoSync }),
  toggleUseCase: (useCaseId, enabled, autoSync = false) => api.patch(`/api/tenant/use-cases/${useCaseId}`, { enabled, autoSync }),
  getTenantTools: () => api.get('/api/tenant/tools'),

  // Admin
  adminGetAll: (params) => api.get('/api/admin/use-cases', { params }),
  adminGet: (id) => api.get(`/api/admin/use-cases/${id}`),
  adminCreate: (data) => api.post('/api/admin/use-cases', data),
  adminUpdate: (id, data) => api.put(`/api/admin/use-cases/${id}`, data),
  adminDelete: (id) => api.delete(`/api/admin/use-cases/${id}`),
  adminGetTools: () => api.get('/api/admin/tools'),
  adminSetupDefaults: (tenantId) => api.post(`/api/admin/tenants/${tenantId}/setup-use-cases`),
};

// VAPI APIs
export const vapiAPI = {
  getConfig: (tenantId, language = 'tr') => api.get(`/vapi/config/${tenantId}`, { params: { language } }),
  syncTenant: (tenantId) => api.post(`/vapi/sync/${tenantId}`),
};

// Appointments API (Admin - unified view of all appointment types)
export const appointmentsAPI = {
  getAll: (tenantId, params) => api.get(`/api/admin/tenants/${tenantId}/appointments`, { params }),
  updateStatus: (tenantId, appointmentId, status, appointmentType) =>
    api.put(`/api/admin/tenants/${tenantId}/appointments/${appointmentId}`, { status, appointment_type: appointmentType }),
};

// Customers API (Admin)
export const customersAdminAPI = {
  getAll: (tenantId, params) => api.get(`/api/admin/tenants/${tenantId}/customers`, { params }),
};

// Feedback API (Admin)
export const feedbackAPI = {
  getAll: (tenantId, params) => api.get(`/api/admin/tenants/${tenantId}/feedback`, { params }),
  updateStatus: (tenantId, feedbackId, status, adminNotes) =>
    api.put(`/api/admin/tenants/${tenantId}/feedback/${feedbackId}`, { status, admin_notes: adminNotes }),
};

// Onboarding APIs
export const onboardingAPI = {
  // Industry Presets (public)
  getIndustryPresets: () => api.get('/api/onboarding/industries'),

  // Get onboarding config for an industry (public)
  getOnboardingConfig: (industry) => api.get(`/api/onboarding/config/${industry}`),

  // Generic catalog upload (config-driven)
  uploadCatalog: (tableName, items) => api.post('/api/onboarding/catalog', { tableName, items }),
  uploadCatalogCSV: (file, tableName) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tableName', tableName);
    return api.post('/api/onboarding/catalog/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Step 1: Registration (public)
  register: (data) => api.post('/api/onboarding/register', data),
  checkSlug: (slug) => api.get(`/api/onboarding/check-slug/${slug}`),
  suggestSlug: (name) => api.get('/api/onboarding/suggest-slug', { params: { name } }),

  // Status & Checklist
  getStatus: () => api.get('/api/onboarding/status'),
  getChecklist: () => api.get('/api/onboarding/checklist'),

  // Step 2: Vehicles (Automotive)
  uploadVehicles: (vehicles, skip = false) => api.post('/api/onboarding/vehicles', { vehicles, skip }),
  uploadVehiclesCSV: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/onboarding/vehicles/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Step 2: Services (Beauty)
  uploadServices: (services, skip = false) => api.post('/api/onboarding/services', { services, skip }),
  uploadServicesCSV: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/onboarding/services/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Step 2: Working Hours
  setWorkingHours: (workingHours) => api.post('/api/onboarding/hours', { workingHours }),
  getWorkingHours: () => api.get('/api/onboarding/hours'),

  // Step 3: Voice Settings
  updateVoiceSettings: (settings) => api.put('/api/onboarding/voice', settings),
  getVoicePresets: (language) => api.get('/api/onboarding/voice-presets', { params: { language } }),

  // Step 4: Test & Activation
  initiateTestCall: () => api.post('/api/onboarding/test-call'),
  activate: () => api.post('/api/onboarding/activate'),
  getTestScenarios: (industry) => api.get('/api/onboarding/test-scenarios', { params: { industry } }),

  // Use Cases
  setUseCases: (useCaseIds) => api.post('/api/onboarding/use-cases', { useCaseIds }),
};

export default api;
