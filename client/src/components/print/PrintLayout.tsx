import React from 'react';

import { PrintFooter, PrintHeader } from './PrintHeader';

export interface CompanyConfig {
  company_name?: string;
  company_short_name?: string;
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
  requestNo?: string;
  requestDate?: string;
}

const printStyles = `
  @media print {
    @page {
      margin: 15mm;
      size: A4;
    }
    body {
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print {
      display: none !important;
    }
    table {
      page-break-inside: avoid;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    thead {
      display: table-header-group;
    }
    tbody {
      display: table-row-group;
    }
    h1, h2, h3, h4, h5, h6 {
      page-break-after: avoid;
    }
    p, li {
      orphans: 3;
      widows: 3;
    }
    .print-label {
      font-size: 0.75rem;
      font-weight: 600;
    }
    .print-value {
      font-size: 0.85rem;
      font-weight: 600;
    }
    .print-table-header {
      font-size: 0.8rem;
      font-weight: 700;
    }
    .print-table-body {
      font-size: 0.75rem;
    }
    .print-title {
      font-size: 20px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .print-subtitle {
      font-size: 14px;
      font-weight: 500;
      color: #555;
    }
  }
`;

export default function PrintLayout({
  title,
  subtitle,
  children,
  companyConfig = {},
  requestNo,
  requestDate,
}: PrintLayoutProps) {
  return (
    <div
      style={{
        padding: 24,
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        backgroundColor: '#fff',
        color: '#000',
        minHeight: '100vh',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      <PrintHeader companyConfig={companyConfig} requestNo={requestNo} requestDate={requestDate} />
      <div
        style={{
          textAlign: 'center',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: '#1a1a1a',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 8,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 14,
              color: '#555',
              fontWeight: 500,
              marginBottom: 12,
            }}
          >
            {subtitle}
          </div>
        )}
        <hr
          style={{
            margin: '0 auto',
            width: '60%',
            border: 'none',
            borderTop: '1px solid #999',
          }}
        />
      </div>
      <div>{children}</div>
      <PrintFooter
        footerText={
          companyConfig.company_short_name
            ? `Generated from ${companyConfig.company_short_name}`
            : undefined
        }
      />
    </div>
  );
}
