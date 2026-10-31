import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from '@/api/baseApi';
import type { RootState } from '@/app/store';

export interface ProjectItem {
  id: number;
  name: string;
  code?: string;
  description?: string;
  space_id?: number;
  lead_id?: number;
  lead_app_no?: string;
  lead_customer_name?: string;
  category: string;
  type_id?: number;
  status_id?: number;
  status_name?: string;
  progress: number;
  budget: float;
  estimated_cost: float;
  actual_cost: float;
  target_start_date?: string;
  target_start_time?: string;
  target_end_date?: string;
  target_end_time?: string;
  completion_date?: string;
  completion_time?: string;
  owner_id?: number;
  owner_name?: string;
  tasks_count: { total: number; done: number };
  prefix?: string;
  rollup_start_date?: string;
  rollup_end_date?: string;
  cost_variance?: number;
  created_at: string;
  updated_at: string;
}

export type float = number;

export interface TaskSubtaskItem {
  id: number;
  task_id: number;
  title: string;
  is_completed: boolean;
  display_order: number;
  created_at: string;
}

export interface TaskAssigneeInfo {
  id: number;
  user_id: number;
  full_name: string;
  email?: string;
  user?: {
    id?: number;
    full_name?: string;
    email?: string;
    avatar?: string;
    name?: string;
  };
}

export interface TaskFollowerInfo {
  id: number;
  user_id: number;
  full_name: string;
  email?: string;
}

export interface TaskTagInfo {
  id: number;
  name: string;
  color?: string;
}

export interface TaskChecklistItemInfo {
  id: number;
  checklist_id: number;
  title: string;
  is_completed: boolean;
  assignee_id?: number;
  assignee_name?: string;
  due_date?: string;
  display_order: number;
}

export interface TaskChecklistInfo {
  id: number;
  task_id: number;
  title: string;
  items: TaskChecklistItemInfo[];
}

export interface TaskTimeEntryInfo {
  id: number;
  task_id: number;
  user_id: number;
  user_name?: string;
  duration_minutes: number;
  started_at?: string;
  ended_at?: string;
  description?: string;
  created_at: string;
}

export interface TaskDependencyInfo {
  id: number;
  task_id: number;
  depends_on_task_id: number;
  dependency_type: 'BLOCKS' | 'BLOCKED_BY' | 'WAITING_ON';
  depends_on_task_number?: string;
  depends_on_task_title?: string;
  depends_on_status_name?: string;
  depends_on_priority?: string;
  depends_on_due_date?: string;
  depends_on_is_completed?: boolean;
  direction?: 'BLOCKING' | 'BLOCKED_BY';
  predecessor_task_id?: number;
  predecessor_task_number?: string;
  predecessor_task_title?: string;
  dep_type: 'FS' | 'SS' | 'FF' | 'SF';
  lag_days: number;
  lag_hours?: number;
}

export interface CascadePreviewItem {
  task_id: number;
  task_number: string;
  title: string;
  old_start?: string;
  old_due?: string;
  new_start?: string;
  new_due?: string;
}

export interface CascadePreviewOut {
  total_affected: number;
  items: CascadePreviewItem[];
}

export interface ProjectPmSettings {
  id?: number;
  project_id: number;
  default_dep_type: 'FS' | 'SS' | 'FF' | 'SF';
  auto_shift_successors: boolean;
  prompt_on_reschedule: boolean;
}

export interface TaskRelationshipInfo {
  id: number;
  task_id: number;
  related_task_id: number;
  relationship_type: 'RELATED' | 'LINKED' | 'DUPLICATE';
  related_task_number?: string;
  related_task_title?: string;
}

export interface TaskActivityInfo {
  id: number;
  task_id: number;
  actor_id?: number;
  actor_name: string;
  action_type: string;
  old_value?: string;
  new_value?: string;
  description?: string;
  created_at: string;
}

