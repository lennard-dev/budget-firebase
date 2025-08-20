import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Switch,
  Divider,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Card,
  CardContent,
  Avatar,
} from '@mui/material';
import {
  Edit,
  Delete,
  Add,
  Save,
  Category,
  Person,
  Notifications,
  Security,
  CloudUpload,
  CloudDownload,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import {
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} from '../store/api/apiSlice';
import ImportExportDialog from '../components/modals/ImportExportDialog';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

interface CategoryModalProps {
  open: boolean;
  onClose: () => void;
  category?: any;
  onSave: (data: any) => void;
}

const CategoryModal: React.FC<CategoryModalProps> = ({ open, onClose, category, onSave }) => {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    code: category?.code || '',
    description: category?.description || '',
    color: category?.color || '#1976d2',
    subcategories: category?.subcategories || [],
  });
  const [newSubcategory, setNewSubcategory] = useState('');

  const handleAddSubcategory = () => {
    if (newSubcategory.trim()) {
      setFormData({
        ...formData,
        subcategories: [...formData.subcategories, { name: newSubcategory, id: Date.now().toString() }],
      });
      setNewSubcategory('');
    }
  };

  const handleRemoveSubcategory = (index: number) => {
    setFormData({
      ...formData,
      subcategories: formData.subcategories.filter((_: any, i: number) => i !== index),
    });
  };

  const handleSubmit = () => {
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{category ? 'Edit Category' : 'Add Category'}</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={2}>
          <TextField
            label="Category Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            fullWidth
            required
          />
          
          <TextField
            label="Category Code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            fullWidth
            helperText="Short code for the category (e.g., OPS, ADM)"
            inputProps={{ maxLength: 5 }}
          />

          <TextField
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            fullWidth
            multiline
            rows={2}
          />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Color
            </Typography>
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              style={{ width: '100%', height: 40 }}
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Subcategories
            </Typography>
            <Box display="flex" gap={1} mb={1}>
              <TextField
                size="small"
                placeholder="Add subcategory"
                value={newSubcategory}
                onChange={(e) => setNewSubcategory(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddSubcategory()}
                fullWidth
              />
              <Button onClick={handleAddSubcategory} variant="outlined" size="small">
                Add
              </Button>
            </Box>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {formData.subcategories.map((sub: any, index: number) => (
                <Chip
                  key={sub.id}
                  label={sub.name}
                  onDelete={() => handleRemoveSubcategory(index)}
                  size="small"
                />
              ))}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          disabled={!formData.name}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const Settings: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // User preferences state
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    autoBackup: false,
    darkMode: false,
    language: 'en',
    currency: 'EUR',
    dateFormat: 'MM/DD/YYYY',
    compactView: false,
  });

  const auth = useSelector((state: RootState) => state.auth);
  
  // API hooks
  const { data: categories, isLoading, refetch } = useGetCategoriesQuery({}, {
    skip: !auth.isAuthenticated
  });
  const [createCategory] = useCreateCategoryMutation();
  const [updateCategory] = useUpdateCategoryMutation();
  const [deleteCategory] = useDeleteCategoryMutation();

  const handleSaveCategory = async (data: any) => {
    try {
      if (editingCategory) {
        await updateCategory({ id: editingCategory.id, ...data }).unwrap();
      } else {
        await createCategory(data).unwrap();
      }
      refetch();
      setCategoryModalOpen(false);
      setEditingCategory(null);
    } catch (error) {
      console.error('Failed to save category:', error);
    }
  };

  const handleDeleteCategory = async () => {
    if (categoryToDelete) {
      try {
        await deleteCategory(categoryToDelete.id).unwrap();
        refetch();
        setDeleteDialogOpen(false);
        setCategoryToDelete(null);
      } catch (error) {
        console.error('Failed to delete category:', error);
      }
    }
  };


  if (!auth.isAuthenticated) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Please log in to access settings.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<Person />} label="Profile" />
          <Tab icon={<Category />} label="Categories" />
          <Tab icon={<Notifications />} label="Preferences" />
          <Tab icon={<Security />} label="Security" />
          <Tab icon={<CloudUpload />} label="Data" />
        </Tabs>

        {/* Profile Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ maxWidth: 600 }}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={3} mb={3}>
                  <Avatar
                    sx={{ width: 80, height: 80, bgcolor: 'primary.main' }}
                  >
                    {auth.user?.displayName?.[0] || 'U'}
                  </Avatar>
                  <Box>
                    <Typography variant="h5">
                      {auth.user?.displayName || 'User'}
                    </Typography>
                    <Typography color="textSecondary">
                      {auth.user?.email}
                    </Typography>
                    <Chip
                      label={auth.user?.role || 'User'}
                      size="small"
                      color="primary"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box display="flex" flexDirection="column" gap={2}>
                  <TextField
                    label="Display Name"
                    defaultValue={auth.user?.displayName}
                    fullWidth
                  />
                  <TextField
                    label="Email"
                    defaultValue={auth.user?.email}
                    fullWidth
                    disabled
                  />
                  <TextField
                    label="Organization"
                    defaultValue="Paréa Lesvos"
                    fullWidth
                  />
                  <Button variant="contained" startIcon={<Save />}>
                    Save Profile
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </TabPanel>

        {/* Categories Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Expense Categories</Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                setEditingCategory(null);
                setCategoryModalOpen(true);
              }}
            >
              Add Category
            </Button>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Subcategories</TableCell>
                  <TableCell>Color</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      Loading categories...
                    </TableCell>
                  </TableRow>
                ) : categories?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No categories found
                    </TableCell>
                  </TableRow>
                ) : (
                  categories?.data?.map((category: any) => (
                    <TableRow key={category.id}>
                      <TableCell>{category.name}</TableCell>
                      <TableCell>
                        <Chip label={category.code || 'N/A'} size="small" />
                      </TableCell>
                      <TableCell>
                        {category.subcategories?.length || 0} subcategories
                      </TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            bgcolor: category.color || '#ccc',
                            borderRadius: 1,
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingCategory(category);
                            setCategoryModalOpen(true);
                          }}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setCategoryToDelete(category);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Preferences Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ maxWidth: 600 }}>
            <List>
              <ListItem>
                <ListItemText
                  primary="Email Notifications"
                  secondary="Receive email alerts for important events"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={preferences.emailNotifications}
                    onChange={(e) => setPreferences({ ...preferences, emailNotifications: e.target.checked })}
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemText
                  primary="Auto Backup"
                  secondary="Automatically backup data daily"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={preferences.autoBackup}
                    onChange={(e) => setPreferences({ ...preferences, autoBackup: e.target.checked })}
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemText
                  primary="Dark Mode"
                  secondary="Use dark theme for the interface"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={preferences.darkMode}
                    onChange={(e) => setPreferences({ ...preferences, darkMode: e.target.checked })}
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemText
                  primary="Compact View"
                  secondary="Show more items with less spacing"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={preferences.compactView}
                    onChange={(e) => setPreferences({ ...preferences, compactView: e.target.checked })}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>

            <Divider sx={{ my: 2 }} />

            <Box display="flex" flexDirection="column" gap={2}>
              <FormControl fullWidth>
                <InputLabel>Language</InputLabel>
                <Select
                  value={preferences.language}
                  onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                  label="Language"
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="el">Greek</MenuItem>
                  <MenuItem value="fr">French</MenuItem>
                  <MenuItem value="de">German</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select
                  value={preferences.currency}
                  onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                  label="Currency"
                >
                  <MenuItem value="EUR">EUR (€)</MenuItem>
                  <MenuItem value="USD">USD ($)</MenuItem>
                  <MenuItem value="GBP">GBP (£)</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Date Format</InputLabel>
                <Select
                  value={preferences.dateFormat}
                  onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })}
                  label="Date Format"
                >
                  <MenuItem value="MM/DD/YYYY">MM/DD/YYYY</MenuItem>
                  <MenuItem value="DD/MM/YYYY">DD/MM/YYYY</MenuItem>
                  <MenuItem value="YYYY-MM-DD">YYYY-MM-DD</MenuItem>
                </Select>
              </FormControl>

              <Button variant="contained" startIcon={<Save />}>
                Save Preferences
              </Button>
            </Box>
          </Box>
        </TabPanel>

        {/* Security Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ maxWidth: 600 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Security settings help protect your account and data.
            </Alert>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Two-Factor Authentication
                </Typography>
                <Typography color="textSecondary" paragraph>
                  Add an extra layer of security to your account
                </Typography>
                <Button variant="outlined">
                  Enable 2FA
                </Button>
              </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  API Access
                </Typography>
                <Typography color="textSecondary" paragraph>
                  Manage API keys for external integrations
                </Typography>
                <Box display="flex" gap={2} alignItems="center">
                  <TextField
                    label="API Key"
                    value={showApiKey ? 'sk_test_1234567890abcdef' : '••••••••••••••••'}
                    fullWidth
                    disabled
                    size="small"
                  />
                  <IconButton onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </Box>
                <Button variant="outlined" sx={{ mt: 2 }}>
                  Regenerate Key
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Session Management
                </Typography>
                <Typography color="textSecondary" paragraph>
                  View and manage active sessions
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Current Session"
                      secondary="Chrome on Windows • Active now"
                    />
                  </ListItem>
                </List>
                <Button variant="outlined" color="error" sx={{ mt: 2 }}>
                  Sign Out All Devices
                </Button>
              </CardContent>
            </Card>
          </Box>
        </TabPanel>

        {/* Data Tab */}
        <TabPanel value={tabValue} index={4}>
          <Box sx={{ maxWidth: 600 }}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Export Data
                </Typography>
                <Typography color="textSecondary" paragraph>
                  Download all your data in various formats
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<CloudDownload />}
                  onClick={() => setImportExportOpen(true)}
                  fullWidth
                >
                  Open Export Manager
                </Button>
              </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Import Data
                </Typography>
                <Typography color="textSecondary" paragraph>
                  Import data from CSV or JSON files
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<CloudUpload />}
                  onClick={() => setImportExportOpen(true)}
                  fullWidth
                >
                  Open Import Manager
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="error">
                  Danger Zone
                </Typography>
                <Typography color="textSecondary" paragraph>
                  Irreversible actions that affect your data
                </Typography>
                <Box display="flex" gap={2}>
                  <Button variant="outlined" color="error">
                    Reset All Data
                  </Button>
                  <Button variant="outlined" color="error">
                    Delete Account
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </TabPanel>
      </Paper>

      {/* Category Modal */}
      <CategoryModal
        open={categoryModalOpen}
        onClose={() => {
          setCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        category={editingCategory}
        onSave={handleSaveCategory}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the category "{categoryToDelete?.name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteCategory} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <ImportExportDialog
        open={importExportOpen}
        onClose={() => setImportExportOpen(false)}
      />
    </Box>
  );
};

export default Settings;