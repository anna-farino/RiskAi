import { useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import ConfirmationDialog from '@/components/news-capsule/ConfirmationDialog';
import ExportModal from '@/components/news-capsule/ExportModal';
import { ArticleWithAnalysis } from '@/lib/news-capsule-types';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/query-client';
import { useNewsCapsuleStore } from '@/store/news-capsule-store';
import { serverUrl } from '@/utils/server-url';
import { csfrHeaderObject } from '@/utils/csrf-header';
import { useNavigate } from 'react-router-dom';


export default function HistoryPage() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const { toast } = useToast();
  const navigate = useNavigate()

  const {
    allReports: reports,
    setAllReports: setReports,
    setCurrentReport,
    showExportModal,
    setShowExportModal
  } = useNewsCapsuleStore()
  
  // Load history data
  useEffect(() => {
    loadHistory();
  }, []);
  
  // Function to load history data
  const loadHistory = async () => {
    if (reports.length > 0) return; // Skip if we already have reports

    try {
      setIsLoading(true);
      const response = await fetch(serverUrl + '/api/news-capsule/history', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...csfrHeaderObject()
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }
      
      const data = await response.json();
      setReports(data.history || []);
    } catch (error) {
      console.error('Error loading history:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load analysis history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle view report
  const handleViewReport = (report: ArticleWithAnalysis) => {
    setCurrentReport(report);
    navigate("/dashboard/news-capsule/analysis");
  };

  // Handle export report
  const handleExportReport = (report: ArticleWithAnalysis) => {
    setCurrentReport(report);
    setShowExportModal(true);
  };
  
  // Handle clear all history confirmation
  const handleClearHistory = () => {
    setIsConfirmDialogOpen(true);
  };
  
  // Confirm clearing all history
  const confirmClearHistory = async () => {
    try {
      await apiRequest('DELETE', serverUrl + '/api/news-capsule/history');
      setReports([]);
      setIsConfirmDialogOpen(false);
      
      toast({
        title: "History Cleared",
        description: "All history items have been deleted",
        variant: "default",
      });
    } catch (error) {
      console.error('Error clearing history:', error);
      toast({
        title: "Clear Failed",
        description: "Failed to clear history",
        variant: "destructive",
      });
    }
  };
  
  // Handle delete single history item
  const handleDeleteItem = async (id: number) => {
    try {
      await apiRequest('DELETE', serverUrl + `/api/news-capsule/history/${id}`);
      setReports(reports.filter(item => item.article.id !== id));
      
      toast({
        title: "Item Deleted",
        description: "Analysis has been removed from history",
        variant: "default",
      });
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete analysis from history",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div>
      {/* Content Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Analysis History</h1>
          <p className="text-muted-foreground">View and manage your previously analyzed articles.</p>
        </div>
        
        <button 
          className="text-muted-foreground hover:text-destructive flex items-center text-sm"
          onClick={handleClearHistory}
          disabled={reports.length === 0}
        >
          <i className="fas fa-trash-can mr-2"></i>
          Clear History
        </button>
      </div>
      
      {/* History Table */}
      {isLoading ? (
        <div className="bg-card rounded-lg p-8 shadow-lg border border-border flex justify-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="bg-card rounded-lg p-8 shadow border border-border text-center">
              <h3 className="text-lg font-medium mb-2">No Analysis History</h3>
              <p className="text-muted-foreground mb-4">
                You haven't analyzed any articles yet.
              </p>
              <button
                className="bg-primary text-primary-foreground rounded px-4 py-2 text-sm"
                onClick={() => navigate('/dashboard/news-capsule/analysis')}
              >
                Start New Analysis
              </button>
            </div>
          ) : (
            <div className="overflow-hidden bg-card rounded-lg border border-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-medium">Article</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Source</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Severity</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((item) => (
                    <tr 
                      key={uuid()} 
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium">{item.article.title}</div>
                        <div className="text-muted-foreground text-xs truncate max-w-md">
                          {item.article.url}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{item.article.source}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{item.article.date}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium inline-block severity-${item.analysis.severity}`}>
                          {item.analysis.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewReport(item)}
                            className="text-primary hover:text-primary/80 transition-colors"
                            aria-label="View report"
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          <button
                            onClick={() => handleExportReport(item)}
                            className="text-primary hover:text-primary/80 transition-colors"
                            aria-label="Export report"
                          >
                            <i className="fas fa-download"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.article.id)}
                            className="text-destructive hover:text-destructive/80 transition-colors"
                            aria-label="Delete report"
                          >
                            <i className="fas fa-trash-can"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      
      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isConfirmDialogOpen}
        title="Confirm Deletion"
        message="Are you sure you want to delete all history items? This action cannot be undone."
        onConfirm={confirmClearHistory}
        onCancel={() => setIsConfirmDialogOpen(false)}
      />

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          currentReport={null}
          allReports={reports}
        />
      )}
    </div>
  );
};

