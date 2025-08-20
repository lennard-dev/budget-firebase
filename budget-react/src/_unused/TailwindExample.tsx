import React from 'react';
import { Button, Paper } from '@mui/material';

const TailwindExample: React.FC = () => {
  return (
    <div className="p-8 bg-app-bg min-h-screen">
      {/* Using Tailwind classes */}
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-text-primary mb-6">
          Tailwind + Material-UI Example
        </h1>
        
        {/* Tailwind-styled card */}
        <div className="bg-white rounded-lg shadow-card p-6 mb-6">
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            Pure Tailwind Card
          </h2>
          <p className="text-text-secondary">
            This card is styled entirely with Tailwind utility classes.
          </p>
          <button className="mt-4 px-4 py-2 bg-primary-blue text-white rounded-lg hover:bg-blue-600 transition-colors">
            Tailwind Button
          </button>
        </div>

        {/* MUI Paper with Tailwind classes */}
        <Paper className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2">
            MUI Paper + Tailwind Classes
          </h2>
          <p className="text-gray-600 mb-4">
            This uses MUI's Paper component with Tailwind spacing and typography.
          </p>
          <Button variant="contained" className="mr-2">
            MUI Button
          </Button>
          <button className="px-4 py-2 bg-success-green text-white rounded hover:bg-green-600">
            Tailwind Button
          </button>
        </Paper>

        {/* Grid example using Tailwind */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-card">
            <div className="text-sm text-text-muted uppercase mb-1">Revenue</div>
            <div className="text-2xl font-bold text-text-primary">€4,350</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-card">
            <div className="text-sm text-text-muted uppercase mb-1">Expenses</div>
            <div className="text-2xl font-bold text-danger-red">€2,150</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-card">
            <div className="text-sm text-text-muted uppercase mb-1">Profit</div>
            <div className="text-2xl font-bold text-success-green">€2,200</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-card">
            <div className="text-sm text-text-muted uppercase mb-1">Pending</div>
            <div className="text-2xl font-bold text-primary-blue">€850</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TailwindExample;