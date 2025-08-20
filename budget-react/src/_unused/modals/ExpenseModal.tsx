import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  IconButton,
  Typography,
  Alert,
  Autocomplete,
  Chip,
} from '@mui/material';
import {
  AttachMoney,
  CalendarToday,
  Description,
  Category,
  Close,
  CloudUpload,
  AttachFile,
  Delete as DeleteIcon,
  Visibility,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import {
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useGetCategoriesQuery,
} from '../../store/api/apiSlice';

interface ExpenseModalProps {
  open: boolean;
  onClose: () => void;
  expense?: any;
  onSave: () => void;
}

const ExpenseModal: React.FC<ExpenseModalProps> = ({
  open,
  onClose,
  expense,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    date: new Date(),
    description: '',
    amount: '',
    category: '',
    subcategory: '',
    payment_method: 'Cash',
    receipt_url: '',
    notes: '',
    tags: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { data: categories } = useGetCategoriesQuery({});
  const [createTransaction, { isLoading: isCreating }] = useCreateTransactionMutation();
  const [updateTransaction, { isLoading: isUpdating }] = useUpdateTransactionMutation();

  useEffect(() => {
    if (expense) {
      setFormData({
        date: new Date(expense.date),
        description: expense.description || '',
        amount: Math.abs(expense.amount).toString(),
        category: expense.category || '',
        subcategory: expense.subcategory || '',
        payment_method: expense.payment_method || 'Cash',
        receipt_url: expense.receipt_url || '',
        notes: expense.notes || '',
        tags: expense.tags || [],
      });
    } else {
      setFormData({
        date: new Date(),
        description: '',
        amount: '',
        category: '',
        subcategory: '',
        payment_method: 'Cash',
        receipt_url: '',
        notes: '',
        tags: [],
      });
    }
    setErrors({});
  }, [expense, open]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Valid amount is required';
    }
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const transactionData = {
      type: 'expense',
      date: format(formData.date, 'yyyy-MM-dd'),
      timestamp: formData.date.toISOString(),
      description: formData.description,
      amount: -Math.abs(parseFloat(formData.amount)), // Negative for expenses
      category: formData.category,
      subcategory: formData.subcategory || undefined,
      payment_method: formData.payment_method,
      receipt_url: formData.receipt_url || undefined,
      notes: formData.notes || undefined,
      tags: formData.tags.length > 0 ? formData.tags : undefined,
      account: formData.payment_method === 'Cash' ? 'cash' : 'bank',
    };

    try {
      if (expense) {
        await updateTransaction({
          id: expense.id,
          ...transactionData,
        }).unwrap();
      } else {
        await createTransaction(transactionData).unwrap();
      }
      onSave();
    } catch (error) {
      console.error('Failed to save expense:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors({ ...errors, receipt: 'File size must be less than 5MB' });
      return;
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setErrors({ ...errors, receipt: 'Only JPG, PNG, and PDF files are allowed' });
      return;
    }

    setSelectedFile(file);
    setUploading(true);
    setUploadProgress(0);
    
    try {
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 25) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // In a real app, you would upload to Firebase Storage or similar
      // For now, we'll create a local URL
      const url = URL.createObjectURL(file);
      setFormData({ ...formData, receipt_url: url });
      setErrors({ ...errors, receipt: '' });
    } catch (error) {
      console.error('Failed to upload receipt:', error);
      setErrors({ ...errors, receipt: 'Failed to upload receipt' });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveReceipt = () => {
    setSelectedFile(null);
    setFormData({ ...formData, receipt_url: '' });
  };

  const getSubcategories = () => {
    const category = categories?.data?.find((cat: any) => cat.name === formData.category);
    const subs = category?.subcategories || [];
    // Ensure subcategories are in the correct format (strings or objects with name)
    return subs.map((sub: any) => {
      if (typeof sub === 'string') {
        return sub;
      } else if (sub && typeof sub === 'object' && sub.name) {
        return sub.name;
      }
      return 'Unknown';
    });
  };

  const commonTags = ['Business', 'Personal', 'Tax Deductible', 'Recurring', 'One-time'];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {expense ? 'Edit Expense' : 'Add New Expense'}
            </Typography>
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {/* Date */}
            <DatePicker
              label="Date"
              value={formData.date}
              onChange={(newDate) => setFormData({ ...formData, date: newDate || new Date() })}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors.date,
                  helperText: errors.date,
                  InputProps: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarToday />
                      </InputAdornment>
                    ),
                  },
                },
              }}
            />

            {/* Description */}
            <TextField
              label="Description"
              fullWidth
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              error={!!errors.description}
              helperText={errors.description}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Description />
                  </InputAdornment>
                ),
              }}
            />

            {/* Amount */}
            <TextField
              label="Amount"
              type="number"
              fullWidth
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              error={!!errors.amount}
              helperText={errors.amount}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <AttachMoney />
                  </InputAdornment>
                ),
              }}
            />

            {/* Category */}
            <FormControl fullWidth error={!!errors.category}>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value, subcategory: '' })}
                label="Category"
                startAdornment={
                  <InputAdornment position="start">
                    <Category />
                  </InputAdornment>
                }
              >
                {categories?.data?.map((cat: any) => (
                  <MenuItem key={cat.id} value={cat.name}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
              {errors.category && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                  {errors.category}
                </Typography>
              )}
            </FormControl>

            {/* Subcategory */}
            {getSubcategories().length > 0 && (
              <FormControl fullWidth>
                <InputLabel>Subcategory</InputLabel>
                <Select
                  value={formData.subcategory}
                  onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  label="Subcategory"
                >
                  <MenuItem value="">None</MenuItem>
                  {getSubcategories().map((sub: string, index: number) => (
                    <MenuItem key={index} value={sub}>
                      {sub}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Payment Method */}
            <FormControl fullWidth>
              <InputLabel>Payment Method</InputLabel>
              <Select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                label="Payment Method"
              >
                <MenuItem value="Cash">Cash</MenuItem>
                <MenuItem value="Card">Card</MenuItem>
                <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
              </Select>
            </FormControl>

            {/* Tags */}
            <Autocomplete
              multiple
              options={commonTags}
              value={formData.tags}
              onChange={(_, newValue) => setFormData({ ...formData, tags: newValue })}
              freeSolo
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={option}
                    size="small"
                    {...getTagProps({ index })}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tags"
                  placeholder="Add tags..."
                  helperText="Press Enter to add custom tags"
                />
              )}
            />

            {/* Notes */}
            <TextField
              label="Notes (Optional)"
              multiline
              rows={2}
              fullWidth
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />

            {/* Receipt Upload */}
            <Box>
              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUpload />}
                disabled={uploading}
                fullWidth
              >
                {uploading ? `Uploading... ${uploadProgress}%` : 'Upload Receipt'}
                <input
                  type="file"
                  hidden
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                />
              </Button>
              {formData.receipt_url && (
                <Box display="flex" alignItems="center" gap={1} mt={1}>
                  <AttachFile color="success" />
                  <Typography variant="body2" color="success.main">
                    {selectedFile?.name || 'Receipt attached'}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => window.open(formData.receipt_url, '_blank')}
                    title="View receipt"
                  >
                    <Visibility fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={handleRemoveReceipt}
                    title="Remove receipt"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
              {errors.receipt && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {errors.receipt}
                </Alert>
              )}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={isCreating || isUpdating}
          >
            {isCreating || isUpdating ? 'Saving...' : expense ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default ExpenseModal;