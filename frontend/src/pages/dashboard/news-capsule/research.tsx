import React, { useState, useContext, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/query-client';
import { NewsCapsuleContext } from '@/context/NewsCapsuleContext';
import { TrashIcon, PlusIcon, CheckIcon, EyeIcon } from 'lucide-react';

interface ArticleSummary {
  id: string;
  title: string;
  threatName: string;
  vulnerabilityId: string;
  summary: string;
  impacts: string;
  attackVector: string;
  sourcePublication: string;
  originalUrl: string;
  targetOS: string;
  createdAt: string;
  markedForReporting: boolean;
  markedForDeletion: boolean;
}

const getSourceAppIndicator = (article: ArticleSummary) => {
  const sourceUrl = article.originalUrl.toLowerCase();
  
  if (sourceUrl.includes('www.newsroom.com') || sourceUrl.includes('newsroom.com')) {
    return { label: 'NR', color: 'bg-blue-600 text-white' };
  } else if (sourceUrl.includes('securityweek.com') || sourceUrl.includes('www.securityweek.com')) {
    return { label: 'TT', color: 'bg-red-600 text-white' };
  } else if (sourceUrl.includes('nist.gov') || sourceUrl.includes('www.nist.gov')) {
    return { label: 'NT', color: 'bg-green-600 text-white' };
  } else {
    return { label: 'M', color: 'bg-gray-600 text-white' };
  }
};

export default function Research() {
  const { selectedArticles, setSelectedArticles } = useContext(NewsCapsuleContext);
  const [url, setUrl] = useState('');
  const [urls, setUrls] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [reportTopic, setReportTopic] = useState(localStorage.getItem('reportTopic') || '');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'source'>('date');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const queryClient = useQueryClient();

  // Fetch processed articles
  const { data: processedArticles = [], refetch } = useQuery({
    queryKey: ['/api/news-capsule/get-reports-simplified'],
    enabled: true
  });

  const [articles, setProcessedArticles] = useState<ArticleSummary[]>([]);

  useEffect(() => {
    if (processedArticles && Array.isArray(processedArticles)) {
      const filteredArticles = processedArticles.filter((article: any) => {
        return article && typeof article === 'object' && 
               article.title && 
               article.title.trim() !== '' &&
               !article.title.includes('www.') &&
               !article.markedForDeletion;
      });

      const uniqueArticles = filteredArticles.filter((article: any, index: number, self: any[]) => 
        index === self.findIndex((a: any) => a.id === article.id)
      );

      setProcessedArticles(uniqueArticles);
    }
  }, [processedArticles]);

  const addUrlMutation = useMutation({
    mutationFn: (urlData: { url: string }) => 
      apiRequest('/api/news-capsule/process-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(urlData)
      }),
    onSuccess: () => {
      refetch();
      setStatusMessage('URL processed successfully!');
      setTimeout(() => setStatusMessage(''), 3000);
    },
    onError: (error: any) => {
      console.error('Error processing URL:', error);
      setStatusMessage('Error processing URL. Please try again.');
      setTimeout(() => setStatusMessage(''), 5000);
    }
  });

  const markForReportingMutation = useMutation({
    mutationFn: ({ articleId, markedForReporting }: { articleId: string, markedForReporting: boolean }) =>
      apiRequest('/api/news-capsule/add-to-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, markedForReporting })
      }),
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      console.error('Error updating article:', error);
    }
  });

  const deleteArticleMutation = useMutation({
    mutationFn: (articleId: string) =>
      apiRequest('/api/news-capsule/add-to-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, markedForDeletion: true })
      }),
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      console.error('Error deleting article:', error);
    }
  });

  const addUrl = () => {
    if (url.trim()) {
      setUrls([...urls, url.trim()]);
      setUrl('');
    }
  };

  const removeUrl = (index: number) => {
    setUrls(urls.filter((_, i) => i !== index));
  };

  const processUrls = async () => {
    if (urls.length === 0) return;
    
    setIsProcessing(true);
    setStatusMessage('Processing URLs...');
    
    try {
      for (let i = 0; i < urls.length; i++) {
        setStatusMessage(`Processing URL ${i + 1} of ${urls.length}...`);
        await addUrlMutation.mutateAsync({ url: urls[i] });
      }
      setUrls([]);
      setStatusMessage('All URLs processed successfully!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error) {
      console.error('Error processing URLs:', error);
      setStatusMessage('Error processing some URLs. Please check and try again.');
      setTimeout(() => setStatusMessage(''), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  const selectForReport = (article: ArticleSummary) => {
    const newMarkedState = !article.markedForReporting;
    markForReportingMutation.mutate({
      articleId: article.id,
      markedForReporting: newMarkedState
    });

    if (newMarkedState && !selectedArticles.find(a => a.id === article.id)) {
      setSelectedArticles([...selectedArticles, article]);
    } else if (!newMarkedState) {
      setSelectedArticles(selectedArticles.filter(a => a.id !== article.id));
    }
  };

  const deleteArticle = (articleId: string) => {
    deleteArticleMutation.mutate(articleId);
    setSelectedArticles(selectedArticles.filter(a => a.id !== articleId));
  };

  // Filter and search logic
  const filteredArticles = articles.filter(article => {
    if (showSelectedOnly && !article.markedForReporting) return false;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        article.title?.toLowerCase().includes(searchLower) ||
        article.threatName?.toLowerCase().includes(searchLower) ||
        article.summary?.toLowerCase().includes(searchLower) ||
        article.sourcePublication?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  // Sort articles
  const sortedArticles = [...filteredArticles].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'title':
        return a.title.localeCompare(b.title);
      case 'source':
        return a.sourcePublication.localeCompare(b.sourcePublication);
      default:
        return 0;
    }
  });

  // Pagination
  const totalPages = Math.ceil(sortedArticles.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedArticles = sortedArticles.slice(startIndex, startIndex + itemsPerPage);

  const clearFilters = () => {
    setSearchTerm('');
    setShowSelectedOnly(false);
    setSortBy('date');
    setCurrentPage(1);
    setProcessedArticles(processedArticles.filter((article: any) => {
      return article && typeof article === 'object' && 
             article.title && 
             article.title.trim() !== '' &&
             !article.title.includes('www.') &&
             !article.markedForDeletion;
    }));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Capsule Research</h1>
        <p className="text-slate-300">
          Analyze articles for executive reporting by submitting URLs for processing.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* URL Input Section */}
        <div className="md:col-span-2 p-5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl">
          <h2 className="text-xl font-semibold mb-4">Add One or Multiple URLs</h2>
          
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addUrl()}
                placeholder="Enter article URL..."
                className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700/40 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={addUrl}
                disabled={!url.trim()}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>

            {urls.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-slate-300">URLs to Process:</h3>
                {urls.map((urlItem, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-slate-800/30 rounded-lg">
                    <span className="flex-1 text-sm text-slate-300 truncate">{urlItem}</span>
                    <button
                      onClick={() => removeUrl(index)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={processUrls}
                  disabled={isProcessing || urls.length === 0}
                  className="w-full px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Processing...' : `Process ${urls.length} URL${urls.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}

            {statusMessage && (
              <div className="p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
                <p className="text-sm text-blue-300">{statusMessage}</p>
              </div>
            )}
          </div>
        </div>

        {/* Selected Articles Section */}
        <div className="p-5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Selected Articles</h2>
            <span className="text-sm text-slate-400">
              {selectedArticles.length} selected
            </span>
          </div>
          
          {/* Report Topic Field */}
          <div className="mb-4">
            <label htmlFor="reportTopic" className="block text-sm text-slate-300 mb-2">
              Report Topic (Optional)
            </label>
            <input
              id="reportTopic"
              type="text"
              value={reportTopic}
              onChange={(e) => {
                setReportTopic(e.target.value);
                localStorage.setItem('reportTopic', e.target.value);
              }}
              placeholder="Enter a topic (Optional)"
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/40 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {selectedArticles.length === 0 ? (
            <p className="text-sm text-slate-400">No articles selected for reporting.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {selectedArticles.map((article) => (
                <div key={article.id} className="p-3 bg-slate-800/30 rounded-lg">
                  <h4 className="text-sm font-medium text-slate-200 mb-1">
                    {article.title}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {article.sourcePublication}
                  </p>
                </div>
              ))}
            </div>
          )}

          {selectedArticles.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <button
                onClick={() => window.location.href = '/dashboard/news-capsule/reports'}
                className="w-full px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg"
              >
                Create Executive Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Processed Articles Section */}
      <div className="p-5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Processed Articles ({articles.length})</h2>
            <button
              onClick={clearFilters}
              className="px-3 py-1 text-sm bg-slate-700 text-slate-300 hover:bg-slate-600 rounded-md"
            >
              Clear Filters
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search articles..."
              className="px-3 py-2 bg-slate-800/50 border border-slate-700/40 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'title' | 'source')}
              className="px-3 py-2 bg-slate-800/50 border border-slate-700/40 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="date">Sort by Date</option>
              <option value="title">Sort by Title</option>
              <option value="source">Sort by Source</option>
            </select>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={showSelectedOnly}
                onChange={(e) => setShowSelectedOnly(e.target.checked)}
                className="rounded"
              />
              Show Selected Only
            </label>
          </div>
        </div>

        {/* Articles Grid */}
        <div className="grid gap-4">
          {paginatedArticles.map((article) => {
            const indicator = getSourceAppIndicator(article);
            return (
              <div
                key={article.id}
                className="p-4 bg-slate-800/30 border border-slate-700/30 rounded-lg hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-slate-200 mb-2">
                      {article.title}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-slate-400">Threat:</span>
                        <span className="text-slate-200 ml-1">{article.threatName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">CVE ID:</span>
                        <span className="text-slate-200 ml-1">{article.vulnerabilityId}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Target OS:</span>
                        <span className="text-slate-200 ml-1">{article.targetOS}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Source:</span>
                        <span className="text-slate-200 ml-1">{article.sourcePublication}</span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm text-slate-300 line-clamp-3">
                        {article.summary}
                      </p>
                    </div>

                    <div className="mt-3 text-xs text-slate-500">
                      {new Date(article.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 items-end">
                    <div className="flex gap-2">
                      <button
                        onClick={() => selectForReport(article)}
                        className={`p-2 rounded-lg transition-colors ${
                          article.markedForReporting
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                        title={article.markedForReporting ? 'Remove from report' : 'Add to report'}
                      >
                        <CheckIcon className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => window.open(article.originalUrl, '_blank')}
                        className="p-2 bg-slate-700 text-slate-300 hover:bg-slate-600 rounded-lg"
                        title="View original article"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => deleteArticle(article.id)}
                        className="p-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg"
                        title="Delete article"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className={`px-2 py-1 text-xs font-medium rounded ${indicator.color}`}>
                      {indicator.label}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-6">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-slate-700 text-white hover:bg-slate-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <span className="text-sm text-slate-400">
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-slate-700 text-white hover:bg-slate-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}