/**
 * Tests for response utility functions
 */
import { describe, it, expect } from 'vitest';
import {
  truncateText,
  DEFAULT_NOTES_TRUNCATE_LENGTH,
  TRUNCATE_INDICATOR,
  createPaginationMetadata,
  paginateArray,
  formatResponse,
  createConditionalPaginationMetadata,
} from '../src/response-utils.js';

describe('Response Utils', () => {
  describe('truncateText', () => {
    it('should return empty string for null', () => {
      expect(truncateText(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(truncateText(undefined)).toBe('');
    });

    it('should return original text if shorter than max length', () => {
      const text = 'Short text';
      expect(truncateText(text)).toBe(text);
    });

    it('should truncate text longer than default max length', () => {
      const longText = 'x'.repeat(1000);
      const result = truncateText(longText);

      expect(result.length).toBeLessThan(longText.length);
      expect(result).toContain(TRUNCATE_INDICATOR);
      expect(result.length).toBe(DEFAULT_NOTES_TRUNCATE_LENGTH);
    });

    it('should truncate text with custom max length', () => {
      const longText = 'x'.repeat(1000);
      const maxLength = 100;
      const result = truncateText(longText, maxLength);

      expect(result.length).toBe(maxLength);
      expect(result).toContain(TRUNCATE_INDICATOR);
    });

    it('should handle text exactly at max length', () => {
      const text = 'x'.repeat(DEFAULT_NOTES_TRUNCATE_LENGTH);
      const result = truncateText(text);

      expect(result).toBe(text);
      expect(result).not.toContain(TRUNCATE_INDICATOR);
    });

    it('should preserve content and add indicator', () => {
      const text = 'This is a long text that should be truncated'.repeat(20);
      const maxLength = 100;
      const result = truncateText(text, maxLength);

      expect(result.endsWith(TRUNCATE_INDICATOR)).toBe(true);
      expect(result.substring(0, maxLength - TRUNCATE_INDICATOR.length)).toBe(
        text.substring(0, maxLength - TRUNCATE_INDICATOR.length)
      );
    });
  });

  describe('createPaginationMetadata', () => {
    it('should create pagination metadata', () => {
      const result = createPaginationMetadata(100, 20, 20, 0);

      expect(result).toEqual({
        total_count: 100,
        returned_count: 20,
        limit: 20,
        offset: 0,
        has_more: true,
      });
    });

    it('should set has_more to false when on last page', () => {
      const result = createPaginationMetadata(100, 20, 20, 80);

      expect(result.has_more).toBe(false);
    });

    it('should set has_more to false when all items returned', () => {
      const result = createPaginationMetadata(50, 50, 50, 0);

      expect(result.has_more).toBe(false);
    });

    it('should handle partial last page', () => {
      const result = createPaginationMetadata(95, 15, 20, 80);

      expect(result.has_more).toBe(false);
    });

    it('should handle empty results', () => {
      const result = createPaginationMetadata(0, 0, 20, 0);

      expect(result).toEqual({
        total_count: 0,
        returned_count: 0,
        limit: 20,
        offset: 0,
        has_more: false,
      });
    });
  });

  describe('paginateArray', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    it('should paginate array with first page', () => {
      const result = paginateArray(items, 3, 0);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should paginate array with middle page', () => {
      const result = paginateArray(items, 3, 3);
      expect(result).toEqual([4, 5, 6]);
    });

    it('should paginate array with last page', () => {
      const result = paginateArray(items, 3, 9);
      expect(result).toEqual([10]);
    });

    it('should handle offset beyond array length', () => {
      const result = paginateArray(items, 3, 15);
      expect(result).toEqual([]);
    });

    it('should handle limit larger than remaining items', () => {
      const result = paginateArray(items, 100, 0);
      expect(result).toEqual(items);
    });

    it('should handle empty array', () => {
      const result = paginateArray([], 10, 0);
      expect(result).toEqual([]);
    });

    it('should handle limit of 1', () => {
      const result = paginateArray(items, 1, 5);
      expect(result).toEqual([6]);
    });
  });

  describe('formatResponse', () => {
    const data = {
      id: 1,
      title: 'Test',
      nested: {
        field: 'value',
      },
    };

    it('should format response with pretty print by default', () => {
      const result = formatResponse(data);

      expect(result).toContain('\n');
      expect(result).toContain('  ');
      expect(JSON.parse(result)).toEqual(data);
    });

    it('should format response compactly when requested', () => {
      const result = formatResponse(data, true);

      expect(result).not.toContain('\n');
      expect(JSON.parse(result)).toEqual(data);
    });

    it('should handle arrays', () => {
      const arrayData = [1, 2, 3, 4, 5];
      const result = formatResponse(arrayData);

      expect(JSON.parse(result)).toEqual(arrayData);
    });

    it('should handle null', () => {
      const result = formatResponse(null);
      expect(result).toBe('null');
    });

    it('should handle primitives', () => {
      expect(formatResponse('string')).toBe('"string"');
      expect(formatResponse(123)).toBe('123');
      expect(formatResponse(true)).toBe('true');
    });

    it('should save space with compact format', () => {
      const pretty = formatResponse(data, false);
      const compact = formatResponse(data, true);

      expect(compact.length).toBeLessThan(pretty.length);
    });
  });

  describe('createConditionalPaginationMetadata', () => {
    it('should return pagination metadata when has more results', () => {
      const result = createConditionalPaginationMetadata(100, 20, 20, 0);

      expect(result).toBeTruthy();
      expect(result).toEqual({
        total_count: 100,
        returned_count: 20,
        limit: 20,
        offset: 0,
        has_more: true,
      });
    });

    it('should return undefined when no more results', () => {
      const result = createConditionalPaginationMetadata(100, 20, 20, 80);

      expect(result).toBeUndefined();
    });

    it('should return undefined when all items returned in single page', () => {
      const result = createConditionalPaginationMetadata(50, 50, 50, 0);

      expect(result).toBeUndefined();
    });

    it('should return metadata for middle pages', () => {
      const result = createConditionalPaginationMetadata(100, 20, 20, 40);

      expect(result).toBeTruthy();
      expect(result?.has_more).toBe(true);
    });

    it('should return undefined for last partial page', () => {
      const result = createConditionalPaginationMetadata(95, 15, 20, 80);

      expect(result).toBeUndefined();
    });

    it('should return undefined for empty results', () => {
      const result = createConditionalPaginationMetadata(0, 0, 20, 0);

      expect(result).toBeUndefined();
    });
  });
});
