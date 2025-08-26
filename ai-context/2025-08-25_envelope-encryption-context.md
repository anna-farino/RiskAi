# Envelope Encryption Implementation Context

**Date**: 2025-08-25  
**Status**: Production Ready  
**Purpose**: AI Context for envelope encryption system in the application

## System Overview

The application implements envelope encryption using Azure Key Vault for protecting sensitive user data (keywords). Key characteristics:

- **Field-specific encryption**: Each field gets its own DEK and metadata columns
- **Backwards compatible**: Automatically encrypts plaintext data on first access
- **Environment aware**: Plaintext in dev, encryption in staging/prod
- **Azure Key Vault integration**: Master key management and automatic rotation
- **Row Level Security compliant**: All operations use proper user context

## Core Architecture

```
Plaintext → [AES-256-GCM + Random DEK] → Encrypted Data
DEK → [RSA-OAEP + Azure KEK] → Wrapped DEK
Store: Encrypted Data + Wrapped DEK + Key Version ID
```

## Key Functions

### envelopeEncrypt(plain: string): Promise<TidyEnvelope | string>
- Dev: Returns plaintext string
- Prod: Returns TidyEnvelope object with wrapped_dek, key_id, blob
- Generates random 256-bit DEK and 96-bit IV
- Uses AES-256-GCM authenticated encryption
- Wraps DEK with latest Azure Key Vault key version
- Blob format: [IV || Ciphertext || Auth Tag]

### envelopeDecryptAndRotate(table, rowId, fieldName, userId): Promise<string>
- Uses withUserContext() for RLS compliance
- Dev: Returns plaintext from fieldName column
- Prod: Checks for encryption metadata using camelCase naming convention
- Backwards compatibility: Encrypts plaintext data on first access
- Automatic key rotation: Re-wraps DEKs when using old key versions
- Field-specific: Uses `wrappedDek{CapitalizedFieldName}` and `keyId{CapitalizedFieldName}` columns

## Database Schema Pattern

For each encrypted field, add two metadata columns using camelCase naming:
- `{fieldName}` - Contains encrypted data (base64) or plaintext (backwards compatibility)
- `wrappedDek{CapitalizedFieldName}` - Encrypted DEK (base64)
- `keyId{CapitalizedFieldName}` - Azure Key Vault key version ID

Example for `term` field:
```sql
term text,                -- Encrypted data or plaintext
wrapped_dek_term text,    -- DEK encrypted with Azure key
key_id_term text         -- Azure Key Vault key version
```

## Environment Configuration

### Environment Variables
- `AZURE_KEY_VAULT_NAME`: Azure Key Vault name (staging/prod only)
- `AZURE_KEY_NAME`: Encryption key name in vault (staging/prod only)
- `NODE_ENV`: Controls encryption behavior
- `DATABASE_URL`: App database connection (limited permissions)
- `MIGRATION_DATABASE_URL`: Migration connection (elevated permissions)

### Environment Behavior
- **Development**: No encryption, all operations use plaintext
- **Staging/Production**: Full encryption with Azure Key Vault

## Integration Pattern

### Create Operation
```typescript
const envelope = await envelopeEncrypt(data);
const record = {
  field: typeof envelope === 'string' ? envelope : Buffer.from(envelope.blob).toString('base64'),
  wrappedDekField: typeof envelope === 'string' ? null : Buffer.from(envelope.wrapped_dek).toString('base64'),
  keyIdField: typeof envelope === 'string' ? null : envelope.key_id
};
```

### Read Operation
```typescript
const decryptedData = await envelopeDecryptAndRotate(table, id, "field", userId);
```

### Update Operation
Same as create - encrypt new data and store with metadata

## Azure Key Vault Setup

### Key Vault Configuration
- Separate vaults for staging/production
- RBAC authorization enabled
- RSA-2048 keys with wrapKey/unwrapKey operations

### Access Control
- Container App uses Managed Identity
- Requires "Key Vault Crypto Service Encryption User" role
- Role assignment scope: specific Key Vault resource

### Key Rotation
- Staging: 30-day rotation, 60-90 day expiry
- Production: 90-day rotation, 180-270 day expiry
- **Critical**: Expiry > Rotation period to prevent data loss

## Database Access Control

### Two-User System
- **App User**: Limited permissions (SELECT, INSERT, UPDATE, DELETE)
- **Migration User**: Schema modification permissions (CREATE, ALTER, DROP)

### Row Level Security
- All operations must use `withUserContext(userId, callback)`
- RLS policies filter data by user context
- Critical for multi-tenant security

## Backwards Compatibility Logic

1. Check if metadata columns (`wrappedDek*`, `keyId*`) exist and are not null
2. If missing: Data is plaintext
   - Encrypt using `envelopeEncrypt()`
   - Update row with encrypted data and metadata
   - Return original plaintext
3. If present: Data is encrypted
   - Decrypt using stored DEK and key version
   - Check for key rotation and re-wrap if needed
   - Return decrypted plaintext

## Error Handling

### Common Issues
- **403 Forbidden**: Missing Key Vault RBAC permissions
- **Row not found**: RLS issue - missing `withUserContext()`
- **Connection to api.postgres.database.azure.com:443**: Wrong database connection (Neon vs PostgreSQL)
- **Key expiration**: DEK becomes unusable, data permanently lost

### Troubleshooting
- Verify Managed Identity has correct RBAC role
- Ensure all DB operations use `withUserContext()`
- Check NODE_ENV setting for proper connection routing
- Monitor key expiry dates and rotation schedules

## Security Properties

- **Master keys never leave Azure Key Vault**
- **Unique DEK per field per row** (limits blast radius)
- **Authenticated encryption** (AES-GCM prevents tampering)
- **Automatic key rotation** (maintains security over time)
- **Environment isolation** (dev data never encrypted)
- **RLS compliance** (proper access control)

## Performance Considerations

- **Azure Key Vault calls**: Only during encryption/decryption, not for each field access
- **Key rotation**: Happens transparently during normal operations
- **Backwards compatibility**: One-time encryption cost per legacy record
- **Caching**: Key Client uses lazy initialization to avoid unnecessary connections

## Code Locations

- **Encryption functions**: `backend/utils/encryption-new.ts`
- **Query integration**: `backend/apps/news-radar/queries/news-tracker.ts`
- **Database schema**: `shared/db/schema/news-tracker/index.ts`
- **Database connection**: `backend/db/db.ts`
- **User context**: `backend/db/with-user-context.ts`

This implementation provides enterprise-grade encryption with operational simplicity and backwards compatibility.