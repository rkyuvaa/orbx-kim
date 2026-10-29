import type { ApplicationStatus } from '@/types';

export interface StatusMeta {
  label: string;
  bg: string;
  color: string;
  dot: string;
}

const STATUS_META: Record<ApplicationStatus, StatusMeta> = {
  LEAD: { label: 'Lead', bg: '#F5F1E8', color: '#B45309', dot: '#B45309' },
  APPLICATION: { label: 'Application', bg: '#EAF1FD', color: '#2563EB', dot: '#2563EB' },
  VERIFICATION: { label: 'Verification', bg: '#EAF1FD', color: '#2563EB', dot: '#2563EB' },
  FINANCE: { label: 'Processing', bg: '#EAF1FD', color: '#2563EB', dot: '#2563EB' },
  QUERY: { label: 'Query', bg: '#FCE9DE', color: '#C2410C', dot: '#C2410C' },
  SANCTIONED: { label: 'Sanctioned', bg: '#E6F3EA', color: '#16C47F', dot: '#16C47F' },
  DELIVERY: { label: 'Delivery', bg: '#F0EAFE', color: '#7C3AED', dot: '#7C3AED' },
  DISBURSEMENT: { label: 'Disbursement', bg: '#FDEBEB', color: '#DC2626', dot: '#DC2626' },
  COMPLETED: { label: 'Completed', bg: '#E6F3EA', color: '#16C47F', dot: '#16C47F' },
  REJECTED: { label: 'Rejected', bg: '#FDEBEB', color: '#DC2626', dot: '#DC2626' },
};

export function statusMeta(status: ApplicationStatus): StatusMeta {
  return STATUS_META[status] ?? STATUS_META.APPLICATION;
}

const AGING_COLORS: Record<string, string> = {
  neutral: '#16C47F',
  medium: '#D97706',
  high: '#DC2626',
};

export function agingColor(tone: string): string {
  return AGING_COLORS[tone] ?? AGING_COLORS.neutral;
}

