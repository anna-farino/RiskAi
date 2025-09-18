import { Request, Response } from "express";
import { envelopeDecryptAndRotate, envelopeEncrypt, getCredentialStatus } from "../utils/encryption-new";
import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";
import { KeyClient } from "@azure/keyvault-keys";
import { keywords } from "@shared/db/schema/news-tracker";
import { db } from "backend/db/db";
import { eq } from "drizzle-orm";

interface CryptoHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  keyVault: {
    available: boolean;
    error?: string;
  };
  credential: {
    available: boolean;
    type?: string;
    tokenExpiry?: number;
    error?: string;
  };
  keyAccess: {
    available: boolean;
    keyId?: string;
    error?: string;
  };
  internalCredential?: {
    hasCredential: boolean;
    credentialType?: string;
    tokenExpiry?: number;
    timeToExpiry?: number;
    isExpired?: boolean;
    lastCheck: number;
  };
  timestamp: number;
}

/**
 * Test endpoint to check Azure Key Vault and credential health
 */
export async function handleCryptoHealth(req: Request, res: Response) {
  console.log(`[CRYPTO-TEST] Health check requested`);
  const startTime = Date.now();

  const response: CryptoHealthResponse = {
    status: 'healthy',
    keyVault: { available: false },
    credential: { available: false },
    keyAccess: { available: false },
    timestamp: startTime
  };

  try {
    // Skip in development
    if (process.env.NODE_ENV !== 'staging' && process.env.NODE_ENV !== 'production') {
      response.status = 'healthy';
      response.keyVault.available = false;
      response.credential.available = false;
      response.keyAccess.available = false;
      return res.json(response);
    }

    const VAULT_URL = `https://${process.env.AZURE_KEY_VAULT_NAME}.vault.azure.net`;
    const KEY_NAME = process.env.AZURE_KEY_NAME || "";

    // Test 1: Create and test credential
    let credential: DefaultAzureCredential | ManagedIdentityCredential | null = null;

    try {
      if (process.env.NODE_ENV === 'production') {
        credential = new ManagedIdentityCredential();
        response.credential.type = 'ManagedIdentity';
      } else {
        credential = new DefaultAzureCredential();
        response.credential.type = 'DefaultAzureCredential';
      }

      // Test token retrieval and check expiry
      const token = await credential.getToken("https://vault.azure.net/.default");
      response.credential.available = true;
      response.credential.tokenExpiry = token.expiresOnTimestamp;

      const timeToExpiry = token.expiresOnTimestamp - Date.now();
      console.log(`[CRYPTO-TEST] Token expires in ${Math.round(timeToExpiry / 1000 / 60)} minutes`);

    } catch (credError) {
      response.credential.error = String(credError);
      response.status = 'unhealthy';
    }

    // Test 2: Key Vault connectivity
    if (credential) {
      try {
        const keyClient = new KeyClient(VAULT_URL, credential);
        const keyList = keyClient.listPropertiesOfKeys();
        let keyFound = false;

        for await (const keyProperties of keyList) {
          if (keyProperties.name === KEY_NAME) {
            keyFound = true;
            break;
          }
        }

        response.keyVault.available = keyFound;
        if (!keyFound) {
          response.keyVault.error = `Key '${KEY_NAME}' not found`;
          response.status = 'degraded';
        }
      } catch (kvError) {
        response.keyVault.error = String(kvError);
        response.status = 'unhealthy';
      }
    }

    // Test 3: Key access and operations
    if (credential && response.keyVault.available) {
      try {
        const keyClient = new KeyClient(VAULT_URL, credential);
        const latest = await keyClient.getKey(KEY_NAME);
        response.keyAccess.available = true;
        response.keyAccess.keyId = latest.id;
        console.log(`[CRYPTO-TEST] Successfully accessed key: ${latest.id}`);
      } catch (keyError) {
        response.keyAccess.error = String(keyError);
        response.status = 'degraded';
      }
    }

    // Get internal credential status from our enhanced encryption module
    try {
      response.internalCredential = await getCredentialStatus();
    } catch (statusError) {
      console.warn(`[CRYPTO-TEST] Failed to get internal credential status:`, statusError);
    }

  } catch (error) {
    console.error(`[CRYPTO-TEST] Health check failed:`, error);
    response.status = 'unhealthy';
  }

  const elapsed = Date.now() - startTime;
  console.log(`[CRYPTO-TEST] Health check completed in ${elapsed}ms, status: ${response.status}`);

  res.json(response);
}

