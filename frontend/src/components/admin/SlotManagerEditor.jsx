import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Save, Loader2, ChevronDown, ChevronUp, Check, X, Clock, Settings } from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { slotAPI, adminAPI } from '../../services/api';

// Turkish month names
const monthNames = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

// Turkish day names
const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

// Days of week for working hours
const daysOfWeek = [
  { id: 'monday', label: 'Pazartesi', short: 'Pzt' },
  { id: 'tuesday', label: 'Salı', short: 'Sal' },
  { id: 'wednesday', label: 'Çarşamba', short: 'Çar' },
  { id: 'thursday', label: 'Perşembe', short: 'Per' },
  { id: 'friday', label: 'Cuma', short: 'Cum' },
  { id: 'saturday', label: 'Cumartesi', short: 'Cmt' },
  { id: 'sunday', label: 'Pazar', short: 'Paz' },
];

const defaultWorkingHours = {
  monday: { open: '09:00', close: '18:00', closed: false },
  tuesday: { open: '09:00', close: '18:00', closed: false },
  wednesday: { open: '09:00', close: '18:00', closed: false },
  thursday: { open: '09:00', close: '18:00', closed: false },
  friday: { open: '09:00', close: '18:00', closed: false },
  saturday: { open: '10:00', close: '16:00', closed: false },
  sunday: { open: '00:00', close: '00:00', closed: true },
};

/**
 * SlotManagerEditor - All-in-one calendar for working hours and slot management
 */
