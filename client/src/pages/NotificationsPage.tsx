import { Button, Paper } from '@mui/material';
import { Bell, CheckCheck } from 'lucide-react';

import {
  useMarkAllReadMutation,
  useMarkReadMutation,
  useNotificationsQuery,
} from '@/api/notificationsApi';
import EmptyState from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/PageState';
import { formatDateTime } from '@/utils/format';

export default function NotificationsPage() {
  const { data, isFetching, isError, refetch } = useNotificationsQuery();
  const [markRead] = useMarkReadMutation();
  const [markAllRead, { isLoading: markingAll }] = useMarkAllReadMutation();

  const unreadCount = (data ?? []).filter((n) => !n.is_read).length;

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
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, color: '#023020' }}>Notifications</div>
          <div style={{ fontSize: 13, color: '#7A8B80', marginTop: 3 }}>
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'You are all caught up'}
          </div>
        </div>
        <Button
          variant="outlined"
          startIcon={<CheckCheck size={16} />}
          disabled={unreadCount === 0 || markingAll}
          onClick={() => markAllRead()}
        >
          Mark all as read
        </Button>
      </div>

      <Paper sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', overflow: 'hidden' }}>
        {isFetching && !data ? (
          <LoadingRows rows={5} />
        ) : isError ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Button variant="outlined" onClick={refetch}>
              Retry loading notifications
            </Button>
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState title="No notifications yet" hint="Updates about your applications will appear here." />
        ) : (
          data.map((n) => {
            // Check if this is a planned activity notification (negative ID)
            const isPlannedActivity = n.id < 0;
            const plannedActivityId = n.planned_activity_id;
            const dueDate = n.due_date;

            return (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (!n.is_read && plannedActivityId) {
                    markRead(n.id);
                  }
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '13px 16px',
                  border: 'none',
                  borderBottom: '1px solid #F0F4EE',
                  background: n.is_read ? '#fff' : '#F2FAF0',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: n.is_read ? '#EEF1EE' : '#FFFFFF',
                    border: n.is_read ? '1px solid #E2E8E2' : '1px solid #CDE7D5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                    padding: 3,
                  }}
                >
                  <img
                    src="/logo.svg"
                    alt="KIM"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      opacity: n.is_read ? 0.65 : 1,
                    }}
                  />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600, color: '#16231B' }}>{n.message}</div>
                  {isPlannedActivity && dueDate && (
                    <div style={{ fontSize: 11, color: '#7A8B80', marginTop: 1 }}>{formatDateTime(dueDate)}</div>
                  )}
                  <div style={{ fontSize: 11, color: '#7A8B80', marginTop: 1 }}>{formatDateTime(n.created_at)}</div>
                </div>
                {!n.is_read && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#C2410C', flexShrink: 0 }} />
                )}
              </button>
            )
          })
        )}
      </Paper>
    </div>
  );
}
