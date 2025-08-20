import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  IconButton,
  Typography,
} from '@mui/material';
import { Close, Download, Print } from '@mui/icons-material';

interface ReceiptViewerProps {
  open: boolean;
  onClose: () => void;
  receiptUrl: string | null;
}

const ReceiptViewer: React.FC<ReceiptViewerProps> = ({
  open,
  onClose,
  receiptUrl,
}) => {
  const handleDownload = () => {
    if (receiptUrl) {
      const link = document.createElement('a');
      link.href = receiptUrl;
      link.download = `receipt_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePrint = () => {
    if (receiptUrl) {
      const printWindow = window.open(receiptUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
  };

  const isPDF = receiptUrl?.toLowerCase().endsWith('.pdf');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Receipt</Typography>
          <Box display="flex" gap={1}>
            <IconButton onClick={handleDownload} size="small">
              <Download />
            </IconButton>
            <IconButton onClick={handlePrint} size="small">
              <Print />
            </IconButton>
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box
          sx={{
            width: '100%',
            height: '60vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            bgcolor: 'grey.100',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          {receiptUrl ? (
            isPDF ? (
              <iframe
                src={receiptUrl}
                title="Receipt PDF"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
              />
            ) : (
              <img
                src={receiptUrl}
                alt="Receipt"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            )
          ) : (
            <Typography color="textSecondary">
              No receipt available
            </Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReceiptViewer;