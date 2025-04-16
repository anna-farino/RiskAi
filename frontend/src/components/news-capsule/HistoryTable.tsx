import React from 'react';
import { HistoryItem, SeverityType } from '@/lib/news-capsule-types';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/query-client';
import { queryClient } from '@/lib/query-client';
import { useLocation } from 'wouter';

interface HistoryTableProps {
  history: HistoryItem[];
  onDeleteItem: (id: number) => void;
}

const HistoryTable: React.FC<HistoryTableProps> = ({ history, onDeleteItem }) => {
  const { toast } = useToast();
  const [_, navigate] = useLocation();

  // Helper to format date strings
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get severity badge class
  const getSeverityBadgeClass = (severity: SeverityType) => {
    const classes: Record<SeverityType, string> = {
      'critical': 'severity-critical',
      'high': 'severity-high',
      'medium': 'severity-medium',
      'low': 'severity-low'
    };
    return classes[severity] || 'severity-medium';
  };

  // View a history item
  const handleViewItem = (articleId: number) => {
    // Navigate to analysis page with the article ID
    navigate(`/?id=${articleId}`);
  };

  // Copy a report from history
  const handleCopyReport = (item: HistoryItem) => {
    const { article, analysis } = item;
    
    const reportText = `
MICROSOFT SECURITY THREAT REPORT
Title: ${article.title}
Source: ${article.source}
Date: ${article.date}

SEVERITY: ${analysis.severity.toUpperCase()}

EXECUTIVE SUMMARY:
${analysis.summary}

AFFECTED MICROSOFT PRODUCTS:
${analysis.affectedProducts.map(p => `- ${p.name}${p.versions ? ` (${p.versions})` : ''}`).join('\n')}

THREATS IDENTIFIED:
${analysis.threats.map(t => `- ${t.name} (${t.type})${t.cve ? ` [${t.cve}]` : ''}\n  ${t.details}`).join('\n\n')}

TECHNICAL DETAILS:
${analysis.technicalDetails}

RECOMMENDATIONS:
${analysis.recommendations.split('\n').join('\n- ')}
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

  // Delete a history item
  const handleDeleteItem = async (id: number) => {
    try {
      await apiRequest('DELETE', `/api/history/${id}`);
      onDeleteItem(id);
      
      toast({
        title: "Item Deleted",
        description: "History item has been removed",
        variant: "default",
      });
    } catch (error) {
      console.error('Error deleting history item:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete history item",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-card rounded-lg shadow-lg border border-border overflow-hidden">
      <table className="min-w-full divide-y divide-border">
        <thead>
          <tr>
            <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Article</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Source</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Severity</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {history.length > 0 ? (
            history.map((item) => (
              <tr key={item.article.id} className="hover:bg-muted/50">
                <td className="px-5 py-4 whitespace-nowrap text-sm">
                  {formatDate(item.article.analyzedAt)}
                </td>
                <td className="px-5 py-4">
                  <div className="text-foreground font-medium">{item.article.title}</div>
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-sm">{item.article.source}</td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-md ${getSeverityBadgeClass(item.analysis.severity as SeverityType)}`}>
                    {item.analysis.severity.charAt(0).toUpperCase() + item.analysis.severity.slice(1)}
                  </span>
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-sm">
                  <div className="flex space-x-2">
                    <button 
                      className="text-muted-foreground hover:text-foreground"
                      title="View"
                      onClick={() => handleViewItem(item.article.id)}
                    >
                      <i className="fas fa-eye"></i>
                    </button>
                    <button 
                      className="text-muted-foreground hover:text-foreground"
                      title="Copy"
                      onClick={() => handleCopyReport(item)}
                    >
                      <i className="fas fa-copy"></i>
                    </button>
                    <button 
                      className="text-muted-foreground hover:text-destructive"
                      title="Delete"
                      onClick={() => handleDeleteItem(item.article.id)}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                <div className="flex flex-col items-center">
                  <i className="fas fa-clock-rotate-left text-3xl mb-2"></i>
                  <p>No history items found.</p>
                  <p className="text-sm mt-1">Analyzed articles will appear here.</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default HistoryTable;
