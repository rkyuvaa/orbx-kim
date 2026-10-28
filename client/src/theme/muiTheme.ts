import { createTheme } from '@mui/material/styles';

export const brandColors = {
  primary: '#203020',
  primaryHover: '#2A402A',
  primaryActive: '#172417',
  primaryLight: '#EAF0EA',
  primaryLighter: '#F3F7F3',
  primaryAccent: '#3D5A3D',
  primaryVibrant: '#16C47F', // High-contrast green accent for dark mode & status indicators
  focusRing: 'rgba(32, 48, 32, 0.25)',
  focusRingDark: 'rgba(22, 196, 127, 0.35)',
};

export const darkSurfaces = {
  background: '#0F1215',    // Deep charcoal canvas
  sidebar: '#141D14',       // Dark brand-tinted surface based on #203020
  header: '#15191E',        // Differentiated dark header
  paper: '#181D22',         // Cards & table paper
  nested: '#13171B',        // Subtasks / nested rows recession
  elevated: '#1F252C',      // Dialogs / Popovers / Menus
  hover: 'rgba(255, 255, 255, 0.04)',
  selected: 'rgba(255, 255, 255, 0.08)',
  border: '#262E36',        // Subtle low-contrast separators
  borderSubtle: '#1E252C',
  textPrimary: '#F3F5F7',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
};

export const lightSurfaces = {
  background: '#F8FAF8',    // Soft neutral canvas
  sidebar: '#172517',       // Dark brand-tinted sidebar
  header: '#FFFFFF',        // Clean white header
  paper: '#FFFFFF',         // Cards & table paper
  nested: '#F5F7F5',        // Subtasks / nested rows recession
  elevated: '#FFFFFF',      // Dialogs / Popovers / Menus
  hover: 'rgba(32, 48, 32, 0.035)',
  selected: 'rgba(32, 48, 32, 0.07)',
  border: '#E2E8E2',        // Subtle gray border
  borderSubtle: '#ECF0EC',
  textPrimary: '#16231B',
  textSecondary: '#526356',
  textMuted: '#7A8B80',
};

