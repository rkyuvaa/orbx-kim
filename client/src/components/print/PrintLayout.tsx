import React from 'react';

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

// Fallback logo shown until the user uploads their own in
// Settings > Company Configuration. Ships as a static asset so the printout
// always renders the company mark.
export const DEFAULT_LOGO_SRC = '/company-logo.png';

export function resolveLogoSrc(companyConfig: CompanyConfig): string {
  return companyConfig.logo_base64 && companyConfig.logo_mime_type
    ? `data:${companyConfig.logo_mime_type};base64,${companyConfig.logo_base64}`
    : DEFAULT_LOGO_SRC;
}

export const renderCompanyHeader = (companyConfig: CompanyConfig) => {
  const logoSrc = resolveLogoSrc(companyConfig);

  const name = companyConfig.company_name || 'Konwert India Motors';
  const hasAddress = Boolean(
    companyConfig.address_line1 ||
      companyConfig.address_line2 ||
      companyConfig.city ||
      companyConfig.state ||
      companyConfig.pincode,
  );

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        {/* Left side: Logo and Company Name */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flex: 1,
            minWidth: 260,
          }}
        >
          <div
            style={{
              width: 90,
              height: 90,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <img
              src={logoSrc}
              alt={name || 'Company Logo'}
              loading="eager"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: '#000',
                lineHeight: 1.2,
                marginBottom: 4,
              }}
            >
              {name}
            </div>
            {companyConfig.tagline && (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#000',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {companyConfig.tagline}
              </div>
            )}
          </div>
        </div>

        {/* Right side: Company Address and Contact */}
        <div
          style={{
            textAlign: 'right',
            flex: 1,
            minWidth: 260,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: '#000',
              lineHeight: 1.7,
              textAlign: 'right',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{name}</div>
            {companyConfig.address_line1 && (
              <div style={{ marginBottom: 4 }}>{companyConfig.address_line1}</div>
            )}
            {companyConfig.address_line2 && (
              <div style={{ marginBottom: 4 }}>{companyConfig.address_line2}</div>
            )}
            {(companyConfig.city ||
              companyConfig.state ||
              companyConfig.pincode) && (
              <div style={{ marginBottom: 8 }}>
                {companyConfig.city ? `${companyConfig.city}, ` : ''}
                {companyConfig.state ? `${companyConfig.state} ` : ''}
                {companyConfig.pincode ? `${companyConfig.pincode} ` : ''}
                {companyConfig.country &&
                  companyConfig.country !== 'India' &&
                  companyConfig.country}
              </div>
            )}
            {companyConfig.gstin && (
              <div>GSTIN: {companyConfig.gstin}</div>
            )}
            {companyConfig.phone && <div>Phone: {companyConfig.phone}</div>}
            {companyConfig.email && <div>Email: {companyConfig.email}</div>}
            {companyConfig.website && (
              <div>Website: {companyConfig.website}</div>
            )}
            {!hasAddress && (
              <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                Set your company address in Settings &gt; Company Configuration
              </div>
            )}
          </div>
        </div>
      </div>
      <hr
        style={{
          marginTop: 16,
          marginBottom: 8,
          border: 'none',
          borderTop: '2px solid #333',
        }}
      />
    </div>
  );
};

const renderDocumentTitle = (title: string, subtitle?: string) => {
  return (
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
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
  );
};

const renderPrintTimestamp = () => {
  return (
    <div
      style={{
        textAlign: 'right',
        marginBottom: 16,
        fontSize: 10,
        color: '#888',
      }}
    >
      <div>Printed on: {new Date().toLocaleString()}</div>
    </div>
  );
};

const renderFooter = () => {
  return (
    <>
      <hr style={{ marginTop: 32, border: 'none', borderTop: '1px solid #ccc' }} />
      <div
        style={{
          marginTop: 16,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: '#888',
        }}
      >
        <div>Generated by CRMFinance-KIM</div>
        <div>Page 1 of 1</div>
      </div>
    </>
  );
};

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
      {renderCompanyHeader(companyConfig)}
      {renderDocumentTitle(title, subtitle)}
      {renderPrintTimestamp()}
      <div>{children}</div>
      {renderFooter()}
    </div>
  );
}