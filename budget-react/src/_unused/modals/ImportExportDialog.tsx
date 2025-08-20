import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tab,
  Tabs,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  IconButton,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  CloudUpload,
  CloudDownload,
  FileUpload,
  FileDownload,
  CheckCircle,
  Error as ErrorIcon,
  Info,
  Close,
  Description,
  TableChart,
  Category,
  AttachMoney,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { 
  useGetTransactionsQuery,
  useGetCategoriesQuery,
  useGetBudgetQuery,
  useCreateTransactionMutation,
  useCreateCategoryMutation,
} from '../../store/api/apiSlice';
import { exportToCSV, exportToExcel } from '../../utils/exportUtils';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
};

interface ImportExportDialogProps {
  open: boolean;
  onClose: () => void;
}

const ImportExportDialog: React.FC<ImportExportDialogProps> = ({ open, onClose }) => {
  const [tabValue, setTabValue] = useState(0);
  const [exportType, setExportType] = useState('transactions');
  const [exportFormat, setExportFormat] = useState('csv');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch data
  const { data: transactions } = useGetTransactionsQuery({ limit: 1000 });
  const { data: categories } = useGetCategoriesQuery({});
  const { data: budget } = useGetBudgetQuery({});
  const [createTransaction] = useCreateTransactionMutation();
  const [createCategory] = useCreateCategoryMutation();

  // Handle export
  const handleExport = () => {
    let dataToExport: any[] = [];
    let filename = '';

    switch (exportType) {
      case 'transactions':
        dataToExport = transactions?.transactions?.map((t: any) => ({
          Date: format(new Date(t.date), 'yyyy-MM-dd'),
          Description: t.description,
          Category: t.category,
          Subcategory: t.subcategory || '',
          Type: t.type,
          Amount: Math.abs(t.amount),
          'Payment Method': t.payment_method || 'Cash',
          Notes: t.notes || '',
          Tags: (t.tags || []).join(', '),
        })) || [];
        filename = `transactions_${format(new Date(), 'yyyyMMdd')}`;
        break;

      case 'categories':
        dataToExport = categories?.data?.map((c: any) => ({
          Name: c.name,
          Code: c.code || '',
          'Budget Amount': c.budget_amount || 0,
          Subcategories: (c.subcategories || []).join(', '),
        })) || [];
        filename = `categories_${format(new Date(), 'yyyyMMdd')}`;
        break;

      case 'budget':
        dataToExport = Object.entries(budget?.data || {}).map(([category, data]: any) => ({
          Category: category,
          'Budget Amount': data.amount || 0,
          'Spent Amount': data.spent || 0,
          'Remaining': (data.amount || 0) - (data.spent || 0),
          'Percentage Used': data.amount > 0 ? ((data.spent / data.amount) * 100).toFixed(1) + '%' : '0%',
        }));
        filename = `budget_${format(new Date(), 'yyyyMMdd')}`;
        break;

      case 'all':
        // Create a comprehensive export
        const allData = {
          exportDate: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
          transactions: transactions?.transactions || [],
          categories: categories?.data || [],
          budget: budget?.data || {},
        };
        // For 'all' export, we'll use JSON format
        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `budget_backup_${format(new Date(), 'yyyyMMdd')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return;
    }

    // Export based on format
    if (exportFormat === 'csv') {
      exportToCSV(dataToExport, filename);
    } else {
      exportToExcel(dataToExport, filename);
    }
  };

  // Handle import
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        setImporting(true);
        setImportProgress(0);
        setImportResults(null);

        const content = e.target?.result as string;
        let data: any;

        // Parse based on file type
        if (file.name.endsWith('.json')) {
          data = JSON.parse(content);
          await handleJSONImport(data);
        } else if (file.name.endsWith('.csv')) {
          data = parseCSV(content);
          await handleCSVImport(data);
        } else {
          throw new Error('Unsupported file format');
        }
      } catch (error) {
        console.error('Import failed:', error);
        setImportResults({
          success: false,
          message: 'Import failed: ' + (error as Error).message,
        });
      } finally {
        setImporting(false);
        setImportProgress(100);
      }
    };
    reader.readAsText(file);
  };

  const parseCSV = (content: string): any[] => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index];
      });
      return obj;
    });
  };

  const handleJSONImport = async (data: any) => {
    const results = {
      transactions: { success: 0, failed: 0 },
      categories: { success: 0, failed: 0 },
    };

    // Import categories first
    if (data.categories) {
      for (const category of data.categories) {
        try {
          await createCategory(category).unwrap();
          results.categories.success++;
        } catch (error) {
          results.categories.failed++;
        }
        setImportProgress((prev) => prev + (50 / data.categories.length));
      }
    }

    // Import transactions
    if (data.transactions) {
      for (const transaction of data.transactions) {
        try {
          await createTransaction({
            ...transaction,
            type: 'expense',
            amount: -Math.abs(transaction.amount),
          }).unwrap();
          results.transactions.success++;
        } catch (error) {
          results.transactions.failed++;
        }
        setImportProgress((prev) => prev + (50 / data.transactions.length));
      }
    }

    setImportResults({
      success: true,
      message: `Import completed: ${results.transactions.success} transactions, ${results.categories.success} categories imported successfully.`,
      details: results,
    });
  };

  const handleCSVImport = async (data: any[]) => {
    const results = { success: 0, failed: 0 };

    for (const row of data) {
      try {
        // Assuming CSV contains transaction data
        await createTransaction({
          date: row.Date || new Date().toISOString(),
          description: row.Description || '',
          amount: -Math.abs(parseFloat(row.Amount) || 0),
          category: row.Category || 'Uncategorized',
          subcategory: row.Subcategory || '',
          payment_method: row['Payment Method'] || 'Cash',
          notes: row.Notes || '',
          type: 'expense',
        }).unwrap();
        results.success++;
      } catch (error) {
        results.failed++;
      }
      setImportProgress((prev) => prev + (100 / data.length));
    }

    setImportResults({
      success: true,
      message: `Import completed: ${results.success} records imported, ${results.failed} failed.`,
      details: results,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Import / Export Data</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Export Data" icon={<CloudDownload />} iconPosition="start" />
          <Tab label="Import Data" icon={<CloudUpload />} iconPosition="start" />
        </Tabs>

        {/* Export Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info" icon={<Info />}>
              Export your data for backup or analysis. Choose the data type and format below.
            </Alert>

            <FormControl fullWidth>
              <InputLabel>Data Type</InputLabel>
              <Select
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
                label="Data Type"
              >
                <MenuItem value="transactions">
                  <ListItemIcon><AttachMoney fontSize="small" /></ListItemIcon>
                  Transactions
                </MenuItem>
                <MenuItem value="categories">
                  <ListItemIcon><Category fontSize="small" /></ListItemIcon>
                  Categories
                </MenuItem>
                <MenuItem value="budget">
                  <ListItemIcon><TableChart fontSize="small" /></ListItemIcon>
                  Budget
                </MenuItem>
                <MenuItem value="all">
                  <ListItemIcon><Description fontSize="small" /></ListItemIcon>
                  All Data (Backup)
                </MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Format</InputLabel>
              <Select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                label="Format"
                disabled={exportType === 'all'}
              >
                <MenuItem value="csv">CSV (Excel Compatible)</MenuItem>
                <MenuItem value="excel">Excel</MenuItem>
              </Select>
            </FormControl>

            {exportType === 'all' && (
              <Alert severity="warning">
                Full backup will be exported as JSON format for complete data preservation.
              </Alert>
            )}

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Export Preview
              </Typography>
              <List dense>
                {exportType === 'transactions' && (
                  <ListItem>
                    <ListItemIcon><CheckCircle color="success" fontSize="small" /></ListItemIcon>
                    <ListItemText 
                      primary={`${transactions?.transactions?.length || 0} transactions`}
                      secondary="All transaction records with details"
                    />
                  </ListItem>
                )}
                {exportType === 'categories' && (
                  <ListItem>
                    <ListItemIcon><CheckCircle color="success" fontSize="small" /></ListItemIcon>
                    <ListItemText 
                      primary={`${categories?.data?.length || 0} categories`}
                      secondary="Category names, codes, and subcategories"
                    />
                  </ListItem>
                )}
                {exportType === 'budget' && (
                  <ListItem>
                    <ListItemIcon><CheckCircle color="success" fontSize="small" /></ListItemIcon>
                    <ListItemText 
                      primary={`${Object.keys(budget?.data || {}).length} budget entries`}
                      secondary="Budget amounts and spending data"
                    />
                  </ListItem>
                )}
                {exportType === 'all' && (
                  <>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="success" fontSize="small" /></ListItemIcon>
                      <ListItemText primary="Complete database backup" />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        inset
                        secondary={`${transactions?.transactions?.length || 0} transactions, ${categories?.data?.length || 0} categories, ${Object.keys(budget?.data || {}).length} budget entries`}
                      />
                    </ListItem>
                  </>
                )}
              </List>
            </Paper>

            <Button
              variant="contained"
              startIcon={<FileDownload />}
              onClick={handleExport}
              size="large"
              fullWidth
            >
              Export {exportType === 'all' ? 'All Data' : exportType}
            </Button>
          </Box>
        </TabPanel>

        {/* Import Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="warning" icon={<Info />}>
              Import data from CSV or JSON files. Make sure your file follows the correct format.
            </Alert>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Supported Formats
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon><Description fontSize="small" /></ListItemIcon>
                  <ListItemText 
                    primary="CSV Files"
                    secondary="For transaction data (Date, Description, Amount, Category, etc.)"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><Description fontSize="small" /></ListItemIcon>
                  <ListItemText 
                    primary="JSON Files"
                    secondary="For complete backup restoration"
                  />
                </ListItem>
              </List>
            </Paper>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />

            <Button
              variant="outlined"
              startIcon={<FileUpload />}
              onClick={() => fileInputRef.current?.click()}
              size="large"
              fullWidth
              disabled={importing}
            >
              Select File to Import
            </Button>

            {importing && (
              <Box>
                <Typography variant="body2" gutterBottom>
                  Importing data...
                </Typography>
                <LinearProgress variant="determinate" value={importProgress} />
              </Box>
            )}

            {importResults && (
              <Alert 
                severity={importResults.success ? "success" : "error"}
                icon={importResults.success ? <CheckCircle /> : <ErrorIcon />}
              >
                <Typography variant="body2">{importResults.message}</Typography>
                {importResults.details && (
                  <Typography variant="caption" component="div" sx={{ mt: 1 }}>
                    {importResults.details.transactions && 
                      `Transactions: ${importResults.details.transactions.success} success, ${importResults.details.transactions.failed} failed`}
                    {importResults.details.categories && 
                      ` | Categories: ${importResults.details.categories.success} success, ${importResults.details.categories.failed} failed`}
                  </Typography>
                )}
              </Alert>
            )}

            <Divider />

            <Typography variant="caption" color="textSecondary">
              <strong>CSV Format Example:</strong><br />
              Date,Description,Category,Amount,Payment Method<br />
              2024-01-01,Office Supplies,Operations,50.00,Card<br />
              2024-01-02,Travel Expense,Programs,120.00,Cash
            </Typography>
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportExportDialog;