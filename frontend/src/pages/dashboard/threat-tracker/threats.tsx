import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { queryClient } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { ThreatKeyword } from "@shared/db/schema/threat-tracker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  PencilLine,
  Check,
  CheckCircle,
  X,
  XCircle,
  Shield,
  ChevronDown,
  ChevronRight,
  Upload,
  Search,
  AlertTriangle,
  Building,
  Users,
  Cpu,
  Eye,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Type for threat actors
interface ThreatActor {
  id: string;
  name: string;
  normalizedName: string;
  type?: string;
  aliases?: string[];
  origin?: string;
  description?: string;
  firstSeen?: Date;
  lastSeen?: Date;
  isVerified: boolean;
  metadata?: any;
}

// Form schema for keyword creation/editing
const keywordFormSchema = z.object({
  term: z.string().min(1, "Keyword is required"),
  category: z.string().min(1, "Category is required"),
  active: z.boolean().default(true),
});

type KeywordFormValues = z.infer<typeof keywordFormSchema>;

// Form schema for bulk keyword import
const bulkKeywordFormSchema = z.object({
  terms: z.string().min(3, "Enter at least one keyword"),
  category: z.string().min(1, "Category is required"),
  active: z.boolean().default(true),
});

type BulkKeywordFormValues = z.infer<typeof bulkKeywordFormSchema>;

