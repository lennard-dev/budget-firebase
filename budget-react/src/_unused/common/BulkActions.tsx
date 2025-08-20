import React, { useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Delete,
  Download,
  Category,
  Close,
  MoreVert,
  Label,
} from '@mui/icons-material';

interface BulkActionsProps {
  selectedCount: number;
  onDelete: () => void;
  onExport: () => void;
  onClearSelection: () => void;
  onCategorize?: () => void;
  onTag?: () => void;
}

const BulkActions: React.FC<BulkActionsProps> = ({
  selectedCount,
  onDelete,
  onExport,
  onClearSelection,
  onCategorize,
  onTag,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        p: 2,
        mb: 2,
        backgroundColor: 'primary.main',
        color: 'white',
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="subtitle1">
            {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
          </Typography>
          
          <Button
            variant="contained"
            color="error"
            startIcon={<Delete />}
            onClick={onDelete}
            size="small"
            sx={{ 
              backgroundColor: 'error.dark',
              '&:hover': {
                backgroundColor: 'error.main',
              },
            }}
          >
            Delete
          </Button>

          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={onExport}
            size="small"
            sx={{ 
              color: 'white',
              borderColor: 'white',
              '&:hover': {
                borderColor: 'white',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            Export
          </Button>

          {(onCategorize || onTag) && (
            <>
              <Divider orientation="vertical" flexItem sx={{ backgroundColor: 'white', opacity: 0.3 }} />
              
              {onCategorize && (
                <Button
                  variant="outlined"
                  startIcon={<Category />}
                  onClick={onCategorize}
                  size="small"
                  sx={{ 
                    color: 'white',
                    borderColor: 'white',
                    '&:hover': {
                      borderColor: 'white',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                  Categorize
                </Button>
              )}

              {onTag && (
                <Button
                  variant="outlined"
                  startIcon={<Label />}
                  onClick={onTag}
                  size="small"
                  sx={{ 
                    color: 'white',
                    borderColor: 'white',
                    '&:hover': {
                      borderColor: 'white',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                  Tag
                </Button>
              )}
            </>
          )}

          <IconButton
            onClick={handleMenuClick}
            size="small"
            sx={{ color: 'white' }}
          >
            <MoreVert />
          </IconButton>
        </Box>

        <IconButton
          onClick={onClearSelection}
          size="small"
          sx={{ color: 'white' }}
        >
          <Close />
        </IconButton>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          console.log('Mark as reviewed');
          handleMenuClose();
        }}>
          Mark as Reviewed
        </MenuItem>
        <MenuItem onClick={() => {
          console.log('Archive selected');
          handleMenuClose();
        }}>
          Archive Selected
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {
          console.log('Print selected');
          handleMenuClose();
        }}>
          Print Selected
        </MenuItem>
      </Menu>
    </Paper>
  );
};

export default BulkActions;