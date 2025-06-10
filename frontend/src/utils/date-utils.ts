import { format } from "date-fns";

/**
 * Parse a date string that should be treated as a date-only value
 * This handles the case where dates are stored as UTC strings but should
 * represent calendar dates rather than specific moments in time
 */
export function parseDateOnly(dateString: string | Date | null | undefined): Date | null {
  if (!dateString) return null;
  
  // If it's already a Date object, return as-is
  if (dateString instanceof Date) {
    return dateString;
  }
  
  // If it's a string that looks like a date-only format (YYYY-MM-DD)
  if (typeof dateString === 'string') {
    // Check if it's an ISO string ending in Z (UTC)
    if (dateString.endsWith('Z') || dateString.includes('T00:00:00')) {
      // Extract just the date part (YYYY-MM-DD)
      const datePart = dateString.split('T')[0];
      // Create a new date at noon UTC to avoid timezone shifting
      return new Date(datePart + 'T12:00:00.000Z');
    }
    
    // For other string formats, try to parse normally
    const parsed = new Date(dateString);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  
  return null;
}

/**
 * Format a date for display, handling date-only semantics
 */
export function formatDateOnly(dateString: string | Date | null | undefined, formatStr: string = "MMM d, yyyy"): string {
  const date = parseDateOnly(dateString);
  if (!date) return "Unknown date";
  
  return format(date, formatStr);
}

/**
 * Check if a date is valid
 */
export function isValidDate(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}