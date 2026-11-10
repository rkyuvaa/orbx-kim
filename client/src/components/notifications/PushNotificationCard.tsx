import { useState } from 'react';
import { Paper, Button, Chip, CircularProgress, Alert, Tooltip } from '@mui/material';
import { Bell, BellOff, Send, CheckCircle2, AlertTriangle, Smartphone } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function PushNotificationCard() {
  const {
    isSupported,
    permission,
    isSubscribed,
    subscriptionCount,
    isProcessing,
    isTesting,
    actionError,
    subscribe,
    unsubscribe,
    sendTest,
  } = usePushNotifications();

  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isSupported) {
    return (
      <Paper
        sx={{
          p: 2,
          mb: 2.5,
          borderRadius: '12px',
          border: '1px solid #E2E8E2',
          background: '#F9FAFB',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <BellOff size={20} color="#94A3B8" />
        <div style={{ fontSize: 13, color: '#64748B' }}>
          Browser push notifications are not supported on this device/browser.
        </div>
      </Paper>
    );
  }

  const handleTest = async () => {
    setTestResult(null);
    try {
      const res = await sendTest();
      setTestResult(res.message || 'Test push notification sent successfully!');
      setTimeout(() => setTestResult(null), 6000);
    } catch (e: any) {
      setTestResult(e?.data?.detail || e?.message || 'Failed to dispatch test notification.');
      setTimeout(() => setTestResult(null), 6000);
    }
  };

  const isDenied = permission === 'denied';

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        mb: 2.5,
        borderRadius: '14px',
        border: isSubscribed ? '1px solid #C6E7D2' : isDenied ? '1px solid #FED7AA' : '1px solid #E4EBE1',
        background: isSubscribed
          ? 'linear-gradient(180deg, #F4FBF6 0%, #FFFFFF 100%)'
          : isDenied
          ? '#FFFDF9'
          : '#FFFFFF',
        transition: 'all 0.2s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              background: isSubscribed ? '#E8F5E9' : isDenied ? '#FEF3C7' : '#F0FDF4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isSubscribed ? (
              <Bell size={20} color="#15803D" />
            ) : isDenied ? (
              <AlertTriangle size={20} color="#D97706" />
            ) : (
              <Bell size={20} color="#04552B" />
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#0F291E' }}>
                Desktop & Browser Push Notifications
              </span>
              {isSubscribed ? (
                <Chip
                  size="small"
                  icon={<CheckCircle2 size={13} color="#15803D" />}
                  label="Enabled"
                  sx={{
                    bgcolor: '#DCFCE7',
                    color: '#15803D',
                    fontWeight: 600,
                    fontSize: 11,
                    height: 22,
                  }}
                />
              ) : isDenied ? (
                <Chip
                  size="small"
                  label="Blocked in Browser"
                  sx={{
                    bgcolor: '#FEF3C7',
                    color: '#B45309',
                    fontWeight: 600,
                    fontSize: 11,
                    height: 22,
                  }}
                />
              ) : (
                <Chip
                  size="small"
                  label="Not Enabled"
                  sx={{
                    bgcolor: '#F1F5F9',
                    color: '#64748B',
                    fontWeight: 500,
                    fontSize: 11,
                    height: 22,
                  }}
                />
              )}
            </div>
            <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
              {isSubscribed
                ? `You will receive instant desktop alerts for assigned tasks, mentions, and updates. Active on ${subscriptionCount} device(s).`
                : isDenied
                ? 'Notifications were blocked in your browser settings. Click the site settings/lock icon in your address bar to allow notifications.'
                : 'Receive instant desktop alerts for assigned tasks, mentions, approvals, and reminders even when KIM is in the background.'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {isSubscribed ? (
            <>
              <Tooltip title="Send a test notification to verify your device receives desktop alerts">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleTest}
                  disabled={isTesting || isProcessing}
                  startIcon={isTesting ? <CircularProgress size={14} /> : <Send size={14} />}
                  sx={{
                    borderColor: '#C6E7D2',
                    color: '#04552B',
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: 12,
                    '&:hover': { bgcolor: '#F0FDF4', borderColor: '#86EFAC' },
                  }}
                >
                  {isTesting ? 'Sending...' : 'Send Test Alert'}
                </Button>
              </Tooltip>
              <Button
                size="small"
                variant="text"
                onClick={unsubscribe}
                disabled={isProcessing}
                sx={{
                  color: '#94A3B8',
                  textTransform: 'none',
                  fontSize: 12,
                  '&:hover': { color: '#EF4444', bgcolor: 'transparent' },
                }}
              >
                Disable
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              size="small"
              onClick={subscribe}
              disabled={isProcessing || isDenied}
              startIcon={isProcessing ? <CircularProgress size={14} color="inherit" /> : <Bell size={14} />}
              sx={{
                bgcolor: '#04552B',
                color: '#fff',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: 13,
                px: 2,
                py: 0.8,
                borderRadius: '8px',
                '&:hover': { bgcolor: '#02381B' },
              }}
            >
              {isProcessing ? 'Enabling...' : 'Enable Push Notifications'}
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <Alert severity="error" sx={{ mt: 1.5, py: 0.5, fontSize: 12.5 }} onClose={() => {}}>
          {actionError}
        </Alert>
      )}

      {testResult && (
        <Alert
          severity={testResult.toLowerCase().includes('failed') ? 'error' : 'success'}
          sx={{ mt: 1.5, py: 0.5, fontSize: 12.5 }}
          onClose={() => setTestResult(null)}
        >
          {testResult}
        </Alert>
      )}
    </Paper>
  );
}
