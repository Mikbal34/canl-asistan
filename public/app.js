/**
 * PRESTIGE AUTO - Dashboard Application
 * Luxury Automotive Management System
 */

const API_BASE = '/api';

// Application State
const state = {
  testDrives: [],
  services: [],
  customers: [],
  vehicles: [],
  callLogs: [],
  isLoading: false
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  updateDate();
  refreshData();
  initAnimations();

  // Auto-refresh every 30 seconds
  setInterval(refreshData, 30000);
});

// Navigation System
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.dataset.tab;

      // Update navigation state
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Switch tab content with animation
      const currentTab = document.querySelector('.tab-content.active');
      const newTab = document.getElementById(`tab-${tab}`);

      if (currentTab) {
        currentTab.style.opacity = '0';
        currentTab.style.transform = 'translateY(10px)';

        setTimeout(() => {
          currentTab.classList.remove('active');
          newTab.classList.add('active');

          // Trigger reflow for animation
          newTab.offsetHeight;
          newTab.style.opacity = '1';
          newTab.style.transform = 'translateY(0)';
        }, 200);
      }

      updateHeader(tab);
    });
  });
}

// Update page header
function updateHeader(tab) {
  const headers = {
    'dashboard': { title: 'Dashboard', subtitle: 'Günlük özet ve performans metrikleri' },
    'test-drives': { title: 'Test Sürüşleri', subtitle: 'Tüm test sürüşü randevuları' },
    'services': { title: 'Servis', subtitle: 'Servis randevuları ve bakım kayıtları' },
    'customers': { title: 'Müşteriler', subtitle: 'Müşteri portföyü ve iletişim bilgileri' },
    'vehicles': { title: 'Araçlar', subtitle: 'Showroom envanteri ve araç detayları' },
    'call-logs': { title: 'Arama Geçmişi', subtitle: 'Tüm telefon görüşmeleri ve kayıtlar' }
  };

  const { title, subtitle } = headers[tab] || headers['dashboard'];

  const titleEl = document.getElementById('pageTitle');
  const subtitleEl = document.getElementById('pageSubtitle');

  // Animate title change
  titleEl.style.opacity = '0';
  subtitleEl.style.opacity = '0';

  setTimeout(() => {
    titleEl.textContent = title;
    subtitleEl.textContent = subtitle;
    titleEl.style.opacity = '1';
    subtitleEl.style.opacity = '1';
  }, 150);
}

// Update date display
function updateDate() {
  const now = new Date();
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const dateStr = now.toLocaleDateString('tr-TR', options);
  document.getElementById('currentDate').textContent = dateStr;
}

// Fetch and refresh all data
async function refreshData() {
  if (state.isLoading) return;
  state.isLoading = true;

  try {
    const [testDrives, services, customers, vehicles, callLogs] = await Promise.all([
      fetchData('/test-drives'),
      fetchData('/services'),
      fetchData('/customers'),
      fetchData('/vehicles'),
      fetchData('/call-logs')
    ]);

    state.testDrives = testDrives || [];
    state.services = services || [];
    state.customers = customers || [];
    state.vehicles = vehicles || [];
    state.callLogs = callLogs || [];

    // Update all views
    updateStats();
    updateBadges();
    renderRecentAppointments();
    renderTestDrives();
    renderServices();
    renderCustomers();
    renderVehicles();
    renderCallLogs();

  } catch (error) {
    console.error('Data refresh failed:', error);
  } finally {
    state.isLoading = false;
  }
}

