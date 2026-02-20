import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, RefreshCw, Loader2, Check } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Modal, ModalFooter } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { adminAPI } from '../../services/api';

const industryPresets = [
  {
    id: 'automotive',
    nameTr: 'Otomotiv',
    descriptionTr: 'Otomobil bayileri ve araç hizmetleri',
    icon: '🚗',
    features: ['Test sürüşü randevusu', 'Araç bilgi sorgusu', 'Servis randevusu'],
  },
  {
    id: 'beauty_salon',
    nameTr: 'Güzellik Salonu',
    descriptionTr: 'Cilt bakımı, tırnak, makyaj ve SPA hizmetleri',
    icon: '💅',
    features: ['Güzellik randevusu', 'Hizmet ve fiyat bilgisi', 'Sadakat programı'],
  },
  {
    id: 'hairdresser',
    nameTr: 'Kuaför',
    descriptionTr: 'Saç kesimi, boyama ve şekillendirme hizmetleri',
    icon: '✂️',
    features: ['Saç randevusu', 'Kuaför seçimi', 'Müşteri geçmişi'],
  },
];

export const Presets = () => {
  const navigate = useNavigate();
  const [syncingPreset, setSyncingPreset] = useState(null);
  const [masterStatus, setMasterStatus] = useState({
    automotive: {},
    beauty_salon: {},
    hairdresser: {},
  });
  const [syncModal, setSyncModal] = useState({ open: false, presetId: null, language: null });
  const [syncResult, setSyncResult] = useState(null);
  const bannerTimerRef = useRef(null);

  useEffect(() => {
    industryPresets.forEach(({ id }) => {
      adminAPI
        .getMasterAssistants(id)
        .then((r) => {
          const list = r.data.data || r.data || [];
          const langs = {};
          list.forEach((a) => {
            langs[a.language] = true;
          });
          setMasterStatus((prev) => ({ ...prev, [id]: langs }));
        })
        .catch(() => {});
    });
  }, []);

  const showBanner = (result) => {
    setSyncResult(result);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setSyncResult(null), 4000);
  };

  const confirmSync = async () => {
    const { presetId, language } = syncModal;
    setSyncModal({ open: false, presetId: null, language: null });
    const syncKey = `${presetId}_${language}`;
    setSyncingPreset(syncKey);
    try {
      const response = await adminAPI.syncPreset(presetId, language);
      const count = response.data.results?.length ?? 0;
      showBanner({
        success: true,
        message: `${count} tenant için ${language.toUpperCase()} asistanı senkronize edildi.`,
      });
      // Refresh master status for this industry
      adminAPI
        .getMasterAssistants(presetId)
        .then((r) => {
          const list = r.data.data || r.data || [];
          const langs = {};
          list.forEach((a) => {
            langs[a.language] = true;
          });
          setMasterStatus((prev) => ({ ...prev, [presetId]: langs }));
        })
        .catch(() => {});
    } catch (error) {
      showBanner({
        success: false,
        message: 'Senkronizasyon başarısız: ' + (error.response?.data?.message || error.message),
      });
    } finally {
      setSyncingPreset(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sektör Ayarları</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sektöre özel asistan konfigürasyonları ve şablonlar
        </p>
      </div>

      {/* Result Banner */}
      {syncResult && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            syncResult.success
              ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
              : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
          }`}
        >
          {syncResult.message}
        </div>
      )}

      {/* Presets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {industryPresets.map((preset) => (
          <div
            key={preset.id}
            className="border border-border rounded-xl overflow-hidden flex flex-col"
          >
            {/* Body */}
            <div className="p-6 flex-1">
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <span className="text-3xl">{preset.icon}</span>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{preset.nameTr}</h3>
                  <p className="text-sm text-muted-foreground">{preset.descriptionTr}</p>
                </div>
              </div>

              {/* Özellikler */}
              <div className="space-y-1.5 mb-5">
                {preset.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                    {f}
                  </div>
                ))}
              </div>

              {/* Master Assistant durumu */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Master:</span>
                {['tr', 'en', 'de'].map((lang) => (
                  <Badge
                    key={lang}
                    variant={masterStatus[preset.id]?.[lang] ? 'success' : 'default'}
                  >
                    {lang.toUpperCase()}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border px-5 py-3 bg-muted/30 flex items-center justify-between">
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/admin/presets/${preset.id}`)}
              >
                <Settings className="w-4 h-4 mr-1.5" />
                Yapılandır
              </Button>
              <div className="flex gap-1">
                {['tr', 'en', 'de'].map((lang) => (
                  <Button
                    key={lang}
                    variant="ghost"
                    size="sm"
                    disabled={syncingPreset === `${preset.id}_${lang}`}
                    onClick={() =>
                      setSyncModal({ open: true, presetId: preset.id, language: lang })
                    }
                    title={`${lang.toUpperCase()} senkronize et`}
                  >
                    {syncingPreset === `${preset.id}_${lang}` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span className="ml-1 text-xs">{lang.toUpperCase()}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sync Confirm Modal */}
      <Modal
        isOpen={syncModal.open}
        onClose={() => setSyncModal({ open: false, presetId: null, language: null })}
        title="Senkronizasyonu Onayla"
        size="sm"
      >
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {industryPresets.find((p) => p.id === syncModal.presetId)?.nameTr}
          </span>{' '}
          sektöründeki tüm tenant&apos;lar için{' '}
          <span className="font-medium text-foreground">{syncModal.language?.toUpperCase()}</span>{' '}
          asistanı oluşturulacak/güncellenecek. Devam etmek istiyor musunuz?
        </p>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => setSyncModal({ open: false, presetId: null, language: null })}
          >
            İptal
          </Button>
          <Button variant="primary" onClick={confirmSync} disabled={syncingPreset !== null}>
            {syncingPreset !== null ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Senkronize Et
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};
