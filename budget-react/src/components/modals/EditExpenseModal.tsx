import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Calendar, DollarSign, Tag, FileText, Upload, CreditCard } from 'lucide-react';

interface EditExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: {
    id: string;
    date: string;
    category: string;
    subcategory: string;
    description: string;
    amount: number;
    paymentMethod: string;
    receipt?: string;
  };
}

const EditExpenseModal: React.FC<EditExpenseModalProps> = ({ isOpen, onClose, expense }) => {
  const [formData, setFormData] = useState({
    date: expense.date,
    category: '',
    subcategory: expense.subcategory,
    description: expense.description,
    amount: expense.amount.toString(),
    paymentMethod: expense.paymentMethod.toLowerCase().replace(' ', '_'),
    receipt: null as File | null,
  });

  const [categories] = useState([
    { id: 'facility', name: 'Facility', subcategories: ['Rent', 'Utilities', 'Maintenance'] },
    { id: 'administration', name: 'Administration', subcategories: ['Office Supplies', 'Insurance', 'Software', 'Test'] },
    { id: 'programs', name: 'Programs', subcategories: ['Materials', 'Activities', 'Equipment'] },
    { id: 'staff', name: 'Staff', subcategories: ['Salaries', 'Training', 'Benefits'] },
  ]);

  const [selectedCategory, setSelectedCategory] = useState<typeof categories[0] | null>(null);

  useEffect(() => {
    // Find the category based on the expense's category name
    const cat = categories.find(c => c.name === expense.category);
    if (cat) {
      setFormData(prev => ({ ...prev, category: cat.id }));
      setSelectedCategory(cat);
    }
  }, [expense, categories]);

  useEffect(() => {
    const cat = categories.find(c => c.id === formData.category);
    setSelectedCategory(cat || null);
  }, [formData.category, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Here you would make the API call to update the expense
    console.log('Updating expense:', expense.id, formData);
    
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, receipt: e.target.files[0] });
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
              <Dialog.Panel className="w-full max-w-md transform rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col max-h-[85vh]">
                <Dialog.Title
                  as="div"
                  className="flex items-center justify-between p-6 pb-4 border-b border-gray-100"
                >
                  <h3 className="text-lg font-semibold text-gray-900">Edit Expense</h3>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
                  {/* Date Field */}
                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="date"
                        id="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  {/* Category Field */}
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select
                        id="category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value, subcategory: '' })}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none"
                        required
                      >
                        <option value="">Select category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Subcategory Field */}
                  {selectedCategory && (
                    <div>
                      <label htmlFor="subcategory" className="block text-sm font-medium text-gray-700 mb-1">
                        Subcategory
                      </label>
                      <select
                        id="subcategory"
                        value={formData.subcategory}
                        onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none"
                        required
                      >
                        <option value="">Select subcategory</option>
                        {selectedCategory.subcategories.map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Description Field */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                        rows={3}
                        placeholder="Enter expense description"
                        required
                      />
                    </div>
                  </div>

                  {/* Amount Field */}
                  <div>
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                      Amount
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="number"
                        id="amount"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="0.00"
                        step="0.01"
                        required
                      />
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Method
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select
                        id="paymentMethod"
                        value={formData.paymentMethod}
                        onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none"
                        required
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="bank_transfer">Bank Transfer</option>
                      </select>
                    </div>
                  </div>

                  {/* Receipt Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Receipt (Optional)
                    </label>
                    <div className="flex items-center justify-center w-full">
                      <label
                        htmlFor="receipt"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 mb-2 text-gray-400" />
                          <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">PNG, JPG or PDF (MAX. 5MB)</p>
                          {(formData.receipt || expense.receipt) && (
                            <p className="mt-2 text-sm text-primary-600">
                              {formData.receipt ? formData.receipt.name : expense.receipt}
                            </p>
                          )}
                        </div>
                        <input
                          id="receipt"
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf"
                          onChange={handleFileChange}
                        />
                      </label>
                    </div>
                  </div>
                  </div>

                  {/* Form Actions - Outside scrollable area */}
                  <div className="flex gap-3 p-6 pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                    >
                      Update Expense
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default EditExpenseModal;