import { baseApi } from './baseApi';
import { TaskItem, TaskTimeEntryInfo } from './projectsApi';

export type TaskPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';

export interface PTActivityInfo {
  id: number;
  task_id: number;
  actor_id?: number;
  actor_name?: string;
  action: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  source?: string;
  created_at: string;
}

export interface TaskLogNote {
  id: number;
  task_id: number;
  user_id: number;
  employee_name: string;
  employee_photo?: string | null;
  note: string;
  created_at: string;
  formatted_date: string;
  formatted_time: string;
}

export interface TaskLogNoteCreate {
  note: string;
}

export interface PTTask extends TaskItem {
  planned_date?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  blocked_reason?: string | null;
  parent_due_follows_subtasks: boolean;
}

export interface PTTaskFilters {
  status?: string;
  priority?: string;
  tag?: string;
  q?: string;
  include_completed?: boolean;
  include_archived?: boolean;
  start_date?: string;
  due_date?: string;
  assigned_only?: boolean;
  assignee_id?: number;
  limit?: number;
  offset?: number;
}

export interface PersonalTaskAssignCreate {
  title: string;
  description?: string;
  assignee_id: number;
  priority?: TaskPriority;
  start_date?: string;
  due_date?: string;
  estimated_hours?: number;
}

export interface PTTaskCreate {
  title: string;
  description?: string;
  status_id?: number;
  priority?: TaskPriority;
  start_date?: string;
  start_time?: string;
  due_date?: string;
  due_time?: string;
  planned_date?: string;
  estimated_hours?: number;
  estimated_minutes?: number;
  parent_task_id?: number;
  parent_due_follows_subtasks?: boolean;
  blocked_reason?: string;
  tag_names?: string[];
  tag_ids?: number[];
  recurrence_rule?: Record<string, any>;
  recurrence_end_date?: string;
  reminder_at?: string;
}

export interface PTTaskUpdate {
  title?: string;
  description?: string;
  status_id?: number;
  priority?: TaskPriority;
  start_date?: string;
  start_time?: string;
  due_date?: string;
  due_time?: string;
  planned_date?: string;
  estimated_hours?: number;
  estimated_minutes?: number;
  is_completed?: boolean;
  is_archived?: boolean;
  parent_due_follows_subtasks?: boolean;
  blocked_reason?: string;
  tag_names?: string[];
  tag_ids?: number[];
  recurrence_rule?: Record<string, any>;
  recurrence_end_date?: string;
  reminder_at?: string;
}

export interface PersonalSettings {
  id?: number;
  user_id: number;
  timezone: string;
  working_hours_per_day: number;
  working_days: string;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  digest_time?: string | null;
  default_reminder_presets: string;
  max_timer_hours: number;
  auto_stop_timer_at_eod: boolean;
  holidays_json?: Array<{ date: string; name: string }>;
}

export interface WorkloadDailyItem {
  date: string;
  day_name: string;
  is_working_day: boolean;
  is_holiday: boolean;
  available_hours: number;
  planned_hours: number;
  remaining_hours: number;
  tasks_count: number;
  tasks: PTTask[];
}

export interface WorkloadRiskTask {
  id: number;
  task_number: string;
  title: string;
  due_date?: string | null;
  priority: string;
  estimated_hours: number;
  actual_hours: number;
  remaining_hours: number;
  status_name?: string | null;
  risk_reason: string;
}

export interface WorkloadSummary {
  today_estimated_hours: number;
  today_actual_hours: number;
  today_remaining_hours: number;
  week_available_hours: number;
  week_planned_hours: number;
  week_remaining_hours: number;
  utilization_pct: number;
  is_overloaded: boolean;
  overloaded_days: string[];
  tasks_at_risk: WorkloadRiskTask[];
  overdue_count: number;
  overdue_remaining_hours: number;
  daily_breakdown: WorkloadDailyItem[];
  estimated_vs_actual: { estimated: number; actual: number };
}

