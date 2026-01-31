import { useState, useEffect } from 'react';
import {
  Car,
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Badge } from '../common/Badge';
import { Modal, ModalFooter } from '../common/Modal';
import { vehicleAPI } from '../../services/api';

/**
 * VehicleCatalogEditor - Inline editor for tenant vehicles
 * Used in Use Cases tab when test_drive use case is selected
 */
export const VehicleCatalogEditor = ({ tenantId, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    price: '',
    color: '',
    fuel_type: 'benzin',
    transmission: 'otomatik',
    is_available: true,
  });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteModal, setDeleteModal] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchVehicles();
  }, [tenantId]);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      setError(null);
      // Admin panelinde tenant_id ile filtrele
      const response = await vehicleAPI.getAll({ tenant_id: tenantId });
      setVehicles(response.data.data || response.data || []);
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
      setError('Araçlar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      brand: '',
      model: '',
      year: new Date().getFullYear(),
      price: '',
      color: '',
      fuel_type: 'benzin',
      transmission: 'otomatik',
      is_available: true,
    });
    setEditingVehicle(null);
    setShowForm(false);
  };

  const handleEdit = (vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      brand: vehicle.brand || '',
      model: vehicle.model || '',
      year: vehicle.year || new Date().getFullYear(),
      price: vehicle.price || '',
      color: vehicle.color || '',
      fuel_type: vehicle.fuel_type || 'benzin',
      transmission: vehicle.transmission || 'otomatik',
      is_available: vehicle.is_available !== false,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Admin panelinde tenant_id'yi body'ye ekle
      const payload = { ...formData, tenant_id: tenantId };
      if (editingVehicle) {
        await vehicleAPI.update(editingVehicle.id, payload);
      } else {
        await vehicleAPI.create(payload);
      }
      await fetchVehicles();
      resetForm();
    } catch (err) {
      console.error('Failed to save vehicle:', err);
      alert('Kaydetme hatası: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!vehicleToDelete) return;
    try {
      setDeleting(true);
      await vehicleAPI.delete(vehicleToDelete.id);
      await fetchVehicles();
      setDeleteModal(false);
      setVehicleToDelete(null);
    } catch (err) {
      console.error('Failed to delete vehicle:', err);
      alert('Silme hatası: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeleting(false);
    }
  };

  const formatPrice = (price) => {
    if (!price) return '-';
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Car className="w-5 h-5 text-indigo-600" />
          <div className="text-left">
            <h4 className="font-medium text-slate-900">Araç Kataloğu</h4>
            <p className="text-sm text-slate-500">test_drive use case için gerekli</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">{vehicles.length} araç</Badge>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Add Button */}
          <div className="mb-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Araç Ekle
            </Button>
          </div>

          {/* Form */}
          {showForm && (
            <div className="mb-4 p-4 border border-indigo-200 bg-indigo-50 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h5 className="font-medium text-slate-900">
                  {editingVehicle ? 'Araç Düzenle' : 'Yeni Araç Ekle'}
                </h5>
                <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Input
                  label="Marka"
                  placeholder="BMW"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                />
                <Input
                  label="Model"
                  placeholder="320i"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                />
                <Input
                  label="Yıl"
                  type="number"
                  placeholder="2024"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                />
                <Input
                  label="Fiyat (TL)"
                  type="number"
                  placeholder="1250000"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                />
                <Input
                  label="Renk"
                  placeholder="Beyaz"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">Yakıt</label>
                  <select
                    value={formData.fuel_type}
                    onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                    className="input w-full"
                  >
                    <option value="benzin">Benzin</option>
                    <option value="dizel">Dizel</option>
                    <option value="elektrik">Elektrik</option>
                    <option value="hibrit">Hibrit</option>
                    <option value="lpg">LPG</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">Vites</label>
                  <select
                    value={formData.transmission}
                    onChange={(e) => setFormData({ ...formData, transmission: e.target.value })}
                    className="input w-full"
                  >
                    <option value="otomatik">Otomatik</option>
                    <option value="manuel">Manuel</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_available}
                      onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">Müsait</span>
                  </label>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  İptal
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !formData.brand || !formData.model}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Kaydet
                </Button>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Vehicle List */}
          {!loading && !error && vehicles.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <Car className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Henüz araç eklenmemiş</p>
            </div>
          )}

          {!loading && !error && vehicles.length > 0 && (
            <div className="space-y-2">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <Car className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">
                        {vehicle.brand} {vehicle.model}
                      </p>
                      <p className="text-sm text-slate-500">
                        {vehicle.year} • {vehicle.fuel_type} • {vehicle.transmission}
                        {vehicle.color && ` • ${vehicle.color}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-900">{formatPrice(vehicle.price)}</span>
                    <Badge variant={vehicle.is_available ? 'success' : 'error'}>
                      {vehicle.is_available ? 'Müsait' : 'Dolu'}
                    </Badge>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(vehicle)}
                        className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4 text-slate-600" />
                      </button>
                      <button
                        onClick={() => {
                          setVehicleToDelete(vehicle);
                          setDeleteModal(true);
                        }}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModal}
        onClose={() => {
          setDeleteModal(false);
          setVehicleToDelete(null);
        }}
        title="Aracı Sil"
        size="sm"
      >
        <div className="text-center py-4">
          <p className="text-slate-600">
            <span className="font-semibold text-slate-900">
              {vehicleToDelete?.brand} {vehicleToDelete?.model}
            </span>{' '}
            aracını silmek istediğinize emin misiniz?
          </p>
        </div>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setDeleteModal(false);
              setVehicleToDelete(null);
            }}
          >
            İptal
          </Button>
          <Button
            variant="primary"
            className="!bg-red-500 hover:!bg-red-600"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Sil
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default VehicleCatalogEditor;
