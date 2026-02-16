import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, Clock, X, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '../../components/common/Card';
import { Table } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { SkeletonTableRows } from '../../components/common/Skeleton';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import { callLogAPI } from '../../services/api';

/**
 * Call Logs page component
 */
export const CallLogs = () => {
  const { t } = useTranslation();
  const [selectedCall, setSelectedCall] = useState(null);

  const {
    data: callLogs,
    loading,
    error,
  } = useCachedFetch('call-logs', async () => {
    const response = await callLogAPI.getAll();
    return response.data?.data || response.data || [];
  });

  const formatDate = useCallback((dateString) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const formatDuration = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getOutcomeVariant = useCallback((outcome) => {
    const variants = {
      completed: 'success',
      'no-answer': 'warning',
      busy: 'warning',
      failed: 'error',
      'in-progress': 'info',
      'in_progress': 'info',
      appointment_booked: 'success',
      information_provided: 'info',
      call_back_later: 'warning',
      not_interested: 'error',
      'customer-ended-call': 'info',
      'assistant-ended-call': 'success',
      'assistant-said-end-call-phrase': 'success',
      'assistant-forwarded-call': 'info',
      'customer-did-not-answer': 'warning',
      'customer-busy': 'warning',
      'silence-timed-out': 'warning',
      'voicemail': 'warning',
      'exceeded-max-duration': 'warning',
      'manually-canceled': 'warning',
      'phone-call-provider-closed-websocket': 'error',
      'pipeline-error-openai-llm-failed': 'error',
      'assistant-error': 'error',
      'no-customer-audio': 'error',
      'unknown-error': 'error',
    };
    return variants[outcome] || 'info';
  }, []);

  const getOutcomeLabel = useCallback((outcome) => {
    if (!outcome) return '';
    return t(`callLogs.outcomes.${outcome}`, outcome.replace(/[-_.]/g, ' '));
  }, [t]);

  const columns = useMemo(() => [
    {
      header: t('callLogs.caller'),
      accessor: 'callerPhone',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.callerPhone}</p>
          {row.callerName && (
            <p className="text-sm text-slate-500">{row.callerName}</p>
          )}
        </div>
      ),
    },
    {
      header: t('callLogs.timestamp'),
      accessor: 'timestamp',
      render: (row) => (
        <span className="text-slate-600">{formatDate(row.timestamp)}</span>
      ),
    },
    {
      header: t('callLogs.duration'),
      accessor: 'duration',
      render: (row) => (
        <div className="flex items-center gap-2 text-slate-600">
          <Clock className="w-4 h-4" />
          {formatDuration(row.duration)}
        </div>
      ),
    },
    {
      header: t('callLogs.outcome'),
      accessor: 'outcome',
      render: (row) => (
        <Badge variant={getOutcomeVariant(row.outcome)}>
          {getOutcomeLabel(row.outcome)}
        </Badge>
      ),
    },
    {
      header: t('callLogs.transcript'),
      render: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedCall(row); }}
          className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1"
        >
          <MessageSquare className="w-4 h-4" />
          {row.transcript ? t('callLogs.transcript') : ''}
        </button>
      ),
    },
  ], [t, formatDate, formatDuration, getOutcomeVariant, getOutcomeLabel]);

  const safeCallLogs = callLogs || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-purple-100">
          <Phone className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('callLogs.title')}</h1>
          <p className="text-slate-500 mt-1">
            {t('callLogs.subtitle')}
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-600">
          {error}
        </div>
      )}

      {/* Call Logs Table */}
      <Card>
        <CardContent>
          {loading ? (
            <SkeletonTableRows rows={8} columns={5} />
          ) : safeCallLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Phone className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium">Henüz arama kaydı bulunmuyor</p>
              <p className="text-sm mt-1">Sesli asistan aramaları burada listelenecektir</p>
            </div>
          ) : (
            <Table
              columns={columns}
              data={safeCallLogs}
              onRowClick={(row) => setSelectedCall(row)}
            />
          )}
        </CardContent>
      </Card>

      {/* Transcript Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedCall(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {selectedCall.callerName || selectedCall.callerPhone}
                </h3>
                <p className="text-sm text-slate-500">
                  {formatDate(selectedCall.timestamp)} - {formatDuration(selectedCall.duration)}
                </p>
              </div>
              <button onClick={() => setSelectedCall(null)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4">
              {/* Summary */}
              {selectedCall.summary && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2">{t('callLogs.summary')}</h4>
                  <div className="p-3 bg-indigo-50 rounded-lg text-sm text-slate-700">
                    {selectedCall.summary}
                  </div>
                </div>
              )}

              {/* Outcome */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">{t('callLogs.outcome')}:</span>
                <Badge variant={getOutcomeVariant(selectedCall.outcome)}>
                  {getOutcomeLabel(selectedCall.outcome)}
                </Badge>
              </div>

              {/* Transcript */}
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">{t('callLogs.transcript')}</h4>
                {selectedCall.transcript ? (
                  <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 whitespace-pre-wrap">
                    {selectedCall.transcript}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-400 text-center">
                    {t('callLogs.noTranscript')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
