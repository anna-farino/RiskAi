/**
 * Utility functions for validating Auth0 tokens and detecting corruption
 */

export interface TokenHealth {
  isValid: boolean;
  isCorrupted: boolean;
  isExpired: boolean;
  error?: string;
}

/**
 * Validate JWT token format and basic structure
 */
export function validateTokenFormat(token: string): TokenHealth {
  if (!token || typeof token !== 'string') {
    return {
      isValid: false,
      isCorrupted: true,
      isExpired: false,
      error: 'Token is missing or not a string'
    };
  }

  // Check basic JWT structure (3 parts separated by dots)
  const parts = token.split('.');
  if (parts.length !== 3) {
    return {
      isValid: false,
      isCorrupted: true,
      isExpired: false,
      error: 'Token does not have 3 parts (header.payload.signature)'
    };
  }

  try {
    // Try to decode the header - add padding if needed
    let header;
    try {
      const headerB64 = parts[0].padEnd(parts[0].length + (4 - parts[0].length % 4) % 4, '=');
      header = JSON.parse(atob(headerB64));
    } catch (headerError) {
      return {
        isValid: false,
        isCorrupted: true,
        isExpired: false,
        error: 'Cannot decode token header: ' + (headerError as Error).message
      };
    }

    if (!header.alg || !header.typ) {
      return {
        isValid: false,
        isCorrupted: true,
        isExpired: false,
        error: 'Token header is missing required fields (alg, typ)'
      };
    }

    // Try to decode the payload - add padding if needed
    let payload;
    try {
      const payloadB64 = parts[1].padEnd(parts[1].length + (4 - parts[1].length % 4) % 4, '=');
      payload = JSON.parse(atob(payloadB64));
    } catch (payloadError) {
      return {
        isValid: false,
        isCorrupted: true,
        isExpired: false,
        error: 'Cannot decode token payload: ' + (payloadError as Error).message
      };
    }

    if (!payload.exp || !payload.iat) {
      return {
        isValid: false,
        isCorrupted: true,
        isExpired: false,
        error: 'Token payload is missing required fields (exp, iat)'
      };
    }

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    const isExpired = payload.exp < now;

    return {
      isValid: !isExpired,
      isCorrupted: false,
      isExpired: isExpired,
      error: isExpired ? 'Token is expired' : undefined
    };

  } catch (error) {
    return {
      isValid: false,
      isCorrupted: true,
      isExpired: false,
      error: 'Failed to decode token: ' + (error as Error).message
    };
  }
}

/**
 * Get Auth0 tokens from localStorage and validate their health
 */
export function checkStoredTokenHealth(): {
  hasTokens: boolean;
  accessTokenHealth?: TokenHealth;
  clientId?: string;
} {
  try {
    const clientId = (import.meta as any).env.VITE_AUTH0_CLIENT_ID;
    if (!clientId) {
      return { hasTokens: false };
    }

    // Check for Auth0 token storage
    const auth0Key = `@@auth0spajs@@::${clientId}`;
    const storedData = localStorage.getItem(auth0Key);

    if (!storedData) {
      return { hasTokens: false, clientId };
    }

    const parsedData = JSON.parse(storedData);
    const accessToken = parsedData?.body?.access_token;

    if (!accessToken) {
      return { hasTokens: false, clientId };
    }

    const tokenHealth = validateTokenFormat(accessToken);

    return {
      hasTokens: true,
      accessTokenHealth: tokenHealth,
      clientId
    };

  } catch (error) {
    console.error('Error checking stored token health:', error);
    return { hasTokens: false };
  }
}

/**
 * Clear corrupted Auth0 tokens from localStorage
 */
export function clearCorruptedTokens(): void {
  try {
    const clientId = (import.meta as any).env.VITE_AUTH0_CLIENT_ID;
    if (clientId) {
      const auth0Key = `@@auth0spajs@@::${clientId}`;
      localStorage.removeItem(auth0Key);
      console.log('Cleared corrupted Auth0 tokens from localStorage');
    }

    // Also clear any other auth-related items
    const authKeys = Object.keys(localStorage).filter(key =>
      key.includes('auth0') || key.includes('auth-')
    );

    authKeys.forEach(key => {
      localStorage.removeItem(key);
    });

  } catch (error) {
    console.error('Error clearing corrupted tokens:', error);
  }
}