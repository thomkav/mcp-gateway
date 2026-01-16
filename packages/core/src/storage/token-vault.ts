import keytar from 'keytar';

export interface TokenVaultConfig {
  serviceName?: string;
  fallbackToMemory?: boolean;
}

/**
 * TokenVault provides secure token storage using OS keyring
 */
export class TokenVault {
  private serviceName: string;
  private fallbackToMemory: boolean;
  private memoryStore: Map<string, string> = new Map();
  private useKeyring: boolean = true;

  constructor(config: TokenVaultConfig = {}) {
    this.serviceName = config.serviceName ?? 'workspace-hub-mcp';
    this.fallbackToMemory = config.fallbackToMemory ?? true;
  }

  /**
   * Store a token securely
   */
  async store(key: string, token: string): Promise<boolean> {
    try {
      if (this.useKeyring) {
        await keytar.setPassword(this.serviceName, key, token);
        return true;
      }
    } catch (error) {
      console.error('Failed to store token in keyring:', error);
      if (!this.fallbackToMemory) {
        throw error;
      }
      this.useKeyring = false;
    }

    // Fallback to memory
    if (this.fallbackToMemory) {
      this.memoryStore.set(key, token);
      return true;
    }

    return false;
  }

  /**
   * Retrieve a token
   */
  async retrieve(key: string): Promise<string | null> {
    try {
      if (this.useKeyring) {
        const token = await keytar.getPassword(this.serviceName, key);
        return token;
      }
    } catch (error) {
      console.error('Failed to retrieve token from keyring:', error);
      if (!this.fallbackToMemory) {
        throw error;
      }
      this.useKeyring = false;
    }

    // Fallback to memory
    if (this.fallbackToMemory) {
      return this.memoryStore.get(key) ?? null;
    }

    return null;
  }

  /**
   * Delete a token
   */
  async delete(key: string): Promise<boolean> {
    try {
      if (this.useKeyring) {
        const result = await keytar.deletePassword(this.serviceName, key);
        return result;
      }
    } catch (error) {
      console.error('Failed to delete token from keyring:', error);
      if (!this.fallbackToMemory) {
        throw error;
      }
      this.useKeyring = false;
    }

    // Fallback to memory
    if (this.fallbackToMemory) {
      return this.memoryStore.delete(key);
    }

    return false;
  }

  /**
   * Check if a token exists
   */
  async exists(key: string): Promise<boolean> {
    const token = await this.retrieve(key);
    return token !== null;
  }

  /**
   * List all stored token keys (memory only)
   */
  listKeys(): string[] {
    if (this.useKeyring) {
      console.warn('Cannot list keys from keyring, returning memory store keys');
    }
    return Array.from(this.memoryStore.keys());
  }

  /**
   * Clear all tokens (memory only, keyring requires manual deletion)
   */
  clearMemory(): void {
    this.memoryStore.clear();
  }

  /**
   * Get the number of tokens in memory store
   */
  getMemoryStoreSize(): number {
    return this.memoryStore.size;
  }

  /**
   * Check if using keyring or memory fallback
   */
  isUsingKeyring(): boolean {
    return this.useKeyring;
  }
}
