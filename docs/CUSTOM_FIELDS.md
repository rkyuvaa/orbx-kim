# Custom Fields System for Vehicle Service Work Orders

## Overview

The Custom Fields system allows administrators to define dynamic fields for Vehicle Service Work Orders (VS Complaints). Fields can be organized into tabs, scoped by department, and made required based on work order status.

## Architecture

### Database Models

**Tables Created:**
- `vs_custom_field_tabs` - Tab definitions for organizing fields
- `vs_custom_field_definitions` - Field definitions with type, options, validation rules
- `vs_complaint_custom_field_values` - Per-work-order field values

### Field Types Supported

| Type | Description | Configuration |
|------|-------------|---------------|
| `text` | Single-line text input | `placeholder`, `help_text` |
| `textarea` | Multi-line text input | `placeholder`, `help_text` |
| `number` | Numeric input | `placeholder`, `help_text` |
| `date` | Date picker | `help_text` |
| `timer` | Time input (HH:MM format) | `placeholder`, `help_text` |
| `dropdown` | Select from options | `options: [{value, label}]`, `placeholder`, `help_text` |
| `user` | User dropdown (dept-filtered) | `user_config: {filter_by_department, department_field}`, `help_text` |
| `file` | File upload with preview/download | `file_config: {allowed_extensions, max_size_mb}`, `help_text` |

### Key Features

1. **Tab Organization**: Fields grouped into tabs (General, Technical, Attachments, etc.)
2. **Department Scoping**: Fields visible only to users in specified departments
3. **Status-Based Required Rules**: Fields can be required only for specific work order statuses
4. **File Upload**: Server-side storage with preview (images/PDFs) and download with original filename
5. **Dynamic Rendering**: Fields rendered on Create/Manage work order dialogs
6. **Validation**: Required field validation blocks status transitions and work order closure

## API Endpoints

### Tab Management
- `GET /api/v1/vehicle-service/custom-fields/tabs` - List all tabs
- `POST /api/v1/vehicle-service/custom-fields/tabs` - Create tab
- `GET /api/v1/vehicle-service/custom-fields/tabs/{id}` - Get tab
- `PUT /api/v1/vehicle-service/custom-fields/tabs/{id}` - Update tab
- `DELETE /api/v1/vehicle-service/custom-fields/tabs/{id}` - Delete tab
- `PUT /api/v1/vehicle-service/custom-fields/tabs/reorder` - Reorder tabs

### Field Definition Management
- `GET /api/v1/vehicle-service/custom-fields/definitions` - List definitions (with filters)
- `POST /api/v1/vehicle-service/custom-fields/definitions` - Create definition
- `GET /api/v1/vehicle-service/custom-fields/definitions/{id}` - Get definition
- `PUT /api/v1/vehicle-service/custom-fields/definitions/{id}` - Update definition
- `DELETE /api/v1/vehicle-service/custom-fields/definitions/{id}` - Delete definition

### Work Order Field Values
- `GET /api/v1/vehicle-service/custom-fields/complaints/{complaint_id}/values` - Get values for work order
- `POST /api/v1/vehicle-service/custom-fields/complaints/{complaint_id}/values` - Bulk upsert values

### File Operations
- `POST /api/v1/vehicle-service/custom-fields/files/upload` - Upload file for field
- `GET /api/v1/vehicle-service/custom-fields/files/{filename}` - Download file
- `GET /api/v1/vehicle-service/custom-fields/files/{filename}/preview` - Preview file (images/PDFs)

### Work Order Integration
- `GET /api/v1/vehicle-service/custom-fields/definitions/for-complaint` - Get definitions filtered by status/department for a work order

## Frontend Components

### CustomFieldRenderer (`VSWorkOrdersTab.tsx`)
Renders appropriate input based on field type:
- Text/Number/Date/Timer: TextField
- Dropdown: AppDropdown with options
- User: AppDropdown with department filtering
- File: Upload button with preview/download

### Admin UI (`CustomFieldsAdminCard.tsx`)
Tabbed interface for managing custom fields:
- Tab list with drag handles
- Field list per tab with type chips
- Add/Edit field dialog with all configurations
- Required-by-status chip display

### Integration Points
- **Settings Page**: Custom Fields tab (super admin only)
- **Work Order Create Dialog**: Custom fields section with OPEN status fields
- **Work Order Manage Dialog**: Custom fields section with status-specific fields + Save button
- **Status Transitions**: Validation on Acknowledge, Start Service, Mark Resolved, Close
- **Close Dialog**: Required field validation before closure

