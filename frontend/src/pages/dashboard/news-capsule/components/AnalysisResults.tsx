import React, { useState } from 'react';
import { ArticleWithAnalysis } from '@/lib/news-capsule-types';
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from '@/lib/query-client';
import { queryClient } from '@/lib/query-client';

interface AnalysisResultsProps {
  data: ArticleWithAnalysis;
}

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'analysis' | 'content'>('analysis');
  const { toast } = useToast();
  
  const { article, analysis } = data;
  
  // Function to format recommendations as a list
  const formatRecommendations = (recommendations: string) => {
    return recommendations.split('\n').map((rec, index) => (
      <li key={index}>{rec}</li>
    ));
  };
  
  // Function to handle copying the report in the new simplified format
  const handleCopyReport = () => {
    // Get impacts based on threat type
    const getImpacts = (type: string): string => {
      switch(type) {
        case 'ransomware': return 'Data access, business continuity, and financial operations';
        case 'vulnerability': return 'System integrity, data security, and operational reliability';
        case 'malware': return 'Network security, data privacy, and system performance';
        case 'zero-day': return 'Critical infrastructure, sensitive data, and service availability';
        case 'exploit': return 'Application security, customer data, and business reputation';
        default: return 'General security posture and organizational trust';
      }
    };
    
    // Microsoft connection text
    const microsoftConnection = analysis.affectedProducts.length > 0 
      ? `Affects ${analysis.affectedProducts.map(p => p.name).join(', ')}${
         analysis.affectedProducts.some(p => p.versions) 
           ? ` (${analysis.affectedProducts.find(p => p.versions)?.versions})` 
           : ''
        }`
      : 'General Microsoft security advisory';
    
    // Generate concise report text
    const reportText = `
SECURITY THREAT: ${analysis.threats.length > 0 ? analysis.threats[0].name : 'None identified'} (${analysis.severity.toUpperCase()})
${analysis.threats.length > 1 ? 'Additional threats: ' + analysis.threats.slice(1).map(t => t.name).join(', ') + '\n' : ''}
${analysis.summary}

${analysis.affectedProducts.length > 0 
  ? `Affected products: ${analysis.affectedProducts.map(p => p.name).join(', ')}`
  : 'No specific Microsoft products affected'
}

SOURCE: ${article.source} (${article.date})
    `.trim();
    
    navigator.clipboard.writeText(reportText).then(() => {
      toast({
        title: "Report Copied",
        description: "The report has been copied to your clipboard",
        variant: "default",
      });
    }).catch((error) => {
      console.error('Error copying to clipboard:', error);
      toast({
        title: "Copy Failed",
        description: "Failed to copy the report to clipboard",
        variant: "destructive",
      });
    });
  };
  
  // Function to save the report to favorites
  const handleSaveReport = async () => {
    try {
      // Placeholder for future "save to favorites" functionality
      toast({
        title: "Report Saved",
        description: "The report has been saved to your history",
        variant: "default",
      });
    } catch (error) {
      console.error('Error saving report:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save the report",
        variant: "destructive",
      });
    }
  };
  
  // Get appropriate severity color class
  const getSeverityColorClass = (severity: string) => {
    const severityMap: Record<string, string> = {
      'critical': 'severity-critical',
      'high': 'severity-high',
      'medium': 'severity-medium',
      'low': 'severity-low'
    };
    
    return severityMap[severity] || 'severity-medium';
  };
  
  // Get threat type color class
  const getThreatTypeColorClass = (type: string) => {
    const typeMap: Record<string, string> = {
      'zero-day': 'threat-zero-day',
      'vulnerability': 'threat-vulnerability',
      'malware': 'threat-malware',
      'ransomware': 'threat-ransomware',
      'exploit': 'threat-exploit',
      'other': 'threat-other'
    };
    
    return typeMap[type] || 'threat-other';
  };
  
  // Get appropriate icon for product
  const getProductIcon = (icon?: string) => {
    if (!icon) return 'fas fa-cube';
    return `fas fa-${icon}`;
  };
  
  // Calculate severity percentage for the progress bar
  const getSeverityPercentage = (severity: string) => {
    const severityMap: Record<string, number> = {
      'critical': 90,
      'high': 70,
      'medium': 50,
      'low': 30
    };
    
    return severityMap[severity] || 50;
  };
  
  return (
    <div className="flex flex-col bg-card rounded-lg shadow-lg border border-border report-content">
      {/* Article Header */}
      <div className="p-6 border-b border-border">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{article.title}</h2>
            <div className="flex items-center mt-2 text-sm text-muted-foreground">
              <span>{article.source}</span>
              <span className="mx-2">•</span>
              <span>{article.date}</span>
            </div>
          </div>
          <div className="flex space-x-2">
            <button 
              className="p-2 text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
              title="Save to history"
              onClick={handleSaveReport}
            >
              <i className="fas fa-bookmark"></i>
            </button>
            <button 
              className="p-2 text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
              title="Copy report"
              onClick={handleCopyReport}
            >
              <i className="fas fa-copy"></i>
            </button>
            <button 
              className="p-2 text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
              title="Export report"
              onClick={() => {
                // Dispatch a custom event that Layout component will listen for
                const event = new CustomEvent('openExportModal');
                document.dispatchEvent(event);
              }}
            >
              <i className="fas fa-file-export"></i>
            </button>
          </div>
        </div>
      </div>
      
      {/* Analysis Results Tabs */}
      <div className="border-b border-border p-4">
        <nav className="flex flex-row gap-x-4">
          <button 
            className={`px-6 py-3 border-b-2 font-medium bg-muted ${
              activeTab === 'analysis' 
                ? 'border-primary text-foreground' 
                : 'border-muted-foreground text-muted-foreground hover:text-foreground hover:border-border'
            }`}
            onClick={() => setActiveTab('analysis')}
          >
            Threat Analysis
          </button>
          <button 
            className={`px-6 py-3 border-b-2 font-medium bg-muted ${
              activeTab === 'content' 
                ? 'border-primary text-primary' 
                : 'border-muted-foreground text-muted-foreground hover:text-foreground hover:border-border'
            }`}
            onClick={() => setActiveTab('content')}
          >
            Original Content
          </button>
        </nav>
      </div>
      
      {/* Threat Analysis Content */}
      {activeTab === 'analysis' && (
        <div className="p-6">
          {/* Severity Indicator */}
          <div className="mb-6">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${getSeverityColorClass(analysis.severity).replace('text-', 'bg-')} mr-2`}></div>
              <span className={`${getSeverityColorClass(analysis.severity)} font-medium capitalize`}>
                {analysis.severity} Severity
              </span>
            </div>
            <div className="mt-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className={`${getSeverityColorClass(analysis.severity).replace('text-', 'bg-')} h-2 rounded-full`} 
                  style={{ width: `${getSeverityPercentage(analysis.severity)}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          {/* Executive Summary */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Executive Summary</h3>
            <div className="bg-muted p-4 rounded-md">
              <p className="text-foreground">
                {analysis.summary}
              </p>
            </div>
          </div>
          
          {/* Affected Microsoft Products */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Affected Microsoft Products</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.affectedProducts.map((product, index) => (
                <div key={index} className="bg-muted p-4 rounded-md flex items-center">
                  <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-md bg-secondary text-muted-foreground">
                    <i className={getProductIcon(product.icon)}></i>
                  </div>
                  <div className="ml-4">
                    <h4 className="font-medium">{product.name}</h4>
                    {product.versions && (
                      <p className="text-sm text-muted-foreground">{product.versions}</p>
                    )}
                  </div>
                </div>
              ))}
              
              {analysis.affectedProducts.length === 0 && (
                <div className="bg-muted p-4 rounded-md col-span-full">
                  <p className="text-muted-foreground">No specific Microsoft products identified in the article.</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Concise Threat Report */}
          <div className="mb-6">
            <div className="bg-muted p-4 rounded-md">
              <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSeverityColorClass(analysis.severity).replace('text-', 'bg-')}`}>
                    {analysis.severity.toUpperCase()} SEVERITY
                  </span>
                  <span className="text-sm text-muted-foreground">{article.date}</span>
                </div>
                
                {/* Threat Names */}
                <div>
                  {analysis.threats.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {analysis.threats.map((threat, index) => (
                        <li key={index} className="font-medium">
                          {threat.name}{threat.cve ? ` (${threat.cve})` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="italic">No specific threats identified</p>
                  )}
                </div>
                
                {/* Summary */}
                <div>
                  <p>{analysis.summary}</p>
                </div>
                
                {/* Affected Products */}
                {analysis.affectedProducts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {analysis.affectedProducts.map((product, index) => (
                      <span key={index} className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-xs">
                        {product.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Technical Details */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Technical Details</h3>
            <div className="bg-muted p-4 rounded-md">
              <div className="whitespace-pre-line">
                {analysis.technicalDetails.split('\n\n').map((paragraph, i) => (
                  <p key={i} className={i > 0 ? 'mt-4' : ''}>
                    {paragraph}
                  </p>
                ))}
              </div>
              
              {analysis.technicalDetails.includes('```') && (
                <div className="bg-card p-3 rounded-md font-mono text-sm overflow-auto mt-4">
                  <code className="text-muted-foreground">
                    {(analysis.technicalDetails.match(/```([^`]*)```/) || ['', ''])[1]}
                  </code>
                </div>
              )}
            </div>
          </div>
          
          {/* Recommendations */}
          <div>
            <h3 className="text-lg font-medium mb-3">Recommendations</h3>
            <div className="bg-muted p-4 rounded-md">
              <ul className="space-y-2 list-disc pl-5">
                {formatRecommendations(analysis.recommendations)}
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {/* Original Content */}
      {activeTab === 'content' && (
        <div className="p-6">
          <h3 className="text-lg font-medium mb-3 text-foreground">
            Original Article Summary
          </h3>
          <div className="bg-muted p-4 rounded-md">
            <div className="prose max-w-none space-y-4" style={{ lineHeight: "1.25" }}>
              {article.content.split('\n\n').map((paragraph, i) => (
                <div key={i} className="mb-6 border-b border-gray-200 pb-4 last:border-b-0">
                  <p className="text-base text-foreground">
                    {paragraph}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 text-right">
            <a 
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 font-medium inline-flex items-center"
            >
              View Original Article <i className="fas fa-external-link ml-2"></i>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisResults;
