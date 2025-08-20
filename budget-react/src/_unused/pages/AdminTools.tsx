import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  AdminPanelSettings,
  Dataset,
  Refresh,
  CloudSync,
  Warning,
  CheckCircle,
  Error,
  Storage,
  Speed,
  Delete,
  Restore,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { format } from 'date-fns';

interface SystemStatus {
  database: 'healthy' | 'warning' | 'error';
  api: 'healthy' | 'warning' | 'error';
  storage: 'healthy' | 'warning' | 'error';
  lastBackup: string;
  dataSize: string;
  userCount: number;
  transactionCount: number;
}

const AdminTools: React.FC = () => {
  const [seedDataLoading, setSeedDataLoading] = useState(false);
  const [rebuildLedgerLoading, setRebuildLedgerLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmMessage, setConfirmMessage] = useState('');
  const [auditResults, setAuditResults] = useState<any>(null);

  const auth = useSelector((state: RootState) => state.auth);

  // Mock system status
  const [systemStatus] = useState<SystemStatus>({
    database: 'healthy',
    api: 'healthy',
    storage: 'healthy',
    lastBackup: format(new Date(), 'MMM dd, yyyy HH:mm'),
    dataSize: '12.4 MB',
    userCount: 5,
    transactionCount: 1543,
  });

  // Mock audit log
  const [auditLog] = useState([
    {
      id: '1',
      timestamp: new Date().toISOString(),
      user: 'admin@example.com',
      action: 'CREATE_TRANSACTION',
      details: 'Created expense €250.00',
      status: 'success',
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      user: 'user@example.com',
      action: 'UPDATE_CATEGORY',
      details: 'Updated category "Operations"',
      status: 'success',
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      user: 'admin@example.com',
      action: 'DELETE_TRANSACTION',
      details: 'Deleted transaction #1234',
      status: 'warning',
    },
  ]);

  const handleSeedData = () => {
    setConfirmMessage('This will add sample data to your database. Are you sure?');
    setConfirmAction(() => async () => {
      setSeedDataLoading(true);
      try {
        // TODO: Call API to seed data
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('Seeding data...');
      } finally {
        setSeedDataLoading(false);
        setConfirmDialogOpen(false);
      }
    });
    setConfirmDialogOpen(true);
  };

  const handleRebuildLedger = () => {
    setConfirmMessage('This will rebuild all ledger entries. This may take several minutes. Continue?');
    setConfirmAction(() => async () => {
      setRebuildLedgerLoading(true);
      try {
        // TODO: Call API to rebuild ledger
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('Rebuilding ledger...');
      } finally {
        setRebuildLedgerLoading(false);
        setConfirmDialogOpen(false);
      }
    });
    setConfirmDialogOpen(true);
  };

  const handleBackupData = async () => {
    setBackupLoading(true);
    try {
      // TODO: Call API to create backup
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Creating backup...');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleAuditBalances = async () => {
    // TODO: Call API to audit balances
    setAuditResults({
      cashBalance: { expected: 5000, actual: 5000, match: true },
      bankBalance: { expected: 25000, actual: 24999.99, match: false },
      totalTransactions: 1543,
      discrepancies: 1,
      lastAudit: new Date().toISOString(),
    });
  };

  const handleResetData = () => {
    setConfirmMessage('WARNING: This will delete ALL data from the database. This action cannot be undone. Are you absolutely sure?');
    setConfirmAction(() => async () => {
      // TODO: Call API to reset data
      console.log('Resetting all data...');
      setConfirmDialogOpen(false);
    });
    setConfirmDialogOpen(true);
  };

  const getStatusIcon = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle color="success" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'error':
        return <Error color="error" />;
    }
  };

  const getActionStatusChip = (status: string) => {
    const color = status === 'success' ? 'success' : status === 'warning' ? 'warning' : 'error';
    return <Chip label={status} size="small" color={color} />;
  };

  if (!auth.isAuthenticated) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Please log in to access admin tools.
      </Alert>
    );
  }

  if (auth.user?.role !== 'admin') {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        You do not have permission to access admin tools.
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Admin Tools</Typography>
        <Chip
          icon={<AdminPanelSettings />}
          label="Admin Access"
          color="error"
          variant="outlined"
        />
      </Box>

      {/* System Status */}
      <Typography variant="h6" gutterBottom>
        System Status
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 4,
        }}
      >
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" variant="body2">
                  Database
                </Typography>
                <Typography variant="h6">
                  {systemStatus.database.toUpperCase()}
                </Typography>
              </Box>
              {getStatusIcon(systemStatus.database)}
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" variant="body2">
                  API Status
                </Typography>
                <Typography variant="h6">
                  {systemStatus.api.toUpperCase()}
                </Typography>
              </Box>
              {getStatusIcon(systemStatus.api)}
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" variant="body2">
                  Storage
                </Typography>
                <Typography variant="h6">
                  {systemStatus.dataSize}
                </Typography>
              </Box>
              <Storage color="primary" />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" variant="body2">
                  Last Backup
                </Typography>
                <Typography variant="body1">
                  {systemStatus.lastBackup}
                </Typography>
              </Box>
              <CloudSync color="primary" />
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Quick Actions */}
      <Typography variant="h6" gutterBottom>
        Quick Actions
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 2,
          mb: 4,
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Seed Sample Data
            </Typography>
            <Typography color="textSecondary" variant="body2" paragraph>
              Add sample transactions and categories for testing
            </Typography>
          </CardContent>
          <CardActions>
            <Button
              variant="contained"
              startIcon={seedDataLoading ? <CircularProgress size={20} /> : <Dataset />}
              onClick={handleSeedData}
              disabled={seedDataLoading}
            >
              {seedDataLoading ? 'Seeding...' : 'Seed Data'}
            </Button>
          </CardActions>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Rebuild Ledger
            </Typography>
            <Typography color="textSecondary" variant="body2" paragraph>
              Recalculate all ledger entries and balances
            </Typography>
          </CardContent>
          <CardActions>
            <Button
              variant="contained"
              startIcon={rebuildLedgerLoading ? <CircularProgress size={20} /> : <Refresh />}
              onClick={handleRebuildLedger}
              disabled={rebuildLedgerLoading}
            >
              {rebuildLedgerLoading ? 'Rebuilding...' : 'Rebuild'}
            </Button>
          </CardActions>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Backup Data
            </Typography>
            <Typography color="textSecondary" variant="body2" paragraph>
              Create a backup of all data
            </Typography>
          </CardContent>
          <CardActions>
            <Button
              variant="contained"
              startIcon={backupLoading ? <CircularProgress size={20} /> : <CloudSync />}
              onClick={handleBackupData}
              disabled={backupLoading}
            >
              {backupLoading ? 'Backing up...' : 'Backup Now'}
            </Button>
          </CardActions>
        </Card>
      </Box>

      {/* Data Integrity */}
      <Typography variant="h6" gutterBottom>
        Data Integrity
      </Typography>
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="subtitle1">
              Balance Audit
            </Typography>
            <Button
              variant="outlined"
              startIcon={<Speed />}
              onClick={handleAuditBalances}
            >
              Run Audit
            </Button>
          </Box>

          {auditResults && (
            <Box>
              <Alert
                severity={auditResults.discrepancies > 0 ? 'warning' : 'success'}
                sx={{ mb: 2 }}
              >
                {auditResults.discrepancies > 0
                  ? `Found ${auditResults.discrepancies} discrepancy(ies) in balance calculations`
                  : 'All balances are correctly calculated'}
              </Alert>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Account</TableCell>
                      <TableCell align="right">Expected</TableCell>
                      <TableCell align="right">Actual</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Cash</TableCell>
                      <TableCell align="right">€{auditResults.cashBalance.expected}</TableCell>
                      <TableCell align="right">€{auditResults.cashBalance.actual}</TableCell>
                      <TableCell align="center">
                        {auditResults.cashBalance.match ? (
                          <CheckCircle color="success" fontSize="small" />
                        ) : (
                          <Error color="error" fontSize="small" />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Bank</TableCell>
                      <TableCell align="right">€{auditResults.bankBalance.expected}</TableCell>
                      <TableCell align="right">€{auditResults.bankBalance.actual}</TableCell>
                      <TableCell align="center">
                        {auditResults.bankBalance.match ? (
                          <CheckCircle color="success" fontSize="small" />
                        ) : (
                          <Error color="error" fontSize="small" />
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
                Last audit: {format(new Date(auditResults.lastAudit), 'MMM dd, yyyy HH:mm:ss')}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Typography variant="h6" gutterBottom>
        Recent Activity
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Details</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {auditLog.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  {format(new Date(entry.timestamp), 'MMM dd, HH:mm:ss')}
                </TableCell>
                <TableCell>{entry.user}</TableCell>
                <TableCell>{entry.action}</TableCell>
                <TableCell>{entry.details}</TableCell>
                <TableCell>{getActionStatusChip(entry.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Danger Zone */}
      <Typography variant="h6" gutterBottom color="error">
        Danger Zone
      </Typography>
      <Card sx={{ borderColor: 'error.main', borderWidth: 2, borderStyle: 'solid' }}>
        <CardContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            These actions are irreversible and will permanently affect your data.
          </Alert>

          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              onClick={handleResetData}
            >
              Reset All Data
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Restore />}
              disabled
            >
              Restore from Backup
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <Typography>{confirmMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmAction} color="primary" variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminTools;