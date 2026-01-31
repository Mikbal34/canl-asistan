import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Scissors,
  Clock,
  Plus,
  Trash2,
  Upload,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { onboardingAPI } from '../../../services/api';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';

const SERVICE_CATEGORIES = [
  { value: 'hair', label: 'Sac', icon: '💇' },
  { value: 'nails', label: 'Tirnak', icon: '💅' },
  { value: 'skin', label: 'Cilt Bakimi', icon: '✨' },
  { value: 'makeup', label: 'Makyaj', icon: '💄' },
  { value: 'massage', label: 'Masaj', icon: '💆' },
  { value: 'other', label: 'Diger', icon: '🌟' },
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 dk' },
  { value: 30, label: '30 dk' },
  { value: 45, label: '45 dk' },
  { value: 60, label: '1 saat' },
  { value: 90, label: '1.5 saat' },
  { value: 120, label: '2 saat' },
];

const DAYS = [
  { value: 1, label: 'Pazartesi' },
  { value: 2, label: 'Sali' },
  { value: 3, label: 'Carsamba' },
  { value: 4, label: 'Persembe' },
  { value: 5, label: 'Cuma' },
  { value: 6, label: 'Cumartesi' },
  { value: 0, label: 'Pazar' },
];

const DEFAULT_HOURS = {
  1: { open_time: '09:00', close_time: '19:00', is_open: true },
  2: { open_time: '09:00', close_time: '19:00', is_open: true },
  3: { open_time: '09:00', close_time: '19:00', is_open: true },
  4: { open_time: '09:00', close_time: '19:00', is_open: true },
  5: { open_time: '09:00', close_time: '19:00', is_open: true },
  6: { open_time: '10:00', close_time: '18:00', is_open: true },
  0: { open_time: '', close_time: '', is_open: false },
};

/**
 * Step 2: Hizmet Katalogu & Calisma Saatleri (Beauty Industry)
 */
