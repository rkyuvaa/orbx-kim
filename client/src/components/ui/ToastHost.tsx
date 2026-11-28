import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, AlertColor } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

interface Toast {
  id: number;
  message: string;
  severity: AlertColor;
}

interface ToastContextValue {
  showToast: (message: unknown, severity?: AlertColor) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function normalizeMessage(message: unknown): string {
  if (typeof message === 'string') return message;
  if (message == null) return '';
  if (Array.isArray(message)) {
    return message
      .map((m) => normalizeMessage(m))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof message === 'object') {
    const obj = message as Record<string, unknown>;
    if (typeof obj.msg === 'string') return obj.msg;
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }
  return String(message);
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const showToast = useCallback((message: unknown, severity: AlertColor = 'info') => {
    const id = ++counter.current;
    const text = normalizeMessage(message);
    setToasts((prev) => [...prev.slice(-3), { id, message: text, severity }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const showSuccess = useCallback((message: string) => {
    showToast(message, 'success');
  }, [showToast]);

  const showError = useCallback((message: string) => {
    showToast(message, 'error');
  }, [showToast]);

  const value = useMemo(() => ({ showToast, showSuccess, showError }), [showToast, showSuccess, showError]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'none',
        }}
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              style={{ pointerEvents: 'auto' }}
            >
              <Alert
                severity={toast.severity}
                variant="filled"
                onClose={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                sx={{
                  borderRadius: 2,
                  minWidth: 280,
                  maxWidth: 420,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}
              >
                {toast.message}
              </Alert>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
