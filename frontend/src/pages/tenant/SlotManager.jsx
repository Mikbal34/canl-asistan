import { useTranslation } from 'react-i18next';
import { SlotManagerEditor } from '../../components/admin/SlotManagerEditor';
import { useTenant } from '../../hooks/useTenant';
import { useAuth } from '../../hooks/useAuth';
import { CalendarClock } from 'lucide-react';

export const SlotManager = () => {
  const { t } = useTranslation();
  const { tenantSettings, fetchTenantData } = useTenant();
  const { user } = useAuth();

  const tenantId = user?.tenant_id;
  const tenant = tenantSettings || user?.tenant;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/50">
          <CalendarClock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('navigation.slotManager')}</h1>
          <p className="text-muted-foreground text-sm">{t('slotManager.subtitle')}</p>
        </div>
      </div>

      <SlotManagerEditor
        tenantId={tenantId}
        tenant={tenant}
        onTenantUpdate={() => fetchTenantData?.()}
        mode="tenant"
      />
    </div>
  );
};

export default SlotManager;
