export interface VSKitComponentType {
  id: number;
  kit_id: number;
  component_type: string;
  label: string;
  serial_number: string | null;
  is_required: boolean;
  created_at: string;
}

export interface VSKit {
  id: number;
  kit_number: string;
  kit_name: string;
  customer_name: string | null;
  vehicle_number: string | null;
  installed_on: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  component_types: VSKitComponentType[];
}

export interface VSKitCreate {
  kit_number: string;
  kit_name: string;
  customer_name?: string;
  vehicle_number?: string;
  installed_on?: string;
  description?: string;
  component_types: {
    component_type: string;
    label: string;
    serial_number?: string;
    is_required: boolean;
  }[];
}

export interface VSKitUpdate {
  kit_number?: string;
  kit_name?: string;
  customer_name?: string;
  vehicle_number?: string;
  installed_on?: string;
  description?: string;
  is_active?: boolean;
}

export interface VSKitPdfParsePreview {
  kit_name: string;
  kit_number: string;
  customer_name?: string | null;
  vehicle_number?: string | null;
  installed_on?: string | null;
  components: {
    component_type: string;
    label: string;
    serial_number?: string;
    is_required: boolean;
  }[];
  total_raw: number;
  total_serialized: number;
  total_skipped: number;
}

export interface VSComponentHistory {
  id: number;
  vehicle_component_id: number;
  old_serial_number: string;
  new_serial_number: string;
  replaced_date: string;
  reason: string | null;
  replaced_by_id: number | null;
  replaced_by_name: string | null;
  complaint_id: number | null;
  created_at: string;
}

export interface VSVehicleComponent {
  id: number;
  vehicle_id: number;
  component_type_id: number | null;
  component_type: string;
  component_label: string;
  serial_number: string;
  installed_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  history: VSComponentHistory[];
}

export interface VSVehicle {
  id: number;
  vehicle_number: string;
  chassis_number: string | null;
  kit_id: number | null;
  kit_number: string | null;
  kit_name: string | null;
  retrofit_date: string | null;
  owner_name: string;
  owner_phone: string;
  owner_address: string | null;
  warranty_expiry: string | null;
  last_service_date: string | null;
  total_mileage_km: number;
  qr_token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  components: VSVehicleComponent[];
  open_complaints_count: number;
}

export interface VSVehicleCreate {
  vehicle_number: string;
  chassis_number?: string;
  kit_id?: number;
  retrofit_date?: string;
  owner_name: string;
  owner_phone: string;
  owner_address?: string;
  warranty_expiry?: string;
  total_mileage_km?: number;
  components: {
    component_type_id?: number;
    component_type: string;
    component_label: string;
    serial_number: string;
    installed_date?: string;
  }[];
}

export interface VSVehicleUpdate {
  chassis_number?: string;
  owner_name?: string;
  owner_phone?: string;
  owner_address?: string;
  warranty_expiry?: string;
  last_service_date?: string;
  total_mileage_km?: number;
  is_active?: boolean;
}

export interface VSComponentReplaceRequest {
  new_serial_number: string;
  replaced_date: string;
  reason?: string;
  complaint_id?: number;
}

export interface VSComplaintNote {
  id: number;
  complaint_id: number;
  author_id: number | null;
  author_name: string;
  note: string;
  is_status_change: boolean;
  created_at: string;
}

export interface VSServiceCost {
  id: number;
  complaint_id: number | null;
  maintenance_id: number | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface VSCustomerFeedback {
  id: number;
  complaint_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface VSComplaint {
  id: number;
  complaint_no: string;
  vehicle_id: number;
  vehicle_number: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  affected_component_id: number | null;
  affected_component_label: string | null;
  affected_component_serial: string | null;
  reported_by: string;
  reported_phone: string;
  category: string;
  severity: string;
  description: string;
  gps_latitude: number | null;
  gps_longitude: number | null;
  gps_address: string | null;
  registered_via: string;
  status: string;
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  resolution_summary: string | null;
  created_at: string;
  updated_at: string;
  notes: VSComplaintNote[];
  feedback: VSCustomerFeedback | null;
  costs: VSServiceCost[];
}

export interface VSComplaintCreate {
  vehicle_id: number;
  affected_component_id?: number;
  reported_by: string;
  reported_phone: string;
  category: string;
  severity: string;
  description: string;
  gps_latitude?: number;
  gps_longitude?: number;
  gps_address?: string;
  assigned_to_id?: number;
}

export interface VSPublicComplaintCreate {
  vehicle_number?: string;
  affected_component_id?: number;
  reported_by: string;
  reported_phone: string;
  category: string;
  severity: string;
  description: string;
  gps_latitude?: number;
  gps_longitude?: number;
  gps_address?: string;
}

export interface VSUniversalComplaintCreate {
  vehicle_number: string;
  reported_by: string;
  reported_phone: string;
  category: string;
  severity: string;
  description: string;
  affected_component_id?: number;
  gps_latitude?: number;
  gps_longitude?: number;
  gps_address?: string;
}

export interface VSComplaintUpdate {
  status?: string;
  severity?: string;
  assigned_to_id?: number;
  affected_component_id?: number;
  resolution_summary?: string;
}

export interface VSComplaintCloseRequest {
  resolution_summary: string;
  rating?: number;
  feedback_comment?: string;
}

export interface VSMaintenanceSchedule {
  id: number;
  vehicle_id: number;
  vehicle_number: string | null;
  title: string;
  service_type: string;
  scheduled_date: string;
  completed_date: string | null;
  status: string;
  notes: string | null;
  technician_id: number | null;
  technician_name: string | null;
  cost: number;
  created_at: string;
  updated_at: string;
}

export interface VSMaintenanceCreate {
  vehicle_id: number;
  title: string;
  service_type: string;
  scheduled_date: string;
  notes?: string;
  technician_id?: number;
  cost?: number;
}

export interface VSMaintenanceUpdate {
  status?: string;
  completed_date?: string;
  notes?: string;
  cost?: number;
  technician_id?: number;
}

export interface VSDashboardKPIs {
  total_vehicles: number;
  open_complaints: number;
  critical_alerts: number;
  pending_maintenance: number;
  resolved_this_month: number;
  avg_resolution_hours: number;
}

export interface VSCategoryCount {
  category: string;
  count: number;
}

export interface VSSeverityCount {
  severity: string;
  count: number;
}

export interface VSStatusCount {
  status: string;
  count: number;
}

export interface VSAnomalyAlert {
  vehicle_id: number;
  vehicle_number: string;
  category: string;
  complaints_count: number;
  message: string;
}

export interface VSDashboardData {
  kpis: VSDashboardKPIs;
  by_category: VSCategoryCount[];
  by_severity: VSSeverityCount[];
  by_status: VSStatusCount[];
  recent_complaints: VSComplaint[];
  anomalies: VSAnomalyAlert[];
}

export interface VSPublicVehicleInfo {
  vehicle_id: number;
  vehicle_number: string;
  owner_name: string;
  owner_phone: string;
  kit_number: string | null;
  kit_name: string | null;
  warranty_expiry: string | null;
  components: VSVehicleComponent[];
}
