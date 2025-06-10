import { format } from "date-fns";

/**
 * Parse a date string that should be treated as a date-only value
 * This handles the case where dates are stored as UTC strings but should
 * represent calendar dates rather than specific moments in time
 */
export function parseDateOnly(dateValue: any): Date | null {
  if (!dateValue) return null;
  
  // If it's already a Date object, return as-is
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  // Convert to string and extract date part
  const dateString = String(dateValue);
  const datePart = dateString.split('T')[0];
  
  // Create a new date at noon UTC to avoid timezone shifting
  const date = new Date(datePart + 'T12:00:00.000Z');
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Format a date for display, handling date-only semantics
 */
export function formatDateOnly(dateValue: any, formatStr: string = "MMM d, yyyy"): string {
  const date = parseDateOnly(dateValue);
  if (!date) return "Unknown date";
  
  return format(date, formatStr);
}