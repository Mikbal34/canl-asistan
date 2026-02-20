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
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Badge } from '../common/Badge';
import { Modal, ModalFooter } from '../common/Modal';
import { Skeleton } from '../common/Skeleton';
import { vehicleAPI } from '../../services/api';

/**
 * VehicleCatalogEditor - Inline editor for tenant vehicles
 * Used in Use Cases tab when test_drive use case is selected
 */
export const VehicleCatalogEditor = ({ tenantId, onUpdate, mode = 'admin' }) => {
  const showCollapsible = mode === 'admin';
  const [isExpanded, setIsExpanded] = useState(false);
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
    <div className={showCollapsible ? "border border-border rounded-lg overflow-hidden" : ""}>
      {/* Header - only in admin mode */}
      {showCollapsible && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4 bg-muted/40 hover:bg-muted/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Car className="w-5 h-5 text-indigo-600" />
            <div className="text-left">
              <h4 className="font-medium text-foreground">Araç Kataloğu</h4>
              <p className="text-sm text-muted-foreground">test_drive use case için gerekli</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="info">{vehicles.length} araç</Badge>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </button>
      )}

      {/* Content */}
      {(showCollapsible ? isExpanded : true) && (
        <div className={showCollapsible ? "p-4" : ""}>
          {/* Stat cards + Add Button — tenant mode only */}
          {!showCollapsible && (
            <div className="mb-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Toplam */}
                <div className="border border-border rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center shrink-0">
                    <Car className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground leading-none">{vehicles.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Toplam Araç</p>
                  </div>
                </div>
                {/* Müsait */}
                <div className="border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 flex items-center gap-3 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 leading-none">{vehicles.filter(v => v.is_available).length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Müsait</p>
                  </div>
                </div>
                {/* Dolu */}
                <div className="border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-center gap-3 bg-red-50/50 dark:bg-red-950/20">
                  <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-950/50 flex items-center justify-center shrink-0">
                    <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 leading-none">{vehicles.filter(v => !v.is_available).length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Dolu</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="secondary" size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Araç Ekle
                </Button>
              </div>
            </div>
          )}

          {/* Add Button — admin mode only */}
          {showCollapsible && (
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
          )}

          {/* Form */}
          {showForm && (
            <div className="mb-4 p-4 border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h5 className="font-medium text-foreground">
                  {editingVehicle ? 'Araç Düzenle' : 'Yeni Araç Ekle'}
                </h5>
                <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
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
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Yakıt</label>
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
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Vites</label>
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
                      className="w-4 h-4 rounded border-border"
                    />
                    <span className="text-sm text-foreground">Müsait</span>
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
          {loading && !showCollapsible && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border border-border rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton width="2.5rem" height="2.5rem" rounded="rounded-lg" />
                      <div className="space-y-1">
                        <Skeleton width="7rem" height="1rem" />
                        <Skeleton width="3rem" height="0.75rem" />
                      </div>
                    </div>
                    <Skeleton width="3.5rem" height="1.25rem" rounded="rounded-full" />
                  </div>
                  <div className="flex gap-1.5">
                    <Skeleton width="3.5rem" height="1.25rem" rounded="rounded-md" />
                    <Skeleton width="4rem" height="1.25rem" rounded="rounded-md" />
                  </div>
                  <div className="border-t border-border pt-3 flex items-center justify-between">
                    <Skeleton width="5rem" height="1.25rem" />
                    <Skeleton width="4rem" height="1.75rem" rounded="rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {loading && showCollapsible && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/40">
                  <Skeleton width="2.5rem" height="2.5rem" rounded="rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton width="40%" height="1rem" />
                    <Skeleton width="60%" height="0.75rem" />
                  </div>
                  <Skeleton width="5rem" height="1.5rem" rounded="rounded-full" />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Vehicle List */}
          {!loading && !error && vehicles.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Car className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p>Henüz araç eklenmemiş</p>
            </div>
          )}

          {/* Tenant mode — grid cards */}
          {!loading && !error && vehicles.length > 0 && !showCollapsible && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-colors">
                  {/* Header: icon + name + badge */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center shrink-0">
                        <Car className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground leading-tight">{vehicle.brand} {vehicle.model}</p>
                        <p className="text-sm text-muted-foreground">{vehicle.year}</p>
                      </div>
                    </div>
                    <Badge variant={vehicle.is_available ? 'success' : 'error'}>
                      {vehicle.is_available ? 'Müsait' : 'Dolu'}
                    </Badge>
                  </div>

                  {/* Feature pills */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground capitalize">{vehicle.fuel_type}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground capitalize">{vehicle.transmission}</span>
                    {vehicle.color && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground">{vehicle.color}</span>}
                  </div>

                  {/* Price + actions */}
                  <div className="border-t border-border pt-3 flex items-center justify-between">
                    <span className="font-semibold text-foreground text-lg">{formatPrice(vehicle.price)}</span>
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(vehicle)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <Edit3 className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button onClick={() => { setVehicleToDelete(vehicle); setDeleteModal(true); }} className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Admin mode — flat list */}
          {!loading && !error && vehicles.length > 0 && showCollapsible && (
            <div className="space-y-2">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/60"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center">
                      <Car className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {vehicle.brand} {vehicle.model}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {vehicle.year} • {vehicle.fuel_type} • {vehicle.transmission}
                        {vehicle.color && ` • ${vehicle.color}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-foreground">{formatPrice(vehicle.price)}</span>
                    <Badge variant={vehicle.is_available ? 'success' : 'error'}>
                      {vehicle.is_available ? 'Müsait' : 'Dolu'}
                    </Badge>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(vehicle)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4 text-muted-foreground" />
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
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">
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
