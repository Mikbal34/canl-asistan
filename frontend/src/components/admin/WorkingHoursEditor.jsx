import { useState, useEffect } from 'react';
import { Clock, Save, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { adminAPI } from '../../services/api';

// Days of week
const daysOfWeek = [
  { id: 'monday', label: 'Pazartesi' },
  { id: 'tuesday', label: 'Salı' },
  { id: 'wednesday', label: 'Çarşamba' },
  { id: 'thursday', label: 'Perşembe' },
  { id: 'friday', label: 'Cuma' },
  { id: 'saturday', label: 'Cumartesi' },
  { id: 'sunday', label: 'Pazar' },
];

const defaultHours = {
  monday: { open: '09:00', close: '18:00', closed: false },
  tuesday: { open: '09:00', close: '18:00', closed: false },
  wednesday: { open: '09:00', close: '18:00', closed: false },
  thursday: { open: '09:00', close: '18:00', closed: false },
  friday: { open: '09:00', close: '18:00', closed: false },
  saturday: { open: '10:00', close: '16:00', closed: false },
  sunday: { open: '00:00', close: '00:00', closed: true },
};

/**
 * WorkingHoursEditor - Inline editor for tenant working hours
 * Used in Use Cases tab when business_info use case is selected
 */
export const WorkingHoursEditor = ({ tenant, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [workingHours, setWorkingHours] = useState(tenant?.working_hours || defaultHours);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (tenant?.working_hours) {
      setWorkingHours(tenant.working_hours);
    }
  }, [tenant?.working_hours]);

  const handleHourChange = (dayId, field, value) => {
    setWorkingHours(prev => ({
      ...prev,
      [dayId]: { ...prev[dayId], [field]: value },
    }));
    setHasChanges(true);
  };

  const toggleClosed = (dayId) => {
    setWorkingHours(prev => ({
      ...prev,
      [dayId]: { ...prev[dayId], closed: !prev[dayId]?.closed },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await adminAPI.updateTenant(tenant.id, { working_hours: workingHours });
      setHasChanges(false);
      if (onUpdate) {
        onUpdate({ ...tenant, working_hours: workingHours });
      }
      alert('Çalışma saatleri kaydedildi');
    } catch (error) {
      console.error('Failed to save working hours:', error);
      alert('Kaydetme hatası: ' + error.message);
    } finally {
      setSaving(false);
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
          <Clock className="w-5 h-5 text-indigo-600" />
          <div className="text-left">
            <h4 className="font-medium text-slate-900">Çalışma Saatleri</h4>
            <p className="text-sm text-slate-500">business_info use case için gerekli</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="warning">Kaydedilmemiş</Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {daysOfWeek.map((day) => {
            const hours = workingHours[day.id] || { open: '09:00', close: '18:00', closed: false };
            return (
              <div key={day.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="w-24 text-slate-900 font-medium">{day.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  {hours.closed ? (
                    <Badge variant="error">Kapalı</Badge>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={hours.open}
                        className="input py-1 px-2 w-28"
                        onChange={(e) => handleHourChange(day.id, 'open', e.target.value)}
                      />
                      <span className="text-slate-400">-</span>
                      <input
                        type="time"
                        value={hours.close}
                        className="input py-1 px-2 w-28"
                        onChange={(e) => handleHourChange(day.id, 'close', e.target.value)}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => toggleClosed(day.id)}
                    className={`text-xs px-2 py-1 rounded ${
                      hours.closed
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    {hours.closed ? 'Aç' : 'Kapat'}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Save Button */}
          {hasChanges && (
            <div className="pt-3 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Kaydet
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkingHoursEditor;
