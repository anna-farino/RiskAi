import React from 'react';
import { RisqHeader } from './RisqHeader';
import { RisqFooter } from './RisqFooter';

interface RisqLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
  contentClassName?: string;
}

export function RisqLayout({
  children,
  showHeader = true,
  showFooter = true,
  contentClassName = '',
}: RisqLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {showHeader && <RisqHeader />}
      
      {/* Main content - adds top padding to account for fixed header */}
      <main className={`flex-grow pt-20 ${contentClassName}`}>
        {children}
      </main>
      
      {showFooter && <RisqFooter />}
    </div>
  );
}