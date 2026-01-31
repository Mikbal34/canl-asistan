import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Car,
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

const FUEL_TYPES = [
  { value: 'benzin', label: 'Benzin' },
  { value: 'dizel', label: 'Dizel' },
  { value: 'hibrit', label: 'Hibrit' },
  { value: 'elektrik', label: 'Elektrik' },
  { value: 'lpg', label: 'LPG' },
];

const TRANSMISSION_TYPES = [
  { value: 'otomatik', label: 'Otomatik' },
  { value: 'manuel', label: 'Manuel' },
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
  1: { open_time: '09:00', close_time: '18:00', is_open: true },
  2: { open_time: '09:00', close_time: '18:00', is_open: true },
  3: { open_time: '09:00', close_time: '18:00', is_open: true },
  4: { open_time: '09:00', close_time: '18:00', is_open: true },
  5: { open_time: '09:00', close_time: '18:00', is_open: true },
  6: { open_time: '10:00', close_time: '16:00', is_open: true },
  0: { open_time: '', close_time: '', is_open: false },
};

/**
 * Step 2: Arac Katalogu & Calisma Saatleri (Automotive Industry)
 */
export const Step2VehiclesSetup = ({ data, industry = 'automotive', onUpdate, onNext, onBack }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  // Aktif tab: 'vehicles' veya 'hours'
  const [activeTab, setActiveTab] = useState('vehicles');

  // Vehicle form state
  const [vehicles, setVehicles] = useState(data.vehicles || []);
  const [newVehicle, setNewVehicle] = useState({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    fuel_type: 'benzin',
    transmission: 'otomatik',
    price: '',
    is_available: true,
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
  const [uploadMode, setUploadMode] = useState(false);

  // Yeni arac ekle
  const handleAddVehicle = () => {
    if (!newVehicle.brand || !newVehicle.model) {
      setError('Marka ve model zorunludur');
      return;
    }

    setVehicles([...vehicles, { ...newVehicle, id: Date.now() }]);
    setNewVehicle({
      brand: '',
      model: '',
      year: new Date().getFullYear(),
      color: '',
      fuel_type: 'benzin',
      transmission: 'otomatik',
      price: '',
      is_available: true,
    });
    setError('');
  };

  // Arac sil
  const handleRemoveVehicle = (id) => {
    setVehicles(vehicles.filter((v) => v.id !== id));
  };

  // CSV yukle
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const { data: result } = await onboardingAPI.uploadVehiclesCSV(file);

      if (result.vehicles) {
        setVehicles([...vehicles, ...result.vehicles.map((v, i) => ({ ...v, id: Date.now() + i }))]);
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
      // Araclari kaydet (varsa)
      if (vehicles.length > 0) {
        await onboardingAPI.uploadVehicles(vehicles, false);
      } else {
        // Aracsiz devam et
        await onboardingAPI.uploadVehicles([], true);
      }

      // Calisma saatlerini kaydet
      const hoursArray = Object.entries(workingHours).map(([day, hours]) => ({
        day_of_week: parseInt(day),
        ...hours,
      }));
      await onboardingAPI.setWorkingHours(hoursArray);

      // Wizard data guncelle
      onUpdate({
        vehicles,
        vehiclesSkipped: vehicles.length === 0,
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

  return (
    <div className="p-8">
      {/* Step Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-indigo-100">
            <Car className="w-6 h-6 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Arac Katalogu & Calisma Saatleri</h2>
        </div>
        <p className="text-slate-500">
          Arac envanterinizi ve calisma saatlerinizi tanimlayın
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('vehicles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'vehicles'
              ? 'bg-indigo-100 text-indigo-600'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          <Car className="w-5 h-5" />
          Araclar ({vehicles.length})
        </button>
        <button
          onClick={() => setActiveTab('hours')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'hours'
              ? 'bg-indigo-100 text-indigo-600'
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

      {/* Vehicles Tab */}
      {activeTab === 'vehicles' && (
        <div className="space-y-6">
          {/* Upload Option */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-6 h-6 text-slate-400" />
              <div>
                <p className="text-slate-900 font-medium">CSV ile Toplu Yukle</p>
                <p className="text-sm text-slate-500">Marka, Model, Yil, Renk, Yakit, Vites, Fiyat</p>
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

          {/* Add Vehicle Form */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Manuel Arac Ekle</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Input
                label="Marka *"
                placeholder="Toyota"
                value={newVehicle.brand}
                onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })}
              />
              <Input
                label="Model *"
                placeholder="Corolla"
                value={newVehicle.model}
                onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
              />
              <Input
                label="Yil"
                type="number"
                value={newVehicle.year}
                onChange={(e) => setNewVehicle({ ...newVehicle, year: parseInt(e.target.value) })}
              />
              <Input
                label="Renk"
                placeholder="Beyaz"
                value={newVehicle.color}
                onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Yakit</label>
                <select
                  value={newVehicle.fuel_type}
                  onChange={(e) => setNewVehicle({ ...newVehicle, fuel_type: e.target.value })}
                  className="input"
                >
                  {FUEL_TYPES.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Vites</label>
                <select
                  value={newVehicle.transmission}
                  onChange={(e) => setNewVehicle({ ...newVehicle, transmission: e.target.value })}
                  className="input"
                >
                  {TRANSMISSION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Fiyat"
                type="number"
                placeholder="1.250.000"
                value={newVehicle.price}
                onChange={(e) => setNewVehicle({ ...newVehicle, price: e.target.value })}
              />
              <div className="flex items-end">
                <Button onClick={handleAddVehicle} variant="primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Ekle
                </Button>
              </div>
            </div>
          </div>

          {/* Vehicle List */}
          {vehicles.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-slate-900">Eklenen Araclar</h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {vehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200"
                  >
                    <div className="flex items-center gap-4">
                      <Car className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-slate-900 font-medium">
                          {vehicle.brand} {vehicle.model}
                        </p>
                        <p className="text-sm text-slate-500">
                          {vehicle.year} - {vehicle.color} - {vehicle.fuel_type} - {vehicle.transmission}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveVehicle(vehicle.id)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Car className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Henuz arac eklenmedi</p>
              <p className="text-sm mt-1">Araclari sonra da ekleyebilirsiniz</p>
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
                    hours?.is_open ? 'bg-indigo-600' : 'bg-slate-200'
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
                      value={hours.close_time || '18:00'}
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
