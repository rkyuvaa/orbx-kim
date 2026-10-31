import React, { useState, useMemo } from 'react';
import {
  Box,
  TextField,
  Button,
  Chip,
  Paper,
  Typography,
  InputAdornment,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Zap,
  Calendar,
  Clock,
  AlertCircle,
  Tag as TagIcon,
  Plus,
  UserPlus,
} from 'lucide-react';
import { format, addDays, nextDay } from 'date-fns';
import { PTTaskCreate, useGetPersonalTagsQuery, useDeletePersonalTagMutation } from '@/api/personalTasksApi';

interface PTQuickCaptureProps {
  onQuickAdd: (task: PTTaskCreate) => Promise<void>;
  isLoading?: boolean;
  onOpenAssignTask?: () => void;
}

interface ParsedNLP {
  title: string;
  dueDate?: string;
  dueTime?: string;
  estimatedHours?: number;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  tags: string[];
}

export default function PTQuickCapture({ onQuickAdd, isLoading, onOpenAssignTask }: PTQuickCaptureProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [inputVal, setInputVal] = useState('');

  // Fetch all existing personal tags previously typed by user
  const { data: existingTags = [] } = useGetPersonalTagsQuery();
  const [deleteTag] = useDeletePersonalTagMutation();

  const handleDeleteTag = async (tagToDelete: string) => {
    try {
      await deleteTag(tagToDelete).unwrap();
    } catch (err) {
      console.error('Failed to delete tag', err);
    }
  };

  // Natural Language Parser
  const parsed = useMemo<ParsedNLP | null>(() => {
    const raw = inputVal.trim();
    if (!raw) return null;

    let text = raw;
    let dueDate: string | undefined = undefined;
    let dueTime: string | undefined = undefined;
    let estimatedHours: number | undefined = undefined;
    let priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL';
    const tags: string[] = [];

    // 1. Tags (#tag)
    const tagMatches = text.match(/#(\w+)/g);
    if (tagMatches) {
      tagMatches.forEach((t) => tags.push(t.substring(1)));
      text = text.replace(/#(\w+)/g, ' ');
    }

    // 2. Priority
    if (/\b(urgent|p0|critical)\b/i.test(text)) {
      priority = 'URGENT';
      text = text.replace(/\b(urgent|p0|critical)\b/i, ' ');
    } else if (/\b(high|p1)\b/i.test(text)) {
      priority = 'HIGH';
      text = text.replace(/\b(high|p1)\b/i, ' ');
    } else if (/\b(low|p3)\b/i.test(text)) {
      priority = 'LOW';
      text = text.replace(/\b(low|p3)\b/i, ' ');
    } else if (/\b(normal|medium|p2)\b/i.test(text)) {
      priority = 'NORMAL';
      text = text.replace(/\b(normal|medium|p2)\b/i, ' ');
    }

    // 3. Estimated Hours / Minutes (e.g. 1h, 1.5h, 45m, 2 hrs)
    const hourMatch = text.match(/\b(\d+(\.\d+)?)\s*(h|hr|hrs|hours?)\b/i);
    if (hourMatch) {
      estimatedHours = parseFloat(hourMatch[1]);
      text = text.replace(hourMatch[0], ' ');
    } else {
      const minMatch = text.match(/\b(\d+)\s*(m|min|mins|minutes?)\b/i);
      if (minMatch) {
        estimatedHours = Math.round((parseInt(minMatch[1], 10) / 60) * 100) / 100;
        text = text.replace(minMatch[0], ' ');
      }
    }

    // 4. Due Date
    const today = new Date();
    if (/\b(today|tonight)\b/i.test(text)) {
      dueDate = format(today, 'yyyy-MM-dd');
      text = text.replace(/\b(today|tonight)\b/i, ' ');
    } else if (/\btomorrow\b/i.test(text)) {
      dueDate = format(addDays(today, 1), 'yyyy-MM-dd');
      text = text.replace(/\btomorrow\b/i, ' ');
    } else {
      const dayMap: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };
      const weekdayMatch = text.match(/\b(next|this)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
      if (weekdayMatch) {
        const targetDay = weekdayMatch[2].toLowerCase();
        const dayIdx = dayMap[targetDay];
        if (dayIdx !== undefined) {
          const calculatedDate = nextDay(today, dayIdx);
          dueDate = format(calculatedDate, 'yyyy-MM-dd');
          text = text.replace(weekdayMatch[0], ' ');
        }
      }
    }

    // 5. Due Time (e.g. 4pm, 4:30pm, 16:00, 10am)
    const timeMatch = text.match(/\b((1[0-2]|0?[1-9])(:[0-5][0-9])?\s*(am|pm))\b/i);
    if (timeMatch) {
      dueTime = timeMatch[0].trim().toUpperCase();
      text = text.replace(timeMatch[0], ' ');
    } else {
      const milTimeMatch = text.match(/\b([01]?[0-9]|2[0-3]):[0-5][0-9]\b/);
      if (milTimeMatch) {
        dueTime = milTimeMatch[0].trim();
        text = text.replace(milTimeMatch[0], ' ');
      }
    }

    // Cleanup extra commas and whitespace from title
    const cleanTitle = text.replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim();

    return {
      title: cleanTitle || raw,
      dueDate,
      dueTime,
      estimatedHours,
      priority,
      tags,
    };
  }, [inputVal]);

  // Check if user is currently typing a '#' tag
  const hashMatch = inputVal.match(/#(\w*)$/);
  const isTypingHash = Boolean(hashMatch);
  const hashQuery = hashMatch ? hashMatch[1].toLowerCase() : '';

  const matchingTags = useMemo(() => {
    if (!isTypingHash) return [];
    return existingTags.filter((t) => t.toLowerCase().includes(hashQuery));
  }, [isTypingHash, hashQuery, existingTags]);

  const handleSelectSuggestion = (tag: string) => {
    const nextVal = inputVal.replace(/#\w*$/, `#${tag} `);
    setInputVal(nextVal);
  };

  // Toggle tag from click on quick tag chip
  const handleToggleTag = (tag: string) => {
    const tagRegex = new RegExp(`(^|\\s)#${tag}\\b`, 'gi');
    if (tagRegex.test(inputVal)) {
      // Remove tag
      const nextVal = inputVal.replace(tagRegex, ' ').replace(/\s+/g, ' ').trim();
      setInputVal(nextVal);
    } else {
      // Append tag
      const nextVal = inputVal.trim() ? `${inputVal.trim()} #${tag}` : `#${tag}`;
      setInputVal(nextVal);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!parsed || !parsed.title.trim()) return;

    const submittedTags = parsed.tags;

    await onQuickAdd({
      title: parsed.title,
      due_date: parsed.dueDate,
      due_time: parsed.dueTime,
      estimated_hours: parsed.estimatedHours || 0,
      priority: parsed.priority,
      tag_names: submittedTags.length > 0 ? submittedTags : undefined,
    });

    setInputVal('');
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'URGENT':
        return '#EF4444';
      case 'HIGH':
        return '#F97316';
      case 'NORMAL':
        return '#3B82F6';
      case 'LOW':
        return '#64748B';
      default:
        return '#64748B';
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        backgroundColor: isDark ? '#181D22' : '#FFFFFF',
        boxShadow: isDark
          ? '0 4px 20px rgba(0,0,0,0.3)'
          : '0 4px 18px rgba(0,0,0,0.04)',
      }}
    >
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <TextField
            fullWidth
            size="small"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Quick capture: 'Call vendor tomorrow 4pm, 1h, high #vendor' (press Enter to add)"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Zap size={18} color={isDark ? '#16C47F' : '#203020'} />
                </InputAdornment>
              ),
              endAdornment: inputVal ? (
                <InputAdornment position="end">
                  <Chip
                    label="Enter ↵"
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    }}
                  />
                </InputAdornment>
              ) : null,
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAF8',
              },
            }}
          />

          <Button
            type="submit"
            variant="contained"
            disabled={!inputVal.trim() || isLoading}
            startIcon={<Plus size={16} />}
            sx={{
              whiteSpace: 'nowrap',
              px: 2.5,
              py: 0.9,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              backgroundColor: isDark ? '#16C47F' : '#203020',
              color: isDark ? '#000000' : '#FFFFFF',
              '&:hover': {
                backgroundColor: isDark ? '#14B070' : '#2A402A',
              },
            }}
          >
            Add Task
          </Button>

          {onOpenAssignTask && (
            <Button
              type="button"
              variant="contained"
              onClick={onOpenAssignTask}
              startIcon={<UserPlus size={16} />}
              sx={{
                whiteSpace: 'nowrap',
                px: 2.5,
                py: 0.9,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                backgroundColor: isDark ? '#16C47F' : '#203020',
                color: isDark ? '#000000' : '#FFFFFF',
                '&:hover': {
                  backgroundColor: isDark ? '#14B070' : '#2A402A',
                },
              }}
            >
              Assign Task
            </Button>
          )}
        </Box>

        {/* Inline Typeahead when typing '#' */}
        {isTypingHash && matchingTags.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              flexWrap: 'wrap',
              mt: 1,
              p: 1,
              borderRadius: 1.5,
              backgroundColor: isDark ? 'rgba(22, 196, 127, 0.08)' : 'rgba(22, 196, 127, 0.06)',
              border: '1px dashed',
              borderColor: isDark ? 'rgba(22, 196, 127, 0.3)' : 'rgba(22, 196, 127, 0.25)',
            }}
          >
            <Typography variant="caption" sx={{ color: isDark ? '#16C47F' : '#148C5B', fontWeight: 700, mr: 0.5 }}>
              Matching tag:
            </Typography>
            {matchingTags.slice(0, 8).map((tag) => (
              <Chip
                key={tag}
                size="small"
                label={`#${tag}`}
                onClick={() => handleSelectSuggestion(tag)}
                clickable
                sx={{
                  height: 22,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  backgroundColor: isDark ? '#16C47F' : '#16C47F',
                  color: '#FFFFFF',
                  '&:hover': {
                    backgroundColor: isDark ? '#14B070' : '#12A66C',
                  },
                }}
              />
            ))}
          </Box>
        )}

        {/* Quick Tag Selector Tray (Previously typed / existing tags) */}
        {existingTags.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              flexWrap: 'wrap',
              mt: 1.25,
              pt: 1,
              borderTop: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 0.5 }}>
              <TagIcon size={13} color={isDark ? '#94A3B8' : '#64748B'} />
              <Typography
                variant="caption"
                sx={{
                  color: isDark ? '#94A3B8' : '#64748B',
                  fontWeight: 600,
                  fontSize: '0.72rem',
                }}
              >
                Tags:
              </Typography>
            </Box>

            {existingTags.map((tag) => {
              const isSelected = parsed?.tags.some((t) => t.toLowerCase() === tag.toLowerCase());
              return (
                <Chip
                  key={tag}
                  size="small"
                  label={`#${tag}`}
                  onClick={() => handleToggleTag(tag)}
                  onDelete={(e) => {
                    e.stopPropagation();
                    handleDeleteTag(tag);
                  }}
                  clickable
                  variant={isSelected ? 'filled' : 'outlined'}
                  sx={{
                    height: 24,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    '& .MuiChip-deleteIcon': {
                      fontSize: 14,
                      color: isDark ? '#94A3B8' : '#64748B',
                      '&:hover': {
                        color: '#EF4444',
                      },
                    },
                    ...(isSelected
                      ? {
                          backgroundColor: isDark ? 'rgba(22, 196, 127, 0.22)' : 'rgba(22, 196, 127, 0.15)',
                          color: isDark ? '#16C47F' : '#148C5B',
                          borderColor: isDark ? '#16C47F' : '#16C47F',
                          boxShadow: '0 1px 3px rgba(22, 196, 127, 0.2)',
                        }
                      : {
                          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                          color: isDark ? '#E2E8F0' : '#475569',
                          '&:hover': {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                            borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
                          },
                        }),
                  }}
                />
              );
            })}
          </Box>
        )}

        {/* Live Parsing Preview Chips */}
        {parsed && inputVal.trim() && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              alignItems: 'center',
              mt: 1.5,
              pt: 1.25,
              borderTop: '1px dashed',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }}
          >
            <Typography variant="caption" sx={{ color: isDark ? '#94A3B8' : '#64748B', fontWeight: 600 }}>
              Parsed:
            </Typography>

            <Chip
              size="small"
              label={`Title: "${parsed.title}"`}
              sx={{ fontWeight: 600, maxWidth: 260 }}
            />

            {parsed.dueDate && (
              <Chip
                size="small"
                icon={<Calendar size={13} />}
                label={`${parsed.dueDate}${parsed.dueTime ? ` @ ${parsed.dueTime}` : ''}`}
                color="primary"
                variant="outlined"
              />
            )}

            {parsed.estimatedHours !== undefined && (
              <Chip
                size="small"
                icon={<Clock size={13} />}
                label={`${parsed.estimatedHours}h estimate`}
                variant="outlined"
              />
            )}

            <Chip
              size="small"
              icon={<AlertCircle size={13} />}
              label={parsed.priority}
              sx={{
                borderColor: getPriorityColor(parsed.priority),
                color: getPriorityColor(parsed.priority),
                fontWeight: 700,
              }}
              variant="outlined"
            />

            {parsed.tags.map((t) => (
              <Chip
                key={t}
                size="small"
                icon={<TagIcon size={12} />}
                label={`#${t}`}
                variant="outlined"
              />
            ))}
          </Box>
        )}
      </form>
    </Paper>
  );
}
