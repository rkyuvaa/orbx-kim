import { useState, useMemo, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tabs,
  Tab,
  Drawer,
  Rating,
  Divider,
  Alert,
  Tooltip,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
  LinearProgress,
} from '@mui/material';
import {
  Plus,
  Search,
  Users,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  UserCheck,
  UserX,
  Play,
  Pause,
  Award,
  DollarSign,
  Phone,
  Mail,
  Building,
  ChevronRight,
  Filter,
  Download,
  Eye,
  Edit2,
  Trash2,
  ExternalLink,
  Upload,
  UploadCloud,
  Sparkles,
  ShieldAlert,
  Check,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Bot,
  Send,
  AlertTriangle,
} from 'lucide-react';
import {
  useGetRecruitmentKPIsQuery,
  useListJobRequisitionsQuery,
  useCreateJobRequisitionMutation,
  useUpdateJobRequisitionMutation,
  useDeleteJobRequisitionMutation,
  useApproveOrRejectJobRequisitionMutation,
  useUploadJobDescriptionMutation,
  useGenerateRequisitionRubricMutation,
  useListJobPostingsQuery,
  useDraftJobPostingMutation,
  useApproveJobPostingMutation,
  usePublishJobPostingMutation,
  useListCandidatesQuery,
  useGetCandidateQuery,
  useCreateCandidateMutation,
  useUpdateCandidateMutation,
  useDeleteCandidateMutation,
  useUploadAndParseResumeMutation,
  useBulkUploadResumesMutation,
  useListJobApplicationsQuery,
  useGetJobApplicationQuery,
  useTransitionApplicationStageMutation,
  useEvaluateCandidateAIMutation,
  useGetCandidateEvaluationsQuery,
  useGetCandidateInterviewsQuery,
  useSubmitAIEvaluationFeedbackMutation,
  useTransitionCandidateStageMutation,
  useResumeCandidateRecruitmentMutation,
  useScheduleInterviewMutation,
  useUpdateCandidateOfferMutation,
  useCreateEmployeeFromCandidateMutation,
  type Candidate,
  type JobRequisition,
  type JobPosting,
  type CandidateAIEvaluation,
  type Interview,
  type JobApplication,
} from '@/api/recruitmentApi';
import { useGetDepartmentsQuery } from '@/api/rbacApi';
import { useToast } from '@/components/ui/ToastHost';
import { formatDate, formatDateTime } from '@/utils/format';

const RECRUITMENT_STAGES = [
  'Job Requisition',
  'Approval',
  'Sourcing',
  'Screening',
  'Interview',
  'Selected',
  'Offer & Joining',
  'Joined',
  'On Hold',
  'Rejected',
] as const;

