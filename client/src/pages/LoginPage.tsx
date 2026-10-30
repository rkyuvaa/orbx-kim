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
  if (err?.status === 401) {
    return 'Invalid email or password.';
  }
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
    if (token) {
      navigate('/', { replace: true });
    }
  }, [token, navigate]);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

  if (token) {
    return <Navigate to="/" replace />;
  }

  const handleTogglePassword = () => {
    setShowPassword((prev) => !prev);
  };

  const onSubmit = async (values: LoginForm) => {
    const trimmedEmail = values.email.trim();
    const rawPassword = values.password;

    if (!trimmedEmail || !rawPassword || !rawPassword.trim()) {
      return;
    }

    try {
      const result = await login({ email: trimmedEmail, password: rawPassword } as any).unwrap();
      if (result?.access_token && result?.user) {
        dispatch(setCredentials({ token: result.access_token, user: result.user }));
        navigate(from, { replace: true });
      } else {
        dispatch(logout());
      }
    } catch {
      // Securely wipe any stale auth and ensure the user stays on the login page
      dispatch(logout());
    }
  };

  const errorMessage = extractErrorMessage(error);

  // Right side brand panel with green gradient
  const brandPanel = (
    <Box
      sx={{
        flex: '1 1 50%',
        background: 'linear-gradient(145deg, #2A3F2A 0%, #203020 48%, #121C12 100%)',
        color: '#FFFFFF',
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        p: 6,
        overflow: 'hidden',
      }}
    >
      {/* Decorative ambient glowing ring */}
      <Box
        sx={{
          position: 'absolute',
          width: 440,
          height: 440,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(22, 196, 127, 0.14) 0%, rgba(32, 48, 32, 0) 70%)',
          filter: 'blur(30px)',
          pointerEvents: 'none',
        }}
      />

      {/* Hero Visual Card with High-Contrast Logo */}
      <Box sx={{ textAlign: 'center', zIndex: 1, maxWidth: 360, width: '100%', px: 2 }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.95)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)',
            mb: 3,
          }}
        >
          <Box
            component="img"
            src="/logo.svg"
            alt="KIM-One"
            sx={{
              width: '100%',
              maxWidth: 220,
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </Box>
        <Typography
          sx={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: '#FFFFFF',
            mb: 1,
          }}
        >
          Enterprise Resource Planning
        </Typography>
        <Typography
          sx={{
            fontSize: 14,
            color: '#A3D9B8',
            lineHeight: 1.5,
          }}
        >
          Streamlined automotive operations, project workflows, and management.
        </Typography>
      </Box>

      {/* Subtle bottom copyright */}
      <Typography
        sx={{
          position: 'absolute',
          bottom: 24,
          fontSize: 12,
          color: 'rgba(255, 255, 255, 0.45)',
          letterSpacing: '0.02em',
        }}
      >
        © 2026 KIM-One. All rights reserved.
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', background: '#F8FAF8' }}>
      {/* Left side: Form panel on clean white background */}
      <Box
        sx={{
          flex: '1 1 50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, sm: 6 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 420 }}>
          {/* Logo prominently displayed on the clean white/light background for maximum visibility */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              component="img"
              src="/logo.svg"
              alt="KIM-One"
              sx={{
                width: '100%',
                maxWidth: 220,
                height: 'auto',
                mx: 'auto',
                display: 'block',
              }}
            />
          </Box>

          <Typography
            component="h2"
            variant="h4"
            sx={{
              fontWeight: 800,
              color: '#203020',
              letterSpacing: '-0.02em',
              mb: 3,
            }}
          >
            Welcome back
          </Typography>

          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
              {errorMessage}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Username / Email Field with Tab navigation and inline validation */}
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
                    <Mail size={18} color="#9BA99F" />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&.Mui-focused fieldset': {
                    borderColor: '#16C47F',
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#16C47F',
                },
              }}
              {...register('email')}
            />

            {/* Password Field: Masked by default, Eye icon toggle, Tab/Enter support */}
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
                    <LockKeyhole size={18} color="#9BA99F" />
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
                      title={showPassword ? 'Hide password' : 'Show password'}
                      size="small"
                      sx={{
                        color: showPassword ? '#16C47F' : '#9BA99F',
                        '&:hover': { color: '#16C47F' },
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&.Mui-focused fieldset': {
                    borderColor: '#16C47F',
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#16C47F',
                },
              }}
              {...register('password')}
            />

            {/* Sign In Button: Disabled while loading to prevent duplicate submissions */}
            <Button
              fullWidth
              type="submit"
              variant="contained"
              tabIndex={4}
              disabled={isLoading}
              sx={{
                mt: 3.5,
                py: 1.35,
                fontWeight: 700,
                fontSize: 15,
                borderRadius: 2,
                textTransform: 'none',
                bgcolor: '#16C47F',
                color: '#FFFFFF',
                '&:hover': {
                  bgcolor: '#12A66C',
                },
                '&.Mui-disabled': {
                  bgcolor: 'rgba(22, 196, 127, 0.6)',
                  color: '#FFFFFF',
                },
                boxShadow: '0 4px 14px rgba(22, 196, 127, 0.28)',
              }}
            >
              {isLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CircularProgress size={18} color="inherit" thickness={4} />
                  <span>Signing in...</span>
                </Box>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Clean footer */}
          <Box sx={{ mt: 5, textAlign: 'center' }}>
            <Link
              to="/"
              style={{ fontSize: 12, color: '#7A8B80', textDecoration: 'none' }}
            >
              © 2026 KIM-One · Privacy · Terms
            </Link>
          </Box>
        </Box>
      </Box>

      {/* Right side: Green brand hero panel */}
      {brandPanel}
    </Box>
  );
}
