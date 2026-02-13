import { useTranslation } from 'react-i18next';
import { PromotionsEditor } from '../../components/admin/PromotionsEditor';
import { useAuth } from '../../hooks/useAuth';

export const Promotions = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const tenantId = user?.tenant_id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('navigation.promotions')}</h1>
        <p className="text-slate-500 mt-1">{t('promotions.subtitle')}</p>
      </div>

      <PromotionsEditor tenantId={tenantId} mode="tenant" />
    </div>
  );
};

export default Promotions;
