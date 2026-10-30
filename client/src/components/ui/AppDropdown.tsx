import React, { useId } from 'react';
import {
  Box,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  SxProps,
  Theme,
  Typography,
} from '@mui/material';
import { Check } from 'lucide-react';

export interface AppDropdownOption<T = string | number> {
  value: T;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface AppDropdownProps<T extends string | number = string> {
  id?: string;
  name?: string;
  label?: string;
  value?: T | '' | null;
  options: (AppDropdownOption<T> | T)[];
  onChange?: (value: T) => void;
  placeholder?: string;
  emptyLabel?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  className?: string;
  sx?: SxProps<Theme>;
}

/**
 * AppDropdown - Standard UI Framework Dropdown
 * 
 * Rules enforced:
 * 1. Click the dropdown: Shows the list of available options immediately.
 * 2. Select an option: Allows users to click and select an item from the list.
 * 3. Typing: Non-editable listbox — users cannot type letters or enter custom text.
 * 4. Search box: No search input box displayed inside or above the menu.
 * 5. Consistency: Framework standard for all dropdown menus across KIM-One.
 */
export function AppDropdown<T extends string | number = string>({
  id,
  name,
  label,
  value,
  options = [],
  onChange,
  placeholder,
  emptyLabel,
  allowEmpty = false,
  disabled = false,
  readOnly = false,
  required = false,
  error = false,
  helperText,
  fullWidth = true,
  size = 'small',
  className,
  sx,
}: AppDropdownProps<T>) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const labelId = `${selectId}-label`;

  // Normalize safe value
  const safeValue = value !== undefined && value !== null ? value : '';

  // Normalize options array
  const normalizedOptions: AppDropdownOption<T>[] = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null && 'value' in opt) {
      return opt as AppDropdownOption<T>;
    }
    return {
      value: opt as T,
      label: String(opt),
    };
  });

  const handleChange = (e: SelectChangeEvent<unknown>) => {
    if (readOnly || disabled) return;
    const selectedVal = e.target.value as T;
    onChange?.(selectedVal);
  };

  const showEmptyOption = allowEmpty || Boolean(emptyLabel) || Boolean(placeholder);
  const displayEmptyLabel = emptyLabel || placeholder || 'Select an option';
  const cleanLabel = label ? label.replace(/\s*\*+$/, '') : '';

  return (
    <FormControl
      fullWidth={fullWidth}
      size={size}
      disabled={disabled}
      error={error}
      required={required}
      className={className}
      sx={{
        minWidth: fullWidth ? '100%' : 160,
        ...sx,
      }}
    >
      {cleanLabel && (
        <InputLabel
          id={labelId}
          sx={{
            fontSize: size === 'small' ? 13 : 14,
            fontWeight: 600,
            color: '#526356',
            '&.Mui-focused': {
              color: '#023020',
            },
          }}
        >
          {cleanLabel}
        </InputLabel>
      )}

      <Select
        id={selectId}
        name={name}
        labelId={cleanLabel ? labelId : undefined}
        label={cleanLabel}
        value={safeValue}
        onChange={handleChange}
        readOnly={readOnly}
        displayEmpty={Boolean(placeholder) && !label}
        MenuProps={{
          PaperProps: {
            sx: {
              maxHeight: 280,
              borderRadius: '8px',
              border: '1px solid #E2E8E2',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
              mt: 0.5,
              '& .MuiList-root': {
                py: 0.5,
              },
            },
          },
        }}
        sx={{
          borderRadius: '8px',
          backgroundColor: '#FFFFFF',
          fontSize: size === 'small' ? 13 : 14,
          fontWeight: 500,
          color: '#16231B',
          '& .MuiSelect-select': {
            py: size === 'small' ? 1 : 1.25,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          },
          '& fieldset': {
            borderColor: '#E2E8E2',
            transition: 'border-color 0.15s ease',
          },
          '&:hover fieldset': {
            borderColor: '#023020',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#023020',
            borderWidth: '1.5px',
          },
        }}
      >
        {showEmptyOption && (
          <MenuItem
            value=""
            sx={{
              fontSize: 13,
              fontStyle: 'italic',
              color: '#7A8B80',
              py: 1,
              '&:hover': { backgroundColor: '#F5F7F5' },
            }}
          >
            {displayEmptyLabel}
          </MenuItem>
        )}

        {normalizedOptions.map((opt) => {
          const isSelected = String(opt.value) === String(safeValue);
          return (
            <MenuItem
              key={String(opt.value)}
              value={opt.value as any}
              disabled={opt.disabled}
              sx={{
                fontSize: 13,
                fontWeight: isSelected ? 700 : 500,
                color: isSelected ? '#023020' : '#16231B',
                backgroundColor: isSelected ? '#E8F5E9' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 1,
                px: 1.5,
                '&:hover': {
                  backgroundColor: isSelected ? '#DCFCE7' : '#F5F7F5',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {opt.icon && <Box sx={{ display: 'flex', alignItems: 'center' }}>{opt.icon}</Box>}
                <Typography sx={{ fontSize: 13, fontWeight: isSelected ? 700 : 500 }}>
                  {opt.label}
                </Typography>
              </Box>

              {opt.badge && <Box sx={{ ml: 1 }}>{opt.badge}</Box>}
              {isSelected && <Check size={14} color="#15803D" style={{ marginLeft: 8 }} />}
            </MenuItem>
          );
        })}
      </Select>

      {helperText && (
        <FormHelperText sx={{ fontSize: 11.5, mx: 0.5, mt: 0.5 }}>
          {helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
}

export default AppDropdown;
