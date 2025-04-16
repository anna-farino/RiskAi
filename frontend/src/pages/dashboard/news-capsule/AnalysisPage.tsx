import { useState, useEffect } from 'react';
import UrlInput from '@/components/news-capsule/UrlInput';
import AnalysisLoading from '@/components/news-capsule/AnalysisLoading';
import AnalysisResults from '@/components/news-capsule/AnalysisResults';
import ExportModal from '@/components/news-capsule/ExportModal';
import { PublicationForm } from '@/components/news-capsule/PublicationForm';
import { ArticleWithAnalysis } from '@/lib/news-capsule-types';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNewsCapsuleStore } from '@/store/news-capsule-store';
import { serverUrl } from '@/utils/server-url';
import { csfrHeaderObject } from '@/utils/csrf-header';


export default function AnalysisPage() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();
  const [location] = useLocation();

  const {
    currentReport,
    showExportModal,
    setShowExportModal,
    allReports,
    setAllReports,
    setCurrentReport
  } = useNewsCapsuleStore()
  
  function prepareAllReports(data: ArticleWithAnalysis) {
      const exists = allReports.findIndex(r => 
        r.article.url === data.article.url
      );
      
      if (exists >= 0) {
        const newReports = [...allReports];
        newReports[exists] = data;
        return newReports;
      } else {
        return [...allReports, data];
      }
  }
  const onAnalysisComplete = (data: ArticleWithAnalysis) => {
    setCurrentReport(data);
    setAllReports(prepareAllReports(data))
  };
  
  // Check if there's an article ID in the URL to load
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1]);
    const articleId = params.get('id');
    
    if (articleId) {
      loadArticleById(parseInt(articleId));
    }
  }, [location]);
  
  // Function to load an article by ID
  const loadArticleById = async (id: number) => {
    try {
      setIsLoading(true);
      const response = await fetch(serverUrl + `/api/news-capsule/analysis/${id}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...csfrHeaderObject()
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch article analysis');
      }
      
      const data = await response.json();
      onAnalysisComplete(data);
    } catch (error) {
      console.error('Error loading article:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load the requested analysis",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to handle the results of analysis
  const handleAnalysisComplete = (data: ArticleWithAnalysis) => {
    onAnalysisComplete(data);
  };
  
  return (
    <div>
      {/* Content Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">New News Capsule</h1>
        <p className="text-muted-foreground">Create a News Capsule by extracting and analyzing security threats from cybersecurity articles with focus on Microsoft products.</p>
      </div>
      
      {/* Input Tabs Section */}
      <Tabs defaultValue="url" className="mb-8">
        <TabsList className="mb-4 flex flex-row gap-2 w-fit">
          <TabsTrigger value="url">URL Analysis</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>
        
        <TabsContent value="url">
          <UrlInput 
            onAnalysisComplete={handleAnalysisComplete}
            setIsLoading={setIsLoading}
          />
        </TabsContent>
        
        <TabsContent value="resources">
          <div className="space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-xl font-semibold mb-2">Manual Publication Entry</h2>
              <p className="text-muted-foreground">
                Add a cybersecurity article manually for analysis.
              </p>
            </div>
            <PublicationForm onPublicationComplete={handleAnalysisComplete} />
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Analysis Results or Loading State */}
      <div className="space-y-8 mt-8">
        {isLoading ? (
          <AnalysisLoading />
        ) : (
          currentReport && <AnalysisResults data={currentReport} />
        )}
      </div>
      
      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          currentReport={currentReport}
          allReports={allReports}
        />
      )}
    </div>
  );
};