export function formatAmount(amount: number): string {
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatDate(iso?: string | Date | null): string {
  if (!iso) return '';

  if (iso instanceof Date) {
    if (isNaN(iso.getTime())) return '';
    const dd = String(iso.getDate()).padStart(2, '0');
    const mm = String(iso.getMonth() + 1).padStart(2, '0');
    const yyyy = iso.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  const raw = String(iso).trim();
  if (!raw) return '';

  // YYYY-MM-DD (e.g. 2026-10-22)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [yyyy, mm, dd] = raw.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  // Already dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    return raw;
  }

  // If contains T or space, take date part if it matches YYYY-MM-DD
  const datePart = raw.split(/[T ]/)[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [yyyy, mm, dd] = datePart.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateTime(iso?: string | Date | null): string {
  if (!iso) return '';

  const d = iso instanceof Date ? iso : new Date(String(iso).trim());
  if (isNaN(d.getTime())) return String(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hh = String(hours).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}, ${hh}:${minutes} ${ampm}`;
}

export function initialsOf(name?: string | null): string {
  return ((name || '').trim().charAt(0) || '?').toUpperCase();
}

export const ROLE_LABELS: Record<string, string> = {
  SALES_EXECUTIVE: 'Sales Executive',
  FINANCE_OFFICER: 'Finance Officer',
  DELIVERY_TEAM: 'Delivery Team',
  ADMIN: 'Admin',
};

export function time24To12(time24?: string | null): string {
  if (!time24) return '';
  if (time24.includes('AM') || time24.includes('PM')) return time24;
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = hours < 10 ? '0' + hours : '' + hours;
  return `${strHours}:${minutes} ${ampm}`;
}

export function time12To24(time12?: string | null): string {
  if (!time12) return '';
  if (!time12.includes('AM') && !time12.includes('PM')) return time12;
  const parts = time12.trim().split(' ');
  if (parts.length < 2) return time12;
  const [time, modifier] = parts;
  let [hours, minutes] = time.split(':');
  let h = parseInt(hours, 10);
  if (modifier.toUpperCase() === 'PM' && h < 12) h += 12;
  if (modifier.toUpperCase() === 'AM' && h === 12) h = 0;
  const strH = h < 10 ? '0' + h : '' + h;
  return `${strH}:${minutes}`;
}

export function formatDateTime12h(dateStr?: string | null, timeStr?: string | null): string {
  if (!dateStr) return '—';
  const formattedDate = formatDate(dateStr) || dateStr;
  if (!timeStr) return formattedDate;
  const formattedTime = time24To12(timeStr);
  return `${formattedDate} ${formattedTime}`;
}

export interface TaskBadgeStyle {
  bgcolor: string;
  color: string;
  border?: string;
  fontWeight: number;
  fontFamily: string;
  flexShrink: number;
}

/**
 * Returns badge style for Task IDs:
 * - Main Task (depth 0 / top-level): Solid Blue (#2563EB) with white text
 * - Sub Task (depth 1): Solid Green (#16A34A) with white text
 * - Nested Task (depth >= 2): Solid Yellow (#EAB308) with dark text
 */
export function getTaskIdBadgeStyle(
  depthOrTask?: number | { parent_task_id?: number | null; depth?: number } | null,
  allTasksMap?: Map<number, { parent_task_id?: number | null }> | Record<number, { parent_task_id?: number | null }>
): TaskBadgeStyle {
  let depth = 0;
  if (typeof depthOrTask === 'number') {
    depth = depthOrTask;
  } else if (depthOrTask && typeof depthOrTask === 'object') {
    if (typeof depthOrTask.depth === 'number') {
      depth = depthOrTask.depth;
    } else if (depthOrTask.parent_task_id) {
      depth = 1;
      if (allTasksMap) {
        const parent = allTasksMap instanceof Map
          ? allTasksMap.get(depthOrTask.parent_task_id)
          : allTasksMap[depthOrTask.parent_task_id];
        if (parent && parent.parent_task_id) {
          depth = 2;
        }
      }
    }
  }

  if (depth === 0) {
    // Main task -> Refined Blue tint
    return {
      bgcolor: 'rgba(37, 99, 235, 0.12)',
      color: '#2563EB',
      border: '1px solid rgba(37, 99, 235, 0.25)',
      fontWeight: 600,
      fontFamily: 'monospace',
      flexShrink: 0,
    };
  } else if (depth === 1) {
    // Sub task -> Refined Emerald tint
    return {
      bgcolor: 'rgba(22, 163, 74, 0.12)',
      color: '#16A34A',
      border: '1px solid rgba(22, 163, 74, 0.25)',
      fontWeight: 600,
      fontFamily: 'monospace',
      flexShrink: 0,
    };
  } else {
    // Nested task (depth >= 2) -> Refined Amber tint
    return {
      bgcolor: 'rgba(217, 119, 6, 0.12)',
      color: '#D97706',
      border: '1px solid rgba(217, 119, 6, 0.25)',
      fontWeight: 600,
      fontFamily: 'monospace',
      flexShrink: 0,
    };
  }
}

export function formatStandardDateTime(
  dateInput?: string | Date | null,
  timeInput?: string | null,
  defaultTime: string = '00:00'
): string {
  if (!dateInput) return '—';

  let dateStr = '';
  let embeddedTime = '';

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '—';
    const dd = String(dateInput.getDate()).padStart(2, '0');
    const mm = String(dateInput.getMonth() + 1).padStart(2, '0');
    const yyyy = dateInput.getFullYear();
    const hh = String(dateInput.getHours()).padStart(2, '0');
    const min = String(dateInput.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }

  const rawStr = String(dateInput).trim();
  if (!rawStr) return '—';

  if (rawStr.includes('T')) {
    const [dPart, tPart] = rawStr.split('T');
    dateStr = dPart;
    embeddedTime = tPart.split('.')[0].substring(0, 5);
  } else if (rawStr.includes(' ')) {
    const parts = rawStr.split(' ');
    dateStr = parts[0];
    embeddedTime = parts[1].substring(0, 5);
  } else {
    dateStr = rawStr;
  }

  let dd = '';
  let mm = '';
  let yyyy = '';

  if (dateStr.includes('-')) {
    const dParts = dateStr.split('-');
    if (dParts.length === 3) {
      if (dParts[0].length === 4) {
        yyyy = dParts[0];
        mm = dParts[1].padStart(2, '0');
        dd = dParts[2].padStart(2, '0');
      } else {
        dd = dParts[0].padStart(2, '0');
        mm = dParts[1].padStart(2, '0');
        yyyy = dParts[2];
      }
    }
  } else if (dateStr.includes('/')) {
    const dParts = dateStr.split('/');
    if (dParts.length === 3) {
      if (dParts[2].length === 4) {
        dd = dParts[0].padStart(2, '0');
        mm = dParts[1].padStart(2, '0');
        yyyy = dParts[2];
      } else if (dParts[0].length === 4) {
        yyyy = dParts[0];
        mm = dParts[1].padStart(2, '0');
        dd = dParts[2].padStart(2, '0');
      }
    }
  }

  if (!dd || !mm || !yyyy) {
    const parsed = new Date(rawStr);
    if (!isNaN(parsed.getTime())) {
      dd = String(parsed.getDate()).padStart(2, '0');
      mm = String(parsed.getMonth() + 1).padStart(2, '0');
      yyyy = String(parsed.getFullYear());
      embeddedTime = `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
    } else {
      return rawStr;
    }
  }

  let timeStr = defaultTime;
  if (timeInput) {
    timeStr = time12To24(timeInput) || timeInput;
  } else if (embeddedTime) {
    timeStr = embeddedTime;
  }

  const tParts = timeStr.split(':');
  const hh = (tParts[0] || '00').padStart(2, '0');
  const min = (tParts[1] || '00').padStart(2, '0');

  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/**
 * Formats dependency display chip according to PM Specification:
 * - `ARR-T1 FS +1d`
 * - `ARR-T1 FS -2d`
 * - `ARR-T1 FS +4h`
 * - `ARR-T1 FS`
 * - `ARR-T1 FS +1d 4h`
 */
export function formatDependencyLabel(
  taskIdentifier: string,
  depType?: string | null,
  lagDays?: number | null,
  lagHours?: number | null
): string {
  const dt = (depType || 'FS').toUpperCase();
  const id = (taskIdentifier || '').replace(/0+([1-9]\d*)$/, '$1');
  const days = Number(lagDays) || 0;
  const hours = Number(lagHours) || 0;

  if (days === 0 && hours === 0) {
    return `${id} ${dt}`;
  }

  let lagStr = '';
  if (days !== 0 && hours !== 0) {
    const sign = days > 0 ? '+' : '';
    lagStr = `${sign}${days}d ${hours}h`;
  } else if (days !== 0) {
    const sign = days > 0 ? '+' : '';
    lagStr = `${sign}${days}d`;
  } else if (hours !== 0) {
    const sign = hours > 0 ? '+' : '';
    lagStr = `${sign}${hours}h`;
  }

  return `${id} ${dt} ${lagStr}`.trim();
}