export const Step2ServicesSetup = ({ data, industry, onUpdate, onNext, onBack }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  // Aktif tab: 'services' veya 'hours'
  const [activeTab, setActiveTab] = useState('services');

  // Service form state
  const [services, setServices] = useState(data.services || []);
  const [newService, setNewService] = useState({
    name: '',
    category: 'hair',
    duration_minutes: 60,
    price: '',
    description: '',
    is_active: true,
  });

  // Working hours state
  const [workingHours, setWorkingHours] = useState(() => {
    if (data.workingHours && data.workingHours.length > 0) {
      const hoursMap = {};
      data.workingHours.forEach((h) => {
        hoursMap[h.day_of_week] = h;
      });
      return hoursMap;
    }
    return DEFAULT_HOURS;
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Yeni hizmet ekle
  const handleAddService = () => {
    if (!newService.name) {
      setError('Hizmet adi zorunludur');
      return;
    }

    setServices([...services, { ...newService, id: Date.now() }]);
    setNewService({
      name: '',
      category: 'hair',
      duration_minutes: 60,
      price: '',
      description: '',
      is_active: true,
    });
    setError('');
  };

  // Hizmet sil
  const handleRemoveService = (id) => {
    setServices(services.filter((s) => s.id !== id));
  };

  // CSV yukle
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const { data: result } = await onboardingAPI.uploadServicesCSV(file);

      if (result.services) {
        setServices([...services, ...result.services.map((s, i) => ({ ...s, id: Date.now() + i }))]);
      }
    } catch (err) {
      console.error('CSV upload error:', err);
      setError(err.response?.data?.message || 'CSV yukleme hatasi');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Calisma saati degistir
  const handleHoursChange = (day, field, value) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  // Gun acik/kapali toggle
  const handleDayToggle = (day) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        is_open: !prev[day]?.is_open,
      },
    }));
  };

  // Kaydet ve devam et
  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      // Hizmetleri kaydet (varsa)
      if (services.length > 0) {
        await onboardingAPI.uploadServices(services, false);
      } else {
        // Hizmetsiz devam et
        await onboardingAPI.uploadServices([], true);
      }

      // Calisma saatlerini kaydet
      const hoursArray = Object.entries(workingHours).map(([day, hours]) => ({
        day_of_week: parseInt(day),
        ...hours,
      }));
      await onboardingAPI.setWorkingHours(hoursArray);

      // Wizard data guncelle
      onUpdate({
        services,
        servicesSkipped: services.length === 0,
        workingHours: hoursArray,
      });

      // Sonraki adim
      onNext();
    } catch (err) {
      console.error('Save error:', err);
      setError(err.response?.data?.message || 'Kaydetme hatasi');
    } finally {
      setLoading(false);
    }
  };

  // Kategori bilgisini getir
  const getCategoryInfo = (categoryValue) => {
    return SERVICE_CATEGORIES.find(c => c.value === categoryValue) || SERVICE_CATEGORIES[5];
  };

  return (
    <div className="p-8">
      {/* Step Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-pink-100">
            <Scissors className="w-6 h-6 text-pink-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Hizmetler & Calisma Saatleri</h2>
        </div>
        <p className="text-slate-500">
          Sundugunuz hizmetleri ve calisma saatlerinizi tanimlayın
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('services')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'services'
              ? 'bg-pink-100 text-pink-600'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          <Scissors className="w-5 h-5" />
          Hizmetler ({services.length})
        </button>
        <button
          onClick={() => setActiveTab('hours')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'hours'
              ? 'bg-pink-100 text-pink-600'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          <Clock className="w-5 h-5" />
          Calisma Saatleri
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-600">
          {error}
        </div>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && (
        <div className="space-y-6">
          {/* Upload Option */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-6 h-6 text-slate-400" />
              <div>
                <p className="text-slate-900 font-medium">CSV ile Toplu Yukle</p>
                <p className="text-sm text-slate-500">Hizmet, Kategori, Sure, Fiyat, Aciklama</p>
              </div>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <Upload className="w-4 h-4 mr-2" />
                CSV Yukle
              </Button>
            </div>
          </div>

          {/* Add Service Form */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Yeni Hizmet Ekle</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Input
                label="Hizmet Adi *"
                placeholder="Sac Kesimi"
                value={newService.name}
                onChange={(e) => setNewService({ ...newService, name: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Kategori</label>
                <select
                  value={newService.category}
                  onChange={(e) => setNewService({ ...newService, category: e.target.value })}
                  className="input"
                >
                  {SERVICE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Sure</label>
                <select
                  value={newService.duration_minutes}
                  onChange={(e) => setNewService({ ...newService, duration_minutes: parseInt(e.target.value) })}
                  className="input"
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Fiyat (TL)"
                type="number"
                placeholder="150"
                value={newService.price}
                onChange={(e) => setNewService({ ...newService, price: e.target.value })}
              />
              <Input
                label="Aciklama"
                placeholder="Hizmet detayi..."
                value={newService.description}
                onChange={(e) => setNewService({ ...newService, description: e.target.value })}
              />
              <div className="flex items-end">
                <Button onClick={handleAddService} variant="primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Ekle
                </Button>
              </div>
            </div>
          </div>

          {/* Service List */}
          {services.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-slate-900">Eklenen Hizmetler</h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {services.map((service) => {
                  const category = getCategoryInfo(service.category);
                  return (
                    <div
                      key={service.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">{category.icon}</span>
                        <div>
                          <p className="text-slate-900 font-medium">
                            {service.name}
                          </p>
                          <p className="text-sm text-slate-500">
                            {category.label} - {service.duration_minutes} dk
                            {service.price && ` - ${service.price} TL`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveService(service.id)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Scissors className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Henuz hizmet eklenmedi</p>
              <p className="text-sm mt-1">Hizmetleri sonra da ekleyebilirsiniz</p>
            </div>
          )}
        </div>
      )}

      {/* Working Hours Tab */}
      {activeTab === 'hours' && (
        <div className="space-y-4">
          <p className="text-slate-500 mb-4">
            Asistanin randevu alabilmesi icin calisma saatlerinizi belirleyin
          </p>

          {DAYS.map((day) => {
            const hours = workingHours[day.value] || DEFAULT_HOURS[day.value];

            return (
              <div
                key={day.value}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                  hours?.is_open
                    ? 'bg-white border-slate-200'
                    : 'bg-slate-50 border-slate-100 opacity-60'
                }`}
              >
                {/* Day name */}
                <div className="w-28">
                  <span className="text-slate-900 font-medium">{day.label}</span>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => handleDayToggle(day.value)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    hours?.is_open ? 'bg-pink-500' : 'bg-slate-200'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      hours?.is_open ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>

                {/* Status */}
                <span className={`w-16 text-sm ${hours?.is_open ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {hours?.is_open ? 'Acik' : 'Kapali'}
                </span>

                {/* Time inputs */}
                {hours?.is_open && (
                  <>
                    <input
                      type="time"
                      value={hours.open_time || '09:00'}
                      onChange={(e) => handleHoursChange(day.value, 'open_time', e.target.value)}
                      className="input w-32"
                    />
                    <span className="text-slate-500">-</span>
                    <input
                      type="time"
                      value={hours.close_time || '19:00'}
                      onChange={(e) => handleHoursChange(day.value, 'close_time', e.target.value)}
                      className="input w-32"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6 mt-6 border-t border-slate-200">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="w-5 h-5 mr-2" />
          Geri
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Kaydediliyor...
            </>
          ) : (
            <>
              Devam Et
              <ChevronRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
