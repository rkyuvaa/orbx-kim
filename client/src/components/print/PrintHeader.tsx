import React from 'react';

import type { CompanyConfig } from './PrintLayout';

interface PrintHeaderProps {
  companyConfig: CompanyConfig;
  requestNo?: string;
  requestDate?: string;
}

// Brand green used for the header bottom rule and accents.
const BRAND_GREEN = '#1B4332';

const empty = (v?: string | null) => v == null || String(v).trim() === '';

const addressParts = (c: CompanyConfig): string[] => [
  c.address_line1,
  c.address_line2,
  c.city,
  c.state,
  c.pincode,
  c.country,
].filter(Boolean);

export function PrintHeader({
  companyConfig = {},
  requestNo,
  requestDate,
}: PrintHeaderProps) {
  const logoSrc =
    companyConfig.logo_base64 && companyConfig.logo_mime_type
      ? `data:${companyConfig.logo_mime_type};base64,${companyConfig.logo_base64}`
      : undefined;

  const shortName = companyConfig.company_short_name || undefined;
  const footerText = shortName ? `Generated from ${shortName}` : undefined;

  const address = addressParts(companyConfig).join(', ');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 16,
          borderBottom: `3px solid ${BRAND_GREEN}`,
          paddingBottom: 8,
        }}
      >
        {/* Left: Logo */}
        <div
          style={{
            flexShrink: 0,
            width: 90,
            height: 48,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={companyConfig.company_name || 'Company Logo'}
              loading="eager"
              style={{
                maxHeight: '100%',
                maxWidth: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : null}
        </div>

        {/* Centre: Company name + details */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: 'center',
          }}
        >
          {!empty(companyConfig.company_name) && (
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: '#000',
                lineHeight: 1.2,
                marginBottom: 2,
              }}
            >
              {companyConfig.company_name}
            </div>
          )}
          {!empty(companyConfig.tagline) && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: BRAND_GREEN,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              {companyConfig.tagline}
            </div>
          )}
          {!empty(address) && (
            <div
              style={{
                fontSize: 11,
                color: '#000',
                lineHeight: 1.6,
              }}
            >
              {address}
            </div>
          )}
          {!empty(companyConfig.gstin) && (
            <div style={{ fontSize: 11, color: '#000', marginTop: 2 }}>
              GSTIN: {companyConfig.gstin}
            </div>
          )}
          {!empty(companyConfig.cin) && (
            <div style={{ fontSize: 11, color: '#000', marginTop: 2 }}>
              CIN: {companyConfig.cin}
            </div>
          )}
          {!empty(companyConfig.phone) && (
            <div style={{ fontSize: 11, color: '#000', marginTop: 2 }}>
              Phone: {companyConfig.phone}
            </div>
          )}
          {!empty(companyConfig.email) && (
            <div style={{ fontSize: 11, color: '#000', marginTop: 2 }}>
              Email: {companyConfig.email}
            </div>
          )}
          {!empty(companyConfig.website) && (
            <div style={{ fontSize: 11, color: '#000', marginTop: 2 }}>
              Website: {companyConfig.website}
            </div>
          )}
        </div>

        {/* Right: Request No. + date */}
        <div
          style={{
            flexShrink: 0,
            textAlign: 'right',
            minWidth: 140,
          }}
        >
          {!empty(requestNo) && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#000',
                marginBottom: 2,
              }}
            >
              Request No.: {requestNo}
            </div>
          )}
          {!empty(requestDate) && (
            <div style={{ fontSize: 11, color: '#000', marginBottom: 2 }}>
              Date: {requestDate}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Shared footer. Page numbers are rendered via CSS @page margin boxes
// (counter(page) / counter(pages)) so they appear on every page.
interface PrintFooterProps {
  footerText?: string;
}

export function PrintFooter({ footerText }: PrintFooterProps) {
  return (
    <div
      style={{
        marginTop: 32,
        borderTop: `1px solid #ccc`,
        paddingTop: 12,
        fontSize: 9,
        color: '#666',
      }}
    >
      {footerText ? `${footerText} · ` : ''}
      This document has been digitally generated and approved. No signature is required.
    </div>
  );
}
