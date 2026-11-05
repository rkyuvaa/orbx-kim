import { AlertTriangle, Banknote, CheckCircle2, LayoutGrid, ShieldCheck, Upload } from 'lucide-react';

import { useDashboardQuery } from '@/api/dashboardApi';
import KpiCard from '@/components/ui/KpiCard';
import Pipeline from '@/components/ui/Pipeline';
import { ErrorState, PanelHead } from '@/components/ui/PageState';
import { useToast } from '@/components/ui/ToastHost';
import RecentApplications from './RecentApplications';
import NeedsAttention from './NeedsAttention';
import WaitingOn from './WaitingOn';
import FinancePerformance from './FinancePerformance';

export default function DashboardPage() {
  const { data, isError, refetch, isFetching } = useDashboardQuery();
  const { showToast } = useToast();

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 14,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, color: '#023020' }}>
            Dashboard
          </div>
          <div style={{ fontSize: 13, color: '#7A8B80', marginTop: 3 }}>
            Real-time overview of your vehicle finance pipeline.
          </div>
        </div>
      </div>

      {isError ? (
        <div
          style={{
            background: '#fff',
            border: '1px solid #E4EBE1',
            borderRadius: 14,
          }}
        >
          <ErrorState onRetry={refetch} />
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: 14,
              marginBottom: 20,
            }}
            className="kpi-grid"
          >
            {isFetching && !data ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton-shimmer"
                  style={{ height: 78, borderRadius: 10 }}
                />
              ))
            ) : (
              <>
                <KpiCard
                  icon={<LayoutGrid size={20} />}
                  iconBg="#E6F3EA"
                  iconColor="#16C47F"
                  label="Total Applications"
                  value={data?.kpis.total_applications.value ?? 0}
                  sub={data?.kpis.total_applications.sub ?? ''}
                  subTone="up"
                  onClick={() => showToast('Viewing all applications', 'info')}
                />
                <KpiCard
                  icon={<Upload size={20} />}
                  iconBg="#EEF1EE"
                  iconColor="#6B7A6F"
                  label="Doc Pending"
                  value={data?.kpis.doc_pending.value ?? 0}
                  sub={data?.kpis.doc_pending.sub ?? ''}
                  onClick={() => showToast('Viewing pending documents', 'info')}
                />
                <KpiCard
                  icon={<ShieldCheck size={20} />}
                  iconBg="#EAF1FD"
                  iconColor="#2563EB"
                  label="Verif. Pending"
                  value={data?.kpis.verification_pending.value ?? 0}
                  sub={data?.kpis.verification_pending.sub ?? ''}
                  onClick={() => showToast('Viewing verification queue', 'info')}
                />
                <KpiCard
                  icon={<AlertTriangle size={20} />}
                  iconBg="#FCE9DE"
                  iconColor="#C2410C"
                  label="Finance Query"
                  value={data?.kpis.finance_query.value ?? 0}
                  sub={data?.kpis.finance_query.sub ?? ''}
                  onClick={() => showToast('Viewing finance queries', 'info')}
                />
                <KpiCard
                  icon={<CheckCircle2 size={20} />}
                  iconBg="#F0EAFE"
                  iconColor="#7C3AED"
                  label="Sanctioned"
                  value={data?.kpis.sanctioned.value ?? 0}
                  sub={data?.kpis.sanctioned.sub ?? ''}
                  onClick={() => showToast('Viewing sanctioned applications', 'info')}
                />
                <KpiCard
                  icon={<Banknote size={20} />}
                  iconBg="#FDEBEB"
                  iconColor="#DC2626"
                  label="Disbursement"
                  value={data?.kpis.disbursement.value ?? 0}
                  sub={data?.kpis.disbursement.sub ?? ''}
                  onClick={() => showToast('Viewing disbursements', 'info')}
                />
              </>
            )}
          </div>

          <div
            style={{
              background: '#fff',
              border: '1px solid #E4EBE1',
              borderRadius: 14,
              marginBottom: 20,
              overflowX: 'auto',
            }}
          >
            <PanelHead
              icon={<span style={{ fontSize: 15 }} />}
              title="Application Pipeline"
              right={
                <button
                  type="button"
                  onClick={() => showToast('Opening full pipeline view…', 'info')}
                  style={linkStyle}
                >
                  View all stages →
                </button>
              }
            />
            {data && <Pipeline stages={data.pipeline} onStageClick={(s) => showToast(`${s.label}: ${s.count} total`, 'info')} />}
          </div>

          <div className="two-col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 330px', gap: 18, alignItems: 'start', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
              <RecentApplications />
              <FinancePerformance />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => showToast('Loading all applications…', 'info')}
                  style={{
                    ...linkStyle,
                    border: '1px solid #D3DED0',
                    borderRadius: 8,
                    padding: '9px 15px',
                    background: '#fff',
                    color: '#04552B',
                    fontSize: 13,
                  }}
                >
                  View All Applications →
                </button>
              </div>
            </div>

            <div className="right-col" style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
              <NeedsAttention />
              <WaitingOn />
            </div>
          </div>

          <footer
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              padding: '18px 2px 8px',
              fontSize: 12,
              color: '#9BA99F',
            }}
          >
            <span>© 2025 CRMFinance. All rights reserved.</span>
            <div style={{ display: 'flex', gap: 16 }}>
              <button
                type="button"
                onClick={() => showToast('Privacy Policy', 'info')}
                style={footerLinkStyle}
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => showToast('Terms of Service', 'info')}
                style={footerLinkStyle}
              >
                Terms of Service
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 12,
  fontWeight: 600,
  color: '#16C47F',
  background: 'none',
  border: 'none',
  padding: 4,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const footerLinkStyle: React.CSSProperties = {
  color: '#7A8B80',
  textDecoration: 'none',
  fontWeight: 500,
  fontSize: 12,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
