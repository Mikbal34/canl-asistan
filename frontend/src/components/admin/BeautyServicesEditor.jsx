import { useState, useEffect } from 'react';
import {
  Scissors,
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
import { serviceAPI } from '../../services/api';

// Service categories
const serviceCategories = [
  { id: 'cilt', label: 'Cilt Bakımı' },
  { id: 'tirnak', label: 'Tırnak Bakımı' },
  { id: 'makyaj', label: 'Makyaj' },
  { id: 'spa', label: 'SPA' },
  { id: 'sac', label: 'Saç' },
  { id: 'diger', label: 'Diğer' },
];

/**
 * BeautyServicesEditor - Inline editor for tenant beauty services
 * Used in Use Cases tab when beauty_services use case is selected
 */
export const BeautyServicesEditor = ({ tenantId, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'cilt',
    duration: 60,
    price: '',
    description: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteModal, setDeleteModal] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchServices();
  }, [tenantId]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await serviceAPI.getAll(tenantId);
      setServices(response.data.data || response.data || []);
    } catch (err) {
      console.error('Failed to fetch services:', err);
      setError('Hizmetler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'cilt',
      duration: 60,
      price: '',
      description: '',
      is_active: true,
    });
    setEditingService(null);
    setShowForm(false);
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name || '',
      category: service.category || 'cilt',
      duration: service.duration || 60,
      price: service.price || '',
      description: service.description || '',
      is_active: service.is_active !== false,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (editingService) {
        await serviceAPI.update(editingService.id, formData, tenantId);
      } else {
        await serviceAPI.create(formData, tenantId);
      }
      await fetchServices();
      resetForm();
    } catch (err) {
      console.error('Failed to save service:', err);
      alert('Kaydetme hatası: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!serviceToDelete) return;
    try {
      setDeleting(true);
      await serviceAPI.delete(serviceToDelete.id, tenantId);
      await fetchServices();
      setDeleteModal(false);
      setServiceToDelete(null);
    } catch (err) {
      console.error('Failed to delete service:', err);
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

  const formatDuration = (minutes) => {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes} dk`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} sa ${mins} dk` : `${hours} sa`;
  };

  const getCategoryLabel = (categoryId) => {
    const cat = serviceCategories.find((c) => c.id === categoryId);
    return cat?.label || categoryId;
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Scissors className="w-5 h-5 text-pink-600" />
          <div className="text-left">
            <h4 className="font-medium text-slate-900">Hizmet Kataloğu</h4>
            <p className="text-sm text-slate-500">beauty_services use case için gerekli</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">{services.length} hizmet</Badge>
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
              Hizmet Ekle
            </Button>
          </div>

          {/* Form */}
          {showForm && (
            <div className="mb-4 p-4 border border-pink-200 bg-pink-50 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h5 className="font-medium text-slate-900">
                  {editingService ? 'Hizmeti Düzenle' : 'Yeni Hizmet Ekle'}
                </h5>
                <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Input
                  label="Hizmet Adı"
                  placeholder="Cilt Bakımı"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">Kategori</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input w-full"
                  >
                    {serviceCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Süre (dk)"
                  type="number"
                  placeholder="60"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                />
                <Input
                  label="Fiyat (TL)"
                  type="number"
                  placeholder="500"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                />
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-2">Açıklama</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Hizmet hakkında kısa açıklama..."
                    className="input w-full h-20 resize-none"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">Aktif</span>
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
                  disabled={saving || !formData.name}
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
              <Loader2 className="w-6 h-6 animate-spin text-pink-600" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Service List */}
          {!loading && !error && services.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <Scissors className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Henüz hizmet eklenmemiş</p>
            </div>
          )}

          {!loading && !error && services.length > 0 && (
            <div className="space-y-2">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center">
                      <Scissors className="w-5 h-5 text-pink-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{service.name}</p>
                      <p className="text-sm text-slate-500">
                        {getCategoryLabel(service.category)} • {formatDuration(service.duration)}
                        {service.description && ` • ${service.description.substring(0, 30)}...`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-900">{formatPrice(service.price)}</span>
                    <Badge variant={service.is_active ? 'success' : 'error'}>
                      {service.is_active ? 'Aktif' : 'Pasif'}
                    </Badge>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(service)}
                        className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4 text-slate-600" />
                      </button>
                      <button
                        onClick={() => {
                          setServiceToDelete(service);
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
          setServiceToDelete(null);
        }}
        title="Hizmeti Sil"
        size="sm"
      >
        <div className="text-center py-4">
          <p className="text-slate-600">
            <span className="font-semibold text-slate-900">{serviceToDelete?.name}</span> hizmetini
            silmek istediğinize emin misiniz?
          </p>
        </div>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setDeleteModal(false);
              setServiceToDelete(null);
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

export default BeautyServicesEditor;
