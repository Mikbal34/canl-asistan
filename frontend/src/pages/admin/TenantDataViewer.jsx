import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { AppointmentsViewer } from '../../components/admin/AppointmentsViewer';
import { CustomersViewer } from '../../components/admin/CustomersViewer';
import { FeedbackViewer } from '../../components/admin/FeedbackViewer';
import { adminAPI } from '../../services/api';

export const TenantDataViewer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getTenant(id)
      .then(r => setTenant(r.data.data || r.data))
      .catch(() => navigate('/admin/tenants'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/tenants/${id}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Yönetim Panelleri</h1>
          <p className="text-sm text-muted-foreground">{tenant?.name}</p>
        </div>
      </div>

      {/* Viewers */}
      <div className="space-y-4">
        <AppointmentsViewer tenantId={id} />
        <CustomersViewer tenantId={id} />
        <FeedbackViewer tenantId={id} />
      </div>
    </div>
  );
};