## Work Order Status Flow

```
OPEN → ACKNOWLEDGED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
```

Required field validation occurs at each transition based on the target status.

## File Handling

### Upload
- Files stored in `uploads/vehicle_service/custom_fields/`
- UUID prefix prevents collisions
- Validated against `allowed_extensions` and `max_size_mb`
- Returns metadata including `url`, `preview_url`, `original_name`, `mime_type`

### Preview
- Images: Direct `<img>` display with click-to-open
- PDFs: `<iframe>` embed with toolbar disabled
- Other: File icon with download link

### Download
- Uses original filename via `download` attribute
- Streams from server

## Configuration

### Field Definition Schema
```json
{
  "tab_id": 1,
  "key": "warranty_serial",
  "label": "Warranty Serial",
  "field_type": "text",
  "placeholder": "Enter serial number",
  "help_text": "Found on device label",
  "is_required": false,
  "is_readonly": false,
  "options": null,
  "file_config": null,
  "user_config": null,
  "required_by_status": {
    "OPEN": false,
    "ACKNOWLEDGED": false,
    "ASSIGNED": true,
    "IN_PROGRESS": true,
    "RESOLVED": true,
    "CLOSED": true
  },
  "display_order": 1,
  "department_ids": [1, 2]
}
```

### File Config Schema
```json
{
  "allowed_extensions": ["pdf", "png", "jpg", "jpeg", "doc", "docx"],
  "max_size_mb": 10
}
```

### User Config Schema
```json
{
  "filter_by_department": true,
  "department_field": "department_id"
}
```

## Usage Examples

### Creating a Text Field (Admin)
```javascript
POST /api/v1/vehicle-service/custom-fields/definitions
{
  "tab_id": 1,
  "key": "customer_po_number",
  "label": "Customer PO Number",
  "field_type": "text",
  "is_required": true,
  "required_by_status": {
    "OPEN": true,
    "ACKNOWLEDGED": true,
    "ASSIGNED": true,
    "IN_PROGRESS": true,
    "RESOLVED": true,
    "CLOSED": true
  }
}
```

### Creating a File Field (Admin)
```javascript
POST /api/v1/vehicle-service/custom-fields/definitions
{
  "tab_id": 3,
  "key": "service_report",
  "label": "Service Report",
  "field_type": "file",
  "file_config": {
    "allowed_extensions": ["pdf", "png", "jpg"],
    "max_size_mb": 5
  }
}
```

### Uploading a File (Frontend)
```typescript
const { mutate: uploadFile } = useUploadCustomFieldFileMutation();
uploadFile({ file, field_id: 5, complaint_id: 123 });
```

### Validating Required Fields
```typescript
const requiredFields = getRequiredFieldsForStatus(fields, 'CLOSED');
const errors = validateRequiredFields(values, requiredFields);
if (errors.length > 0) {
  alert(`Cannot close: ${errors.join('; ')}`);
}
```

## Security

- File type validation on upload
- File size limits enforced
- Department-based access control
- Authentication required for all endpoints
- UUID filenames prevent path traversal

## Testing

```bash
# Backend tests
cd server && python -m pytest tests/test_vs_custom_fields.py -v

# Frontend build
cd client && npm run build

# Run both servers
# Backend: cd server && python -m uvicorn app.main:app --reload
# Frontend: cd client && npm run dev
```

## Migration History

- `20261030_add_vs_custom_fields` - Initial custom fields tables

## Files Modified

### Backend
- `server/app/models/vs_custom_field.py` - Database models
- `server/app/models/vehicle_service.py` - Added relationship to VSComplaint
- `server/app/schemas/vehicle_service.py` - Pydantic schemas
- `server/app/api/v1/vehicle_service.py` - API endpoints
- `server/alembic/versions/20261030_add_vs_custom_fields.py` - Migration

### Frontend
- `client/src/types/vehicleService.ts` - TypeScript interfaces
- `client/src/api/vehicleServiceApi.ts` - RTK Query endpoints
- `client/src/components/settings/CustomFieldsAdminCard.tsx` - Admin UI
- `client/src/components/vehicleService/VSWorkOrdersTab.tsx` - Work order integration
- `client/src/pages/SettingsPage.tsx` - Settings tab integration

## Future Enhancements

1. Conditional field visibility based on other field values
2. Field groups/sections within tabs
3. Default values for fields
4. Field-level permissions
5. Audit trail for field value changes
6. Import/export field definitions
7. Field validation rules (regex, min/max, etc.)