export interface TaskItem {
  id: number;
  task_number: string;
  company_id?: number;
  branch_id?: number;
  department_id?: number;
  cost_center_id?: number;
  cost_center_code?: string;
  cost_center_name?: string;
  project_id?: number;
  project_name?: string;
  phase_id?: number;
  parent_task_id?: number;
  sort_order?: number;
  title: string;
  description?: string;
  task_type: string;
  status_id?: number;
  status_name?: string;
  status_category?: string;
  status_color?: string;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  start_date?: string;
  start_time?: string;
  due_date?: string;
  due_time?: string;
  estimated_minutes: number;
  estimated_hours?: number;
  actual_minutes: number;
  actual_hours?: number;
  assignee_id?: number;
  assignee_name?: string;
  assigned_at?: string;
  assigned_by?: number;
  assigned_by_name?: string;
  override_dependencies?: boolean;
  progress_percentage: number;
  is_completed: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  is_blocked?: boolean;
  created_by?: number;
  created_by_name?: string;
  updated_by?: number;
  completed_by?: number;
  completed_at?: string;
  completion_date?: string;
  completion_time?: string;
  reminder_at?: string;
  reminder_status?: string;
  recurrence_rule?: Record<string, any>;
  recurrence_end_date?: string;
  recurring_task_id?: number;
  tag_ids?: number[];
  tag_names?: string[];
  tags_list?: TaskTagInfo[];
  edit_series?: boolean;
  assignees: TaskAssigneeInfo[];
  followers: TaskFollowerInfo[];
  tags: TaskTagInfo[];
  checklists: TaskChecklistInfo[];
  dependencies: TaskDependencyInfo[];
  dependents?: TaskDependencyInfo[];
  relationships: TaskRelationshipInfo[];
  time_entries: TaskTimeEntryInfo[];
  activities: TaskActivityInfo[];
  subtasks: TaskItem[];
  nested_subtasks?: TaskItem[];
  subtask_count?: number;
  completed_subtask_count?: number;
  milestone_id?: number;
  task_list_id?: number;
  task_list_name?: string;
  duration_working_days?: number;
  duration_working_hours?: number;
  auto_schedule?: boolean;
  dependency_conflict?: {
    has_conflict: boolean;
    conflict_message: string;
    recommended_start_date: string;
    predecessor_task_number?: string;
    predecessor_title?: string;
  };
  estimated_cost: number;
  actual_cost: number;
  cost_variance: number;
  is_parent: boolean;
  start_date_locked: boolean;
  end_date_locked: boolean;
  controlled_by_task_number?: string;
  duration_display?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskTimeLogItem {
  id: number;
  task_id: number;
  user_id: number;
  user_name?: string;
  hours: number;
  log_date: string;
  description?: string;
  created_at: string;
}

export interface TaskCommentItem {
  id: number;
  task_id: number;
  user_id: number;
  user_name?: string;
  content: string;
  created_at: string;
}

export interface StatusDefinitionItem {
  id: number;
  name: string;
  color: string;
  display_order: number;
  is_terminal: boolean;
  is_completed_type: boolean;
  exclude_from_active_totals: boolean;
  is_default_on_create: boolean;
}

export interface CustomFieldDefinitionItem {
  id: number;
  name: string;
  label: string;
  field_type: 'Text' | 'Number' | 'Date' | 'Select' | 'Boolean' | string;
  options?: string;
  is_required: boolean;
  display_order: number;
}

export interface ProjectMilestoneItem {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  rollup_start_date?: string;
  rollup_end_date?: string;
  rollup_estimated_cost: number;
  rollup_actual_cost: number;
  rollup_duration_days?: number;
  cost_variance: number;
  created_at: string;
}

export interface ProjectTaskListItem {
  id: number;
  project_id: number;
  milestone_id: number;
  name: string;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  duration_working_days?: number;
  duration_working_hours?: number;
  sort_order?: number;
  created_at: string;
  updated_at?: string;
}

export interface TaskAttachmentItem {
  id: number;
  task_id: number;
  filename: string;
  file_size?: string;
  file_url?: string;
  created_at: string;
}

export interface TaskCustomFieldValueItem {
  id: number;
  field_id: number;
  field_label?: string;
  value?: string;
}

export interface WorkingCalendarHoliday {
  id: number;
  holiday_date: string;
  description: string;
  recurs_yearly: boolean;
  created_at: string;
}
export interface WeeklyOffConfig {
  day_of_week_list: number[]; // 0=Mon, 6=Sun
}
export interface CalendarConfig {
  holidays: WorkingCalendarHoliday[];
  weekly_off_days: number[];
  work_start_time?: string;
  work_end_time?: string;
  daily_working_hours?: number;
}

export const projectsApi = createApi({
  reducerPath: 'projectsApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Projects', 'Tasks', 'TimeLogs', 'Comments', 'StatusDefs', 'CustomFieldDefs', 'Milestones', 'TaskLists', 'Attachments', 'TaskCustomFields', 'Calendar', 'PmSettings'],
  endpoints: (builder) => ({
    // Projects
    getProjects: builder.query<ProjectItem[], { status?: string; lead_id?: number; q?: string } | void>({
      query: (params) => ({
        url: '/projects',
        params: params || undefined,
      }),
      providesTags: ['Projects'],
    }),
    getProject: builder.query<ProjectItem, number>({
      query: (id) => `/projects/${id}`,
      providesTags: (_res, _err, id) => [{ type: 'Projects', id }, 'Projects'],
    }),
    createProject: builder.mutation<ProjectItem, Partial<ProjectItem>>({
      query: (body) => ({
        url: '/projects',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Projects'],
    }),
    updateProject: builder.mutation<ProjectItem, { id: number; body: Partial<ProjectItem> }>({
      query: ({ id, body }) => ({
        url: `/projects/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => ['Projects', { type: 'Projects', id }],
    }),
    deleteProject: builder.mutation<void, number>({
      query: (id) => ({
        url: `/projects/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Projects'],
    }),

    // Tasks
    getTasks: builder.query<TaskItem[], { project_id?: number; status?: string; priority?: string; assignee_id?: number; q?: string; include_subtasks?: boolean; my_tasks_only?: boolean } | void>({
      query: (params) => ({
        url: '/tasks',
        params: params || undefined,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Tasks' as const, id })),
              { type: 'Tasks', id: 'LIST' },
              'Tasks',
            ]
          : [{ type: 'Tasks', id: 'LIST' }, 'Tasks'],
    }),
    getTask: builder.query<TaskItem, number>({
      query: (id) => `/tasks/${id}`,
      providesTags: (_res, _err, id) => [{ type: 'Tasks', id }, 'Tasks'],
    }),
    createTask: builder.mutation<TaskItem, Partial<TaskItem>>({
      query: (body) => ({
        url: '/tasks',
        method: 'POST',
        body,
      }),
      invalidatesTags: (res) => [
        'Tasks',
        'Projects',
        'TaskLists',
        ...(res?.project_id ? [{ type: 'Projects' as const, id: res.project_id }] : []),
      ],
    }),
    updateTask: builder.mutation<TaskItem, { id: number; body: Partial<TaskItem> }>({
      query: ({ id, body }) => ({
        url: `/tasks/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (res, _err, { id }) => [
        'Tasks',
        { type: 'Tasks', id },
        'Projects',
        'TaskLists',
        ...(res?.project_id ? [{ type: 'Projects' as const, id: res.project_id }] : []),
      ],
    }),
    deleteTask: builder.mutation<void, number>({
      query: (id) => ({
        url: `/tasks/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Tasks', 'Projects', 'TaskLists', 'Milestones'],
    }),

    // Personal Tasks
    getPersonalTasks: builder.query<TaskItem[], void>({
      query: () => '/tasks/personal/list',
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Tasks' as const, id })),
              { type: 'Tasks', id: 'PERSONAL_LIST' },
            ]
          : [{ type: 'Tasks', id: 'PERSONAL_LIST' }],
    }),
    createPersonalTask: builder.mutation<TaskItem, Partial<TaskItem>>({
      query: (body) => ({
        url: '/tasks/personal/create',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Tasks', id: 'PERSONAL_LIST' }],
    }),
    updatePersonalTask: builder.mutation<TaskItem, { id: number; body: Partial<TaskItem> }>({
      query: ({ id, body }) => ({
        url: `/tasks/personal/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [{ type: 'Tasks', id }, { type: 'Tasks', id: 'PERSONAL_LIST' }],
    }),
    deletePersonalTask: builder.mutation<void, number>({
      query: (id) => ({
        url: `/tasks/personal/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Tasks', id: 'PERSONAL_LIST' }],
    }),

    // Subtasks
    addSubtask: builder.mutation<TaskSubtaskItem, { taskId: number; title?: string; body?: { title: string } }>({
      query: ({ taskId, title, body }) => ({
        url: `/tasks/${taskId}/subtasks`,
        method: 'POST',
        body: { title: title || body?.title || '' },
      }),
      invalidatesTags: (_res, _err, { taskId }) => [{ type: 'Tasks', id: taskId }, 'Tasks', 'Projects'],
    }),
    toggleSubtask: builder.mutation<TaskSubtaskItem, number>({
      query: (subtaskId) => ({
        url: `/tasks/subtasks/${subtaskId}/toggle`,
        method: 'PUT',
      }),
      invalidatesTags: ['Tasks', 'Projects'],
    }),
    deleteSubtask: builder.mutation<void, number>({
      query: (subtaskId) => ({
        url: `/tasks/subtasks/${subtaskId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Tasks', 'Projects'],
    }),

    // Time Logs
    logTime: builder.mutation<TaskTimeLogItem, { taskId: number; hours?: number; log_date?: string; description?: string; body?: { hours: number; log_date: string; description?: string } }>({
      query: ({ taskId, hours, log_date, description, body }) => ({
        url: `/tasks/${taskId}/timelogs`,
        method: 'POST',
        body: body || { hours, log_date, description },
      }),
      invalidatesTags: (_res, _err, { taskId }) => [{ type: 'Tasks', id: taskId }, 'Tasks', 'TimeLogs'],
    }),
    getTaskTimeLogs: builder.query<TaskTimeLogItem[], number>({
      query: (taskId) => `/tasks/${taskId}/timelogs`,
      providesTags: ['TimeLogs'],
    }),

    // Comments
    addComment: builder.mutation<TaskCommentItem, { taskId: number; content?: string; body?: { content: string } }>({
      query: ({ taskId, content, body }) => ({
        url: `/tasks/${taskId}/comments`,
        method: 'POST',
        body: { content: content || body?.content || '' },
      }),
      invalidatesTags: ['Comments'],
    }),
    getTaskComments: builder.query<TaskCommentItem[], number>({
      query: (taskId) => `/tasks/${taskId}/comments`,
      providesTags: ['Comments'],
    }),

    // Task Attachments
    getTaskAttachments: builder.query<TaskAttachmentItem[], number>({
      query: (taskId) => `/tasks/${taskId}/attachments`,
      providesTags: (_res, _err, taskId) => [{ type: 'Attachments', id: taskId }, 'Attachments'],
    }),
    addTaskAttachment: builder.mutation<TaskAttachmentItem, { taskId: number; filename: string; file_size?: string; file_url?: string }>({
      query: ({ taskId, ...body }) => ({
        url: `/tasks/${taskId}/attachments`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { taskId }) => [{ type: 'Attachments', id: taskId }, 'Attachments'],
    }),
    deleteTaskAttachment: builder.mutation<void, number>({
      query: (id) => ({
        url: `/tasks/attachments/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Attachments'],
    }),

    // Task Custom Fields
    getTaskCustomFields: builder.query<TaskCustomFieldValueItem[], number>({
      query: (taskId) => `/tasks/${taskId}/custom-fields`,
      providesTags: (_res, _err, taskId) => [{ type: 'TaskCustomFields', id: taskId }, 'TaskCustomFields'],
    }),
    saveTaskCustomField: builder.mutation<TaskCustomFieldValueItem, { taskId: number; field_id: number; value?: string }>({
      query: ({ taskId, field_id, value }) => ({
        url: `/tasks/${taskId}/custom-fields`,
        method: 'POST',
        body: { field_id, value },
      }),
      invalidatesTags: (_res, _err, { taskId }) => [{ type: 'TaskCustomFields', id: taskId }, 'TaskCustomFields', { type: 'Tasks', id: taskId }, 'Tasks'],
    }),

    // Status Definitions
    getStatusDefinitions: builder.query<StatusDefinitionItem[], void>({
      query: () => '/projects/statuses/definitions',
      providesTags: ['StatusDefs'],
    }),
    createStatusDefinition: builder.mutation<StatusDefinitionItem, Partial<StatusDefinitionItem>>({
      query: (body) => ({
        url: '/projects/statuses/definitions',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['StatusDefs'],
    }),
    updateStatusDefinition: builder.mutation<StatusDefinitionItem, { id: number; body: Partial<StatusDefinitionItem> }>({
      query: ({ id, body }) => ({
        url: `/projects/statuses/definitions/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['StatusDefs'],
    }),
    deleteStatusDefinition: builder.mutation<void, number>({
      query: (id) => ({
        url: `/projects/statuses/definitions/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['StatusDefs'],
    }),

    // Custom Field Definitions
    getCustomFieldDefinitions: builder.query<CustomFieldDefinitionItem[], void>({
      query: () => '/projects/tasks/custom-fields/definitions',
      providesTags: ['CustomFieldDefs'],
    }),
    createCustomFieldDefinition: builder.mutation<CustomFieldDefinitionItem, Partial<CustomFieldDefinitionItem>>({
      query: (body) => ({
        url: '/projects/tasks/custom-fields/definitions',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['CustomFieldDefs'],
    }),
    updateCustomFieldDefinition: builder.mutation<CustomFieldDefinitionItem, { id: number; body: Partial<CustomFieldDefinitionItem> }>({
      query: ({ id, body }) => ({
        url: `/projects/tasks/custom-fields/definitions/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['CustomFieldDefs'],
    }),
    deleteCustomFieldDefinition: builder.mutation<void, number>({
      query: (id) => ({
        url: `/projects/tasks/custom-fields/definitions/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['CustomFieldDefs'],
    }),

    // Milestones
    getTaskTags: builder.query<TaskTagInfo[], void>({
      query: () => '/tasks/tags/list',
      providesTags: ['Tasks'],
    }),

    getProjectMilestones: builder.query<ProjectMilestoneItem[], number>({
      query: (projectId) => `/projects/${projectId}/milestones`,
      providesTags: (_res, _err, projectId) => [{ type: 'Milestones', id: projectId }, 'Milestones'],
    }),
    createProjectMilestone: builder.mutation<ProjectMilestoneItem, { projectId: number; body: Partial<ProjectMilestoneItem> }>({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/milestones`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { projectId }) => [{ type: 'Milestones', id: projectId }, 'Milestones'],
    }),
    updateProjectMilestone: builder.mutation<ProjectMilestoneItem, { id: number; body: Partial<ProjectMilestoneItem> }>({
      query: ({ id, body }) => ({
        url: `/projects/milestones/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Milestones'],
    }),
    deleteProjectMilestone: builder.mutation<void, number>({
      query: (id) => ({
        url: `/projects/milestones/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Milestones', 'Tasks', 'TaskLists', 'Projects'],
    }),
    // Task Lists (Milestone → Task List → Task)
    getProjectTaskLists: builder.query<ProjectTaskListItem[], number>({
      query: (projectId) => `/projects/${projectId}/task-lists`,
      providesTags: (_res, _err, projectId) => [{ type: 'TaskLists', id: projectId }, 'TaskLists'],
    }),
    getMilestoneTaskLists: builder.query<ProjectTaskListItem[], number>({
      query: (milestoneId) => `/projects/milestones/${milestoneId}/task-lists`,
      providesTags: (_res, _err, milestoneId) => [{ type: 'TaskLists', id: milestoneId }, 'TaskLists'],
    }),
    createTaskList: builder.mutation<ProjectTaskListItem, { milestoneId: number; name: string }>({
      query: ({ milestoneId, name }) => ({
        url: `/projects/milestones/${milestoneId}/task-lists`,
        method: 'POST',
        body: { name },
      }),
      invalidatesTags: ['TaskLists', 'Milestones', 'Projects'],
    }),
    updateTaskList: builder.mutation<ProjectTaskListItem, { id: number; name: string }>({
      query: ({ id, name }) => ({
        url: `/projects/task-lists/${id}`,
        method: 'PATCH',
        body: { name },
      }),
      invalidatesTags: ['TaskLists'],
    }),
    deleteTaskList: builder.mutation<void, number>({
      query: (id) => ({
        url: `/projects/task-lists/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['TaskLists', 'Tasks', 'Milestones', 'Projects'],
    }),
    reorderTaskLists: builder.mutation<void, { milestoneId: number; siblingIds: number[] }>({
      query: ({ milestoneId, siblingIds }) => ({
        url: `/projects/milestones/${milestoneId}/reorder-task-lists`,
        method: 'POST',
        body: { sibling_ids: siblingIds },
      }),
      invalidatesTags: ['TaskLists'],
    }),
    reorderTasks: builder.mutation<void, { siblingIds: number[] }>({
      query: ({ siblingIds }) => ({
        url: `/tasks/reorder`,
        method: 'POST',
        body: { sibling_ids: siblingIds },
      }),
      invalidatesTags: ['Tasks'],
    }),
    // Stopwatch Time Tracking
    startTimer: builder.mutation<TaskItem, number>({
      query: (taskId) => ({
        url: `/tasks/${taskId}/timer/start`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, taskId) => [{ type: 'Tasks', id: taskId }, 'Tasks'],
    }),
    stopTimer: builder.mutation<TaskItem, { taskId: number; description?: string }>({
      query: ({ taskId, description }) => ({
        url: `/tasks/${taskId}/timer/stop`,
        method: 'POST',
        body: { description },
      }),
      invalidatesTags: (_res, _err, { taskId }) => [{ type: 'Tasks', id: taskId }, 'Tasks'],
    }),

    // Checklists
    addChecklist: builder.mutation<TaskChecklistInfo, { taskId: number; title: string }>({
      query: ({ taskId, title }) => ({
        url: `/tasks/${taskId}/checklists`,
        method: 'POST',
        body: { title },
      }),
      invalidatesTags: (_res, _err, { taskId }) => [{ type: 'Tasks', id: taskId }, 'Tasks'],
    }),
    addChecklistItem: builder.mutation<TaskChecklistItemInfo, { taskId: number; checklistId: number; title: string; assignee_id?: number; due_date?: string }>({
      query: ({ taskId, checklistId, ...body }) => ({
        url: `/tasks/${taskId}/checklists/${checklistId}/items`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { taskId }) => [{ type: 'Tasks', id: taskId }, 'Tasks'],
    }),
    toggleChecklistItem: builder.mutation<TaskChecklistItemInfo, { taskId: number; itemId: number }>({
      query: ({ taskId, itemId }) => ({
        url: `/tasks/${taskId}/checklists/items/${itemId}`,
        method: 'PATCH',
      }),
      invalidatesTags: (_res, _err, { taskId }) => [{ type: 'Tasks', id: taskId }, 'Tasks'],
    }),
    convertChecklistItemToSubtask: builder.mutation<TaskItem, { taskId: number; itemId: number }>({
      query: ({ taskId, itemId }) => ({
        url: `/tasks/${taskId}/checklists/items/${itemId}/convert-to-subtask`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, { taskId }) => [{ type: 'Tasks', id: taskId }, 'Tasks'],
    }),

    // Followers
    addFollower: builder.mutation<TaskFollowerInfo, { taskId: number; user_id: number }>({
      query: ({ taskId, user_id }) => ({
        url: `/tasks/${taskId}/followers`,
        method: 'POST',
        body: { user_id },
      }),
      invalidatesTags: (_res, _err, { taskId }) => [{ type: 'Tasks', id: taskId }, 'Tasks'],
    }),
    removeFollower: builder.mutation<void, { taskId: number; user_id: number }>({
      query: ({ taskId, user_id }) => ({
        url: `/tasks/${taskId}/followers/${user_id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, { taskId }) => [{ type: 'Tasks', id: taskId }, 'Tasks'],
    }),

    // Dependencies
    addDependency: builder.mutation<TaskDependencyInfo, { taskId: number; predecessor_task_id?: number; dep_type?: string; lag_days?: number; lag_hours?: number; depends_on_task_id?: number; dependency_type?: string; direction?: string }>(
      {
        query: ({ taskId, ...body }) => ({
          url: `/tasks/${taskId}/dependencies`,
          method: 'POST',
          body,
        }),
        invalidatesTags: (_res, _err, { taskId }) => [{ type: 'Tasks', id: taskId }, 'Tasks'],
      }
    ),
    updateDependency: builder.mutation<TaskDependencyInfo, { dependencyId: number; dep_type?: string; lag_days?: number; lag_hours?: number }>(
      {
        query: ({ dependencyId, ...body }) => ({
          url: `/tasks/dependencies/${dependencyId}`,
          method: 'PATCH',
          body,
        }),
        invalidatesTags: ['Tasks'],
      }
    ),
    removeDependency: builder.mutation<void, { taskId: number; dependencyId: number }>({
      query: ({ taskId, dependencyId }) => ({
        url: `/tasks/${taskId}/dependencies/${dependencyId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, { taskId }) => [{ type: 'Tasks', id: taskId }, 'Tasks', 'Projects'],
    }),
    getCascadePreview: builder.query<CascadePreviewOut, { taskId: number; days_shift: number }>({
      query: ({ taskId, days_shift }) => `/tasks/${taskId}/cascade-preview?days_shift=${days_shift}`,
    }),

    // Subtask & Dependency Advanced Actions
    convertSubtaskToTask: builder.mutation<TaskItem, number>({
      query: (taskId) => ({
        url: `/tasks/${taskId}/convert-to-task`,
        method: 'POST',
      }),
      invalidatesTags: ['Tasks'],
    }),
    convertTaskToSubtask: builder.mutation<TaskItem, { taskId: number; target_parent_id: number }>({
      query: ({ taskId, target_parent_id }) => ({
        url: `/tasks/${taskId}/convert-to-subtask`,
        method: 'POST',
        body: { target_parent_id },
      }),
      invalidatesTags: ['Tasks'],
    }),
    reorderSubtasks: builder.mutation<void, { taskId: number; sibling_ids: number[] }>({
      query: ({ taskId, sibling_ids }) => ({
        url: `/tasks/${taskId}/reorder-subtasks`,
        method: 'POST',
        body: { sibling_ids },
      }),
      invalidatesTags: (_res, _err, { taskId }) => [{ type: 'Tasks', id: taskId }, 'Tasks'],
    }),
    rescheduleDependencies: builder.mutation<TaskItem, { taskId: number; days_shift: number }>({
      query: ({ taskId, days_shift }) => ({
        url: `/tasks/${taskId}/reschedule-dependencies`,
        method: 'POST',
        body: { days_shift },
      }),
      invalidatesTags: ['Tasks'],
    }),
    autoAdjustTaskDate: builder.mutation<TaskItem, number>({
      query: (taskId) => ({
        url: `/tasks/${taskId}/auto-adjust-date`,
        method: 'POST',
      }),
      invalidatesTags: ['Tasks', 'Projects'],
    }),

    // Bulk Actions
    bulkTaskAction: builder.mutation<{ message: string; affected: number }, { task_ids: number[]; action: string; value?: any }>({
      query: (body) => ({
        url: '/tasks/bulk-action',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Tasks', 'Projects'],
    }),

    // Task Templates
    getTaskTemplates: builder.query<any[], void>({
      query: () => '/tasks/templates',
    }),
    createTaskTemplate: builder.mutation<any, { name: string; description?: string; task_id?: number }>({
      query: (body) => ({
        url: '/tasks/templates',
        method: 'POST',
        body,
      }),
    }),
    applyTaskTemplate: builder.mutation<TaskItem, { templateId: number; project_id: number }>({
      query: ({ templateId, project_id }) => ({
        url: `/tasks/templates/${templateId}/apply`,
        method: 'POST',
        body: { project_id },
      }),
      invalidatesTags: ['Tasks', 'Projects'],
    }),

    // Calendar
    getCalendarConfig: builder.query<CalendarConfig, void>({
      query: () => '/calendar/config',
      providesTags: ['Calendar'],
    }),
    addHoliday: builder.mutation<WorkingCalendarHoliday, Omit<WorkingCalendarHoliday, 'id'|'created_at'>>({
      query: (body) => ({
        url: '/calendar/holidays',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Calendar'],
    }),
    deleteHoliday: builder.mutation<void, number>({
      query: (id) => ({
        url: `/calendar/holidays/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Calendar'],
    }),
    setWeeklyOff: builder.mutation<WeeklyOffConfig, WeeklyOffConfig>({
      query: (body) => ({
        url: '/calendar/weekly-off',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Calendar'],
    }),
    updateCalendarWorkingHours: builder.mutation<{ work_start_time: string; work_end_time: string; daily_working_hours: number }, { work_start_time: string; work_end_time: string }>({
      query: (body) => ({
        url: '/calendar/working-hours',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Calendar'],
    }),

    // PM Settings
    getProjectPmSettings: builder.query<ProjectPmSettings, number>({
      query: (projectId) => `/tasks/pm-settings/${projectId}`,
      providesTags: (_res, _err, projectId) => [{ type: 'PmSettings', id: projectId }, 'PmSettings'],
    }),
    updateProjectPmSettings: builder.mutation<ProjectPmSettings, { projectId: number; body: Partial<ProjectPmSettings> }>({
      query: ({ projectId, body }) => ({
        url: `/tasks/pm-settings/${projectId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_res, _err, { projectId }) => [{ type: 'PmSettings', id: projectId }, 'PmSettings'],
    }),
  }),
});

export const {
  useGetProjectsQuery,
  useGetProjectQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useGetTasksQuery,
  useGetTaskQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useGetPersonalTasksQuery,
  useCreatePersonalTaskMutation,
  useUpdatePersonalTaskMutation,
  useDeletePersonalTaskMutation,
  useAddSubtaskMutation,
  useToggleSubtaskMutation,
  useDeleteSubtaskMutation,
  useLogTimeMutation,
  useGetTaskTimeLogsQuery,
  useAddCommentMutation,
  useGetTaskCommentsQuery,
  useGetStatusDefinitionsQuery,
  useCreateStatusDefinitionMutation,
  useUpdateStatusDefinitionMutation,
  useDeleteStatusDefinitionMutation,
  useGetCustomFieldDefinitionsQuery,
  useCreateCustomFieldDefinitionMutation,
  useUpdateCustomFieldDefinitionMutation,
  useDeleteCustomFieldDefinitionMutation,
  useGetTaskTagsQuery,
  useGetProjectMilestonesQuery,
  useCreateProjectMilestoneMutation,
  useUpdateProjectMilestoneMutation,
  useDeleteProjectMilestoneMutation,
  useGetProjectTaskListsQuery,
  useGetMilestoneTaskListsQuery,
  useCreateTaskListMutation,
  useUpdateTaskListMutation,
  useDeleteTaskListMutation,
  useReorderTaskListsMutation,
  useReorderTasksMutation,
  useGetTaskAttachmentsQuery,
  useAddTaskAttachmentMutation,
  useDeleteTaskAttachmentMutation,
  useGetTaskCustomFieldsQuery,
  useSaveTaskCustomFieldMutation,
  useStartTimerMutation,
  useStopTimerMutation,
  useAddChecklistMutation,
  useAddChecklistItemMutation,
  useToggleChecklistItemMutation,
  useConvertChecklistItemToSubtaskMutation,
  useAddFollowerMutation,
  useRemoveFollowerMutation,
  useAddDependencyMutation,
  useUpdateDependencyMutation,
  useRemoveDependencyMutation,
  useGetCascadePreviewQuery,
  useConvertSubtaskToTaskMutation,
  useConvertTaskToSubtaskMutation,
  useReorderSubtasksMutation,
  useRescheduleDependenciesMutation,
  useAutoAdjustTaskDateMutation,
  useBulkTaskActionMutation,
  useGetTaskTemplatesQuery,
  useCreateTaskTemplateMutation,
  useApplyTaskTemplateMutation,
  useGetCalendarConfigQuery,
  useAddHolidayMutation,
  useDeleteHolidayMutation,
  useSetWeeklyOffMutation,
  useUpdateCalendarWorkingHoursMutation,
  useGetProjectPmSettingsQuery,
  useUpdateProjectPmSettingsMutation,
} = projectsApi;
