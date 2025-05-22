import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Printer, Clipboard, CheckCircle, AlignLeft, BarChart, Loader2 } from 'lucide-react';
import { serverUrl } from '@/lib/constants';
import { csfrHeaderObject } from '@/lib/csrf';
import { useQuery } from '@tanstack/react-query';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Article type
interface Article {
  id: string;
  title: string;
  threatName: string;
  vulnerabilityId: string;
  summary: string;
  impacts: string;
  attackVector: string;
  microsoftConnection: string;
  sourcePublication: string;
  originalUrl: string;
  targetOS: string;
  createdAt: string;
  markedForReporting: boolean;
  markedForDeletion: boolean;
  userId: string;
}

export default function Reports() {
  const { toast } = useToast();
  const [reportTitle, setReportTitle] = useState('Cybersecurity Threat Intelligence Report');
  const [reportIntroduction, setReportIntroduction] = useState('This report contains a summary of recent cybersecurity threats and vulnerabilities identified through our AI-powered analysis.');
  const [exportFormat, setExportFormat] = useState('pdf');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Fetch articles marked for reporting
  const reportArticles = useQuery<Article[]>({
    queryKey: ['/api/news-capsule/articles/for-reporting'],
    queryFn: async () => {
      try {
        const response = await fetch(`${serverUrl}/api/news-capsule/articles/for-reporting`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...csfrHeaderObject()
          }
        });
        
        if (!response.ok) throw new Error('Failed to fetch articles for reporting');
        
        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error(error);
        return [];
      }
    }
  });

  const handleExportReport = () => {
    setIsGenerating(true);
    
    // In a real implementation, this would call a backend endpoint to generate 
    // the report in the selected format. For now, we'll just simulate the process.
    setTimeout(() => {
      setIsGenerating(false);
      
      toast({
        title: "Report generated",
        description: `Your ${exportFormat.toUpperCase()} report has been generated and downloaded`,
        variant: "default"
      });
    }, 2000);
  };

  const handleCopyToClipboard = () => {
    // Generate a text version of the report
    const reportText = generateReportText();
    
    // Copy to clipboard
    navigator.clipboard.writeText(reportText).then(() => {
      setIsCopied(true);
      
      toast({
        title: "Copied to clipboard",
        description: "Report content has been copied to your clipboard",
        variant: "default"
      });
      
      setTimeout(() => setIsCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard. Please try again.",
        variant: "destructive"
      });
    });
  };

  const generateReportText = () => {
    let report = `${reportTitle.toUpperCase()}\n\n`;
    report += `${reportIntroduction}\n\n`;
    report += `Generated: ${new Date().toLocaleDateString()}\n\n`;
    report += `THREATS IDENTIFIED: ${reportArticles.data?.length || 0}\n\n`;
    
    if (reportArticles.data?.length) {
      reportArticles.data.forEach((article, index) => {
        report += `THREAT #${index + 1}: ${article.title}\n`;
        report += `CVE/ID: ${article.vulnerabilityId}\n`;
        report += `Summary: ${article.summary}\n`;
        report += `Impacts: ${article.impacts}\n`;
        report += `Attack Vector: ${article.attackVector}\n`;
        report += `Affected OS: ${article.targetOS}\n`;
        report += `Source: ${article.sourcePublication}\n\n`;
      });
    }
    
    return report;
  };

  const reportPreviewContent = () => {
    if (reportArticles.isLoading) {
      return (
        <div className="h-40 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      );
    }
    
    if (!reportArticles.data?.length) {
      return (
        <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-lg text-center">
          <FileText className="h-10 w-10 text-slate-500 mx-auto mb-2" />
          <h3 className="font-medium text-lg">No articles selected for reporting</h3>
          <p className="text-slate-400 mt-1">
            Mark articles for reporting from the dashboard to include them in your report
          </p>
        </div>
      );
    }
    
    return (
      <div className="rounded-lg border border-slate-700 overflow-hidden">
        <div className="p-4 bg-slate-800">
          <h1 className="text-xl font-bold">{reportTitle}</h1>
          <p className="text-slate-300 text-sm mt-1">{reportIntroduction}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline" className="bg-blue-900/30 text-blue-300">
              Generated: {new Date().toLocaleDateString()}
            </Badge>
            <Badge variant="outline" className="bg-purple-900/30 text-purple-300">
              Threats: {reportArticles.data.length}
            </Badge>
          </div>
        </div>
        
        <div className="p-4 bg-slate-900">
          {reportArticles.data.map((article, index) => (
            <div 
              key={article.id} 
              className="mb-4 p-3 bg-slate-800 rounded-lg border border-slate-700"
            >
              <div className="flex justify-between items-start">
                <Badge>Threat #{index + 1}</Badge>
                <Badge variant="outline" className="bg-purple-900/50 text-purple-300 border-purple-700">
                  {article.vulnerabilityId !== 'Unspecified' 
                    ? article.vulnerabilityId 
                    : article.threatName.split(' ')[0]}
                </Badge>
              </div>
              <h3 className="font-medium mt-2">{article.title}</h3>
              <p className="text-sm text-slate-300 mt-1">{article.summary}</p>
              
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                <div>
                  <span className="text-slate-400">Impacts: </span>
                  <span className="text-slate-300">{article.impacts}</span>
                </div>
                <div>
                  <span className="text-slate-400">Attack Vector: </span>
                  <span className="text-slate-300">{article.attackVector}</span>
                </div>
                <div>
                  <span className="text-slate-400">OS: </span>
                  <span className="text-slate-300">{article.targetOS}</span>
                </div>
                <div>
                  <span className="text-slate-400">Source: </span>
                  <span className="text-slate-300">{article.sourcePublication}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Generate Reports</h2>
        <p className="text-slate-400">
          Create customized reports from your marked intelligence data
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlignLeft className="mr-2 h-5 w-5 text-purple-400" />
                Report Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="report-title">Report Title</Label>
                <Input
                  id="report-title"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="bg-slate-900 border-slate-700"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="report-intro">Introduction</Label>
                <Textarea
                  id="report-intro"
                  value={reportIntroduction}
                  onChange={(e) => setReportIntroduction(e.target.value)}
                  rows={3}
                  className="bg-slate-900 border-slate-700"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="export-format">Export Format</Label>
                <Select value={exportFormat} onValueChange={setExportFormat}>
                  <SelectTrigger className="bg-slate-900 border-slate-700">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF Document</SelectItem>
                    <SelectItem value="docx">Word Document</SelectItem>
                    <SelectItem value="json">JSON Data</SelectItem>
                    <SelectItem value="md">Markdown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <Button
                className="w-full bg-purple-700 hover:bg-purple-600"
                onClick={handleExportReport}
                disabled={reportArticles.isLoading || !reportArticles.data?.length || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export Report
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                className="w-full"
                onClick={handleCopyToClipboard}
                disabled={reportArticles.isLoading || !reportArticles.data?.length}
              >
                {isCopied ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Clipboard className="mr-2 h-4 w-4" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
              
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => window.print()}
                disabled={reportArticles.isLoading || !reportArticles.data?.length}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print Report
              </Button>
            </CardFooter>
          </Card>
          
          <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
            <div className="flex items-center">
              <BarChart className="h-5 w-5 text-amber-400 mr-2" />
              <h3 className="font-medium">Report Stats</h3>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Threats included:</span>
                <span className="font-medium">{reportArticles.data?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">CVEs identified:</span>
                <span className="font-medium">
                  {reportArticles.data?.filter(a => 
                    a.vulnerabilityId !== 'Unspecified' && 
                    a.vulnerabilityId.includes('CVE')
                  ).length || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Microsoft-related:</span>
                <span className="font-medium">
                  {reportArticles.data?.filter(a => 
                    a.targetOS.toLowerCase().includes('windows') || 
                    a.microsoftConnection.toLowerCase().includes('microsoft')
                  ).length || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-2">
          <div className="sticky top-4">
            <h3 className="text-lg font-medium mb-3 flex items-center">
              <FileText className="mr-2 h-5 w-5 text-purple-400" />
              Report Preview
            </h3>
            
            {reportPreviewContent()}
          </div>
        </div>
      </div>
    </div>
  );
}