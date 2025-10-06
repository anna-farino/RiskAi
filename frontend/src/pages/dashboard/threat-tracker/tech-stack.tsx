import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { queryClient } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Loader2,
  Plus,
  Trash2,
  PencilLine,
  Package,
  Cpu,
  Building,
  Search,
  AlertTriangle,
  CheckCircle,
  Star,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface Software {
  id: string;
  name: string;
  normalizedName: string;
  vendor?: string;
  versionRange?: string;
  category?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  metadata?: any;
}

interface Hardware {
  id: string;
  name: string;
  normalizedName: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  type?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  metadata?: any;
}

interface Company {
  id: string;
  name: string;
  normalizedName: string;
  relationshipType?: 'vendor' | 'partner' | 'client' | 'competitor';
  industry?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  metadata?: any;
}

// Form schemas
const softwareFormSchema = z.object({
  name: z.string().min(1, "Software name is required"),
  vendor: z.string().optional(),
  versionRange: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
});

type SoftwareFormValues = z.infer<typeof softwareFormSchema>;

const hardwareFormSchema = z.object({
  name: z.string().min(1, "Hardware name is required"),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  firmwareVersion: z.string().optional(),
  type: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
});

type HardwareFormValues = z.infer<typeof hardwareFormSchema>;

const companyFormSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  relationshipType: z.enum(['vendor', 'partner', 'client', 'competitor']).optional(),
  industry: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

