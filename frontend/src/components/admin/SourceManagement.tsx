import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useFetch } from "@/hooks/use-fetch";
import { cn } from "@/lib/utils";
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  HelpCircle,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Shield,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

interface GlobalSource {
  id: string;
  url: string;
  name: string;
  category?: string | null;
  isActive: boolean;
  isDefault: boolean;
  priority?: number;
  lastScraped?: string | null;
  addedAt?: string;
}

export default function SourceManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fetchWithAuth = useFetch();

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<GlobalSource | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    category: "",
  });

  // Fetch all global sources
  const sources = useQuery<GlobalSource[]>({
    queryKey: ["/api/admin/global-sources/sources"],
    queryFn: async () => {
      const response = await fetchWithAuth('/api/admin/global-sources/sources', {
        method: "GET",
      });
      if (!response.ok) throw new Error("Failed to fetch sources");
      return response.json();
    },
    placeholderData: [],
  });

  // Toggle source active/inactive
  const toggleSource = useMutation({
    mutationFn: async ({ sourceId, isActive }: { sourceId: string; isActive: boolean }) => {
      const response = await fetchWithAuth(`/api/admin/global-sources/sources/${sourceId}/toggle`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle source");
      }

      return response.json();
    },
    onMutate: async ({ sourceId, isActive }) => {
      await queryClient.cancelQueries({
        queryKey: ["/api/admin/global-sources/sources"],
      });

      const previousSources = queryClient.getQueryData<GlobalSource[]>([
        "/api/admin/global-sources/sources",
      ]);

      queryClient.setQueryData<GlobalSource[]>(
        ["/api/admin/global-sources/sources"],
        (old = []) =>
          old.map((source) =>
            source.id === sourceId ? { ...source, isActive } : source
          )
      );

      return { previousSources };
    },
    onError: (err, variables, context) => {
      if (context?.previousSources) {
        queryClient.setQueryData(
          ["/api/admin/global-sources/sources"],
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/global-sources/sources"] });
      toast({
        title: "Source updated",
        description: "Source status has been updated successfully.",
      });
    },
  });

  // Add new source
  const addSource = useMutation({
    mutationFn: async (data: { name: string; url: string; category?: string }) => {
      const response = await fetchWithAuth('/api/admin/global-sources/sources', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add source");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/global-sources/sources"] });
      setAddDialogOpen(false);
      setFormData({ name: "", url: "", category: "" });
      toast({
        title: "Source added",
        description: "New source has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding source",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update source
  const updateSource = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; url?: string; category?: string } }) => {
      const response = await fetchWithAuth(`/api/admin/global-sources/sources/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update source");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/global-sources/sources"] });
      setEditDialogOpen(false);
      setSelectedSource(null);
      setFormData({ name: "", url: "", category: "" });
      toast({
        title: "Source updated",
        description: "Source has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating source",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete source
  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithAuth(`/api/admin/global-sources/sources/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete source");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/global-sources/sources"] });
      setDeleteDialogOpen(false);
      setSelectedSource(null);
      toast({
        title: "Source deleted",
        description: "Source has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting source",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter sources
  const filteredSources = sources.data?.filter(source => {
    const matchesSearch = source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         source.url.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'enabled') {
      matchesStatus = source.isActive;
    } else if (statusFilter === 'disabled') {
      matchesStatus = !source.isActive;
    }
    
    return matchesSearch && matchesStatus;
  }) || [];

  // Handlers
  const handleAddSource = () => {
    if (!formData.name || !formData.url) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    addSource.mutate({
      name: formData.name,
      url: formData.url,
      category: formData.category || undefined,
    });
  };

  const handleEditSource = () => {
    if (!selectedSource) return;

    updateSource.mutate({
      id: selectedSource.id,
      data: {
        name: formData.name || undefined,
        url: formData.url || undefined,
        category: formData.category || undefined,
      },
    });
  };

  const handleDeleteSource = () => {
    if (!selectedSource) return;
    deleteSource.mutate(selectedSource.id);
  };

  const openEditDialog = (source: GlobalSource) => {
    setSelectedSource(source);
    setFormData({
      name: source.name,
      url: source.url,
      category: source.category || "",
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (source: GlobalSource) => {
    setSelectedSource(source);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-4 mt-6">
      {/* Toolbar */}
      <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-6 w-6 text-purple-400" />
          <span className="text-xl font-semibold text-white">Global Source Management</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Search */}
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
                  className="pl-10 h-8 text-sm bg-slate-800/70 border-slate-700/50 text-white placeholder:text-slate-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-source-search"
                />
              </div>
            </div>
          </div>

          {/* Status Filter */}
          <div className="col-span-1">
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-3">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-400">Status Filters</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  className={cn(
                    "h-8 text-xs px-1 transition-colors duration-200 rounded-md border inline-flex items-center justify-center",
                    statusFilter === 'all'
                      ? "border-purple-500 bg-purple-500/20 text-purple-400"
                      : "border-slate-700 bg-slate-800/70 text-white hover:bg-slate-700/50"
                  )}
                  onClick={() => setStatusFilter('all')}
                  data-testid="button-filter-all"
                >
                  All
                </button>
                <button
                  className={cn(
                    "h-8 text-xs px-1 transition-colors duration-200 rounded-md border inline-flex items-center justify-center",
                    statusFilter === 'enabled'
                      ? "border-purple-500 bg-purple-500/20 text-purple-400"
                      : "border-slate-700 bg-slate-800/70 text-white hover:bg-slate-700/50"
                  )}
                  onClick={() => setStatusFilter('enabled')}
                  data-testid="button-filter-enabled"
                >
                  Enabled
                </button>
                <button
                  className={cn(
                    "h-8 text-xs px-1 transition-colors duration-200 rounded-md border inline-flex items-center justify-center",
                    statusFilter === 'disabled'
                      ? "border-purple-500 bg-purple-500/20 text-purple-400"
                      : "border-slate-700 bg-slate-800/70 text-white hover:bg-slate-700/50"
                  )}
                  onClick={() => setStatusFilter('disabled')}
                  data-testid="button-filter-disabled"
                >
                  Disabled
                </button>
              </div>
            </div>
          </div>

          {/* Source Info */}
          <div className="col-span-1">
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-3">
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-400">Source Info</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-8 text-xs px-2 rounded-md border border-slate-700 bg-slate-800/70 text-white inline-flex items-center justify-center">
                  <Shield className="h-3 w-3 mr-1" />
                  Total: {sources.data?.length || 0}
                </div>
                <div className="h-8 text-xs px-2 rounded-md border border-slate-700 bg-slate-800/70 text-white inline-flex items-center justify-center">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active: {sources.data?.filter(s => s.isActive).length || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Source List */}
      <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md p-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium text-white">Source List</h2>
            <div className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/20 text-primary">
              {filteredSources.length}{filteredSources.length !== sources.data?.length && ` of ${sources.data?.length || 0}`}
            </div>
          </div>
          <Button
            onClick={() => {
              setFormData({ name: "", url: "", category: "" });
              setAddDialogOpen(true);
            }}
            className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white"
            size="sm"
            data-testid="button-add-source"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Source
          </Button>
        </div>

        {sources.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-slate-800/70 flex items-center justify-center mb-4">
              <HelpCircle className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">No sources found</h3>
            <p className="text-slate-400 max-w-md mb-6">
              {searchTerm || statusFilter !== 'all' ? 'No sources match your filters.' : 'Get started by adding your first source.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredSources.map((source) => (
              <Card
                key={source.id}
                className="bg-slate-800/50 border-slate-700/50 hover:border-[#BF00FF]/30 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-white truncate">{source.name}</h3>
                        {source.isDefault && (
                          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                            Default
                          </Badge>
                        )}
                        {source.category && (
                          <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
                            {source.category}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 truncate">{source.url}</p>
                      {source.lastScraped && (
                        <p className="text-xs text-slate-500 mt-1">
                          Last scraped: {new Date(source.lastScraped).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">
                          {source.isActive ? 'Enabled' : 'Disabled'}
                        </span>
                        <Switch
                          checked={source.isActive}
                          onCheckedChange={(checked) => {
                            toggleSource.mutate({ sourceId: source.id, isActive: checked });
                          }}
                          disabled={toggleSource.isPending}
                          data-testid={`switch-source-${source.id}`}
                        />
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(source)}
                        disabled={source.isDefault}
                        className="border-slate-700 hover:bg-slate-700/50"
                        data-testid={`button-edit-${source.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteDialog(source)}
                        disabled={source.isDefault}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        data-testid={`button-delete-${source.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Source Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Add New Source</DialogTitle>
            <DialogDescription className="text-slate-400">
              Add a new global source that will be available across all applications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">Source Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Tech News Daily"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-slate-800/70 border-slate-700/50 text-white"
                data-testid="input-add-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url" className="text-white">Source URL *</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/feed"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="bg-slate-800/70 border-slate-700/50 text-white"
                data-testid="input-add-url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category" className="text-white">Category (Optional)</Label>
              <Input
                id="category"
                placeholder="e.g., tech, news, security"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="bg-slate-800/70 border-slate-700/50 text-white"
                data-testid="input-add-category"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              className="border-slate-700 hover:bg-slate-700/50 text-white"
              data-testid="button-cancel-add"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddSource}
              disabled={addSource.isPending}
              className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white"
              data-testid="button-confirm-add"
            >
              {addSource.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Source Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Source</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update the source information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-white">Source Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-slate-800/70 border-slate-700/50 text-white"
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-url" className="text-white">Source URL</Label>
              <Input
                id="edit-url"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="bg-slate-800/70 border-slate-700/50 text-white"
                data-testid="input-edit-url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category" className="text-white">Category</Label>
              <Input
                id="edit-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="bg-slate-800/70 border-slate-700/50 text-white"
                data-testid="input-edit-category"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="border-slate-700 hover:bg-slate-700/50 text-white"
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSource}
              disabled={updateSource.isPending}
              className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white"
              data-testid="button-confirm-edit"
            >
              {updateSource.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Source</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete this source? This action cannot be undone.
              {selectedSource && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-md">
                  <p className="text-white font-medium">{selectedSource.name}</p>
                  <p className="text-sm text-slate-400">{selectedSource.url}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-slate-700 hover:bg-slate-700/50 text-white"
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteSource}
              disabled={deleteSource.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete"
            >
              {deleteSource.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
