export type InvDocStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'CANCELLED';
export type InvMoveType =
  | 'RECEIPT'
  | 'ISSUE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'RETURN_IN'
  | 'RETURN_OUT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT';
export type InvReturnType = 'FROM_JOB' | 'TO_SUPPLIER';
export type InvAdjustmentType = 'DAMAGE' | 'WRITE_OFF' | 'COUNT' | 'OTHER';

export interface InvStore {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface InvLocation {
  id: number;
  store_id: number;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface InvBin {
  id: number;
  location_id: number;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface InvCategory {
  id: number;
  name: string;
  code: string;
  parent_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface InvUnit {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface InvBrand {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface InvSupplier {
  id: number;
  name: string;
  code: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  credit_terms: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface InvTaxRate {
  id: number;
  name: string;
  rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface InvItem {
  id: number;
  sku: string;
  name: string;
  category_id: number | null;
  unit_id: number | null;
  brand_id: number | null;
  default_supplier_id: number | null;
  tax_rate_id: number | null;
  purchase_price: number;
  reorder_level: number;
  reorder_qty: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvStockBalance {
  id: number;
  item_id: number;
  store_id: number;
  location_id: number;
  bin_id: number;
  batch_no: string;
  serial_no: string;
  expiry_date: string | null;
  qty: number;
  avg_cost: number;
  updated_at: string;
}
export interface InvStockMove {
  id: number;
  item_id: number;
  store_id: number;
  location_id: number;
  bin_id: number;
  batch_no: string;
  serial_no: string;
  expiry_date: string | null;
  move_type: InvMoveType;
  qty: number;
  unit_cost: number;
  total_cost: number;
  document_no: string | null;
  source_doc_type: string | null;
  source_doc_id: number | null;
  created_by_id: number | null;
  created_at: string;
}

interface InvLineBase {
  item_id: number;
  qty: number;
  batch_no: string;
  serial_no: string;
}
export interface InvPRLine extends InvLineBase {
  id: number;
  est_unit_price: number;
}
export interface InvPurchaseRequest {
  id: number;
  pr_number: string;
  supplier_id: number | null;
  status: InvDocStatus;
  requested_by_id: number | null;
  approved_by_id: number | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lines: InvPRLine[];
}
export interface InvPOLine {
  id: number;
  item_id: number;
  qty: number;
  unit_price: number;
  tax_rate_id: number | null;
  received_qty: number;
}
export interface InvPurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  status: InvDocStatus;
  expected_date: string | null;
  requested_by_id: number | null;
  approved_by_id: number | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lines: InvPOLine[];
}
export interface InvGRLine {
  id: number;
  item_id: number;
  qty: number;
  batch_no: string;
  serial_no: string;
  expiry_date: string | null;
  unit_cost: number;
  store_id: number;
  location_id: number;
  bin_id: number;
  po_line_id: number | null;
}
export interface InvGoodsReceipt {
  id: number;
  gr_number: string;
  po_id: number | null;
  supplier_id: number;
  status: InvDocStatus;
  receipt_date: string;
  received_by_id: number | null;
  approved_by_id: number | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lines: InvGRLine[];
}
export interface InvIssueLine {
  id: number;
  item_id: number;
  qty: number;
  batch_no: string;
  serial_no: string;
  unit_cost: number;
  store_id: number;
  location_id: number;
  bin_id: number;
}
export interface InvIssue {
  id: number;
  issue_number: string;
  complaint_id: number;
  vehicle_id: number | null;
  status: InvDocStatus;
  issue_date: string;
  issued_by_id: number | null;
  approved_by_id: number | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lines: InvIssueLine[];
}
export interface InvReturnLine {
  id: number;
  item_id: number;
  qty: number;
  batch_no: string;
  serial_no: string;
  unit_cost: number;
  store_id: number;
  location_id: number;
  bin_id: number;
}
export interface InvReturn {
  id: number;
  return_number: string;
  return_type: InvReturnType;
  complaint_id: number | null;
  supplier_id: number | null;
  status: InvDocStatus;
  return_date: string;
  approved_by_id: number | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lines: InvReturnLine[];
}
export interface InvTransferLine {
  id: number;
  item_id: number;
  qty: number;
  batch_no: string;
  serial_no: string;
  expiry_date: string | null;
  from_location_id: number;
  from_bin_id: number;
  to_location_id: number;
  to_bin_id: number;
}
export interface InvTransfer {
  id: number;
  transfer_number: string;
  from_store_id: number;
  to_store_id: number;
  status: InvDocStatus;
  transfer_date: string;
  approved_by_id: number | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lines: InvTransferLine[];
}
export interface InvAdjustmentLine {
  id: number;
  item_id: number;
  qty: number;
  batch_no: string;
  serial_no: string;
  unit_cost: number;
  store_id: number;
  location_id: number;
  bin_id: number;
}
export interface InvAdjustment {
  id: number;
  adj_number: string;
  adjustment_type: InvAdjustmentType;
  reason: string | null;
  status: InvDocStatus;
  adj_date: string;
  approved_by_id: number | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  lines: InvAdjustmentLine[];
}

export interface InvLowStockItem {
  item_id: number;
  sku: string;
  name: string;
  available_qty: number;
  reorder_level: number;
  reorder_qty: number;
}
export interface InvPendingDoc {
  id: number;
  number: string;
  status: string;
  date: string | null;
}
export interface InvIssuedToJob {
  issue_id: number;
  issue_number: string;
  complaint_id: number;
  complaint_no: string;
  vehicle_number: string | null;
  qty: number;
  total_cost: number;
}
export interface InvRecentMove {
  id: number;
  item_id: number;
  item_name: string;
  move_type: string;
  qty: number;
  total_cost: number;
  document_no: string | null;
  created_at: string;
}
export interface InvDashboard {
  total_stock_value: number;
  low_stock: InvLowStockItem[];
  out_of_stock: InvLowStockItem[];
  pending_purchase_orders: InvPendingDoc[];
  pending_goods_receipts: InvPendingDoc[];
  issued_to_open_jobs: InvIssuedToJob[];
  recent_movements: InvRecentMove[];
}
export interface InvValuationRow {
  item_id: number;
  sku: string;
  name: string;
  qty: number;
  avg_cost: number;
  total_value: number;
}
export interface InvUsageRow {
  item_id: number;
  sku: string;
  name: string;
  qty: number;
  total_cost: number;
}
export interface InvNonMovingRow {
  item_id: number;
  sku: string;
  name: string;
  qty: number;
  last_move_date: string | null;
}