export const getMuiTheme = (mode: 'light' | 'dark') => {
  const isDark = mode === 'dark';
  const surfaces = isDark ? darkSurfaces : lightSurfaces;

  return createTheme({
    palette: {
      mode,
      primary: {
        main: brandColors.primary,
        dark: brandColors.primaryActive,
        light: brandColors.primaryHover,
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: brandColors.primaryVibrant,
        contrastText: '#FFFFFF',
      },
      background: {
        default: surfaces.background,
        paper: surfaces.paper,
      },
      text: {
        primary: surfaces.textPrimary,
        secondary: surfaces.textSecondary,
      },
      divider: surfaces.border,
      action: {
        hover: surfaces.hover,
        selected: surfaces.selected,
        focus: isDark ? brandColors.focusRingDark : brandColors.focusRing,
      },
      success: { main: isDark ? '#22C55E' : '#16A34A', contrastText: '#FFFFFF' },
      error: { main: isDark ? '#EF4444' : '#DC2626', contrastText: '#FFFFFF' },
      warning: { main: isDark ? '#F59E0B' : '#D97706', contrastText: '#FFFFFF' },
      info: { main: isDark ? '#3B82F6' : '#2563EB', contrastText: '#FFFFFF' },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      button: { textTransform: 'none', fontWeight: 600 },
      h4: { fontWeight: 800, letterSpacing: '-0.3px' },
      h5: { fontWeight: 700, letterSpacing: '-0.2px' },
      h6: { fontWeight: 700, letterSpacing: '-0.1px' },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            transition: 'background-color 0.18s ease, color 0.18s ease',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            boxShadow: 'none',
            transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:active': {
              transform: 'scale(0.98)',
            },
            '&:focus-visible': {
              outline: isDark ? '2px solid #16C47F' : '2px solid #203020',
              outlineOffset: '2px',
            },
          },
          containedPrimary: {
            backgroundColor: brandColors.primary,
            color: '#FFFFFF',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : 'none',
            boxShadow: '0 1px 2px rgba(32, 48, 32, 0.25)',
            '&:hover': {
              backgroundColor: brandColors.primaryHover,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : undefined,
              boxShadow: '0 2px 8px rgba(32, 48, 32, 0.2)',
            },
          },
          outlinedPrimary: {
            color: isDark ? '#F3F5F7' : brandColors.primary,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(32, 48, 32, 0.25)',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(22, 196, 127, 0.08)' : 'rgba(32, 48, 32, 0.04)',
              borderColor: isDark ? '#16C47F' : brandColors.primary,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderColor: surfaces.border,
            transition: 'background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            backgroundColor: surfaces.paper,
            border: `1px solid ${surfaces.border}`,
            borderRadius: 8,
            transition: 'background-color 0.18s ease, border-color 0.18s ease',
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#13171B' : '#F5F7F5',
            '& .MuiTableCell-head': {
              backgroundColor: isDark ? '#13171B' : '#F5F7F5',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: surfaces.textSecondary,
              letterSpacing: '0.3px',
              borderBottom: `1px solid ${surfaces.border}`,
              whiteSpace: 'nowrap',
              py: 1.25,
            },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 0.15s ease',
            '&.MuiTableRow-hover:hover': {
              backgroundColor: `${surfaces.hover} !important`,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottomColor: surfaces.border,
            color: surfaces.textPrimary,
            fontSize: 13,
            whiteSpace: 'nowrap',
            padding: '8px 12px',
            transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#14181D' : '#FFFFFF',
            color: surfaces.textPrimary,
            borderRadius: 8,
            transition: 'border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease',
            '& fieldset': {
              borderColor: surfaces.border,
              transition: 'border-color 0.15s ease',
            },
            '&:hover fieldset': {
              borderColor: isDark ? '#475569' : brandColors.primary,
            },
            '&.Mui-focused fieldset': {
              borderColor: isDark ? '#16C47F' : brandColors.primary,
              borderWidth: '1.5px',
            },
          },
        },
      },
      MuiSelect: {
        defaultProps: {
          size: 'small',
        },
        styleOverrides: {
          root: {
            borderRadius: 8,
            cursor: 'pointer',
            '& .MuiSelect-select': {
              cursor: 'pointer',
              userSelect: 'none',
            },
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 6,
            margin: '2px 4px',
            transition: 'background-color 0.12s ease',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F5F7F5',
            },
            '&.Mui-selected': {
              backgroundColor: isDark ? 'rgba(22, 196, 127, 0.15)' : '#E8F5E9',
              fontWeight: 700,
              color: isDark ? '#16C47F' : '#023020',
              '&:hover': {
                backgroundColor: isDark ? 'rgba(22, 196, 127, 0.22)' : '#DCFCE7',
              },
            },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? '#1A2027' : '#FFFFFF',
            borderColor: surfaces.border,
            borderRadius: 8,
            boxShadow: isDark ? '0 8px 24px rgba(0, 0, 0, 0.45)' : '0 8px 24px rgba(32, 48, 32, 0.08)',
            '& .MuiMenuItem-root': {
              fontSize: 13,
              transition: 'background-color 0.12s ease',
              '&:hover': {
                backgroundColor: surfaces.hover,
              },
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: surfaces.paper,
            borderColor: surfaces.border,
            boxShadow: isDark ? '0 16px 40px rgba(0, 0, 0, 0.6)' : '0 16px 40px rgba(32, 48, 32, 0.1)',
            borderRadius: 12,
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? '#252D36' : brandColors.primary,
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: 500,
            padding: '5px 9px',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          },
          arrow: {
            color: isDark ? '#252D36' : brandColors.primary,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            fontWeight: 600,
            transition: 'all 0.15s ease',
          },
        },
      },
      MuiTextField: {
        defaultProps: { size: 'small' },
      },
    },
  });
};

export const theme = getMuiTheme('light');
