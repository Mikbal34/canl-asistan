import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import { useTenant } from '../../hooks/useTenant';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';

/**
 * Settings page component
 * Simplified - only basic company info
 * Voice settings and notifications are managed by admin
 */
export const Settings = () => {
  const { t } = useTranslation();
  const { tenantSettings, updateSettings } = useTenant();
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    phone: '',
    email: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (tenantSettings) {
      setFormData({
        name: tenantSettings.name || '',
        industry: tenantSettings.industry || '',
        phone: tenantSettings.phone || '',
        email: tenantSettings.email || '',
        address: tenantSettings.address || '',
      });
    }
  }, [tenantSettings]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      const updateData = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
      };

      const result = await updateSettings(updateData);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t('settings.title')}</h1>
        <p className="text-slate-500 mt-1">
          Configure your company and voice assistant settings
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Success Message */}
        {success && (
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
            {t('common.success')}! Settings updated successfully.
          </div>
        )}

        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.companyInfo')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label={t('settings.companyName')}
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
              <Input
                label={t('settings.industry')}
                name="industry"
                value={formData.industry}
                disabled
              />
              <Input
                label={t('settings.phone')}
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
              />
              <Input
                label={t('settings.email')}
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
              />
              <div className="md:col-span-2">
                <Input
                  label={t('settings.address')}
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? (
              t('common.loading')
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                {t('settings.saveChanges')}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
