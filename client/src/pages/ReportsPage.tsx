import { useMemo } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useReportsSummaryQuery } from '@/api/reportsApi';
import { PageLoader, ErrorState } from '@/components/ui/PageState';

const STAGE_COLORS: Record<string, string> = {
  leads: '#7A8B80',
  applications: '#16C47F',
  verification: '#2563EB',
  finance: '#2563EB',
  query: '#C2410C',
  sanctioned: '#7C3AED',
  delivery: '#7C3AED',
  disburse: '#DC2626',
  completed: '#16C47F',
};

export default function ReportsPage() {
  const { data, isFetching, isError, refetch } = useReportsSummaryQuery();

  const pieData = useMemo(
    () =>
      (data?.pipeline ?? []).map((s) => ({
        name: s.label,
        value: s.count,
        color: STAGE_COLORS[s.key] ?? '#16C47F',
      })),
    [data],
  );

  const barData = useMemo(
    () => (data?.pipeline ?? []).map((s) => ({ name: s.label, count: s.count })),
    [data],
  );

  const financeBarData = useMemo(
    () =>
      (data?.finance_companies ?? []).map((c) => ({
        name: c.name,
        Approved: c.approved,
        Rejected: c.rejected,
      })),
    [data],
  );

  if (isFetching && !data) {
    return (
      <Paper sx={{ border: '1px solid #E4EBE1', borderRadius: '14px' }}>
        <PageLoader />
      </Paper>
    );
  }

  if (isError) {
    return (
      <Paper sx={{ border: '1px solid #E4EBE1', borderRadius: '14px' }}>
        <ErrorState onRetry={refetch} />
      </Paper>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, color: '#023020' }}>Reports</div>
        <div style={{ fontSize: 13, color: '#7A8B80', marginTop: 3 }}>
          Analytics &amp; reports across the application pipeline.
        </div>
      </div>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.25 }}>
        <Paper sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', p: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 2 }}>Applications by stage</Typography>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2EC" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {(data?.pipeline ?? []).map((s) => (
                  <Cell key={s.key} fill={STAGE_COLORS[s.key] ?? '#16C47F'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Paper>

        <Paper sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', p: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 2 }}>Pipeline distribution</Typography>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Paper>

        <Paper sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', p: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 2 }}>Finance company approvals</Typography>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={financeBarData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2EC" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Approved" fill="#16C47F" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Rejected" fill="#DC2626" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Paper>

        <Paper sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', p: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 2 }}>Applications per month</Typography>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data?.monthly ?? []} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2EC" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#16C47F" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography sx={{ fontSize: 12, color: '#9BA99F' }}>
          Advanced reporting (S3 exports, PDF generation, custom date ranges) arrives in a later phase.
        </Typography>
      </Box>
    </div>
  );
}