export interface MyDaySummary {
  today_tasks: PTTask[];
  overdue_tasks: PTTask[];
  today_total_estimated_hours: number;
  today_remaining_hours: number;
  today_actual_hours: number;
  today_completed_count: number;
  active_timer?: TaskTimeEntryInfo | null;
}

export interface WeeklyReview {
  week_start: string;
  week_end: string;
  completed_count: number;
  completed_tasks: PTTask[];
  slipped_count: number;
  slipped_tasks: PTTask[];
  total_hours_logged: number;
  estimate_accuracy_pct: number;
  hours_by_tag: Record<string, number>;
  ai_summary_draft: string;
}

export interface PersonalReminder {
  id: number;
  task_id: number;
  reminder_type: string;
  scheduled_at: string;
  status: string;
  idempotency_key: string;
  attempts: number;
  last_error?: string | null;
  created_at: string;
}

export interface PersonalTemplate {
  id: number;
  name: string;
  description?: string | null;
  subtasks_json?: Array<{ title: string }>;
  created_at: string;
}

export const personalTasksApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPersonalTasks: build.query<PTTask[], PTTaskFilters | void>({
      query: (params) => ({
        url: '/tasks/personal/list',
        params: params || {},
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'PersonalTasks' as const, id })),
              { type: 'PersonalTasks', id: 'LIST' },
            ]
          : [{ type: 'PersonalTasks', id: 'LIST' }],
    }),

    createPersonalTask: build.mutation<PTTask, PTTaskCreate>({
      query: (body) => ({
        url: '/tasks/personal/create',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'PersonalTasks', id: 'LIST' },
        { type: 'PersonalTasks', id: 'TAGS' },
      ],
    }),

    assignPersonalTask: build.mutation<PTTask, PersonalTaskAssignCreate>({
      query: (body) => ({
        url: '/tasks/personal/assign',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'PersonalTasks', id: 'LIST' },
        { type: 'PersonalTasks', id: 'TAGS' },
      ],
    }),

    updatePersonalTask: build.mutation<PTTask, { id: number; data: PTTaskUpdate }>({
      query: ({ id, data }) => ({
        url: `/tasks/personal/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'PersonalTasks', id },
        { type: 'PersonalTasks', id: 'LIST' },
        { type: 'PersonalTasks', id: 'TAGS' },
        { type: 'PersonalTasks', id: `log-notes-${id}` },
        { type: 'PersonalTasks', id: `audit-${id}` },
      ],
    }),

    deletePersonalTask: build.mutation<void, number>({
      query: (id) => ({
        url: `/tasks/personal/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'PersonalTasks', id: 'LIST' }],
    }),

    archivePersonalTask: build.mutation<PTTask, number>({
      query: (id) => ({
        url: `/tasks/personal/${id}/archive`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'PersonalTasks', id: 'LIST' }],
    }),

    restorePersonalTask: build.mutation<PTTask, number>({
      query: (id) => ({
        url: `/tasks/personal/${id}/restore`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'PersonalTasks', id: 'LIST' }],
    }),

    cancelPersonalTask: build.mutation<PTTask, { id: number; reason: string }>({
      query: ({ id, reason }) => ({
        url: `/tasks/personal/${id}/cancel`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'PersonalTasks', id },
        { type: 'PersonalTasks', id: 'LIST' },
      ],
    }),

    reopenPersonalTask: build.mutation<PTTask, number>({
      query: (id) => ({
        url: `/tasks/personal/${id}/reopen`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'PersonalTasks', id },
        { type: 'PersonalTasks', id: 'LIST' },
        { type: 'PersonalTasks', id: `log-notes-${id}` },
        { type: 'PersonalTasks', id: `audit-${id}` },
      ],
    }),

    createPersonalSubtask: build.mutation<PTTask, { taskId: number; data: PTTaskCreate }>({
      query: ({ taskId, data }) => ({
        url: `/tasks/personal/${taskId}/subtasks`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'PersonalTasks', id: 'LIST' }],
    }),

    // Time Tracking
    getActiveTimer: build.query<TaskTimeEntryInfo | null, void>({
      query: () => '/tasks/personal/active-timer',
      providesTags: ['PersonalTasks'],
    }),

    startPersonalTimer: build.mutation<TaskTimeEntryInfo, { taskId: number; forceSwitch?: boolean }>({
      query: ({ taskId, forceSwitch }) => ({
        url: `/tasks/personal/${taskId}/timer/start${forceSwitch ? '?force_switch=true' : ''}`,
        method: 'POST',
      }),
      invalidatesTags: ['PersonalTasks'],
    }),

    stopPersonalTimer: build.mutation<TaskTimeEntryInfo, { taskId: number; description?: string }>({
      query: ({ taskId, description }) => ({
        url: `/tasks/personal/${taskId}/timer/stop${description ? `?description=${encodeURIComponent(description)}` : ''}`,
        method: 'POST',
      }),
      invalidatesTags: ['PersonalTasks'],
    }),

    getPersonalTimeEntries: build.query<TaskTimeEntryInfo[], number>({
      query: (taskId) => `/tasks/personal/${taskId}/time-entries`,
      providesTags: (_res, _err, taskId) => [{ type: 'PersonalTasks', id: `time-${taskId}` }],
    }),

    addPersonalManualTimeEntry: build.mutation<
      TaskTimeEntryInfo,
      { taskId: number; data: { duration_minutes: number; description?: string; started_at: string; ended_at?: string } }
    >({
      query: ({ taskId, data }) => ({
        url: `/tasks/personal/${taskId}/time-entries`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_res, _err, { taskId }) => [
        { type: 'PersonalTasks', id: `time-${taskId}` },
        { type: 'PersonalTasks', id: 'LIST' },
      ],
    }),

    deletePersonalTimeEntry: build.mutation<void, number>({
      query: (entryId) => ({
        url: `/tasks/personal/time-entries/${entryId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['PersonalTasks'],
    }),

    // Workload & My Day
    getPersonalWorkload: build.query<WorkloadSummary, void>({
      query: () => '/tasks/personal/workload',
      providesTags: ['PersonalTasks'],
    }),

    getMyDaySummary: build.query<MyDaySummary, void>({
      query: () => '/tasks/personal/my-day',
      providesTags: ['PersonalTasks'],
    }),

    getWeeklyReview: build.query<WeeklyReview, void>({
      query: () => '/tasks/personal/weekly-review',
      providesTags: ['PersonalTasks'],
    }),

    // Task Log Notes
    getTaskLogNotes: build.query<TaskLogNote[], number>({
      query: (taskId) => `/tasks/personal/${taskId}/log-notes`,
      providesTags: (_res, _err, taskId) => [{ type: 'PersonalTasks', id: `log-notes-${taskId}` }],
    }),

    createTaskLogNote: build.mutation<TaskLogNote, { taskId: number; note: string }>({
      query: ({ taskId, note }) => ({
        url: `/tasks/personal/${taskId}/log-notes`,
        method: 'POST',
        body: { note },
      }),
      invalidatesTags: (_res, _err, { taskId }) => [{ type: 'PersonalTasks', id: `log-notes-${taskId}` }],
    }),

    // Audit Trail
    getPersonalTaskAudit: build.query<PTActivityInfo[], number>({
      query: (taskId) => `/tasks/personal/${taskId}/audit`,
      providesTags: (_res, _err, taskId) => [{ type: 'PersonalTasks', id: `audit-${taskId}` }],
    }),

    getPersonalAuditTimeline: build.query<PTActivityInfo[], { limit?: number } | void>({
      query: (params) => ({
        url: '/tasks/personal/audit-timeline',
        params: params || {},
      }),
      providesTags: ['PersonalTasks'],
    }),

    // Settings
    getPersonalSettings: build.query<PersonalSettings, void>({
      query: () => '/tasks/personal/settings',
      providesTags: ['PersonalTasks'],
    }),

    updatePersonalSettings: build.mutation<PersonalSettings, Partial<PersonalSettings>>({
      query: (body) => ({
        url: '/tasks/personal/settings',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['PersonalTasks'],
    }),

    // Reminders
    getPersonalReminders: build.query<PersonalReminder[], void>({
      query: () => '/tasks/personal/reminders',
      providesTags: ['PersonalTasks'],
    }),

    createPersonalReminder: build.mutation<PersonalReminder, { taskId: number; reminderType: string; scheduledAt: string }>({
      query: ({ taskId, reminderType, scheduledAt }) => ({
        url: `/tasks/personal/${taskId}/reminders`,
        method: 'POST',
        body: { task_id: taskId, reminder_type: reminderType, scheduled_at: scheduledAt },
      }),
      invalidatesTags: ['PersonalTasks'],
    }),

    snoozePersonalReminder: build.mutation<PersonalReminder, { reminderId: number; minutes: number }>({
      query: ({ reminderId, minutes }) => ({
        url: `/tasks/personal/reminders/${reminderId}/snooze?minutes=${minutes}`,
        method: 'POST',
      }),
      invalidatesTags: ['PersonalTasks'],
    }),

    deletePersonalReminder: build.mutation<{ success: boolean }, number>({
      query: (reminderId) => ({
        url: `/tasks/personal/reminders/${reminderId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['PersonalTasks'],
    }),

    // Templates
    getPersonalTemplates: build.query<PersonalTemplate[], void>({
      query: () => '/tasks/personal/templates',
      providesTags: ['PersonalTasks'],
    }),

    createPersonalTemplate: build.mutation<PersonalTemplate, { name: string; description?: string; subtasks: string[] }>({
      query: (body) => ({
        url: '/tasks/personal/templates',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['PersonalTasks'],
    }),

    instantiatePersonalTemplate: build.mutation<PTTask, number>({
      query: (templateId) => ({
        url: `/tasks/personal/templates/${templateId}/instantiate`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'PersonalTasks', id: 'LIST' }],
    }),

    // Tags & Search
    getPersonalTags: build.query<string[], void>({
      query: () => '/tasks/personal/tags',
      providesTags: [{ type: 'PersonalTasks', id: 'TAGS' }],
    }),

    deletePersonalTag: build.mutation<{ success: boolean }, string>({
      query: (tagName) => ({
        url: `/tasks/personal/tags/${encodeURIComponent(tagName)}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['PersonalTasks', { type: 'PersonalTasks', id: 'TAGS' }],
    }),

    searchPersonalTasks: build.query<PTTask[], string>({
      query: (q) => ({
        url: '/tasks/personal/search',
        params: { q },
      }),
      providesTags: ['PersonalTasks'],
    }),
  }),
});

export const {
  useGetPersonalTasksQuery,
  useCreatePersonalTaskMutation,
  useAssignPersonalTaskMutation,
  useUpdatePersonalTaskMutation,
  useDeletePersonalTaskMutation,
  useArchivePersonalTaskMutation,
  useRestorePersonalTaskMutation,
  useCancelPersonalTaskMutation,
  useReopenPersonalTaskMutation,
  useCreatePersonalSubtaskMutation,
  useGetActiveTimerQuery,
  useStartPersonalTimerMutation,
  useStopPersonalTimerMutation,
  useGetPersonalTimeEntriesQuery,
  useAddPersonalManualTimeEntryMutation,
  useDeletePersonalTimeEntryMutation,
  useGetPersonalWorkloadQuery,
  useGetMyDaySummaryQuery,
  useGetWeeklyReviewQuery,
  useGetTaskLogNotesQuery,
  useCreateTaskLogNoteMutation,
  useGetPersonalTaskAuditQuery,
  useGetPersonalAuditTimelineQuery,
  useGetPersonalSettingsQuery,
  useUpdatePersonalSettingsMutation,
  useGetPersonalRemindersQuery,
  useCreatePersonalReminderMutation,
  useSnoozePersonalReminderMutation,
  useDeletePersonalReminderMutation,
  useGetPersonalTemplatesQuery,
  useCreatePersonalTemplateMutation,
  useInstantiatePersonalTemplateMutation,
  useGetPersonalTagsQuery,
  useDeletePersonalTagMutation,
  useSearchPersonalTasksQuery,
} = personalTasksApi;