// API fetch helper
async function fetchData(endpoint) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Fetch error for ${endpoint}:`, error);
    return [];
  }
}

// Update statistics cards
function updateStats() {
  animateValue('totalTestDrives', state.testDrives.length);
  animateValue('totalServices', state.services.length);
  animateValue('totalCustomers', state.customers.length);

  // Today's appointments
  const today = new Date().toISOString().split('T')[0];
  const todayCount =
    state.testDrives.filter(t => t.appointment_date === today).length +
    state.services.filter(s => s.appointment_date === today).length;

  animateValue('todayAppointments', todayCount);
}

// Animate number changes
function animateValue(elementId, newValue) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const currentValue = parseInt(element.textContent) || 0;
  const diff = newValue - currentValue;
  const duration = 500;
  const steps = 20;
  const stepValue = diff / steps;
  let step = 0;

  const interval = setInterval(() => {
    step++;
    element.textContent = Math.round(currentValue + stepValue * step);
    if (step >= steps) {
      element.textContent = newValue;
      clearInterval(interval);
    }
  }, duration / steps);
}

// Update navigation badges
function updateBadges() {
  const testDriveBadge = document.getElementById('testDriveBadge');
  const serviceBadge = document.getElementById('serviceBadge');
  const callLogsBadge = document.getElementById('callLogsBadge');

  if (testDriveBadge) testDriveBadge.textContent = state.testDrives.length;
  if (serviceBadge) serviceBadge.textContent = state.services.length;
  if (callLogsBadge) callLogsBadge.textContent = state.callLogs.length;
}

// Format date
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Format time
function formatTime(timeStr) {
  if (!timeStr) return '—';
  return timeStr.substring(0, 5);
}

// Get status text and class
function getStatusInfo(status) {
  const statusMap = {
    'pending': { text: 'Bekliyor', class: 'pending' },
    'confirmed': { text: 'Onaylandı', class: 'confirmed' },
    'completed': { text: 'Tamamlandı', class: 'completed' },
    'cancelled': { text: 'İptal', class: 'cancelled' },
    'in_progress': { text: 'Devam Ediyor', class: 'in_progress' }
  };
  return statusMap[status] || { text: status, class: 'pending' };
}

// Render recent appointments table
function renderRecentAppointments() {
  const tbody = document.querySelector('#recentAppointmentsTable tbody');
  if (!tbody) return;

  const allAppointments = [
    ...state.testDrives.map(t => ({ ...t, type: 'test-drive', typeName: 'Test Sürüşü', typeIcon: '🚗' })),
    ...state.services.map(s => ({ ...s, type: 'service', typeName: 'Servis', typeIcon: '🔧' }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);

  if (allAppointments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div class="empty-title">Henüz randevu yok</div>
            <div class="empty-text">Yeni randevular burada görünecek</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = allAppointments.map((apt, index) => {
    const status = getStatusInfo(apt.status);
    const detail = apt.type === 'test-drive'
      ? (apt.vehicle ? `${apt.vehicle.brand} ${apt.vehicle.model}` : '—')
      : (apt.vehicle_plate || '—');

    return `
      <tr style="animation: fadeIn 0.3s ease ${index * 0.05}s both">
        <td>
          <span class="type-badge ${apt.type}">
            ${apt.typeIcon} ${apt.typeName}
          </span>
        </td>
        <td>${apt.customer?.name || apt.customer_name || '—'}</td>
        <td>${formatDate(apt.appointment_date)}</td>
        <td>${formatTime(apt.appointment_time)}</td>
        <td>${detail}</td>
        <td><span class="status-badge ${status.class}">${status.text}</span></td>
      </tr>
    `;
  }).join('');
}

// Render test drives table
function renderTestDrives() {
  const tbody = document.querySelector('#testDrivesTable tbody');
  if (!tbody) return;

  if (state.testDrives.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M5 17h14M6 13l1.5-5h9l1.5 5M6 13h12M6 13l-2 4h16l-2-4"/>
                <circle cx="7.5" cy="17" r="1.5"/>
                <circle cx="16.5" cy="17" r="1.5"/>
              </svg>
            </div>
            <div class="empty-title">Test sürüşü randevusu yok</div>
            <div class="empty-text">Yeni randevular burada listelenecek</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.testDrives.map((t, index) => {
    const status = getStatusInfo(t.status);
    return `
      <tr style="animation: fadeIn 0.3s ease ${index * 0.05}s both">
        <td><strong>${t.customer?.name || t.customer_name || '—'}</strong></td>
        <td>${t.customer?.phone || '—'}</td>
        <td>${t.vehicle ? `${t.vehicle.brand} ${t.vehicle.model}` : '—'}</td>
        <td>${formatDate(t.appointment_date)}</td>
        <td>${formatTime(t.appointment_time)}</td>
        <td><span class="status-badge ${status.class}">${status.text}</span></td>
        <td>
          ${t.status === 'pending' ? `
            <button class="action-btn confirm" onclick="updateStatus('test-drive', '${t.id}', 'confirmed')">Onayla</button>
            <button class="action-btn cancel" onclick="updateStatus('test-drive', '${t.id}', 'cancelled')">İptal</button>
          ` : '—'}
        </td>
      </tr>
    `;
  }).join('');
}

// Render services table
function renderServices() {
  const tbody = document.querySelector('#servicesTable tbody');
  if (!tbody) return;

  if (state.services.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
            </div>
            <div class="empty-title">Servis randevusu yok</div>
            <div class="empty-text">Yeni servis talepleri burada görünecek</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.services.map((s, index) => {
    const status = getStatusInfo(s.status);
    return `
      <tr style="animation: fadeIn 0.3s ease ${index * 0.05}s both">
        <td><strong>${s.customer?.name || s.customer_name || '—'}</strong></td>
        <td>${s.customer?.phone || '—'}</td>
        <td><code style="background: var(--glass-highlight); padding: 4px 8px; border-radius: 4px;">${s.vehicle_plate || '—'}</code></td>
        <td>${s.notes || s.service_type || '—'}</td>
        <td>${formatDate(s.appointment_date)}</td>
        <td>${formatTime(s.appointment_time)}</td>
        <td><span class="status-badge ${status.class}">${status.text}</span></td>
      </tr>
    `;
  }).join('');
}

// Render customers table
function renderCustomers() {
  const tbody = document.querySelector('#customersTable tbody');
  if (!tbody) return;

  if (state.customers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="empty-state">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div class="empty-title">Müşteri kaydı yok</div>
            <div class="empty-text">Yeni müşteriler burada listelenecek</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.customers.map((c, index) => `
    <tr style="animation: fadeIn 0.3s ease ${index * 0.05}s both">
      <td><strong>${c.name || '—'}</strong></td>
      <td>${c.phone || '—'}</td>
      <td>${c.email || '—'}</td>
      <td>${formatDate(c.created_at)}</td>
    </tr>
  `).join('');
}

// Render vehicles showcase
function renderVehicles() {
  const grid = document.getElementById('vehiclesGrid');
  if (!grid) return;

  if (state.vehicles.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="1" y="6" width="22" height="12" rx="2"/>
            <path d="M1 10h22"/>
            <circle cx="6" cy="14" r="2"/>
            <circle cx="18" cy="14" r="2"/>
          </svg>
        </div>
        <div class="empty-title">Araç envanteri boş</div>
        <div class="empty-text">Araçlar eklendiğinde burada görünecek</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = state.vehicles.map((v, index) => `
    <div class="vehicle-card" style="animation: fadeIn 0.4s ease ${index * 0.1}s both">
      <div class="vehicle-visual">
        <span class="vehicle-icon">🚗</span>
        ${v.year ? `<span class="vehicle-year-badge">${v.year}</span>` : ''}
      </div>
      <div class="vehicle-content">
        <div class="vehicle-brand">${v.brand}</div>
        <div class="vehicle-model">${v.model}</div>
        <div class="vehicle-specs">
          <div class="spec-item">
            <span class="spec-label">Renk</span>
            <span class="spec-value">${v.color || '—'}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Yakıt</span>
            <span class="spec-value">${v.fuel_type || '—'}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Vites</span>
            <span class="spec-value">${v.transmission || '—'}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Stok</span>
            <span class="spec-value">${v.stock_count || 0} adet</span>
          </div>
        </div>
      </div>
      <div class="vehicle-footer">
        <div class="vehicle-price">${v.price ? formatPrice(v.price) : '—'}</div>
        <div class="vehicle-availability ${v.available_for_test_drive ? '' : 'unavailable'}">
          ${v.available_for_test_drive ? '✓ Test Sürüşü Müsait' : '✗ Müsait Değil'}
        </div>
      </div>
    </div>
  `).join('');
}

// Format price with Turkish Lira
function formatPrice(price) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0
  }).format(price);
}

// Render call logs table
function renderCallLogs() {
  const tbody = document.querySelector('#callLogsTable tbody');
  if (!tbody) return;

  if (state.callLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <div class="empty-title">Arama kaydı yok</div>
            <div class="empty-text">Telefon görüşmeleri burada listelenecek</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.callLogs.map((log, index) => {
    const callType = getCallTypeInfo(log.call_type);
    const duration = formatDuration(log.duration_seconds);

    return `
      <tr style="animation: fadeIn 0.3s ease ${index * 0.05}s both">
        <td>${formatDateTime(log.created_at)}</td>
        <td><strong>${log.customer?.name || log.caller_phone || '—'}</strong></td>
        <td>${log.caller_phone || '—'}</td>
        <td><span class="call-type-badge ${callType.class}">${callType.text}</span></td>
        <td>${duration}</td>
        <td>${log.summary || '—'}</td>
      </tr>
    `;
  }).join('');
}

// Get call type info
function getCallTypeInfo(type) {
  const typeMap = {
    'inbound': { text: 'Gelen', class: 'inbound' },
    'outbound': { text: 'Giden', class: 'outbound' },
    'missed': { text: 'Cevapsız', class: 'missed' }
  };
  return typeMap[type] || { text: type || 'Gelen', class: 'inbound' };
}

// Format duration in seconds to mm:ss
function formatDuration(seconds) {
  if (!seconds) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format datetime
function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Update appointment status
async function updateStatus(type, id, status) {
  try {
    const endpoint = type === 'test-drive' ? '/test-drives' : '/services';
    const response = await fetch(`${API_BASE}${endpoint}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    if (response.ok) {
      refreshData();
    }
  } catch (error) {
    console.error('Status update failed:', error);
  }
}

// Initialize subtle animations
function initAnimations() {
  // Add smooth transitions to elements
  document.querySelectorAll('.stat-card').forEach((card, index) => {
    card.style.animationDelay = `${index * 0.1}s`;
  });

  // Intersection observer for scroll animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.card, .stat-card, .vehicle-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });
}

// Make refreshData available globally
window.refreshData = refreshData;
window.updateStatus = updateStatus;
