import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
  ArrowRight,
  Eye,
  Edit2,
  Trash2,
  Check,
  X,
  Building,
  RefreshCw,
  Send,
  Calendar,
  Layers,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import { expensesApi, Bill, Claim, Payout, PayoutEmployeeStatus, ExpenseCategory } from '@/api/expensesApi';
import { useAppSelector } from '@/app/hooks';

export default function ExpensesPage() {
  const { user } = useAppSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState<'bills' | 'claims' | 'approvals' | 'payouts' | 'confirmations'>('bills');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data states (Rule: Empty arrays by default, no mock data)
  const [myBills, setMyBills] = useState<Bill[]>([]);
  const [myClaims, setMyClaims] = useState<Claim[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Claim[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [myConfirmations, setMyConfirmations] = useState<PayoutEmployeeStatus[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  // Modals & Drawers
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<number | undefined>(undefined);
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

  // Auto-clear toast
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Initial fetch
  useEffect(() => {
    loadData();
    expensesApi.getCategories().then(setCategories).catch(console.error);
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bills, claims, approvals, payoutList, confs] = await Promise.all([
        expensesApi.getMyBills(),
        expensesApi.getMyClaims(),
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
      setError(err?.message || 'Failed to load expense data');
    } finally {
      setLoading(false);
    }
  };

  // Upload handler
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    setError(null);
    try {
      const newBill = await expensesApi.uploadBill(uploadFile, uploadCategory, uploadNotes);
      setMyBills((prev) => [newBill, ...prev]);
      setUploadModalOpen(false);
      setUploadFile(null);
      setUploadNotes('');
      setUploadCategory(undefined);
      setSuccessMsg('Bill uploaded successfully and processed by AI vision.');
      // Auto open review drawer
      openBillDrawer(newBill);
    } catch (err: any) {
      setError(err?.message || 'Failed to upload bill.');
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
    setError(null);
    try {
      const updated = await expensesApi.updateBill(selectedBill.id, editBillData);
      setMyBills((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setSelectedBill(updated);
      setSuccessMsg('Bill details saved successfully.');
    } catch (err: any) {
      setError(err?.message || 'Failed to save bill details.');
    } finally {
      setSavingBill(false);
    }
  };

  // Confirm Bill Ready
  const handleConfirmReady = async () => {
    if (!selectedBill) return;
    setSavingBill(true);
    try {
      const updated = await expensesApi.confirmBillReady(selectedBill.id);
      setMyBills((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setSelectedBill(updated);
      setSuccessMsg('Bill confirmed as Ready for claim grouping.');
      setBillDrawerOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to confirm bill.');
    } finally {
      setSavingBill(false);
    }
  };

  // Open Claim Detail
  const openClaimDetail = async (claimId: number) => {
    try {
      const fullClaim = await expensesApi.getClaimDetail(claimId);
      setSelectedClaim(fullClaim);
      setClaimDrawerOpen(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to load claim detail.');
    }
  };

  // Approve Claim
  const handleApproveClaim = async (claimId: number) => {
    try {
      await expensesApi.approveClaim(claimId);
      setPendingApprovals((prev) => prev.filter((c) => c.id !== claimId));
      setSuccessMsg('Claim approved successfully.');
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to approve claim.');
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
      setSuccessMsg('Claim rejected and bills returned to claimant for revision.');
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to reject claim.');
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
      setError(err?.message || 'Failed to load approved claims.');
    }
  };

  // Submit Payout Batch
  const handleCreateBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClaimIdsForBatch.length === 0) return;
    try {
      const newBatch = await expensesApi.createPayoutBatch(selectedClaimIdsForBatch, payoutBatchNotes);
      setPayouts((prev) => [newBatch, ...prev]);
      setPayoutBatchModalOpen(false);
      setPayoutBatchNotes('');
      setSelectedClaimIdsForBatch([]);
      setSuccessMsg(`Payout batch ${newBatch.batch_no} created successfully.`);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to create payout batch.');
    }
  };

  // Record Bank Transfer (UTR)
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
      setSuccessMsg('Bank transfer UTR recorded and employees notified.');
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to record bank transfer.');
    }
  };

  // Employee Confirm Receipt
  const handleConfirmReceipt = async (payoutId: number) => {
    try {
      await expensesApi.confirmReceipt(payoutId);
      setMyConfirmations((prev) =>
        prev.map((c) => (c.payout_id === payoutId ? { ...c, status: 'CONFIRMED' } : c))
      );
      setSuccessMsg('Thank you! Receipt of reimbursement confirmed.');
    } catch (err: any) {
      setError(err?.message || 'Failed to confirm receipt.');
    }
  };

  // Stats calculation
  const totalBillsAmount = myBills.reduce((acc, b) => acc + (b.total_amount || 0), 0);
  const readyBillsCount = myBills.filter((b) => b.extraction_status === 'READY' && !b.claim_id).length;
  const pendingApprovalsCount = pendingApprovals.length;
  const pendingConfirmationsCount = myConfirmations.filter((c) => c.status === 'PENDING_CONFIRMATION').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Expenses & Claims</h1>
          <p className="text-sm text-slate-500 mt-1">
            Reimbursement claims, automated bill parsing, approval workflows & payout reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setUploadModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition shadow-sm"
          >
            <Upload className="w-4 h-4" />
            Upload Bill / Receipt
          </button>
          <button
            onClick={loadData}
            title="Refresh Data"
            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">My Total Bills</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{myBills.length}</p>
            <p className="text-xs text-slate-500 mt-1">₹{totalBillsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} total</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ready for Claim</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{readyBillsCount}</p>
            <p className="text-xs text-slate-500 mt-1">Awaiting next cycle bundle</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Actionable Approvals</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{pendingApprovalsCount}</p>
            <p className="text-xs text-slate-500 mt-1">Requiring your decision</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Confirmations</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{pendingConfirmationsCount}</p>
            <p className="text-xs text-slate-500 mt-1">Awaiting receipt confirmation</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('bills')}
            className={`py-3 px-1 font-medium text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === 'bills'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Receipt className="w-4 h-4" />
            My Bills & Receipts
            <span className="ml-1 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-semibold">
              {myBills.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('claims')}
            className={`py-3 px-1 font-medium text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === 'claims'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            My Claims
            <span className="ml-1 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-semibold">
              {myClaims.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('approvals')}
            className={`py-3 px-1 font-medium text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === 'approvals'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Approvals
            {pendingApprovalsCount > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full font-semibold">
                {pendingApprovalsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('payouts')}
            className={`py-3 px-1 font-medium text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === 'payouts'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Payouts & Transfers
          </button>

          <button
            onClick={() => setActiveTab('confirmations')}
            className={`py-3 px-1 font-medium text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === 'confirmations'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            My Confirmations
            {pendingConfirmationsCount > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 rounded-full font-semibold">
                {pendingConfirmationsCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* TAB 1: MY BILLS */}
      {activeTab === 'bills' && (
        <div className="space-y-4">
          {myBills.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <Receipt className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900">No bills uploaded yet</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Upload your expense receipts (photos or PDFs) to have them parsed automatically and queued for claim cycles.
              </p>
              <button
                onClick={() => setUploadModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition shadow-sm"
              >
                <Upload className="w-4 h-4" />
                Upload Your First Bill
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Receipt</th>
                      <th className="py-3 px-4">Supplier / Vendor</th>
                      <th className="py-3 px-4">Bill Date & No</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Taxable</th>
                      <th className="py-3 px-4 text-right">GST Total</th>
                      <th className="py-3 px-4 text-right">Total Amount</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myBills.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/75 transition">
                        <td className="py-3 px-4">
                          <button
                            onClick={() => openBillDrawer(b)}
                            className="font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
                          >
                            <FileText className="w-4 h-4 text-slate-400" />
                            #{b.id}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {b.supplier_name || <span className="text-slate-400 italic">Unknown</span>}
                          {b.is_duplicate && (
                            <span className="ml-2 px-1.5 py-0.5 text-xs bg-rose-100 text-rose-700 rounded font-semibold">
                              Duplicate
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{b.bill_date || 'No Date'}</div>
                          <div className="text-xs text-slate-400">{b.bill_number || 'No Bill #'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 text-xs bg-slate-100 text-slate-700 rounded-full font-medium">
                            {b.category_name || 'Unassigned'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs">
                          ₹{Number(b.taxable_amount || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-slate-500">
                          ₹{Number(b.gst_total || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                          ₹{Number(b.total_amount || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {b.extraction_status === 'READY' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> Ready
                            </span>
                          )}
                          {b.extraction_status === 'EXTRACTED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <Check className="w-3 h-3" /> Extracted
                            </span>
                          )}
                          {b.extraction_status === 'NEEDS_REVIEW' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              <AlertCircle className="w-3 h-3" /> Needs Review
                            </span>
                          )}
                          {b.extraction_status === 'PROCESSING' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                              <RefreshCw className="w-3 h-3 animate-spin" /> Processing
                            </span>
                          )}
                          {b.extraction_status === 'FAILED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                              <X className="w-3 h-3" /> Failed
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => openBillDrawer(b)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Review / Edit Bill"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY CLAIMS */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          {myClaims.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <Layers className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900">No claims submitted yet</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
                When you mark bills as Ready, they are automatically grouped and submitted according to the active claim cycle.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myClaims.map((claim) => (
                <div
                  key={claim.id}
                  onClick={() => openClaimDetail(claim.id)}
                  className="p-5 bg-white rounded-xl border border-slate-200 hover:border-indigo-300 shadow-sm transition cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base text-slate-900">{claim.claim_no}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          claim.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : claim.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : claim.status.includes('APPROVED')
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {claim.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="mt-3 text-2xl font-extrabold text-slate-900 font-mono">
                      ₹{Number(claim.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>

                    <div className="mt-2 text-xs text-slate-500 space-y-1">
                      <p>Bills bundled: {claim.bills_count}</p>
                      <p>Cycle: {claim.cycle_name || 'Open Period'}</p>
                      <p>Branch: {claim.branch_name || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-medium">
                    <span>View Timeline & Bills</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: APPROVALS */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {pendingApprovals.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900">All caught up!</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                You have no expense claims pending your approval at this time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingApprovals.map((claim) => (
                <div
                  key={claim.id}
                  className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg text-slate-900">{claim.claim_no}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        {claim.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Claimant: <strong className="text-slate-800">{claim.employee_name}</strong> ({claim.employee_email})
                    </p>
                    <p className="text-xs text-slate-500">
                      Branch: {claim.branch_name || 'N/A'} • Bills count: {claim.bills_count}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-slate-400 uppercase font-medium">Total Claim</p>
                      <p className="text-xl font-extrabold text-slate-900 font-mono">
                        ₹{Number(claim.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openClaimDetail(claim.id)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 transition"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => {
                          setRejectTargetClaim(claim);
                          setRejectModalOpen(true);
                        }}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApproveClaim(claim.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PAYOUTS & TRANSFERS */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={openCreateBatchModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition shadow-sm"
            >
              <DollarSign className="w-4 h-4" />
              Create Payout Batch
            </button>
          </div>

          {payouts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <DollarSign className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900">No payout batches created</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Accountants can group CFO-approved claims into payout batches, execute bank transfers, and log UTR numbers.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {payouts.map((p) => (
                <div key={p.id} className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg text-slate-900">{p.batch_no}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          p.status === 'CONFIRMED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.status === 'TRANSFERRED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-xs text-slate-400 uppercase">Batch Total: </span>
                        <span className="font-mono font-bold text-slate-900 text-base">
                          ₹{Number(p.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {p.status === 'PENDING_TRANSFER' && (
                        <button
                          onClick={() => {
                            setTransferTargetPayout(p);
                            setTransferModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition"
                        >
                          Record UTR Transfer
                        </button>
                      )}
                    </div>
                  </div>

                  {p.utr_number && (
                    <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 flex flex-wrap gap-4">
                      <div>
                        <strong>Bank UTR / Ref:</strong> <span className="font-mono">{p.utr_number}</span>
                      </div>
                      <div>
                        <strong>Payment Date:</strong> {p.payment_date || 'N/A'}
                      </div>
                      {p.bank_ref && (
                        <div>
                          <strong>Bank:</strong> {p.bank_ref}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Employee confirmation breakdown */}
                  {p.employee_statuses && p.employee_statuses.length > 0 && (
                    <div className="pt-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase">Employee Confirmations:</p>
                      <div className="mt-1 divide-y divide-slate-100 text-xs">
                        {p.employee_statuses.map((s) => (
                          <div key={s.id} className="py-1.5 flex items-center justify-between">
                            <span>{s.employee_name} (₹{Number(s.amount).toFixed(2)})</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                s.status === 'CONFIRMED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : s.status === 'AUTO_RECONCILED'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {s.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: MY CONFIRMATIONS */}
      {activeTab === 'confirmations' && (
        <div className="space-y-4">
          {myConfirmations.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900">No pending payout confirmations</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                When the company transfers reimbursement funds into your bank account, you will receive an alert here to confirm receipt.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myConfirmations.map((conf) => (
                <div key={conf.id} className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-base">Reimbursement Payout #{conf.payout_id}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          conf.status === 'CONFIRMED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {conf.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 font-mono mt-1">₹{Number(conf.amount).toFixed(2)}</p>
                    {conf.confirmed_at && (
                      <p className="text-xs text-slate-400 mt-1">Confirmed on {new Date(conf.confirmed_at).toLocaleDateString()}</p>
                    )}
                  </div>

                  {conf.status === 'PENDING_CONFIRMATION' && (
                    <button
                      onClick={() => handleConfirmReceipt(conf.payout_id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                    >
                      Confirm Receipt of Funds
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* UPLOAD BILL MODAL */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">Upload Expense Bill</h3>
              <button onClick={() => setUploadModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt Document (Photo or PDF) *</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  required
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category (Optional - AI will guess)</label>
                <select
                  value={uploadCategory || ''}
                  onChange={(e) => setUploadCategory(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">-- Let AI Auto-Classify --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Description (Optional)</label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="e.g. Client lunch at Bangalore, fuel receipt for delivery vehicle"
                  rows={2}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Parsing with AI...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload & Parse
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BILL REVIEW & EDIT DRAWER */}
      {billDrawerOpen && selectedBill && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">Review Bill #{selectedBill.id}</h3>
              </div>
              <button onClick={() => setBillDrawerOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Receipt File Preview Link */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="truncate max-w-xs">{selectedBill.source_file_path.split('/').pop()}</span>
                </div>
                <a
                  href={expensesApi.getFileUrl(selectedBill.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  Open Receipt Document <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Editable Fields (Direct values without forced recalculations) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier / Vendor</label>
                  <input
                    type="text"
                    value={editBillData.supplier_name || ''}
                    onChange={(e) => setEditBillData({ ...editBillData, supplier_name: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bill / Invoice Number</label>
                  <input
                    type="text"
                    value={editBillData.bill_number || ''}
                    onChange={(e) => setEditBillData({ ...editBillData, bill_number: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bill Date</label>
                  <input
                    type="date"
                    value={String(editBillData.bill_date || '')}
                    onChange={(e) => setEditBillData({ ...editBillData, bill_date: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Category</label>
                  <select
                    value={editBillData.category_id || ''}
                    onChange={(e) => setEditBillData({ ...editBillData, category_id: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tax & Amounts (Optional GST & Direct Input) */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Amounts & Taxes</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Taxable (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editBillData.taxable_amount ?? 0}
                      onChange={(e) => setEditBillData({ ...editBillData, taxable_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 border border-slate-300 rounded text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">CGST (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editBillData.cgst_amount ?? 0}
                      onChange={(e) => setEditBillData({ ...editBillData, cgst_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 border border-slate-300 rounded text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">SGST (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editBillData.sgst_amount ?? 0}
                      onChange={(e) => setEditBillData({ ...editBillData, sgst_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 border border-slate-300 rounded text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">IGST (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editBillData.igst_amount ?? 0}
                      onChange={(e) => setEditBillData({ ...editBillData, igst_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 border border-slate-300 rounded text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800">Total Claimable Amount (₹):</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editBillData.total_amount ?? 0}
                    onChange={(e) => setEditBillData({ ...editBillData, total_amount: parseFloat(e.target.value) || 0 })}
                    className="w-40 p-2 border-2 border-emerald-500 rounded-lg text-base font-bold font-mono text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  value={editBillData.notes || ''}
                  onChange={(e) => setEditBillData({ ...editBillData, notes: e.target.value })}
                  rows={2}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={handleSaveBill}
                disabled={savingBill}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-white transition"
              >
                Save Draft
              </button>

              <button
                type="button"
                onClick={handleConfirmReady}
                disabled={savingBill}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm as Ready
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLAIM DETAIL DRAWER */}
      {claimDrawerOpen && selectedClaim && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{selectedClaim.claim_no}</h3>
                <p className="text-xs text-slate-500">Status: {selectedClaim.status.replace(/_/g, ' ')}</p>
              </div>
              <button onClick={() => setClaimDrawerOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-400 uppercase font-medium">Claim Total</p>
                <p className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
                  ₹{Number(selectedClaim.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-slate-500 mt-1">Claimant: {selectedClaim.employee_name}</p>
              </div>

              {/* Associated Bills */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Attached Bills:</h4>
                <div className="space-y-2">
                  {selectedClaim.bills?.map((b) => (
                    <div key={b.id} className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-900">{b.supplier_name || 'Vendor'}</span>
                        <div className="text-slate-400">{b.bill_date} • {b.category_name}</div>
                      </div>
                      <span className="font-mono font-bold text-slate-900">₹{Number(b.total_amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status History Timeline */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Audit Trail Timeline:</h4>
                <div className="space-y-3 border-l-2 border-indigo-200 pl-4 text-xs">
                  {selectedClaim.status_history?.map((h) => (
                    <div key={h.id} className="relative">
                      <div className="font-semibold text-slate-800">{h.to_status.replace(/_/g, ' ')}</div>
                      <div className="text-slate-500">{h.note}</div>
                      <div className="text-slate-400 text-[10px] mt-0.5">{new Date(h.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECT CLAIM MODAL */}
      {rejectModalOpen && rejectTargetClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Reject Claim {rejectTargetClaim.claim_no}</h3>
            <p className="text-xs text-slate-500">
              Provide a clear reason for the claimant. The bills will be returned to their Ready list for revision.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-3">
              <textarea
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (mandatory)..."
                rows={3}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE PAYOUT BATCH MODAL */}
      {payoutBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">Create Payout Batch</h3>
              <button onClick={() => setPayoutBatchModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBatchSubmit} className="space-y-4">
              <p className="text-xs text-slate-500">
                Select CFO-approved claims to bundle into a single bank transfer payout batch:
              </p>

              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                {approvedClaimsForBatch.length === 0 ? (
                  <p className="text-xs text-slate-400 p-2">No approved claims ready for payout.</p>
                ) : (
                  approvedClaimsForBatch.map((c) => (
                    <label key={c.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded text-xs cursor-pointer">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedClaimIdsForBatch.includes(c.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedClaimIdsForBatch([...selectedClaimIdsForBatch, c.id]);
                            else setSelectedClaimIdsForBatch(selectedClaimIdsForBatch.filter((id) => id !== c.id));
                          }}
                        />
                        <span className="font-semibold text-slate-800">{c.claim_no}</span> ({c.employee_name})
                      </div>
                      <span className="font-mono font-bold">₹{Number(c.total_amount).toFixed(2)}</span>
                    </label>
                  ))
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Notes (Optional)</label>
                <input
                  type="text"
                  value={payoutBatchNotes}
                  onChange={(e) => setPayoutBatchNotes(e.target.value)}
                  placeholder="e.g. November 2026 1st Fortnightly Payout"
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setPayoutBatchModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedClaimIdsForBatch.length === 0}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  Create Batch ({selectedClaimIdsForBatch.length})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD BANK TRANSFER (UTR) MODAL */}
      {transferModalOpen && transferTargetPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Record Bank Transfer</h3>
            <p className="text-xs text-slate-500">
              Batch #{transferTargetPayout.batch_no} • Total: ₹{Number(transferTargetPayout.total_amount).toFixed(2)}
            </p>

            <form onSubmit={handleRecordTransferSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bank UTR / Transaction Reference *</label>
                <input
                  type="text"
                  required
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  placeholder="e.g. HDFC000192837482"
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name / Reference</label>
                <input
                  type="text"
                  value={bankRef}
                  onChange={(e) => setBankRef(e.target.value)}
                  placeholder="e.g. HDFC Current Account"
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!utrNumber.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  Save & Notify Claimants
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
