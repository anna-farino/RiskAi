import React from 'react';
import { Logo } from '@/components/ui/logo';
import { RisqLayout } from '@/components/layout/RisqLayout';

export function TestLogo() {
  return (
    <RisqLayout>
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-8 p-4 pt-16">
        <h1 className="text-2xl font-semibold mb-8">RisqAi Logo Test Page</h1>
        
        {/* Direct implementation to ensure visibility */}
        <div className="mb-8">
          <h2 className="text-xl mb-4">Direct Implementation:</h2>
          <div className="p-6 border rounded-lg flex justify-center">
            <span style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 700,
              fontSize: "2.5rem",
              background: "linear-gradient(to right, #8A00C2, #FF00D6)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent"
            }}>
              RisqAi
            </span>
          </div>
        </div>
        
        {/* Logo component tests */}
        <div className="flex flex-col items-center gap-6 p-8 border rounded-lg w-full max-w-md">
          <h2 className="text-lg">Interactive Logo Component</h2>
          <Logo interactive />
        </div>
        
        <div className="flex flex-col items-center gap-6 p-8 border rounded-lg w-full max-w-md">
          <h2 className="text-lg font-medium mb-4">Logo Sizes</h2>
          <div className="flex flex-col gap-6 w-full">
            <div className="flex items-center justify-between">
              <span className="font-medium">Small:</span>
              <Logo size="sm" />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Medium:</span>
              <Logo size="md" />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Large:</span>
              <Logo size="lg" />
            </div>
          </div>
        </div>
        
        <div className="p-6 rounded-lg bg-black w-full max-w-md">
          <h2 className="text-white mb-4 font-medium">On Dark Background</h2>
          <div className="flex justify-center">
            <Logo interactive size="lg" />
          </div>
        </div>
      </div>
    </RisqLayout>
  );
}