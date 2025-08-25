import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Save, RotateCcw, ChevronRight, ChevronDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

interface ChartAccount {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  display_as: 'category' | 'subcategory';
  parent_code?: string;
  display_order?: number;
  is_active: boolean;
  description?: string;
}

interface SortableAccountItemProps {
  account: ChartAccount;
  subAccounts?: ChartAccount[];
  isExpanded: boolean;
  onToggle: () => void;
  isDragging?: boolean;
}

// Sortable Account Item Component
function SortableAccountItem({ account, subAccounts, isExpanded, onToggle, isDragging }: SortableAccountItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isCurrentlyDragging,
  } = useSortable({ 
    id: account.account_code,
    data: {
      account,
      hasSubAccounts: !!subAccounts && subAccounts.length > 0
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isCurrentlyDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-white rounded-lg border transition-all",
        isCurrentlyDragging ? "border-blue-400 shadow-lg scale-[1.02] z-10" : "border-gray-200",
        isDragging && !isCurrentlyDragging && "opacity-40"
      )}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab hover:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
        >
          <GripVertical className="w-5 h-5" />
        </div>

        {/* Expand/Collapse for parent accounts */}
        {subAccounts && subAccounts.length > 0 ? (
          <button
            onClick={onToggle}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="w-4" /> // Spacer for alignment
        )}

        {/* Account Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="font-medium text-gray-900">{account.account_name}</span>
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
              {account.account_code}
            </span>
            {account.display_as === 'subcategory' && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                Sub-account
              </span>
            )}
          </div>
          {account.description && (
            <p className="text-sm text-gray-500 mt-0.5">{account.description}</p>
          )}
        </div>

        {/* Current Order */}
        <div className="text-sm text-gray-400">
          #{account.display_order || '-'}
        </div>
      </div>

      {/* Sub-accounts (non-draggable, move with parent) */}
      {isExpanded && subAccounts && subAccounts.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50 rounded-b-lg">
          {subAccounts.map(sub => (
            <div
              key={sub.account_code}
              className="flex items-center gap-3 p-3 pl-12 border-b border-gray-100 last:border-b-0"
            >
              <div className="w-5" /> {/* Spacer for drag handle */}
              <div className="w-4" /> {/* Spacer for expand button */}
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700">{sub.account_name}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded">
                    {sub.account_code}
                  </span>
                </div>
                {sub.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{sub.description}</p>
                )}
              </div>
              <div className="text-sm text-gray-400">
                #{sub.display_order || '-'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Main Account Order Manager Component
export default function AccountOrderManager() {
  const queryClient = useQueryClient();
  const [orderedAccounts, setOrderedAccounts] = useState<ChartAccount[]>([]);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [draggedAccount, setDraggedAccount] = useState<ChartAccount | null>(null);
  const [autoSave, setAutoSave] = useState(true);
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // Fetch accounts
  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['chart-of-accounts-ordering'],
    queryFn: async () => {
      const response = await api.get('/chart-of-accounts');
      return response.data?.data || [];
    }
  });

  // Initialize ordered accounts
  useEffect(() => {
    if (accountsData) {
      // Filter only parent accounts for dragging
      const parentAccounts = accountsData.filter((a: ChartAccount) => a.display_as === 'category');
      setOrderedAccounts(parentAccounts);
    }
  }, [accountsData]);

  // Group sub-accounts by parent
  const subAccountsByParent = accountsData?.reduce((acc: any, account: ChartAccount) => {
    if (account.display_as === 'subcategory' && account.parent_code) {
      if (!acc[account.parent_code]) {
        acc[account.parent_code] = [];
      }
      acc[account.parent_code].push(account);
    }
    return acc;
  }, {}) || {};

  // Save mutation
  const saveOrderMutation = useMutation({
    mutationFn: async (accountOrders: { account_code: string; display_order: number }[]) => {
      const response = await api.put('/chart-of-accounts/reorder', { accountOrders });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts-ordering'] });
      setHasChanges(false);
      toast.success('Account order saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save order');
    }
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const account = orderedAccounts.find(a => a.account_code === active.id);
    setDraggedAccount(account || null);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedAccount(null);

    if (over && active.id !== over.id) {
      setOrderedAccounts((items) => {
        const oldIndex = items.findIndex(i => i.account_code === active.id);
        const newIndex = items.findIndex(i => i.account_code === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Update display_order values
        const updatedOrder = newOrder.map((account, index) => ({
          ...account,
          display_order: index + 1
        }));
        
        setHasChanges(true);
        
        // Auto-save after delay
        if (autoSave) {
          if (saveTimer) clearTimeout(saveTimer);
          const timer = setTimeout(() => {
            handleSave(updatedOrder);
          }, 2000);
          setSaveTimer(timer);
        }
        
        return updatedOrder;
      });
    }
  };

  // Handle manual save
  const handleSave = (accounts?: ChartAccount[]) => {
    const accountsToSave = accounts || orderedAccounts;
    
    // Prepare save data - include parent accounts and their sub-accounts
    const accountOrders: { account_code: string; display_order: number }[] = [];
    let orderIndex = 1;
    
    accountsToSave.forEach(parent => {
      // Add parent account
      accountOrders.push({
        account_code: parent.account_code,
        display_order: orderIndex++
      });
      
      // Add sub-accounts in their current order
      const subs = subAccountsByParent[parent.account_code] || [];
      subs.forEach((sub: ChartAccount) => {
        accountOrders.push({
          account_code: sub.account_code,
          display_order: orderIndex++
        });
      });
    });
    
    saveOrderMutation.mutate(accountOrders);
  };

  // Handle reset
  const handleReset = () => {
    if (accountsData) {
      const parentAccounts = accountsData.filter((a: ChartAccount) => a.display_as === 'category');
      setOrderedAccounts(parentAccounts);
      setHasChanges(false);
      if (saveTimer) {
        clearTimeout(saveTimer);
        setSaveTimer(null);
      }
      toast.success('Order reset to original');
    }
  };

  // Toggle account expansion
  const toggleAccount = (accountCode: string) => {
    setExpandedAccounts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountCode)) {
        newSet.delete(accountCode);
      } else {
        newSet.add(accountCode);
      }
      return newSet;
    });
  };

  // Toggle all accounts
  const toggleAll = () => {
    if (expandedAccounts.size === orderedAccounts.length) {
      setExpandedAccounts(new Set());
    } else {
      setExpandedAccounts(new Set(orderedAccounts.map(a => a.account_code)));
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
        Loading accounts...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Account Order</h3>
            <p className="text-sm text-gray-600 mt-1">
              Drag and drop accounts to reorder them. Sub-accounts will move with their parent.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Auto-save toggle */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
                className="rounded border-gray-300"
              />
              Auto-save
            </label>
            
            {/* Expand/Collapse All */}
            <button
              onClick={toggleAll}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {expandedAccounts.size === orderedAccounts.length ? 'Collapse All' : 'Expand All'}
            </button>
            
            {/* Reset button */}
            {hasChanges && (
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            )}
            
            {/* Save button */}
            {!autoSave && hasChanges && (
              <button
                onClick={() => handleSave()}
                disabled={saveOrderMutation.isPending}
                className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saveOrderMutation.isPending ? 'Saving...' : 'Save Order'}
              </button>
            )}
          </div>
        </div>
        
        {/* Status indicators */}
        {hasChanges && autoSave && (
          <div className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
            Changes will be saved automatically in 2 seconds...
          </div>
        )}
        
        {saveOrderMutation.isPending && (
          <div className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
            Saving account order...
          </div>
        )}
      </div>

      {/* Draggable List */}
      <div className="space-y-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedAccounts.map(a => a.account_code)}
            strategy={verticalListSortingStrategy}
          >
            {orderedAccounts.map((account) => (
              <SortableAccountItem
                key={account.account_code}
                account={account}
                subAccounts={subAccountsByParent[account.account_code]}
                isExpanded={expandedAccounts.has(account.account_code)}
                onToggle={() => toggleAccount(account.account_code)}
                isDragging={!!draggedAccount}
              />
            ))}
          </SortableContext>
          
          {/* Drag Overlay for smooth dragging */}
          <DragOverlay>
            {draggedAccount ? (
              <div className="bg-white rounded-lg border-2 border-blue-400 shadow-xl p-3 opacity-90">
                <div className="flex items-center gap-3">
                  <GripVertical className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <span className="font-medium">{draggedAccount.account_name}</span>
                    <span className="ml-2 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                      {draggedAccount.account_code}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}