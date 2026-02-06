import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
import { TenantBrandingProvider } from './context/TenantBrandingContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/common/Layout';

// Auth Pages
import { Login } from './pages/auth/Login';
import { AuthCallback } from './pages/auth/AuthCallback';

// Onboarding Pages
import { IndustrySelector } from './pages/onboarding/IndustrySelector';
import { OnboardingWizard } from './pages/onboarding/OnboardingWizard';

// Tenant Pages
import { Dashboard } from './pages/tenant/Dashboard';
import { Appointments } from './pages/tenant/Appointments';
import { Customers } from './pages/tenant/Customers';
import { Services } from './pages/tenant/Services';
import { CallLogs } from './pages/tenant/CallLogs';
import { Settings } from './pages/tenant/Settings';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { Tenants } from './pages/admin/Tenants';
import { TenantDetail } from './pages/admin/TenantDetail';
import { Presets } from './pages/admin/Presets';
import { PresetConfig } from './pages/admin/PresetConfig';

/**
 * Main App component with routing
 */
function App() {
  return (
    <Router>
      <AuthProvider>
        <TenantBrandingProvider>
          <TenantProvider>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/onboarding" element={<IndustrySelector />} />
              <Route path="/onboarding/:industry" element={<OnboardingWizard />} />

            {/* Protected Tenant Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/appointments"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Appointments />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/test-drives"
              element={<Navigate to="/appointments" replace />}
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Customers />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/services"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Services />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/call-logs"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CallLogs />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Protected Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <Layout>
                    <AdminDashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tenants"
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <Layout>
                    <Tenants />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tenants/:id"
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <Layout>
                    <TenantDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/presets"
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <Layout>
                    <Presets />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/presets/:industry"
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <Layout>
                    <PresetConfig />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Default Route */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* 404 Route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </TenantProvider>
        </TenantBrandingProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
