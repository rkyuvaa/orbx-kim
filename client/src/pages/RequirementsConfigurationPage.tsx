import { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';

import DropdownOptionsPanel from '@/features/configuration/DropdownOptionsPanel';

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
    </div>
  );
}