import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Trash2, Plus } from "lucide-react";
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

export default function TechStackPage() {
  const fetchWithAuth = useFetch();
  const [softwareOpen, setSoftwareOpen] = useState(true);
  const [hardwareOpen, setHardwareOpen] = useState(false);
  const [vendorsOpen, setVendorsOpen] = useState(false);
  const [clientsOpen, setClientsOpen] = useState(false);
  
  const [softwareSearch, setSoftwareSearch] = useState("");
  const [hardwareSearch, setHardwareSearch] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");

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
              // Navigate to threats page with filter
              window.location.href = `/dashboard/threat-tracker?filter=${type}:${item.id}`;
            }}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity mr-4"
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

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Technology Stack</h2>
        <p className="text-muted-foreground mt-1">
          Configure your software, hardware, vendors, and clients for personalized threat monitoring
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
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