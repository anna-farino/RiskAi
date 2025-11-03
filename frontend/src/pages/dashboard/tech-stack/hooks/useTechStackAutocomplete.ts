import { useFetch } from "@/hooks/use-fetch";
import { techStackService } from "../services/techStackService";

/**
 * Hook for fetching autocomplete options for tech stack items
 * @param type - The type of tech stack item (software, hardware, vendor, client)
 * @returns A function that fetches autocomplete options for the given query
 */
export function useTechStackAutocomplete(
  type: 'software' | 'hardware' | 'vendor' | 'client'
) {
  const fetchWithAuth = useFetch();

  return async (query: string) => {
    return await techStackService.autocomplete(fetchWithAuth, type, query);
  };
}
