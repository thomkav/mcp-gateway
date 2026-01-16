# Vikunja MCP Server - Test Suite Documentation

## Test Coverage Summary

The Vikunja MCP server has achieved **>90% code coverage** across all metrics:

- **Statements**: 99.58%
- **Branches**: 91.42%
- **Functions**: 100%
- **Lines**: 99.58%

## Test Organization

### Test Files

1. **response-utils.test.ts** (31 tests)
   - Tests for text truncation utilities
   - Pagination metadata helpers
   - Response formatting functions

2. **vikunja-client.test.ts** (36 tests)
   - VikunjaClient class tests
   - API request/response handling
   - Error handling and edge cases
   - All HTTP methods (GET, POST, PUT, DELETE)

3. **project-tools.test.ts** (20 tests)
   - vikunja_list_projects
   - vikunja_get_project
   - vikunja_create_project
   - vikunja_update_project
   - vikunja_delete_project

4. **task-tools.test.ts** (26 tests)
   - vikunja_list_tasks (with pagination, filtering, field selection)
   - vikunja_get_task
   - vikunja_create_task
   - vikunja_update_task
   - vikunja_delete_task

5. **task-tools-extended.test.ts** (2 tests)
   - Edge cases for field handling in list_tasks
   - Complete field coverage tests

6. **bucket-tools.test.ts** (20 tests)
   - vikunja_list_buckets
   - vikunja_create_bucket
   - vikunja_update_bucket
   - vikunja_delete_bucket

7. **comment-tools.test.ts** (11 tests)
   - vikunja_list_task_comments
   - vikunja_add_task_comment

8. **workflow-tools.test.ts** (27 tests)
   - vikunja_get_next_task (with all strategies: priority, due_date, fifo)
   - vikunja_claim_task
   - vikunja_complete_task_with_summary
   - vikunja_add_task_checkpoint
   - vikunja_release_task

9. **workflow-tools-extended.test.ts** (9 tests)
   - Edge cases for sorting algorithms
   - Empty array handling
   - Null/undefined field handling

**Total: 180 tests** covering **all 21 tools**

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- tests/project-tools.test.ts
```

## Tool Coverage

All 21 Vikunja tools have comprehensive test coverage:

### Project Tools (5)
- ✅ vikunja_list_projects
- ✅ vikunja_get_project
- ✅ vikunja_create_project
- ✅ vikunja_update_project
- ✅ vikunja_delete_project

### Task Tools (6)
- ✅ vikunja_list_tasks
- ✅ vikunja_get_task
- ✅ vikunja_create_task
- ✅ vikunja_update_task
- ✅ vikunja_delete_task
- ✅ vikunja_list_task_comments

### Bucket Tools (4)
- ✅ vikunja_list_buckets
- ✅ vikunja_create_bucket
- ✅ vikunja_update_bucket
- ✅ vikunja_delete_bucket

### Comment Tools (2)
- ✅ vikunja_list_task_comments
- ✅ vikunja_add_task_comment

### Workflow Tools (4)
- ✅ vikunja_get_next_task
- ✅ vikunja_claim_task
- ✅ vikunja_complete_task_with_summary
- ✅ vikunja_add_task_checkpoint
- ✅ vikunja_release_task

## Test Patterns

### Mocking

All tests use mocked VikunjaClient responses to avoid requiring a live Vikunja instance:

```typescript
mockClientMethods(client, {
  listProjects: () => Promise.resolve(mockProjects),
});
```

### Test Data Generators

Consistent test data generation using `mockData` utilities:

```typescript
const project = mockData.project({ id: 1, title: 'Test Project' });
const task = mockData.task({ id: 1, done: false, priority: 5 });
```

### Security Context Testing

All tools are tested with appropriate security scopes:

```typescript
const context = createMockSecurityContext(['vikunja:read', 'vikunja:write']);
```

## Edge Cases Tested

- ✅ Pagination boundaries (page 1, max per_page, empty results)
- ✅ Field selection and filtering
- ✅ Null/undefined handling
- ✅ Empty arrays and objects
- ✅ Error conditions (API errors, missing data)
- ✅ Scope validation (read, write, delete)
- ✅ Custom auth checks
- ✅ Text truncation (long descriptions)
- ✅ Date filtering and sorting
- ✅ Priority-based sorting
- ✅ Bucket operations in kanban views

## Coverage Thresholds

The project enforces minimum coverage thresholds via vitest.config.ts:

```typescript
coverage: {
  thresholds: {
    lines: 90,
    functions: 90,
    branches: 90,
    statements: 90,
  }
}
```

All thresholds are currently met or exceeded.
