import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Grid,
  useTheme,
} from '@mui/material';
import { Clock, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PTTask } from '@/api/personalTasksApi';
import KpiCard from '@/components/ui/KpiCard';

interface PTTimeReportsProps {
  tasks: PTTask[];
  onExportCsv: () => void;
  onOpenTask: (task: PTTask) => void;
}

export default function PTTimeReports({ tasks, onExportCsv, onOpenTask }: PTTimeReportsProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
  const totalActual = tasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
  const exceedingTasks = tasks.filter((t) => (t.actual_hours || 0) > (t.estimated_hours || 0) && (t.estimated_hours || 0) > 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Top Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Time Tracking Reports & Accuracy
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            Audit of estimated effort versus actual logged hours across all personal tasks.
          </Typography>
        </Box>

        <Button
          variant="contained"
          size="small"
          startIcon={<Download size={15} />}
          onClick={onExportCsv}
          sx={{
            textTransform: 'none',
            borderRadius: 2,
            backgroundColor: isDark ? '#16C47F' : '#203020',
            color: isDark ? '#000000' : '#FFFFFF',
            fontWeight: 600,
          }}
        >
          Export Report
        </Button>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <KpiCard
            icon={<Clock size={22} />}
            iconBg="rgba(59, 130, 246, 0.12)"
            iconColor="#3B82F6"
            label="Total Estimated"
            value={`${totalEstimated.toFixed(1)}h`}
            sub={`${tasks.length} tasks planned`}
            subTone="muted"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard
            icon={<CheckCircle2 size={22} />}
            iconBg="rgba(22, 196, 127, 0.12)"
            iconColor="#16C47F"
            label="Total Logged"
            value={`${totalActual.toFixed(1)}h`}
            sub="Actual work completed"
            subTone="up"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard
            icon={<AlertTriangle size={22} />}
            iconBg="rgba(239, 68, 68, 0.12)"
            iconColor="#EF4444"
            label="Exceeding Estimate"
            value={exceedingTasks.length}
            sub="Tasks over planned time"
            subTone={exceedingTasks.length > 0 ? 'muted' : 'up'}
          />
        </Grid>
      </Grid>

      {/* Accuracy Table */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          backgroundColor: isDark ? '#181D22' : '#FFFFFF',
        }}
      >
        <Table size="small">
          <TableHead sx={{ backgroundColor: isDark ? '#14181C' : '#F8FAF8' }}>
            <TableRow>
              <TableCell>Task</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Estimated</TableCell>
              <TableCell align="right">Actual</TableCell>
              <TableCell align="right">Variance</TableCell>
              <TableCell align="right">Accuracy %</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tasks.map((t) => {
              const est = t.estimated_hours || 0;
              const act = t.actual_hours || 0;
              const diff = act - est;
              const isOver = diff > 0 && est > 0;
              const acc = est > 0 ? Math.round(Math.max(0, 100 - (Math.abs(diff) / est) * 100)) : 100;

              return (
                <TableRow
                  key={t.id}
                  hover
                  onClick={() => onOpenTask(t)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={t.task_number} size="small" sx={{ fontWeight: 700, height: 20 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.title}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={t.is_completed ? 'Completed' : t.status_name || 'To Do'}
                      size="small"
                      sx={{ height: 20, fontSize: '0.68rem' }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{est}h</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: isOver ? '#EF4444' : 'inherit' }}>
                    {act}h
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={`${diff > 0 ? '+' : ''}${diff.toFixed(1)}h`}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        backgroundColor: isOver ? 'rgba(239, 68, 68, 0.15)' : 'rgba(22, 196, 127, 0.15)',
                        color: isOver ? '#EF4444' : '#16C47F',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {acc}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
