import { useEffect, useMemo, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Paper, Tab, Tabs, TextField, Typography } from '@mui/material';

import { useGetAppDataQuery, usePutAppDataMutation } from '@/api/appDataApi';
import { useGetAllUsersQuery } from '@/api/rbacApi';
import { useToast } from '@/components/ui/ToastHost';
import DropdownOptionsPanel from '@/features/configuration/DropdownOptionsPanel';
import type { UserDetail } from '@/types/rbac';

const STORE_INCHARGE_CONFIG_KEY = 'crm_requirements_store_incharges';

function StoreInchargePanel() {
  const { showToast } = useToast();
  const { data: config, isLoading: configLoading } = useGetAppDataQuery(STORE_INCHARGE_CONFIG_KEY);
  const { data: users = [], isLoading: usersLoading } = useGetAllUsersQuery();
  const [putAppData, { isLoading: isSaving }] = usePutAppDataMutation();
  const [selectedUsers, setSelectedUsers] = useState<UserDetail[]>([]);

  const activeUsers = useMemo(
    () => users.filter((user) => user.status === 'ACTIVE' && Boolean(user.email)),
    [users],
  );

  useEffect(() => {
    const value = config?.value as { user_ids?: number[] } | number[] | null | undefined;
    const selectedIds = Array.isArray(value) ? value : value?.user_ids || [];
    setSelectedUsers(activeUsers.filter((user) => selectedIds.includes(user.id)));
  }, [activeUsers, config]);

  const handleSave = async () => {
    try {
      await putAppData({
        key: STORE_INCHARGE_CONFIG_KEY,
        value: { user_ids: selectedUsers.map((user) => user.id) },
        expected_revision: config?.revision || 0,
      }).unwrap();
      showToast('Store incharge settings saved successfully.', 'success');
    } catch (err: any) {
      showToast(
        err?.status === 409
          ? 'Settings changed in another session. Please reload and try again.'
          : err?.data?.detail || 'Failed to save store incharge settings.',
        'error',
      );
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 3, maxWidth: 760, borderColor: '#E4EBE1' }}>
      <Typography sx={{ fontSize: 17, fontWeight: 700, color: '#023020' }}>
        Store Incharge Manager
      </Typography>
      <Typography sx={{ fontSize: 13, color: '#667085', mt: 0.75, mb: 2.5 }}>
        Select the store incharge persons who should receive an email when a material requirement is approved and waiting for processing.
      </Typography>

      <Autocomplete
        multiple
        options={activeUsers}
        value={selectedUsers}
        loading={usersLoading || configLoading}
        onChange={(_, value) => setSelectedUsers(value)}
        getOptionLabel={(user) => `${user.full_name} (${user.email})`}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        noOptionsText="No active users with email addresses found"
        renderInput={(params) => (
          <TextField
            {...params}
            label="Store incharge persons"
            placeholder={selectedUsers.length === 0 ? 'Search and select users' : 'Add another person'}
          />
        )}
      />

      {selectedUsers.length === 0 && !configLoading && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No store incharges are configured. Approved material requests will not trigger store processing emails.
        </Alert>
      )}

      <Box sx={{ mt: 2.5 }}>
        <Button variant="contained" onClick={handleSave} disabled={isSaving || configLoading || usersLoading}>
          {isSaving ? 'Saving…' : 'Save Store Incharges'}
        </Button>
      </Box>
    </Paper>
  );
}

export default function RequirementsConfigurationPage() {
  const [tab, setTab] = useState(0);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, color: '#023020' }}>
          Requirements Configuration
        </div>
        <div style={{ fontSize: 13, color: '#7A8B80', marginTop: 3 }}>
          Master data and defaults used for Material/IT Requirements.
        </div>
      </div>

      <Box sx={{ borderBottom: 1, borderColor: '#E4EBE1', mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, next) => setTab(next)}
          textColor="primary"
          indicatorColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': { textTransform: 'none', fontSize: 13, fontWeight: 600 },
          }}
        >
          <Tab label="Cost Centre" />
          <Tab label="Manager" />
        </Tabs>
      </Box>

      {tab === 0 && (
        <DropdownOptionsPanel
          category="cost_centre"
          title="Cost Centre"
          singularTitle="Cost Centre"
          description="Configurable cost centres for material/service requisitions and project budgeting."
          placeholder="e.g. CC-100 Manufacturing"
        />
      )}
      {tab === 1 && <StoreInchargePanel />}
    </div>
  );
}