export default function Threats() {
  const { toast } = useToast();
  const fetchWithAuth = useFetch();
  const [activeTab, setActiveTab] = useState<"keywords" | "actors">("keywords");
  const [keywordDialogOpen, setKeywordDialogOpen] = useState(false);
  const [bulkKeywordDialogOpen, setBulkKeywordDialogOpen] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<ThreatKeyword | null>(
    null,
  );
  const [localKeywords, setLocalKeywords] = useState<ThreatKeyword[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("threat");
  const [isDefaultKeywordsCollapsed, setIsDefaultKeywordsCollapsed] = useState<
    Record<string, boolean>
  >({
    threat: true,
    vendor: true,
    client: true,
    hardware: true,
  });

  // Toolbar state management
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'default'>('all');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Initialize the single keyword form
  const form = useForm<KeywordFormValues>({
    resolver: zodResolver(keywordFormSchema),
    defaultValues: {
      term: "",
      category: "threat",
      active: true,
    },
  });

  // Initialize the bulk keyword form
  const bulkForm = useForm<BulkKeywordFormValues>({
    resolver: zodResolver(bulkKeywordFormSchema),
    defaultValues: {
      terms: "",
      category: "threat",
      active: true,
    },
  });

  // Fetch keywords
  const keywords = useQuery<ThreatKeyword[]>({
    queryKey: ["/api/threat-tracker/keywords"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth("/api/threat-tracker/keywords", {
            method: "GET",
          });
        if (!response.ok) throw new Error("Failed to fetch keywords");
        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error(error);
        return [];
      }
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Fetch threat actors
  const threatActors = useQuery<ThreatActor[]>({
    queryKey: ["/api/threat-tracker/tech-stack/threat-actors"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth("/api/threat-tracker/tech-stack/threat-actors", {
          method: "GET",
        });
        if (!response.ok) throw new Error("Failed to fetch threat actors");
        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error(error);
        return [];
      }
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Update local state whenever query data changes
  useEffect(() => {
    if (keywords.data) {
      setLocalKeywords(keywords.data);
    }
  }, [keywords.data]);

  // Create bulk keywords mutation with optimistic updates
  const createBulkKeywords = useMutation({
    mutationFn: async (values: BulkKeywordFormValues) => {
      const keywordTerms = values.terms
        .split(",")
        .map((term) => term.trim())
        .filter((term) => term.length > 0);

      const createdKeywords = [];

      for (const term of keywordTerms) {
        try {
          const response = await fetchWithAuth('/api/threat-tracker/keywords', {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              term,
              category: values.category,
              active: values.active,
            }),
          });
          const result = await response.json();
          createdKeywords.push(result);
        } catch (error) {
          console.error(`Error creating keyword: ${term}`, error);
        }
      }

      return {
        message: `Created ${createdKeywords.length} keywords`,
        keywords: createdKeywords,
      };
    },
    onMutate: async (values) => {
      const keywordTerms = values.terms
        .split(",")
        .map((term) => term.trim())
        .filter((term) => term.length > 0);
      
      const tempKeywords: ThreatKeyword[] = keywordTerms.map((term, index) => ({
        id: `temp-bulk-${Date.now()}-${index}`,
        term,
        category: values.category as any,
        active: values.active,
        userId: null,
        isDefault: false,
        wrappedDekTerm: null,
        keyIdTerm: null,
      }));
      
      await queryClient.cancelQueries({ queryKey: ["/api/threat-tracker/keywords"] });
      
      const previousKeywords = queryClient.getQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"]);
      const previousLocalKeywords = [...localKeywords];
      
      setLocalKeywords(prev => [...tempKeywords, ...prev]);
      
      queryClient.setQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"], old => 
        old ? [...tempKeywords, ...old] : tempKeywords
      );
      
      return { previousKeywords, previousLocalKeywords, tempKeywords };
    },
    onError: (err, values, context) => {
      if (context) {
        setLocalKeywords(context.previousLocalKeywords);
        queryClient.setQueryData(["/api/threat-tracker/keywords"], context.previousKeywords);
      }
      
      toast({
        title: "Error adding keywords",
        description:
          "There was an error adding your keywords. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables, context) => {
      const { keywords: createdKeywords } = data;
      
      if (context?.tempKeywords && createdKeywords.length > 0) {
        setLocalKeywords(prev => {
          const withoutTemp = prev.filter(k => !context.tempKeywords.some(temp => temp.id === k.id));
          return [...createdKeywords, ...withoutTemp];
        });
        
        queryClient.setQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"], prev => {
          if (!prev) return createdKeywords;
          const withoutTemp = prev.filter(k => !context.tempKeywords.some(temp => temp.id === k.id));
          return [...createdKeywords, ...withoutTemp];
        });
      }
      
      toast({
        title: "Keywords added in bulk",
        description: `Successfully created ${createdKeywords.length} keywords.`,
      });
      setBulkKeywordDialogOpen(false);
      bulkForm.reset({
        terms: "",
        category: selectedCategory,
        active: true,
      });
      
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/keywords"],
      });
    },
  });

  // Create keyword mutation with optimistic updates
  const createKeyword = useMutation({
    mutationFn: async (values: KeywordFormValues) => {
      const response = await fetchWithAuth('/api/threat-tracker/keywords', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      return response.json();
    },
    onMutate: async (newKeyword) => {
      const tempId = `temp-${Date.now()}`;
      const tempKeyword: ThreatKeyword = {
        id: tempId,
        term: newKeyword.term,
        category: newKeyword.category as any,
        active: newKeyword.active,
        userId: null,
        isDefault: false,
        wrappedDekTerm: null,
        keyIdTerm: null,
      };
      
      await queryClient.cancelQueries({ queryKey: ["/api/threat-tracker/keywords"] });
      
      const previousKeywords = queryClient.getQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"]);
      const previousLocalKeywords = [...localKeywords];
      
      setLocalKeywords(prev => [tempKeyword, ...prev]);
      
      queryClient.setQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"], old => 
        old ? [tempKeyword, ...old] : [tempKeyword]
      );
      
      return { previousKeywords, previousLocalKeywords, tempId };
    },
    onError: (err, newKeyword, context) => {
      if (context) {
        setLocalKeywords(context.previousLocalKeywords);
        queryClient.setQueryData(["/api/threat-tracker/keywords"], context.previousKeywords);
      }
      
      toast({
        title: "Error creating keyword",
        description:
          "There was an error creating your keyword. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables, context) => {
      if (context?.tempId) {
        setLocalKeywords(prev => 
          prev.map(keyword => 
            keyword.id === context.tempId ? (data as ThreatKeyword) : keyword
          )
        );
        
        queryClient.setQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"], prev => 
          prev?.map(keyword => 
            keyword.id === context.tempId ? (data as ThreatKeyword) : keyword
          ) || []
        );
      }
      
      toast({
        title: "Keyword created",
        description: "Your keyword has been added successfully.",
      });
      setKeywordDialogOpen(false);
      form.reset();
      
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/keywords"],
      });
    },
  });

  // Update keyword mutation with optimistic updates
  const updateKeyword = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: KeywordFormValues;
    }) => {
      const response = await fetchWithAuth(`/api/threat-tracker/keywords/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      return response.json();
    },
    onMutate: async ({ id, values }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/threat-tracker/keywords"] });
      
      const previousKeywords = queryClient.getQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"]);
      const previousLocalKeywords = [...localKeywords];
      
      setLocalKeywords(prev => 
        prev.map(keyword => 
          keyword.id === id ? { ...keyword, ...values } : keyword
        )
      );
      
      queryClient.setQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"], old => 
        (old || []).map(keyword => 
          keyword.id === id ? { ...keyword, ...values } : keyword
        )
      );
      
      return { previousKeywords, previousLocalKeywords, id };
    },
    onError: (err, variables, context) => {
      if (context) {
        setLocalKeywords(context.previousLocalKeywords);
        queryClient.setQueryData(["/api/threat-tracker/keywords"], context.previousKeywords);
      }
      
      toast({
        title: "Error updating keyword",
        description:
          "There was an error updating your keyword. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables, context) => {
      if (context?.id) {
        setLocalKeywords(prev => 
          prev.map(keyword => 
            keyword.id === context.id ? (data as ThreatKeyword) : keyword
          )
        );
        
        queryClient.setQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"], prev => 
          prev?.map(keyword => 
            keyword.id === context.id ? (data as ThreatKeyword) : keyword
          ) || []
        );
      }
      
      toast({
        title: "Keyword updated",
        description: "Your keyword has been updated successfully.",
      });
      setKeywordDialogOpen(false);
      setEditingKeyword(null);
      form.reset();
      
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/keywords"],
      });
    },
  });

  // Delete keyword mutation with optimistic updates
  const deleteKeyword = useMutation({
    mutationFn: async (id: string) => {
      try {
        const response = await fetchWithAuth(`/api/threat-tracker/keywords/${id}`, {
          method: "DELETE",
        });
        
        if (!response.ok) {
          throw new Error(`Failed to delete keyword: ${response.statusText}`);
        }
        
        return { success: true, id };
      } catch (error) {
        console.error("Delete keyword error:", error);
        throw error;
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["/api/threat-tracker/keywords"] });
      
      const previousKeywords = queryClient.getQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"]);
      const previousLocalKeywords = [...localKeywords];
      
      setLocalKeywords(prev => prev.filter(keyword => keyword.id !== id));
      
      queryClient.setQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"], (oldData = []) => 
        oldData.filter(keyword => keyword.id !== id)
      );
      
      return { previousKeywords, previousLocalKeywords, id };
    },
    onError: (err, id, context) => {
      if (context) {
        setLocalKeywords(context.previousLocalKeywords);
        queryClient.setQueryData(["/api/threat-tracker/keywords"], context.previousKeywords);
      }
      
      toast({
        title: "Error deleting keyword",
        description:
          "There was an error deleting your keyword. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables, context) => {
      toast({
        title: "Keyword deleted",
        description: "Your keyword has been deleted successfully.",
      });
      
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/keywords"],
      });
    },
  });

  // Toggle keyword active status with optimistic updates
  const toggleKeywordActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const response = await fetchWithAuth(`/api/threat-tracker/keywords/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ active }),
      });
      return response.json();
    },
    onMutate: async ({ id, active }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/threat-tracker/keywords"] });
      
      const previousKeywords = queryClient.getQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"]);
      const previousLocalKeywords = [...localKeywords];
      
      setLocalKeywords(prev => 
        prev.map(keyword => 
          keyword.id === id ? { ...keyword, active } : keyword
        )
      );
      
      queryClient.setQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"], oldData => 
        (oldData || []).map(keyword => 
          keyword.id === id ? { ...keyword, active } : keyword
        )
      );
      
      return { previousKeywords, previousLocalKeywords, id };
    },
    onError: (err, variables, context) => {
      if (context) {
        setLocalKeywords(context.previousLocalKeywords);
        queryClient.setQueryData(["/api/threat-tracker/keywords"], context.previousKeywords);
      }
      
      toast({
        title: "Error updating keyword",
        description:
          "There was an error updating the keyword status. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables, context) => {
      toast({
        title: "Keyword status updated",
        description: "Keyword status has been updated successfully.",
      });
      
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/keywords"],
      });
    },
  });

  // Handle single keyword form submission
  function onSubmit(values: KeywordFormValues) {
    if (editingKeyword) {
      updateKeyword.mutate({ id: editingKeyword.id, values });
    } else {
      createKeyword.mutate(values);
    }
  }

  // Handle bulk keyword form submission
  function onBulkSubmit(values: BulkKeywordFormValues) {
    createBulkKeywords.mutate(values);
  }

  // Handle edit keyword
  function handleEditKeyword(keyword: ThreatKeyword) {
    setEditingKeyword(keyword);
    form.reset({
      term: keyword.term,
      category: keyword.category,
      active: keyword.active,
    });
    setKeywordDialogOpen(true);
  }

  // Handle new keyword dialog open
  function handleNewKeyword() {
    setEditingKeyword(null);
    form.reset({
      term: "",
      category: "threat",
      active: true,
    });
    setKeywordDialogOpen(true);
  }

  // Handle bulk keyword dialog open
  function handleBulkKeywords() {
    bulkForm.reset({
      terms: "",
      category: "threat",
      active: true,
    });
    setBulkKeywordDialogOpen(true);
  }

  // Handle toggle active status
  function handleToggleActive(id: string, currentStatus: boolean) {
    toggleKeywordActive.mutate({ id, active: !currentStatus });
  }

  // Filter keywords by search term and status
  const filteredKeywords = localKeywords.filter(
    (keyword) => {
      const matchesCategory = keyword.category === 'threat';
      const matchesSearch = keyword.term.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesStatus = true;
      if (statusFilter === 'active') {
        matchesStatus = keyword.active === true;
      } else if (statusFilter === 'inactive') {
        matchesStatus = keyword.active === false;
      } else if (statusFilter === 'default') {
        matchesStatus = keyword.isDefault === true;
      }
      
      return matchesCategory && matchesSearch && matchesStatus;
    }
  );

  const defaultKeywords = filteredKeywords.filter(keyword => keyword.isDefault);
  const userKeywords = filteredKeywords.filter(keyword => !keyword.isDefault);

  // Filter threat actors by search
  const filteredActors = threatActors.data?.filter(actor => 
    actor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    actor.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    actor.aliases?.some(alias => alias.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  // Get the actor type icon
  const getActorTypeIcon = (type?: string) => {
    switch (type) {
      case 'apt':
        return <Shield className="h-4 w-4 text-red-500" />;
      case 'ransomware':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'hacktivist':
        return <Users className="h-4 w-4 text-blue-500" />;
      case 'criminal':
        return <UserX className="h-4 w-4 text-orange-500" />;
      case 'nation-state':
        return <Building className="h-4 w-4 text-purple-500" />;
      default:
        return <Eye className="h-4 w-4 text-gray-500" />;
    }
  };

  // Get the actor type badge color
  const getActorTypeColor = (type?: string) => {
    switch (type) {
      case 'apt':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'ransomware':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'hacktivist':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'criminal':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'nation-state':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    <div className="flex flex-col gap-y-2 w-full">
      {/* Page Header */}
      <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold">
              Threat Intelligence Configuration
            </h1>
            <p className="text-muted-foreground">
              Manage keywords for threat monitoring and track known threat actors
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border-slate-700/50">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">Search & Filter</h2>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={activeTab === "keywords" ? "Search keywords..." : "Search threat actors..."}
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="pl-10 w-64 bg-background/50"
                />
              </div>
              {activeTab === "keywords" && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleNewKeyword}
                    className="bg-gradient-to-r from-[#BF00FF]/10 to-[#00FFFF]/10 hover:from-[#BF00FF]/20 hover:to-[#00FFFF]/20 border-[#00FFFF]/20"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Single
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleBulkKeywords}
                    className="bg-gradient-to-r from-[#00FFFF]/10 to-[#BF00FF]/10 hover:from-[#00FFFF]/20 hover:to-[#BF00FF]/20 border-[#BF00FF]/20"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Add Bulk
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content with Tabs */}
      <Card className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border-slate-700/50 flex-grow">
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "keywords" | "actors")}>
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="keywords" className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Threat Keywords
              </TabsTrigger>
              <TabsTrigger value="actors" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Threat Actors
              </TabsTrigger>
            </TabsList>

            {/* Keywords Tab */}
            <TabsContent value="keywords" className="space-y-4">
              <Card className="bg-background/50 border-slate-700/30">
                <CardHeader>
                  <CardTitle className="text-lg">Threat Keywords</CardTitle>
                  <CardDescription>
                    Keywords related to cybersecurity threats (e.g., malware, breach, zero-day)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {keywords.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Default Keywords Section */}
                      {defaultKeywords.length > 0 && (
                        <Collapsible
                          open={!isDefaultKeywordsCollapsed['threat']}
                          onOpenChange={(open) =>
                            setIsDefaultKeywordsCollapsed(prev => ({ ...prev, threat: !open }))
                          }
                        >
                          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                            {isDefaultKeywordsCollapsed['threat'] ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            Default Keywords ({defaultKeywords.length})
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="flex flex-wrap gap-2 mt-3 p-3 bg-muted/5 rounded-md">
                              {defaultKeywords.map((keyword) => (
                                <Badge
                                  key={keyword.id}
                                  variant="secondary"
                                  className={cn(
                                    "bg-gradient-to-r from-[#BF00FF]/10 to-[#00FFFF]/10",
                                    keyword.active
                                      ? "border-[#00FFFF]/30"
                                      : "opacity-50 border-gray-600"
                                  )}
                                >
                                  {keyword.term}
                                  {keyword.active ? (
                                    <Check className="ml-1 h-3 w-3 text-green-500" />
                                  ) : (
                                    <X className="ml-1 h-3 w-3 text-gray-500" />
                                  )}
                                </Badge>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* User Keywords Table */}
                      {userKeywords.length > 0 ? (
                        <div className="rounded-md border border-slate-700/50">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Keyword</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {userKeywords.map((keyword) => (
                                <TableRow key={keyword.id}>
                                  <TableCell className="font-medium">
                                    {keyword.term}
                                  </TableCell>
                                  <TableCell>
                                    <Switch
                                      checked={keyword.active}
                                      onCheckedChange={() =>
                                        handleToggleActive(keyword.id, keyword.active)
                                      }
                                      className={cn(
                                        "data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#BF00FF] data-[state=checked]:to-[#00FFFF]"
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEditKeyword(keyword)}
                                      >
                                        <PencilLine className="h-4 w-4" />
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="icon">
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Keyword</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Are you sure you want to delete "{keyword.term}"? This action cannot be undone.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => deleteKeyword.mutate(keyword.id)}
                                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                              Delete
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No custom keywords added yet. Add keywords to monitor specific threats.
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Threat Actors Tab */}
            <TabsContent value="actors" className="space-y-4">
              <Card className="bg-background/50 border-slate-700/30">
                <CardHeader>
                  <CardTitle className="text-lg">Known Threat Actors</CardTitle>
                  <CardDescription>
                    APT groups, ransomware operators, and other threat actors detected in articles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {threatActors.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : filteredActors.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {filteredActors.map((actor) => (
                        <Card key={actor.id} className="bg-slate-900/50 border-slate-700/50">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {getActorTypeIcon(actor.type)}
                                <h3 className="font-medium">{actor.name}</h3>
                              </div>
                              {actor.isVerified && (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              )}
                            </div>
                            
                            {actor.type && (
                              <Badge 
                                variant="outline" 
                                className={cn("mb-2", getActorTypeColor(actor.type))}
                              >
                                {actor.type}
                              </Badge>
                            )}
                            
                            {actor.aliases && actor.aliases.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-muted-foreground mb-1">Also known as:</p>
                                <div className="flex flex-wrap gap-1">
                                  {actor.aliases.slice(0, 3).map((alias, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {alias}
                                    </Badge>
                                  ))}
                                  {actor.aliases.length > 3 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{actor.aliases.length - 3} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {actor.origin && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Origin: {actor.origin}
                              </p>
                            )}
                            
                            {actor.description && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                {actor.description}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchTerm 
                        ? "No threat actors found matching your search."
                        : "No threat actors detected yet. They will appear here as articles are analyzed."}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Single Keyword Dialog */}
      <Dialog open={keywordDialogOpen} onOpenChange={setKeywordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingKeyword ? "Edit Keyword" : "Add New Keyword"}
            </DialogTitle>
            <DialogDescription>
              {editingKeyword
                ? "Update the keyword details below."
                : "Add a new keyword to monitor for threats."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="term"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keyword</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., ransomware, zero-day" {...field} />
                    </FormControl>
                    <FormDescription>
                      The term to monitor in articles
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input {...field} value="threat" disabled />
                    </FormControl>
                    <FormDescription>
                      Keywords are categorized as threat keywords
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div>
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Enable monitoring for this keyword
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setKeywordDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createKeyword.isPending || updateKeyword.isPending}
                >
                  {createKeyword.isPending || updateKeyword.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingKeyword ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    editingKeyword ? "Update Keyword" : "Add Keyword"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Bulk Keyword Dialog */}
      <Dialog open={bulkKeywordDialogOpen} onOpenChange={setBulkKeywordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Keywords in Bulk</DialogTitle>
            <DialogDescription>
              Add multiple keywords at once by entering them separated by commas.
            </DialogDescription>
          </DialogHeader>
          <Form {...bulkForm}>
            <form onSubmit={bulkForm.handleSubmit(onBulkSubmit)} className="space-y-4">
              <FormField
                control={bulkForm.control}
                name="terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keywords</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., APT28, Lazarus Group, LockBit, REvil, DarkSide"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter keywords separated by commas
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={bulkForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input {...field} value="threat" disabled />
                    </FormControl>
                    <FormDescription>
                      All keywords will be categorized as threat keywords
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={bulkForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div>
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Enable monitoring for all keywords
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBulkKeywordDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createBulkKeywords.isPending}
                >
                  {createBulkKeywords.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding Keywords...
                    </>
                  ) : (
                    "Add Keywords"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}