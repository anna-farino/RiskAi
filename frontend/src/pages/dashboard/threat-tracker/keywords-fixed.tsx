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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [editingKeyword, setEditingKeyword] = useState<ThreatKeyword | null>(null);
  const [localKeywords, setLocalKeywords] = useState<ThreatKeyword[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("threat");
  const [isDefaultKeywordsCollapsed, setIsDefaultKeywordsCollapsed] = useState<Record<string, boolean>>({
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
        const response = await fetch(`${serverUrl}/api/threat-tracker/keywords`, {
          method: "GET",
          credentials: "include",
          headers: {
            ...csfrHeaderObject(),
          },
        });
        if (!response.ok) throw new Error("Failed to fetch keywords");
        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error(error);
        return [];
      }
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Update local state whenever query data changes
  useEffect(() => {
    if (keywords.data) {
      setLocalKeywords(keywords.data);
    }
  }, [keywords.data]);

  return (
    <div className="flex flex-col gap-6 px-2 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Keywords</h1>
        <p className="text-muted-foreground">
          Manage keywords for threat detection across different categories.
        </p>
      </div>

      <Tabs defaultValue="threat" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="threat">Threats</TabsTrigger>
          <TabsTrigger value="vendor">Vendors</TabsTrigger>
          <TabsTrigger value="client">Clients</TabsTrigger>
          <TabsTrigger value="hardware">Hardware/Software</TabsTrigger>
        </TabsList>

        <TabsContent value="threat" className="mt-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Threat Keywords</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Keywords related to cybersecurity threats (e.g., malware, breach, zero-day)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-6">
              <div className="space-y-4">
                {localKeywords.filter((k) => k.category === "threat").length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      Your Keywords
                    </h3>
                    <Table className="min-w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">Term</TableHead>
                          <TableHead className="min-w-[100px]">Status</TableHead>
                          <TableHead className="text-right min-w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {localKeywords.filter((k) => k.category === "threat").map((keyword: ThreatKeyword) => {
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
                                <div className="flex items-center">
                                  {keyword.active ? (
                                    <Badge
                                      variant="default"
                                      className="flex items-center gap-1 bg-green-500 hover:bg-green-600"
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
                                              This will permanently delete the keyword "{keyword.term}". This action cannot be undone.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}