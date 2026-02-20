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
        <h1 className="text-2xl font-bold text-foreground">{t('navigation.promotions')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('promotions.subtitle')}</p>
      </div>

      <PromotionsEditor tenantId={tenantId} mode="tenant" />
    </div>
  );
};

export default Promotions;
