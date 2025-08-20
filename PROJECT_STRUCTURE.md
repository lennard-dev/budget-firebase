# Budget Firebase Project Structure

## Overview
This project has been restructured to support both a legacy vanilla JS application and a new React application.

## Directory Structure

```
budget-firebase/
├── public/                    # Firebase hosting root
│   ├── index.html            # Entry point (redirects to React or legacy)
│   ├── build/                # React production build output
│   │   └── index.html        # React app entry
│   └── legacy/               # Legacy vanilla JS application
│       ├── index.html        # Legacy app entry
│       ├── pages/            # Legacy page templates
│       ├── modals/           # Legacy modal templates
│       ├── *.js              # Legacy JavaScript files
│       └── *.css             # Legacy CSS files
│
├── budget-react/             # React application source
│   ├── src/                  # React source files
│   ├── package.json          # React dependencies
│   └── vite.config.ts        # Vite configuration
│
├── functions/                # Firebase Cloud Functions
│   ├── index.js              # API endpoints
│   └── package.json          # Functions dependencies
│
├── firebase.json             # Firebase configuration
└── package.json              # Root package scripts
```

## Development

### Running the Applications

1. **Legacy Application Only**:
   ```bash
   npm run dev:legacy
   # Access at http://localhost:5000/legacy/
   ```

2. **React Application (Development)**:
   ```bash
   npm run dev:react
   # Access at http://localhost:3000
   ```

3. **Both Applications (Production mode)**:
   ```bash
   npm run serve
   # Legacy: http://localhost:5000/legacy/
   # React: http://localhost:5000/build/
   ```

### Building

**Build React for Production**:
```bash
npm run build:react
```

This builds the React app to `/public/build/`

### Deployment

**Deploy Everything**:
```bash
npm run deploy
```

**Deploy Only Hosting**:
```bash
npm run deploy:hosting
```

**Deploy Only Functions**:
```bash
npm run deploy:functions
```

## URL Structure

- `/` - Main entry point (auto-redirects)
- `/build/` - React application (if built)
- `/legacy/` - Legacy vanilla JS application
- `/api/*` - API endpoints (Cloud Functions)

## Migration Status

### Completed ✅
- Project restructuring
- Legacy app moved to `/public/legacy/`
- React app setup with TypeScript
- Routing configuration
- Build pipeline configured
- Firebase hosting updated

### In Progress 🚧
- React component migration
- API integration in React
- Authentication setup in React

### Pending ⏳
- Complete UI migration to React
- State management setup
- Testing setup
- Performance optimization

## Notes

1. **API Endpoints**: Both applications use the same `/api/*` endpoints
2. **Authentication**: Firebase Auth is configured for both versions
3. **Database**: Shared Firestore database
4. **Gradual Migration**: Both apps can run simultaneously during migration
5. **Build Output**: React builds to `/public/build/` automatically

## Quick Commands

```bash
# Install dependencies
cd budget-react && npm install

# Start React dev server
cd budget-react && npm run dev

# Build React
cd budget-react && npm run build

# Deploy to Firebase
firebase deploy

# View Firebase hosting locally
firebase serve
```