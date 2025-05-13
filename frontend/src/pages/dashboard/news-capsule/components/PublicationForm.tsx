import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

import { ArticleWithAnalysis } from "@/lib/news-capsule-types";
import { Loader2 } from 'lucide-react';
import { serverUrl } from '@/utils/server-url';
import { csfrHeaderObject } from '@/utils/csrf-header';

interface PublicationFormProps {
  onPublicationComplete: (result: ArticleWithAnalysis) => void;
}

export function PublicationForm({ onPublicationComplete }: PublicationFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("Manual Entry");
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (title.length < 5) {
      toast({
        title: "Invalid Title",
        description: "Title must be at least 5 characters long",
        variant: "destructive"
      });
      return;
    }
    
    if (content.length < 50) {
      toast({
        title: "Invalid Content",
        description: "Content must be at least 50 characters long",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const response = await fetch(serverUrl + "/api/news-capsule/publication", {
        method: "POST",
        body: JSON.stringify({
          title,
          content,
          source
        }),
        headers: {
          "Content-Type": "application/json",
          ...csfrHeaderObject()
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit publication');
      }
      
      const result = await response.json();
      
      toast({
        title: "Publication Submitted",
        description: "Your publication has been successfully analyzed",
      });
      
      // Reset form
      setTitle("");
      setContent("");
      setSource("Manual Entry");
      
      // Call the callback with the analysis result
      onPublicationComplete(result);
    } catch (error) {
      console.error("Error submitting publication:", error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Failed to submit publication",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Add Publication</CardTitle>
        <CardDescription>
          Manually enter security publication details for analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input 
              id="title" 
              placeholder="Enter publication title" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Input 
              id="source" 
              placeholder="Enter source (e.g., 'Microsoft Security Blog')" 
              value={source}
              onChange={e => setSource(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea 
              id="content" 
              placeholder="Enter the publication content..." 
              className="min-h-[200px]"
              value={content}
              onChange={(e:any) => setContent(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={() => {
          setTitle("");
          setContent("");
          setSource("Manual Entry");
        }} disabled={isSubmitting}>
          Clear
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            "Submit for Analysis"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
