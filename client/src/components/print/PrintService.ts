import React from 'react';
import ReactDOMServer from 'react-dom/server';
import MaterialRequisitionPrint from './MaterialRequisitionPrint';
import ITRequirementPrint from './ITRequirementPrint';
import { RequirementItem } from '@/types/requirements';

interface PrintServiceOptions {
  item: RequirementItem;
  onPrintComplete?: () => void;
}

export function printMaterialRequisition({ item, onPrintComplete }: PrintServiceOptions) {
  // Create a new window for printing
  const printWindow = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes');
  
  if (!printWindow) {
    console.error('Failed to open print window - popup blocked?');
    // Fallback to direct print
    printDirectly(() => React.createElement(MaterialRequisitionPrint, { item }));
    onPrintComplete?.();
    return;
  }

  // Render the component to HTML string
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(MaterialRequisitionPrint, { 
      item,
      onPrintReady: () => {
        printWindow.focus();
        printWindow.print();
        // Close window after print dialog
        printWindow.onafterprint = () => {
          printWindow.close();
          onPrintComplete?.();
        };
      }
    })
  );

  // Write to the new window
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
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

export function printITRequirement({ item, onPrintComplete }: PrintServiceOptions) {
  const printWindow = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes');
  
  if (!printWindow) {
    console.error('Failed to open print window - popup blocked?');
    printDirectly(() => React.createElement(ITRequirementPrint, { item }));
    onPrintComplete?.();
    return;
  }

  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ITRequirementPrint, { 
      item,
      onPrintReady: () => {
        printWindow.focus();
        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
          onPrintComplete?.();
        };
      }
    })
  );

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
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

export function printRequirement(item: RequirementItem, onPrintComplete?: () => void) {
  if (item.type === 'MATERIAL') {
    printMaterialRequisition({ item, onPrintComplete });
  } else {
    printITRequirement({ item, onPrintComplete });
  }
}