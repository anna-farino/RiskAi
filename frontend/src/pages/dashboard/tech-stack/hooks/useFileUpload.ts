import { RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useFetch } from "@/hooks/use-fetch";
import { useUploadProgress } from "@/hooks/useUploadProgress";
import { useTechStackStore } from "../stores/useTechStackStore";
import { techStackService } from "../services/techStackService";

interface UseFileUploadParams {
  fileInputRef: RefObject<HTMLInputElement>;
}

export function useFileUpload({ fileInputRef }: UseFileUploadParams) {
  const fetchWithAuth = useFetch();
  const queryClient = useQueryClient();
  const {
    upload,
    setIsDragging,
    setUploadState,
    setShowPreview,
    setExtractedEntities,
    clearUploadState
  } = useTechStackStore();

  // Use the upload progress hook
  const { progress } = useUploadProgress(upload.currentUploadId, {
    onComplete: async (progressData) => {
      // Handle upload completion - get entities from progress data
      setUploadState(false, null);

      // Check if entities were returned in the progress response
      if (progressData.entities && progressData.entities.length > 0) {
        // Set extracted entities and show the preview dialog
        setExtractedEntities(progressData.entities);
        setShowPreview(true);
      }
    },
    onError: (error) => {
      setUploadState(false, null);
      toast({
        title: "Upload failed",
        description: error,
        variant: "destructive"
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  });

  // Drag and drop handlers
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

  // File input handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  // Main file upload handler
  const handleFileUpload = async (file: File) => {
    // Generate uploadId on the frontend BEFORE uploading
    const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setUploadState(true, uploadId); // Start tracking progress immediately!

    // Log file info for debugging
    console.log(`[UPLOAD] File: ${file.name}, Size: ${(file.size / 1024).toFixed(2)}KB`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadId', uploadId); // Send uploadId with the request

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

      const data = await techStackService.uploadFile(fetchWithAuth, formData);

      // We already have the uploadId and are tracking progress
      // The progress hook's onComplete handler will show entities when ready
      // Just verify the upload was accepted
      if (!data.success) {
        throw new Error('Upload was not successful');
      }
    } catch (error) {
      setUploadState(false, null);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process the spreadsheet. Please check the format and try again.",
        variant: "destructive"
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Import selected entities handler
  const handleImportSelected = async () => {
    const entitiesToImport = upload.extractedEntities.filter((_, index) => upload.selectedEntities.has(index));

    if (entitiesToImport.length === 0) {
      return;
    }

    setUploadState(true);

    try {
      await techStackService.importEntities(fetchWithAuth, { entities: entitiesToImport });

      queryClient.invalidateQueries({ queryKey: ['/api/threat-tracker/tech-stack'] });

      setShowPreview(false);
      clearUploadState();
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Failed to import selected items. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploadState(false);
    }
  };

  return {
    progress,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    handleImportSelected
  };
}
