import { 
  Users, 
  UserCheck,
  GraduationCap,
  Building2,
  Home,
  Wrench,
  Package,
  Monitor,
  Phone,
  DollarSign,
  CreditCard,
  TrendingUp,
  Target,
  Palette,
  Truck,
  FileText,
  Shield,
  Heart,
  Globe,
  Briefcase,
  Calculator,
  type LucideIcon
} from 'lucide-react';

export interface AccountIcon {
  value: string;
  label: string;
  icon: LucideIcon;
}

export interface IconCategory {
  category: string;
  icons: AccountIcon[];
}

// Professional monochrome icon set for accounts
export const ACCOUNT_ICONS: IconCategory[] = [
  {
    category: 'People & Personnel',
    icons: [
      { value: 'users', label: 'Staff', icon: Users },
      { value: 'user-check', label: 'Volunteers', icon: UserCheck },
      { value: 'graduation-cap', label: 'Training', icon: GraduationCap },
    ]
  },
  {
    category: 'Facilities & Operations',
    icons: [
      { value: 'building-2', label: 'Office', icon: Building2 },
      { value: 'home', label: 'Housing', icon: Home },
      { value: 'wrench', label: 'Maintenance', icon: Wrench },
      { value: 'package', label: 'Supplies', icon: Package },
    ]
  },
  {
    category: 'Technology & Communications',
    icons: [
      { value: 'monitor', label: 'Technology', icon: Monitor },
      { value: 'phone', label: 'Communications', icon: Phone },
    ]
  },
  {
    category: 'Finance & Administration',
    icons: [
      { value: 'dollar-sign', label: 'Fundraising', icon: DollarSign },
      { value: 'credit-card', label: 'Banking', icon: CreditCard },
      { value: 'trending-up', label: 'Accounting', icon: TrendingUp },
      { value: 'calculator', label: 'Budget', icon: Calculator },
      { value: 'briefcase', label: 'Administration', icon: Briefcase },
    ]
  },
  {
    category: 'Programs & Services',
    icons: [
      { value: 'target', label: 'Direct Services', icon: Target },
      { value: 'palette', label: 'Activities', icon: Palette },
      { value: 'truck', label: 'Transportation', icon: Truck },
      { value: 'heart', label: 'Community', icon: Heart },
      { value: 'globe', label: 'Outreach', icon: Globe },
    ]
  },
  {
    category: 'Compliance & Documentation',
    icons: [
      { value: 'file-text', label: 'Documentation', icon: FileText },
      { value: 'shield', label: 'Insurance', icon: Shield },
    ]
  }
];

// Helper function to get icon by value
export const getIconByValue = (value: string): LucideIcon | null => {
  for (const category of ACCOUNT_ICONS) {
    const found = category.icons.find(icon => icon.value === value);
    if (found) return found.icon;
  }
  return null;
};

// Default icon for accounts without specific icon
export const DEFAULT_ACCOUNT_ICON = 'briefcase';

// Map common account names to appropriate icons
export const ACCOUNT_NAME_ICON_MAP: Record<string, string> = {
  'Administration': 'briefcase',
  'Administrative': 'briefcase',
  'Staff': 'users',
  'Personnel': 'users',
  'Salaries': 'users',
  'Wages': 'users',
  'Office': 'building-2',
  'Facility': 'building-2',
  'Rent': 'home',
  'Utilities': 'home',
  'Maintenance': 'wrench',
  'Repairs': 'wrench',
  'Supplies': 'package',
  'Materials': 'package',
  'Technology': 'monitor',
  'IT': 'monitor',
  'Software': 'monitor',
  'Communications': 'phone',
  'Telephone': 'phone',
  'Internet': 'phone',
  'Fundraising': 'dollar-sign',
  'Donations': 'dollar-sign',
  'Banking': 'credit-card',
  'Bank Fees': 'credit-card',
  'Accounting': 'trending-up',
  'Finance': 'trending-up',
  'Programs': 'target',
  'Services': 'target',
  'Activities': 'palette',
  'Events': 'palette',
  'Transportation': 'truck',
  'Travel': 'truck',
  'Vehicle': 'truck',
  'Insurance': 'shield',
  'Legal': 'shield',
  'Documentation': 'file-text',
  'Reports': 'file-text',
  'Training': 'graduation-cap',
  'Education': 'graduation-cap',
  'Community': 'heart',
  'Outreach': 'globe',
  'Marketing': 'globe',
};

// Function to suggest icon based on account name
export const suggestIconForAccount = (accountName: string): string => {
  const nameLower = accountName.toLowerCase();
  
  // Check exact matches first
  for (const [key, iconValue] of Object.entries(ACCOUNT_NAME_ICON_MAP)) {
    if (nameLower.includes(key.toLowerCase())) {
      return iconValue;
    }
  }
  
  // Return default if no match found
  return DEFAULT_ACCOUNT_ICON;
};