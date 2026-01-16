import { AuthContext } from '../types/index.js';

export interface VerificationRule {
  resource: string;
  requiredScopes: string[];
  customCheck?: (context: AuthContext) => boolean;
}

export interface VerificationResult {
  authorized: boolean;
  reason?: string;
}

/**
 * RequestVerifier handles authorization checks for MCP requests
 */
export class RequestVerifier {
  private rules: Map<string, VerificationRule> = new Map();

  /**
   * Add a verification rule for a resource
   */
  addRule(rule: VerificationRule): void {
    this.rules.set(rule.resource, rule);
  }

  /**
   * Remove a verification rule
   */
  removeRule(resource: string): boolean {
    return this.rules.delete(resource);
  }

  /**
   * Verify if a context is authorized to access a resource
   */
  verify(resource: string, context: AuthContext): VerificationResult {
    const rule = this.rules.get(resource);

    // If no rule exists, default to deny (fail-safe)
    if (!rule) {
      return {
        authorized: false,
        reason: 'No authorization rule defined for resource',
      };
    }

    // Check required scopes
    const hasRequiredScopes = rule.requiredScopes.every((scope) =>
      context.scope.includes(scope)
    );

    if (!hasRequiredScopes) {
      return {
        authorized: false,
        reason: 'Missing required scopes',
      };
    }

    // Run custom check if provided
    if (rule.customCheck && !rule.customCheck(context)) {
      return {
        authorized: false,
        reason: 'Custom authorization check failed',
      };
    }

    return {
      authorized: true,
    };
  }

  /**
   * Check if a context has a specific scope
   */
  hasScope(context: AuthContext, scope: string): boolean {
    return context.scope.includes(scope);
  }

  /**
   * Check if a context has all of the specified scopes
   */
  hasAllScopes(context: AuthContext, scopes: string[]): boolean {
    return scopes.every((scope) => context.scope.includes(scope));
  }

  /**
   * Check if a context has any of the specified scopes
   */
  hasAnyScope(context: AuthContext, scopes: string[]): boolean {
    return scopes.some((scope) => context.scope.includes(scope));
  }

  /**
   * Get all rules
   */
  getRules(): VerificationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Clear all rules
   */
  clearRules(): void {
    this.rules.clear();
  }
}
