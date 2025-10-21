import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Trash2, Plus, Upload, FileSpreadsheet, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/query-client";
import { useFetch } from "@/hooks/use-fetch";
import { Autocomplete } from "@/components/ui/autocomplete";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// Type definitions
interface TechStackItem {
  id: string;
  name: string;
  version?: string | null;
  priority?: number | null;
  isActive?: boolean;
  company?: string | null;
  manufacturer?: string | null; // For hardware items
  model?: string | null; // For hardware items
  source?: string | null; // For tracking auto-added vendors
  threats?: {
    count: number;
    highestLevel: 'critical' | 'high' | 'medium' | 'low';
  } | null;
}

interface TechStackResponse {
  software: TechStackItem[];
  hardware: TechStackItem[];
  vendors: TechStackItem[];
  clients: TechStackItem[];
}

interface ExtractedEntity {
  type: 'software' | 'hardware' | 'vendor' | 'client';
  name: string;
  version?: string;
  manufacturer?: string;
  model?: string;
  isNew: boolean;
  matchedId?: string;
}

export default function TechStackPage() {
  const fetchWithAuth = useFetch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [softwareOpen, setSoftwareOpen] = useState(true);
  const [hardwareOpen, setHardwareOpen] = useState(false);
  const [vendorsOpen, setVendorsOpen] = useState(false);
  const [clientsOpen, setClientsOpen] = useState(false);
  
  const [softwareSearch, setSoftwareSearch] = useState("");
  const [hardwareSearch, setHardwareSearch] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  
  // File upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [extractedEntities, setExtractedEntities] = useState<ExtractedEntity[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<Set<number>>(new Set());

  // Autocomplete fetch functions
  const fetchSoftwareOptions = async (query: string) => {
    const response = await fetchWithAuth(`/api/threat-tracker/tech-stack/autocomplete?type=software&query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to fetch software options');
    const data = await response.json();
    return data.results || [];
  };

  const fetchHardwareOptions = async (query: string) => {
    const response = await fetchWithAuth(`/api/threat-tracker/tech-stack/autocomplete?type=hardware&query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to fetch hardware options');
    const data = await response.json();
    return data.results || [];
  };

  const fetchVendorOptions = async (query: string) => {
    const response = await fetchWithAuth(`/api/threat-tracker/tech-stack/autocomplete?type=vendor&query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to fetch vendor options');
    const data = await response.json();
    return data.results || [];
  };

  const fetchClientOptions = async (query: string) => {
    const response = await fetchWithAuth(`/api/threat-tracker/tech-stack/autocomplete?type=client&query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to fetch client options');
    const data = await response.json();
    return data.results || [];
  };

  // Fetch tech stack data
  const { data: techStack, isLoading } = useQuery<TechStackResponse>({
    queryKey: ['/api/threat-tracker/tech-stack'],
    queryFn: async () => {
      const response = await fetchWithAuth('/api/threat-tracker/tech-stack');
      if (!response.ok) throw new Error('Failed to fetch tech stack');
      return response.json();
    }
  });

  // Add item mutation
  const addItem = useMutation({
    mutationFn: async ({ type, name, version, priority }: {
      type: 'software' | 'hardware' | 'vendor' | 'client';
      name: string;
      version?: string;
      priority?: number;
    }) => {
      const response = await fetchWithAuth('/api/threat-tracker/tech-stack/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name, version, priority })
      });
      if (!response.ok) throw new Error('Failed to add item');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/threat-tracker/tech-stack'] });
      toast({
        title: "Item added",
        description: "Technology stack item has been added successfully"
      });
    }
  });

  // Remove item mutation (hard delete - permanently removes the relation)
  const removeItem = useMutation({
    mutationFn: async ({ itemId, type }: { itemId: string; type: string }) => {
      const response = await fetchWithAuth(`/api/threat-tracker/tech-stack/${itemId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      if (!response.ok) throw new Error('Failed to remove item');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/threat-tracker/tech-stack'] });
      toast({
        title: "Item removed",
        description: "Technology stack item has been permanently removed"
      });
    }
  });

  // Toggle item mutation (soft delete - enables/disables the item)
  const toggleItem = useMutation({
    mutationFn: async ({ itemId, type, isActive }: { itemId: string; type: string; isActive: boolean }) => {
      const response = await fetchWithAuth(`/api/threat-tracker/tech-stack/${itemId}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, isActive })
      });
      if (!response.ok) throw new Error('Failed to toggle item');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/threat-tracker/tech-stack'] });
      toast({
        title: data.isActive ? "Item enabled" : "Item disabled",
        description: `Technology stack item has been ${data.isActive ? 'enabled' : 'disabled'}`
      });
    }
  });

  // Helper component for tech stack items with threat indicators
  const TechStackItem = ({ 
    item, 
    type 
  }: { 
    item: TechStackItem; 
    type: 'software' | 'hardware' | 'vendor' | 'client' 
  }) => {
    const navigate = useNavigate();
    
    const getThreatColor = (level: string) => {
      switch(level) {
        case 'critical': return 'bg-red-500';
        case 'high': return 'bg-orange-500';
        case 'medium': return 'bg-yellow-500';
        case 'low': return 'bg-green-500';
        default: return 'bg-gray-500';
      }
    };

    const getThreatLabel = (level: string) => {
      return level.charAt(0).toUpperCase() + level.slice(1);
    };

    // Default to active if not specified
    const isActive = item.isActive !== false;

    return (
      <div 
        className={cn(
          "flex items-center justify-between py-3 px-4 rounded-md transition-colors",
          isActive ? "hover:bg-muted/50" : "opacity-50 hover:bg-muted/30"
        )}
        data-testid={`tech-item-${item.id}`}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span 
                className={cn(
                  "font-medium",
                  !isActive && "line-through text-muted-foreground"
                )} 
                data-testid={`text-item-name-${item.id}`}
              >
                {/* Display with styled prefix for both hardware and software */}
                {type === 'hardware' && item.manufacturer && (
                  <>
                    <span className="text-muted-foreground">{item.manufacturer}</span>
                    {' '}
                  </>
                )}
                {type === 'software' && item.company && (
                  <>
                    <span className="text-muted-foreground">{item.company}</span>
                    {' '}
                  </>
                )}
                <span>{item.name}</span>
              </span>
              {/* Show version for software */}
              {item.version && (
                <span className="text-sm text-muted-foreground" data-testid={`text-item-version-${item.id}`}>
                  v{item.version}
                </span>
              )}
              {/* Show auto-added indicator for vendors */}
              {type === 'vendor' && item.source && item.source !== 'manual' && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-md text-muted-foreground" data-testid={`text-auto-added-${item.id}`}>
                  {item.source === 'auto-software' ? 'from software' : 
                   item.source === 'auto-hardware' ? 'from hardware' : 'auto'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Threat indicator - only shows if threats exist and item is active */}
        {isActive && item.threats && item.threats.count > 0 && (
          <button
            onClick={() => {
              // Navigate to threats page with filter for this specific entity
              const filterParam = encodeURIComponent(`${type}:${item.name}`);
              navigate(`/dashboard/threat/home?entityFilter=${filterParam}`);
            }}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity mr-4 px-2 py-1 rounded-md hover:bg-muted/50"
            data-testid={`button-threat-indicator-${item.id}`}
          >
            <span 
              className={cn(
                "w-2 h-2 rounded-full",
                getThreatColor(item.threats.highestLevel)
              )}
              data-testid={`indicator-threat-${item.id}`}
            />
            <span className="text-sm text-muted-foreground" data-testid={`text-threat-count-${item.id}`}>
              {item.threats.count} {getThreatLabel(item.threats.highestLevel)} threats
            </span>
          </button>
        )}

        <div className="flex items-center gap-2">
          {/* Enable/Disable Toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => {
                      toggleItem.mutate({ 
                        itemId: item.id, 
                        type, 
                        isActive: checked 
                      });
                    }}
                    data-testid={`switch-toggle-${item.id}`}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isActive ? 'Disable' : 'Enable'} monitoring for this item</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Delete Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Are you sure you want to permanently remove ${item.name}? This cannot be undone.`)) {
                      removeItem.mutate({ itemId: item.id, type });
                    }
                  }}
                  data-testid={`button-remove-${item.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Permanently delete this item</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading technology stack...</div>
      </div>
    );
  }

  // File upload handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      await handleFileUpload(file);
    } else {
      toast({
        title: "Invalid file",
        description: "Please upload an Excel (.xlsx, .xls) or CSV file",
        variant: "destructive"
      });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Debug: Show all cookies
      console.log('[UPLOAD] All cookies:', document.cookie);
      
      // Add CSRF token to FormData for multipart requests
      const cookies = document.cookie.split("; ");
      console.log('[UPLOAD] Cookie array:', cookies);
      
      const csrfCookie = cookies.find((entry) => entry.startsWith("csrf-token="));
      
      let csrfToken = "";
      if (csrfCookie) {
        const cookieValue = csrfCookie.split("=")[1];
        if (cookieValue) {
          const decodedValue = decodeURIComponent(cookieValue);
          csrfToken = decodedValue.split("|")[0];
        }
      } else {
        // Try to get token from csfrHeader utility
        const { csfrHeader } = await import('@/utils/csrf-header');
        const csrfData = csfrHeader();
        csrfToken = csrfData.token;
        console.log('[UPLOAD] CSRF from utility:', csrfData);
      }
      
      console.log('[UPLOAD] CSRF Cookie:', csrfCookie);
      console.log('[UPLOAD] CSRF Token:', csrfToken);
      
      if (csrfToken) {
        formData.append('_csrf', csrfToken);
      } else {
        console.error('[UPLOAD] No CSRF token available!');
      }
      
      console.log('[UPLOAD] Sending FormData with file:', file.name);
      console.log('[UPLOAD] FormData entries:', Array.from(formData.entries()));
      
      const response = await fetchWithAuth('/api/threat-tracker/tech-stack/upload', {
        method: 'POST',
        body: formData,
        // Explicitly don't set Content-Type - browser will set it with boundary
        headers: {}
      });
      
      if (!response.ok) {
        throw new Error('Failed to process file');
      }
      
      const data = await response.json();
      setExtractedEntities(data.entities);
      setSelectedEntities(new Set(data.entities.map((_: ExtractedEntity, i: number) => i)));
      setShowPreview(true);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to process the spreadsheet. Please check the format and try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImportSelected = async () => {
    const entitiesToImport = extractedEntities.filter((_, index) => selectedEntities.has(index));
    
    if (entitiesToImport.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item to import",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const response = await fetchWithAuth('/api/threat-tracker/tech-stack/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entities: entitiesToImport })
      });
      
      if (!response.ok) {
        throw new Error('Failed to import items');
      }
      
      const result = await response.json();
      
      queryClient.invalidateQueries({ queryKey: ['/api/threat-tracker/tech-stack'] });
      
      toast({
        title: "Import successful",
        description: `Imported ${result.imported} items to your tech stack`
      });
      
      setShowPreview(false);
      setExtractedEntities([]);
      setSelectedEntities(new Set());
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Failed to import selected items. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const toggleEntitySelection = (index: number) => {
    const newSelection = new Set(selectedEntities);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedEntities(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedEntities.size === extractedEntities.length) {
      setSelectedEntities(new Set());
    } else {
      setSelectedEntities(new Set(extractedEntities.map((_, i) => i)));
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Technology Stack</h2>
          <p className="text-muted-foreground mt-1">
            Configure your software, hardware, vendors, and clients for personalized threat monitoring
          </p>
        </div>
        
        {/* File Upload Button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            variant="outline"
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Import from Spreadsheet
          </Button>
        </div>
      </div>

      {/* Drag and Drop Zone */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="pt-6 pb-6 text-center">
          <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">
            Drag and drop an Excel or CSV file here, or click the Import button above
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Supported formats: .xlsx, .xls, .csv
          </p>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Review Extracted Items</DialogTitle>
            <DialogDescription>
              We've extracted the following items from your spreadsheet. Select which ones to import to your tech stack.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex justify-between items-center mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAllSelection}
              >
                {selectedEntities.size === extractedEntities.length ? 'Deselect All' : 'Select All'}
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedEntities.size} of {extractedEntities.length} selected
              </span>
            </div>
            
            <ScrollArea className="h-[400px] border rounded-lg p-4">
              <div className="space-y-2">
                {extractedEntities.map((entity, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedEntities.has(index) ? "bg-primary/5 border-primary" : "hover:bg-muted/50"
                    )}
                    onClick={() => toggleEntitySelection(index)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center",
                        selectedEntities.has(index) ? "bg-primary border-primary" : "border-muted-foreground"
                      )}>
                        {selectedEntities.has(index) && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entity.name}</span>
                          {entity.version && <Badge variant="secondary">{entity.version}</Badge>}
                          <Badge variant={entity.type === 'software' ? 'default' : entity.type === 'hardware' ? 'secondary' : 'outline'}>
                            {entity.type}
                          </Badge>
                          {entity.isNew && <Badge variant="outline" className="text-green-600">New</Badge>}
                        </div>
                        {entity.manufacturer && (
                          <p className="text-sm text-muted-foreground">by {entity.manufacturer}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)} disabled={isUploading}>
              Cancel
            </Button>
            <Button onClick={handleImportSelected} disabled={isUploading || selectedEntities.size === 0}>
              Import {selectedEntities.size} Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Global Bulk Actions */}
          <div className="flex items-center justify-between pb-4 border-b">
            <div className="text-sm text-muted-foreground">
              Total items: {(techStack?.software?.length || 0) + (techStack?.hardware?.length || 0) + (techStack?.vendors?.length || 0) + (techStack?.clients?.length || 0)}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Enable all items across all categories
                  const allItems = [
                    ...(techStack?.software || []).map(item => ({ id: item.id, type: 'software' })),
                    ...(techStack?.hardware || []).map(item => ({ id: item.id, type: 'hardware' })),
                    ...(techStack?.vendors || []).map(item => ({ id: item.id, type: 'vendor' })),
                    ...(techStack?.clients || []).map(item => ({ id: item.id, type: 'client' }))
                  ];
                  
                  allItems.forEach(item => {
                    toggleItem.mutate({ itemId: item.id, type: item.type, isActive: true });
                  });
                }}
                className="h-8 px-3 text-xs"
                data-testid="button-enable-all"
              >
                Enable All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Disable all items across all categories
                  const allItems = [
                    ...(techStack?.software || []).map(item => ({ id: item.id, type: 'software' })),
                    ...(techStack?.hardware || []).map(item => ({ id: item.id, type: 'hardware' })),
                    ...(techStack?.vendors || []).map(item => ({ id: item.id, type: 'vendor' })),
                    ...(techStack?.clients || []).map(item => ({ id: item.id, type: 'client' }))
                  ];
                  
                  allItems.forEach(item => {
                    toggleItem.mutate({ itemId: item.id, type: item.type, isActive: false });
                  });
                }}
                className="h-8 px-3 text-xs"
                data-testid="button-disable-all"
              >
                Disable All
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm('Are you sure you want to delete ALL items from your technology stack? This cannot be undone.')) {
                    // Delete all items across all categories
                    const allItems = [
                      ...(techStack?.software || []).map(item => ({ id: item.id, type: 'software' })),
                      ...(techStack?.hardware || []).map(item => ({ id: item.id, type: 'hardware' })),
                      ...(techStack?.vendors || []).map(item => ({ id: item.id, type: 'vendor' })),
                      ...(techStack?.clients || []).map(item => ({ id: item.id, type: 'client' }))
                    ];
                    
                    allItems.forEach(item => {
                      removeItem.mutate({ itemId: item.id, type: item.type });
                    });
                  }
                }}
                className="h-8 px-3 text-xs"
                data-testid="button-delete-all"
              >
                Delete All
              </Button>
            </div>
          </div>

          {/* Software Section */}
          <Collapsible open={softwareOpen} onOpenChange={setSoftwareOpen}>
            <div className="space-y-4">
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-md p-2 -ml-2 transition-colors">
                {softwareOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
                <h3 className="text-lg font-semibold">
                  Software ({techStack?.software?.length || 0})
                </h3>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Autocomplete
                      placeholder="Add software (e.g., Apache, nginx, Redis)..."
                      value={softwareSearch}
                      onValueChange={setSoftwareSearch}
                      onSelect={(option) => {
                        addItem.mutate({ 
                          type: 'software', 
                          name: option.name,
                          // Use the existing entity ID for linking
                          priority: 1
                        });
                      }}
                      fetchOptions={fetchSoftwareOptions}
                      className="flex-1"
                    />
                    <Button 
                      onClick={() => {
                        if (softwareSearch.trim()) {
                          // Allow manual entry for software not in database
                          addItem.mutate({ 
                            type: 'software', 
                            name: softwareSearch.trim() 
                          });
                          setSoftwareSearch("");
                        }
                      }}
                      data-testid="button-add-software"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                  
                  {/* Category bulk actions */}
                  {techStack?.software && techStack.software.length > 0 && (
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          techStack.software.forEach(item => {
                            toggleItem.mutate({ itemId: item.id, type: 'software', isActive: true });
                          });
                        }}
                        className="h-7 px-2 text-xs"
                      >
                        Enable All Software
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          techStack.software.forEach(item => {
                            toggleItem.mutate({ itemId: item.id, type: 'software', isActive: false });
                          });
                        }}
                        className="h-7 px-2 text-xs"
                      >
                        Disable All Software
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete all software items? This cannot be undone.')) {
                            techStack.software.forEach(item => {
                              removeItem.mutate({ itemId: item.id, type: 'software' });
                            });
                          }
                        }}
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      >
                        Delete All Software
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="space-y-1">
                  {techStack?.software?.map(item => (
                    <TechStackItem
                      key={item.id}
                      item={item}
                      type="software"
                    />
                  ))}
                  {(!techStack?.software || techStack.software.length === 0) && (
                    <div className="text-sm text-muted-foreground py-8 text-center">
                      No software added yet. Add your software stack to monitor threats.
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          <Separator />

          {/* Hardware Section */}
          <Collapsible open={hardwareOpen} onOpenChange={setHardwareOpen}>
            <div className="space-y-4">
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-md p-2 -ml-2 transition-colors">
                {hardwareOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
                <h3 className="text-lg font-semibold">
                  Hardware ({techStack?.hardware?.length || 0})
                </h3>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Autocomplete
                      placeholder="Add hardware (e.g., Cisco ASA, Dell PowerEdge)..."
                      value={hardwareSearch}
                      onValueChange={setHardwareSearch}
                      onSelect={(option) => {
                        addItem.mutate({ 
                          type: 'hardware', 
                          name: option.name,
                          priority: 1
                        });
                      }}
                      fetchOptions={fetchHardwareOptions}
                      className="flex-1"
                    />
                    <Button 
                      onClick={() => {
                        if (hardwareSearch.trim()) {
                          // Allow manual entry for hardware not in database
                          addItem.mutate({ 
                            type: 'hardware', 
                            name: hardwareSearch.trim() 
                          });
                          setHardwareSearch("");
                        }
                      }}
                      data-testid="button-add-hardware"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                  
                  {/* Category bulk actions */}
                  {techStack?.hardware && techStack.hardware.length > 0 && (
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          techStack.hardware.forEach(item => {
                            toggleItem.mutate({ itemId: item.id, type: 'hardware', isActive: true });
                          });
                        }}
                        className="h-7 px-2 text-xs"
                      >
                        Enable All Hardware
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          techStack.hardware.forEach(item => {
                            toggleItem.mutate({ itemId: item.id, type: 'hardware', isActive: false });
                          });
                        }}
                        className="h-7 px-2 text-xs"
                      >
                        Disable All Hardware
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete all hardware items? This cannot be undone.')) {
                            techStack.hardware.forEach(item => {
                              removeItem.mutate({ itemId: item.id, type: 'hardware' });
                            });
                          }
                        }}
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      >
                        Delete All Hardware
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="space-y-1">
                  {techStack?.hardware?.map(item => (
                    <TechStackItem
                      key={item.id}
                      item={item}
                      type="hardware"
                    />
                  ))}
                  {(!techStack?.hardware || techStack.hardware.length === 0) && (
                    <div className="text-sm text-muted-foreground py-8 text-center">
                      No hardware added yet. Add your hardware to monitor vulnerabilities.
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          <Separator />

          {/* Vendors Section */}
          <Collapsible open={vendorsOpen} onOpenChange={setVendorsOpen}>
            <div className="space-y-4">
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-md p-2 -ml-2 transition-colors">
                {vendorsOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
                <h3 className="text-lg font-semibold">
                  Vendors ({techStack?.vendors?.length || 0})
                </h3>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Autocomplete
                      placeholder="Add vendor (e.g., Microsoft, Amazon, Oracle)..."
                      value={vendorSearch}
                      onValueChange={setVendorSearch}
                      onSelect={(option) => {
                        addItem.mutate({ 
                          type: 'vendor', 
                          name: option.name,
                          priority: 1
                        });
                      }}
                      fetchOptions={fetchVendorOptions}
                      className="flex-1"
                    />
                    <Button 
                      onClick={() => {
                        if (vendorSearch.trim()) {
                          // Allow manual entry for vendors not in database
                          addItem.mutate({ 
                            type: 'vendor', 
                            name: vendorSearch.trim() 
                          });
                          setVendorSearch("");
                        }
                      }}
                      data-testid="button-add-vendor"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                  
                  {/* Category bulk actions */}
                  {techStack?.vendors && techStack.vendors.length > 0 && (
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          techStack.vendors.forEach(item => {
                            toggleItem.mutate({ itemId: item.id, type: 'vendor', isActive: true });
                          });
                        }}
                        className="h-7 px-2 text-xs"
                      >
                        Enable All Vendors
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          techStack.vendors.forEach(item => {
                            toggleItem.mutate({ itemId: item.id, type: 'vendor', isActive: false });
                          });
                        }}
                        className="h-7 px-2 text-xs"
                      >
                        Disable All Vendors
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete all vendor items? This cannot be undone.')) {
                            techStack.vendors.forEach(item => {
                              removeItem.mutate({ itemId: item.id, type: 'vendor' });
                            });
                          }
                        }}
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      >
                        Delete All Vendors
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="space-y-1">
                  {techStack?.vendors?.map(item => (
                    <TechStackItem
                      key={item.id}
                      item={item}
                      type="vendor"
                    />
                  ))}
                  {(!techStack?.vendors || techStack.vendors.length === 0) && (
                    <div className="text-sm text-muted-foreground py-8 text-center">
                      No vendors added yet. Add your vendors to track their security issues.
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          <Separator />

          {/* Clients Section */}
          <Collapsible open={clientsOpen} onOpenChange={setClientsOpen}>
            <div className="space-y-4">
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-md p-2 -ml-2 transition-colors">
                {clientsOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
                <h3 className="text-lg font-semibold">
                  Clients ({techStack?.clients?.length || 0})
                </h3>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Autocomplete
                      placeholder="Add client (e.g., Bank of America, Acme Corp)..."
                      value={clientSearch}
                      onValueChange={setClientSearch}
                      onSelect={(option) => {
                        addItem.mutate({ 
                          type: 'client', 
                          name: option.name,
                          priority: 1
                        });
                      }}
                      fetchOptions={fetchClientOptions}
                      className="flex-1"
                    />
                    <Button 
                      onClick={() => {
                        if (clientSearch.trim()) {
                          // Allow manual entry for clients not in database
                          addItem.mutate({ 
                            type: 'client', 
                            name: clientSearch.trim() 
                          });
                          setClientSearch("");
                        }
                      }}
                      data-testid="button-add-client"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                  
                  {/* Category bulk actions */}
                  {techStack?.clients && techStack.clients.length > 0 && (
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          techStack.clients.forEach(item => {
                            toggleItem.mutate({ itemId: item.id, type: 'client', isActive: true });
                          });
                        }}
                        className="h-7 px-2 text-xs"
                      >
                        Enable All Clients
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          techStack.clients.forEach(item => {
                            toggleItem.mutate({ itemId: item.id, type: 'client', isActive: false });
                          });
                        }}
                        className="h-7 px-2 text-xs"
                      >
                        Disable All Clients
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete all client items? This cannot be undone.')) {
                            techStack.clients.forEach(item => {
                              removeItem.mutate({ itemId: item.id, type: 'client' });
                            });
                          }
                        }}
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      >
                        Delete All Clients
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="space-y-1">
                  {techStack?.clients?.map(item => (
                    <TechStackItem
                      key={item.id}
                      item={item}
                      type="client"
                    />
                  ))}
                  {(!techStack?.clients || techStack.clients.length === 0) && (
                    <div className="text-sm text-muted-foreground py-8 text-center">
                      No clients added yet. Add your clients to monitor breaches affecting them.
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  );
}