/**
 * Response utilities for managing MCP response sizes
 */

export const DEFAULT_NOTES_TRUNCATE_LENGTH = 500;
export const TRUNCATE_INDICATOR = '... [truncated]';

/**
 * Truncate a string to a maximum length, adding an indicator if truncated
 */
export function truncateText(
  text: string | null | undefined,
  maxLength: number = DEFAULT_NOTES_TRUNCATE_LENGTH
): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;

  return text.substring(0, maxLength - TRUNCATE_INDICATOR.length) + TRUNCATE_INDICATOR;
}

/**
 * Pagination metadata for list responses
 */
export interface PaginationMetadata {
  total_count: number;
  returned_count: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

/**
 * Create pagination metadata for a response
 */
export function createPaginationMetadata(
  totalCount: number,
  returnedCount: number,
  limit: number,
  offset: number
): PaginationMetadata {
  return {
    total_count: totalCount,
    returned_count: returnedCount,
    limit,
    offset,
    has_more: offset + returnedCount < totalCount,
  };
}

/**
 * Apply pagination to an array
 */
export function paginateArray<T>(
  items: T[],
  limit: number,
  offset: number
): T[] {
  return items.slice(offset, offset + limit);
}

/**
 * Format response data as JSON string
 * @param data - Data to format
 * @param compact - If true, use compact JSON (no whitespace). Saves ~30-40% tokens.
 */
export function formatResponse(data: unknown, compact = false): string {
  return compact ? JSON.stringify(data) : JSON.stringify(data, null, 2);
}

/**
 * Create pagination metadata only if there are more results
 * Returns undefined if no more results (to omit from response)
 */
export function createConditionalPaginationMetadata(
  totalCount: number,
  returnedCount: number,
  limit: number,
  offset: number
): PaginationMetadata | undefined {
  const hasMore = offset + returnedCount < totalCount;
  if (!hasMore) {
    return undefined;
  }
  return {
    total_count: totalCount,
    returned_count: returnedCount,
    limit,
    offset,
    has_more: true,
  };
}
