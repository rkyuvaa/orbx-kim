import React from 'react';
import ReactDOMServer from 'react-dom/server';
import MaterialRequisitionPrint from './MaterialRequisitionPrint';
import ITRequirementPrint from './ITRequirementPrint';
import { RequirementItem } from '@/types/requirements';

// Wait until every <img> in the print window has finished loading (or fails,
// or a safety timeout elapses) before opening the print dialog, otherwise the
// logo can be missing from the printed output.
function waitForImages(printWindow: Window, timeoutMs = 5000): Promise<void> {
  return new Promise(resolve => {
    const doc = printWindow.document;
    if (!doc) {
      return resolve();
    }
    const images = Array.from(doc.images || []);
    if (images.length === 0) {
      return resolve();
    }
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    const timer = window.setTimeout(finish, timeoutMs);
    let remaining = images.length;
    images.forEach(img => {
      if (img.complete && img.naturalWidth > 0) {
        remaining -= 1;
        if (remaining === 0) {
          window.clearTimeout(timer);
          finish();
        }
        return;
      }
      const done = () => {
        remaining -= 1;
        if (remaining === 0) {
          window.clearTimeout(timer);
          finish();
        }
      };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  });
}

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

interface PrintServiceOptions {
  item: RequirementItem;
  companyConfig?: CompanyConfig;
  onPrintComplete?: () => void;
}

// Cache company config for the session so edits to Company Configuration
// reflect on the next print without a reload.
let companyConfigCache: CompanyConfig | null = null;

// Fetch company configuration from the API
async function fetchCompanyConfig(forceRefresh = false): Promise<CompanyConfig> {
  if (companyConfigCache && !forceRefresh) {
    return companyConfigCache;
  }
  try {
    const response = await fetch(`${window.location.origin}/api/v1/app-data/company_configuration`);
    if (!response.ok) {
      console.warn('Failed to fetch company configuration:', response.status);
      return {};
    }
    const data = await response.json();
    const config = (data.value as CompanyConfig) || {};
    companyConfigCache = config;
    return config;
  } catch (error) {
    console.warn('Error fetching company configuration:', error);
    return {};
  }
}

// Clear the cached company config (e.g. after editing Settings).
export function clearCompanyConfigCache() {
  companyConfigCache = null;
}

export async function printMaterialRequisition({ item, companyConfig, onPrintComplete }: PrintServiceOptions) {
  // Create a new window for printing
  const printWindow = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes');
  
  if (!printWindow) {
    console.error('Failed to open print window - popup blocked?');
    // Fallback to direct print
    printDirectly(() => React.createElement(MaterialRequisitionPrint, { item, companyConfig }));
    onPrintComplete?.();
    return;
  }

  // Render the component to HTML string
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(MaterialRequisitionPrint, { 
      item,
      companyConfig,
    })
  );

  // Write to the new window
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <base href="${window.location.origin}/">
      <title>Material Requisition - ${item.request_no || item.id}</title>
      <style>
        @media print {
          @page {
            margin: 0;
            size: A4;
          }
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
        }
        body {
          font-family: "Inter", "Roboto", "Helvetica", "Arial", sans-serif;
          background-color: #fff;
          color: #000;
          min-height: 100vh;
        }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `);
  printWindow.document.close();

  // Auto-trigger print once the logo (and any other images) have loaded
  waitForImages(printWindow).then(() => {
    printWindow.focus();
    printWindow.print();
  });

  // Handle window close
  printWindow.onafterprint = () => {
    printWindow.close();
    onPrintComplete?.();
  };

  // Fallback timeout in case afterprint doesn't fire
  setTimeout(() => {
    if (!printWindow.closed) {
      printWindow.close();
    }
  }, 30000);
}

export async function printITRequirement({ item, companyConfig, onPrintComplete }: PrintServiceOptions) {
  const printWindow = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes');
  
  if (!printWindow) {
    console.error('Failed to open print window - popup blocked?');
    printDirectly(() => React.createElement(ITRequirementPrint, { item, companyConfig }));
    onPrintComplete?.();
    return;
  }

  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ITRequirementPrint, { 
      item,
      companyConfig,
    })
  );

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <base href="${window.location.origin}/">
      <title>IT Requirement - ${item.request_no || item.id}</title>
      <style>
        @media print {
          @page {
            margin: 0;
            size: A4;
          }
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
        }
        body {
          font-family: "Inter", "Roboto", "Helvetica", "Arial", sans-serif;
          background-color: #fff;
          color: #000;
          min-height: 100vh;
        }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `);
  printWindow.document.close();

  // Auto-trigger print once the logo (and any other images) have loaded
  waitForImages(printWindow).then(() => {
    printWindow.focus();
    printWindow.print();
  });

  printWindow.onafterprint = () => {
    printWindow.close();
    onPrintComplete?.();
  };

  setTimeout(() => {
    if (!printWindow.closed) {
      printWindow.close();
    }
  }, 30000);
}

// Fallback: print directly in current window
function printDirectly(renderFn: () => React.ReactElement) {
  const printDiv = document.createElement('div');
  printDiv.style.position = 'absolute';
  printDiv.style.left = '-9999px';
  printDiv.style.top = '0';
  printDiv.style.width = '800px';
  document.body.appendChild(printDiv);
  
  // Use ReactDOM.render for client-side rendering
  import('react-dom/client').then(({ createRoot }) => {
    const root = createRoot(printDiv);
    root.render(renderFn());

    // Give the logo (and any other images) time to decode before printing.
    // waitForImages() is not reusable here: on the main document it would
    // wait for every image on the page, not just the print content.
    setTimeout(() => {
      window.print();
      root.unmount();
      document.body.removeChild(printDiv);
    }, 500);
  });
}

export async function printRequirement(item: RequirementItem, onPrintComplete?: () => void) {
  // Fetch company configuration first
  const companyConfig = await fetchCompanyConfig();

  if (item.type === 'MATERIAL') {
    await printMaterialRequisition({ item, companyConfig, onPrintComplete });
  } else {
    await printITRequirement({ item, companyConfig, onPrintComplete });
  }
}