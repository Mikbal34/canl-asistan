import { useTranslation } from 'react-i18next';
import { VehicleCatalogEditor } from '../../components/admin/VehicleCatalogEditor';
import { useAuth } from '../../hooks/useAuth';

export const Vehicles = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const tenantId = user?.tenant_id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('navigation.vehicleCatalog')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('vehicles.subtitle')}</p>
      </div>

      <VehicleCatalogEditor tenantId={tenantId} mode="tenant" />
    </div>
  );
};

export default Vehicles;
