/**
 * Service layer for Tech Stack API calls
 * All API interactions for the tech stack feature
 */

export interface AddItemParams {
  type: 'software' | 'hardware' | 'vendor' | 'client';
  name: string;
  version?: string;
  priority?: number;
}

export interface RemoveItemParams {
  itemId: string;
  type: string;
}

export interface ToggleItemParams {
  itemId: string;
  type: string;
  isActive: boolean;
}

export interface BulkToggleParams {
  type?: string;
  isActive: boolean;
}

export interface BulkDeleteParams {
  type?: string;
}

export interface ValidateEntityParams {
  name: string;
  currentType: string;
}

export interface ImportEntitiesParams {
  entities: any[];
}

export const techStackService = {
  /**
   * Fetch the complete tech stack (software, hardware, vendors, clients)
   */
  getTechStack: async (fetchWithAuth: any) => {
    const response = await fetchWithAuth('/api/threat-tracker/tech-stack');
    if (!response.ok) throw new Error('Failed to fetch tech stack');
    return response.json();
  },

  /**
   * Add a new item to the tech stack
   */
  addItem: async (fetchWithAuth: any, params: AddItemParams) => {
    const response = await fetchWithAuth('/api/threat-tracker/tech-stack/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!response.ok) throw new Error('Failed to add item');
    return response.json();
  },

  /**
   * Remove an item from the tech stack (hard delete)
   */
  removeItem: async (fetchWithAuth: any, params: RemoveItemParams) => {
    const response = await fetchWithAuth(`/api/threat-tracker/tech-stack/${params.itemId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: params.type })
    });
    if (!response.ok) throw new Error('Failed to remove item');
    return response.json();
  },

  /**
   * Toggle an item's active status (soft delete)
   */
  toggleItem: async (fetchWithAuth: any, params: ToggleItemParams) => {
    const response = await fetchWithAuth(`/api/threat-tracker/tech-stack/${params.itemId}/toggle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: params.type, isActive: params.isActive })
    });
    if (!response.ok) throw new Error('Failed to toggle item');
    return response.json();
  },

  /**
   * Bulk toggle multiple items' active status
   */
  bulkToggle: async (fetchWithAuth: any, params: BulkToggleParams) => {
    const response = await fetchWithAuth('/api/threat-tracker/tech-stack/bulk-toggle', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: params.type || 'all', isActive: params.isActive })
    });
    if (!response.ok) throw new Error('Failed to bulk toggle items');
    return response.json();
  },

  /**
   * Bulk delete multiple items
   */
  bulkDelete: async (fetchWithAuth: any, params: BulkDeleteParams) => {
    const response = await fetchWithAuth('/api/threat-tracker/tech-stack/bulk-delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: params.type || 'all' })
    });
    if (!response.ok) throw new Error('Failed to bulk delete items');
    return response.json();
  },

  /**
   * Validate entity type using AI
   */
  validateEntity: async (fetchWithAuth: any, params: ValidateEntityParams) => {
    const response = await fetchWithAuth('/api/threat-tracker/tech-stack/validate-entity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!response.ok) return null;

    return response.json();
  },

  /**
   * Upload a file (spreadsheet) for entity extraction
   */
  uploadFile: async (fetchWithAuth: any, formData: FormData) => {
    const response = await fetchWithAuth('/api/threat-tracker/tech-stack/upload', {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set Content-Type with boundary
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to process file');
    }

    return response.json();
  },

  /**
   * Import selected entities from upload preview
   */
  importEntities: async (fetchWithAuth: any, params: ImportEntitiesParams) => {
    const response = await fetchWithAuth('/api/threat-tracker/tech-stack/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error('Failed to import items');
    }

    return response.json();
  },

  /**
   * Fetch autocomplete options for a specific type
   */
  autocomplete: async (fetchWithAuth: any, type: 'software' | 'hardware' | 'vendor' | 'client', query: string) => {
    const response = await fetchWithAuth(
      `/api/threat-tracker/tech-stack/autocomplete?type=${type}&query=${encodeURIComponent(query)}`
    );
    if (!response.ok) throw new Error(`Failed to fetch ${type} options`);
    const data = await response.json();
    return data.results || [];
  },
};
