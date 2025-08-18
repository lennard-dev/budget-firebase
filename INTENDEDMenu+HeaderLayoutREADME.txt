## Header & Navigation Layout - Detailed Description

Based on the screenshot, here's the exact layout structure of the header and navigation menu:

### **Header Bar Structure**

#### **Overall Header Container**
- **Background**: Clean white background
- **Height**: Approximately 60px
- **Shadow**: Subtle shadow beneath for elevation
- **Layout**: Horizontal flex container with space-between alignment

#### **Left Section - Logo/Brand**
- **Icon**: Blue rounded square with "PL" letters (Parea Lesvos initials)
- **Text**: "Parea Lesvos Budget Management" 
- **Styling**: 
  - Icon and text aligned horizontally
  - Text in dark gray/black color
  - Font weight appears medium/semi-bold
  - Icon has rounded corners (appears to be border-radius: 8px)
  - Small gap between icon and text (approximately 8-12px)

#### **Right Section - User Menu**
- **Layout**: Horizontal alignment of utility items
- **Components** (from left to right):
  1. **Notifications icon** (bell icon outline)
  2. **Grid/Apps icon** (9-dot grid pattern)
  3. **User avatar** (circular profile image with dark background)
- **Spacing**: Each icon has consistent padding/margin between them
- **Icon style**: Thin line icons, gray color
- **Avatar**: Perfect circle, approximately 32-36px diameter

### **Navigation Sidebar**

#### **Position & Structure**
- **Location**: Left side of viewport
- **Width**: Approximately 250-280px
- **Height**: Full viewport height minus header
- **Background**: Light gray/off-white (#f7fafc or similar)
- **Border**: Subtle right border or shadow separating from main content

#### **Navigation Items**
The menu items are arranged vertically with the following structure:

1. **Dashboard** (currently active - indicated by highlighting)
2. **Expenses** 
3. **Budget**
4. **Cash & Banking**
5. **Reports**

#### **Navigation Item Design**
- **Layout**: Each item is a horizontal container
- **Padding**: Approximately 12-16px vertical, 20-24px horizontal
- **Icons**: Each menu item has an icon on the left:
  - Dashboard: Home/dashboard icon
  - Expenses: Document/receipt icon
  - Budget: Circular/pie chart icon
  - Cash & Banking: Bank/money icon
  - Reports: Document/chart icon
- **Text**: Menu labels aligned to the right of icons
- **Active state**: 
  - Dashboard (active) has a light blue/indigo background
  - Possibly left border accent (3-4px blue indicator)
  - Text might be slightly bolder or darker
- **Hover state**: Likely has background color change on hover
- **Icon-text gap**: Approximately 12-16px

#### **Admin Console Link**
- **Position**: Bottom of sidebar
- **Icon**: Settings/gear icon
- **Text**: "Admin Console"
- **Styling**: Similar to other nav items but positioned at bottom

### **Main Content Area Layout**

#### **Content Container**
- **Margin from sidebar**: Starts where sidebar ends (approximately 250-280px from left)
- **Padding**: Generous padding (24-32px) on all sides
- **Background**: White or very light gray

#### **Dashboard Grid Layout**
- **Top Metrics Cards**: 4 cards in a horizontal row
  - Equal width (flex: 1 or 25% each)
  - Gap between cards: ~20px
  - Card styling: White background, rounded corners, subtle shadow
  
- **Middle Section**: 2 columns
  - Left: "Recent Expenses" table (approximately 60% width)
  - Right: "Budget vs Actual" chart (approximately 40% width)
  
- **Bottom Section**: 2 equal columns
  - Left: "Category Breakdown" pie chart
  - Right: "Monthly Spending Trend" line chart

### **Responsive Behavior Notes**

For the migration, the header should:
- **Collapse** sidebar to hamburger menu on mobile (<768px)
- **Stack** user menu items vertically or hide in menu
- **Reduce** padding and margins on smaller screens
- **Transform** sidebar to slide-out drawer on mobile



This layout structure shows a classic admin dashboard pattern with fixed header, fixed sidebar navigation, and scrollable main content area. The design is clean and professional with good use of whitespace and clear visual hierarchy.