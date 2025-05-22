import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Link as LinkIcon, Globe, Loader2 } from 'lucide-react';
import { serverUrl } from '@/lib/constants';
import { csfrHeaderObject } from '@/lib/csrf';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function Submit() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url) {
      toast({
        title: "Input needed",
        description: "Please enter a valid URL to process",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      const response = await fetch(`${serverUrl}/api/news-capsule/articles/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...csfrHeaderObject()
        },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit article');
      }
      
      const data = await response.json();
      
      toast({
        title: "Article submitted",
        description: "Your article is being processed and will appear on the dashboard soon",
        variant: "default"
      });
      
      // Clear the input
      setUrl('');
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/news-capsule/queue/status'] });
      
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to submit the article. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Submit Article</h2>
        <p className="text-slate-400">
          Enter the URL of a cybersecurity article to process with AI
        </p>
      </div>
      
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle>Article URL Submission</CardTitle>
          <CardDescription>
            Our AI will automatically extract threat intelligence from the article
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">Article URL</Label>
              <div className="flex">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com/security-article"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="ml-2 bg-purple-700 hover:bg-purple-600"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing
                    </>
                  ) : (
                    <>
                      Submit
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-start border-t border-slate-700 pt-4">
          <h4 className="font-semibold mb-2 flex items-center">
            <Globe className="mr-2 h-4 w-4 text-cyan-400" />
            Supported Sources
          </h4>
          <p className="text-sm text-slate-400 leading-relaxed">
            For best results, submit articles from established cybersecurity news sources such as:
            The Hacker News, Krebs on Security, Ars Technica, Bleeping Computer, 
            ZDNet Security, Dark Reading, Microsoft Security Blog, and similar publications.
          </p>
        </CardFooter>
      </Card>
      
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-lg">How the Process Works</h3>
        
        <ol className="space-y-2 text-slate-300">
          <li className="flex">
            <span className="bg-purple-900/50 text-purple-300 rounded-full h-6 w-6 flex items-center justify-center text-sm mr-3 flex-shrink-0">1</span>
            <p>Submit the URL of a cybersecurity article.</p>
          </li>
          <li className="flex">
            <span className="bg-purple-900/50 text-purple-300 rounded-full h-6 w-6 flex items-center justify-center text-sm mr-3 flex-shrink-0">2</span>
            <p>Our system extracts the article content and processes it with OpenAI's language model.</p>
          </li>
          <li className="flex">
            <span className="bg-purple-900/50 text-purple-300 rounded-full h-6 w-6 flex items-center justify-center text-sm mr-3 flex-shrink-0">3</span>
            <p>The AI identifies key threat elements like CVEs, impacts, and attack vectors.</p>
          </li>
          <li className="flex">
            <span className="bg-purple-900/50 text-purple-300 rounded-full h-6 w-6 flex items-center justify-center text-sm mr-3 flex-shrink-0">4</span>
            <p>Structured data is added to your dashboard for analysis.</p>
          </li>
        </ol>
      </div>
    </div>
  );
}