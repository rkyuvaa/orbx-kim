import { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';

import ActivityTypesPanel from '@/features/configuration/ActivityTypesPanel';
import DropdownOptionsPanel from '@/features/configuration/DropdownOptionsPanel';
import FinanciersPanel from '@/features/configuration/FinanciersPanel';
import StageAutomovePanel from '@/features/configuration/StageAutomovePanel';
import StagesPanel from '@/features/configuration/StagesPanel';
import TabsPanel from '@/features/configuration/TabsPanel';
import VehicleModelsPanel from '@/features/configuration/VehicleModelsPanel';

export default function ConfigurationPage() {
  const [tab, setTab] = useState(0);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, color: '#023020' }}>
          Configuration
        </div>
        <div style={{ fontSize: 13, color: '#7A8B80', marginTop: 3 }}>
          Master data and defaults used across the application.
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
          <Tab label="Module Tabs" />
          <Tab label="Vehicle Models" />
          <Tab label="Financiers" />
          <Tab label="Stages" />
          <Tab label="Activity Types" />
          <Tab label="Stage Auto-Move Rules" />
          <Tab label="Fuel Types" />
          <Tab label="Customer Statuses" />
          <Tab label="Sources" />
          <Tab label="Lost Reasons" />
        </Tabs>
      </Box>

      {tab === 0 && <TabsPanel />}
      {tab === 1 && <VehicleModelsPanel />}
      {tab === 2 && <FinanciersPanel />}
      {tab === 3 && <StagesPanel />}
      {tab === 4 && <ActivityTypesPanel />}
      {tab === 5 && <StageAutomovePanel />}
      {tab === 6 && (
        <DropdownOptionsPanel
          category="fuel_type"
          title="Fuel Types"
          singularTitle="Fuel Type"
          description="Configurable fuel types for vehicles (e.g. Petrol, Diesel, Electric, Hybrid, CNG)."
          placeholder="e.g. Electric"
        />
      )}
      {tab === 7 && (
        <DropdownOptionsPanel
          category="customer_status"
          title="Customer Statuses"
          singularTitle="Customer Status"
          description="Configurable prospect/customer statuses (e.g. Hot, Warm, Cold, Follow-up)."
          placeholder="e.g. Hot"
        />
      )}
      {tab === 8 && (
        <DropdownOptionsPanel
          category="lead_source"
          title="Lead Sources"
          singularTitle="Source"
          description="Configurable lead origin channels (e.g. Walk-in, Website, Referral, Social Media, Dealer)."
          placeholder="e.g. Walk-in"
        />
      )}
      {tab === 9 && (
        <DropdownOptionsPanel
          category="lost_reason"
          title="Lost Reasons"
          singularTitle="Lost Reason"
          description="Reasons when a lead or opportunity is lost (e.g. Price Too High, Bought Another Brand, Dropped Out)."
          placeholder="e.g. Price Too High"
        />
      )}
    </div>
  );
}
