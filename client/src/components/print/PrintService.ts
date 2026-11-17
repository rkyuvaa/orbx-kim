import React from 'react';
import ReactDOMServer from 'react-dom/server';
import MaterialRequisitionPrint from './MaterialRequisitionPrint';
import ITRequirementPrint from './ITRequirementPrint';
import { RequirementItem } from '@/types/requirements';

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

// Fetch company configuration from the API
async function fetchCompanyConfig(): Promise<CompanyConfig> {
  try {
    const response = await fetch('/api/v1/app-data/company_configuration');
    if (!response.ok) {
      console.warn('Failed to fetch company configuration');
      return {};
    }
    const data = await response.json();
    return (data.value as CompanyConfig) || {};
  } catch (error) {
    console.warn('Error fetching company configuration:', error);
    return {};
  }
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
            margin: 15mm;
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

  // Auto-trigger print
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 100);

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
            margin: 15mm;
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

  // Auto-trigger print
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 100);

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
    
    setTimeout(() => {
      window.print();
      root.unmount();
      document.body.removeChild(printDiv);
    }, 100);
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