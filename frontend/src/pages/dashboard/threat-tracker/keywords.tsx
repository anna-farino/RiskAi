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
  X,
  Shield,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

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

export default function Keywords() {
  const { toast } = useToast();
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
  
  // Optimistic update states
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set());
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [addingItem, setAddingItem] = useState(false);

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

  // Fetch keywords with refetch on window focus for navigation remounting
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
        console.error(error);
        return []; // Return empty array instead of undefined to prevent errors
      }
    },
    refetchOnWindowFocus: true,
    staleTime: 0, // Always consider data stale to ensure fresh data on navigation
  });

  // Update local state whenever query data changes
  useEffect(() => {
    if (keywords.data) {
      setLocalKeywords(keywords.data);
    }
  }, [keywords.data]);

  // Create bulk keywords mutation
  const createBulkKeywords = useMutation({
    mutationFn: async (values: BulkKeywordFormValues) => {
      console.log("Submitting bulk keywords:", values);

      // Split the terms and create individual keywords
      const keywordTerms = values.terms
        .split(",")
        .map((term) => term.trim())
        .filter((term) => term.length > 0);

      console.log("Processed terms:", keywordTerms);

      // Create each keyword individually using the regular keywords endpoint
      const createdKeywords = [];

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
          // Continue with other keywords even if one fails
        }
      }

      return {
        message: `Created ${createdKeywords.length} keywords`,
        keywords: createdKeywords,
      };
    },
    onSuccess: (data) => {
      const { message, keywords } = data;
      toast({
        title: "Keywords added in bulk",
        description: `Successfully created ${keywords.length} keywords.`,
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
    onError: (error) => {
      console.error("Error creating bulk keywords:", error);
      toast({
        title: "Error adding keywords",
        description:
          "There was an error adding your keywords. Please try again.",
        variant: "destructive",
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
    onSuccess: () => {
      toast({
        title: "Keyword created",
        description: "Your keyword has been added successfully.",
      });
      setKeywordDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/keywords`],
      });
    },
    onError: (error) => {
      console.error("Error creating keyword:", error);
      toast({
        title: "Error creating keyword",
        description:
          "There was an error creating your keyword. Please try again.",
        variant: "destructive",
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
    onSuccess: () => {
      toast({
        title: "Keyword updated",
        description: "Your keyword has been updated successfully.",
      });
      setKeywordDialogOpen(false);
      setEditingKeyword(null);
      form.reset();
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/keywords`],
      });
    },
    onError: (error) => {
      console.error("Error updating keyword:", error);
      toast({
        title: "Error updating keyword",
        description:
          "There was an error updating your keyword. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete keyword mutation
  const deleteKeyword = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(
        "DELETE",
        `${serverUrl}/api/threat-tracker/keywords/${id}`,
      );
    },
    onSuccess: () => {
      toast({
        title: "Keyword deleted",
        description: "Your keyword has been deleted successfully.",
      });
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/keywords`],
      });
    },
    onError: (error) => {
      console.error("Error deleting keyword:", error);
      toast({
        title: "Error deleting keyword",
        description:
          "There was an error deleting your keyword. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Toggle keyword active status
  const toggleKeywordActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      return apiRequest(
        "PUT",
        `${serverUrl}/api/threat-tracker/keywords/${id}`,
        { active },
      );
    },
    onMutate: ({ id, active }) => {
      // Optimistic update
      setLocalKeywords((prev) =>
        prev.map((keyword) =>
          keyword.id === id ? { ...keyword, active } : keyword,
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/keywords`],
      });
    },
    onError: (error) => {
      console.error("Error toggling keyword active status:", error);
      toast({
        title: "Error updating keyword",
        description:
          "There was an error updating the keyword status. Please try again.",
        variant: "destructive",
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

  // Filter keywords by category and separate defaults from user keywords
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
                  className={`text-xs ${
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

  // Helper function to render the user keyword table
  function renderUserKeywordTable(keywords: ThreatKeyword[]) {
    if (localKeywords.length === 0) {
      return (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (keywords.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 border rounded-md border-dashed">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-2" />
          <h3 className="text-lg font-medium">No custom keywords</h3>
          <p className="text-sm text-muted-foreground mb-4 text-center px-4">
            {selectedCategory === "threat" &&
              "Add custom threat keywords to monitor for specific security issues."}
            {selectedCategory === "vendor" &&
              "Add custom vendors to monitor for security vulnerabilities."}
            {selectedCategory === "client" &&
              "Add custom clients to track security issues affecting them."}
            {selectedCategory === "hardware" &&
              "Add custom hardware/software to monitor for security issues."}
          </p>
          <Button onClick={handleNewKeyword}>
            <Plus className="mr-2 h-4 w-4" />
            Add{" "}
            {selectedCategory === "threat"
              ? "Keyword"
              : selectedCategory === "vendor"
                ? "Vendor"
                : selectedCategory === "client"
                  ? "Client"
                  : "Hardware/Software"}
          </Button>
        </div>
      );
    }

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
            {keywords.map((keyword: ThreatKeyword) => {
              const isOptimistic = keyword.id.startsWith('temp-');
              const isDeleting = deletingItems.has(keyword.id);
              
              return (
                <TableRow 
                  key={keyword.id}
                  className={`${isOptimistic ? 'bg-blue-50/50 animate-pulse' : ''} ${isDeleting ? 'opacity-50 bg-red-50/30' : ''}`}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {keyword.term}
                      {isOptimistic && (
                        <div className="flex items-center gap-1 text-xs text-blue-600">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Adding...
                        </div>
                      )}
                      {isDeleting && (
                        <div className="flex items-center gap-1 text-xs text-red-600">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Deleting...
                        </div>
                      )}
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
                        ? "Default keywords cannot be modified"
                        : "Click to toggle status"
                    }
                  >
                    {keyword.active ? (
                      <Badge
                        variant="default"
                        className="flex items-center gap-1 bg-green-500"
                      >
                        <Check className="h-3 w-3" />
                        <span className="sm:inline hidden">Active</span>
                        <span className="sm:hidden inline">On</span>
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1 text-muted-foreground"
                      >
                        <X className="h-3 w-3" />
                        <span className="sm:inline hidden">Inactive</span>
                        <span className="sm:hidden inline">Off</span>
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right p-2 sm:p-4">
                  <div className="flex justify-end gap-1 sm:gap-2">
                    {keyword.isDefault ? (
                      <div className="text-xs text-muted-foreground py-2">
                        Default keyword
                      </div>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditKeyword(keyword)}
                          className="h-fit w-fit p-2 border border-slate-700 rounded-full text-slate-400 hover:text-blue-400 hover:bg-blue-400/10"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          <span className="sr-only">Edit</span>
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-fit w-fit p-2 border border-slate-700 rounded-full text-slate-400 hover:text-red-400 hover:bg-red-400/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
            );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-2 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Keywords
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Manage keywords used for threat monitoring and cross-referencing.
        </p>
      </div>

      <Tabs
        defaultValue="threat"
        value={selectedCategory}
        onValueChange={setSelectedCategory}
        className="w-full"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full overflow-x-auto pb-2">
            <TabsList className="w-full sm:w-auto flex">
              <TabsTrigger
                value="threat"
                className="relative whitespace-nowrap"
              >
                <span className="sm:inline hidden">Threat Keywords</span>
                <span className="sm:hidden inline">Threats</span>
                {categoryCounts.threat > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {categoryCounts.threat}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="vendor"
                className="relative whitespace-nowrap"
              >
                Vendors
                {categoryCounts.vendor > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {categoryCounts.vendor}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="client"
                className="relative whitespace-nowrap"
              >
                Clients
                {categoryCounts.client > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {categoryCounts.client}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="hardware"
                className="relative whitespace-nowrap"
              >
                <span className="sm:inline hidden">Hardware/Software</span>
                <span className="sm:hidden inline">H/W S/W</span>
                {categoryCounts.hardware > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {categoryCounts.hardware}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button
              onClick={handleBulkKeywords}
              disabled={createBulkKeywords.isPending}
              variant="outline"
              className="h-9 px-2 sm:px-4"
            >
              {createBulkKeywords.isPending ? (
                <Loader2 className="sm:mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="sm:mr-2 h-4 w-4" />
              )}
              <span className="sm:inline hidden">Bulk Import</span>
              <span className="sm:hidden inline">Bulk</span>
            </Button>

            <Button
              onClick={handleNewKeyword}
              disabled={createKeyword.isPending}
              className="h-9 px-2 sm:px-4"
            >
              {createKeyword.isPending ? (
                <Loader2 className="sm:mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="sm:mr-2 h-4 w-4" />
              )}
              <span className="sm:inline hidden">
                Add{" "}
                {selectedCategory === "threat"
                  ? "Keyword"
                  : selectedCategory === "vendor"
                    ? "Vendor"
                    : selectedCategory === "client"
                      ? "Client"
                      : "Hardware/Software"}
              </span>
              <span className="sm:hidden inline">Add</span>
            </Button>
          </div>
        </div>

        <TabsContent value="threat" className="mt-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">
                Threat Keywords
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Keywords related to cybersecurity threats (e.g., malware,
                breach, zero-day)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-6">
              {renderDefaultKeywords(
                defaultKeywords.filter((k) => k.category === "threat"),
                "threat",
              )}
              <div className="space-y-4">
                {userKeywords.filter((k) => k.category === "threat").length >
                  0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      Your Keywords
                    </h3>
                  </div>
                )}
                {renderUserKeywordTable(
                  userKeywords.filter((k) => k.category === "threat"),
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendor" className="mt-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Vendors</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Technology vendors to monitor for security threats
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-6">
              {renderDefaultKeywords(
                defaultKeywords.filter((k) => k.category === "vendor"),
                "vendor",
              )}
              <div className="space-y-4">
                {userKeywords.filter((k) => k.category === "vendor").length >
                  0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      Your Keywords
                    </h3>
                  </div>
                )}
                {renderUserKeywordTable(
                  userKeywords.filter((k) => k.category === "vendor"),
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="client" className="mt-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Clients</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Your client organizations to monitor for security threats
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-6">
              {renderDefaultKeywords(
                defaultKeywords.filter((k) => k.category === "client"),
                "client",
              )}
              <div className="space-y-4">
                {userKeywords.filter((k) => k.category === "client").length >
                  0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      Your Keywords
                    </h3>
                  </div>
                )}
                {renderUserKeywordTable(
                  userKeywords.filter((k) => k.category === "client"),
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hardware" className="mt-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">
                Hardware/Software
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Specific hardware or software to monitor for security threats
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-6">
              {renderDefaultKeywords(
                defaultKeywords.filter((k) => k.category === "hardware"),
                "hardware",
              )}
              <div className="space-y-4">
                {userKeywords.filter((k) => k.category === "hardware").length >
                  0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      Your Keywords
                    </h3>
                  </div>
                )}
                {renderUserKeywordTable(
                  userKeywords.filter((k) => k.category === "hardware"),
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                  {(createKeyword.isPending || updateKeyword.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingKeyword ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Bulk keyword import dialog */}
      <Dialog
        open={bulkKeywordDialogOpen}
        onOpenChange={setBulkKeywordDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Bulk Import Keywords</DialogTitle>
            <DialogDescription>
              Add multiple keywords at once by separating them with commas.
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
                        placeholder="Enter keywords separated by commas"
                        className="min-h-[100px]"
                      />
                    </FormControl>
                    <FormDescription>
                      Example: ransomware, malware, zero-day
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
                      All imported keywords will use this category
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
                        Set initial active status
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
                <Button type="submit" disabled={createBulkKeywords.isPending}>
                  {createBulkKeywords.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Import
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