const STAGE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'Job Requisition': { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  Approval: { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
  Sourcing: { bg: '#F3E8FF', color: '#7C3AED', border: '#DDD6FE' },
  Screening: { bg: '#CFFAFE', color: '#0891B2', border: '#A5F3FC' },
  Interview: { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  Selected: { bg: '#D1FAE5', color: '#047857', border: '#6EE7B7' },
  'Offer & Joining': { bg: '#E0F2FE', color: '#0284C7', border: '#BAE6FD' },
  Joined: { bg: '#DCFCE7', color: '#166534', border: '#86EFAC' },
  'On Hold': { bg: '#FFEDD5', color: '#EA580C', border: '#FED7AA' },
  Rejected: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
};

export default function RecruitmentManagement() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'kanban' | 'candidates' | 'requisitions'>('kanban');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [reqFilter, setReqFilter] = useState<string>('All');
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [stageFilter, setStageFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<string>('All');

  // Selected candidate for Drawer/Modal
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Selected requisition for Detail Drawer
  const [selectedRequisition, setSelectedRequisition] = useState<JobRequisition | null>(null);
  const [reqDrawerOpen, setReqDrawerOpen] = useState(false);

  // Edit and Delete States
  const [editingReq, setEditingReq] = useState<JobRequisition | null>(null);
  const [editingCand, setEditingCand] = useState<Candidate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: 'requisition' | 'candidate'; id: number | null; title: string }>({
    open: false,
    type: 'requisition',
    id: null,
    title: '',
  });

  // Dialog States
  const [createReqDialog, setCreateReqDialog] = useState(false);
  const [createCandidateDialog, setCreateCandidateDialog] = useState(false);
  const [stageTransitionDialog, setStageTransitionDialog] = useState(false);
  const [interviewDialog, setInterviewDialog] = useState(false);
  const [offerDialog, setOfferDialog] = useState(false);
  const [createEmployeeDialog, setCreateEmployeeDialog] = useState(false);
  const [approveRejectReqDialog, setApproveRejectReqDialog] = useState<{ open: boolean; req: JobRequisition | null; action: 'Approve' | 'Reject' }>({
    open: false,
    req: null,
    action: 'Approve',
  });
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [selectedPosting, setSelectedPosting] = useState<JobPosting | null>(null);

  // Bulk Upload State
  const [bulkUploadReqId, setBulkUploadReqId] = useState<number | undefined>(undefined);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkConsent, setBulkConsent] = useState(true);
  const [bulkUploadResult, setBulkUploadResult] = useState<{ total_processed: number; success_count: number; failed_count: number; errors: string[] } | null>(null);

  // Resume Parsing & Consent
  const [candConsent, setCandConsent] = useState(true);
  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  const jdInputRef = useRef<HTMLInputElement | null>(null);
  const bulkInputRef = useRef<HTMLInputElement | null>(null);

  // Publish Form State
  const [publishForm, setPublishForm] = useState({
    external_job_id: '',
    external_post_url: 'https://indeed.com/job/',
  });

  // Target stage for transition modal
  const [targetStage, setTargetStage] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [onHoldReason, setOnHoldReason] = useState('');
  const [transitionRemarks, setTransitionRemarks] = useState('');

  // RTK Query Hooks
  const { data: kpis } = useGetRecruitmentKPIsQuery();
  const { data: requisitions = [], isLoading: reqsLoading } = useListJobRequisitionsQuery();
  const { data: candidates = [], isLoading: candidatesLoading } = useListCandidatesQuery({
    search: searchTerm,
    job_requisition_id: reqFilter !== 'All' ? parseInt(reqFilter) : undefined,
    department: deptFilter !== 'All' ? deptFilter : undefined,
    stage: stageFilter !== 'All' ? stageFilter : undefined,
    candidate_source: sourceFilter !== 'All' ? sourceFilter : undefined,
  });

  // Active Requisition Postings Query
  const { data: requisitionPostings = [] } = useListJobPostingsQuery(selectedRequisition?.id ?? 0, {
    skip: !selectedRequisition?.id,
  });

  // Active Candidate Evaluations and Interviews Queries
  const { data: candEvaluations = [] } = useGetCandidateEvaluationsQuery(selectedCandidate?.id ?? 0, {
    skip: !selectedCandidate?.id,
  });
  const { data: candInterviews = [] } = useGetCandidateInterviewsQuery(selectedCandidate?.id ?? 0, {
    skip: !selectedCandidate?.id,
  });

  // Mutations
  const [createRequisition] = useCreateJobRequisitionMutation();
  const [updateJobRequisition] = useUpdateJobRequisitionMutation();
  const [deleteJobRequisition] = useDeleteJobRequisitionMutation();
  const [approveRejectRequisition] = useApproveOrRejectJobRequisitionMutation();
  const [uploadJobDescription, { isLoading: isUploadingJD }] = useUploadJobDescriptionMutation();
  const [generateRubric, { isLoading: isGeneratingRubric }] = useGenerateRequisitionRubricMutation();
  const [draftJobPosting, { isLoading: isDraftingPosting }] = useDraftJobPostingMutation();
  const [approveJobPosting] = useApproveJobPostingMutation();
  const [publishJobPosting] = usePublishJobPostingMutation();

  const [createCandidate] = useCreateCandidateMutation();
  const [updateCandidate] = useUpdateCandidateMutation();
  const [deleteCandidate] = useDeleteCandidateMutation();
  const [transitionStage] = useTransitionCandidateStageMutation();
  const [resumeCandidate] = useResumeCandidateRecruitmentMutation();
  const [uploadAndParseResume, { isLoading: isParsingResume }] = useUploadAndParseResumeMutation();
  const [bulkUploadResumes, { isLoading: isBulkUploading }] = useBulkUploadResumesMutation();
  const [evaluateCandidateAI, { isLoading: isEvaluatingCandidate }] = useEvaluateCandidateAIMutation();
  const [submitAIEvaluationFeedback] = useSubmitAIEvaluationFeedbackMutation();

  const [scheduleInterview] = useScheduleInterviewMutation();
  const [updateOffer] = useUpdateCandidateOfferMutation();
  const [createEmployee] = useCreateEmployeeFromCandidateMutation();

  // Forms
  const EMPTY_REQ_FORM = {
    job_title: '',
    department: '',
    vacancies: 1,
    employment_type: 'Full Time',
    required_qualification: '',
    required_experience: '',
    skills: '',
    salary_range: '',
    preferred_joining_date: '',
    job_description: '',
    requesting_department: '',
  };

  const EMPTY_CAND_FORM = {
    job_requisition_id: undefined as number | undefined,
    name: '',
    mobile: '',
    email: '',
    resume_url: '',
    experience: '',
    qualification: '',
    current_company: '',
    current_salary: '',
    expected_salary: '',
    notice_period: '',
    candidate_source: 'Direct',
    stage: 'Sourcing',
  };

  const EMPTY_INTERVIEW_FORM = {
    round_name: 'Round 1 - Technical',
    scheduled_at: '',
    mode: 'ONLINE',
    meeting_link: 'https://meet.google.com/orbx-hr',
    location: '',
    panel: '',
    remarks: '',
    notify_candidate: true,
    notify_requester: true,
  };

  const EMPTY_OFFER_FORM = {
    offer_status: 'Offer Draft' as 'Offer Draft' | 'Offer Released' | 'Offer Accepted' | 'Offer Declined',
    confirmed_joining_date: '',
    rejection_reason: '',
  };

  const EMPTY_EMP_FORM = {
    emp_id: '',
    designation: '',
    department: '',
    branch: '',
  };

  const [reqForm, setReqForm] = useState(EMPTY_REQ_FORM);
  const [candForm, setCandForm] = useState(EMPTY_CAND_FORM);
  const [interviewForm, setInterviewForm] = useState(EMPTY_INTERVIEW_FORM);
  const [offerForm, setOfferForm] = useState(EMPTY_OFFER_FORM);
  const [empForm, setEmpForm] = useState(EMPTY_EMP_FORM);

  // Fetch Departments from Settings
  const { data: systemDepartments = [] } = useGetDepartmentsQuery();

  // Unique departments from Settings + Requisitions
  const departments = useMemo(() => {
    const set = new Set<string>();
    systemDepartments.forEach((d) => {
      if (d.name && d.status !== 'INACTIVE') set.add(d.name);
    });
    requisitions.forEach((r) => {
      if (r.department) set.add(r.department);
    });
    if (set.size === 0) {
      ['Engineering', 'Sales', 'Finance', 'HR & Admin', 'Operations', 'IT & Systems'].forEach((d) => set.add(d));
    }
    return Array.from(set);
  }, [systemDepartments, requisitions]);

  // Handlers
  const handleOpenEditRequisition = (req: JobRequisition, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingReq(req);
    setReqForm({
      job_title: req.job_title || '',
      department: req.department || '',
      vacancies: req.vacancies || 1,
      employment_type: req.employment_type || 'Full Time',
      required_qualification: req.required_qualification || '',
      required_experience: req.required_experience || '',
      skills: req.skills || '',
      salary_range: req.salary_range || '',
      preferred_joining_date: req.preferred_joining_date || '',
      job_description: req.job_description || '',
      requesting_department: req.requesting_department || '',
    });
    setCreateReqDialog(true);
  };

  const handleOpenEditCandidate = (cand: Candidate, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCand(cand);
    setCandForm({
      job_requisition_id: cand.job_requisition_id || undefined,
      name: cand.name || '',
      mobile: cand.mobile || '',
      email: cand.email || '',
      resume_url: cand.resume_url || '',
      experience: cand.experience || '',
      qualification: cand.qualification || '',
      current_company: cand.current_company || '',
      current_salary: cand.current_salary || '',
      expected_salary: cand.expected_salary || '',
      notice_period: cand.notice_period || '',
      candidate_source: cand.candidate_source || 'Direct',
      stage: cand.stage || 'Sourcing',
    });
    setCreateCandidateDialog(true);
  };

  const handleOpenDeleteConfirm = (type: 'requisition' | 'candidate', id: number, title: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteConfirm({ open: true, type, id, title });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      if (deleteConfirm.type === 'requisition') {
        await deleteJobRequisition(deleteConfirm.id).unwrap();
        showToast('Job Requisition deleted successfully', 'success');
        if (selectedRequisition?.id === deleteConfirm.id) {
          setReqDrawerOpen(false);
          setSelectedRequisition(null);
        }
      } else {
        await deleteCandidate(deleteConfirm.id).unwrap();
        showToast('Candidate record deleted successfully', 'success');
        if (selectedCandidate?.id === deleteConfirm.id) {
          setDrawerOpen(false);
          setSelectedCandidate(null);
        }
      }
      setDeleteConfirm({ open: false, type: 'requisition', id: null, title: '' });
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to delete record', 'error');
    }
  };

  const handleSaveRequisition = async () => {
    if (!reqForm.job_title?.trim() || !reqForm.department?.trim()) {
      showToast('Please fill required job title and department', 'error');
      return;
    }
    try {
      const payload: any = {
        job_title: reqForm.job_title.trim(),
        department: reqForm.department.trim(),
        vacancies: Number(reqForm.vacancies) || 1,
        employment_type: reqForm.employment_type || 'Full Time',
        required_qualification: reqForm.required_qualification || 'Not Specified',
        required_experience: reqForm.required_experience || 'Not Specified',
        skills: reqForm.skills || 'General',
        salary_range: reqForm.salary_range || 'Competitive',
        job_description: reqForm.job_description?.trim() || `${reqForm.job_title} for ${reqForm.department}`,
        requesting_department: reqForm.requesting_department || reqForm.department,
      };
      if (reqForm.preferred_joining_date && reqForm.preferred_joining_date.trim() !== '') {
        payload.preferred_joining_date = reqForm.preferred_joining_date;
      }

      if (editingReq) {
        await updateJobRequisition({ id: editingReq.id, body: payload }).unwrap();
        showToast('Job Requisition updated successfully', 'success');
      } else {
        await createRequisition(payload).unwrap();
        showToast('Job Requisition created and submitted for approval', 'success');
      }
      setCreateReqDialog(false);
      setEditingReq(null);
      setReqForm(EMPTY_REQ_FORM);
    } catch (err: any) {
      let errorMsg = 'Failed to save job requisition';
      if (typeof err?.data?.detail === 'string') {
        errorMsg = err.data.detail;
      } else if (Array.isArray(err?.data?.detail)) {
        errorMsg = err.data.detail.map((e: any) => `${e.loc?.slice(-1)[0] || 'Field'}: ${e.msg}`).join(', ');
      }
      showToast(errorMsg, 'error');
    }
  };

  const handleApproveRejectRequisition = async () => {
    if (!approveRejectReqDialog.req) return;
    if (approveRejectReqDialog.action === 'Reject' && !rejectionReason) {
      showToast('Rejection reason is mandatory', 'error');
      return;
    }
    try {
      await approveRejectRequisition({
        id: approveRejectReqDialog.req.id,
        action: approveRejectReqDialog.action,
        rejection_reason: rejectionReason,
      }).unwrap();
      showToast(
        `Job Requisition ${approveRejectReqDialog.action === 'Approve' ? 'Approved' : 'Rejected'}`,
        'success'
      );
      setApproveRejectReqDialog({ open: false, req: null, action: 'Approve' });
      setRejectionReason('');
    } catch (err: any) {
      showToast(err?.data?.detail || 'Action failed', 'error');
    }
  };

  const handleSaveCandidate = async () => {
    if (!candForm.name || !candForm.email || !candForm.mobile) {
      showToast('Candidate Name, Email, and Mobile are required', 'error');
      return;
    }
    try {
      if (editingCand) {
        await updateCandidate({ id: editingCand.id, body: candForm }).unwrap();
        showToast('Candidate profile updated successfully', 'success');
      } else {
        await createCandidate(candForm).unwrap();
        showToast('Candidate added to recruitment pipeline', 'success');
      }
      setCreateCandidateDialog(false);
      setEditingCand(null);
      setCandForm(EMPTY_CAND_FORM);
    } catch (err: any) {
      let errorMsg = 'Failed to save candidate';
      if (typeof err?.data?.detail === 'string') {
        errorMsg = err.data.detail;
      } else if (Array.isArray(err?.data?.detail)) {
        errorMsg = err.data.detail.map((e: any) => `${e.loc?.slice(-1)[0] || 'Field'}: ${e.msg}`).join(', ');
      }
      showToast(errorMsg, 'error');
    }
  };

  const handleInitiateStageTransition = (candidate: Candidate, newStage: string) => {
    setSelectedCandidate(candidate);
    setTargetStage(newStage);
    setRejectionReason('');
    setOnHoldReason('');
    setTransitionRemarks('');
    setStageTransitionDialog(true);
  };

  const handleConfirmStageTransition = async () => {
    if (!selectedCandidate || !targetStage) return;

    if (targetStage === 'On Hold' && !onHoldReason) {
      showToast('On Hold reason is mandatory', 'error');
      return;
    }
    if (targetStage === 'Rejected' && !rejectionReason) {
      showToast('Rejection reason is mandatory', 'error');
      return;
    }

    try {
      const updated = await transitionStage({
        id: selectedCandidate.id,
        body: {
          new_stage: targetStage,
          rejection_reason: rejectionReason,
          on_hold_reason: onHoldReason,
          remarks: transitionRemarks,
        },
      }).unwrap();
      showToast(`Candidate moved to ${targetStage}`, 'success');
      setSelectedCandidate(updated);
      setStageTransitionDialog(false);
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to update stage', 'error');
    }
  };

  const handleResumeCandidate = async (candidateId: number) => {
    try {
      const updated = await resumeCandidate(candidateId).unwrap();
      showToast(`Candidate resumed from On Hold to ${updated.stage}`, 'success');
      setSelectedCandidate(updated);
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to resume candidate', 'error');
    }
  };

  const handleScheduleInterviewSubmit = async () => {
    if (!selectedCandidate) return;
    try {
      await scheduleInterview({
        application_id: selectedCandidate.latest_application_id || selectedCandidate.id,
        round_name: interviewForm.round_name || 'Round 1 - Technical',
        scheduled_at: interviewForm.scheduled_at || new Date().toISOString(),
        mode: interviewForm.mode || 'ONLINE',
        meeting_link: interviewForm.meeting_link,
        location: interviewForm.location,
        panel: interviewForm.panel,
        remarks: interviewForm.remarks,
      }).unwrap();
      showToast('Interview scheduled! Candidate invitation (Email + DLT SMS) and requester alert dispatched.', 'success');
      setInterviewDialog(false);
      setInterviewForm(EMPTY_INTERVIEW_FORM);
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to schedule interview', 'error');
    }
  };

  const handleJDUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRequisition) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const updated = await uploadJobDescription({ id: selectedRequisition.id, formData }).unwrap();
      setSelectedRequisition(updated);
      showToast('Job description uploaded and AI scoring rubric generated!', 'success');
      if (jdInputRef.current) jdInputRef.current.value = '';
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to upload job description', 'error');
    }
  };

  const handleExtractRubric = async () => {
    if (!selectedRequisition) return;
    try {
      await generateRubric(selectedRequisition.id).unwrap();
      showToast('Scoring rubric successfully extracted and cached with AI!', 'success');
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to generate scoring rubric', 'error');
    }
  };

  const handleDraftIndeedPost = async () => {
    if (!selectedRequisition) return;
    try {
      await draftJobPosting({ reqId: selectedRequisition.id, channel: 'indeed' }).unwrap();
      showToast('AI drafted Indeed job posting successfully!', 'success');
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to draft Indeed post', 'error');
    }
  };

  const handleApprovePosting = async (postId: number) => {
    try {
      await approveJobPosting(postId).unwrap();
      showToast('Indeed job posting approved by HR!', 'success');
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to approve job posting', 'error');
    }
  };

  const handlePublishPostingSubmit = async () => {
    if (!selectedPosting) return;
    try {
      await publishJobPosting({
        id: selectedPosting.id,
        body: {
          external_job_id: publishForm.external_job_id || `IND-${Date.now()}`,
          external_post_url: publishForm.external_post_url,
        },
      }).unwrap();
      showToast('Job posting published to Indeed successfully!', 'success');
      setPublishDialogOpen(false);
      setSelectedPosting(null);
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to publish posting', 'error');
    }
  };

  const handleResumeUploadAndParse = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('candidate_source', 'Direct');
      formData.append('consent_captured', String(candConsent));
      if (candForm.job_requisition_id) {
        formData.append('job_requisition_id', String(candForm.job_requisition_id));
      }

      const res = await uploadAndParseResume(formData).unwrap();
      setCandForm((prev) => ({
        ...prev,
        name: res.extracted_fields?.name || prev.name,
        email: res.extracted_fields?.email || prev.email,
        mobile: res.extracted_fields?.mobile || prev.mobile,
        experience: res.extracted_fields?.experience || prev.experience,
        qualification: res.extracted_fields?.qualification || prev.qualification,
        current_company: res.extracted_fields?.current_company || prev.current_company,
        expected_salary: res.extracted_fields?.expected_salary || prev.expected_salary,
        resume_url: res.resume_file_url || prev.resume_url,
      }));
      showToast('Resume parsed with OCR & AI! Profile auto-filled.', 'success');
      if (resumeInputRef.current) resumeInputRef.current.value = '';
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to parse resume with AI', 'error');
    }
  };

  const handleBulkUploadSubmit = async () => {
    if (!bulkUploadReqId) {
      showToast('Please select a Job Requisition for bulk upload', 'error');
      return;
    }
    if (bulkFiles.length === 0) {
      showToast('Please choose at least 1 resume file to upload', 'error');
      return;
    }

    try {
      const formData = new FormData();
      bulkFiles.forEach((file) => formData.append('files', file));
      formData.append('candidate_source', 'Direct');
      formData.append('consent_captured', String(bulkConsent));

      const res = await bulkUploadResumes({
        reqId: bulkUploadReqId,
        formData,
      }).unwrap();

      setBulkUploadResult(res);
      showToast(`Bulk upload complete! ${res.success_count} processed, ${res.failed_count} failed.`, 'success');
      setBulkFiles([]);
      if (bulkInputRef.current) bulkInputRef.current.value = '';
    } catch (err: any) {
      showToast(err?.data?.detail || 'Bulk resume upload failed', 'error');
    }
  };

  const handleUpdateOfferSubmit = async () => {
    if (!selectedCandidate) return;
    if (offerForm.offer_status === 'Offer Declined' && !offerForm.rejection_reason) {
      showToast('Rejection reason is mandatory when offer is declined', 'error');
      return;
    }
    try {
      const updated = await updateOffer({
        id: selectedCandidate.id,
        ...offerForm,
      }).unwrap();
      showToast(`Offer status updated to ${offerForm.offer_status}`, 'success');
      setSelectedCandidate(updated);
      setOfferDialog(false);
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to update offer', 'error');
    }
  };

  const handleCreateEmployeeSubmit = async () => {
    if (!selectedCandidate) return;
    try {
      const updated = await createEmployee({
        id: selectedCandidate.id,
        ...empForm,
      }).unwrap();
      showToast('Employee record created successfully in Employee Master!', 'success');
      setSelectedCandidate(updated);
      setCreateEmployeeDialog(false);
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to create employee record', 'error');
    }
  };

  const getStageCount = (stage: string) => {
    switch (stage) {
      case 'Job Requisition':
        return kpis?.job_requisition ?? candidates.filter((c) => c.stage === 'Job Requisition').length;
      case 'Approval':
        return kpis?.approval ?? candidates.filter((c) => c.stage === 'Approval').length;
      case 'Sourcing':
        return kpis?.sourcing ?? candidates.filter((c) => c.stage === 'Sourcing').length;
      case 'Screening':
        return kpis?.screening ?? candidates.filter((c) => c.stage === 'Screening').length;
      case 'Interview':
        return kpis?.interviews ?? candidates.filter((c) => c.stage === 'Interview').length;
      case 'Selected':
        return kpis?.selected ?? candidates.filter((c) => c.stage === 'Selected').length;
      case 'Offer & Joining':
        return kpis?.offers ?? candidates.filter((c) => c.stage === 'Offer & Joining').length;
      case 'Joined':
        return kpis?.joined ?? candidates.filter((c) => c.stage === 'Joined').length;
      case 'On Hold':
        return kpis?.on_hold ?? candidates.filter((c) => c.stage === 'On Hold').length;
      case 'Rejected':
        return kpis?.rejected ?? candidates.filter((c) => c.stage === 'Rejected').length;
      default:
        return 0;
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* 1. CRM-Style Stage Pipeline Bar */}
      <Box
        sx={{
          mb: 2,
          p: 1.25,
          bgcolor: '#ffffff',
          borderRadius: 3,
          border: '1px solid #e2e8f0',
          overflowX: 'auto',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 1100, gap: 0.5 }}>
          {RECRUITMENT_STAGES.map((stage, i) => {
            const count = getStageCount(stage);
            const theme = STAGE_COLORS[stage] || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
            const isSelected = stageFilter === stage;

            return (
              <Box key={stage} sx={{ display: 'flex', alignItems: 'center' }}>
                <Tooltip title={isSelected ? 'Clear filter' : `Filter by ${stage}`} placement="top" arrow>
                  <button
                    type="button"
                    onClick={() => setStageFilter(isSelected ? 'All' : stage)}
                    style={{
                      width: 106,
                      height: 68,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      border: '1.5px solid',
                      borderColor: isSelected ? theme.color : theme.border,
                      borderRadius: 12,
                      padding: '6px 4px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? `${theme.color}22` : theme.bg,
                      boxShadow: isSelected ? `0 4px 12px ${theme.color}33` : '0 1px 3px rgba(0, 0, 0, 0.04)',
                      transition: 'all 0.15s ease',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      flexShrink: 0,
                    }}
                  >
                    {/* White Badge for Count */}
                    <div
                      style={{
                        minWidth: 32,
                        height: 22,
                        padding: '0 8px',
                        borderRadius: 11,
                        backgroundColor: '#FFFFFF',
                        boxShadow: '0 1.5px 4px rgba(0, 0, 0, 0.08)',
                        border: `1px solid ${theme.color}25`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: theme.color,
                          lineHeight: 1,
                        }}
                      >
                        {count}
                      </span>
                    </div>

                    {/* Stage Label */}
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: theme.color,
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: 0.2,
                        lineHeight: 1.1,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        height: 22,
                        wordBreak: 'break-word',
                        padding: '0 2px',
                      }}
                    >
                      {stage}
                    </div>
                  </button>
                </Tooltip>

                {i < RECRUITMENT_STAGES.length - 1 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#cbd5e1',
                      width: 14,
                      flexShrink: 0,
                    }}
                  >
                    <ChevronRight size={13} />
                  </div>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* 2. Top Action Controls & View Switcher */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Stack direction="row" spacing={1}>
          <Button
            variant={activeTab === 'kanban' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('kanban')}
            sx={{
              bgcolor: activeTab === 'kanban' ? '#16C47F' : 'transparent',
              borderColor: '#16C47F',
              color: activeTab === 'kanban' ? '#fff' : '#16C47F',
              textTransform: 'none',
              borderRadius: 2,
              '&:hover': { bgcolor: activeTab === 'kanban' ? '#12A66C' : 'rgba(8,122,61,0.08)' },
            }}
          >
            Kanban Pipeline
          </Button>
          <Button
            variant={activeTab === 'candidates' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('candidates')}
            sx={{
              bgcolor: activeTab === 'candidates' ? '#16C47F' : 'transparent',
              borderColor: '#16C47F',
              color: activeTab === 'candidates' ? '#fff' : '#16C47F',
              textTransform: 'none',
              borderRadius: 2,
              '&:hover': { bgcolor: activeTab === 'candidates' ? '#12A66C' : 'rgba(8,122,61,0.08)' },
            }}
          >
            Candidate List
          </Button>
          <Button
            variant={activeTab === 'requisitions' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('requisitions')}
            sx={{
              bgcolor: activeTab === 'requisitions' ? '#16C47F' : 'transparent',
              borderColor: '#16C47F',
              color: activeTab === 'requisitions' ? '#fff' : '#16C47F',
              textTransform: 'none',
              borderRadius: 2,
              '&:hover': { bgcolor: activeTab === 'requisitions' ? '#12A66C' : 'rgba(8,122,61,0.08)' },
            }}
          >
            Job Requisitions ({requisitions.length})
          </Button>
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<UploadCloud size={18} />}
            onClick={() => {
              setBulkUploadDialogOpen(true);
              setBulkUploadResult(null);
              setBulkFiles([]);
              if (reqFilter !== 'All') {
                setBulkUploadReqId(parseInt(reqFilter));
              }
            }}
            sx={{ borderColor: '#16C47F', color: '#16C47F', textTransform: 'none', borderRadius: 2 }}
          >
            Bulk Upload Resumes
          </Button>
          <Button
            variant="outlined"
            startIcon={<Plus size={18} />}
            onClick={() => {
              setEditingReq(null);
              setReqForm(EMPTY_REQ_FORM);
              setCreateReqDialog(true);
            }}
            sx={{ borderColor: '#cbd5e1', color: '#334155', textTransform: 'none', borderRadius: 2 }}
          >
            New Job Requisition
          </Button>
          <Button
            variant="contained"
            startIcon={<Plus size={18} />}
            onClick={() => {
              setEditingCand(null);
              setCandForm(EMPTY_CAND_FORM);
              setCreateCandidateDialog(true);
            }}
            sx={{ bgcolor: '#16C47F', '&:hover': { bgcolor: '#12A66C' }, textTransform: 'none', borderRadius: 2 }}
          >
            Add Candidate
          </Button>
        </Stack>
      </Box>

      {/* 3. Search & Filter Toolbar */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: '#f8fafc' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by candidate name, mobile, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <Search size={16} style={{ marginRight: 8, color: '#64748b' }} />,
              }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Job Requisition</InputLabel>
              <Select
                value={reqFilter}
                label="Job Requisition"
                onChange={(e) => setReqFilter(e.target.value)}
              >
                <MenuItem value="All">All Requisitions</MenuItem>
                {requisitions.map((r) => (
                  <MenuItem key={r.id} value={String(r.id)}>
                    {r.job_title} ({r.req_code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Department</InputLabel>
              <Select
                value={deptFilter}
                label="Department"
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <MenuItem value="All">All Departments</MenuItem>
                {departments.map((d) => (
                  <MenuItem key={d} value={d}>
                    {d}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Stage Filter</InputLabel>
              <Select
                value={stageFilter}
                label="Stage Filter"
                onChange={(e) => setStageFilter(e.target.value)}
              >
                <MenuItem value="All">All 10 Stages</MenuItem>
                {RECRUITMENT_STAGES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Candidate Source</InputLabel>
              <Select
                value={sourceFilter}
                label="Candidate Source"
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <MenuItem value="All">All Sources</MenuItem>
                <MenuItem value="LinkedIn">LinkedIn</MenuItem>
                <MenuItem value="Job Portal">Job Portal</MenuItem>
                <MenuItem value="Referral">Employee Referral</MenuItem>
                <MenuItem value="Agency">Agency</MenuItem>
                <MenuItem value="Direct">Direct Application</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* 4. Tab Content Region */}

      {/* VIEW A: Clean 10-Column Kanban Pipeline */}
      {activeTab === 'kanban' && (
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            overflowX: 'auto',
            pb: 2,
            minHeight: 520,
          }}
        >
          {RECRUITMENT_STAGES.map((stage) => {
            const stageCandidates = candidates.filter((c) => c.stage === stage);
            const style = STAGE_COLORS[stage] || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };

            return (
              <Paper
                key={stage}
                variant="outlined"
                sx={{
                  width: 280,
                  minWidth: 280,
                  bgcolor: '#f8fafc',
                  borderRadius: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: '75vh',
                }}
              >
                {/* Column Header */}
                <Box
                  sx={{
                    p: 1.5,
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    bgcolor: style.bg,
                    borderRadius: '8px 8px 0 0',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: style.color }}>
                    {stage}
                  </Typography>
                  <Chip
                    label={stageCandidates.length}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: 11,
                      fontWeight: 700,
                      bgcolor: '#fff',
                      color: style.color,
                      border: `1px solid ${style.border}`,
                    }}
                  />
                </Box>

                {/* Candidate Cards Column Content */}
                <Box sx={{ p: 1.5, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {stageCandidates.length === 0 ? (
                    <Box sx={{ py: 4, textStyle: 'center', color: '#94a3b8', textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                        No candidates in {stage}
                      </Typography>
                    </Box>
                  ) : (
                    stageCandidates.map((cand) => (
                      <Card
                        key={cand.id}
                        variant="outlined"
                        onClick={() => {
                          setSelectedCandidate(cand);
                          setDrawerOpen(true);
                        }}
                        sx={{
                          borderRadius: 2,
                          cursor: 'pointer',
                          borderColor: '#e2e8f0',
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                            borderColor: '#16C47F',
                          },
                        }}
                      >
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                              {cand.name}
                            </Typography>
                            <Chip
                              label={cand.candidate_source}
                              size="small"
                              sx={{ height: 18, fontSize: 9, bgcolor: '#f1f5f9', color: '#475569' }}
                            />
                          </Box>

                          <Typography variant="caption" sx={{ color: '#16C47F', fontWeight: 600, display: 'block' }}>
                            {cand.job_title || 'General Pool'}
                          </Typography>

                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.5 }}>
                            Exp: {cand.experience} • Exp. Salary: {cand.expected_salary || 'N/A'}
                          </Typography>

                          <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap' }}>
                            {cand.ai_match_score != null && (
                              <Tooltip title="AI Advisory Match Score">
                                <Chip
                                  size="small"
                                  icon={<Sparkles size={11} />}
                                  label={`${cand.ai_match_score}% Match`}
                                  sx={{
                                    height: 20,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    bgcolor: cand.ai_match_score >= 80 ? '#ecfdf5' : cand.ai_match_score >= 60 ? '#fefce8' : '#fef2f2',
                                    color: cand.ai_match_score >= 80 ? '#047857' : cand.ai_match_score >= 60 ? '#854d0e' : '#b91c1c',
                                  }}
                                />
                              </Tooltip>
                            )}
                            {cand.ai_flagged && (
                              <Tooltip title={`AI Security Flag: ${cand.ai_flag_reason || 'Suspicious instructions detected'}`}>
                                <Chip
                                  size="small"
                                  icon={<ShieldAlert size={11} color="#b91c1c" />}
                                  label="Security Flag"
                                  sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: '#fef2f2', color: '#b91c1c' }}
                                />
                              </Tooltip>
                            )}
                          </Stack>

                          {cand.interview_date && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#d97706', mb: 0.5 }}>
                              <Calendar size={12} />
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                Int: {formatDate(cand.interview_date)}
                              </Typography>
                            </Box>
                          )}

                          {cand.confirmed_joining_date && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#047857', mb: 0.5 }}>
                              <UserCheck size={12} />
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                Join: {formatDate(cand.confirmed_joining_date)}
                              </Typography>
                            </Box>
                          )}

                          {cand.stage === 'On Hold' && cand.on_hold_reason && (
                            <Typography variant="caption" sx={{ color: '#c2410c', fontStyle: 'italic', display: 'block' }}>
                              Hold: {cand.on_hold_reason}
                            </Typography>
                          )}

                          {cand.stage === 'Rejected' && cand.rejection_reason && (
                            <Typography variant="caption" sx={{ color: '#b91c1c', fontStyle: 'italic', display: 'block' }}>
                              Reason: {cand.rejection_reason}
                            </Typography>
                          )}

                          {/* Quick Stage Change Button bar */}
                          <Divider sx={{ my: 1 }} />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Button
                              size="small"
                              variant="text"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCandidate(cand);
                                setDrawerOpen(true);
                              }}
                              sx={{ fontSize: 11, textTransform: 'none', p: 0, minWidth: 'auto', color: '#64748b' }}
                            >
                              View Details
                            </Button>

                            {cand.stage === 'On Hold' ? (
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={<Play size={10} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResumeCandidate(cand.id);
                                }}
                                sx={{ height: 22, fontSize: 10, bgcolor: '#16C47F', textTransform: 'none', px: 1 }}
                              >
                                Resume
                              </Button>
                            ) : cand.stage === 'Joined' ? (
                              <Button
                                size="small"
                                variant="contained"
                                disabled={cand.is_employee_created}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCandidate(cand);
                                  setEmpForm({
                                    emp_id: '',
                                    designation: cand.selected_designation || cand.job_title || 'Employee',
                                    department: cand.selected_department || cand.job_department || 'Engineering',
                                    branch: 'Coimbatore Office',
                                  });
                                  setCreateEmployeeDialog(true);
                                }}
                                sx={{ height: 22, fontSize: 10, bgcolor: '#047857', textTransform: 'none', px: 1 }}
                              >
                                {cand.is_employee_created ? 'Created' : 'Create Emp'}
                              </Button>
                            ) : (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const idx = RECRUITMENT_STAGES.indexOf(cand.stage as any);
                                  const next = RECRUITMENT_STAGES[idx + 1] || 'Selected';
                                  handleInitiateStageTransition(cand, next);
                                }}
                                sx={{ height: 22, fontSize: 10, textTransform: 'none', px: 1, borderColor: '#cbd5e1' }}
                              >
                                Advance Stage
                              </Button>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </Box>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* VIEW B: Candidate Data Table */}
      {activeTab === 'candidates' && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Candidate Code & Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Job Position & Dept</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Contact Info</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Current Stage</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>AI Match</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Experience & CTC</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Source</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {candidates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#64748b' }}>
                    No candidates found. Click "Add Candidate" to populate the recruitment pipeline.
                  </TableCell>
                </TableRow>
              ) : (
                candidates.map((cand) => {
                  const style = STAGE_COLORS[cand.stage] || { bg: '#f1f5f9', color: '#475569' };
                  return (
                    <TableRow
                      key={cand.id}
                      hover
                      onClick={() => {
                        setSelectedCandidate(cand);
                        setDrawerOpen(true);
                      }}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Box sx={{ fontWeight: 700, color: '#0f172a' }}>{cand.name}</Box>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>{cand.candidate_code}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#16C47F' }}>
                          {cand.job_title || 'General Pool'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          {cand.job_department || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{cand.email}</Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>{cand.mobile}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={cand.stage}
                          size="small"
                          sx={{
                            bgcolor: style.bg,
                            color: style.color,
                            fontWeight: 700,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {cand.ai_match_score != null ? (
                            <Tooltip title={`AI Advisory Score: ${cand.ai_match_score}% (${cand.ai_match_category || 'Advisory'})`}>
                              <Chip
                                size="small"
                                icon={<Sparkles size={11} />}
                                label={`${cand.ai_match_score}%`}
                                sx={{
                                  height: 22,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  bgcolor: cand.ai_match_score >= 80 ? '#ecfdf5' : cand.ai_match_score >= 60 ? '#fefce8' : '#fef2f2',
                                  color: cand.ai_match_score >= 80 ? '#047857' : cand.ai_match_score >= 60 ? '#854d0e' : '#b91c1c',
                                }}
                              />
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>-</Typography>
                          )}
                          {cand.ai_flagged && (
                            <Tooltip title={`Prompt Injection Detected: ${cand.ai_flag_reason || 'Manual review required'}`}>
                              <ShieldAlert size={16} color="#b91c1c" />
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{cand.experience}</Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          Exp CTC: {cand.expected_salary || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={cand.candidate_source} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                          <Tooltip title="View Candidate Profile">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCandidate(cand);
                                setDrawerOpen(true);
                              }}
                              sx={{ color: '#16C47F' }}
                            >
                              <Eye size={16} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Candidate">
                            <IconButton
                              size="small"
                              onClick={(e) => handleOpenEditCandidate(cand, e)}
                              sx={{ color: '#2563EB' }}
                            >
                              <Edit2 size={16} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Candidate">
                            <IconButton
                              size="small"
                              onClick={(e) => handleOpenDeleteConfirm('candidate', cand.id, cand.name, e)}
                              sx={{ color: '#DC2626' }}
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* VIEW C: Job Requisitions Table */}
      {activeTab === 'requisitions' && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Req Code & Title</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Department</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Vacancies</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Exp & Qualification</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Salary Range</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requisitions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: '#64748b' }}>
                    No job requisitions created yet. Click "New Job Requisition" above.
                  </TableCell>
                </TableRow>
              ) : (
                requisitions.map((req) => (
                  <TableRow
                    key={req.id}
                    hover
                    onClick={() => {
                      setSelectedRequisition(req);
                      setReqDrawerOpen(true);
                    }}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        {req.job_title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>{req.req_code}</Typography>
                    </TableCell>
                    <TableCell>{req.department}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{req.vacancies}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{req.required_experience}</Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>{req.required_qualification}</Typography>
                    </TableCell>
                    <TableCell>{req.salary_range}</TableCell>
                    <TableCell>
                      <Chip
                        label={req.status}
                        size="small"
                        color={
                          req.status === 'Approved'
                            ? 'success'
                            : req.status === 'Approval'
                            ? 'warning'
                            : req.status === 'Rejected'
                            ? 'error'
                            : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                        {req.status === 'Approval' && (
                          <>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              onClick={(e) => {
                                e.stopPropagation();
                                setApproveRejectReqDialog({ open: true, req, action: 'Approve' });
                              }}
                              sx={{ textTransform: 'none', borderRadius: 1.5, mr: 0.5 }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                setApproveRejectReqDialog({ open: true, req, action: 'Reject' });
                              }}
                              sx={{ textTransform: 'none', borderRadius: 1.5, mr: 0.5 }}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRequisition(req);
                              setReqDrawerOpen(true);
                            }}
                            sx={{ color: '#16C47F' }}
                          >
                            <Eye size={16} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Requisition">
                          <IconButton
                            size="small"
                            onClick={(e) => handleOpenEditRequisition(req, e)}
                            sx={{ color: '#2563EB' }}
                          >
                            <Edit2 size={16} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Requisition">
                          <IconButton
                            size="small"
                            onClick={(e) => handleOpenDeleteConfirm('requisition', req.id, req.job_title, e)}
                            sx={{ color: '#DC2626' }}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ============================================================================ */}
      {/* 5. Candidate Detail Drawer (Full Audit History, Resume & Workflows)           */}
      {/* ============================================================================ */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 540 } } }}
      >
        {selectedCandidate && (
          <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>{selectedCandidate.name}</Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  {selectedCandidate.candidate_code} • {selectedCandidate.candidate_source}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={selectedCandidate.stage}
                  sx={{
                    bgcolor: STAGE_COLORS[selectedCandidate.stage]?.bg || '#eee',
                    color: STAGE_COLORS[selectedCandidate.stage]?.color || '#333',
                    fontWeight: 800,
                  }}
                />
                <Tooltip title="Edit Profile">
                  <IconButton size="small" onClick={() => handleOpenEditCandidate(selectedCandidate)} sx={{ color: '#2563EB' }}>
                    <Edit2 size={18} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete Candidate">
                  <IconButton size="small" onClick={() => handleOpenDeleteConfirm('candidate', selectedCandidate.id, selectedCandidate.name)} sx={{ color: '#DC2626' }}>
                    <Trash2 size={18} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
              {/* Security Alert if Prompt Injection Detected */}
              {selectedCandidate.ai_flagged && (
                <Alert severity="error" sx={{ mb: 2.5 }} icon={<ShieldAlert size={20} />}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>AI Security Alert</Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    Potential prompt injection or instruction override detected in resume! Reason: {selectedCandidate.ai_flag_reason || 'Instruction delimiters detected'}. Manual review required.
                  </Typography>
                </Alert>
              )}

              {/* AI Advisory Match Score Card */}
              <Card variant="outlined" sx={{ p: 2, mb: 2.5, bgcolor: '#f0fdf4', borderColor: '#bbf7d0', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#166534' }}>
                        AI Match Score: {selectedCandidate.ai_match_score != null ? `${selectedCandidate.ai_match_score}%` : 'Not Evaluated'}
                      </Typography>
                      <Chip size="small" label="AI-assisted, advisory" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontSize: 10, fontWeight: 700 }} />
                    </Box>
                    <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>
                      Deterministic weighted scoring • Model: {candEvaluations[0]?.model_name || 'Gemini 2.5 Flash'} (Rubric v{candEvaluations[0]?.rubric_version || 1})
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={isEvaluatingCandidate || !selectedCandidate.job_requisition_id}
                    startIcon={<Sparkles size={14} className={isEvaluatingCandidate ? 'animate-spin' : ''} />}
                    onClick={async () => {
                      try {
                        await evaluateCandidateAI(selectedCandidate.id).unwrap();
                        showToast('Candidate evaluated against requisition scoring rubric!', 'success');
                      } catch (err: any) {
                        showToast(err?.data?.detail || 'AI evaluation failed', 'error');
                      }
                    }}
                    sx={{ bgcolor: '#16C47F', textTransform: 'none', fontSize: 11, '&:hover': { bgcolor: '#12A66C' } }}
                  >
                    {isEvaluatingCandidate ? 'Evaluating...' : 'Evaluate with AI'}
                  </Button>
                </Box>

                {candEvaluations.length > 0 && candEvaluations[0] && (
                  <Box sx={{ mt: 1.5 }}>
                    <Grid container spacing={1} sx={{ mb: 1.5 }}>
                      <Grid item xs={4}>
                        <Paper variant="outlined" sx={{ p: 1, textAlign: 'center', bgcolor: '#fff' }}>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Skills ({candEvaluations[0].skills_weight}%)</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: '#047857' }}>{candEvaluations[0].skills_score}/100</Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={4}>
                        <Paper variant="outlined" sx={{ p: 1, textAlign: 'center', bgcolor: '#fff' }}>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Experience ({candEvaluations[0].experience_weight}%)</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: '#047857' }}>{candEvaluations[0].experience_score}/100</Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={4}>
                        <Paper variant="outlined" sx={{ p: 1, textAlign: 'center', bgcolor: '#fff' }}>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Education ({candEvaluations[0].education_weight}%)</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: '#047857' }}>{candEvaluations[0].education_score}/100</Typography>
                        </Paper>
                      </Grid>
                    </Grid>

                    {/* Matched Skills with Verbatim Evidence Quotes */}
                    {candEvaluations[0].matched_skills && candEvaluations[0].matched_skills.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#047857', display: 'block', mb: 0.5 }}>
                          Matched Skills (with Verbatim Resume Evidence):
                        </Typography>
                        <Stack spacing={0.5}>
                          {candEvaluations[0].matched_skills.map((item: any, idx: number) => (
                            <Box key={idx} sx={{ p: 0.75, bgcolor: '#fff', borderRadius: 1, border: '1px solid #dcfce7' }}>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a' }}>
                                ✓ {item.skill}
                              </Typography>
                              {item.evidence && (
                                <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic', display: 'block', pl: 1 }}>
                                  "{item.evidence}"
                                </Typography>
                              )}
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {/* Missing Skills */}
                    {candEvaluations[0].missing_skills && candEvaluations[0].missing_skills.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#b91c1c', display: 'block', mb: 0.5 }}>
                          Missing Requisition Skills:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {candEvaluations[0].missing_skills.map((s: string, idx: number) => (
                            <Chip key={idx} label={s} size="small" variant="outlined" sx={{ borderColor: '#fca5a5', color: '#b91c1c', fontSize: 11 }} />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {/* Recruiter Calibration Feedback */}
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                        Recruiter Calibration: {candEvaluations[0].hr_feedback ? `Recorded (${candEvaluations[0].hr_feedback})` : 'Is this score accurate?'}
                      </Typography>
                      <Stack direction="row" spacing={0.5}>
                        <Button
                          size="small"
                          variant={candEvaluations[0].hr_feedback === 'AGREE' ? 'contained' : 'outlined'}
                          color="success"
                          onClick={async () => {
                            try {
                              await submitAIEvaluationFeedback({ evalId: candEvaluations[0].id, hr_feedback: 'AGREE' }).unwrap();
                              showToast('Recruiter calibration recorded: Agree', 'success');
                            } catch (e: any) {
                              showToast('Failed to record calibration', 'error');
                            }
                          }}
                          sx={{ minWidth: 'auto', px: 1, py: 0.2, fontSize: 10, textTransform: 'none' }}
                        >
                          Agree
                        </Button>
                        <Button
                          size="small"
                          variant={candEvaluations[0].hr_feedback === 'TOO_HIGH' ? 'contained' : 'outlined'}
                          color="warning"
                          onClick={async () => {
                            try {
                              await submitAIEvaluationFeedback({ evalId: candEvaluations[0].id, hr_feedback: 'TOO_HIGH' }).unwrap();
                              showToast('Recruiter calibration recorded: Too High', 'success');
                            } catch (e: any) {
                              showToast('Failed to record calibration', 'error');
                            }
                          }}
                          sx={{ minWidth: 'auto', px: 1, py: 0.2, fontSize: 10, textTransform: 'none' }}
                        >
                          Too High
                        </Button>
                        <Button
                          size="small"
                          variant={candEvaluations[0].hr_feedback === 'TOO_LOW' ? 'contained' : 'outlined'}
                          color="error"
                          onClick={async () => {
                            try {
                              await submitAIEvaluationFeedback({ evalId: candEvaluations[0].id, hr_feedback: 'TOO_LOW' }).unwrap();
                              showToast('Recruiter calibration recorded: Too Low', 'success');
                            } catch (e: any) {
                              showToast('Failed to record calibration', 'error');
                            }
                          }}
                          sx={{ minWidth: 'auto', px: 1, py: 0.2, fontSize: 10, textTransform: 'none' }}
                        >
                          Too Low
                        </Button>
                      </Stack>
                    </Box>
                  </Box>
                )}
              </Card>

              {/* Scheduled Interviews Section */}
              <Box sx={{ mb: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Interview Rounds ({candInterviews.length})
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Calendar size={14} />}
                    onClick={() => setInterviewDialog(true)}
                    sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5 }}
                  >
                    Schedule Interview
                  </Button>
                </Box>
                {candInterviews.length === 0 ? (
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>No interview rounds scheduled yet.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {candInterviews.map((inv) => (
                      <Paper key={inv.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>{inv.round_name}</Typography>
                          <Chip label={inv.status} size="small" color={inv.status === 'COMPLETED' ? 'success' : inv.status === 'CONFIRMED' ? 'primary' : 'default'} sx={{ fontSize: 10, height: 20 }} />
                        </Box>
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                          Scheduled: {formatDateTime(inv.scheduled_at)} • Mode: {inv.mode}
                        </Typography>
                        {inv.meeting_link && (
                          <Typography variant="caption" sx={{ color: '#2563EB', display: 'block' }}>
                            Link: <a href={inv.meeting_link} target="_blank" rel="noreferrer">{inv.meeting_link}</a>
                          </Typography>
                        )}
                        {inv.invite_sent_at && (
                          <Typography variant="caption" sx={{ color: '#047857', display: 'block', mt: 0.5 }}>
                            ✓ Candidate Invitation Dispatched via Email & DLT SMS ({formatDateTime(inv.invite_sent_at)})
                          </Typography>
                        )}
                        {inv.requester_notified_at && (
                          <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>
                            ✓ Job Requester Notified ({formatDateTime(inv.requester_notified_at)})
                          </Typography>
                        )}
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>

              {/* Quick Stage Transition Dropdown */}
              <Card variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f8fafc', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Move Candidate Stage</Typography>
                <Stack direction="row" spacing={1.5}>
                  <FormControl fullWidth size="small">
                    <Select
                      value={selectedCandidate.stage}
                      onChange={(e) => handleInitiateStageTransition(selectedCandidate, e.target.value)}
                    >
                      {RECRUITMENT_STAGES.map((stg) => (
                        <MenuItem key={stg} value={stg}>
                          {stg}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {selectedCandidate.stage === 'On Hold' && (
                    <Button
                      variant="contained"
                      startIcon={<Play size={14} />}
                      onClick={() => handleResumeCandidate(selectedCandidate.id)}
                      sx={{ bgcolor: '#16C47F', textTransform: 'none', whiteSpace: 'nowrap' }}
                    >
                      Resume
                    </Button>
                  )}
                </Stack>
              </Card>

              {/* Action Buttons for Specific Workflows */}
              <Grid container spacing={1.5} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Calendar size={16} />}
                    onClick={() => setInterviewDialog(true)}
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                  >
                    Schedule Interview
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Award size={16} />}
                    onClick={() => setOfferDialog(true)}
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                  >
                    Manage Offer
                  </Button>
                </Grid>

                {selectedCandidate.stage === 'Joined' && (
                  <Grid item xs={12}>
                    <Button
                      fullWidth
                      variant="contained"
                      disabled={selectedCandidate.is_employee_created}
                      startIcon={<UserCheck size={16} />}
                      onClick={() => {
                        setEmpForm({
                          emp_id: '',
                          designation: selectedCandidate.selected_designation || selectedCandidate.job_title || 'Employee',
                          department: selectedCandidate.selected_department || selectedCandidate.job_department || 'Engineering',
                          branch: 'Coimbatore Office',
                        });
                        setCreateEmployeeDialog(true);
                      }}
                      sx={{ bgcolor: '#047857', '&:hover': { bgcolor: '#065f46' }, textTransform: 'none', borderRadius: 2 }}
                    >
                      {selectedCandidate.is_employee_created
                        ? 'Employee Record Created (Linked)'
                        : 'Create Employee Record in HR'}
                    </Button>
                  </Grid>
                )}
              </Grid>

              {/* Candidate Info Grid */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Candidate Details</Typography>
              <Grid container spacing={1.5} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Position:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedCandidate.job_title || 'General'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Department:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedCandidate.job_department || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Email:</Typography>
                  <Typography variant="body2">{selectedCandidate.email}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Mobile:</Typography>
                  <Typography variant="body2">{selectedCandidate.mobile}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Experience:</Typography>
                  <Typography variant="body2">{selectedCandidate.experience}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Qualification:</Typography>
                  <Typography variant="body2">{selectedCandidate.qualification}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Current Company:</Typography>
                  <Typography variant="body2">{selectedCandidate.current_company || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Expected Salary:</Typography>
                  <Typography variant="body2">{selectedCandidate.expected_salary || 'N/A'}</Typography>
                </Grid>
              </Grid>

              {/* Stage Transition Audit History */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Stage History Audit Log</Typography>
              <Stack spacing={1.5}>
                {selectedCandidate.stage_history.length === 0 ? (
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>No history records yet.</Typography>
                ) : (
                  selectedCandidate.stage_history.map((hist) => (
                    <Paper key={hist.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a' }}>
                          {hist.previous_stage || 'Created'} → <span style={{ color: '#16C47F' }}>{hist.new_stage}</span>
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          {formatDateTime(hist.changed_at)}
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>
                        By: {hist.changed_by_name}
                      </Typography>
                      {hist.remarks && (
                        <Typography variant="caption" sx={{ color: '#334155', fontStyle: 'italic', display: 'block', mt: 0.5 }}>
                          "{hist.remarks}"
                        </Typography>
                      )}
                    </Paper>
                  ))
                )}
              </Stack>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* ============================================================================ */}
      {/* 6. Job Requisition Detail Drawer                                             */}
      {/* ============================================================================ */}
      <Drawer
        anchor="right"
        open={reqDrawerOpen}
        onClose={() => setReqDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 540 } } }}
      >
        {selectedRequisition && (
          <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>{selectedRequisition.job_title}</Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Req Code: {selectedRequisition.req_code} • Department: {selectedRequisition.department}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={selectedRequisition.status}
                  color={
                    selectedRequisition.status === 'Approved'
                      ? 'success'
                      : selectedRequisition.status === 'Approval'
                      ? 'warning'
                      : selectedRequisition.status === 'Rejected'
                      ? 'error'
                      : 'default'
                  }
                  sx={{ fontWeight: 800 }}
                />
                <Tooltip title="Edit Requisition">
                  <IconButton size="small" onClick={() => handleOpenEditRequisition(selectedRequisition)} sx={{ color: '#2563EB' }}>
                    <Edit2 size={18} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete Requisition">
                  <IconButton size="small" onClick={() => handleOpenDeleteConfirm('requisition', selectedRequisition.id, selectedRequisition.job_title)} sx={{ color: '#DC2626' }}>
                    <Trash2 size={18} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
              <Grid container spacing={1.5} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Vacancies:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedRequisition.vacancies}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Employment Type:</Typography>
                  <Typography variant="body2">{selectedRequisition.employment_type}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Experience Required:</Typography>
                  <Typography variant="body2">{selectedRequisition.required_experience}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Qualification Required:</Typography>
                  <Typography variant="body2">{selectedRequisition.required_qualification}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Salary Range:</Typography>
                  <Typography variant="body2">{selectedRequisition.salary_range}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Requesting Department:</Typography>
                  <Typography variant="body2">{selectedRequisition.requesting_department || selectedRequisition.department}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Required Skills:</Typography>
                  <Typography variant="body2">{selectedRequisition.skills}</Typography>
                </Grid>
                {selectedRequisition.job_description && (
                  <Grid item xs={12}>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>Job Description:</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#334155', bgcolor: '#f8fafc', p: 1.5, borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                      {selectedRequisition.job_description}
                    </Typography>
                  </Grid>
                )}

                {/* JD Attachment and Upload Section */}
                <Grid item xs={12}>
                  <Box sx={{ p: 1.5, bgcolor: '#f1f5f9', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', display: 'block' }}>
                        {selectedRequisition.jd_attachment_name ? `JD Document: ${selectedRequisition.jd_attachment_name}` : 'No JD File Attached'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        {selectedRequisition.extracted_jd_text ? 'Text extracted via OCR & parsed' : 'Upload PDF/DOCX to extract text and generate scoring rubric'}
                      </Typography>
                    </Box>
                    <Box>
                      <input
                        type="file"
                        ref={jdInputRef}
                        accept=".pdf,.docx,.txt"
                        style={{ display: 'none' }}
                        onChange={handleJDUpload}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={isUploadingJD}
                        startIcon={<Upload size={14} className={isUploadingJD ? 'animate-spin' : ''} />}
                        onClick={() => jdInputRef.current?.click()}
                        sx={{ textTransform: 'none', fontSize: 11, bgcolor: '#fff' }}
                      >
                        {isUploadingJD ? 'Uploading...' : 'Upload JD File'}
                      </Button>
                    </Box>
                  </Box>
                </Grid>

                {selectedRequisition.status === 'Rejected' && selectedRequisition.rejection_reason && (
                  <Grid item xs={12}>
                    <Alert severity="error">
                      <strong>Rejection Reason:</strong> {selectedRequisition.rejection_reason}
                    </Alert>
                  </Grid>
                )}
              </Grid>

              {/* AI Scoring Rubric Card */}
              <Card variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f8fafc', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      Scoring Rubric {selectedRequisition.rubric_version ? `(v${selectedRequisition.rubric_version})` : ''}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      Single cached rubric used to score all incoming applicants
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={isGeneratingRubric}
                    startIcon={<RefreshCw size={12} className={isGeneratingRubric ? 'animate-spin' : ''} />}
                    onClick={handleExtractRubric}
                    sx={{ textTransform: 'none', fontSize: 11 }}
                  >
                    {isGeneratingRubric ? 'Extracting...' : 'Extract AI Rubric'}
                  </Button>
                </Box>

                {selectedRequisition.scoring_rubric ? (
                  <Stack spacing={1.5}>
                    {/* Must-Haves */}
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#047857', display: 'block', mb: 0.5 }}>
                        Must-Have Skills:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {((selectedRequisition.scoring_rubric as any).must_have_skills || []).map((s: string, idx: number) => (
                          <Chip key={idx} label={s} size="small" sx={{ bgcolor: '#ecfdf5', color: '#047857', fontWeight: 600, fontSize: 11 }} />
                        ))}
                      </Box>
                    </Box>

                    {/* Nice-To-Haves */}
                    {((selectedRequisition.scoring_rubric as any).nice_to_have_skills || []).length > 0 && (
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#1d4ed8', display: 'block', mb: 0.5 }}>
                          Nice-to-Have Skills:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {((selectedRequisition.scoring_rubric as any).nice_to_have_skills || []).map((s: string, idx: number) => (
                            <Chip key={idx} label={s} size="small" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontSize: 11 }} />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {/* Knockouts */}
                    {((selectedRequisition.scoring_rubric as any).knockout_criteria || []).length > 0 && (
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#b91c1c', display: 'block', mb: 0.5 }}>
                          Knockout Criteria:
                        </Typography>
                        <Stack spacing={0.3}>
                          {((selectedRequisition.scoring_rubric as any).knockout_criteria || []).map((k: string, idx: number) => (
                            <Typography key={idx} variant="caption" sx={{ color: '#475569' }}>
                              • {k}
                            </Typography>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                ) : (
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: '#fff' }}>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                      No rubric generated yet. Upload a JD or click "Extract AI Rubric" to parse.
                    </Typography>
                  </Paper>
                )}
              </Card>

              {/* Multi-Channel Postings (Indeed) Card */}
              <Card variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f8fafc', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      Portal Postings (Indeed)
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      AI drafts posting content for HR review and publishing
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={isDraftingPosting}
                    startIcon={<Sparkles size={14} className={isDraftingPosting ? 'animate-spin' : ''} />}
                    onClick={handleDraftIndeedPost}
                    sx={{ bgcolor: '#2563EB', textTransform: 'none', fontSize: 11, '&:hover': { bgcolor: '#1d4ed8' } }}
                  >
                    {isDraftingPosting ? 'Drafting...' : 'Draft with AI'}
                  </Button>
                </Box>

                {requisitionPostings.length === 0 ? (
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: '#fff' }}>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                      No job postings created for this requisition yet. Click "Draft with AI" to generate an Indeed posting.
                    </Typography>
                  </Paper>
                ) : (
                  <Stack spacing={1.5}>
                    {requisitionPostings.map((post) => (
                      <Paper key={post.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: '#fff' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Chip label={post.channel.toUpperCase()} size="small" sx={{ fontWeight: 700 }} />
                          <Chip
                            label={post.status}
                            size="small"
                            color={post.status === 'POSTED' ? 'success' : post.status === 'HR_APPROVED' ? 'primary' : 'warning'}
                            sx={{ fontWeight: 700, fontSize: 10, height: 20 }}
                          />
                        </Box>
                        <Typography
                          variant="caption"
                          sx={{
                            color: '#334155',
                            whiteSpace: 'pre-wrap',
                            maxHeight: 100,
                            overflowY: 'auto',
                            display: 'block',
                            bgcolor: '#f8fafc',
                            p: 1,
                            borderRadius: 1,
                            mb: 1,
                          }}
                        >
                          {post.draft_content}
                        </Typography>
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {post.status === 'DRAFTED' && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              onClick={() => handleApprovePosting(post.id)}
                              sx={{ textTransform: 'none', fontSize: 11 }}
                            >
                              Approve Draft
                            </Button>
                          )}
                          {post.status === 'HR_APPROVED' && (
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              onClick={() => {
                                setSelectedPosting(post);
                                setPublishDialogOpen(true);
                              }}
                              sx={{ textTransform: 'none', fontSize: 11 }}
                            >
                              Publish to Indeed
                            </Button>
                          )}
                          {post.status === 'POSTED' && post.external_post_url && (
                            <Button
                              size="small"
                              variant="text"
                              startIcon={<ExternalLink size={12} />}
                              href={post.external_post_url}
                              target="_blank"
                              sx={{ textTransform: 'none', fontSize: 11 }}
                            >
                              View Posting
                            </Button>
                          )}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Card>

              {/* Linked Candidates Section */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Linked Candidates ({candidates.filter((c) => c.job_requisition_id === selectedRequisition.id).length})
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<UploadCloud size={14} />}
                  onClick={() => {
                    setBulkUploadReqId(selectedRequisition.id);
                    setBulkFiles([]);
                    setBulkUploadResult(null);
                    setBulkUploadDialogOpen(true);
                  }}
                  sx={{ textTransform: 'none', fontSize: 11, borderColor: '#16C47F', color: '#16C47F' }}
                >
                  Bulk Upload Resumes
                </Button>
              </Box>
              <Stack spacing={1}>
                {candidates.filter((c) => c.job_requisition_id === selectedRequisition.id).length === 0 ? (
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>No candidates linked to this requisition yet.</Typography>
                ) : (
                  candidates
                    .filter((c) => c.job_requisition_id === selectedRequisition.id)
                    .map((c) => (
                      <Paper
                        key={c.id}
                        variant="outlined"
                        onClick={() => {
                          setSelectedCandidate(c);
                          setDrawerOpen(true);
                        }}
                        sx={{ p: 1.5, borderRadius: 2, cursor: 'pointer', '&:hover': { borderColor: '#16C47F' } }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{c.name}</Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>{c.email} • {c.mobile}</Typography>
                          </Box>
                          <Chip label={c.stage} size="small" sx={{ fontWeight: 700 }} />
                        </Box>
                      </Paper>
                    ))
                )}
              </Stack>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* ============================================================================ */}
      {/* DIALOGS                                                                       */}
      {/* ============================================================================ */}

      {/* Dialog: New/Edit Job Requisition */}
      <Dialog open={createReqDialog} onClose={() => setCreateReqDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingReq ? 'Edit Job Requisition' : 'Raise New Job Requisition'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Job Title"
            value={reqForm.job_title}
            onChange={(e) => setReqForm({ ...reqForm, job_title: e.target.value })}
            margin="normal"
            size="small"
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth margin="normal" size="small">
                <InputLabel>Department *</InputLabel>
                <Select
                  value={reqForm.department}
                  label="Department *"
                  onChange={(e) =>
                    setReqForm({
                      ...reqForm,
                      department: e.target.value,
                      requesting_department: reqForm.requesting_department || e.target.value,
                    })
                  }
                >
                  {departments.length === 0 ? (
                    <MenuItem value="" disabled>
                      No departments configured in Settings
                    </MenuItem>
                  ) : (
                    departments.map((d) => (
                      <MenuItem key={d} value={d}>
                        {d}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Vacancies"
                type="number"
                value={reqForm.vacancies}
                onChange={(e) => setReqForm({ ...reqForm, vacancies: parseInt(e.target.value) || 1 })}
                margin="normal"
                size="small"
              />
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Employment Type"
                value={reqForm.employment_type}
                onChange={(e) => setReqForm({ ...reqForm, employment_type: e.target.value })}
                margin="normal"
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Required Experience"
                value={reqForm.required_experience}
                onChange={(e) => setReqForm({ ...reqForm, required_experience: e.target.value })}
                margin="normal"
                size="small"
              />
            </Grid>
          </Grid>
          <TextField
            fullWidth
            label="Required Qualification"
            value={reqForm.required_qualification}
            onChange={(e) => setReqForm({ ...reqForm, required_qualification: e.target.value })}
            margin="normal"
            size="small"
          />
          <TextField
            fullWidth
            label="Key Skills"
            value={reqForm.skills}
            onChange={(e) => setReqForm({ ...reqForm, skills: e.target.value })}
            margin="normal"
            size="small"
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Salary Range"
                value={reqForm.salary_range}
                onChange={(e) => setReqForm({ ...reqForm, salary_range: e.target.value })}
                margin="normal"
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Preferred Joining Date"
                type="date"
                value={reqForm.preferred_joining_date}
                onChange={(e) => setReqForm({ ...reqForm, preferred_joining_date: e.target.value })}
                margin="normal"
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
          <TextField
            fullWidth
            label="Job Description"
            multiline
            rows={3}
            value={reqForm.job_description}
            onChange={(e) => setReqForm({ ...reqForm, job_description: e.target.value })}
            margin="normal"
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateReqDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveRequisition} variant="contained" sx={{ bgcolor: '#16C47F' }}>
            {editingReq ? 'Save Changes' : 'Submit Requisition'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Add/Edit Candidate */}
      <Dialog open={createCandidateDialog} onClose={() => setCreateCandidateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingCand ? 'Edit Candidate Profile' : 'Add New Candidate'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {/* AI Resume Parser Banner */}
          {!editingCand && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 2,
                bgcolor: '#f0fdf4',
                border: '1.5px dashed #86efac',
                borderRadius: 2,
                textAlign: 'center',
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Bot size={26} color="#16C47F" />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#166534' }}>
                  Auto-Fill from Resume (OCR & AI Extraction)
                </Typography>
                <Typography variant="caption" sx={{ color: '#475569' }}>
                  Upload PDF or image to extract candidate details and auto-populate this form.
                </Typography>
                <input
                  type="file"
                  ref={resumeInputRef}
                  accept=".pdf,.png,.jpg,.jpeg,.docx"
                  style={{ display: 'none' }}
                  onChange={handleResumeUploadAndParse}
                />
                <Button
                  size="small"
                  variant="contained"
                  disabled={isParsingResume}
                  startIcon={<Upload size={14} className={isParsingResume ? 'animate-spin' : ''} />}
                  onClick={() => resumeInputRef.current?.click()}
                  sx={{ bgcolor: '#16C47F', textTransform: 'none', fontSize: 11, '&:hover': { bgcolor: '#12A66C' } }}
                >
                  {isParsingResume ? 'Extracting with OCR & AI...' : 'Upload & Auto-Fill Resume'}
                </Button>
              </Box>
            </Paper>
          )}

          <FormControl fullWidth margin="normal" size="small">
            <InputLabel>Job Requisition</InputLabel>
            <Select
              value={candForm.job_requisition_id || ''}
              label="Job Requisition"
              onChange={(e) =>
                setCandForm({ ...candForm, job_requisition_id: e.target.value ? Number(e.target.value) : undefined })
              }
            >
              <MenuItem value="">General Pool (No Requisition)</MenuItem>
              {requisitions.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.job_title} ({r.req_code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Candidate Full Name *"
            value={candForm.name}
            onChange={(e) => setCandForm({ ...candForm, name: e.target.value })}
            margin="normal"
            size="small"
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Email Address *"
                type="email"
                value={candForm.email}
                onChange={(e) => setCandForm({ ...candForm, email: e.target.value })}
                margin="normal"
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Mobile Number *"
                value={candForm.mobile}
                onChange={(e) => setCandForm({ ...candForm, mobile: e.target.value })}
                margin="normal"
                size="small"
              />
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Experience"
                value={candForm.experience}
                onChange={(e) => setCandForm({ ...candForm, experience: e.target.value })}
                margin="normal"
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Qualification"
                value={candForm.qualification}
                onChange={(e) => setCandForm({ ...candForm, qualification: e.target.value })}
                margin="normal"
                size="small"
              />
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Current Company"
                value={candForm.current_company}
                onChange={(e) => setCandForm({ ...candForm, current_company: e.target.value })}
                margin="normal"
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Expected Salary"
                value={candForm.expected_salary}
                onChange={(e) => setCandForm({ ...candForm, expected_salary: e.target.value })}
                margin="normal"
                size="small"
              />
            </Grid>
          </Grid>
          <FormControl fullWidth margin="normal" size="small">
            <InputLabel>Candidate Source</InputLabel>
            <Select
              value={candForm.candidate_source}
              label="Candidate Source"
              onChange={(e) => setCandForm({ ...candForm, candidate_source: e.target.value })}
            >
              <MenuItem value="Indeed">Indeed (Job Portal)</MenuItem>
              <MenuItem value="LinkedIn">LinkedIn</MenuItem>
              <MenuItem value="Job Portal">Job Portal</MenuItem>
              <MenuItem value="Referral">Employee Referral</MenuItem>
              <MenuItem value="Agency">Agency</MenuItem>
              <MenuItem value="Direct">Direct Application</MenuItem>
            </Select>
          </FormControl>

          {/* India DPDP Act 2023 Consent Checkbox */}
          <FormControlLabel
            control={
              <Checkbox
                checked={candConsent}
                onChange={(e) => setCandConsent(e.target.checked)}
                color="success"
              />
            }
            label={
              <Typography variant="caption" sx={{ color: '#475569' }}>
                <strong>DPDP Act 2023 Consent:</strong> Candidate consented to automated recruitment screening and data processing.
              </Typography>
            }
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateCandidateDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveCandidate} variant="contained" sx={{ bgcolor: '#16C47F' }}>
            {editingCand ? 'Save Changes' : 'Add Candidate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Stage Transition Confirmation (Mandatory Reasons) */}
      <Dialog open={stageTransitionDialog} onClose={() => setStageTransitionDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Move to {targetStage}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {targetStage === 'On Hold' && (
            <TextField
              fullWidth
              label="On Hold Reason *"
              multiline
              rows={3}
              value={onHoldReason}
              onChange={(e) => setOnHoldReason(e.target.value)}
              margin="normal"
              size="small"
            />
          )}

          {targetStage === 'Rejected' && (
            <TextField
              fullWidth
              label="Rejection Reason *"
              multiline
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              margin="normal"
              size="small"
            />
          )}

          <TextField
            fullWidth
            label="Remarks / Transition Notes"
            multiline
            rows={2}
            value={transitionRemarks}
            onChange={(e) => setTransitionRemarks(e.target.value)}
            margin="normal"
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setStageTransitionDialog(false)}>Cancel</Button>
          <Button onClick={handleConfirmStageTransition} variant="contained" sx={{ bgcolor: '#16C47F' }}>
            Confirm Transition
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Schedule Interview */}
      <Dialog open={interviewDialog} onClose={() => setInterviewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Schedule Interview Round</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Interview Round *"
            value={interviewForm.round_name}
            onChange={(e) => setInterviewForm({ ...interviewForm, round_name: e.target.value })}
            margin="normal"
            size="small"
          />
          <TextField
            fullWidth
            label="Interview Date & Time *"
            type="datetime-local"
            value={interviewForm.scheduled_at}
            onChange={(e) => setInterviewForm({ ...interviewForm, scheduled_at: e.target.value })}
            margin="normal"
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth margin="normal" size="small">
                <InputLabel>Mode</InputLabel>
                <Select
                  value={interviewForm.mode}
                  label="Mode"
                  onChange={(e) => setInterviewForm({ ...interviewForm, mode: e.target.value })}
                >
                  <MenuItem value="ONLINE">Online (Video Call)</MenuItem>
                  <MenuItem value="IN_PERSON">In-Person (On-site)</MenuItem>
                  <MenuItem value="PHONE">Phone Call</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Interviewer / Panel"
                value={interviewForm.panel}
                onChange={(e) => setInterviewForm({ ...interviewForm, panel: e.target.value })}
                margin="normal"
                size="small"
              />
            </Grid>
          </Grid>
          {interviewForm.mode === 'ONLINE' ? (
            <TextField
              fullWidth
              label="Meeting Link (Google Meet / Zoom)"
              value={interviewForm.meeting_link}
              onChange={(e) => setInterviewForm({ ...interviewForm, meeting_link: e.target.value })}
              margin="normal"
              size="small"
            />
          ) : (
            <TextField
              fullWidth
              label="Location / Office Room"
              value={interviewForm.location}
              onChange={(e) => setInterviewForm({ ...interviewForm, location: e.target.value })}
              margin="normal"
              size="small"
            />
          )}
          <TextField
            fullWidth
            label="Interviewer Remarks / Prep Notes"
            multiline
            rows={2}
            value={interviewForm.remarks}
            onChange={(e) => setInterviewForm({ ...interviewForm, remarks: e.target.value })}
            margin="normal"
            size="small"
          />

          {/* Dual Notifications Preview Banner */}
          <Paper variant="outlined" sx={{ p: 1.5, mt: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#0f172a', display: 'block', mb: 0.5 }}>
              Automated Dual Notifications Dispatched on Confirmation:
            </Typography>
            <Stack spacing={0.5}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircle2 size={14} color="#047857" />
                <Typography variant="caption" sx={{ color: '#334155' }}>
                  <strong>Candidate Invitation:</strong> Email with calendar invite + <strong>Telecom DLT SMS</strong> (Sender: <code>ORBXHR</code>, Template: <code>INTV_SCHED_01</code>).
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircle2 size={14} color="#047857" />
                <Typography variant="caption" sx={{ color: '#334155' }}>
                  <strong>Job Requester Alert:</strong> Email alert and in-app alert to requisition owner.
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setInterviewDialog(false)}>Cancel</Button>
          <Button onClick={handleScheduleInterviewSubmit} variant="contained" sx={{ bgcolor: '#16C47F' }}>
            Schedule & Send Invitations
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Manage Offer */}
      <Dialog open={offerDialog} onClose={() => setOfferDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Manage Job Offer</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <FormControl fullWidth margin="normal" size="small">
            <InputLabel>Offer Status</InputLabel>
            <Select
              value={offerForm.offer_status}
              label="Offer Status"
              onChange={(e) => setOfferForm({ ...offerForm, offer_status: e.target.value as any })}
            >
              <MenuItem value="Offer Draft">Offer Draft</MenuItem>
              <MenuItem value="Offer Released">Offer Released</MenuItem>
              <MenuItem value="Offer Accepted">Offer Accepted</MenuItem>
              <MenuItem value="Offer Declined">Offer Declined</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Confirmed Joining Date"
            type="date"
            value={offerForm.confirmed_joining_date}
            onChange={(e) => setOfferForm({ ...offerForm, confirmed_joining_date: e.target.value })}
            margin="normal"
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          {offerForm.offer_status === 'Offer Declined' && (
            <TextField
              fullWidth
              label="Decline Reason *"
              multiline
              rows={2}
              value={offerForm.rejection_reason}
              onChange={(e) => setOfferForm({ ...offerForm, rejection_reason: e.target.value })}
              margin="normal"
              size="small"
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOfferDialog(false)}>Cancel</Button>
          <Button onClick={handleUpdateOfferSubmit} variant="contained" sx={{ bgcolor: '#16C47F' }}>
            Update Offer Status
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Create Employee Action */}
      <Dialog open={createEmployeeDialog} onClose={() => setCreateEmployeeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create Employee Record</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
            This action will create an active employee account in the HR Employee Master linked to this candidate.
          </Typography>
          <TextField
            fullWidth
            label="Employee ID (Auto-generated if empty)"
            value={empForm.emp_id}
            onChange={(e) => setEmpForm({ ...empForm, emp_id: e.target.value })}
            margin="normal"
            size="small"
          />
          <TextField
            fullWidth
            label="Designation"
            value={empForm.designation}
            onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
            margin="normal"
            size="small"
          />
          <FormControl fullWidth margin="normal" size="small">
            <InputLabel>Department</InputLabel>
            <Select
              value={empForm.department}
              label="Department"
              onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
            >
              {departments.map((d) => (
                <MenuItem key={d} value={d}>
                  {d}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateEmployeeDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateEmployeeSubmit} variant="contained" sx={{ bgcolor: '#047857' }}>
            Create Employee Record
          </Button>
        </DialogActions>
      </Dialog>

      {/* Requisition Approve/Reject Dialog */}
      <Dialog open={approveRejectReqDialog.open} onClose={() => setApproveRejectReqDialog({ open: false, req: null, action: 'Approve' })} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {approveRejectReqDialog.action} Requisition: {approveRejectReqDialog.req?.job_title}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {approveRejectReqDialog.action === 'Reject' && (
            <TextField
              fullWidth
              label="Rejection Reason *"
              multiline
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              margin="normal"
              size="small"
            />
          )}
          <Typography variant="body2" sx={{ color: '#475569', mt: 1 }}>
            {approveRejectReqDialog.action === 'Approve'
              ? 'Approving this requisition will allow HR to add and process candidates against this position.'
              : 'Rejecting this requisition will mark it as Rejected.'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setApproveRejectReqDialog({ open: false, req: null, action: 'Approve' })}>
            Cancel
          </Button>
          <Button onClick={handleApproveRejectRequisition} variant="contained" color={approveRejectReqDialog.action === 'Approve' ? 'success' : 'error'}>
            Confirm {approveRejectReqDialog.action}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, type: 'requisition', id: null, title: '' })} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#dc2626' }}>
          Confirm Delete {deleteConfirm.type === 'requisition' ? 'Requisition' : 'Candidate'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" sx={{ color: '#334155' }}>
            Are you sure you want to delete <strong>"{deleteConfirm.title}"</strong>?
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirm({ open: false, type: 'requisition', id: null, title: '' })}>
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Bulk Resume Upload & AI OCR Ingestion */}
      <Dialog open={bulkUploadDialogOpen} onClose={() => setBulkUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Bulk Resume Upload & AI Ingestion
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
            Upload multiple candidate resumes (PDF, PNG, JPG, DOCX). The system will extract text with OCR, strip PII, and match against the requisition scoring rubric.
          </Typography>

          <FormControl fullWidth margin="normal" size="small">
            <InputLabel>Target Job Requisition *</InputLabel>
            <Select
              value={bulkUploadReqId || ''}
              label="Target Job Requisition *"
              onChange={(e) => setBulkUploadReqId(Number(e.target.value))}
            >
              {requisitions.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.job_title} ({r.req_code}) - {r.department}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Multi-file input zone */}
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              mt: 2,
              mb: 2,
              bgcolor: '#f8fafc',
              border: '2px dashed #cbd5e1',
              borderRadius: 2,
              textAlign: 'center',
              cursor: 'pointer',
              '&:hover': { borderColor: '#16C47F' },
            }}
            onClick={() => bulkInputRef.current?.click()}
          >
            <UploadCloud size={36} color="#16C47F" style={{ margin: '0 auto 8px' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Click to browse or drag and drop resumes
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Supports batch of 1 to 30 files (.pdf, .png, .jpg, .docx)
            </Typography>
            <input
              type="file"
              ref={bulkInputRef}
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.docx"
              style={{ display: 'none' }}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setBulkFiles(files);
                setBulkUploadResult(null);
              }}
            />
          </Paper>

          {/* Selected files preview */}
          {bulkFiles.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', display: 'block', mb: 0.5 }}>
                Selected Files ({bulkFiles.length}):
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 120, overflowY: 'auto' }}>
                {bulkFiles.map((f, i) => (
                  <Chip
                    key={i}
                    label={`${f.name} (${(f.size / 1024).toFixed(0)} KB)`}
                    size="small"
                    onDelete={() => setBulkFiles(bulkFiles.filter((_, idx) => idx !== i))}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* DPDP Consent */}
          <FormControlLabel
            control={
              <Checkbox
                checked={bulkConsent}
                onChange={(e) => setBulkConsent(e.target.checked)}
                color="success"
              />
            }
            label={
              <Typography variant="caption" sx={{ color: '#475569' }}>
                <strong>India DPDP Act 2023 Compliance:</strong> Explicit consent captured from all candidates for automated processing, OCR text extraction, and advisory AI screening.
              </Typography>
            }
          />

          {isBulkUploading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress color="success" />
              <Typography variant="caption" sx={{ color: '#16C47F', fontWeight: 600, display: 'block', mt: 1, textAlign: 'center' }}>
                Processing resumes with OCR and indexing candidates...
              </Typography>
            </Box>
          )}

          {/* Results Summary */}
          {bulkUploadResult && (
            <Alert
              severity={bulkUploadResult.failed_count === 0 ? 'success' : 'warning'}
              sx={{ mt: 2 }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Processing Complete: {bulkUploadResult.success_count} Succeeded, {bulkUploadResult.failed_count} Failed
              </Typography>
              {bulkUploadResult.errors && bulkUploadResult.errors.length > 0 && (
                <Stack spacing={0.3} sx={{ mt: 1 }}>
                  {bulkUploadResult.errors.map((err, i) => (
                    <Typography key={i} variant="caption" sx={{ color: '#b91c1c' }}>
                      • {err}
                    </Typography>
                  ))}
                </Stack>
              )}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setBulkUploadDialogOpen(false)}>Close</Button>
          <Button
            onClick={handleBulkUploadSubmit}
            variant="contained"
            disabled={isBulkUploading || bulkFiles.length === 0}
            sx={{ bgcolor: '#16C47F', '&:hover': { bgcolor: '#12A66C' } }}
          >
            {isBulkUploading ? 'Uploading...' : `Upload & Process ${bulkFiles.length} Resumes`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Publish Job Posting to Indeed */}
      <Dialog open={publishDialogOpen} onClose={() => setPublishDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Publish to Indeed Portal</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
            Provide the live Indeed job reference or confirm publishing to set posting status to POSTED.
          </Typography>
          <TextField
            fullWidth
            label="External Job Reference ID"
            value={publishForm.external_job_id}
            onChange={(e) => setPublishForm({ ...publishForm, external_job_id: e.target.value })}
            placeholder="e.g. IND-2026-9812"
            margin="normal"
            size="small"
          />
          <TextField
            fullWidth
            label="Indeed Job URL"
            value={publishForm.external_post_url}
            onChange={(e) => setPublishForm({ ...publishForm, external_post_url: e.target.value })}
            margin="normal"
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPublishDialogOpen(false)}>Cancel</Button>
          <Button onClick={handlePublishPostingSubmit} variant="contained" sx={{ bgcolor: '#16C47F' }}>
            Confirm Publish
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
