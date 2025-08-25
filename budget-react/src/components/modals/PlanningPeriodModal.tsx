import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Calendar, X, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

interface PlanningPeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodToEdit?: any;
}


const INTERVAL_OPTIONS = [
  { value: 'quarterly', label: 'Quarterly (3 months)', months: 3 },
  { value: 'bi-annual', label: 'Bi-annual (6 months)', months: 6 },
  { value: 'annual', label: 'Annual (12 months)', months: 12 }
];

const STATUS_OPTIONS = [
  { value: 'planning', label: 'Planning', description: 'Future period, fully editable' },
  { value: 'draft', label: 'Draft', description: 'Work in progress' },
  { value: 'active', label: 'Active', description: 'Current period' },
  { value: 'closed', label: 'Closed', description: 'Past period, read-only' }
];

const PlanningPeriodModal: React.FC<PlanningPeriodModalProps> = ({
  isOpen,
  onClose,
  periodToEdit
}) => {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  
  const [formData, setFormData] = useState({
    name: '',
    interval: 'quarterly' as 'quarterly' | 'bi-annual' | 'annual',
    startMonth: '',
    endMonth: '',
    status: 'planning' as 'planning' | 'draft' | 'active' | 'closed',
    copiedFromPeriod: '',
    autoRollForward: true
  });
  
  const [validationError, setValidationError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  // Fetch existing periods for copying
  const { data: existingPeriods } = useQuery({
    queryKey: ['planning-periods'],
    queryFn: async () => {
      const response = await api.get('/planning-periods');
      return response.data?.data || [];
    },
    enabled: isOpen
  });

  // Initialize form when editing
  useEffect(() => {
    if (periodToEdit) {
      setFormData({
        name: periodToEdit.name,
        interval: periodToEdit.interval,
        startMonth: periodToEdit.startMonth,
        endMonth: periodToEdit.endMonth,
        status: periodToEdit.status,
        copiedFromPeriod: '',
        autoRollForward: periodToEdit.autoRollForward ?? true
      });
    } else {
      // Set default start month to next available month
      const nextMonth = getNextAvailableMonth();
      setFormData(prev => ({
        ...prev,
        startMonth: nextMonth,
        endMonth: calculateEndMonth(nextMonth, prev.interval)
      }));
    }
  }, [periodToEdit, isOpen]);

  // Auto-calculate end month when start month or interval changes
  useEffect(() => {
    if (formData.startMonth && !periodToEdit) {
      const endMonth = calculateEndMonth(formData.startMonth, formData.interval);
      setFormData(prev => ({ ...prev, endMonth }));
      
      // Auto-generate name
      const name = generatePeriodName(formData.startMonth, endMonth, formData.interval);
      setFormData(prev => ({ ...prev, name }));
    }
  }, [formData.startMonth, formData.interval, periodToEdit]);

  const getNextAvailableMonth = () => {
    if (!existingPeriods || existingPeriods.length === 0) {
      return `${currentYear}-01`; // January of current year
    }
    
    // Find the last period's end month
    const sortedPeriods = [...existingPeriods].sort((a, b) => 
      new Date(b.endMonth + '-01').getTime() - new Date(a.endMonth + '-01').getTime()
    );
    
    if (sortedPeriods.length > 0) {
      const lastEnd = new Date(sortedPeriods[0].endMonth + '-01');
      lastEnd.setMonth(lastEnd.getMonth() + 1);
      return `${lastEnd.getFullYear()}-${String(lastEnd.getMonth() + 1).padStart(2, '0')}`;
    }
    
    return `${currentYear}-01`;
  };

  const calculateEndMonth = (startMonth: string, interval: string) => {
    if (!startMonth) return '';
    
    const intervalConfig = INTERVAL_OPTIONS.find(opt => opt.value === interval);
    if (!intervalConfig) return '';
    
    const start = new Date(startMonth + '-01');
    const end = new Date(start);
    end.setMonth(end.getMonth() + intervalConfig.months - 1);
    
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;
  };

  const generatePeriodName = (startMonth: string, endMonth: string, interval: string) => {
    if (!startMonth || !endMonth) return '';
    
    const startDate = new Date(startMonth + '-01');
    const endDate = new Date(endMonth + '-01');
    const year = startDate.getFullYear();
    
    if (interval === 'annual') {
      if (startDate.getMonth() === 0) {
        return `${year}`;
      } else {
        return `FY ${year}-${String(endDate.getFullYear()).slice(2)}`;
      }
    } else if (interval === 'bi-annual') {
      const half = startDate.getMonth() < 6 ? 'H1' : 'H2';
      if (endDate.getFullYear() > year) {
        return `${year}-${String(endDate.getFullYear()).slice(2)} ${half}`;
      }
      return `${year} ${half}`;
    } else if (interval === 'quarterly') {
      const quarter = Math.floor(startDate.getMonth() / 3) + 1;
      if (endDate.getFullYear() > year) {
        return `${year}-${String(endDate.getFullYear()).slice(2)} Q${quarter}`;
      }
      return `${year} Q${quarter}`;
    }
    
    return '';
  };

  const validatePeriod = async () => {
    setIsValidating(true);
    setValidationError('');
    
    try {
      const response = await api.post('/planning-periods/validate', {
        startMonth: formData.startMonth,
        endMonth: formData.endMonth,
        excludeId: periodToEdit?.id
      });
      
      if (!response.data.valid) {
        const overlap = response.data.overlaps[0];
        setValidationError(
          `Overlaps with ${overlap.periodName} (${overlap.overlappingMonths.join(', ')})`
        );
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Validation error:', error);
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/planning-periods', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-periods'] });
      onClose();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put(`/planning-periods/${periodToEdit.id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-periods'] });
      onClose();
    }
  });

  const handleSubmit = async () => {
    // Validate
    if (!formData.name || !formData.startMonth || !formData.endMonth) {
      setValidationError('Please fill in all required fields');
      return;
    }
    
    const isValid = await validatePeriod();
    if (!isValid) return;
    
    if (periodToEdit) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };


  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="div"
                  className="flex items-center justify-between p-6 pb-4 border-b border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {periodToEdit ? 'Edit Planning Period' : 'Create Planning Period'}
                    </h3>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Title>

                <div className="p-6 space-y-4">
                  {validationError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                      <p className="text-sm text-red-700">{validationError}</p>
                    </div>
                  )}

                  {/* Period Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Period Type
                    </label>
                    <select
                      value={formData.interval}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        interval: e.target.value as any 
                      }))}
                      disabled={!!periodToEdit}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      {INTERVAL_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Start Month */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Month
                      </label>
                      <input
                        type="month"
                        value={formData.startMonth}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          startMonth: e.target.value 
                        }))}
                        disabled={!!periodToEdit}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Month
                      </label>
                      <input
                        type="month"
                        value={formData.endMonth}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          endMonth: e.target.value 
                        }))}
                        disabled={!periodToEdit}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                  </div>

                  {/* Custom Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Period Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., 2025 Q1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        status: e.target.value as any 
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {STATUS_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label} - {option.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Copy from existing period */}
                  {!periodToEdit && existingPeriods && existingPeriods.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Copy allocations from (optional)
                      </label>
                      <select
                        value={formData.copiedFromPeriod}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          copiedFromPeriod: e.target.value 
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Don't copy</option>
                        {existingPeriods.map((period: any) => (
                          <option key={period.id} value={period.id}>
                            {period.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Auto Roll Forward */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoRollForward"
                      checked={formData.autoRollForward}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        autoRollForward: e.target.checked 
                      }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="autoRollForward" className="text-sm text-gray-700">
                      Auto-create next period when reaching last month
                    </label>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={createMutation.isPending || updateMutation.isPending || isValidating}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createMutation.isPending || updateMutation.isPending 
                      ? 'Saving...' 
                      : periodToEdit 
                      ? 'Update Period' 
                      : 'Create Period'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default PlanningPeriodModal;