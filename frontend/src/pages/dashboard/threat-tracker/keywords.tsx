import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { csfrHeaderObject } from "@/utils/csrf-header";
import { apiRequest } from "@/lib/query-client";
import { serverUrl } from "@/utils/server-url";
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
} from "@/components/ui/dialog";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield,
  Plus,
  Loader2,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Form schemas
const keywordFormSchema = z.object({
  term: z.string().min(1, "Keyword term is required"),
  category: z.enum(["threat", "vendor", "client", "hardware"]),
  active: z.boolean().default(true),
});

const bulkKeywordFormSchema = z.object({
  terms: z.string().min(1, "At least one keyword is required"),
  category: z.enum(["threat", "vendor", "client", "hardware"]),
  active: z.boolean().default(true),
});

type KeywordFormValues = z.infer<typeof keywordFormSchema>;
type BulkKeywordFormValues = z.infer<typeof bulkKeywordFormSchema>;

export default function Keywords() {
  const { toast } = useToast();

  // State management
  const [selectedCategory, setSelectedCategory] = useState<
    "threat" | "vendor" | "client" | "hardware"
  >("threat");
  const [keywordDialogOpen, setKeywordDialogOpen] = useState(false);
  const [bulkKeywordDialogOpen, setBulkKeywordDialogOpen] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<ThreatKeyword | null>(
    null,
  );
  const [localKeywords, setLocalKeywords] = useState<ThreatKeyword[]>([]);
  const [isDefaultKeywordsCollapsed, setIsDefaultKeywordsCollapsed] =
    useState(false);

  // Form setup
  const form = useForm<KeywordFormValues>({
    resolver: zodResolver(keywordFormSchema),
    defaultValues: {
      term: "",
      category: selectedCategory,
      active: true,
    },
  });

  const bulkForm = useForm<BulkKeywordFormValues>({
    resolver: zodResolver(bulkKeywordFormSchema),
    defaultValues: {
      terms: "",
      category: selectedCategory,
      active: true,
    },
  });

  // Fetch keywords
  const keywords = useQuery<ThreatKeyword[]>({
    queryKey: [`${serverUrl}/api/threat-tracker/keywords`],
    queryFn: async () => {
      try {
        const response = await fetch(
          `${serverUrl}/api/threat-tracker/keywords`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              ...csfrHeaderObject(),
            },
          },
        );
        if (!response.ok) throw new Error("Failed to fetch keywords");
        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error("Error fetching keywords:", error);
        return [];
      }
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Sync keywords data with local state
  useEffect(() => {
    if (keywords.data) {
      setLocalKeywords(keywords.data);
    }
  }, [keywords.data]);

  // Update form category when selected category changes
  useEffect(() => {
    form.setValue("category", selectedCategory);
    bulkForm.setValue("category", selectedCategory);
  }, [selectedCategory, form, bulkForm]);

  // Delete keyword mutation
  const deleteKeyword = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(
        "DELETE",
        `${serverUrl}/api/threat-tracker/keywords/${id}`,
      );
    },
    onMutate: (id) => {
      setLocalKeywords((prev) => prev.filter((keyword) => keyword.id !== id));
    },
    onSuccess: (_, id) => {
      toast({
        title: "Keyword deleted",
        description: "The keyword has been successfully deleted.",
      });
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/keywords`],
      });
    },
    onError: (error, id) => {
      console.error("Error deleting keyword:", error);
      toast({
        title: "Error deleting keyword",
        description:
          "There was an error deleting the keyword. Please try again.",
        variant: "destructive",
      });
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/keywords`],
      });
    },
  });

  // Update keyword mutation
  const updateKeyword = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: KeywordFormValues;
    }) => {
      return apiRequest(
        "PUT",
        `${serverUrl}/api/threat-tracker/keywords/${id}`,
        values,
      );
    },
    onMutate: ({ id, values }) => {
      setLocalKeywords((prev) =>
        prev.map((keyword) =>
          keyword.id === id ? { ...keyword, ...values } : keyword,
        ),
      );
    },
    onSuccess: (data, { id }) => {
      setLocalKeywords((prev) =>
        prev.map((keyword) => (keyword.id === id ? data : keyword)),
      );
      toast({
        title: "Keyword updated",
        description: "Keyword has been updated successfully.",
      });
      setKeywordDialogOpen(false);
      setEditingKeyword(null);
      form.reset();
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/keywords`],
      });
    },
    onError: (error, { id }) => {
      console.error("Error updating keyword:", error);
      toast({
        title: "Error updating keyword",
        description:
          "There was an error updating the keyword. Please try again.",
        variant: "destructive",
      });
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/keywords`],
      });
    },
  });

  // Create bulk keywords mutation
  const createBulkKeywords = useMutation({
    mutationFn: async (values: BulkKeywordFormValues) => {
      const keywordTerms = values.terms
        .split(",")
        .map((term) => term.trim())
        .filter((term) => term.length > 0);

      const createdKeywords: ThreatKeyword[] = [];

      for (const term of keywordTerms) {
        try {
          const result = await apiRequest(
            "POST",
            `${serverUrl}/api/threat-tracker/keywords`,
            {
              term,
              category: values.category,
              active: values.active,
            },
          );

          console.log(`Created keyword: ${term}`, result);
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
      }));
      
      await queryClient.cancelQueries({ queryKey: [`${serverUrl}/api/threat-tracker/keywords`] });
      
      const previousKeywords = queryClient.getQueryData<ThreatKeyword[]>([`${serverUrl}/api/threat-tracker/keywords`]);
      const previousLocalKeywords = [...localKeywords];
      
      setLocalKeywords(prev => [...tempKeywords, ...prev]);
      
      queryClient.setQueryData<ThreatKeyword[]>([`${serverUrl}/api/threat-tracker/keywords`], old => 
        old ? [...tempKeywords, ...old] : tempKeywords
      );
      
      return { previousKeywords, previousLocalKeywords, tempKeywords };
    },
    onError: (err, values, context) => {
      if (context) {
        setLocalKeywords(context.previousLocalKeywords);
        queryClient.setQueryData([`${serverUrl}/api/threat-tracker/keywords`], context.previousKeywords);
      }
      
      console.error("Error creating bulk keywords:", err);
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
        
        queryClient.setQueryData<ThreatKeyword[]>([`${serverUrl}/api/threat-tracker/keywords`], prev => {
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
        queryKey: [`${serverUrl}/api/threat-tracker/keywords`],
      });
    },
  });

  // Create keyword mutation
  const createKeyword = useMutation({
    mutationFn: async (values: KeywordFormValues) => {
      return apiRequest(
        "POST",
        `${serverUrl}/api/threat-tracker/keywords`,
        values,
      );
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
      };
      
      await queryClient.cancelQueries({ queryKey: [`${serverUrl}/api/threat-tracker/keywords`] });
      
      const previousKeywords = queryClient.getQueryData<ThreatKeyword[]>([`${serverUrl}/api/threat-tracker/keywords`]);
      const previousLocalKeywords = [...localKeywords];
      
      setLocalKeywords(prev => [tempKeyword, ...prev]);
      
      queryClient.setQueryData<ThreatKeyword[]>([`${serverUrl}/api/threat-tracker/keywords`], old => 
        old ? [tempKeyword, ...old] : [tempKeyword]
      );
      
      return { previousKeywords, previousLocalKeywords, tempId };
    },
    onError: (err, newKeyword, context) => {
      if (context) {
        setLocalKeywords(context.previousLocalKeywords);
        queryClient.setQueryData([`${serverUrl}/api/threat-tracker/keywords`], context.previousKeywords);
      }
      
      console.error("Error creating keyword:", err);
      toast({
        title: "Error creating keyword",
        description:
          "There was an error creating the keyword. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables, context) => {
      if (context?.tempId) {
        setLocalKeywords(prev => 
          prev.map(keyword => keyword.id === context.tempId ? data : keyword)
        );
        
        queryClient.setQueryData<ThreatKeyword[]>([`${serverUrl}/api/threat-tracker/keywords`], prev => 
          prev ? prev.map(keyword => keyword.id === context.tempId ? data : keyword) : [data]
        );
      }
      
      toast({
        title: "Keyword created",
        description: "New keyword has been created successfully.",
      });
      setKeywordDialogOpen(false);
      form.reset({
        term: "",
        category: selectedCategory,
        active: true,
      });
      
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/keywords`],
      });
    },
  });

  // Toggle keyword active status mutation
  const toggleKeywordActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      return apiRequest("PATCH", `${serverUrl}/api/threat-tracker/keywords/${id}/toggle`, {
        active,
      });
    },
    onMutate: async ({ id, active }) => {
      await queryClient.cancelQueries({ queryKey: [`${serverUrl}/api/threat-tracker/keywords`] });
      
      const previousKeywords = queryClient.getQueryData<ThreatKeyword[]>([`${serverUrl}/api/threat-tracker/keywords`]);
      const previousLocalKeywords = [...localKeywords];
      
      setLocalKeywords(prev => 
        prev.map(keyword => 
          keyword.id === id ? { ...keyword, active } : keyword
        )
      );
      
      queryClient.setQueryData<ThreatKeyword[]>([`${serverUrl}/api/threat-tracker/keywords`], oldData => 
        (oldData || []).map(keyword => 
          keyword.id === id ? { ...keyword, active } : keyword
        )
      );
      
      return { previousKeywords, previousLocalKeywords, id };
    },
    onError: (err, variables, context) => {
      if (context) {
        setLocalKeywords(context.previousLocalKeywords);
        queryClient.setQueryData([`${serverUrl}/api/threat-tracker/keywords`], context.previousKeywords);
      }
      
      console.error("Error toggling keyword active status:", err);
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
        queryKey: [`${serverUrl}/api/threat-tracker/keywords`],
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
      category: selectedCategory,
      active: true,
    });
    setKeywordDialogOpen(true);
  }

  // Handle bulk keyword dialog open
  function handleBulkKeywords() {
    bulkForm.reset({
      terms: "",
      category: selectedCategory,
      active: true,
    });
    setBulkKeywordDialogOpen(true);
  }

  // Handle toggle active status
  function handleToggleActive(id: string, currentStatus: boolean) {
    toggleKeywordActive.mutate({ id, active: !currentStatus });
  }

  // Filter keywords by category
  const allKeywordsByCategory = localKeywords.filter(
    (keyword) => keyword.category === selectedCategory,
  );

  const defaultKeywords = allKeywordsByCategory.filter(
    (keyword) => keyword.isDefault,
  );
  const userKeywords = allKeywordsByCategory.filter(
    (keyword) => !keyword.isDefault,
  );

  // Group keywords by category for counts
  const categoryCounts = {
    threat: localKeywords.filter((k) => k.category === "threat").length,
    vendor: localKeywords.filter((k) => k.category === "vendor").length,
    client: localKeywords.filter((k) => k.category === "client").length,
    hardware: localKeywords.filter((k) => k.category === "hardware").length,
  };

  // Helper function to render compact default keywords
  function renderDefaultKeywords(keywords: ThreatKeyword[], category: string) {
    if (keywords.length === 0) return null;

    return (
      <div className="mb-6">
        <Collapsible
          open={!isDefaultKeywordsCollapsed}
          onOpenChange={(open) => setIsDefaultKeywordsCollapsed(!open)}
        >
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 mb-3 hover:bg-muted/50 rounded-md p-1 -ml-1 w-full justify-start">
              {isDefaultKeywordsCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              <Shield className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-medium text-muted-foreground">
                Default Keywords
              </h3>
              <Badge variant="outline" className="text-xs px-2 py-0">
                {keywords.length}
              </Badge>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2">
            <div className="flex flex-wrap gap-2 pl-6">
              {keywords.map((keyword: ThreatKeyword) => (
                <Badge
                  key={keyword.id}
                  variant={keyword.active ? "default" : "outline"}
                  className={`text-xs whitespace-nowrap ${
                    keyword.active
                      ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                      : "bg-gray-50 text-gray-500 border-gray-200"
                  }`}
                >
                  {keyword.term}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  // Helper function to render user keyword table
  function renderUserKeywordTable(keywords: ThreatKeyword[]) {
    if (keywords.length === 0) return null;

    return (
      <div className="overflow-x-auto pb-4">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[120px]">Term</TableHead>
              <TableHead className="min-w-[100px]">Status</TableHead>
              <TableHead className="text-right min-w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keywords.map((keyword: ThreatKeyword) => (
              <TableRow key={keyword.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {keyword.term}
                    {keyword.isDefault && (
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1 bg-blue-100 text-blue-700 border-blue-200"
                      >
                        <Shield className="h-3 w-3" />
                        <span className="text-xs">Default</span>
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div
                    className={`flex items-center ${keyword.isDefault ? "cursor-not-allowed" : "cursor-pointer"}`}
                    onClick={() =>
                      !keyword.isDefault &&
                      handleToggleActive(keyword.id, keyword.active)
                    }
                    title={
                      keyword.isDefault
                        ? "Default keywords cannot be deactivated"
                        : `Click to ${keyword.active ? "deactivate" : "activate"}`
                    }
                  >
                    <Switch
                      checked={keyword.active}
                      disabled={keyword.isDefault}
                      className="scale-75"
                    />
                    <span className="ml-2 text-sm text-muted-foreground">
                      {keyword.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {!keyword.isDefault && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditKeyword(keyword)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the keyword "
                                {keyword.term}". This action cannot be undone.
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
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 px-4 sm:px-6 max-w-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
          Keywords
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
          Manage keywords used for threat monitoring and cross-referencing.
        </p>
      </div>

      <div className="w-full">
        <div className="flex flex-col space-y-6">
          {/* Custom Tab Navigation */}
          <div className="w-full">
            <div className="flex flex-col md:flex-row gap-2 md:gap-1">
              <div
                onClick={() => setSelectedCategory("threat")}
                className={`
                  flex-1 md:flex-initial cursor-pointer rounded-lg md:rounded-b-none md:rounded-t-lg px-4 py-3 text-center transition-all duration-200 border-2
                  ${selectedCategory === "threat"
                    ? "bg-[#BF00FF] text-white border-[#BF00FF] shadow-lg"
                    : "bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-700/50 hover:border-slate-600"
                  }
                `}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="font-medium text-sm md:text-base">
                    Threats
                  </span>
                  {categoryCounts.threat > 0 && (
                    <span className={`
                      px-2 py-0.5 rounded-full text-xs font-medium
                      ${selectedCategory === "threat"
                        ? "bg-[#00FFFF] text-black"
                        : "bg-slate-600 text-slate-200"
                      }
                    `}>
                      {categoryCounts.threat}
                    </span>
                  )}
                </div>
              </div>

              <div
                onClick={() => setSelectedCategory("vendor")}
                className={`
                  flex-1 md:flex-initial cursor-pointer rounded-lg md:rounded-b-none md:rounded-t-lg px-4 py-3 text-center transition-all duration-200 border-2
                  ${selectedCategory === "vendor"
                    ? "bg-slate-800 text-white border-slate-600 shadow-lg"
                    : "bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-700/50 hover:border-slate-600"
                  }
                `}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="font-medium text-sm md:text-base">Vendors</span>
                  {categoryCounts.vendor > 0 && (
                    <span className={`
                      px-2 py-0.5 rounded-full text-xs font-medium
                      ${selectedCategory === "vendor"
                        ? "bg-[#00FFFF] text-black"
                        : "bg-slate-600 text-slate-200"
                      }
                    `}>
                      {categoryCounts.vendor}
                    </span>
                  )}
                </div>
              </div>

              <div
                onClick={() => setSelectedCategory("client")}
                className={`
                  flex-1 md:flex-initial cursor-pointer rounded-lg md:rounded-b-none md:rounded-t-lg px-4 py-3 text-center transition-all duration-200 border-2
                  ${selectedCategory === "client"
                    ? "bg-slate-800 text-white border-slate-600 shadow-lg"
                    : "bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-700/50 hover:border-slate-600"
                  }
                `}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="font-medium text-sm md:text-base">Clients</span>
                  {categoryCounts.client > 0 && (
                    <span className={`
                      px-2 py-0.5 rounded-full text-xs font-medium
                      ${selectedCategory === "client"
                        ? "bg-[#00FFFF] text-black"
                        : "bg-slate-600 text-slate-200"
                      }
                    `}>
                      {categoryCounts.client}
                    </span>
                  )}
                </div>
              </div>

              <div
                onClick={() => setSelectedCategory("hardware")}
                className={`
                  flex-1 md:flex-initial cursor-pointer rounded-lg md:rounded-b-none md:rounded-t-lg px-4 py-3 text-center transition-all duration-200 border-2
                  ${selectedCategory === "hardware"
                    ? "bg-slate-800 text-white border-slate-600 shadow-lg"
                    : "bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-700/50 hover:border-slate-600"
                  }
                `}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="font-medium text-sm md:text-base">
                    H/W S/W
                  </span>
                  {categoryCounts.hardware > 0 && (
                    <span className={`
                      px-2 py-0.5 rounded-full text-xs font-medium
                      ${selectedCategory === "hardware"
                        ? "bg-[#00FFFF] text-black"
                        : "bg-slate-600 text-slate-200"
                      }
                    `}>
                      {categoryCounts.hardware}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-row gap-2 w-full sm:w-auto sm:self-end">
            <Button
              onClick={handleBulkKeywords}
              disabled={createBulkKeywords.isPending}
              variant="outline"
              className="h-9 px-3 sm:px-4 text-xs sm:text-sm bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] border-0 flex-1 sm:flex-initial"
            >
              {createBulkKeywords.isPending ? (
                <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              )}
              <span className="md:inline hidden">Bulk Import</span>
              <span className="md:hidden inline">Bulk</span>
            </Button>

            <Button
              onClick={handleNewKeyword}
              disabled={createKeyword.isPending}
              className="h-9 px-3 sm:px-4 text-xs sm:text-sm bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] border-0 flex-1 sm:flex-initial"
            >
              {createKeyword.isPending ? (
                <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              )}
              <span className="md:inline hidden">
                Add{" "}
                {selectedCategory === "threat"
                  ? "Keyword"
                  : selectedCategory === "vendor"
                    ? "Vendor"
                    : selectedCategory === "client"
                      ? "Client"
                      : "Hardware/Software"}
              </span>
              <span className="md:hidden inline">Add</span>
            </Button>
          </div>
        </div>

        {/* Dynamic Content Area */}
        <div className="mt-4 sm:mt-6">
          <Card className="border-0 sm:border">
            <CardHeader className="p-3 sm:p-4 lg:p-6">
              <CardTitle className="text-base sm:text-lg lg:text-xl">
                {selectedCategory === "threat" && "Threat Keywords"}
                {selectedCategory === "vendor" && "Vendors"}
                {selectedCategory === "client" && "Clients"}
                {selectedCategory === "hardware" && "Hardware/Software"}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm leading-relaxed">
                {selectedCategory === "threat" && "Keywords related to cybersecurity threats (e.g., malware, breach, zero-day)"}
                {selectedCategory === "vendor" && "Technology vendors to monitor for security threats"}
                {selectedCategory === "client" && "Your client organizations to monitor for security threats"}
                {selectedCategory === "hardware" && "Specific hardware or software to monitor for security threats"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-1 sm:p-3 lg:p-6">
              {renderDefaultKeywords(
                defaultKeywords.filter((k) => k.category === selectedCategory),
                selectedCategory,
              )}
              <div className="space-y-4">
                {userKeywords.filter((k) => k.category === selectedCategory).length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      Your Keywords
                    </h3>
                  </div>
                )}
                {renderUserKeywordTable(
                  userKeywords.filter((k) => k.category === selectedCategory),
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Single keyword dialog */}
      <Dialog open={keywordDialogOpen} onOpenChange={setKeywordDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingKeyword ? "Edit Keyword" : "Add New Keyword"}
            </DialogTitle>
            <DialogDescription>
              {editingKeyword
                ? "Update this keyword's details."
                : "Add a new keyword to monitor in threat analysis."}
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
                      <Input {...field} placeholder="Enter keyword" />
                    </FormControl>
                    <FormDescription>
                      Enter a single term to monitor
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
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="threat">Threat</SelectItem>
                        <SelectItem value="vendor">Vendor</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                        <SelectItem value="hardware">
                          Hardware/Software
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Categorize this keyword</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Active Status</FormLabel>
                      <FormDescription>
                        Toggle monitoring status
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
                  type="submit"
                  disabled={createKeyword.isPending || updateKeyword.isPending}
                  className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white"
                >
                  {(createKeyword.isPending || updateKeyword.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingKeyword ? "Update" : "Create"} Keyword
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Bulk keyword dialog */}
      <Dialog open={bulkKeywordDialogOpen} onOpenChange={setBulkKeywordDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Bulk Import Keywords</DialogTitle>
            <DialogDescription>
              Import multiple keywords at once by entering them separated by
              commas.
            </DialogDescription>
          </DialogHeader>
          <Form {...bulkForm}>
            <form
              onSubmit={bulkForm.handleSubmit(onBulkSubmit)}
              className="space-y-4"
            >
              <FormField
                control={bulkForm.control}
                name="terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keywords</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter keywords separated by commas (e.g., ransomware, phishing, malware)"
                        className="min-h-[100px]"
                      />
                    </FormControl>
                    <FormDescription>
                      Separate multiple keywords with commas
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
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="threat">Threat</SelectItem>
                        <SelectItem value="vendor">Vendor</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                        <SelectItem value="hardware">
                          Hardware/Software
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      All keywords will be assigned to this category
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={bulkForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Active Status</FormLabel>
                      <FormDescription>
                        Set initial monitoring status for all keywords
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
                  type="submit"
                  disabled={createBulkKeywords.isPending}
                  className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white"
                >
                  {createBulkKeywords.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Import Keywords
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}