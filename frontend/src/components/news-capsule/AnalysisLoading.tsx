import React from 'react';

const AnalysisLoading: React.FC = () => {
  return (
    <div className="bg-card rounded-lg p-8 shadow-lg border border-border flex flex-col items-center justify-center">
      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
      <h3 className="text-xl font-medium text-foreground">Analyzing article...</h3>
      <p className="text-muted-foreground mt-2">Extracting content and identifying Microsoft-related threats</p>
    </div>
  );
};

export default AnalysisLoading;
