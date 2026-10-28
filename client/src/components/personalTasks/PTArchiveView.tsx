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
  useTheme,
} from '@mui/material';
import { Archive, RotateCcw } from 'lucide-react';
import { PTTask } from '@/api/personalTasksApi';
import EmptyState from '@/components/ui/EmptyState';
import { formatDate } from '@/utils/format';

interface PTArchiveViewProps {
  tasks: PTTask[];
  isLoading: boolean;
  onRestoreTask: (taskId: number) => Promise<void>;
  onOpenTask: (task: PTTask) => void;
}

export default function PTArchiveView({
  tasks,
  isLoading,
  onRestoreTask,
  onOpenTask,
}: PTArchiveViewProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!isLoading && tasks.length === 0) {
    return (
      <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 2.5 }}>
        <EmptyState title="Archive is Empty" hint="Archived and soft-deleted tasks will appear here." />
      </Paper>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Archived Tasks
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748B' }}>
          Soft-deleted and archived records. History and time logs are fully preserved.
        </Typography>
      </Box>

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
              <TableCell>Task ID</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Actual Hours</TableCell>
              <TableCell align="right">Restore</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tasks.map((task) => (
              <TableRow
                key={task.id}
                hover
                onClick={() => onOpenTask(task)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell>
                  <Chip label={task.task_number} size="small" sx={{ fontWeight: 700, height: 20 }} />
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{task.title}</TableCell>
                <TableCell>{task.due_date ? formatDate(task.due_date) : 'No date'}</TableCell>
                <TableCell>{task.actual_hours || 0}h</TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    startIcon={<RotateCcw size={14} />}
                    onClick={() => onRestoreTask(task.id)}
                    sx={{ textTransform: 'none', borderRadius: 1.5 }}
                  >
                    Restore
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
