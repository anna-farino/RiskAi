import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/queryClient';
import { X, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../../components/ui/alert-dialog';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../hooks/use-toast';

interface Article {
  id: string;
  title: string;
  threatName: string;
  vulnerabilityId: string;
  summary: string;
  impacts: string;
  attackVector: string;
  microsoftConnection: string;
  targetOS: string;
  sourcePublication: string;
  sourceUrl: string;
}

interface Report {
  id: string;
  topic: string;
  createdAt: Date;
}

export default function NewsResearch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // State management
  const [url, setUrl] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedArticles, setSelectedArticles] = useState<Article[]>([]);
  const [reportTopic, setReportTopic] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showUrlDropdown, setShowUrlDropdown] = useState(false);
  const [savedUrls] = useState<string[]>([]);
  const [showSelectedArticlesOverlay, setShowSelectedArticlesOverlay] = useState(false);
  const [isViewportMobile, setIsViewportMobile] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmDescription, setConfirmDescription] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [showAddToExistingDialog, setShowAddToExistingDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);

  const articlesPerPage = 6;

  // Check viewport size
  useEffect(() => {
    const checkViewport = () => {
      setIsViewportMobile(window.innerWidth < 1024);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Fetch articles
  const { data: articles = [], isLoading: articlesLoading } = useQuery({
    queryKey: ['/api/news-capsule/articles'],
    refetchInterval: 5000,
  });

  // Fetch reports
  const { data: todaysReports = [] } = useQuery<Report[]>({
    queryKey: ['/api/news-capsule/reports'],
  });

  const processedArticles = articles.filter((article: Article) => !article.markedForDeletion);

  // Mutations
  const createReportMutation = useMutation({
    mutationFn: (data: { articleIds: string[]; topic?: string }) =>
      apiRequest('/api/news-capsule/create-report', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/news-capsule/reports'] });
      setSelectedArticles([]);
      setReportTopic('');
      setSuccessMessage('Report created successfully!');
      setShowSuccessDialog(true);
      if (isViewportMobile) setShowSelectedArticlesOverlay(false);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create report. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const addToExistingReportMutation = useMutation({
    mutationFn: (data: { reportId: string; articleIds: string[] }) =>
      apiRequest('/api/news-capsule/add-to-report', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/news-capsule/reports'] });
      setSelectedArticles([]);
      setSuccessMessage('Articles added to report successfully!');
      setShowSuccessDialog(true);
      if (isViewportMobile) setShowSelectedArticlesOverlay(false);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to add articles to report. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const deleteArticleMutation = useMutation({
    mutationFn: (articleId: string) =>
      apiRequest(`/api/news-capsule/delete-article/${articleId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/news-capsule/articles'] });
      setSuccessMessage('Article deleted successfully!');
      setShowSuccessDialog(true);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to delete article. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Helper functions
  const processUrl = async () => {
    if (!url.trim()) return;
    
    setIsLoading(true);
    try {
      const urls = bulkMode ? url.split('\n').filter(u => u.trim()) : [url];
      
      for (const singleUrl of urls) {
        if (singleUrl.trim()) {
          await apiRequest('/api/news-capsule/process-url', {
            method: 'POST',
            body: JSON.stringify({ url: singleUrl.trim() }),
          });
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/news-capsule/articles'] });
      setUrl('');
      setSuccessMessage(`Successfully processed ${urls.length} URL${urls.length === 1 ? '' : 's'}!`);
      setShowSuccessDialog(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process URL(s). Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearUrl = () => setUrl('');

  const selectSavedUrl = (savedUrl: string) => {
    setUrl(savedUrl);
    setShowUrlDropdown(false);
  };

  const selectForReport = (article: Article) => {
    if (!selectedArticles.some(selected => selected.id === article.id)) {
      setSelectedArticles(prev => [...prev, article]);
    }
  };

  const removeProcessedArticle = (article: Article) => {
    setSelectedArticles(prev => prev.filter(selected => selected.id !== article.id));
  };

  const removeSelectedArticle = (articleId: string) => {
    setSelectedArticles(prev => prev.filter(article => article.id !== articleId));
  };

  const confirmDeleteArticle = () => {
    if (articleToDelete) {
      deleteArticleMutation.mutate(articleToDelete.id);
      setShowDeleteDialog(false);
      setArticleToDelete(null);
    }
  };

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0 flex-1 px-4 lg:px-0">
        {/* URL Input Section */}
        <div className="w-full lg:flex-1 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
          {/* Header Section */}
          <div className="px-4 sm:px-5 py-4 border-b border-slate-700/50 bg-slate-800/30">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Add URLs for Processing</h2>
                <p className="text-sm text-slate-400 mt-1">Enter one or multiple article URLs to analyze</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-medium">Mode:</span>
                <button
                  onClick={() => setBulkMode(!bulkMode)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 min-w-[60px] ${
                    bulkMode 
                      ? 'bg-[#BF00FF] text-white shadow-md' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                  }`}
                >
                  {bulkMode ? 'Bulk' : 'Single'}
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-4 sm:p-5">
            <div className="space-y-4">
              <div className="relative">
                {bulkMode ? (
                  <textarea
                    id="url-input"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/article1&#10;https://example.com/article2&#10;https://example.com/article3"
                    rows={4}
                    className="w-full px-4 py-3 text-sm bg-slate-800/50 border border-slate-700 rounded-lg resize-vertical focus:ring-2 focus:ring-[#BF00FF]/50 focus:border-[#BF00FF]/50 transition-all"
                  />
                ) : (
                  <input
                    id="url-input"
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onFocus={() => setShowUrlDropdown(true)}
                    onBlur={() => setTimeout(() => setShowUrlDropdown(false), 200)}
                    placeholder="https://example.com/article"
                    autoComplete="off"
                    className="w-full px-4 py-3 text-sm bg-slate-800/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-[#BF00FF]/50 focus:border-[#BF00FF]/50 transition-all"
                  />
                )}
                
                {showUrlDropdown && savedUrls.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden z-20 max-h-48 overflow-y-auto shadow-xl">
                    {savedUrls.map((savedUrl, index) => (
                      <button
                        key={index}
                        onClick={() => selectSavedUrl(savedUrl)}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-slate-700 truncate border-b border-slate-700/50 last:border-b-0"
                      >
                        {savedUrl}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 justify-end">
                {url && (
                  <button
                    type="button"
                    onClick={clearUrl}
                    className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-all"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={processUrl}
                  disabled={isLoading || !url.trim()}
                  className="px-6 py-2.5 bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
                >
                  {isLoading ? "Processing..." : "Process URLs"}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Processed Articles Section */}
        <div className="w-full lg:flex-1 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
          {/* Header Section */}
          <div className="px-4 sm:px-5 py-4 border-b border-slate-700/50 bg-slate-800/30">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Processed Articles</h2>
                <p className="text-sm text-slate-400 mt-1">
                  {articlesLoading ? 'Loading articles...' : 
                   processedArticles.length === 0 ? 'No articles processed yet' :
                   `${processedArticles.length} article${processedArticles.length === 1 ? '' : 's'} ready for review`}
                </p>
              </div>
              {processedArticles.length > articlesPerPage && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span>Page {currentPage} of {Math.ceil(processedArticles.length / articlesPerPage)}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="min-h-[400px] p-4 sm:p-5 overflow-y-auto">
            {articlesLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-slate-600 border-t-[#BF00FF] rounded-full animate-spin mb-4"></div>
                <p className="text-slate-400 text-sm">Loading articles...</p>
              </div>
            ) : processedArticles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">📄</span>
                </div>
                <p className="text-slate-400 text-sm">No articles have been processed yet.</p>
                <p className="text-slate-500 text-xs mt-1">Add URLs above to get started.</p>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  {(() => {
                    const startIdx = (currentPage - 1) * articlesPerPage;
                    const endIdx = currentPage * articlesPerPage;
                    const articlesToShow = processedArticles.slice(startIdx, endIdx);
                    return articlesToShow.map((article: Article, index: number) => (
                      <motion.div
                        key={`article-${article.id}-${index}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`relative p-4 sm:p-5 rounded-lg border transition-all duration-200 ${
                          selectedArticles.some(selected => selected.id === article.id)
                            ? 'bg-[#BF00FF]/5 border-[#BF00FF]/30 shadow-md'
                            : 'bg-slate-800/50 border-slate-700/40 hover:border-slate-600/60 hover:bg-slate-800/70'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base sm:text-lg font-medium mb-2 leading-tight break-words">
                              {article.title}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-400 break-words mb-2">
                              {article.threatName}
                            </p>
                          </div>
                          
                          <div className="flex flex-row sm:flex-col gap-2 sm:gap-2 items-center sm:items-end flex-shrink-0">
                            {!selectedArticles.some(selected => selected.id === article.id) ? (
                              <button
                                onClick={() => selectForReport(article)}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm sm:text-base font-medium min-h-[40px] sm:min-h-[44px] touch-manipulation transition-colors"
                              >
                                Select
                              </button>
                            ) : (
                              <button
                                onClick={() => removeProcessedArticle(article)}
                                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm sm:text-base font-medium min-h-[40px] sm:min-h-[44px] touch-manipulation transition-colors"
                              >
                                Selected
                              </button>
                            )}
                            
                            <button
                              onClick={() => {
                                setArticleToDelete(article);
                                setShowDeleteDialog(true);
                              }}
                              className="p-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 rounded-lg min-h-[40px] sm:min-h-[44px] min-w-[40px] sm:min-w-[44px] flex items-center justify-center touch-manipulation transition-colors"
                              aria-label="Delete article"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="text-xs sm:text-sm line-clamp-3 leading-relaxed mb-4">
                          {article.summary}
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Vulnerability ID</p>
                            <p className="break-words">{article.vulnerabilityId}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Microsoft Connection</p>
                            <div className="flex items-center gap-2">
                              {(() => {
                                const connection = article.microsoftConnection?.toLowerCase() || '';
                                if (connection.includes('yes') || connection.includes('affected') || connection.includes('related')) {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-600/20 text-red-400 rounded text-xs">
                                      <AlertTriangle className="w-3 h-3" />
                                      Connected
                                    </span>
                                  );
                                } else if (connection.includes('no') || connection.includes('unrelated') || connection.includes('not affected')) {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">
                                      <CheckCircle className="w-3 h-3" />
                                      Not Connected
                                    </span>
                                  );
                                } else {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-600/20 text-yellow-400 rounded text-xs">
                                      <AlertCircle className="w-3 h-3" />
                                      {article.microsoftConnection || 'Unknown'}
                                    </span>
                                  );
                                }
                              })()}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Impacts</p>
                            <p className="text-sm leading-relaxed">{article.impacts}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Attack Vector</p>
                            <p className="text-sm break-words">{article.attackVector}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Target OS</p>
                            <p className="text-sm break-words">{article.targetOS}</p>
                          </div>
                          <div className="sm:col-span-2">
                            <p className="text-xs text-slate-400 mb-1">Source</p>
                            <p className="text-sm break-words">{article.sourcePublication}</p>
                          </div>
                        </div>
                      </motion.div>
                    ));
                  })()}
                </div>
                
                {processedArticles.length > articlesPerPage && (
                  <div className="flex gap-2 justify-center pt-4 border-t border-slate-700/50">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-slate-700 text-white hover:bg-slate-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(processedArticles.length / articlesPerPage)))}
                      disabled={currentPage === Math.ceil(processedArticles.length / articlesPerPage)}
                      className="px-4 py-2 bg-slate-700 text-white hover:bg-slate-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Selected Articles Section */}
        <div className="relative transition-all duration-300 ease-in-out bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden order-first lg:order-last w-full lg:w-80 lg:flex-shrink-0">
          {/* Article Count Header */}
          <div className="p-4 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Selected Articles</h3>
              <span className="text-[#00FFFF] text-sm font-medium">
                {selectedArticles.length}
              </span>
            </div>
          </div>
          
          {/* Selected Articles List */}
          <div className="p-4 max-h-[400px] lg:max-h-[600px] overflow-y-auto">
            {selectedArticles.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">📋</span>
                </div>
                <p className="text-slate-400 text-sm">No articles selected</p>
                <p className="text-slate-500 text-xs mt-1">Select articles to add to a report</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedArticles.map((article, index) => (
                  <div
                    key={`selected-${article.id}-${index}`}
                    className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/40"
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <h4 className="text-sm font-medium text-white line-clamp-2 leading-tight">
                        {article.title}
                      </h4>
                      <button
                        onClick={() => removeSelectedArticle(article.id)}
                        className="flex-shrink-0 p-1 text-slate-400 hover:text-red-400 transition-colors"
                        aria-label="Remove from selection"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {article.summary}
                    </p>
                  </div>
                ))}
              </div>
            )}
            
            {/* Action Buttons */}
            {selectedArticles.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-700/50 space-y-3">
                <input
                  type="text"
                  value={reportTopic}
                  onChange={(e) => setReportTopic(e.target.value)}
                  placeholder="Enter report topic..."
                  className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-[#BF00FF]/50 focus:border-[#BF00FF]/50 transition-all"
                />
                
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      if (selectedArticles.length > 0) {
                        if (reportTopic.trim()) {
                          createReportMutation.mutate({
                            articleIds: selectedArticles.map(article => article.id),
                            topic: reportTopic
                          });
                        } else {
                          setShowConfirmDialog(true);
                        }
                      }
                    }}
                    disabled={createReportMutation.isPending || addToExistingReportMutation.isPending}
                    className="w-full px-4 py-2.5 bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
                  >
                    {createReportMutation.isPending ? "Creating..." : "New Report"}
                  </button>
                  
                  <button
                    onClick={() => setShowAddToExistingDialog(true)}
                    disabled={createReportMutation.isPending || addToExistingReportMutation.isPending}
                    className="w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
                  >
                    Add to Existing
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Success</DialogTitle>
            <DialogDescription>{successMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowSuccessDialog(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Article</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this article? This action cannot be undone.
              {articleToDelete && (
                <div className="mt-2 p-2 bg-slate-800 rounded text-sm">
                  <strong>{articleToDelete.title}</strong>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteDialog(false);
              setArticleToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteArticle}
              disabled={deleteArticleMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteArticleMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}