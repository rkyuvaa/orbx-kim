import React from 'react';
import { Box, Typography, Divider, Grid } from '@mui/material';

export interface CompanyConfig {
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

interface PrintLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  companyConfig?: CompanyConfig;
}

const renderCompanyHeader = (companyConfig: CompanyConfig) => (
  <Box sx={{ mb: 3 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
      {/* Left side: Logo and Company Name */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 280 }}>
        {companyConfig.logo_base64 && companyConfig.logo_mime_type && (
          <Box
            sx={{
              width: 70,
              height: 70,
              borderRadius: '6px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f5f5f5',
              flexShrink: 0,
            }}
          >
            <img
              src={`data:${companyConfig.logo_mime_type};base64,${companyConfig.logo_base64}`}
              alt={companyConfig.company_name || 'Company Logo'}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </Box>
        )}
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1a1a1a', lineHeight: 1.2, mb: 0.3 }}>
            {companyConfig.company_name || 'Company Name'}
          </Typography>
          {companyConfig.legal_name && companyConfig.legal_name !== companyConfig.company_name && (
            <Typography variant="subtitle1" sx={{ color: '#666', fontWeight: 500, mb: 0.2 }}>
              {companyConfig.legal_name}
            </Typography>
          )}
          {companyConfig.tagline && (
            <Typography variant="body2" sx={{ color: '#888', fontStyle: 'italic', mb: 0.5 }}>
              {companyConfig.tagline}
            </Typography>
          )}
        </Box>
      </Box>
      
      {/* Right side: Company Address and Contact */}
      <Box sx={{ textAlign: 'right', flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <Box sx={{ fontSize: '0.8rem', color: '#444', lineHeight: 1.6, textAlign: 'right' }}>
          {companyConfig.address_line1 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.4, mb: 0.3 }}>
              <span style={{ fontSize: '0.75rem' }}>📍</span>
              <span>{companyConfig.address_line1}</span>
            </Box>
          )}
          {companyConfig.address_line2 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.4, mb: 0.3 }}>
              <span style={{ fontSize: '0.75rem' }}>📍</span>
              <span>{companyConfig.address_line2}</span>
            </Box>
          )}
          {(companyConfig.city || companyConfig.state || companyConfig.pincode) && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.4, mb: 0.5 }}>
              <span style={{ fontSize: '0.75rem' }}>📍</span>
              <span>
                {companyConfig.city ? `${companyConfig.city}, ` : ''}
                {companyConfig.state ? `${companyConfig.state} ` : ''}
                {companyConfig.pincode ? `- ${companyConfig.pincode}` : ''}
              </span>
            </Box>
          )}
          {companyConfig.phone && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.4, mb: 0.3 }}>
              <span style={{ fontSize: '0.75rem' }}>📞</span>
              <span>{companyConfig.phone}</span>
            </Box>
          )}
          {companyConfig.email && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.4, mb: 0.3 }}>
              <span style={{ fontSize: '0.75rem' }}>✉️</span>
              <span>{companyConfig.email}</span>
            </Box>
          )}
          {companyConfig.gstin && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.4, mb: 0.3 }}>
              <span style={{ fontSize: '0.75rem' }}>🏷️</span>
              <span>GSTIN: {companyConfig.gstin}</span>
            </Box>
          )}
          {companyConfig.pan && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.4 }}>
              <span style={{ fontSize: '0.75rem' }}>🏷️</span>
              <span>PAN: {companyConfig.pan}</span>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
    <Divider sx={{ mt: 2, mb: 1, borderColor: '#333', borderWidth: 2 }} />
  </Box>
);

const renderDocumentTitle = (title: string, subtitle?: string) => (
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

const renderFooter = () => (
  <>
    <Divider sx={{ mt: 4, borderColor: '#ccc', borderWidth: 1 }} />
    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888' }}>
      <Typography>Generated by CRMFinance-KIM</Typography>
      <Typography>Page 1 of 1</Typography>
    </Box>
  </>
);

const printStyles = `
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
`;

export default function PrintLayout({
  title,
  subtitle,
  children,
  companyConfig = {},
}: PrintLayoutProps) {
  return (
    <Box
      sx={{
        padding: 3,
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        backgroundColor: '#fff',
        color: '#000',
        minHeight: '100vh',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      {renderCompanyHeader(companyConfig)}
      {renderDocumentTitle(title, subtitle)}
      {renderPrintTimestamp()}
      <Box>{children}</Box>
      {renderFooter()}
    </Box>
  );
}