import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  IconButton,
  useTheme,
} from '@mui/material';
import { Bell, ShieldCheck, X } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/components/ui/ToastHost';

export default function NotificationAccessDialog() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { showToast } = useToast();
  const { isSupported, permission, subscribe, isProcessing } = usePushNotifications();

  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if permission is default (user has not decided yet)
    if (isSupported && permission === 'default') {
      const dismissed = sessionStorage.getItem('kim_notif_modal_dismissed') === '1';
      if (!dismissed) {
        // Short delay so user sees application view before dialog appears
        const timer = setTimeout(() => {
          setOpen(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    } else {
      setOpen(false);
    }
  }, [isSupported, permission]);

  const handleClose = () => {
    sessionStorage.setItem('kim_notif_modal_dismissed', '1');
    setOpen(false);
  };

  const handleEnable = async () => {
    // Calling subscribe() synchronously within this button click is a 100% verified User Gesture.
    // This allows Chrome, Microsoft Edge, and Firefox to display the native browser prompt reliably.
    const success = await subscribe();
    if (success) {
      showToast('Notifications enabled successfully! You will receive real-time alerts.', 'success');
      setOpen(false);
    } else {
      // If permission is still default or denied after user action
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          showToast('Notification permission granted.', 'success');
          setOpen(false);
        } else if (Notification.permission === 'denied') {
          showToast('Notification permission was blocked in browser settings.', 'info');
          setOpen(false);
        }
      }
    }
  };

  if (!isSupported || permission !== 'default' || !open) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          p: 1,
          backgroundColor: isDark ? '#141A1F' : '#FFFFFF',
          border: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          boxShadow: isDark
            ? '0 16px 40px rgba(0,0,0,0.6)'
            : '0 16px 40px rgba(0,0,0,0.12)',
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1, pr: 1 }}>
        <IconButton size="small" onClick={handleClose} sx={{ color: isDark ? '#94A3B8' : '#64748B' }}>
          <X size={18} />
        </IconButton>
      </Box>

      <DialogContent sx={{ textAlign: 'center', px: 3, pt: 0, pb: 2 }}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            backgroundColor: isDark ? 'rgba(22, 196, 127, 0.16)' : '#E8F5E9',
            color: '#16C47F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
          }}
        >
          <Bell size={28} />
        </Box>

        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: isDark ? '#F1F5F9' : '#111827' }}>
          Enable Browser Notifications
        </Typography>

        <Typography variant="body2" sx={{ color: isDark ? '#94A3B8' : '#64748B', lineHeight: 1.6, mb: 2 }}>
          Stay updated with real-time alerts for task assignments, schedule commitments, status changes, and critical business reminders.
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            py: 0.8,
            px: 1.5,
            borderRadius: 1.5,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
          }}
        >
          <ShieldCheck size={16} color="#16C47F" />
          <Typography variant="caption" sx={{ color: isDark ? '#94A3B8' : '#64748B', fontWeight: 500 }}>
            Works in Chrome, Microsoft Edge, and Firefox.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={handleEnable}
          disabled={isProcessing}
          sx={{
            backgroundColor: '#16C47F',
            color: '#FFFFFF',
            fontWeight: 700,
            textTransform: 'none',
            py: 1.2,
            fontSize: '0.9rem',
            borderRadius: 2,
            boxShadow: 'none',
            '&:hover': {
              backgroundColor: '#13A86B',
              boxShadow: 'none',
            },
          }}
        >
          {isProcessing ? 'Enabling...' : 'Enable Notifications'}
        </Button>
        <Button
          fullWidth
          variant="text"
          onClick={handleClose}
          sx={{
            color: isDark ? '#94A3B8' : '#64748B',
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.82rem',
            py: 0.5,
          }}
        >
          Maybe Later
        </Button>
      </DialogActions>
    </Dialog>
  );
}
