import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, Clock } from 'lucide-react';
import { Card, CardContent } from '../../components/common/Card';
import { Table } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { callLogAPI } from '../../services/api';

/**
 * Call Logs page component
 */
export const CallLogs = () => {
  const { t } = useTranslation();
  const [callLogs, setCallLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCallLogs();
  }, []);

  const fetchCallLogs = async () => {
    try {
      setError(null);
      const response = await callLogAPI.getAll();
      setCallLogs(response.data?.data || response.data || []);
    } catch (err) {
      console.error('Failed to fetch call logs:', err);
      setError(err.message || 'Arama kayıtları yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getOutcomeVariant = (outcome) => {
    const variants = {
      // Yeni status değerleri
      completed: 'success',
      'no-answer': 'warning',
      busy: 'warning',
      failed: 'error',
      'in-progress': 'info',
      // Eski outcome değerleri (backward compat)
      appointment_booked: 'success',
      information_provided: 'info',
      call_back_later: 'warning',
      not_interested: 'error',
    };
    return variants[outcome] || 'info';
  };

  const columns = [
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
          {row.outcome?.replace(/_/g, ' ')}
        </Badge>
      ),
    },
  ];

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
            View all voice assistant call logs and transcripts
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
            <div className="text-center py-12 text-slate-500">
              {t('common.loading')}
            </div>
          ) : callLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Phone className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium">Henüz arama kaydı bulunmuyor</p>
              <p className="text-sm mt-1">Sesli asistan aramaları burada listelenecektir</p>
            </div>
          ) : (
            <Table
              columns={columns}
              data={callLogs}
              onRowClick={(row) => console.log('View transcript:', row)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
