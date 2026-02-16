import { useState, useEffect } from 'react';
import {
  Tag,
  Ticket,
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Percent,
  Calendar,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Badge } from '../common/Badge';
import { Modal, ModalFooter } from '../common/Modal';
import { Skeleton } from '../common/Skeleton';
import { promotionsAPI, adminPromotionsAPI } from '../../services/api';

// Discount types
const discountTypes = [
  { id: 'percentage', label: 'Yüzde (%)' },
  { id: 'fixed', label: 'Sabit Tutar (TL)' },
];

/**
 * PromotionsEditor - Inline editor for tenant campaigns and promo codes
 * Used in Use Cases tab when promotions use case is selected
 */
export const PromotionsEditor = ({ tenantId, onUpdate, mode = 'admin' }) => {
  const isAdmin = mode === 'admin';
  const showCollapsible = isAdmin;

  // API selection based on mode
  const api = isAdmin ? {
    getCampaigns: () => adminPromotionsAPI.getCampaigns(tenantId),
    createCampaign: (data) => adminPromotionsAPI.createCampaign(tenantId, data),
    updateCampaign: (id, data) => adminPromotionsAPI.updateCampaign(tenantId, id, data),
    deleteCampaign: (id) => adminPromotionsAPI.deleteCampaign(tenantId, id),
    getPromoCodes: () => adminPromotionsAPI.getPromoCodes(tenantId),
    createPromoCode: (data) => adminPromotionsAPI.createPromoCode(tenantId, data),
    updatePromoCode: (id, data) => adminPromotionsAPI.updatePromoCode(tenantId, id, data),
    deletePromoCode: (id) => adminPromotionsAPI.deletePromoCode(tenantId, id),
  } : {
    getCampaigns: () => promotionsAPI.getCampaigns(),
    createCampaign: (data) => promotionsAPI.createCampaign(data),
    updateCampaign: (id, data) => promotionsAPI.updateCampaign(id, data),
    deleteCampaign: (id) => promotionsAPI.deleteCampaign(id),
    getPromoCodes: () => promotionsAPI.getPromoCodes(),
    createPromoCode: (data) => promotionsAPI.createPromoCode(data),
    updatePromoCode: (id, data) => promotionsAPI.updatePromoCode(id, data),
    deletePromoCode: (id) => promotionsAPI.deletePromoCode(id),
  };
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeSection, setActiveSection] = useState('campaigns'); // 'campaigns' | 'codes'

  // Campaigns state
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState(null);

  // Promo codes state
  const [promoCodes, setPromoCodes] = useState([]);
  const [promoCodesLoading, setPromoCodesLoading] = useState(true);
  const [promoCodesError, setPromoCodesError] = useState(null);

  // Campaign form
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    start_date: '',
    end_date: '',
    is_active: true,
  });
  const [savingCampaign, setSavingCampaign] = useState(false);

  // Promo code form
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [promoForm, setPromoForm] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    max_uses: '',
    expires_at: '',
    is_active: true,
  });
  const [savingPromo, setSavingPromo] = useState(false);

  // Delete state
  const [deleteModal, setDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCampaigns();
    fetchPromoCodes();
  }, [tenantId]);

  const fetchCampaigns = async () => {
    try {
      setCampaignsLoading(true);
      setCampaignsError(null);
      const response = await api.getCampaigns();
      setCampaigns(response.data.data || response.data || []);
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
      if (err.response?.status === 404) {
        setCampaigns([]);
      } else {
        setCampaignsError('Kampanyalar yüklenirken hata oluştu');
      }
    } finally {
      setCampaignsLoading(false);
    }
  };

  const fetchPromoCodes = async () => {
    try {
      setPromoCodesLoading(true);
      setPromoCodesError(null);
      const response = await api.getPromoCodes();
      setPromoCodes(response.data.data || response.data || []);
    } catch (err) {
      console.error('Failed to fetch promo codes:', err);
      if (err.response?.status === 404) {
        setPromoCodes([]);
      } else {
        setPromoCodesError('Promosyon kodları yüklenirken hata oluştu');
      }
    } finally {
      setPromoCodesLoading(false);
    }
  };

  // Campaign handlers
  const resetCampaignForm = () => {
    setCampaignForm({
      name: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      start_date: '',
      end_date: '',
      is_active: true,
    });
    setEditingCampaign(null);
    setShowCampaignForm(false);
  };

  const handleEditCampaign = (campaign) => {
    setEditingCampaign(campaign);
    setCampaignForm({
      name: campaign.name || '',
      description: campaign.description || '',
      discount_type: campaign.discount_type || 'percentage',
      discount_value: campaign.discount_value || '',
      start_date: campaign.start_date ? campaign.start_date.split('T')[0] : '',
      end_date: campaign.end_date ? campaign.end_date.split('T')[0] : '',
      is_active: campaign.is_active !== false,
    });
    setShowCampaignForm(true);
  };

  const handleSaveCampaign = async () => {
    try {
      setSavingCampaign(true);
      if (editingCampaign) {
        await api.updateCampaign(editingCampaign.id, campaignForm);
      } else {
        await api.createCampaign(campaignForm);
      }
      await fetchCampaigns();
      resetCampaignForm();
    } catch (err) {
      console.error('Failed to save campaign:', err);
      alert('Kaydetme hatası: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingCampaign(false);
    }
  };

  // Promo code handlers
  const resetPromoForm = () => {
    setPromoForm({
      code: '',
      discount_type: 'percentage',
      discount_value: '',
      max_uses: '',
      expires_at: '',
      is_active: true,
    });
    setEditingPromo(null);
    setShowPromoForm(false);
  };

  const handleEditPromo = (promo) => {
    setEditingPromo(promo);
    setPromoForm({
      code: promo.code || '',
      discount_type: promo.discount_type || 'percentage',
      discount_value: promo.discount_value || '',
      max_uses: promo.max_uses || '',
      expires_at: promo.expires_at ? promo.expires_at.split('T')[0] : '',
      is_active: promo.is_active !== false,
    });
    setShowPromoForm(true);
  };

  const handleSavePromo = async () => {
    try {
      setSavingPromo(true);
      if (editingPromo) {
        await api.updatePromoCode(editingPromo.id, promoForm);
      } else {
        await api.createPromoCode(promoForm);
      }
      await fetchPromoCodes();
      resetPromoForm();
    } catch (err) {
      console.error('Failed to save promo code:', err);
      alert('Kaydetme hatası: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingPromo(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!itemToDelete || !deleteType) return;
    try {
      setDeleting(true);
      if (deleteType === 'campaign') {
        await api.deleteCampaign(itemToDelete.id);
        await fetchCampaigns();
      } else {
        await api.deletePromoCode(itemToDelete.id);
        await fetchPromoCodes();
      }
      setDeleteModal(false);
      setItemToDelete(null);
      setDeleteType(null);
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('Silme hatası: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeleting(false);
    }
  };

  const formatDiscount = (type, value) => {
    if (!value) return '-';
    return type === 'percentage' ? `%${value}` : `${value} TL`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('tr-TR');
  };

  return (
    <div className={showCollapsible ? "border border-slate-200 rounded-lg overflow-hidden" : ""}>
      {/* Header - only in admin mode */}
      {showCollapsible && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Tag className="w-5 h-5 text-amber-600" />
            <div className="text-left">
              <h4 className="font-medium text-slate-900">Kampanya & Promosyon Yönetimi</h4>
              <p className="text-sm text-slate-500">promotions use case için gerekli</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="info">{campaigns.length} kampanya</Badge>
            <Badge variant="warning">{promoCodes.length} kod</Badge>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </button>
      )}

      {/* Content */}
      {(showCollapsible ? isExpanded : true) && (
        <div className={showCollapsible ? "p-4" : ""}>
          {/* Section Tabs */}
          <div className="flex gap-2 mb-4 border-b border-slate-200 pb-3">
            <button
              onClick={() => setActiveSection('campaigns')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSection === 'campaigns'
                  ? 'bg-amber-100 text-amber-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Percent className="w-4 h-4" />
              Kampanyalar
            </button>
            <button
              onClick={() => setActiveSection('codes')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSection === 'codes'
                  ? 'bg-amber-100 text-amber-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Ticket className="w-4 h-4" />
              Promosyon Kodları
            </button>
          </div>

          {/* CAMPAIGNS SECTION */}
          {activeSection === 'campaigns' && (
            <div>
              {/* Add Button */}
              <div className="mb-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    resetCampaignForm();
                    setShowCampaignForm(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Kampanya Ekle
                </Button>
              </div>

              {/* Campaign Form */}
              {showCampaignForm && (
                <div className="mb-4 p-4 border border-amber-200 bg-amber-50 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="font-medium text-slate-900">
                      {editingCampaign ? 'Kampanyayı Düzenle' : 'Yeni Kampanya Ekle'}
                    </h5>
                    <button onClick={resetCampaignForm} className="text-slate-400 hover:text-slate-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Input
                      label="Kampanya Adı"
                      placeholder="Yaz İndirimi"
                      value={campaignForm.name}
                      onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                    />
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">İndirim Tipi</label>
                      <select
                        value={campaignForm.discount_type}
                        onChange={(e) => setCampaignForm({ ...campaignForm, discount_type: e.target.value })}
                        className="input w-full"
                      >
                        {discountTypes.map((dt) => (
                          <option key={dt.id} value={dt.id}>
                            {dt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Input
                      label={campaignForm.discount_type === 'percentage' ? 'İndirim (%)' : 'İndirim (TL)'}
                      type="number"
                      placeholder={campaignForm.discount_type === 'percentage' ? '20' : '100'}
                      value={campaignForm.discount_value}
                      onChange={(e) => setCampaignForm({ ...campaignForm, discount_value: e.target.value })}
                    />
                    <Input
                      label="Başlangıç Tarihi"
                      type="date"
                      value={campaignForm.start_date}
                      onChange={(e) => setCampaignForm({ ...campaignForm, start_date: e.target.value })}
                    />
                    <Input
                      label="Bitiş Tarihi"
                      type="date"
                      value={campaignForm.end_date}
                      onChange={(e) => setCampaignForm({ ...campaignForm, end_date: e.target.value })}
                    />
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={campaignForm.is_active}
                          onChange={(e) => setCampaignForm({ ...campaignForm, is_active: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">Aktif</span>
                      </label>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-slate-600 mb-2">Açıklama</label>
                      <textarea
                        value={campaignForm.description}
                        onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                        placeholder="Kampanya detayları..."
                        className="input w-full h-16 resize-none"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={resetCampaignForm}>
                      İptal
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveCampaign}
                      disabled={savingCampaign || !campaignForm.name}
                    >
                      {savingCampaign ? (
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
              {campaignsLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50">
                      <Skeleton width="2.5rem" height="2.5rem" rounded="rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton width="35%" height="1rem" />
                        <Skeleton width="55%" height="0.75rem" />
                      </div>
                      <Skeleton width="4rem" height="1.5rem" rounded="rounded-full" />
                    </div>
                  ))}
                </div>
              )}

              {/* Error */}
              {campaignsError && (
                <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span>{campaignsError}</span>
                </div>
              )}

              {/* Campaign List */}
              {!campaignsLoading && !campaignsError && campaigns.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Percent className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Henüz kampanya eklenmemiş</p>
                </div>
              )}

              {!campaignsLoading && !campaignsError && campaigns.length > 0 && (
                <div className="space-y-2">
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                          <Percent className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{campaign.name}</p>
                          <p className="text-sm text-slate-500">
                            {formatDiscount(campaign.discount_type, campaign.discount_value)}
                            {campaign.start_date && campaign.end_date && (
                              <span className="ml-2">
                                • {formatDate(campaign.start_date)} - {formatDate(campaign.end_date)}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={campaign.is_active ? 'success' : 'error'}>
                          {campaign.is_active ? 'Aktif' : 'Pasif'}
                        </Badge>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditCampaign(campaign)}
                            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4 text-slate-600" />
                          </button>
                          <button
                            onClick={() => {
                              setItemToDelete(campaign);
                              setDeleteType('campaign');
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

          {/* PROMO CODES SECTION */}
          {activeSection === 'codes' && (
            <div>
              {/* Add Button */}
              <div className="mb-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    resetPromoForm();
                    setShowPromoForm(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Promosyon Kodu Ekle
                </Button>
              </div>

              {/* Promo Code Form */}
              {showPromoForm && (
                <div className="mb-4 p-4 border border-amber-200 bg-amber-50 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="font-medium text-slate-900">
                      {editingPromo ? 'Kodu Düzenle' : 'Yeni Promosyon Kodu'}
                    </h5>
                    <button onClick={resetPromoForm} className="text-slate-400 hover:text-slate-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Input
                      label="Kod"
                      placeholder="YAZ2024"
                      value={promoForm.code}
                      onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                    />
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">İndirim Tipi</label>
                      <select
                        value={promoForm.discount_type}
                        onChange={(e) => setPromoForm({ ...promoForm, discount_type: e.target.value })}
                        className="input w-full"
                      >
                        {discountTypes.map((dt) => (
                          <option key={dt.id} value={dt.id}>
                            {dt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Input
                      label={promoForm.discount_type === 'percentage' ? 'İndirim (%)' : 'İndirim (TL)'}
                      type="number"
                      placeholder={promoForm.discount_type === 'percentage' ? '15' : '50'}
                      value={promoForm.discount_value}
                      onChange={(e) => setPromoForm({ ...promoForm, discount_value: e.target.value })}
                    />
                    <Input
                      label="Maksimum Kullanım"
                      type="number"
                      placeholder="100"
                      value={promoForm.max_uses}
                      onChange={(e) => setPromoForm({ ...promoForm, max_uses: e.target.value })}
                    />
                    <Input
                      label="Son Kullanım Tarihi"
                      type="date"
                      value={promoForm.expires_at}
                      onChange={(e) => setPromoForm({ ...promoForm, expires_at: e.target.value })}
                    />
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={promoForm.is_active}
                          onChange={(e) => setPromoForm({ ...promoForm, is_active: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">Aktif</span>
                      </label>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={resetPromoForm}>
                      İptal
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSavePromo}
                      disabled={savingPromo || !promoForm.code}
                    >
                      {savingPromo ? (
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
              {promoCodesLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50">
                      <Skeleton width="2.5rem" height="2.5rem" rounded="rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton width="30%" height="1rem" />
                        <Skeleton width="50%" height="0.75rem" />
                      </div>
                      <Skeleton width="4rem" height="1.5rem" rounded="rounded-full" />
                    </div>
                  ))}
                </div>
              )}

              {/* Error */}
              {promoCodesError && (
                <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span>{promoCodesError}</span>
                </div>
              )}

              {/* Promo Code List */}
              {!promoCodesLoading && !promoCodesError && promoCodes.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Ticket className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Henüz promosyon kodu eklenmemiş</p>
                </div>
              )}

              {!promoCodesLoading && !promoCodesError && promoCodes.length > 0 && (
                <div className="space-y-2">
                  {promoCodes.map((promo) => (
                    <div
                      key={promo.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                          <Ticket className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 font-mono">{promo.code}</p>
                          <p className="text-sm text-slate-500">
                            {formatDiscount(promo.discount_type, promo.discount_value)}
                            {promo.max_uses && (
                              <span className="ml-2">
                                • {promo.used_count || 0}/{promo.max_uses} kullanım
                              </span>
                            )}
                            {promo.expires_at && (
                              <span className="ml-2">
                                • {formatDate(promo.expires_at)}'e kadar
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={promo.is_active ? 'success' : 'error'}>
                          {promo.is_active ? 'Aktif' : 'Pasif'}
                        </Badge>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditPromo(promo)}
                            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4 text-slate-600" />
                          </button>
                          <button
                            onClick={() => {
                              setItemToDelete(promo);
                              setDeleteType('promo');
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
        </div>
      )}

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModal}
        onClose={() => {
          setDeleteModal(false);
          setItemToDelete(null);
          setDeleteType(null);
        }}
        title={deleteType === 'campaign' ? 'Kampanyayı Sil' : 'Promosyon Kodunu Sil'}
        size="sm"
      >
        <div className="text-center py-4">
          <p className="text-slate-600">
            <span className="font-semibold text-slate-900">
              {deleteType === 'campaign' ? itemToDelete?.name : itemToDelete?.code}
            </span>{' '}
            {deleteType === 'campaign' ? 'kampanyasını' : 'kodunu'} silmek istediğinize emin misiniz?
          </p>
        </div>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setDeleteModal(false);
              setItemToDelete(null);
              setDeleteType(null);
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

export default PromotionsEditor;
