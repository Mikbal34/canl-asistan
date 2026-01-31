import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Star,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Badge } from '../common/Badge';
import { Modal, ModalFooter } from '../common/Modal';
import api from '../../services/api';

// Staff API helper (tenant-scoped)
const staffAPI = {
  getAll: () => api.get('/api/staff'),
  create: (data) => api.post('/api/staff', data),
  update: (id, data) => api.put(`/api/staff/${id}`, data),
  delete: (id) => api.delete(`/api/staff/${id}`),
};

/**
 * StaffEditor - Inline editor for tenant staff members
 * Used in Use Cases tab when staff_selection use case is selected
 */
export const StaffEditor = ({ tenantId, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    specialties: '',
    phone: '',
    email: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteModal, setDeleteModal] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, [tenantId]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await staffAPI.getAll();
      setStaff(response.data.data || response.data || []);
    } catch (err) {
      console.error('Failed to fetch staff:', err);
      // API henüz yoksa boş liste göster
      if (err.response?.status === 404) {
        setStaff([]);
      } else {
        setError('Personel listesi yüklenirken hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      role: '',
      specialties: '',
      phone: '',
      email: '',
      is_active: true,
    });
    setEditingStaff(null);
    setShowForm(false);
  };

  const handleEdit = (member) => {
    setEditingStaff(member);
    setFormData({
      name: member.name || '',
      role: member.role || '',
      specialties: Array.isArray(member.specialties)
        ? member.specialties.join(', ')
        : member.specialties || '',
      phone: member.phone || '',
      email: member.email || '',
      is_active: member.is_active !== false,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        ...formData,
        specialties: formData.specialties
          ? formData.specialties.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      };

      if (editingStaff) {
        await staffAPI.update(editingStaff.id, payload);
      } else {
        await staffAPI.create(payload);
      }
      await fetchStaff();
      resetForm();
    } catch (err) {
      console.error('Failed to save staff:', err);
      alert('Kaydetme hatası: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!staffToDelete) return;
    try {
      setDeleting(true);
      await staffAPI.delete(staffToDelete.id);
      await fetchStaff();
      setDeleteModal(false);
      setStaffToDelete(null);
    } catch (err) {
      console.error('Failed to delete staff:', err);
      alert('Silme hatası: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-emerald-600" />
          <div className="text-left">
            <h4 className="font-medium text-slate-900">Personel Listesi</h4>
            <p className="text-sm text-slate-500">staff_selection use case için gerekli</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">{staff.length} personel</Badge>
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
              Personel Ekle
            </Button>
          </div>

          {/* Form */}
          {showForm && (
            <div className="mb-4 p-4 border border-emerald-200 bg-emerald-50 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h5 className="font-medium text-slate-900">
                  {editingStaff ? 'Personeli Düzenle' : 'Yeni Personel Ekle'}
                </h5>
                <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Input
                  label="Ad Soyad"
                  placeholder="Ayşe Yılmaz"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                <Input
                  label="Ünvan / Rol"
                  placeholder="Uzman Kuaför"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                />
                <Input
                  label="Uzmanlık Alanları"
                  placeholder="Saç kesimi, Boyama, Fön"
                  value={formData.specialties}
                  onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
                />
                <Input
                  label="Telefon"
                  placeholder="+90 555 123 4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="personel@firma.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
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
              <p className="text-xs text-slate-500 mt-2">
                * Uzmanlık alanlarını virgülle ayırarak yazın
              </p>
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
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Staff List */}
          {!loading && !error && staff.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Henüz personel eklenmemiş</p>
            </div>
          )}

          {!loading && !error && staff.length > 0 && (
            <div className="space-y-2">
              {staff.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{member.name}</p>
                      <p className="text-sm text-slate-500">
                        {member.role}
                        {member.specialties && member.specialties.length > 0 && (
                          <span className="ml-2">
                            •{' '}
                            {Array.isArray(member.specialties)
                              ? member.specialties.slice(0, 2).join(', ')
                              : member.specialties}
                            {Array.isArray(member.specialties) && member.specialties.length > 2 && (
                              <span className="text-slate-400">
                                {' '}
                                +{member.specialties.length - 2}
                              </span>
                            )}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {member.rating && (
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-medium">{member.rating}</span>
                      </div>
                    )}
                    <Badge variant={member.is_active ? 'success' : 'error'}>
                      {member.is_active ? 'Aktif' : 'Pasif'}
                    </Badge>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(member)}
                        className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4 text-slate-600" />
                      </button>
                      <button
                        onClick={() => {
                          setStaffToDelete(member);
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
          setStaffToDelete(null);
        }}
        title="Personeli Sil"
        size="sm"
      >
        <div className="text-center py-4">
          <p className="text-slate-600">
            <span className="font-semibold text-slate-900">{staffToDelete?.name}</span> personelini
            silmek istediğinize emin misiniz?
          </p>
        </div>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setDeleteModal(false);
              setStaffToDelete(null);
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

export default StaffEditor;
