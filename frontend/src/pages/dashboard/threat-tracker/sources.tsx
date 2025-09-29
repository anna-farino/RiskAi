import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Shield,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useFetch } from "@/hooks/use-fetch";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface GlobalSource {
  id: string;
  url: string;
  name: string;
  isEnabled: boolean;
  isGlobal: boolean;
  isDefault?: boolean;
  includeInAutoScrape?: boolean;
  lastScraped?: string | null;
}

export default function ThreatSources() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fetchWithAuth = useFetch();
  
  // Toolbar state management
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

  // Phase 4: Fetch available global sources with user's enabled status
  const availableSources = useQuery<GlobalSource[]>({
    queryKey: ["/api/threat-tracker/sources/available"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth('/api/threat-tracker/sources/available', {
          method: "GET",
        });
        if (!response.ok) throw new Error("Failed to fetch available sources");
        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error(error);
        return [];
      }
    },
    placeholderData: [],
  });

  // Phase 4: Toggle source enabled/disabled
  const toggleSource = useMutation({
    mutationFn: async ({ sourceId, isEnabled }: { sourceId: string; isEnabled: boolean }) => {
      const response = await fetchWithAuth(`/api/threat-tracker/sources/${sourceId}/toggle`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isEnabled }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle source");
      }

      return response.json();
    },
    onMutate: async ({ sourceId, isEnabled }) => {
      // Optimistic update
      await queryClient.cancelQueries({
        queryKey: ["/api/threat-tracker/sources/available"],
      });

      const previousSources = queryClient.getQueryData<GlobalSource[]>([
        "/api/threat-tracker/sources/available",
      ]);

      queryClient.setQueryData<GlobalSource[]>(
        ["/api/threat-tracker/sources/available"],
        (old = []) =>
          old.map((source) =>
            source.id === sourceId ? { ...source, isEnabled } : source
          )
      );

      return { previousSources };
    },
    onError: (err, variables, context) => {
      if (context?.previousSources) {
        queryClient.setQueryData(
          ["/api/threat-tracker/sources/available"],
          context.previousSources
        );
      }
      toast({
        title: "Error toggling source",
        description: "Failed to update source status. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/threat-tracker/sources/available"] });
      toast({
        title: "Source updated",
        description: "Source status has been updated successfully.",
      });
    },
  });

  // Filter sources based on search term and status
  const filteredSources = availableSources.data?.filter(source => {
    const matchesSearch = source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         source.url.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'enabled') {
      matchesStatus = source.isEnabled;
    } else if (statusFilter === 'disabled') {
      matchesStatus = !source.isEnabled;
    }
    
    return matchesSearch && matchesStatus;
  }) || [];

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  return (
    <div
      className={cn(
        "flex flex-col pb-16 sm:pb-20 w-full min-w-0",
      )}
    >

      {/* Sources Toolbar */}
      <div className="flex flex-col gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-6 lg:mb-8">
        <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md p-4">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl md:text-2xl lg:text-2xl [letter-spacing:1px] text-white">
                Source Management
              </h1>
              <p className="text-base text-slate-400">
                Search, filter, and manage threat intelligence sources for monitoring
              </p>
            </div>
          </div>

          {/* Toolbar Content */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
            {/* Search Section */}
            <div className="col-span-1">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Search className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-medium text-purple-400">Search Sources</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name or URL..."
                    className="pl-10 h-8 text-sm bg-slate-800/70 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-[#00FFFF] focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                </div>
              </div>
            </div>

            {/* Filter Section */}
            <div className="col-span-1">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-medium text-purple-400">Status Filters</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    className={cn(
                      "h-8 text-xs px-1 transition-colors duration-200 whitespace-nowrap rounded-md border inline-flex items-center justify-center",
                      statusFilter === 'all'
                        ? "border-purple-500 bg-purple-500/20 text-purple-400"
                        : "border-slate-700 bg-slate-800/70 text-white hover:text-[#00FFFF] hover:bg-gradient-to-r hover:from-[#BF00FF]/10 hover:to-[#00FFFF]/5 hover:border-slate-500"
                    )}
                    onClick={() => setStatusFilter('all')}
                    title="Show All Sources"
                  >
                    <Filter className="h-3 w-3 mr-1" />
                    All
                  </button>
                  <button
                    className={cn(
                      "h-8 text-xs px-1 transition-colors duration-200 whitespace-nowrap rounded-md border inline-flex items-center justify-center",
                      statusFilter === 'enabled'
                        ? "border-purple-500 bg-purple-500/20 text-purple-400"
                        : "border-slate-700 bg-slate-800/70 text-white hover:text-[#00FFFF] hover:bg-gradient-to-r hover:from-[#BF00FF]/10 hover:to-[#00FFFF]/5 hover:border-slate-500"
                    )}
                    onClick={() => setStatusFilter('enabled')}
                    title="Show Enabled Sources"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Enabled
                  </button>
                  <button
                    className={cn(
                      "h-8 text-xs px-1 transition-colors duration-200 whitespace-nowrap rounded-md border inline-flex items-center justify-center",
                      statusFilter === 'disabled'
                        ? "border-purple-500 bg-purple-500/20 text-purple-400"
                        : "border-slate-700 bg-slate-800/70 text-white hover:text-[#00FFFF] hover:bg-gradient-to-r hover:from-[#BF00FF]/10 hover:to-[#00FFFF]/5 hover:border-slate-500"
                    )}
                    onClick={() => setStatusFilter('disabled')}
                    title="Show Disabled Sources"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Disabled
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
        <div className="flex flex-row gap-x-4 items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="hidden sm:block text-lg font-medium text-white">Source List</h2>
            <h2 className="sm:hidden text-lg font-medium text-white">Sources</h2>
            <div className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/20 text-primary">
              {filteredSources.length}{filteredSources.length !== availableSources.data?.length && ` of ${availableSources.data?.length || 0}`}
            </div>
            {/* Toggle All Sources Button */}
            {availableSources.data && availableSources.data.length > 0 && (
              (() => {
                const enabledCount = availableSources.data.filter(s => s.isEnabled).length;
                const allEnabled = enabledCount === availableSources.data.length;
                const hasEnabled = enabledCount > 0;
                
                return (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Toggle all sources
                      const targetSources = !hasEnabled ? 
                        availableSources.data.filter(s => !s.isEnabled) : // If enabling, get disabled sources
                        availableSources.data.filter(s => s.isEnabled);   // If disabling, get enabled sources
                      
                      targetSources.forEach(source => {
                        toggleSource.mutate({
                          sourceId: source.id,
                          isEnabled: !hasEnabled,
                        });
                      });
                    }}
                    disabled={toggleSource.isPending}
                    className={cn(
                      "h-7 px-2 text-xs transition-all duration-200",
                      hasEnabled 
                        ? "border-orange-500/30 hover:bg-orange-500/10 text-orange-400 hover:text-orange-300"
                        : "border-green-500/30 hover:bg-green-500/10 text-green-400 hover:text-green-300"
                    )}
                    title={hasEnabled ? "Disable all sources" : "Enable all sources"}
                  >
                    {toggleSource.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : hasEnabled ? (
                      <XCircle className="h-3 w-3 mr-1" />
                    ) : (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    )}
                    {hasEnabled ? "Disable All" : "Enable All"}
                  </Button>
                );
              })()
            )}
          </div>
          
          <div className="flex items-center gap-2 text-sm text-slate-400">
            {searchTerm && (
              <span>Searching: "{searchTerm}"</span>
            )}
            {statusFilter !== 'all' && (
              <span>Filter: {statusFilter === 'enabled' ? 'Enabled' : 'Disabled'}</span>
            )}
          </div>
        </div>

        {availableSources.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : availableSources.data?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-slate-800/70 flex items-center justify-center mb-4">
              <HelpCircle className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">No sources found</h3>
            <p className="text-slate-400 max-w-md mb-6">
              Contact an administrator to add sources to the global pool.
            </p>
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-slate-800/70 flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">No sources found</h3>
            <p className="text-slate-400 max-w-md mb-6">
              {searchTerm 
                ? `No sources match "${searchTerm}". Try adjusting your search terms.`
                : statusFilter !== 'all'
                  ? `No ${statusFilter} sources found. Try selecting a different status filter.`
                  : "No sources to display."
              }
            </p>
            {(searchTerm || statusFilter !== 'all') && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter('all');
                }}
                className="border-slate-600/50 hover:border-slate-500/70 hover:bg-white/10 text-white"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {/* Use filteredSources for display */}
            {filteredSources
              .sort((a,b) => a.name.localeCompare(b.name))
              .map((source) => {
              // Check if this item has a pending action
              const isPending = toggleSource.isPending && toggleSource.variables?.sourceId === source.id;
              const isCurrentlyEnabled = 
                toggleSource.isPending && toggleSource.variables?.sourceId === source.id
                  ? toggleSource.variables.isEnabled 
                  : source.isEnabled;
              
              return (
                <div 
                  key={source.id} 
                  className={cn(
                    "relative border border-slate-700/50 rounded-md overflow-hidden",
                    "transition-all duration-200",
                    isPending 
                      ? "border-orange-500/50 shadow-orange-500/10 shadow-md" 
                      : "hover:border-slate-500",
                    source.isEnabled ? "bg-primary/5" : "bg-slate-800/70"
                  )}
                >
                  {/* Show loading indicator for pending items */}
                  {isPending && (
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-10">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}
                
                  <div className={cn(
                    "absolute top-0 right-0 h-6 w-6 flex items-center justify-center",
                    "rounded-bl-lg",
                    source.isEnabled ? "bg-green-500/20" : "bg-slate-500/20"
                  )}>
                    {source.isEnabled ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-slate-400" />
                    )}
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center",
                          source.isEnabled ? "bg-primary/20" : "bg-slate-500/20"
                        )}>
                          <Shield className={cn(
                            "h-4 w-4", 
                            source.isEnabled ? "text-primary" : "text-slate-400"
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-white truncate">{source.name}</h3>
                            {source.isGlobal && (
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                Global
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-2 mb-4">
                      <p className="text-xs text-slate-400 truncate" title={source.url}>
                        {source.url}
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isCurrentlyEnabled}
                          disabled={toggleSource.isPending}
                          onCheckedChange={(checked) =>
                            toggleSource.mutate({ sourceId: source.id, isEnabled: checked })
                          }
                          className="data-[state=checked]:bg-[#BF00FF]"
                        />
                        <span className={cn(
                          "text-xs font-medium",
                          isCurrentlyEnabled ? "text-green-400" : "text-slate-400",
                          isPending && "opacity-50"
                        )}>
                          {isCurrentlyEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}