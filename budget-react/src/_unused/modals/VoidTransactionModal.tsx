import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Paper,
  Divider,
} from '@mui/material';
import {
  Warning,
  Delete,
  Block,
  Info,
  Lock,
} from '@mui/icons-material';

interface VoidTransactionModalProps {
  open: boolean;
  onClose: () => void;
  transaction: any;
  onVoid: (reason: string, notes: string) => void;
  onDelete: () => void;
}

const VoidTransactionModal: React.FC<VoidTransactionModalProps> = ({
  open,
  onClose,
  transaction,
  onVoid,
  onDelete,
}) => {
  const [voidReason, setVoidReason] = useState('');
  const [voidNotes, setVoidNotes] = useState('');
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);

  useEffect(() => {
    if (!open) {
      setVoidReason('');
      setVoidNotes('');
      setShowDeleteWarning(false);
    }
  }, [open]);

  const handleVoid = () => {
    if (!voidReason) {
      alert('Please select a reason for voiding');
      return;
    }
    onVoid(voidReason, voidNotes);
  };

  const handleDeleteInstead = () => {
    setShowDeleteWarning(true);
  };

  const confirmDelete = () => {
    onDelete();
  };

  if (!transaction) return null;

  const amount = Math.abs(transaction.amount || 0);
  const isReconciled = transaction.reconciled || false;

  return (
    <>
      <Dialog open={open && !showDeleteWarning} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Warning sx={{ color: 'warning.main' }} />
            <Typography variant="h6">Void Transaction</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Voiding will zero out the amount but keep the record for audit purposes.
          </Alert>

          {/* Transaction Details */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom fontWeight="bold">
              Transaction Details:
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Box>
                <Typography variant="body2" color="textSecondary">Date:</Typography>
                <Typography variant="body2">{transaction.date}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">Amount:</Typography>
                <Typography variant="body2" fontWeight="bold">€{amount.toFixed(2)}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">Category:</Typography>
                <Typography variant="body2">{transaction.category}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">Payment:</Typography>
                <Typography variant="body2">{transaction.payment_method || 'Cash'}</Typography>
              </Box>
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Typography variant="body2" color="textSecondary">Description:</Typography>
                <Typography variant="body2">{transaction.description || 'N/A'}</Typography>
              </Box>
            </Box>
          </Paper>

          {/* Void vs Delete Explanation */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom fontWeight="bold">
              Void vs Delete:
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 1.5, 
                  backgroundColor: 'warning.light',
                  borderColor: 'warning.main'
                }}
              >
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Block fontSize="small" />
                  <Typography variant="body2" fontWeight="bold">Void</Typography>
                </Box>
                <Typography variant="caption" component="div">• Keeps transaction record</Typography>
                <Typography variant="caption" component="div">• Maintains audit trail</Typography>
                <Typography variant="caption" component="div">• Shows as voided</Typography>
                <Typography variant="caption" component="div">• Can be unvoided</Typography>
              </Paper>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 1.5,
                  backgroundColor: 'error.light',
                  borderColor: 'error.main'
                }}
              >
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Delete fontSize="small" />
                  <Typography variant="body2" fontWeight="bold">Delete</Typography>
                </Box>
                <Typography variant="caption" component="div">• Removes record</Typography>
                <Typography variant="caption" component="div">• Cannot be recovered</Typography>
                <Typography variant="caption" component="div">• For data errors</Typography>
                <Typography variant="caption" component="div">• Recalculates balances</Typography>
              </Paper>
            </Box>
          </Box>

          {/* Void Reason */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Reason for Voiding *</InputLabel>
            <Select
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              label="Reason for Voiding *"
              required
            >
              <MenuItem value="">Select a reason...</MenuItem>
              <MenuItem value="cancelled">Transaction Cancelled</MenuItem>
              <MenuItem value="duplicate">Duplicate Entry</MenuItem>
              <MenuItem value="error">Data Entry Error</MenuItem>
              <MenuItem value="refunded">Refunded by Vendor</MenuItem>
              <MenuItem value="disputed">Disputed Charge</MenuItem>
              <MenuItem value="other">Other (specify below)</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Additional Notes"
            value={voidNotes}
            onChange={(e) => setVoidNotes(e.target.value)}
            placeholder="Additional details..."
            sx={{ mb: 2 }}
          />

          {/* Balance Impact Preview */}
          <Paper sx={{ p: 2, backgroundColor: 'info.light' }}>
            <Typography variant="subtitle2" gutterBottom fontWeight="bold">
              Balance Impact:
            </Typography>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2">Current Amount:</Typography>
              <Typography variant="body2" fontWeight="bold">€{amount.toFixed(2)}</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2">After Voiding:</Typography>
              <Typography variant="body2" fontWeight="bold">€0.00</Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2">
                {transaction.payment_method === 'Cash' ? 'Cash' : 'Bank'} Balance Change:
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="success.main">
                +€{amount.toFixed(2)}
              </Typography>
            </Box>
            <Alert severity="info" sx={{ mt: 1 }} icon={<Info fontSize="small" />}>
              <Typography variant="caption">
                Voided transaction will remain in records but with €0.00 amount.
              </Typography>
            </Alert>
          </Paper>

          {/* Reconciliation Warning */}
          {isReconciled && (
            <Alert severity="error" sx={{ mt: 2 }} icon={<Lock />}>
              <Typography variant="body2" fontWeight="bold">Reconciliation Warning:</Typography>
              <Typography variant="caption">
                This transaction is reconciled. Voiding will break the reconciliation.
              </Typography>
            </Alert>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteInstead} 
            color="error"
            startIcon={<Delete />}
          >
            Delete Instead
          </Button>
          <Button 
            onClick={handleVoid} 
            variant="contained" 
            color="warning"
            startIcon={<Block />}
            disabled={!voidReason}
          >
            Void Transaction
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteWarning} onClose={() => setShowDeleteWarning(false)} maxWidth="xs">
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Delete sx={{ color: 'error.main' }} />
            <Typography variant="h6">Confirm Delete</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            This action cannot be undone!
          </Alert>
          <Typography variant="body2">
            Are you sure you want to permanently delete this transaction? 
            This will remove it completely from the records and recalculate all balances.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteWarning(false)}>
            Cancel
          </Button>
          <Button 
            onClick={confirmDelete} 
            variant="contained" 
            color="error"
            startIcon={<Delete />}
          >
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default VoidTransactionModal;