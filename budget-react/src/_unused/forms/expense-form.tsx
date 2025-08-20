import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { CalendarIcon, Euro, FileText, Tag, Receipt } from 'lucide-react'
import { cn } from '../../lib/utils'

// Zod schema for form validation
const expenseSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  description: z.string().min(1, 'Description is required').max(100, 'Description too long'),
  amount: z.number().positive('Amount must be positive').max(100000, 'Amount too large'),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  payment_method: z.enum(['Cash', 'Card', 'Bank Transfer']),
  notes: z.string().optional(),
  receipt_url: z.string().optional(),
})

type ExpenseFormData = z.infer<typeof expenseSchema>

interface ExpenseFormProps {
  onSubmit: (data: ExpenseFormData) => void
  initialData?: Partial<ExpenseFormData>
  categories: Array<{ name: string; subcategories?: string[] }>
  isLoading?: boolean
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  onSubmit,
  initialData,
  categories,
  isLoading = false,
}) => {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      payment_method: 'Cash',
      ...initialData,
    },
  })

  const selectedCategory = watch('category')
  const selectedSubcategories = categories.find(c => c.name === selectedCategory)?.subcategories || []

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          {initialData ? 'Edit Expense' : 'Add New Expense'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Date
            </label>
            <input
              type="date"
              {...register('date')}
              className={cn(
                'w-full p-2 border rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent',
                errors.date && 'border-red-500'
              )}
            />
            {errors.date && (
              <p className="text-sm text-red-600">{errors.date.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Description
            </label>
            <input
              type="text"
              placeholder="Enter expense description..."
              {...register('description')}
              className={cn(
                'w-full p-2 border rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent',
                errors.description && 'border-red-500'
              )}
            />
            {errors.description && (
              <p className="text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Euro className="h-4 w-4" />
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register('amount', { valueAsNumber: true })}
              className={cn(
                'w-full p-2 border rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent',
                errors.amount && 'border-red-500'
              )}
            />
            {errors.amount && (
              <p className="text-sm text-red-600">{errors.amount.message}</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Category
            </label>
            <select
              {...register('category')}
              onChange={(e) => {
                setValue('category', e.target.value)
                setValue('subcategory', '') // Reset subcategory when category changes
              }}
              className={cn(
                'w-full p-2 border rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent',
                errors.category && 'border-red-500'
              )}
            >
              <option value="">Select a category...</option>
              {categories.map((category) => (
                <option key={category.name} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="text-sm text-red-600">{errors.category.message}</p>
            )}
          </div>

          {/* Subcategory */}
          {selectedSubcategories.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Subcategory</label>
              <select
                {...register('subcategory')}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent"
              >
                <option value="">Select a subcategory...</option>
                {selectedSubcategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Payment Method */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Method</label>
            <select
              {...register('payment_method')}
              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent"
            >
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (Optional)</label>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Additional notes..."
              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent"
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-2 pt-4">
            <Button 
              type="submit" 
              disabled={!isValid || isLoading}
              className="flex-1"
            >
              {isLoading ? 'Saving...' : (initialData ? 'Update Expense' : 'Add Expense')}
            </Button>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}