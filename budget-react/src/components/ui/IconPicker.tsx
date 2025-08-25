import { useState } from 'react';
import { cn } from '../../lib/utils';
import { ACCOUNT_ICONS } from '../../lib/account-icons';
import { ChevronDown } from 'lucide-react';

interface IconPickerProps {
  value?: string;
  onChange: (iconValue: string) => void;
  className?: string;
  compact?: boolean;
}

export default function IconPicker({ value, onChange, className, compact = false }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Get all icons in a flat list
  const allIcons = ACCOUNT_ICONS.flatMap(c => c.icons);
  
  // Get selected icon
  const selectedIcon = allIcons.find(i => i.value === value);
  const SelectedIconComponent = selectedIcon?.icon;
  
  // Filter icons based on search term
  const filteredIcons = searchTerm 
    ? allIcons.filter(icon => 
        icon.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        icon.value.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : allIcons;

  // Compact dropdown mode
  if (compact) {
    return (
      <div className={cn("relative", className)}>
        {/* Dropdown Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
        >
          {SelectedIconComponent ? (
            <>
              <div className="p-1 bg-gray-100 rounded">
                <SelectedIconComponent className="h-4 w-4 text-gray-700" />
              </div>
              <span className="text-sm flex-1 text-left">{selectedIcon.label}</span>
            </>
          ) : (
            <span className="text-sm text-gray-500 flex-1 text-left">Select an icon</span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", isOpen && "rotate-180")} />
        </button>

        {/* Dropdown Content */}
        {isOpen && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
            {/* Search */}
            <div className="p-2 border-b">
              <input
                type="text"
                placeholder="Search icons..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            
            {/* Icons Grid */}
            <div className="max-h-64 overflow-y-auto p-2">
              {filteredIcons.length === 0 ? (
                <div className="text-center text-gray-500 py-4 text-sm">
                  No icons found
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-1">
                  {filteredIcons.map((icon) => {
                    const IconComponent = icon.icon;
                    const isSelected = value === icon.value;
                    
                    return (
                      <button
                        key={icon.value}
                        type="button"
                        title={icon.label}
                        onClick={() => {
                          onChange(icon.value);
                          setIsOpen(false);
                          setSearchTerm('');
                        }}
                        className={cn(
                          "p-2 rounded border transition-all hover:scale-110",
                          isSelected 
                            ? "border-blue-500 bg-blue-50 text-blue-700" 
                            : "border-transparent hover:border-gray-300 hover:bg-gray-50"
                        )}
                      >
                        <IconComponent className="h-4 w-4 mx-auto" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Original expanded mode for add account modal
  return (
    <div className={cn("space-y-3", className)}>
      {/* Current Selection */}
      {SelectedIconComponent && (
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
          <div className="p-1.5 bg-white rounded">
            <SelectedIconComponent className="h-5 w-5 text-gray-700" />
          </div>
          <span className="text-sm font-medium">{selectedIcon.label}</span>
        </div>
      )}

      {/* Compact Icon Grid */}
      <div className="border border-gray-200 rounded-md p-3">
        <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
          {allIcons.map((icon) => {
            const IconComponent = icon.icon;
            const isSelected = value === icon.value;
            
            return (
              <button
                key={icon.value}
                type="button"
                title={icon.label}
                onClick={() => onChange(icon.value)}
                className={cn(
                  "p-2 rounded border transition-all hover:scale-110",
                  isSelected 
                    ? "border-blue-500 bg-blue-50 text-blue-700" 
                    : "border-transparent hover:border-gray-300 hover:bg-gray-50"
                )}
              >
                <IconComponent className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}