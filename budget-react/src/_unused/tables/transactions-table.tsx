import React, { useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  flexRender,
} from '@tanstack/react-table'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import { 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Edit, 
  Trash2,
  ArrowUpDown 
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { format } from 'date-fns'

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  category: string
  subcategory?: string
  type: 'income' | 'expense'
  payment_method: string
  receipt_url?: string
  notes?: string
}

interface TransactionsTableProps {
  data: Transaction[]
  onEdit?: (transaction: Transaction) => void
  onDelete?: (transaction: Transaction) => void
  onViewReceipt?: (transaction: Transaction) => void
  isLoading?: boolean
}

export const TransactionsTable: React.FC<TransactionsTableProps> = ({
  data,
  onEdit,
  onDelete,
  onViewReceipt,
  isLoading = false,
}) => {
  const columns = useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        accessorKey: 'date',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 p-0 hover:bg-transparent"
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ getValue }) => {
          const date = getValue() as string
          return format(new Date(date), 'MMM dd, yyyy')
        },
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <div className="max-w-[200px]">
            <div className="font-medium">{row.original.description}</div>
            {row.original.subcategory && (
              <div className="text-sm text-gray-500">{row.original.subcategory}</div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ getValue }) => (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: 'payment_method',
        header: 'Payment',
        cell: ({ getValue }) => {
          const method = getValue() as string
          const colorMap = {
            Cash: 'bg-green-100 text-green-800',
            Card: 'bg-blue-100 text-blue-800',
            'Bank Transfer': 'bg-purple-100 text-purple-800',
          }
          return (
            <span className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              colorMap[method as keyof typeof colorMap] || 'bg-gray-100 text-gray-800'
            )}>
              {method}
            </span>
          )
        },
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 p-0 hover:bg-transparent"
          >
            Amount
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ getValue, row }) => {
          const amount = getValue() as number
          const isExpense = row.original.type === 'expense'
          return (
            <div className={cn(
              'font-semibold',
              isExpense ? 'text-red-600' : 'text-green-600'
            )}>
              {isExpense ? '-' : '+'}{formatCurrency(Math.abs(amount))}
            </div>
          )
        },
      },
      {
        accessorKey: 'receipt_url',
        header: 'Receipt',
        cell: ({ getValue, row }) => {
          const receiptUrl = getValue() as string
          return receiptUrl ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewReceipt?.(row.original)}
              className="h-8 w-8 p-0"
            >
              <Eye className="h-4 w-4" />
            </Button>
          ) : (
            <span className="text-gray-400 text-sm">No receipt</span>
          )
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit?.(row.original)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete?.(row.original)}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [onEdit, onDelete, onViewReceipt]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 25,
      },
      sorting: [
        {
          id: 'date',
          desc: true,
        },
      ],
    },
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t">
          <div className="text-sm text-gray-700">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}{' '}
            of {table.getFilteredRowModel().rows.length} results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}