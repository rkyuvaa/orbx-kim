import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useLoginMutation } from '@/api/authApi';
import { setCredentials, logout } from '@/auth/authSlice';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email or username is required'),
  password: z
    .string()
    .min(1, 'Password is required')
    .refine((val) => val.trim().length > 0, {
      message: 'Password cannot be empty or whitespace only',
    }),
});

type LoginForm = z.infer<typeof loginSchema>;

function extractErrorMessage(err: any): string | null {
  if (!err) return null;
  if (err?.status === 401) return 'Invalid email or password.';
  if (err?.status === 429) {
    const detail = err?.data?.detail;
    return typeof detail === 'string'
      ? detail
      : 'Too many failed login attempts. Account is temporarily locked. Please try again later.';
  }
  const detail = err?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && item.msg) {
          const field =
            Array.isArray(item.loc) && item.loc.length > 1
              ? `${item.loc[item.loc.length - 1]}: `
              : '';
          return `${field}${item.msg}`;
        }
        return JSON.stringify(item);
      })
      .join(', ');
  }
  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string') return detail.message;
    return JSON.stringify(detail);
  }
  if (typeof err?.data?.message === 'string') return err.data.message;
  if (typeof err?.message === 'string') return err.message;
  return 'Invalid email or password.';
}

// ─── Animation variants ───────────────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.11 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.52, ease: 'easeOut' } },
};

// Hex SVG pattern data URL
const HEX_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpath d='M28 2 L54 18 L54 50 L28 66 L2 50 L2 18 Z' fill='none' stroke='rgba(22%2C196%2C127%2C0.22)' stroke-width='1'/%3E%3Cpath d='M28 36 L54 52 L54 84 L28 100 L2 84 L2 52 Z' fill='none' stroke='rgba(22%2C196%2C127%2C0.22)' stroke-width='1'/%3E%3C/svg%3E")`;

