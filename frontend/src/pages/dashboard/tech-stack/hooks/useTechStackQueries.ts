import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetch } from "@/hooks/use-fetch";
import { toast } from "@/hooks/use-toast";
import { techStackService } from "../services/techStackService";
import { useTechStackStore } from "../stores/useTechStackStore";
import type { TechStackItem, TechStackResponse } from "../tech-stack";

function maxNumOfKeywords(tierLevel: number): number {
  switch (tierLevel) {
    case 0: // free plan
      return 10;
    case 1: // pro plan
      return 50;
    case 9: // pro plan
      return 1000;
    default: // other plans will be added - it now defaults to 10 (free)
      return 10;
  }
}

interface UseTechStackQueriesParams {
  userData: any;
  onItemAdded?: (itemId: string) => void;
  onVendorSkipped?: (itemName: string, vendorName: string) => void;
}

export function useTechStackQueries({ userData, onItemAdded, onVendorSkipped }: UseTechStackQueriesParams) {
  const fetchWithAuth = useFetch();
  const queryClient = useQueryClient();
  const { clearOptimisticItem } = useTechStackStore();

  // Fetch tech stack data
  const { data: techStack, isLoading, refetch: techStackRefetch } = useQuery<TechStackResponse>({
    queryKey: ['/api/threat-tracker/tech-stack'],
    queryFn: async () => {
      const data = await techStackService.getTechStack(fetchWithAuth);
      clearOptimisticItem();
      return data;
    },
  });

  const numOfCurrentKeywords = techStack
    ? Object.values(techStack).reduce((sum, arr) => sum + arr.length, 0)
    : 0;
  const limitReached = numOfCurrentKeywords >= maxNumOfKeywords(userData?.tierLevel ?? 0);

  function checkKeywordsLimit() {
    let numOfCurrentKeywords = 0;

    if (techStack) {
      numOfCurrentKeywords = Object
        .values(techStack)
        .reduce((sum, arr) => sum + arr.length, 0);
    }
    if (numOfCurrentKeywords >= maxNumOfKeywords(userData?.tierLevel ?? 0)) {
      const errMessage = "Update your plan to add more TechStack keywords!";
      const cause = { maxNumKeywords: true };
      throw new Error(errMessage, { cause });
    }
  }

  // Add item mutation
  const addItem = useMutation({
    mutationFn: async ({ type, name, version, priority }: {
      type: 'software' | 'hardware' | 'vendor' | 'client';
      name: string;
      version?: string;
      priority?: number;
    }) => {
      checkKeywordsLimit();
      return await techStackService.addItem(fetchWithAuth, { type, name, version, priority });
    },
    onError: (err) => {
      // Rollback to previous state on error
      if ((err.cause as any)?.maxNumKeywords) {
        toast({
          title: "Failed to add item",
          description: "Update your plan to add more TechStack keywords!",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Failed to add item",
          description: err.message || "There was an error adding the item to your tech stack",
          variant: "destructive"
        });
      }
    },
    onSuccess: (data) => {
      // Check if vendor was skipped due to keyword limit
      if (data?.vendorSkipped && data.vendorSkippedName && onVendorSkipped) {
        onVendorSkipped(data.processedName, data.vendorSkippedName);
      }

      // Track the newly added item
      if (data?.id && onItemAdded) {
        onItemAdded(data.id);
      }
      techStackRefetch();

      // Don't invalidate queries to preserve optimistic update
      // Toast removed - item added
    }
  });

  // Remove item mutation (hard delete - permanently removes the relation)
  const removeItem = useMutation({
    mutationFn: async ({ itemId, type }: { itemId: string; type: string }) => {
      return await techStackService.removeItem(fetchWithAuth, { itemId, type });
    },
    onMutate: async ({ itemId, type }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/threat-tracker/tech-stack'] });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TechStackResponse>(['/api/threat-tracker/tech-stack']);

      // Optimistically remove the item from cache
      queryClient.setQueryData<TechStackResponse>(['/api/threat-tracker/tech-stack'], (old) => {
        if (!old) return old;

        // Map singular type to plural key name
        const categoryKey = (type === 'vendor' ? 'vendors' : type === 'client' ? 'clients' : type) as keyof TechStackResponse;

        return {
          ...old,
          [categoryKey]: old[categoryKey]?.filter((item: TechStackItem) => item.id !== itemId) || []
        };
      });

      // Return context with snapshot
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback to previous state on error
      if (context?.previousData) {
        queryClient.setQueryData(['/api/threat-tracker/tech-stack'], context.previousData);
      }
      toast({
        title: "Failed to remove item",
        description: "There was an error removing the item from your tech stack",
        variant: "destructive"
      });
    },
    onSuccess: () => {
      // Don't invalidate queries to preserve optimistic update
      // Toast removed - item removed
    }
  });

  // Toggle item mutation (soft delete - enables/disables the item)
  const toggleItem = useMutation({
    mutationFn: async ({ itemId, type, isActive }: { itemId: string; type: string; isActive: boolean }) => {
      return await techStackService.toggleItem(fetchWithAuth, { itemId, type, isActive });
    },
    onMutate: async ({ itemId, type, isActive }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/threat-tracker/tech-stack'] });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TechStackResponse>(['/api/threat-tracker/tech-stack']);

      // Optimistically update the item's isActive state
      queryClient.setQueryData<TechStackResponse>(['/api/threat-tracker/tech-stack'], (old) => {
        if (!old) return old;

        // Properly map type to category key
        let categoryKey: keyof TechStackResponse;
        if (type === 'vendor') {
          categoryKey = 'vendors';
        } else if (type === 'client') {
          categoryKey = 'clients';
        } else if (type === 'software') {
          categoryKey = 'software';
        } else if (type === 'hardware') {
          categoryKey = 'hardware';
        } else {
          return old;
        }

        const newData = {
          ...old,
          [categoryKey]: old[categoryKey]?.map((item: TechStackItem) => {
            if (item.id === itemId) {
              // Create a new object with updated isActive
              return { ...item, isActive };
            }
            return item;
          }) || []
        };

        return newData;
      });

      // Return context with snapshot
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback to previous state on error
      if (context?.previousData) {
        queryClient.setQueryData(['/api/threat-tracker/tech-stack'], context.previousData);
      }
      toast({
        title: "Failed to toggle item",
        description: "There was an error updating the item status",
        variant: "destructive"
      });
    },
    onSuccess: (data) => {
      // Don't invalidate queries to preserve optimistic update
      // The optimistic update already has the correct state
      // Toast removed - item toggled
    }
  });

  // Bulk toggle mutation - enable/disable multiple items at once
  const bulkToggle = useMutation({
    mutationFn: async ({ type, isActive }: { type?: string; isActive: boolean }) => {
      return await techStackService.bulkToggle(fetchWithAuth, { type, isActive });
    },
    onMutate: async ({ type, isActive }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/threat-tracker/tech-stack'] });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TechStackResponse>(['/api/threat-tracker/tech-stack']);

      // Optimistically update all items or specific category
      queryClient.setQueryData<TechStackResponse>(['/api/threat-tracker/tech-stack'], (old) => {
        if (!old) return old;

        if (!type || type === 'all') {
          // Update all categories
          return {
            software: old.software?.map(item => ({ ...item, isActive })) || [],
            hardware: old.hardware?.map(item => ({ ...item, isActive })) || [],
            vendors: old.vendors?.map(item => ({ ...item, isActive })) || [],
            clients: old.clients?.map(item => ({ ...item, isActive })) || []
          };
        } else {
          // Update specific category - handle proper type mapping
          let categoryKey: keyof TechStackResponse;
          if (type === 'vendor') {
            categoryKey = 'vendors';
          } else if (type === 'client') {
            categoryKey = 'clients';
          } else if (type === 'software') {
            categoryKey = 'software';
          } else if (type === 'hardware') {
            categoryKey = 'hardware';
          } else {
            return old;
          }

          return {
            ...old,
            [categoryKey]: old[categoryKey]?.map((item: TechStackItem) => ({ ...item, isActive })) || []
          };
        }
      });

      // Return context with snapshot
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback to previous state on error
      if (context?.previousData) {
        queryClient.setQueryData(['/api/threat-tracker/tech-stack'], context.previousData);
      }
      // Toast removed - failed to bulk toggle
    },
    onSuccess: (data, variables) => {
      // Don't invalidate queries to preserve optimistic update
      // The optimistic update already has the correct state
      const typeLabel = variables.type || 'all';
      // Toast removed - bulk toggle success
    }
  });

  // Bulk delete mutation - delete multiple items at once
  const bulkDelete = useMutation({
    mutationFn: async ({ type }: { type?: string }) => {
      return await techStackService.bulkDelete(fetchWithAuth, { type });
    },
    onMutate: async ({ type }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/threat-tracker/tech-stack'] });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TechStackResponse>(['/api/threat-tracker/tech-stack']);

      // Optimistically remove all items or specific category
      queryClient.setQueryData<TechStackResponse>(['/api/threat-tracker/tech-stack'], (old) => {
        if (!old) return old;

        if (!type || type === 'all') {
          // Clear all categories
          return {
            software: [],
            hardware: [],
            vendors: [],
            clients: []
          };
        } else {
          // Clear specific category
          // Map singular type to plural key name
          const categoryKey = (type === 'vendor' ? 'vendors' : type === 'client' ? 'clients' : type) as keyof TechStackResponse;
          return {
            ...old,
            [categoryKey]: []
          };
        }
      });

      // Return context with snapshot
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback to previous state on error
      if (context?.previousData) {
        queryClient.setQueryData(['/api/threat-tracker/tech-stack'], context.previousData);
      }
      toast({
        title: "Failed to delete items",
        description: "There was an error deleting the items",
        variant: "destructive"
      });
    },
    onSuccess: (data, variables) => {
      // Don't invalidate queries to preserve optimistic update
      const typeLabel = variables.type || 'all';
      // Toast removed - items deleted
    }
  });

  return {
    // Data
    techStack,
    isLoading,
    techStackRefetch,
    numOfCurrentKeywords,
    limitReached,

    // Mutations
    addItem,
    removeItem,
    toggleItem,
    bulkToggle,
    bulkDelete,
  };
}
