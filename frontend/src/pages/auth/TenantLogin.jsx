import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Building2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { publicAPI } from '../../services/api';
import { Input } from '../../components/common/Input';

/**
 * Slug-based branded tenant login page
 * Renders at /login/:slug with tenant-specific branding (logo, colors, message)
 */
export const TenantLogin = () => {
  const { slug } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [branding, setBranding] = useState(null);
  const [brandingLoading, setBrandingLoading] = useState(true);

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch tenant branding by slug
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const response = await publicAPI.getTenantBranding(slug);
        const data = response.data?.branding || response.data;
        if (data && data.name) {
          setBranding(data);
        } else {
          navigate('/login', { replace: true });
        }
      } catch {
        navigate('/login', { replace: true });
      } finally {
        setBrandingLoading(false);
      }
    };

    if (slug) {
      fetchBranding();
    } else {
      navigate('/login', { replace: true });
    }
  }, [slug, navigate]);

  // Set favicon dynamically
  useEffect(() => {
    if (!branding?.favicon_url) return;

    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    const originalHref = link.href;
    link.href = branding.favicon_url;

    return () => { link.href = originalHref || '/favicon.ico'; };
  }, [branding?.favicon_url]);

  // Set document title
  useEffect(() => {
    if (!branding?.name) return;
    const originalTitle = document.title;
    document.title = `${branding.name} - ${t('auth.login')}`;
    return () => { document.title = originalTitle; };
  }, [branding?.name, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(formData);
      if (result.success) {
        const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (savedUser?.role === 'super_admin') {
          navigate('/admin/dashboard');
        } else {
          navigate('/dashboard');
        }
      } else {
        setError(result.error);
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Loading state
  if (brandingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!branding) return null;

  const primaryColor = branding.primary_color || '#4f46e5';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Background decoration circles with tenant primary color */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 -left-32 w-96 h-96 rounded-full blur-3xl"
          style={{ backgroundColor: `${primaryColor}15` }}
        />
        <div
          className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full blur-3xl"
          style={{ backgroundColor: `${primaryColor}15` }}
        />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo & Company Name */}
        <div className="text-center mb-8">
          {branding.logo_url ? (
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-sm mb-4 overflow-hidden">
              <img
                src={branding.logo_url}
                alt={branding.name}
                className="w-16 h-16 object-contain"
              />
            </div>
          ) : (
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ backgroundColor: primaryColor }}
            >
              <Building2 className="w-8 h-8 text-white" />
            </div>
          )}
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {branding.name}
          </h1>
          {branding.login_message ? (
            <p className="text-slate-500">{branding.login_message}</p>
          ) : (
            <p className="text-slate-500">{t('auth.loginSubtitle')}</p>
          )}
        </div>

        {/* Login Form Card */}
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}

            <Input
              label={t('auth.email')}
              type="email"
              name="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={handleChange}
              required
            />

            <Input
              label={t('auth.password')}
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
            />

            <div className="flex items-center justify-between text-sm">
              <Link
                to="/forgot-password"
                className="transition-colors"
                style={{ color: primaryColor }}
                onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                onMouseLeave={(e) => e.target.style.opacity = '1'}
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 px-4 py-2.5 text-base text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: primaryColor,
                boxShadow: `0 2px 8px ${primaryColor}40`,
              }}
              onMouseEnter={(e) => { if (!loading) e.target.style.opacity = '0.9'; }}
              onMouseLeave={(e) => { e.target.style.opacity = '1'; }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                t('auth.login')
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
