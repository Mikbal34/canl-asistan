import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash2, Car, Scissors } from 'lucide-react';
import { Card, CardContent } from '../../components/common/Card';
import { Table } from '../../components/common/Table';
import { Button } from '../../components/common/Button';
import { serviceAPI, vehicleAPI, beautyAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';

/**
 * Services page component - Sektöre göre farklı içerik gösterir
 * Otomotiv: Araç listesi
 * Güzellik: Hizmet listesi
 */
export const Services = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { tenantSettings, industry: tenantIndustry } = useTenant();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sektör bilgisini user.tenant'tan veya tenantSettings'ten al
  const industry = user?.tenant?.industry || tenantIndustry || tenantSettings?.industry;

  useEffect(() => {
    fetchData();
  }, [industry]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let response;

      if (industry === 'automotive') {
        // Otomotiv: Araç listesi
        response = await vehicleAPI.getAll();
      } else if (industry === 'beauty') {
        // Güzellik: Hizmet listesi
        response = await beautyAPI.getServices();
      } else {
        // Default: Genel servisler
        response = await serviceAPI.getAll();
      }

      setData(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Otomotiv sektörü için araç kolonları
  const vehicleColumns = [
    {
      header: t('vehicles.model', 'Model'),
      accessor: 'model',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Car className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900">{row.brand} {row.model}</p>
            <p className="text-sm text-slate-500">{row.year}</p>
          </div>
        </div>
      ),
    },
    {
      header: t('vehicles.color', 'Renk'),
      accessor: 'color',
      render: (row) => (
        <span className="text-slate-600">{row.color || '-'}</span>
      ),
    },
    {
      header: t('vehicles.price', 'Fiyat'),
      accessor: 'price',
      render: (row) => (
        <span className="text-slate-600">
          {row.price ? `${row.price.toLocaleString()} TL` : 'Sorunuz'}
        </span>
      ),
    },
    {
      header: t('vehicles.status', 'Durum'),
      accessor: 'status',
      render: (row) => (
        <span className={`px-2 py-1 rounded-full text-xs ${
          row.is_available !== false
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {row.is_available !== false ? t('vehicles.available', 'Mevcut') : t('vehicles.sold', 'Satıldı')}
        </span>
      ),
    },
    {
      header: t('common.actions', 'İşlemler'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  // Güzellik sektörü için hizmet kolonları
  const beautyColumns = [
    {
      header: t('services.name'),
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Scissors className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900">{row.name}</p>
            <p className="text-sm text-slate-500">{row.description || ''}</p>
          </div>
        </div>
      ),
    },
    {
      header: t('services.duration'),
      accessor: 'duration_minutes',
      render: (row) => (
        <span className="text-slate-600">{row.duration_minutes || row.duration || 30} dk</span>
      ),
    },
    {
      header: t('services.price'),
      accessor: 'price',
      render: (row) => (
        <span className="text-slate-600">
          {row.price ? `${row.price} TL` : '-'}
        </span>
      ),
    },
    {
      header: t('common.status', 'Durum'),
      accessor: 'is_active',
      render: (row) => (
        <span className={`px-2 py-1 rounded-full text-xs ${
          row.is_active !== false
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-slate-100 text-slate-600'
        }`}>
          {row.is_active !== false ? t('common.active', 'Aktif') : t('common.inactive', 'Pasif')}
        </span>
      ),
    },
    {
      header: t('common.actions', 'İşlemler'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  // Default kolonlar
  const defaultColumns = [
    {
      header: t('services.name'),
      accessor: 'name',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.name}</p>
          <p className="text-sm text-slate-500">{row.description}</p>
        </div>
      ),
    },
    {
      header: t('services.duration'),
      accessor: 'duration',
      render: (row) => (
        <span className="text-slate-600">{row.duration} min</span>
      ),
    },
    {
      header: t('services.price'),
      accessor: 'price',
      render: (row) => (
        <span className="text-slate-600">
          {row.price ? `${row.price} TL` : 'N/A'}
        </span>
      ),
    },
    {
      header: t('common.actions', 'İşlemler'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  // Sektöre göre kolon ve başlık seç
  const getPageConfig = () => {
    if (industry === 'automotive') {
      return {
        title: t('vehicles.title', 'Araçlar'),
        subtitle: t('vehicles.subtitle', 'Araç envanterinizi yönetin'),
        addButton: t('vehicles.addVehicle', 'Araç Ekle'),
        columns: vehicleColumns,
        icon: Car,
      };
    } else if (industry === 'beauty') {
      return {
        title: t('services.title'),
        subtitle: t('services.subtitle', 'Hizmetlerinizi yönetin'),
        addButton: t('services.addService'),
        columns: beautyColumns,
        icon: Scissors,
      };
    }

    return {
      title: t('services.title'),
      subtitle: t('services.subtitle', 'Hizmetlerinizi yönetin'),
      addButton: t('services.addService'),
      columns: defaultColumns,
      icon: null,
    };
  };

  const pageConfig = getPageConfig();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{pageConfig.title}</h1>
          <p className="text-slate-500 mt-1">{pageConfig.subtitle}</p>
        </div>
        <Button variant="primary">
          <Plus className="w-5 h-5 mr-2" />
          {pageConfig.addButton}
        </Button>
      </div>

      {/* Data Table */}
      <Card>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-slate-500">
              {t('common.loading')}
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {industry === 'automotive'
                ? t('vehicles.noVehicles', 'Henüz araç eklenmemiş')
                : t('services.noServices', 'Henüz hizmet eklenmemiş')}
            </div>
          ) : (
            <Table
              columns={pageConfig.columns}
              data={data}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
