import React, { useRef } from 'react';
import { Box, Typography, TextField, useTheme } from '@mui/material';
import { formatDate } from '@/utils/format';

export interface StandardDateInputProps {
  value?: string | null;
  onChange: (val: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  sx?: any;
}

export const StandardDateInput: React.FC<StandardDateInputProps> = ({
  value,
  onChange,
  placeholder = 'dd-mm-yyyy',
  disabled = false,
  sx,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const inputRef = useRef<HTMLInputElement>(null);

  const cleanIsoDate = value ? value.split('T')[0].split(' ')[0] : '';
  const displayFormatted = cleanIsoDate ? formatDate(cleanIsoDate) : '';

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        cursor: disabled ? 'default' : 'pointer',
        py: 0.25,
        px: 0.5,
        borderRadius: '4px',
        transition: 'all 0.15s ease',
        '&:hover': disabled
          ? {}
          : {
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
            },
        ...sx,
      }}
      onClick={() => {
        if (!disabled && inputRef.current) {
          if (typeof inputRef.current.showPicker === 'function') {
            try {
              inputRef.current.showPicker();
            } catch {
              inputRef.current.focus();
            }
          } else {
            inputRef.current.focus();
          }
        }
      }}
    >
      <Typography
        component="span"
        sx={{
          fontSize: '0.8rem',
          fontFamily: 'monospace',
          color: displayFormatted ? 'text.secondary' : 'text.disabled',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {displayFormatted || placeholder}
      </Typography>

      <TextField
        type="date"
        size="small"
        variant="standard"
        inputRef={inputRef}
        disabled={disabled}
        value={cleanIsoDate}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val || null);
        }}
        InputProps={{ disableUnderline: true }}
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: disabled ? 'default' : 'pointer',
          '& .MuiInputBase-root, & input': {
            width: '100%',
            height: '100%',
            cursor: disabled ? 'default' : 'pointer',
            p: 0,
          },
        }}
      />
    </Box>
  );
};

export default StandardDateInput;
