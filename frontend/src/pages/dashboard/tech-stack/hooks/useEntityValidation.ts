import { useRef } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { techStackService } from "../services/techStackService";

interface ValidationResult {
  suggestedType: "software" | "hardware" | "vendor" | "client" | null 
  shouldSuggestCorrection: boolean;
  message?: string;
}

interface CachedValidation {
  suggestedType: "software" | "hardware" | "vendor" | "client" | null 
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useEntityValidation() {
  const fetchWithAuth = useFetch();
  const validationCache = useRef<Map<string, CachedValidation>>(new Map());

  const validateEntityType = async (
    name: string,
    currentType: string
  ): Promise<ValidationResult | null> => {
    // Check cache first
    const cacheKey = `${name}-${currentType}`;
    const cached = validationCache.current.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return {
        suggestedType: cached.suggestedType,
        shouldSuggestCorrection: cached.suggestedType !== currentType
      };
    }

    try {
      const result = await techStackService.validateEntity(fetchWithAuth, { name, currentType });

      if (!result) return null;

      // Cache the result
      if (result.suggestedType) {
        validationCache.current.set(cacheKey, {
          suggestedType: result.suggestedType,
          timestamp: Date.now()
        });
      }

      return result;
    } catch (error) {
      console.error('Error validating entity type:', error);
      return null;
    }
  };

  return {
    validateEntityType
  };
}
