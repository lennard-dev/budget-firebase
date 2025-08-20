import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  subcategory?: string;
  amount: number;
  type: string;
  payment_method?: string;
}

export const exportToCSV = (
  data: Transaction[],
  filename: string = 'transactions'
) => {
  // Define CSV headers
  const headers = [
    'Date',
    'Description',
    'Category',
    'Subcategory',
    'Type',
    'Payment Method',
    'Amount'
  ];

  // Convert data to CSV format
  const csvContent = [
    headers.join(','),
    ...data.map(row => [
      format(new Date(row.date), 'yyyy-MM-dd'),
      `"${row.description.replace(/"/g, '""')}"`,
      row.category || '',
      row.subcategory || '',
      row.type,
      row.payment_method || '',
      Math.abs(row.amount).toFixed(2)
    ].join(','))
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${filename}_${format(new Date(), 'yyyyMMdd')}.csv`);
};

export const exportToPDF = (
  data: Transaction[],
  title: string = 'Transaction Report',
  subtitle?: string
) => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text(title, 14, 20);
  
  // Add subtitle if provided
  if (subtitle) {
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 30);
  }
  
  // Add generation date
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, subtitle ? 38 : 30);
  
  // Prepare table data
  const tableData = data.map(row => [
    format(new Date(row.date), 'MM/dd/yyyy'),
    row.description,
    row.category || '-',
    row.type,
    row.payment_method || '-',
    `€${Math.abs(row.amount).toLocaleString()}`
  ]);
  
  // Add table
  doc.autoTable({
    head: [['Date', 'Description', 'Category', 'Type', 'Payment', 'Amount']],
    body: tableData,
    startY: subtitle ? 45 : 35,
    styles: {
      fontSize: 9,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [102, 126, 234],
      textColor: 255,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 60 },
      2: { cellWidth: 30 },
      3: { cellWidth: 20 },
      4: { cellWidth: 25 },
      5: { cellWidth: 25, halign: 'right' },
    },
  });
  
  // Add summary
  const totalExpenses = data
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const totalIncome = data
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const finalY = (doc as any).lastAutoTable.finalY || 50;
  
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`Total Income: €${totalIncome.toLocaleString()}`, 14, finalY + 10);
  doc.text(`Total Expenses: €${totalExpenses.toLocaleString()}`, 14, finalY + 17);
  doc.text(`Net: €${(totalIncome - totalExpenses).toLocaleString()}`, 14, finalY + 24);
  
  // Save the PDF
  doc.save(`${title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};

export const exportChartToPNG = (_chartElement: HTMLElement, _filename: string = 'chart') => {
  // This would use html2canvas or similar library
  // For now, we'll use the browser's built-in functionality
  console.log('Chart export not yet implemented');
};

// Export to Excel (using CSV format that Excel can open)
export const exportToExcel = (data: any[], filename: string) => {
  // For now, we'll use CSV format which Excel can open
  exportToCSV(data, filename);
};