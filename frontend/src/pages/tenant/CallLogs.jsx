import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, Clock, MessageSquare, CheckCircle2, PhoneCall } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Skeleton } from '../../components/common/Skeleton';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import { callLogAPI } from '../../services/api';

export const CallLogs = () => {
  const { t } = useTranslation();
  const [selectedCall, setSelectedCall] = useState(null);

  const { data: callLogs, loading, error } = useCachedFetch('call-logs', async () => {
    const response = await callLogAPI.getAll();
    return response.data?.data || response.data || [];
  });

  const formatDate = useCallback((dateString) =>
    new Date(dateString).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), []);

  const formatDuration = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getOutcomeVariant = useCallback((outcome) => {
    const variants = {
      completed: 'success', 'no-answer': 'warning', busy: 'warning', failed: 'error',
      'in-progress': 'info', 'in_progress': 'info', appointment_booked: 'success',
      information_provided: 'info', call_back_later: 'warning', not_interested: 'error',
      'customer-ended-call': 'info', 'assistant-ended-call': 'success',
      'assistant-said-end-call-phrase': 'success', 'assistant-forwarded-call': 'info',
      'customer-did-not-answer': 'warning', 'customer-busy': 'warning',
      'silence-timed-out': 'warning', voicemail: 'warning', 'exceeded-max-duration': 'warning',
      'manually-canceled': 'warning', 'phone-call-provider-closed-websocket': 'error',
      'pipeline-error-openai-llm-failed': 'error', 'assistant-error': 'error',
      'no-customer-audio': 'error', 'unknown-error': 'error',
    };
    return variants[outcome] || 'info';
  }, []);

  const getOutcomeLabel = useCallback((outcome) => {
    if (!outcome) return '';
    return t(`callLogs.outcomes.${outcome}`, outcome.replace(/[-_.]/g, ' '));
  }, [t]);

  const safeCallLogs = callLogs || [];

  const successOutcomes = new Set(['completed', 'appointment_booked', 'information_provided', 'assistant-ended-call', 'assistant-said-end-call-phrase']);
  const successCount = safeCallLogs.filter(c => successOutcomes.has(c.outcome)).length;
  const avgDuration = safeCallLogs.length > 0
    ? Math.round(safeCallLogs.reduce((sum, c) => sum + (c.duration || 0), 0) / safeCallLogs.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('callLogs.title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('callLogs.subtitle')}</p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>
      )}

      {/* Stat cards */}
      {!loading && safeCallLogs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Toplam */}
          <div className="border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center shrink-0">
              <PhoneCall className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{safeCallLogs.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Toplam Arama</p>
            </div>
          </div>
          {/* Başarılı */}
          <div className="border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 flex items-center gap-3 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 leading-none">{successCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Başarılı</p>
            </div>
          </div>
          {/* Ort. süre */}
          <div className="border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{formatDuration(avgDuration)}</p>
              <p className="text-xs text-muted-foreground mt-1">Ort. Süre</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border border-border rounded-xl p-4">
              <div className="flex items-center gap-4">
                <Skeleton width="2.5rem" height="2.5rem" rounded="rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton width="8rem" height="1rem" />
                  <Skeleton width="5rem" height="0.75rem" />
                </div>
                <Skeleton width="3rem" height="1rem" />
                <Skeleton width="6rem" height="1rem" />
                <Skeleton width="4rem" height="1.5rem" rounded="rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && safeCallLogs.length === 0 && (
        <div className="border border-border rounded-xl py-16 flex flex-col items-center justify-center text-center">
          <Phone className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-medium text-foreground">Henüz arama kaydı bulunmuyor</p>
          <p className="text-sm mt-1 text-muted-foreground">Sesli asistan aramaları burada listelenecektir</p>
        </div>
      )}

      {/* Call cards */}
      {!loading && safeCallLogs.length > 0 && (
        <div className="space-y-3">
          {safeCallLogs.map((call) => (
            <div
              key={call.id}
              onClick={() => setSelectedCall(call)}
              className="border border-border rounded-xl p-4 hover:border-purple-200 dark:hover:border-purple-800/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                {/* Caller info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{call.callerPhone}</p>
                  {call.callerName && <p className="text-sm text-muted-foreground">{call.callerName}</p>}
                </div>
                {/* Duration */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                  <Clock className="w-4 h-4" />
                  <span>{formatDuration(call.duration)}</span>
                </div>
                {/* Date — hidden on mobile */}
                <span className="text-sm text-muted-foreground hidden md:block shrink-0">{formatDate(call.timestamp)}</span>
                {/* Outcome badge */}
                <Badge variant={getOutcomeVariant(call.outcome)}>{getOutcomeLabel(call.outcome)}</Badge>
                {/* Transcript button */}
                {call.transcript && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedCall(call); }}
                    className="p-1.5 hover:bg-muted rounded-lg transition-colors shrink-0"
                  >
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              {/* Date on mobile */}
              <p className="text-xs text-muted-foreground mt-2 ml-14 md:hidden">{formatDate(call.timestamp)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Transcript Modal */}
      <Modal
        isOpen={!!selectedCall}
        onClose={() => setSelectedCall(null)}
        title={selectedCall?.callerName || selectedCall?.callerPhone}
        size="lg"
      >
        {selectedCall && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground -mt-2">
              {formatDate(selectedCall.timestamp)} — {formatDuration(selectedCall.duration)}
            </p>
            {selectedCall.summary && (
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">{t('callLogs.summary')}</h4>
                <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg text-sm text-foreground">
                  {selectedCall.summary}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{t('callLogs.outcome')}:</span>
              <Badge variant={getOutcomeVariant(selectedCall.outcome)}>{getOutcomeLabel(selectedCall.outcome)}</Badge>
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">{t('callLogs.transcript')}</h4>
              {selectedCall.transcript ? (
                <div className="p-3 bg-muted/50 rounded-lg text-sm text-foreground whitespace-pre-wrap">
                  {selectedCall.transcript}
                </div>
              ) : (
                <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground text-center">
                  {t('callLogs.noTranscript')}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
