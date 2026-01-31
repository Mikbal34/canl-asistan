import { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Search,
  Filter,
  ChevronDown,
  Box,
  Wrench,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useCaseAPI } from '../../services/api';

/**
 * Admin Use Case Configuration Page
 * Manage use cases, tools, and prompt sections
 */
export const UseCaseConfig = () => {
  const [useCases, setUseCases] = useState([]);
  const [availableTools, setAvailableTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUseCase, setEditingUseCase] = useState(null);
  const [saving, setSaving] = useState(false);

  // Category config
  const categoryConfig = {
    core: { label: 'Temel', color: 'bg-blue-100 text-blue-700' },
    automotive: { label: 'Otomotiv', color: 'bg-cyan-100 text-cyan-700' },
    beauty: { label: 'Güzellik', color: 'bg-pink-100 text-pink-700' },
    addon: { label: 'Ek Özellik', color: 'bg-purple-100 text-purple-700' },
  };

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [useCasesRes, toolsRes] = await Promise.all([
          useCaseAPI.adminGetAll(),
          useCaseAPI.adminGetTools(),
        ]);

        setUseCases(useCasesRes.data || []);
        setAvailableTools(toolsRes.data || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Veriler yüklenirken bir hata oluştu');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter use cases
  const filteredUseCases = useCases.filter(uc => {
    const matchesCategory = categoryFilter === 'all' || uc.category === categoryFilter;
    const matchesSearch = !searchQuery ||
      uc.name_tr?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uc.id?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Open edit modal
  const openEditModal = (useCase = null) => {
    if (useCase) {
      setEditingUseCase({ ...useCase });
    } else {
      // New use case template
      setEditingUseCase({
        id: '',
        name_tr: '',
        name_en: '',
        description_tr: '',
        description_en: '',
        category: 'addon',
        tools: [],
        prompt_section_tr: '',
        prompt_section_en: '',
        is_default: false,
        display_order: useCases.length + 1,
        icon: 'Box',
      });
    }
    setEditModalOpen(true);
  };

  // Close edit modal
  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingUseCase(null);
  };

  // Save use case
  const saveUseCase = async () => {
    if (!editingUseCase.id || !editingUseCase.name_tr) {
      setError('ID ve Türkçe ad zorunludur');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const isNew = !useCases.find(uc => uc.id === editingUseCase.id);

      if (isNew) {
        const { data } = await useCaseAPI.adminCreate(editingUseCase);
        setUseCases(prev => [...prev, data]);
      } else {
        const { data } = await useCaseAPI.adminUpdate(editingUseCase.id, editingUseCase);
        setUseCases(prev => prev.map(uc => uc.id === data.id ? data : uc));
      }

      setSuccessMessage(isNew ? 'Use case oluşturuldu' : 'Use case güncellendi');
      setTimeout(() => setSuccessMessage(null), 3000);
      closeEditModal();
    } catch (err) {
      console.error('Error saving use case:', err);
      setError(err.response?.data?.message || 'Kaydedilirken bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  // Delete use case
  const deleteUseCase = async (id) => {
    if (!confirm('Bu use case\'i silmek istediğinizden emin misiniz?')) return;

    try {
      await useCaseAPI.adminDelete(id);
      setUseCases(prev => prev.filter(uc => uc.id !== id));
      setSuccessMessage('Use case silindi');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error deleting use case:', err);
      setError('Silinirken bir hata oluştu');
    }
  };

  // Toggle tool in editing use case
  const toggleTool = (toolName) => {
    setEditingUseCase(prev => ({
      ...prev,
      tools: prev.tools.includes(toolName)
        ? prev.tools.filter(t => t !== toolName)
        : [...prev.tools, toolName],
    }));
  };

  // Get icon component
  const getIcon = (iconName) => {
    return LucideIcons[iconName] || Box;
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
        <p className="text-slate-500">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Use Case Yönetimi</h1>
          <p className="text-slate-500 mt-1">
            Asistan özelliklerini ve tool'larını yapılandırın
          </p>
        </div>
        <button
          onClick={() => openEditModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-600/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Yeni Use Case
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-700">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <p className="text-emerald-700">{successMessage}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Category Filter */}
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="all">Tüm Kategoriler</option>
            <option value="core">Temel</option>
            <option value="automotive">Otomotiv</option>
            <option value="beauty">Güzellik</option>
            <option value="addon">Ek Özellik</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Use Cases Table */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">Use Case</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">Kategori</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">Tool Sayısı</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">Varsayılan</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filteredUseCases.map((useCase) => {
              const Icon = getIcon(useCase.icon);
              const catConfig = categoryConfig[useCase.category] || categoryConfig.addon;

              return (
                <tr key={useCase.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-slate-900 font-medium">{useCase.name_tr}</p>
                        <p className="text-sm text-slate-400">{useCase.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded ${catConfig.color}`}>
                      {catConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-900">{useCase.tools?.length || 0}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {useCase.is_default ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(useCase)}
                        className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteUseCase(useCase.id)}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredUseCases.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            {searchQuery || categoryFilter !== 'all'
              ? 'Filtrelere uygun use case bulunamadı'
              : 'Henüz use case eklenmemiş'}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModalOpen && editingUseCase && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                {useCases.find(uc => uc.id === editingUseCase.id) ? 'Use Case Düzenle' : 'Yeni Use Case'}
              </h2>
              <button
                onClick={closeEditModal}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    ID <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingUseCase.id}
                    onChange={(e) => setEditingUseCase(prev => ({ ...prev, id: e.target.value }))}
                    placeholder="test_drive"
                    disabled={useCases.find(uc => uc.id === editingUseCase.id)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-gray-500 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Kategori</label>
                  <select
                    value={editingUseCase.category}
                    onChange={(e) => setEditingUseCase(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="core">Temel</option>
                    <option value="automotive">Otomotiv</option>
                    <option value="beauty">Güzellik</option>
                    <option value="addon">Ek Özellik</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    Türkçe Ad <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingUseCase.name_tr}
                    onChange={(e) => setEditingUseCase(prev => ({ ...prev, name_tr: e.target.value }))}
                    placeholder="Test Sürüşü Randevusu"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">İngilizce Ad</label>
                  <input
                    type="text"
                    value={editingUseCase.name_en || ''}
                    onChange={(e) => setEditingUseCase(prev => ({ ...prev, name_en: e.target.value }))}
                    placeholder="Test Drive Appointment"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Türkçe Açıklama</label>
                  <input
                    type="text"
                    value={editingUseCase.description_tr || ''}
                    onChange={(e) => setEditingUseCase(prev => ({ ...prev, description_tr: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Icon</label>
                  <input
                    type="text"
                    value={editingUseCase.icon || ''}
                    onChange={(e) => setEditingUseCase(prev => ({ ...prev, icon: e.target.value }))}
                    placeholder="Car, Scissors, Calendar..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingUseCase.is_default}
                    onChange={(e) => setEditingUseCase(prev => ({ ...prev, is_default: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 bg-slate-50 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-600">Varsayılan olarak seçili</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-500">Sıra:</label>
                  <input
                    type="number"
                    value={editingUseCase.display_order}
                    onChange={(e) => setEditingUseCase(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                    className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-900 text-center focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Tools */}
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-2">
                  Tool'lar ({editingUseCase.tools?.length || 0} seçili)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                  {availableTools.map((tool) => (
                    <label
                      key={tool.name}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        editingUseCase.tools?.includes(tool.name)
                          ? 'bg-indigo-600/20 border border-indigo-400'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={editingUseCase.tools?.includes(tool.name)}
                        onChange={() => toggleTool(tool.name)}
                        className="w-4 h-4 rounded border-slate-300 bg-slate-50 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-600 truncate" title={tool.description}>
                        {tool.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Prompt Section */}
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">
                  Türkçe Prompt Bölümü
                </label>
                <textarea
                  value={editingUseCase.prompt_section_tr || ''}
                  onChange={(e) => setEditingUseCase(prev => ({ ...prev, prompt_section_tr: e.target.value }))}
                  placeholder="## Test Sürüşü&#10;1. Müşterinin ilgilendiği aracı sor..."
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-gray-500 focus:border-indigo-500 focus:outline-none font-mono text-sm"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 text-slate-500 hover:text-slate-900 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={saveUseCase}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-600/90 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Kaydediliyor...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Kaydet
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UseCaseConfig;