export const SlotManagerEditor = ({ tenantId, tenant, onTenantUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeView, setActiveView] = useState('calendar'); // 'calendar' | 'settings'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Working hours state
  const [workingHours, setWorkingHours] = useState(tenant?.working_hours || defaultWorkingHours);
  const [savingHours, setSavingHours] = useState(false);
  const [hoursChanged, setHoursChanged] = useState(false);

  // Get current month/year
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  useEffect(() => {
    if (tenant?.working_hours) {
      setWorkingHours(tenant.working_hours);
    }
  }, [tenant?.working_hours]);

  // Navigate months
  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(currentYear, currentMonth, day));
    }
    return days;
  };

  // Get day of week string from date
  const getDayOfWeek = (date) => {
    if (!date) return '';
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  };

  // Check if a day is closed based on working hours
  const isDayClosed = (date) => {
    if (!date) return false;
    const dayId = getDayOfWeek(date);
    const hours = workingHours[dayId] || defaultWorkingHours[dayId];
    return hours?.closed === true;
  };

  // Format date as YYYY-MM-DD
  const formatDateISO = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format date for display
  const formatDateDisplay = (date) => {
    if (!date) return '';
    const dayName = daysOfWeek.find(d => d.id === getDayOfWeek(date))?.label || '';
    return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()} - ${dayName}`;
  };

  // Handle date selection
  const handleDateSelect = async (date) => {
    if (!date) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return;

    setSelectedDate(date);
    setHasChanges(false);

    // If day is closed, don't fetch slots
    if (isDayClosed(date)) {
      setSlots([]);
      return;
    }

    try {
      setLoading(true);
      const response = await slotAPI.getSlots(tenantId, formatDateISO(date));
      setSlots(response.data || []);
    } catch (error) {
      console.error('Failed to fetch slots:', error);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  // Toggle slot availability
  const toggleSlot = (slotTime) => {
    setSlots(prev => prev.map(slot => {
      if (slot.slot_time === slotTime) {
        return { ...slot, is_available: !slot.is_available };
      }
      return slot;
    }));
    setHasChanges(true);
  };

  // Save slots
  const handleSaveSlots = async () => {
    if (!selectedDate || slots.length === 0) return;

    try {
      setSaving(true);
      const slotsToSave = slots.map(slot => ({
        slot_date: formatDateISO(selectedDate),
        slot_time: slot.slot_time,
        is_available: slot.is_available,
      }));

      await slotAPI.bulkUpdate(tenantId, slotsToSave);
      setHasChanges(false);

      const response = await slotAPI.getSlots(tenantId, formatDateISO(selectedDate));
      setSlots(response.data || []);
    } catch (error) {
      console.error('Failed to save slots:', error);
      alert('Slot kaydetme hatası: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Working hours handlers
  const handleHourChange = (dayId, field, value) => {
    setWorkingHours(prev => ({
      ...prev,
      [dayId]: { ...prev[dayId], [field]: value },
    }));
    setHoursChanged(true);
  };

  const toggleDayClosed = (dayId) => {
    setWorkingHours(prev => ({
      ...prev,
      [dayId]: { ...prev[dayId], closed: !prev[dayId]?.closed },
    }));
    setHoursChanged(true);
  };

  const handleSaveWorkingHours = async () => {
    try {
      setSavingHours(true);
      await adminAPI.updateTenant(tenantId, { working_hours: workingHours });
      setHoursChanged(false);
      if (onTenantUpdate) {
        onTenantUpdate({ ...tenant, working_hours: workingHours });
      }
      // Refresh selected date slots if any
      if (selectedDate && !isDayClosed(selectedDate)) {
        const response = await slotAPI.getSlots(tenantId, formatDateISO(selectedDate));
        setSlots(response.data || []);
      } else if (selectedDate) {
        setSlots([]);
      }
    } catch (error) {
      console.error('Failed to save working hours:', error);
      alert('Kaydetme hatası: ' + error.message);
    } finally {
      setSavingHours(false);
    }
  };

  // Check helpers
  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date) => {
    if (!date || !selectedDate) return false;
    return date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear();
  };

  const isPast = (date) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const calendarDays = generateCalendarDays();

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <div className="text-left">
            <h4 className="font-medium text-slate-900">Takvim & Slot Yönetimi</h4>
            <p className="text-sm text-slate-500">Çalışma saatleri ve randevu slotları</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(hasChanges || hoursChanged) && (
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
        <div className="p-4">
          {/* View Toggle */}
          <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-lg w-fit">
            <button
              onClick={() => setActiveView('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeView === 'calendar'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Takvim
            </button>
            <button
              onClick={() => setActiveView('settings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeView === 'settings'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings className="w-4 h-4" />
              Haftalık Ayarlar
            </button>
          </div>

          {/* Calendar View */}
          {activeView === 'calendar' && (
            <>
              {/* Calendar Navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={goToPrevMonth}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <h3 className="text-lg font-semibold text-slate-900">
                  {monthNames[currentMonth]} {currentYear}
                </h3>
                <button
                  onClick={goToNextMonth}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              {/* Calendar Grid - Full Width */}
              <div className="mb-4">
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {dayNames.map(day => (
                    <div key={day} className="text-center text-sm font-medium text-slate-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((date, idx) => {
                    const closed = isDayClosed(date);
                    const past = isPast(date);
                    const today = isToday(date);
                    const selected = isSelected(date);
                    const isOpen = !closed && !past;

                    return (
                      <button
                        key={idx}
                        onClick={() => handleDateSelect(date)}
                        disabled={!date || past}
                        className={`
                          h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-all
                          ${!date ? 'invisible' : ''}
                          ${past ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}
                          ${today ? 'ring-2 ring-indigo-400' : ''}
                          ${selected ? 'bg-indigo-600 text-white hover:bg-indigo-700' : ''}
                          ${closed && !past && !selected ? 'bg-red-100 text-red-500' : ''}
                          ${isOpen && !selected ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : ''}
                        `}
                      >
                        {date?.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-xs text-slate-500 mb-4 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"></div>
                  <span>Açık</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>
                  <span>Kapalı</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-indigo-600"></div>
                  <span>Seçili</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-slate-100 border border-slate-200"></div>
                  <span>Geçmiş</span>
                </div>
              </div>

              {/* Selected Date Section */}
              {selectedDate && (
                <div className="pt-2">
                  <h4 className="font-medium text-slate-900 mb-4">
                    {formatDateDisplay(selectedDate)}
                  </h4>

                  {isDayClosed(selectedDate) ? (
                    <div className="text-center py-8 bg-red-50 rounded-lg border border-red-200">
                      <X className="w-12 h-12 mx-auto mb-2 text-red-300" />
                      <p className="text-red-600 font-medium">Bu gün kapalı</p>
                      <p className="text-sm text-red-500 mt-1">
                        Haftalık ayarlardan bu günü açabilirsiniz.
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={() => setActiveView('settings')}
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        Ayarlara Git
                      </Button>
                    </div>
                  ) : loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Clock className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p>Bu gün için slot oluşturulmamış.</p>
                      <p className="text-sm mt-1">Haftalık ayarlardan çalışma saatlerini kontrol edin.</p>
                    </div>
                  ) : (
                    <>
                      {/* Quick Actions */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSlots(prev => prev.map(slot => ({ ...slot, is_available: true })));
                              setHasChanges(true);
                            }}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Tümünü Aç
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSlots(prev => prev.map(slot => ({ ...slot, is_available: false })));
                              setHasChanges(true);
                            }}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Tümünü Kapat
                          </Button>
                        </div>
                        <span className="text-sm text-slate-500">
                          {slots.filter(s => s.is_available).length}/{slots.length} açık
                        </span>
                      </div>

                      {/* Slot Grid */}
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 mb-4">
                        {slots.map((slot) => (
                          <button
                            key={slot.slot_time}
                            onClick={() => toggleSlot(slot.slot_time)}
                            className={`
                              flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                              ${slot.is_available
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200'
                                : 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200'
                              }
                            `}
                          >
                            <span>{slot.slot_time}</span>
                            {slot.is_available ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Save Button */}
                      {hasChanges && (
                        <div className="flex justify-end pt-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSaveSlots}
                            disabled={saving}
                          >
                            {saving ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4 mr-2" />
                            )}
                            Slotları Kaydet
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {!selectedDate && (
                <div className="text-center py-8 text-slate-500">
                  <Calendar className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>Slotları görüntülemek için takvimden bir tarih seçin.</p>
                </div>
              )}
            </>
          )}

          {/* Weekly Settings View */}
          {activeView === 'settings' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-4">
                Haftalık çalışma saatlerinizi ayarlayın. Kapalı günlerde slot oluşturulmaz.
              </p>

              {daysOfWeek.map((day) => {
                const hours = workingHours[day.id] || defaultWorkingHours[day.id];
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
                            value={hours.open || '09:00'}
                            className="input py-1 px-2 w-28 text-sm"
                            onChange={(e) => handleHourChange(day.id, 'open', e.target.value)}
                          />
                          <span className="text-slate-400">-</span>
                          <input
                            type="time"
                            value={hours.close || '18:00'}
                            className="input py-1 px-2 w-28 text-sm"
                            onChange={(e) => handleHourChange(day.id, 'close', e.target.value)}
                          />
                        </div>
                      )}
                      <button
                        onClick={() => toggleDayClosed(day.id)}
                        className={`text-xs px-3 py-1.5 rounded font-medium ${
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

              {/* Save Working Hours */}
              {hoursChanged && (
                <div className="pt-3 flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveWorkingHours}
                    disabled={savingHours}
                  >
                    {savingHours ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Çalışma Saatlerini Kaydet
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SlotManagerEditor;
