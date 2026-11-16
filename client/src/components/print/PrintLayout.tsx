import React, { useEffect, useRef } from 'react';
import { Box, Typography, Divider, Grid, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress } from '@mui/material';
import { useGetAppDataQuery } from '@/api/appDataApi';

interface PrintLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onPrintReady?: () => void;
  companyConfigKey?: string;
}

const COMPANY_CONFIG_KEY = 'company_configuration';

interface CompanyConfig {
  company_name?: string;
  legal_name?: string;
  tagline?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  gstin?: string;
  pan?: string;
  cin?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  logo_base64?: string;
  logo_mime_type?: string;
}

export default function PrintLayout({
  title,
  subtitle,
  children,
  onPrintReady,
  companyConfigKey = COMPANY_CONFIG_KEY,
}: PrintLayoutProps) {
  const { data: appData, isLoading } = useGetAppDataQuery(companyConfigKey);
  const companyConfig = (appData?.value as CompanyConfig) || {};
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading) {
      // Auto-trigger print when data is loaded
      setTimeout(() => {
        window.print();
        onPrintReady?.();
      }, 100);
    }
  }, [isLoading, onPrintReady]);

  const renderCompanyHeader = () => (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        {companyConfig.logo_base64 && companyConfig.logo_mime_type && (
          <Grid item xs={2}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f5f5f5',
              }}
            >
              <img
                src={`data:${companyConfig.logo_mime_type};base64,${companyConfig.logo_base64}`}
                alt={companyConfig.company_name || 'Company Logo'}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            </Box>
          </Grid>
        )}
        <Grid item xs={companyConfig.logo_base64 ? 10 : 12}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1a1a1a', lineHeight: 1.2, mb: 0.5 }}>
            {companyConfig.company_name || 'Company Name'}
          </Typography>
          {companyConfig.legal_name && companyConfig.legal_name !== companyConfig.company_name && (
            <Typography variant="subtitle1" sx={{ color: '#666', fontWeight: 500, mb: 0.5 }}>
              {companyConfig.legal_name}
            </Typography>
          )}
          {companyConfig.tagline && (
            <Typography variant="body2" sx={{ color: '#888', fontStyle: 'italic', mb: 1 }}>
              {companyConfig.tagline}
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, fontSize: '0.75rem', color: '#555' }}>
            {companyConfig.address_line1 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>📍</span>
                <span>{companyConfig.address_line1}</span>
              </Box>
            )}
            {companyConfig.address_line2 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>📍</span>
                <span>{companyConfig.address_line2}</span>
              </Box>
            )}
            {(companyConfig.city || companyConfig.state || companyConfig.pincode) && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>📍</span>
                <span>
                  {companyConfig.city ? `${companyConfig.city}, ` : ''}
                  {companyConfig.state ? `${companyConfig.state} ` : ''}
                  {companyConfig.pincode ? `- ${companyConfig.pincode}` : ''}
                </span>
              </Box>
            )}
            {companyConfig.phone && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>📞</span>
                <span>{companyConfig.phone}</span>
              </Box>
            )}
            {companyConfig.email && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>✉️</span>
                <span>{companyConfig.email}</span>
              </Box>
            )}
            {companyConfig.gstin && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>🏷️</span>
                <span>GSTIN: {companyConfig.gstin}</span>
              </Box>
            )}
            {companyConfig.pan && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>🏷️</span>
                <span>PAN: {companyConfig.pan}</span>
              </Box>
            )}
          </Box>
        </Grid>
      </Grid>
      <Divider sx={{ mt: 2, mb: 1, borderColor: '#333', borderWidth: 2 }} />
    </Box>
  );

  const renderDocumentTitle = () => (
    <Box sx={{ textAlign: 'center', mb: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 1, mb: 0.5 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="subtitle1" sx={{ color: '#555', fontWeight: 500 }}>
          {subtitle}
        </Typography>
      )}
      <Divider sx={{ mt: 1.5, mx: 'auto', width: '60%', borderColor: '#999' }} />
    </Box>
  );

  const renderPrintTimestamp = () => (
    <Box sx={{ textAlign: 'right', mb: 2, fontSize: '0.7rem', color: '#888' }}>
      <Typography>Printed on: {new Date().toLocaleString()}</Typography>
    </Box>
  );

  if (isLoading) {
    return (
      <Box
        ref={printRef}
        sx={{
          padding: 3,
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
          backgroundColor: '#fff',
          color: '#000',
          minHeight: '100vh',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress size={40} />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      ref={printRef}
      sx={{
        padding: 3,
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        backgroundColor: '#fff',
        color: '#000',
        minHeight: '100vh',
      }}
    >
        <style dangerouslySetInnerHTML={{
          __html: `
          @media print {
            @page {
              margin: 15mm;
              size: A4;
            }
            body {
              margin: 0;
              padding: 0;
            }
            .no-print {
              display: none !important;
            }
            }
          `
        }} />
      {renderCompanyHeader()}
      {renderDocumentTitle()}
      {renderPrintTimestamp()}
      <Box>{children}</Box>
      <Divider sx={{ mt: 4, borderColor: '#ccc', borderWidth: 1 }} />
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888' }}>
        <Typography>Generated by CRMFinance-KIM</Typography>
        <Typography>Page 1 of 1</Typography>
      </Box>
    </Box>
  );
}