import { useTranslation } from 'react-i18next';
import { SlotManagerEditor } from '../../components/admin/SlotManagerEditor';
import { useTenant } from '../../hooks/useTenant';
import { useAuth } from '../../hooks/useAuth';

export const SlotManager = () => {
  const { t } = useTranslation();
  const { tenantSettings, fetchTenantData } = useTenant();
  const { user } = useAuth();

  const tenantId = user?.tenant_id;
  const tenant = tenantSettings || user?.tenant;

  const handleTenantUpdate = () => {
    fetchTenantData?.();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('navigation.slotManager')}</h1>
        <p className="text-slate-500 mt-1">{t('slotManager.subtitle')}</p>
      </div>

      <SlotManagerEditor
        tenantId={tenantId}
        tenant={tenant}
        onTenantUpdate={handleTenantUpdate}
        mode="tenant"
      />
    </div>
  );
};

export default SlotManager;
