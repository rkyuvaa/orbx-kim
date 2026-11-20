import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Grid,
  Drawer,
  Checkbox,
  Divider,
  Alert,
} from '@mui/material';
import {
  Receipt,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
  Edit2,
  X,
  RefreshCw,
  Layers,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  Plus,
  Check,
  Sparkles,
} from 'lucide-react';
import { expensesApi, Bill, Claim, Payout, PayoutEmployeeStatus, ExpenseCategory } from '@/api/expensesApi';
import { useToast } from '@/components/ui/ToastHost';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function ExpensesPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);

  // Data states (Zero Demo Data rule: empty arrays by default)
  const [myBills, setMyBills] = useState<Bill[]>([]);
  const [myClaims, setMyClaims] = useState<Claim[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Claim[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [myConfirmations, setMyConfirmations] = useState<PayoutEmployeeStatus[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  // Modals & Drawers
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [billDrawerOpen, setBillDrawerOpen] = useState(false);
  const [editBillData, setEditBillData] = useState<Partial<Bill>>({});
  const [savingBill, setSavingBill] = useState(false);

  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [claimDrawerOpen, setClaimDrawerOpen] = useState(false);

  // Approval actions
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetClaim, setRejectTargetClaim] = useState<Claim | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Payout actions
  const [payoutBatchModalOpen, setPayoutBatchModalOpen] = useState(false);
  const [approvedClaimsForBatch, setApprovedClaimsForBatch] = useState<Claim[]>([]);
  const [selectedClaimIdsForBatch, setSelectedClaimIdsForBatch] = useState<number[]>([]);
  const [payoutBatchNotes, setPayoutBatchNotes] = useState('');

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTargetPayout, setTransferTargetPayout] = useState<Payout | null>(null);
  const [utrNumber, setUtrNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [bankRef, setBankRef] = useState('');

  useEffect(() => {
    loadData();
    expensesApi.getCategories().then(setCategories).catch(console.error);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bills, claims, approvals, payoutList, confs] = await Promise.all([
        expensesApi.getMyBills().catch(() => []),
        expensesApi.getMyClaims().catch(() => []),
        expensesApi.getPendingApprovals().catch(() => []),
        expensesApi.getPayouts().catch(() => []),
        expensesApi.getMyConfirmations().catch(() => []),
      ]);
      setMyBills(bills);
      setMyClaims(claims);
      setPendingApprovals(approvals);
      setPayouts(payoutList);
      setMyConfirmations(confs);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load expense records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Upload bill
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    try {
      const newBill = await expensesApi.uploadBill(uploadFile, undefined, uploadNotes);
      setMyBills((prev) => [newBill, ...prev]);
      setUploadModalOpen(false);
      setUploadFile(null);
      setUploadNotes('');
      showToast('Bill uploaded and processed by Vision AI.', 'success');
      openBillDrawer(newBill);
    } catch (err: any) {
      showToast(err?.message || 'Failed to upload bill.', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Open Bill Review Drawer
  const openBillDrawer = (bill: Bill) => {
    setSelectedBill(bill);
    setEditBillData({
      bill_number: bill.bill_number || '',
      bill_date: bill.bill_date || '',
      supplier_name: bill.supplier_name || '',
      category_id: bill.category_id || undefined,
      taxable_amount: bill.taxable_amount,
      cgst_pct: bill.cgst_pct,
      cgst_amount: bill.cgst_amount,
      sgst_pct: bill.sgst_pct,
      sgst_amount: bill.sgst_amount,
      igst_pct: bill.igst_pct,
      igst_amount: bill.igst_amount,
      gst_total: bill.gst_total,
      total_amount: bill.total_amount,
      notes: bill.notes || '',
    });
    setBillDrawerOpen(true);
  };

  // Save Bill Edits
  const handleSaveBill = async () => {
    if (!selectedBill) return;
    setSavingBill(true);
    try {
      const updated = await expensesApi.updateBill(selectedBill.id, editBillData);
      setMyBills((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setSelectedBill(updated);
      showToast('Bill details updated successfully.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update bill.', 'error');
    } finally {
      setSavingBill(false);
    }
  };

  // Confirm Bill as Ready
  const handleConfirmReady = async () => {
    if (!selectedBill) return;
    setSavingBill(true);
    try {
      const updated = await expensesApi.confirmBillReady(selectedBill.id);
      setMyBills((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setSelectedBill(updated);
      setBillDrawerOpen(false);
      showToast('Bill marked as Ready for claim cycle bundling.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to confirm bill.', 'error');
    } finally {
      setSavingBill(false);
    }
  };

  // Re-run AI Vision Extraction on Bill
  const [reExtracting, setReExtracting] = useState(false);
  const handleReExtractBill = async (billId: number) => {
    setReExtracting(true);
    try {
      const updated = await expensesApi.reExtractBill(billId);
      setMyBills((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      if (selectedBill?.id === updated.id) {
        setSelectedBill(updated);
        setEditBillData({
          bill_number: updated.bill_number || '',
          bill_date: updated.bill_date || '',
          supplier_name: updated.supplier_name || '',
          category_id: updated.category_id || undefined,
          taxable_amount: updated.taxable_amount,
          cgst_pct: updated.cgst_pct,
          cgst_amount: updated.cgst_amount,
          sgst_pct: updated.sgst_pct,
          sgst_amount: updated.sgst_amount,
          igst_pct: updated.igst_pct,
          igst_amount: updated.igst_amount,
          gst_total: updated.gst_total,
          total_amount: updated.total_amount,
          notes: updated.notes || '',
        });
      }
      if (updated.extraction_status === 'EXTRACTED' || updated.total_amount > 0 || updated.supplier_name) {
        showToast('Receipt details extracted successfully by AI!', 'success');
      } else {
        const errMsg = updated.extraction_raw?.error || 'AI could not extract fields. Check provider API key.';
        showToast(errMsg, 'warning');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to re-extract bill.', 'error');
    } finally {
      setReExtracting(false);
    }
  };

  // Open Claim Detail
  const openClaimDetail = async (claimId: number) => {
    try {
      const fullClaim = await expensesApi.getClaimDetail(claimId);
      setSelectedClaim(fullClaim);
      setClaimDrawerOpen(true);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load claim detail.', 'error');
    }
  };

  // Approve Claim
  const handleApproveClaim = async (claimId: number) => {
    try {
      await expensesApi.approveClaim(claimId);
      setPendingApprovals((prev) => prev.filter((c) => c.id !== claimId));
      showToast('Claim approved successfully.', 'success');
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to approve claim.', 'error');
    }
  };

  // Reject Claim
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTargetClaim || !rejectReason.trim()) return;
    try {
      await expensesApi.rejectClaim(rejectTargetClaim.id, rejectReason.trim());
      setPendingApprovals((prev) => prev.filter((c) => c.id !== rejectTargetClaim.id));
      setRejectModalOpen(false);
      setRejectTargetClaim(null);
      setRejectReason('');
      showToast('Claim rejected and bills returned to claimant for revision.', 'info');
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to reject claim.', 'error');
    }
  };

  // Open Payout Batch Modal
  const openCreateBatchModal = async () => {
    try {
      const approved = await expensesApi.getAllClaims('ACCOUNTANT_APPROVED');
      setApprovedClaimsForBatch(approved);
      setSelectedClaimIdsForBatch(approved.map((c) => c.id));
      setPayoutBatchModalOpen(true);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load approved claims.', 'error');
    }
  };

  // Create Payout Batch Submit
  const handleCreateBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClaimIdsForBatch.length === 0) return;
    try {
      const newBatch = await expensesApi.createPayoutBatch(selectedClaimIdsForBatch, payoutBatchNotes);
      setPayouts((prev) => [newBatch, ...prev]);
      setPayoutBatchModalOpen(false);
      setPayoutBatchNotes('');
      setSelectedClaimIdsForBatch([]);
      showToast(`Payout batch ${newBatch.batch_no} created successfully.`, 'success');
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to create payout batch.', 'error');
    }
  };

  // Record Bank Transfer Submit
  const handleRecordTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTargetPayout || !utrNumber.trim()) return;
    try {
      await expensesApi.recordPayoutTransfer(
        transferTargetPayout.id,
        utrNumber.trim(),
        paymentDate,
        bankRef.trim() || undefined
      );
      setTransferModalOpen(false);
      setTransferTargetPayout(null);
      setUtrNumber('');
      setBankRef('');
      showToast('Bank transfer UTR recorded and claimants notified.', 'success');
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to record bank transfer.', 'error');
    }
  };

  // Employee Confirm Receipt
  const handleConfirmReceipt = async (payoutId: number) => {
    try {
      await expensesApi.confirmReceipt(payoutId);
      setMyConfirmations((prev) =>
        prev.map((c) => (c.payout_id === payoutId ? { ...c, status: 'CONFIRMED' } : c))
      );
      showToast('Reimbursement receipt confirmed. Thank you!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to confirm receipt.', 'error');
    }
  };

  // Stats
  const totalBillsAmount = myBills.reduce((acc, b) => acc + (b.total_amount || 0), 0);
  const readyBillsCount = myBills.filter((b) => b.extraction_status === 'READY' && !b.claim_id).length;
  const pendingApprovalsCount = pendingApprovals.length;
  const pendingConfirmationsCount = myConfirmations.filter((c) => c.status === 'PENDING_CONFIRMATION').length;

  return (
    <Box sx={{ pb: 6 }}>
      {/* Header */}
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <Typography sx={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, color: '#023020' }}>
            Expenses & Claim Management
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#7A8B80', mt: 0.5 }}>
            Upload receipts, track approval chains, generate payout batches & reconcile bank transfers.
          </Typography>
        </div>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            variant="contained"
            startIcon={<Upload size={16} />}
            onClick={() => setUploadModalOpen(true)}
            sx={{
              bgcolor: '#023020',
              '&:hover': { bgcolor: '#2A402A' },
              borderRadius: 2,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Upload Bill / Receipt
          </Button>

          <IconButton onClick={loadData} size="small" sx={{ border: '1px solid #E4EBE1', borderRadius: 2 }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </IconButton>
        </Box>
      </Box>

      {/* KPI Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper variant="outlined" sx={{ p: 2, borderColor: '#E4EBE1', borderRadius: 2 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase' }}>
              My Total Bills
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#16231B', mt: 0.5 }}>
              {myBills.length}
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#7A8B80', mt: 0.25 }}>
              ₹{totalBillsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} total value
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper variant="outlined" sx={{ p: 2, borderColor: '#E4EBE1', borderRadius: 2 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase' }}>
              Ready for Cycle Bundle
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#16A34A', mt: 0.5 }}>
              {readyBillsCount}
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#7A8B80', mt: 0.25 }}>
              Awaiting next claim cycle
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper variant="outlined" sx={{ p: 2, borderColor: '#E4EBE1', borderRadius: 2 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase' }}>
              Pending Approvals
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#D97706', mt: 0.5 }}>
              {pendingApprovalsCount}
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#7A8B80', mt: 0.25 }}>
              Actionable claims
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper variant="outlined" sx={{ p: 2, borderColor: '#E4EBE1', borderRadius: 2 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase' }}>
              Awaiting Confirmations
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#2563EB', mt: 0.5 }}>
              {pendingConfirmationsCount}
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#7A8B80', mt: 0.25 }}>
              Transferred to your bank
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: '#E4EBE1', mb: 2.5 }}>
        <Tabs
          value={tab}
          onChange={(_, next) => setTab(next)}
          textColor="primary"
          indicatorColor="primary"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: 13,
              fontWeight: 600,
              minHeight: 44,
            },
          }}
        >
          <Tab icon={<Receipt size={16} />} iconPosition="start" label={`My Bills (${myBills.length})`} />
          <Tab icon={<Layers size={16} />} iconPosition="start" label={`My Claims (${myClaims.length})`} />
          <Tab
            icon={<ShieldCheck size={16} />}
            iconPosition="start"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <span>Approvals</span>
                {pendingApprovalsCount > 0 && (
                  <Chip
                    label={pendingApprovalsCount}
                    size="small"
                    sx={{ height: 18, fontSize: 10, bgcolor: '#FEF3C7', color: '#B45309', fontWeight: 700 }}
                  />
                )}
              </Box>
            }
          />
          <Tab icon={<DollarSign size={16} />} iconPosition="start" label={`Payout Batches (${payouts.length})`} />
          <Tab
            icon={<CreditCard size={16} />}
            iconPosition="start"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <span>My Confirmations</span>
                {pendingConfirmationsCount > 0 && (
                  <Chip
                    label={pendingConfirmationsCount}
                    size="small"
                    sx={{ height: 18, fontSize: 10, bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 700 }}
                  />
                )}
              </Box>
            }
          />
        </Tabs>
      </Box>

      {/* TAB 1: MY BILLS */}
      <CustomTabPanel value={tab} index={0}>
        <Paper variant="outlined" sx={{ borderColor: '#E4EBE1', borderRadius: 2.5, overflow: 'hidden' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#F8FAF8' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356' }}>RECEIPT #</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356' }}>VENDOR / SUPPLIER</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356' }}>BILL DATE & NO</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356' }}>CREATED DATE</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356' }}>CREATED BY</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356', textAlign: 'right' }}>TAXABLE</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356', textAlign: 'right' }}>TOTAL GST</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356', textAlign: 'right' }}>TOTAL (₹)</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356', textAlign: 'center' }}>STATUS</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356', textAlign: 'right' }}>ACTION</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {myBills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} sx={{ textAlign: 'center', py: 6, color: '#7A8B80' }}>
                    <Receipt size={36} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#16231B' }}>No bills uploaded yet</Typography>
                    <Typography sx={{ fontSize: 12, color: '#667085', mt: 0.5, mb: 2 }}>
                      Upload your expense receipts to have amounts and vendor details read automatically.
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Upload size={14} />}
                      onClick={() => setUploadModalOpen(true)}
                      sx={{ bgcolor: '#023020', '&:hover': { bgcolor: '#2A402A' } }}
                    >
                      Upload Receipt
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                myBills.map((b) => (
                  <TableRow key={b.id} hover>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() => openBillDrawer(b)}
                        startIcon={<FileText size={14} />}
                        sx={{ textTransform: 'none', fontWeight: 600, color: '#023020' }}
                      >
                        #{b.id}
                      </Button>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#16231B' }}>
                      {b.supplier_name || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Unknown</span>}
                      {b.is_duplicate && (
                        <Chip label="Duplicate" size="small" sx={{ ml: 1, bgcolor: '#FEE2E2', color: '#991B1B', fontSize: 10, height: 18 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 12, color: '#16231B' }}>{b.bill_date || 'No Date'}</Typography>
                      <Typography sx={{ fontSize: 11, color: '#7A8B80', fontFamily: 'monospace' }}>
                        {b.bill_number || 'No Bill #'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 12, color: '#16231B', fontWeight: 500 }}>
                        {b.created_at
                          ? new Date(b.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: '#7A8B80' }}>
                        {b.created_at
                          ? new Date(b.created_at).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#16231B' }}>
                        {b.uploaded_by_name || 'Recorded User'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                      ₹{Number(b.taxable_amount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: '#667085' }}>
                      ₹{Number(b.gst_total || 0).toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#023020' }}>
                      ₹{Number(b.total_amount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      {b.extraction_status === 'READY' && (
                        <Chip label="Ready" size="small" sx={{ bgcolor: '#DCFCE7', color: '#166534', fontWeight: 700, fontSize: 11 }} />
                      )}
                      {b.extraction_status === 'EXTRACTED' && (
                        <Chip label="Extracted" size="small" sx={{ bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 700, fontSize: 11 }} />
                      )}
                      {b.extraction_status === 'NEEDS_REVIEW' && (
                        <Chip label="Needs Review" size="small" sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700, fontSize: 11 }} />
                      )}
                      {b.extraction_status === 'PROCESSING' && (
                        <Chip label="Processing" size="small" sx={{ bgcolor: '#F3F4F6', color: '#4B5563', fontSize: 11 }} />
                      )}
                      {b.extraction_status === 'FAILED' && (
                        <Chip label="Failed" size="small" sx={{ bgcolor: '#FEE2E2', color: '#991B1B', fontSize: 11 }} />
                      )}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>
                      <IconButton size="small" onClick={() => openBillDrawer(b)} title="Review / Edit Bill">
                        <Edit2 size={15} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>
      </CustomTabPanel>

      {/* TAB 2: MY CLAIMS */}
      <CustomTabPanel value={tab} index={1}>
        <Paper variant="outlined" sx={{ p: 3, borderColor: '#E4EBE1', borderRadius: 2.5 }}>
          {myClaims.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: '#7A8B80' }}>
              <Layers size={36} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#16231B' }}>No claims generated yet</Typography>
              <Typography sx={{ fontSize: 12, color: '#667085', mt: 0.5 }}>
                Ready bills are automatically batched into claims when the cycle cutoff passes.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {myClaims.map((claim) => (
                <Grid item xs={12} sm={6} md={4} key={claim.id}>
                  <Paper
                    variant="outlined"
                    onClick={() => openClaimDetail(claim.id)}
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      borderColor: '#E4EBE1',
                      cursor: 'pointer',
                      '&:hover': { borderColor: '#16C47F', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#023020' }}>
                        {claim.claim_no}
                      </Typography>
                      <Chip
                        label={claim.status.replace(/_/g, ' ')}
                        size="small"
                        sx={{
                          fontSize: 10,
                          fontWeight: 700,
                          bgcolor: claim.status === 'PAID' ? '#DCFCE7' : claim.status === 'REJECTED' ? '#FEE2E2' : '#FEF3C7',
                          color: claim.status === 'PAID' ? '#166534' : claim.status === 'REJECTED' ? '#991B1B' : '#92400E',
                        }}
                      />
                    </Box>

                    <Typography sx={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: '#16231B', my: 1 }}>
                      ₹{Number(claim.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>

                    <Box sx={{ fontSize: 12, color: '#667085', spaceY: 0.5 }}>
                      <div>Bundled: {claim.bills_count} bill(s)</div>
                      <div>Cycle: {claim.cycle_name || 'Open Cycle'}</div>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1.5, mt: 1.5, borderTop: '1px solid #F0F4F0', color: '#023020', fontSize: 12, fontWeight: 600 }}>
                      <span>View Breakdown & Timeline</span>
                      <ChevronRight size={14} />
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      </CustomTabPanel>

      {/* TAB 3: APPROVALS */}
      <CustomTabPanel value={tab} index={2}>
        <Paper variant="outlined" sx={{ p: 3, borderColor: '#E4EBE1', borderRadius: 2.5 }}>
          {pendingApprovals.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: '#7A8B80' }}>
              <CheckCircle2 size={36} style={{ margin: '0 auto 8px', color: '#16A34A' }} />
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#16231B' }}>Inbox is clear</Typography>
              <Typography sx={{ fontSize: 12, color: '#667085', mt: 0.5 }}>
                You have no claims pending approval right now.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {pendingApprovals.map((claim) => (
                <Paper
                  key={claim.id}
                  variant="outlined"
                  sx={{ p: 2.5, borderColor: '#E4EBE1', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#023020' }}>
                        {claim.claim_no}
                      </Typography>
                      <Chip label={claim.status.replace(/_/g, ' ')} size="small" sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700, fontSize: 10 }} />
                    </Box>

                    <Typography sx={{ fontSize: 13, color: '#526356', mt: 0.5 }}>
                      Claimant: <strong>{claim.employee_name}</strong> ({claim.employee_email}) • {claim.bills_count} bill(s)
                    </Typography>
                  </div>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontSize: 11, color: '#7A8B80', textTransform: 'uppercase' }}>Amount</Typography>
                      <Typography sx={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: '#16231B' }}>
                        ₹{Number(claim.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => openClaimDetail(claim.id)}
                        sx={{ textTransform: 'none', borderColor: '#E4EBE1', color: '#526356' }}
                      >
                        Inspect
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => {
                          setRejectTargetClaim(claim);
                          setRejectModalOpen(true);
                        }}
                        sx={{ textTransform: 'none' }}
                      >
                        Reject
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleApproveClaim(claim.id)}
                        sx={{ bgcolor: '#023020', '&:hover': { bgcolor: '#2A402A' }, textTransform: 'none' }}
                      >
                        Approve
                      </Button>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </Paper>
      </CustomTabPanel>

      {/* TAB 4: PAYOUTS */}
      <CustomTabPanel value={tab} index={3}>
        <Paper variant="outlined" sx={{ p: 3, borderColor: '#E4EBE1', borderRadius: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
            <div>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#023020' }}>
                Reimbursement Payout Batches
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#667085', mt: 0.25 }}>
                Bundle approved claims, record bank transfer UTRs, and track claimant receipts.
              </Typography>
            </div>

            <Button
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={openCreateBatchModal}
              sx={{ bgcolor: '#023020', '&:hover': { bgcolor: '#2A402A' }, borderRadius: 2, fontSize: 13 }}
            >
              Create Payout Batch
            </Button>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {payouts.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, color: '#7A8B80' }}>
                <DollarSign size={36} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#16231B' }}>No payout batches yet</Typography>
                <Typography sx={{ fontSize: 12, color: '#667085', mt: 0.5 }}>
                  Accountants can group CFO-approved claims to execute bank transfers.
                </Typography>
              </Box>
            ) : (
              payouts.map((p) => (
                <Paper key={p.id} variant="outlined" sx={{ p: 2.5, borderColor: '#E4EBE1', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#023020' }}>
                        {p.batch_no}
                      </Typography>
                      <Chip
                        label={p.status.replace(/_/g, ' ')}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: 10,
                          bgcolor: p.status === 'CONFIRMED' ? '#DCFCE7' : p.status === 'TRANSFERRED' ? '#DBEAFE' : '#FEF3C7',
                          color: p.status === 'CONFIRMED' ? '#166534' : p.status === 'TRANSFERRED' ? '#1E40AF' : '#92400E',
                        }}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography sx={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 16 }}>
                        ₹{Number(p.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Typography>

                      {p.status === 'PENDING_TRANSFER' && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => {
                            setTransferTargetPayout(p);
                            setTransferModalOpen(true);
                          }}
                          sx={{ bgcolor: '#023020', '&:hover': { bgcolor: '#2A402A' }, textTransform: 'none', fontSize: 12 }}
                        >
                          Record UTR Transfer
                        </Button>
                      )}
                    </Box>
                  </Box>

                  {p.utr_number && (
                    <Box sx={{ mt: 1, p: 1.5, bgcolor: '#F8FAF8', borderRadius: 1.5, fontSize: 12, color: '#526356', display: 'flex', gap: 3 }}>
                      <div><strong>Bank UTR:</strong> <span style={{ fontFamily: 'monospace' }}>{p.utr_number}</span></div>
                      <div><strong>Transfer Date:</strong> {p.payment_date || 'N/A'}</div>
                      {p.bank_ref && <div><strong>Bank:</strong> {p.bank_ref}</div>}
                    </Box>
                  )}
                </Paper>
              ))
            )}
          </Box>
        </Paper>
      </CustomTabPanel>

      {/* TAB 5: MY CONFIRMATIONS */}
      <CustomTabPanel value={tab} index={4}>
        <Paper variant="outlined" sx={{ p: 3, borderColor: '#E4EBE1', borderRadius: 2.5 }}>
          {myConfirmations.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: '#7A8B80' }}>
              <CheckCircle2 size={36} style={{ margin: '0 auto 8px', color: '#16A34A' }} />
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#16231B' }}>No pending confirmations</Typography>
              <Typography sx={{ fontSize: 12, color: '#667085', mt: 0.5 }}>
                When reimbursement transfers are made to your bank account, you will confirm them here.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {myConfirmations.map((conf) => (
                <Paper
                  key={conf.id}
                  variant="outlined"
                  sx={{ p: 2.5, borderColor: '#E4EBE1', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div>
                    <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#16231B' }}>
                      Reimbursement Batch #{conf.payout_id}
                    </Typography>
                    <Typography sx={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: '#023020', mt: 0.5 }}>
                      ₹{Number(conf.amount).toFixed(2)}
                    </Typography>
                    {conf.confirmed_at && (
                      <Typography sx={{ fontSize: 11, color: '#7A8B80', mt: 0.5 }}>
                        Confirmed on {new Date(conf.confirmed_at).toLocaleDateString()}
                      </Typography>
                    )}
                  </div>

                  {conf.status === 'PENDING_CONFIRMATION' && (
                    <Button
                      variant="contained"
                      onClick={() => handleConfirmReceipt(conf.payout_id)}
                      sx={{ bgcolor: '#023020', '&:hover': { bgcolor: '#2A402A' }, textTransform: 'none' }}
                    >
                      Confirm Receipt of Funds
                    </Button>
                  )}
                </Paper>
              ))}
            </Box>
          )}
        </Paper>
      </CustomTabPanel>

      {/* UPLOAD MODAL */}
      <Dialog open={uploadModalOpen} onClose={() => setUploadModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#023020' }}>Upload Expense Bill</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#526356', mb: 1 }}>
              Document Receipt (Photo or PDF) *
            </Typography>
            <input
              type="file"
              accept="image/*,application/pdf"
              required
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              style={{
                width: '100%',
                border: '1px solid #E4EBE1',
                padding: '10px',
                borderRadius: '8px',
                fontSize: '13px',
              }}
            />
          </Box>

          <TextField
            label="Notes / Description (Optional)"
            size="small"
            multiline
            rows={2}
            value={uploadNotes}
            onChange={(e) => setUploadNotes(e.target.value)}
            placeholder="e.g. Travel tickets or client dinner"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setUploadModalOpen(false)} sx={{ color: '#667085' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUploadSubmit}
            disabled={uploading || !uploadFile}
            startIcon={uploading ? <CircularProgress size={14} /> : <Upload size={14} />}
            sx={{ bgcolor: '#023020', '&:hover': { bgcolor: '#2A402A' } }}
          >
            {uploading ? 'Parsing with AI...' : 'Upload & Parse'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* BILL REVIEW DRAWER */}
      <Drawer
        anchor="right"
        open={billDrawerOpen}
        onClose={() => setBillDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 600 }, p: 3 } }}
      >
        {selectedBill && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 2, borderBottom: '1px solid #E4EBE1' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 17, color: '#023020' }}>
                  Review Bill #{selectedBill.id}
                </Typography>
                {selectedBill.extraction_status === 'READY' && (
                  <Chip label="Ready" size="small" sx={{ bgcolor: '#DCFCE7', color: '#166534', fontWeight: 700, fontSize: 11 }} />
                )}
                {selectedBill.extraction_status === 'EXTRACTED' && (
                  <Chip label="AI Extracted" size="small" sx={{ bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 700, fontSize: 11 }} />
                )}
                {selectedBill.extraction_status === 'NEEDS_REVIEW' && (
                  <Chip label="Needs Review" size="small" sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700, fontSize: 11 }} />
                )}
                {selectedBill.extraction_status === 'FAILED' && (
                  <Chip label="Extraction Failed" size="small" sx={{ bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 700, fontSize: 11 }} />
                )}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleReExtractBill(selectedBill.id)}
                  disabled={reExtracting}
                  startIcon={<RefreshCw size={13} className={reExtracting ? 'animate-spin' : ''} />}
                  sx={{
                    textTransform: 'none',
                    fontSize: 12,
                    borderColor: '#023020',
                    color: '#023020',
                    '&:hover': { borderColor: '#2A402A', bgcolor: 'rgba(2, 48, 32, 0.04)' },
                  }}
                >
                  {reExtracting ? 'Extracting...' : 'Retry AI'}
                </Button>
                <IconButton onClick={() => setBillDrawerOpen(false)} size="small">
                  <X size={18} />
                </IconButton>
              </Box>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Extraction Alert if Incomplete / Needs Review / Failed */}
              {(selectedBill.extraction_status === 'FAILED' ||
                (selectedBill.extraction_status === 'NEEDS_REVIEW' && !selectedBill.total_amount)) && (
                <Alert
                  severity="warning"
                  sx={{ borderRadius: 2 }}
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => handleReExtractBill(selectedBill.id)}
                      disabled={reExtracting}
                      sx={{ fontWeight: 700, textTransform: 'none' }}
                    >
                      {reExtracting ? 'Extracting...' : 'Retry AI'}
                    </Button>
                  }
                >
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                    AI Extraction Incomplete / API Key Required
                  </Typography>
                  <Typography sx={{ fontSize: 12, mt: 0.25 }}>
                    {selectedBill.extraction_raw?.error ||
                      'No values could be extracted. Please make sure your Gemini or Vision API Key is entered in Expenses -> Configuration -> AI Vision Providers, then click Retry AI.'}
                  </Typography>
                </Alert>
              )}

              {/* Receipt Preview */}
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#F8FAF8', borderColor: '#E4EBE1' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography sx={{ fontSize: 12, color: '#526356', fontWeight: 700, textTransform: 'uppercase' }}>
                    Receipt Document Preview
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<ExternalLink size={13} />}
                    href={expensesApi.getFileUrl(selectedBill.id)}
                    target="_blank"
                    sx={{ textTransform: 'none', color: '#023020', fontWeight: 600, fontSize: 12, p: 0 }}
                  >
                    Open in New Tab
                  </Button>
                </Box>
                {selectedBill.source_mime.startsWith('image/') ? (
                  <Box
                    component="img"
                    src={expensesApi.getFileUrl(selectedBill.id)}
                    alt="Receipt preview"
                    sx={{
                      maxHeight: 260,
                      width: '100%',
                      objectFit: 'contain',
                      borderRadius: 1.5,
                      bgcolor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                    }}
                  />
                ) : (
                  <Box sx={{ p: 2.5, textAlign: 'center', bgcolor: '#FFFFFF', borderRadius: 1.5, border: '1px solid #E2E8F0' }}>
                    <FileText size={32} color="#023020" style={{ margin: '0 auto 6px' }} />
                    <Typography sx={{ fontSize: 12, color: '#64748B' }}>
                      PDF Receipt Document ({selectedBill.source_file_path.split('/').pop()})
                    </Typography>
                  </Box>
                )}
              </Paper>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Supplier / Vendor"
                    size="small"
                    fullWidth
                    value={editBillData.supplier_name || ''}
                    onChange={(e) => setEditBillData({ ...editBillData, supplier_name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Bill / Invoice Number"
                    size="small"
                    fullWidth
                    value={editBillData.bill_number || ''}
                    onChange={(e) => setEditBillData({ ...editBillData, bill_number: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Bill Date"
                    size="small"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    value={String(editBillData.bill_date || '')}
                    onChange={(e) => setEditBillData({ ...editBillData, bill_date: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Created Date"
                    size="small"
                    fullWidth
                    disabled
                    value={
                      selectedBill.created_at
                        ? new Date(selectedBill.created_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : '—'
                    }
                    InputProps={{
                      readOnly: true,
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Created By"
                    size="small"
                    fullWidth
                    disabled
                    value={selectedBill.uploaded_by_name || 'Recorded User'}
                    InputProps={{
                      readOnly: true,
                    }}
                    helperText="User recorded upon receipt upload"
                  />
                </Grid>
              </Grid>

              {/* Amounts & Taxes (Direct values) */}
              <Paper variant="outlined" sx={{ p: 2, borderColor: '#E4EBE1', borderRadius: 2 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#526356', textTransform: 'uppercase', mb: 1.5 }}>
                  Amounts & Taxes
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      label="Taxable (₹)"
                      size="small"
                      type="number"
                      value={editBillData.taxable_amount ?? 0}
                      onChange={(e) => setEditBillData({ ...editBillData, taxable_amount: parseFloat(e.target.value) || 0 })}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      label="CGST (₹)"
                      size="small"
                      type="number"
                      value={editBillData.cgst_amount ?? 0}
                      onChange={(e) => setEditBillData({ ...editBillData, cgst_amount: parseFloat(e.target.value) || 0 })}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      label="SGST (₹)"
                      size="small"
                      type="number"
                      value={editBillData.sgst_amount ?? 0}
                      onChange={(e) => setEditBillData({ ...editBillData, sgst_amount: parseFloat(e.target.value) || 0 })}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      label="IGST (₹)"
                      size="small"
                      type="number"
                      value={editBillData.igst_amount ?? 0}
                      onChange={(e) => setEditBillData({ ...editBillData, igst_amount: parseFloat(e.target.value) || 0 })}
                    />
                  </Grid>
                </Grid>

                <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #E4EBE1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#16231B' }}>Total Amount (₹):</Typography>
                  <TextField
                    size="small"
                    type="number"
                    value={editBillData.total_amount ?? 0}
                    onChange={(e) => setEditBillData({ ...editBillData, total_amount: parseFloat(e.target.value) || 0 })}
                    sx={{ width: 140 }}
                    inputProps={{ style: { textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', fontSize: 15 } }}
                  />
                </Box>
              </Paper>
            </Box>

            <Box sx={{ pt: 2, borderTop: '1px solid #E4EBE1', display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleSaveBill} disabled={savingBill} sx={{ color: '#526356' }}>
                Save Draft
              </Button>
              <Button
                variant="contained"
                onClick={handleConfirmReady}
                disabled={savingBill}
                sx={{ bgcolor: '#023020', '&:hover': { bgcolor: '#2A402A' } }}
              >
                Confirm as Ready
              </Button>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* CLAIM DETAIL DRAWER */}
      <Drawer
        anchor="right"
        open={claimDrawerOpen}
        onClose={() => setClaimDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 600 }, p: 3 } }}
      >
        {selectedClaim && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 2, borderBottom: '1px solid #E4EBE1' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 17, color: '#023020' }}>
                  {selectedClaim.claim_no}
                </Typography>
                <Chip
                  label={selectedClaim.status.replace(/_/g, ' ')}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    fontSize: 11,
                    bgcolor: selectedClaim.status === 'PAID' ? '#DCFCE7' : selectedClaim.status === 'REJECTED' ? '#FEE2E2' : '#FEF3C7',
                    color: selectedClaim.status === 'PAID' ? '#166534' : selectedClaim.status === 'REJECTED' ? '#991B1B' : '#92400E',
                  }}
                />
              </Box>
              <IconButton onClick={() => setClaimDrawerOpen(false)} size="small">
                <X size={18} />
              </IconButton>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', py: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Employee & Summary */}
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#F8FAF8', borderColor: '#E4EBE1', borderRadius: 2 }}>
                <Grid container spacing={1.5}>
                  <Grid item xs={6}>
                    <Typography sx={{ fontSize: 11, color: '#667085', fontWeight: 600, textTransform: 'uppercase' }}>
                      Claimant
                    </Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#16231B' }}>
                      {selectedClaim.employee_name || 'N/A'}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#7A8B80' }}>
                      {selectedClaim.employee_email}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 11, color: '#667085', fontWeight: 600, textTransform: 'uppercase' }}>
                      Total Amount
                    </Typography>
                    <Typography sx={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: '#023020' }}>
                      ₹{Number(selectedClaim.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#7A8B80' }}>
                      {selectedClaim.bills_count} receipt(s)
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Bundled Bills */}
              <div>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#023020', mb: 1 }}>
                  Bundled Receipts & Bills
                </Typography>
                {(!selectedClaim.bills || selectedClaim.bills.length === 0) ? (
                  <Typography sx={{ fontSize: 12, color: '#7A8B80' }}>No bills attached.</Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {selectedClaim.bills.map((b) => (
                      <Paper key={b.id} variant="outlined" sx={{ p: 1.5, borderColor: '#E4EBE1', borderRadius: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#16231B' }}>
                            {b.supplier_name || `Bill #${b.id}`}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: '#7A8B80' }}>
                            {b.bill_date ? `Date: ${b.bill_date}` : ''} {b.bill_number ? `• No: ${b.bill_number}` : ''} • Created by: {b.uploaded_by_name || 'User'}
                          </Typography>
                        </div>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#023020' }}>
                          ₹{Number(b.total_amount).toFixed(2)}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                )}
              </div>

              {/* Status History Timeline */}
              {selectedClaim.status_history && selectedClaim.status_history.length > 0 && (
                <div>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#023020', mb: 1 }}>
                    Approval History & Audit Trail
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {selectedClaim.status_history.map((h) => (
                      <Box key={h.id} sx={{ p: 1.5, bgcolor: '#F8FAF8', borderRadius: 1.5, borderLeft: '3px solid #16C47F' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#16231B' }}>
                            {h.from_status} → {h.to_status}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: '#7A8B80' }}>
                            {new Date(h.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </Typography>
                        </Box>
                        {h.actor_name && (
                          <Typography sx={{ fontSize: 11, color: '#526356', mt: 0.25 }}>
                            Action by: {h.actor_name}
                          </Typography>
                        )}
                        {h.note && (
                          <Typography sx={{ fontSize: 12, color: '#D97706', mt: 0.5, fontStyle: 'italic' }}>
                            "{h.note}"
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                </div>
              )}
            </Box>
          </Box>
        )}
      </Drawer>

      {/* REJECT MODAL */}
      <Dialog open={rejectModalOpen} onClose={() => setRejectModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#991B1B' }}>Reject Claim</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 13, color: '#667085', mb: 1.5 }}>
            State the reason for rejection. All bundled bills will return to the employee for correction.
          </Typography>
          <TextField
            label="Rejection Reason *"
            fullWidth
            multiline
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRejectModalOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleRejectSubmit}>
            Confirm Rejection
          </Button>
        </DialogActions>
      </Dialog>

      {/* CREATE PAYOUT BATCH MODAL */}
      <Dialog open={payoutBatchModalOpen} onClose={() => setPayoutBatchModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#023020' }}>Create Payout Batch</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography sx={{ fontSize: 13, color: '#667085' }}>
            Select approved claims to bundle into a single bank transfer batch:
          </Typography>

          <Box sx={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #E4EBE1', borderRadius: 2, p: 1 }}>
            {approvedClaimsForBatch.length === 0 ? (
              <Typography sx={{ p: 2, fontSize: 12, color: '#94A3B8' }}>No approved claims ready for payout.</Typography>
            ) : (
              approvedClaimsForBatch.map((c) => (
                <Box
                  key={c.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1,
                    '&:hover': { bgcolor: '#F8FAF8' },
                    borderRadius: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Checkbox
                      checked={selectedClaimIdsForBatch.includes(c.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedClaimIdsForBatch([...selectedClaimIdsForBatch, c.id]);
                        else setSelectedClaimIdsForBatch(selectedClaimIdsForBatch.filter((id) => id !== c.id));
                      }}
                      size="small"
                    />
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{c.claim_no}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#667085' }}>({c.employee_name})</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>
                    ₹{Number(c.total_amount).toFixed(2)}
                  </Typography>
                </Box>
              ))
            )}
          </Box>

          <TextField
            label="Batch Reference / Description"
            size="small"
            fullWidth
            value={payoutBatchNotes}
            onChange={(e) => setPayoutBatchNotes(e.target.value)}
            placeholder="e.g. Nov 2026 1st Fortnight Reimbursements"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPayoutBatchModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateBatchSubmit}
            disabled={selectedClaimIdsForBatch.length === 0}
            sx={{ bgcolor: '#023020', '&:hover': { bgcolor: '#2A402A' } }}
          >
            Create Batch ({selectedClaimIdsForBatch.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* RECORD TRANSFER MODAL */}
      <Dialog open={transferModalOpen} onClose={() => setTransferModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#023020' }}>Record Bank Transfer</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Bank UTR Number *"
            size="small"
            required
            fullWidth
            value={utrNumber}
            onChange={(e) => setUtrNumber(e.target.value)}
            placeholder="e.g. HDFC000192837482"
          />
          <TextField
            label="Payment Date *"
            size="small"
            type="date"
            InputLabelProps={{ shrink: true }}
            fullWidth
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
          <TextField
            label="Bank Reference"
            size="small"
            fullWidth
            value={bankRef}
            onChange={(e) => setBankRef(e.target.value)}
            placeholder="e.g. HDFC Current Account"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTransferModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleRecordTransferSubmit}
            disabled={!utrNumber.trim()}
            sx={{ bgcolor: '#023020', '&:hover': { bgcolor: '#2A402A' } }}
          >
            Save & Notify
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