export default function TechStack() {
  const { toast } = useToast();
  const fetchWithAuth = useFetch();
  const [activeTab, setActiveTab] = useState<"software" | "hardware" | "companies">("software");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialog states
  const [softwareDialogOpen, setSoftwareDialogOpen] = useState(false);
  const [hardwareDialogOpen, setHardwareDialogOpen] = useState(false);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  
  // Editing states
  const [editingSoftware, setEditingSoftware] = useState<Software | null>(null);
  const [editingHardware, setEditingHardware] = useState<Hardware | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Forms
  const softwareForm = useForm<SoftwareFormValues>({
    resolver: zodResolver(softwareFormSchema),
    defaultValues: {
      name: "",
      vendor: "",
      versionRange: "",
      category: "",
      priority: "medium",
    },
  });

  const hardwareForm = useForm<HardwareFormValues>({
    resolver: zodResolver(hardwareFormSchema),
    defaultValues: {
      name: "",
      manufacturer: "",
      model: "",
      firmwareVersion: "",
      type: "",
      priority: "medium",
    },
  });

  const companyForm = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: "",
      relationshipType: "vendor",
      industry: "",
      priority: "medium",
    },
  });

  // Queries
  const software = useQuery<Software[]>({
    queryKey: ["/api/threat-tracker/tech-stack/software"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth("/api/threat-tracker/tech-stack/software");
        if (!response.ok) throw new Error("Failed to fetch software");
        return response.json();
      } catch (error) {
        console.error(error);
        return [];
      }
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const hardware = useQuery<Hardware[]>({
    queryKey: ["/api/threat-tracker/tech-stack/hardware"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth("/api/threat-tracker/tech-stack/hardware");
        if (!response.ok) throw new Error("Failed to fetch hardware");
        return response.json();
      } catch (error) {
        console.error(error);
        return [];
      }
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const companies = useQuery<Company[]>({
    queryKey: ["/api/threat-tracker/tech-stack/companies"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth("/api/threat-tracker/tech-stack/companies");
        if (!response.ok) throw new Error("Failed to fetch companies");
        return response.json();
      } catch (error) {
        console.error(error);
        return [];
      }
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Mutations - Software
  const createSoftware = useMutation({
    mutationFn: async (values: SoftwareFormValues) => {
      const response = await fetchWithAuth("/api/threat-tracker/tech-stack/software", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error("Failed to create software");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Software added",
        description: "The software has been added to your tech stack.",
      });
      setSoftwareDialogOpen(false);
      softwareForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/threat-tracker/tech-stack/software"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add software. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateSoftware = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: SoftwareFormValues }) => {
      const response = await fetchWithAuth(`/api/threat-tracker/tech-stack/software/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error("Failed to update software");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Software updated",
        description: "The software has been updated successfully.",
      });
      setSoftwareDialogOpen(false);
      setEditingSoftware(null);
      softwareForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/threat-tracker/tech-stack/software"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update software. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteSoftware = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithAuth(`/api/threat-tracker/tech-stack/software/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete software");
    },
    onSuccess: () => {
      toast({
        title: "Software removed",
        description: "The software has been removed from your tech stack.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/threat-tracker/tech-stack/software"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove software. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutations - Hardware
  const createHardware = useMutation({
    mutationFn: async (values: HardwareFormValues) => {
      const response = await fetchWithAuth("/api/threat-tracker/tech-stack/hardware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error("Failed to create hardware");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Hardware added",
        description: "The hardware has been added to your tech stack.",
      });
      setHardwareDialogOpen(false);
      hardwareForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/threat-tracker/tech-stack/hardware"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add hardware. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateHardware = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: HardwareFormValues }) => {
      const response = await fetchWithAuth(`/api/threat-tracker/tech-stack/hardware/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error("Failed to update hardware");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Hardware updated",
        description: "The hardware has been updated successfully.",
      });
      setHardwareDialogOpen(false);
      setEditingHardware(null);
      hardwareForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/threat-tracker/tech-stack/hardware"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update hardware. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteHardware = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithAuth(`/api/threat-tracker/tech-stack/hardware/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete hardware");
    },
    onSuccess: () => {
      toast({
        title: "Hardware removed",
        description: "The hardware has been removed from your tech stack.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/threat-tracker/tech-stack/hardware"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove hardware. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutations - Companies
  const createCompany = useMutation({
    mutationFn: async (values: CompanyFormValues) => {
      const response = await fetchWithAuth("/api/threat-tracker/tech-stack/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error("Failed to create company");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Company added",
        description: "The company has been added to your tech stack.",
      });
      setCompanyDialogOpen(false);
      companyForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/threat-tracker/tech-stack/companies"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add company. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateCompany = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: CompanyFormValues }) => {
      const response = await fetchWithAuth(`/api/threat-tracker/tech-stack/companies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error("Failed to update company");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Company updated",
        description: "The company has been updated successfully.",
      });
      setCompanyDialogOpen(false);
      setEditingCompany(null);
      companyForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/threat-tracker/tech-stack/companies"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update company. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteCompany = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithAuth(`/api/threat-tracker/tech-stack/companies/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete company");
    },
    onSuccess: () => {
      toast({
        title: "Company removed",
        description: "The company has been removed from your tech stack.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/threat-tracker/tech-stack/companies"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove company. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter data
  const filteredSoftware = software.data?.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.vendor?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const filteredHardware = hardware.data?.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const filteredCompanies = companies.data?.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.industry?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Priority colors
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'high':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'low':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  // Relationship type colors
  const getRelationshipColor = (type?: string) => {
    switch (type) {
      case 'vendor':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'partner':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'client':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'competitor':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
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
            <h1 className="text-2xl font-bold">Technology Stack Configuration</h1>
            <p className="text-muted-foreground">
              Manage your software, hardware, and company relationships for enhanced threat relevance scoring
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
                  placeholder={
                    activeTab === "software"
                      ? "Search software..."
                      : activeTab === "hardware"
                      ? "Search hardware..."
                      : "Search companies..."
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64 bg-background/50"
                />
              </div>
              {activeTab === "software" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingSoftware(null);
                    softwareForm.reset();
                    setSoftwareDialogOpen(true);
                  }}
                  className="bg-gradient-to-r from-[#BF00FF]/10 to-[#00FFFF]/10 hover:from-[#BF00FF]/20 hover:to-[#00FFFF]/20 border-[#00FFFF]/20"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Software
                </Button>
              )}
              {activeTab === "hardware" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingHardware(null);
                    hardwareForm.reset();
                    setHardwareDialogOpen(true);
                  }}
                  className="bg-gradient-to-r from-[#BF00FF]/10 to-[#00FFFF]/10 hover:from-[#BF00FF]/20 hover:to-[#00FFFF]/20 border-[#00FFFF]/20"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Hardware
                </Button>
              )}
              {activeTab === "companies" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingCompany(null);
                    companyForm.reset();
                    setCompanyDialogOpen(true);
                  }}
                  className="bg-gradient-to-r from-[#BF00FF]/10 to-[#00FFFF]/10 hover:from-[#BF00FF]/20 hover:to-[#00FFFF]/20 border-[#00FFFF]/20"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Company
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content with Tabs */}
      <Card className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border-slate-700/50 flex-grow">
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3 max-w-lg">
              <TabsTrigger value="software" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Software
              </TabsTrigger>
              <TabsTrigger value="hardware" className="flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                Hardware
              </TabsTrigger>
              <TabsTrigger value="companies" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Companies
              </TabsTrigger>
            </TabsList>

            {/* Software Tab */}
            <TabsContent value="software" className="space-y-4">
              <Card className="bg-background/50 border-slate-700/30">
                <CardHeader>
                  <CardTitle className="text-lg">Software Components</CardTitle>
                  <CardDescription>
                    Track software and applications in your technology stack
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {software.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : filteredSoftware.length > 0 ? (
                    <div className="rounded-md border border-slate-700/50">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Version</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSoftware.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell>{item.vendor || "-"}</TableCell>
                              <TableCell>{item.versionRange || "All versions"}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn(getPriorityColor(item.priority))}>
                                  {item.priority || "medium"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingSoftware(item);
                                      softwareForm.reset({
                                        name: item.name,
                                        vendor: item.vendor || "",
                                        versionRange: item.versionRange || "",
                                        category: item.category || "",
                                        priority: item.priority || "medium",
                                      });
                                      setSoftwareDialogOpen(true);
                                    }}
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
                                        <AlertDialogTitle>Remove Software</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to remove "{item.name}" from your tech stack? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteSoftware.mutate(item.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Remove
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
                      No software components added yet. Add software to monitor specific vulnerabilities.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Hardware Tab */}
            <TabsContent value="hardware" className="space-y-4">
              <Card className="bg-background/50 border-slate-700/30">
                <CardHeader>
                  <CardTitle className="text-lg">Hardware Components</CardTitle>
                  <CardDescription>
                    Track physical devices and hardware in your infrastructure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hardware.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : filteredHardware.length > 0 ? (
                    <div className="rounded-md border border-slate-700/50">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Manufacturer</TableHead>
                            <TableHead>Model</TableHead>
                            <TableHead>Firmware</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredHardware.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell>{item.manufacturer || "-"}</TableCell>
                              <TableCell>{item.model || "-"}</TableCell>
                              <TableCell>{item.firmwareVersion || "-"}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn(getPriorityColor(item.priority))}>
                                  {item.priority || "medium"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingHardware(item);
                                      hardwareForm.reset({
                                        name: item.name,
                                        manufacturer: item.manufacturer || "",
                                        model: item.model || "",
                                        firmwareVersion: item.firmwareVersion || "",
                                        type: item.type || "",
                                        priority: item.priority || "medium",
                                      });
                                      setHardwareDialogOpen(true);
                                    }}
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
                                        <AlertDialogTitle>Remove Hardware</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to remove "{item.name}" from your tech stack? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteHardware.mutate(item.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Remove
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
                      No hardware components added yet. Add hardware to monitor device-specific vulnerabilities.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Companies Tab */}
            <TabsContent value="companies" className="space-y-4">
              <Card className="bg-background/50 border-slate-700/30">
                <CardHeader>
                  <CardTitle className="text-lg">Related Companies</CardTitle>
                  <CardDescription>
                    Track vendors, partners, clients, and competitors for supply chain monitoring
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {companies.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : filteredCompanies.length > 0 ? (
                    <div className="rounded-md border border-slate-700/50">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Relationship</TableHead>
                            <TableHead>Industry</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCompanies.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn(getRelationshipColor(item.relationshipType))}>
                                  {item.relationshipType || "vendor"}
                                </Badge>
                              </TableCell>
                              <TableCell>{item.industry || "-"}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn(getPriorityColor(item.priority))}>
                                  {item.priority || "medium"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingCompany(item);
                                      companyForm.reset({
                                        name: item.name,
                                        relationshipType: item.relationshipType || "vendor",
                                        industry: item.industry || "",
                                        priority: item.priority || "medium",
                                      });
                                      setCompanyDialogOpen(true);
                                    }}
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
                                        <AlertDialogTitle>Remove Company</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to remove "{item.name}" from your tech stack? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteCompany.mutate(item.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Remove
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
                      No companies added yet. Add companies to monitor supply chain threats.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Software Dialog */}
      <Dialog open={softwareDialogOpen} onOpenChange={setSoftwareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSoftware ? "Edit Software" : "Add Software"}
            </DialogTitle>
            <DialogDescription>
              {editingSoftware
                ? "Update the software details below."
                : "Add a new software component to your tech stack."}
            </DialogDescription>
          </DialogHeader>
          <Form {...softwareForm}>
            <form onSubmit={softwareForm.handleSubmit((values) => {
              if (editingSoftware) {
                updateSoftware.mutate({ id: editingSoftware.id, values });
              } else {
                createSoftware.mutate(values);
              }
            })} className="space-y-4">
              <FormField
                control={softwareForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Software Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Apache, WordPress, Docker" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={softwareForm.control}
                name="vendor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Apache Foundation, Microsoft" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={softwareForm.control}
                name="versionRange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Version Range</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 2.4.*, >=3.0.0, 1.2.3-1.2.5" {...field} />
                    </FormControl>
                    <FormDescription>
                      Specify version range or leave empty for all versions
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={softwareForm.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSoftwareDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createSoftware.isPending || updateSoftware.isPending}>
                  {createSoftware.isPending || updateSoftware.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingSoftware ? "Updating..." : "Adding..."}
                    </>
                  ) : (
                    editingSoftware ? "Update Software" : "Add Software"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Hardware Dialog */}
      <Dialog open={hardwareDialogOpen} onOpenChange={setHardwareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingHardware ? "Edit Hardware" : "Add Hardware"}
            </DialogTitle>
            <DialogDescription>
              {editingHardware
                ? "Update the hardware details below."
                : "Add a new hardware component to your tech stack."}
            </DialogDescription>
          </DialogHeader>
          <Form {...hardwareForm}>
            <form onSubmit={hardwareForm.handleSubmit((values) => {
              if (editingHardware) {
                updateHardware.mutate({ id: editingHardware.id, values });
              } else {
                createHardware.mutate(values);
              }
            })} className="space-y-4">
              <FormField
                control={hardwareForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hardware Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Cisco ASA, Dell PowerEdge" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={hardwareForm.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Cisco, Dell, HP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={hardwareForm.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., ASA 5500, R740" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={hardwareForm.control}
                name="firmwareVersion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Firmware Version</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 9.14.1, 2.3.0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={hardwareForm.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setHardwareDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createHardware.isPending || updateHardware.isPending}>
                  {createHardware.isPending || updateHardware.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingHardware ? "Updating..." : "Adding..."}
                    </>
                  ) : (
                    editingHardware ? "Update Hardware" : "Add Hardware"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Company Dialog */}
      <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? "Edit Company" : "Add Company"}
            </DialogTitle>
            <DialogDescription>
              {editingCompany
                ? "Update the company details below."
                : "Add a new company to your tech stack."}
            </DialogDescription>
          </DialogHeader>
          <Form {...companyForm}>
            <form onSubmit={companyForm.handleSubmit((values) => {
              if (editingCompany) {
                updateCompany.mutate({ id: editingCompany.id, values });
              } else {
                createCompany.mutate(values);
              }
            })} className="space-y-4">
              <FormField
                control={companyForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Microsoft, AWS, Cloudflare" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={companyForm.control}
                name="relationshipType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select relationship type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="vendor">Vendor</SelectItem>
                        <SelectItem value="partner">Partner</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                        <SelectItem value="competitor">Competitor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={companyForm.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Technology, Finance, Healthcare" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={companyForm.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCompanyDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createCompany.isPending || updateCompany.isPending}>
                  {createCompany.isPending || updateCompany.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingCompany ? "Updating..." : "Adding..."}
                    </>
                  ) : (
                    editingCompany ? "Update Company" : "Add Company"
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