// ─── Floating orb component ───────────────────────────────────────────────────
function FloatingOrb({
  size,
  color,
  top,
  left,
  delay,
  duration,
}: {
  size: number;
  color: string;
  top?: string | number;
  left?: string | number;
  delay?: number;
  duration?: number;
}) {
  return (
    <Box
      component={motion.div}
      animate={{ y: [-14, 14, -14] }}
      transition={{
        repeat: Infinity,
        duration: duration ?? 7,
        ease: 'easeInOut',
        delay: delay ?? 0,
      }}
      sx={{
        position: 'absolute',
        top,
        left,
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        filter: `blur(${size * 0.55}px)`,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

// ─── Shared input sx ─────────────────────────────────────────────────────────
const loginInputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    bgcolor: '#FFFFFF',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    '& fieldset': {
      borderColor: 'rgba(32, 48, 32, 0.2)',
    },
    '&:hover fieldset': {
      borderColor: '#16C47F',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#16C47F',
      borderWidth: '1.5px',
      boxShadow: '0 0 0 3px rgba(22, 196, 127, 0.15)',
    },
  },
  '& .MuiInputLabel-root': {
    color: '#526356',
    fontSize: 14,
    fontWeight: 500,
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#16C47F',
    fontWeight: 600,
  },
  '& .MuiInputLabel-root.Mui-error': {
    color: '#DC2626',
  },
  '& .MuiInputBase-input': {
    color: '#16231B',
    fontSize: 14,
    fontWeight: 500,
    '&::placeholder': {
      color: '#7A8B80',
      opacity: 1,
    },
  },
  '& .MuiFormHelperText-root': {
    mx: 0.5,
    mt: 0.5,
  },
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAppSelector((state) => state.auth.token);
  const [login, { isLoading, error }] = useLoginMutation();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (token) navigate('/', { replace: true });
  }, [token, navigate]);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

  if (token) return <Navigate to="/" replace />;

  const handleTogglePassword = () => setShowPassword((prev) => !prev);

  const onSubmit = async (values: LoginForm) => {
    const trimmedEmail = values.email.trim();
    const rawPassword = values.password;
    if (!trimmedEmail || !rawPassword || !rawPassword.trim()) return;
    try {
      const result = await login({ email: trimmedEmail, password: rawPassword } as any).unwrap();
      if (result?.access_token && result?.user) {
        dispatch(setCredentials({ token: result.access_token, user: result.user }));
        navigate(from, { replace: true });
      } else {
        dispatch(logout());
      }
    } catch {
      dispatch(logout());
    }
  };

  const errorMessage = extractErrorMessage(error);

  // ── Green hex panel (left on desktop, full-bg layer on mobile) ──────────────
  const GreenPanel = (
    <Box
      sx={{
        // Desktop: left column. Mobile: hidden as a panel (bg handled by wrapper)
        flex: { md: '0 0 50%' },
        display: { xs: 'none', md: 'block' },
        position: 'relative',
        background: 'linear-gradient(145deg, #2A3F2A 0%, #203020 48%, #121C12 100%)',
        overflow: 'hidden',
      }}
    >
      {/* Hex pattern */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: HEX_PATTERN,
          backgroundSize: '56px 100px',
          backgroundRepeat: 'repeat',
          zIndex: 0,
        }}
      />

      {/* Floating orbs */}
      <FloatingOrb size={280} color="radial-gradient(circle, rgba(22,196,127,0.18) 0%, transparent 70%)" top="10%" left="15%" delay={0} duration={8} />
      <FloatingOrb size={200} color="radial-gradient(circle, rgba(22,196,127,0.12) 0%, transparent 70%)" top="55%" left="55%" delay={2.5} duration={6.5} />
      <FloatingOrb size={150} color="radial-gradient(circle, rgba(22,196,127,0.1) 0%, transparent 70%)" top="75%" left="10%" delay={1.2} duration={9} />

      {/* Vignette */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(10,20,10,0.65) 100%)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* Brand label bottom-left */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 28,
          left: 32,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 2,
            bgcolor: 'rgba(22,196,127,0.5)',
            borderRadius: 1,
          }}
        />
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          KIM-One · Enterprise ERP
        </Typography>
      </Box>
    </Box>
  );

  return (
    // Outer wrapper — clean off-white canvas with desktop split hero
    <Box
      sx={{
        display: 'flex',
        minHeight: '100dvh',
        position: 'relative',
        bgcolor: '#F3F7F4',
      }}
    >
      {/* Left green panel (desktop only) */}
      {GreenPanel}

      {/* Right / main form panel */}
      <Box
        sx={{
          flex: { md: '0 0 50%' },
          width: { xs: '100%', md: '50%' },
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2.5, sm: 4, md: 6 },
          position: 'relative',
          zIndex: 1,
          bgcolor: '#F3F7F4',
        }}
      >
        {/* Form card */}
        <Box
          component={motion.div}
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          sx={{
            width: '100%',
            maxWidth: { xs: '100%', sm: 420 },
            p: { xs: 2, sm: 3, md: 0 },
          }}
        >
          {/* Logo */}
          <Box
            component={motion.div}
            variants={itemVariants}
            sx={{ textAlign: 'center', mb: { xs: 2.5, md: 3.5 } }}
          >
            <Box
              component="img"
              src="/logo.svg"
              alt="KIM-One"
              sx={{
                width: '100%',
                maxWidth: { xs: 180, md: 210 },
                height: 'auto',
                mx: 'auto',
                display: 'block',
              }}
            />
          </Box>

          {/* Welcome heading */}
          <Box component={motion.div} variants={itemVariants}>
            <Typography
              component="h1"
              sx={{
                fontWeight: 800,
                fontSize: { xs: 26, md: 30 },
                letterSpacing: '-0.03em',
                color: '#16231B',
                mb: 0.5,
              }}
            >
              Welcome back
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: 13, md: 14 },
                color: '#526356',
                mb: 2.5,
              }}
            >
              Sign in to your KIM-One account
            </Typography>
          </Box>

          {/* Error alert */}
          <AnimatePresence>
            {errorMessage && (
              <Box
                component={motion.div}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <Alert
                  severity="error"
                  sx={{
                    mb: 2,
                    borderRadius: '12px',
                    fontSize: 13,
                  }}
                >
                  {errorMessage}
                </Alert>
              </Box>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Email field */}
            <Box component={motion.div} variants={itemVariants}>
              <TextField
                fullWidth
                id="login-email"
                label="Email or Username"
                type="text"
                autoComplete="username"
                autoFocus
                tabIndex={1}
                margin="normal"
                error={Boolean(errors.email)}
                helperText={errors.email?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Mail size={17} color="#16C47F" />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mt: 0,
                  ...loginInputSx,
                }}
                {...register('email')}
              />
            </Box>

            {/* Password field */}
            <Box component={motion.div} variants={itemVariants} sx={{ mt: 1.5 }}>
              <TextField
                fullWidth
                id="login-password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                tabIndex={2}
                margin="normal"
                error={Boolean(errors.password)}
                helperText={errors.password?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockKeyhole size={17} color="#16C47F" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        type="button"
                        tabIndex={3}
                        onClick={handleTogglePassword}
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        size="small"
                        sx={{
                          color: showPassword ? '#16C47F' : '#7A8B80',
                          '&:hover': { color: '#16C47F' },
                        }}
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mt: 0,
                  ...loginInputSx,
                }}
                {...register('password')}
              />
            </Box>

            {/* Sign in button */}
            <Box component={motion.div} variants={itemVariants} sx={{ mt: 3 }}>
              <Box
                component={motion.div}
                whileHover={{ scale: 1.018 }}
                whileTap={{ scale: 0.975 }}
              >
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  tabIndex={4}
                  disabled={isLoading}
                  sx={{
                    py: 1.5,
                    fontWeight: 700,
                    fontSize: 15,
                    borderRadius: '12px',
                    textTransform: 'none',
                    letterSpacing: '0.01em',
                    background: 'linear-gradient(135deg, #16C47F 0%, #0EA05E 100%)',
                    color: '#FFFFFF',
                    boxShadow: '0 4px 20px rgba(22,196,127,0.35)',
                    transition: 'box-shadow 0.25s ease, background 0.25s ease',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #18D488 0%, #12B56B 100%)',
                      boxShadow: '0 6px 28px rgba(22,196,127,0.5)',
                    },
                    '&.Mui-disabled': {
                      background: 'rgba(22,196,127,0.4)',
                      color: 'rgba(255,255,255,0.7)',
                      boxShadow: 'none',
                    },
                  }}
                >
                  {isLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <CircularProgress size={17} color="inherit" thickness={4} />
                      <span>Signing in…</span>
                    </Box>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </Box>
            </Box>
          </form>

          {/* Footer */}
          <Box
            component={motion.div}
            variants={itemVariants}
            sx={{ mt: 4, textAlign: 'center' }}
          >
            <Link
              to="/"
              style={{
                fontSize: 12,
                color: '#7A8B80',
                textDecoration: 'none',
                fontWeight: 500,
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#16C47F')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#7A8B80')}
            >
              © 2026 KIM-One · Privacy · Terms
            </Link>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