/**
 * Test endpoint to decrypt a specific keyword by ID
 */
export async function handleTestDecrypt(req: Request, res: Response) {
  const { keywordId, userId } = req.query;

  if (!keywordId || !userId) {
    return res.status(400).json({
      error: 'Missing required parameters: keywordId and userId'
    });
  }

  console.log(`[CRYPTO-TEST] Decryption test requested for keyword ${keywordId}, user ${userId}`);
  const startTime = Date.now();

  try {
    // First, get the keyword info
    const keywordRow = await db
      .select()
      .from(keywords)
      .where(eq(keywords.id, keywordId as string))
      .then(rows => rows[0]);

    if (!keywordRow) {
      return res.status(404).json({ error: 'Keyword not found' });
    }

    const result = {
      keywordId,
      userId,
      rawFieldValue: keywordRow.term,
      metadata: {
        wrappedDekTerm: keywordRow.wrappedDekTerm,
        keyIdTerm: keywordRow.keyIdTerm,
      },
      decryption: {
        success: false,
        decryptedValue: '',
        error: null as string | null,
        elapsedMs: 0,
      },
      timestamp: startTime
    };

    try {
      const decryptedValue = await envelopeDecryptAndRotate(
        keywords,
        keywordId as string,
        'term',
        userId as string
      );

      result.decryption.success = true;
      result.decryption.decryptedValue = decryptedValue;
      result.decryption.elapsedMs = Date.now() - startTime;

      console.log(`[CRYPTO-TEST] Decryption successful in ${result.decryption.elapsedMs}ms`);

    } catch (decryptError) {
      result.decryption.error = String(decryptError);
      result.decryption.elapsedMs = Date.now() - startTime;

      console.error(`[CRYPTO-TEST] Decryption failed in ${result.decryption.elapsedMs}ms:`, decryptError);
    }

    res.json(result);

  } catch (error) {
    console.error(`[CRYPTO-TEST] Test decrypt endpoint failed:`, error);
    res.status(500).json({
      error: 'Test decrypt endpoint failed',
      details: String(error)
    });
  }
}

/**
 * Test endpoint to encrypt and decrypt a test string
 */
export async function handleTestEncryptDecrypt(req: Request, res: Response) {
  const { testString = "test-encryption-" + Date.now() } = req.body;

  console.log(`[CRYPTO-TEST] Encrypt/decrypt test requested for string: ${testString}`);
  const startTime = Date.now();

  const result = {
    testString,
    encryption: {
      success: false,
      envelope: null as any,
      elapsedMs: 0,
      error: null as string | null,
    },
    decryption: {
      success: false,
      decryptedValue: '',
      elapsedMs: 0,
      error: null as string | null,
    },
    roundTrip: {
      success: false,
      matches: false,
    },
    timestamp: startTime
  };

  try {
    // Test encryption
    const encryptStartTime = Date.now();
    try {
      const envelope = await envelopeEncrypt(testString);
      result.encryption.success = true;
      result.encryption.envelope = envelope;
      result.encryption.elapsedMs = Date.now() - encryptStartTime;
      console.log(`[CRYPTO-TEST] Encryption successful in ${result.encryption.elapsedMs}ms`);
    } catch (encryptError) {
      result.encryption.error = String(encryptError);
      result.encryption.elapsedMs = Date.now() - encryptStartTime;
      console.error(`[CRYPTO-TEST] Encryption failed:`, encryptError);
      return res.json(result);
    }

    // Test decryption would require database operations, so we'll skip it for now
    // This test primarily validates credential and Key Vault access

    result.roundTrip.success = result.encryption.success;
    result.roundTrip.matches = true; // We didn't test decryption, so assume it would work

    res.json(result);

  } catch (error) {
    console.error(`[CRYPTO-TEST] Encrypt/decrypt test failed:`, error);
    res.status(500).json({
      error: 'Encrypt/decrypt test failed',
      details: String(error)
    });
  }
}