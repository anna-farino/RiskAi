# File Upload Security and Audit Logging Implementation

## Complete Database Schema for Audit Logs

```typescript
import { pgTable, uuid, text, timestamp, jsonb, integer, index, varchar, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// =====================================================
// GENERIC AUDIT LOGS TABLE
// Single table for all audit events across the application
// =====================================================
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Core audit fields
  userId: uuid('user_id').notNull(), // Who performed the action
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  
  // Event categorization
  eventType: text('event_type').notNull(), // 'file_upload', 'tech_stack_add', 'tech_stack_remove', 'login', etc.
  eventCategory: text('event_category').notNull(), // 'security', 'data_change', 'access', 'configuration'
  action: text('action').notNull(), // 'create', 'update', 'delete', 'upload', 'download', 'login', etc.
  
  // Target of the action
  resourceType: text('resource_type'), // 'software', 'hardware', 'company', 'file', 'user', etc.
  resourceId: text('resource_id'), // ID of the affected resource
  resourceName: text('resource_name'), // Human-readable name for quick reference
  
  // Result tracking
  success: boolean('success').notNull().default(true),
  errorCode: text('error_code'), // Standardized error codes
  errorMessage: text('error_message'),
  
  // Event-specific data (flexible for any event type)
  eventData: jsonb('event_data').$type<{
    // For file uploads
    filename?: string;
    fileHash?: string;
    fileSize?: number;
    fileType?: string;
    entitiesExtracted?: number;
    
    // For tech stack changes
    entityType?: string;
    entityName?: string;
    entityVersion?: string;
    previousValue?: any;
    newValue?: any;
    
    // For security events
    threatLevel?: string;
    securityChecks?: Record<string, any>;
    suspiciousPatterns?: string[];
    
    // Generic fields
    changes?: Record<string, { old: any; new: any }>;
    metadata?: Record<string, any>;
    [key: string]: any;
  }>(),
  
  // Context information
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  sessionId: text('session_id'), // For tracking actions within a session
  requestId: text('request_id'), // For correlating with application logs
  
  // Performance metrics
  processingTimeMs: integer('processing_time_ms'),
  
  // Datadog integration fields
  severity: text('severity').notNull().default('info'), // 'debug', 'info', 'warning', 'error', 'critical'
  service: text('service').notNull().default('risqai'), // Service name for APM
  environment: text('environment'), // 'production', 'staging', 'development'
  tags: jsonb('tags').$type<Record<string, string>>(), // Datadog tags
  
  // Compliance and retention
  retentionDays: integer('retention_days').default(90), // How long to keep this log
  expiresAt: timestamp('expires_at'), // Calculated from timestamp + retentionDays
  complianceFlags: jsonb('compliance_flags').$type<{
    pii?: boolean; // Contains personally identifiable information
    financial?: boolean; // Financial transaction
    healthcare?: boolean; // Healthcare data
    [key: string]: boolean;
  }>(),
  
}, (table) => {
  return {
    // Primary indexes for querying
    userIdIdx: index('audit_user_idx').on(table.userId),
    timestampIdx: index('audit_timestamp_idx').on(table.timestamp),
    eventTypeIdx: index('audit_event_type_idx').on(table.eventType),
    categoryIdx: index('audit_category_idx').on(table.eventCategory),
    resourceIdx: index('audit_resource_idx').on(table.resourceType, table.resourceId),
    severityIdx: index('audit_severity_idx').on(table.severity),
    successIdx: index('audit_success_idx').on(table.success),
    expiresIdx: index('audit_expires_idx').on(table.expiresAt),
    
    // Composite indexes for common queries
    userActivityIdx: index('audit_user_activity_idx').on(
      table.userId, 
      table.eventType, 
      table.timestamp
    ),
    errorAnalysisIdx: index('audit_error_idx').on(
      table.success,
      table.errorCode,
      table.timestamp
    ),
  };
});

// =====================================================
// EVENT TYPE CONSTANTS
// =====================================================
export const AuditEventTypes = {
  // File operations
  FILE_UPLOAD: 'file_upload',
  FILE_DOWNLOAD: 'file_download',
  FILE_DELETE: 'file_delete',
  
  // Tech stack management
  TECH_STACK_ADD: 'tech_stack_add',
  TECH_STACK_REMOVE: 'tech_stack_remove',
  TECH_STACK_UPDATE: 'tech_stack_update',
  TECH_STACK_BULK_IMPORT: 'tech_stack_bulk_import',
  
  // Entity management
  ENTITY_CREATE: 'entity_create',
  ENTITY_UPDATE: 'entity_update',
  ENTITY_DELETE: 'entity_delete',
  ENTITY_MERGE: 'entity_merge',
  
  // Authentication & Access
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_FAILED_LOGIN: 'user_failed_login',
  PERMISSION_DENIED: 'permission_denied',
  
  // Data operations
  EXPORT_DATA: 'export_data',
  IMPORT_DATA: 'import_data',
  BULK_OPERATION: 'bulk_operation',
  
  // Security events
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  INVALID_TOKEN: 'invalid_token',
} as const;

export const AuditEventCategories = {
  SECURITY: 'security',
  DATA_CHANGE: 'data_change',
  ACCESS: 'access',
  CONFIGURATION: 'configuration',
  COMPLIANCE: 'compliance',
} as const;

// =====================================================
// ZOD SCHEMAS
// =====================================================
export const insertAuditLogSchema = createInsertSchema(auditLogs)
  .omit({ 
    id: true,
    timestamp: true,
    expiresAt: true 
  })
  .extend({
    severity: z.enum(['debug', 'info', 'warning', 'error', 'critical']).default('info'),
    eventType: z.string().min(1),
    eventCategory: z.string().min(1),
    action: z.string().min(1),
  });

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type SelectAuditLog = typeof auditLogs.$inferSelect;
export type AuditEventType = typeof AuditEventTypes[keyof typeof AuditEventTypes];
export type AuditEventCategory = typeof AuditEventCategories[keyof typeof AuditEventCategories];
```

## Overview
This document details the comprehensive security implementation for file upload functionality in the Threat Tracker application, including current security measures and planned audit logging infrastructure.

## Current Implementation Status

### File Upload Feature
- **Location**: `backend/apps/threat-tracker/router/tech-stack.ts`
- **Endpoint**: `POST /api/tech-stack/upload`
- **Purpose**: Allows users to upload Excel/CSV files containing their technology stack for bulk import
- **File Types**: .xlsx, .xls, .csv (max 10MB)

### Security Module: UploadSecurity Service
**Location**: `backend/services/upload-security.ts`

#### Security Layers Implemented:

1. **Magic Byte Verification** (`verifyFileType()`)
   - Validates files by checking actual binary signatures, not just extensions
   - Prevents attackers from uploading malicious files disguised as spreadsheets
   - Checks specific byte patterns for XLSX (ZIP-based), XLS (OLE Compound), and validates CSV as UTF-8 text

2. **Formula Injection Protection** (`sanitizeSpreadsheetData()`)
   - Neutralizes dangerous spreadsheet formulas that could execute commands
   - Prefixes cells starting with `=`, `+`, `-`, `@` with a single quote
   - Removes embedded dangerous patterns like `HYPERLINK`, `cmd|`, `powershell`, `file://`

3. **Rate Limiting** (`checkRateLimit()`)
   - Limits users to 5 uploads per minute (configurable)
   - In-memory store tracks upload attempts per user
   - Automatic cleanup of expired rate limit entries every 5 minutes

4. **Content Scanning** (`scanForSuspiciousContent()`)
   - Analyzes spreadsheet for suspicious patterns
   - Detects high ratios of formulas or links
   - Identifies script-like content (JavaScript, PowerShell)
   - Checks for abnormally long cell content (potential buffer overflow)
   - Returns safety assessment with specific warnings

5. **File Hashing** (`generateFileHash()`)
   - Creates SHA-256 hash of uploaded file for forensic tracking
   - Enables detection of duplicate uploads
   - Provides immutable identifier for audit trails

6. **Audit Logging** (`auditLog()`)
   - **CURRENT LIMITATION**: Only logs to console output (not persistent)
   - Logs all upload attempts with success/failure status
   - Includes user ID, filename, file hash, timestamp, and error details

### CSRF Protection Implementation
**Location**: `backend/middleware/csrf.ts`

The CSRF middleware has been enhanced to handle multipart/form-data uploads:
- Checks both headers (`x-csrf-token`) and request body (`_csrf` field) for tokens
- Custom `validateCSRFFirst` middleware ensures CSRF validation happens before file processing
- Prevents large file processing if CSRF token is invalid

### Upload Processing Flow

1. **User uploads file** → Frontend includes CSRF token in FormData
2. **CSRF validation** → Validates token before any file processing
3. **Rate limit check** → Ensures user hasn't exceeded upload limit
4. **File type verification** → Magic byte validation
5. **Content parsing** → XLSX/CSV parsing with error handling
6. **Security scanning** → Checks for suspicious patterns
7. **Formula sanitization** → Neutralizes dangerous formulas
8. **Entity extraction** → AI processes sanitized data
9. **Audit logging** → Records attempt (currently console only)
10. **Response** → Returns extracted entities or error

## Current Problem: Non-Persistent Audit Logs

Audit logs are currently written to console output only:
- Disappear when server restarts
- Cannot query historical upload attempts
- No forensic investigation capability
- Not suitable for compliance requirements

## Planned Solution: Database Audit Logging

### Generic Audit Logs Table Schema

Create new file: `shared/db/schema/audit-logs.ts`

```typescript
import { pgTable, uuid, text, timestamp, jsonb, integer, index, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Core fields
  userId: uuid('user_id').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  
  // Event categorization
  eventType: text('event_type').notNull(), // 'file_upload', 'tech_stack_add', etc.
  eventCategory: text('event_category').notNull(), // 'security', 'data_change', etc.
  action: text('action').notNull(), // 'create', 'update', 'delete', 'upload'
  
  // Target resource
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  resourceName: text('resource_name'),
  
  // Result
  success: boolean('success').notNull().default(true),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  
  // Flexible event data
  eventData: jsonb('event_data').$type<Record<string, any>>(),
  
  // Context
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  sessionId: text('session_id'),
  
  // Datadog-ready fields
  severity: text('severity').notNull().default('info'),
  service: text('service').notNull().default('risqai'),
  tags: jsonb('tags').$type<Record<string, string>>(),
  
  // Retention
  retentionDays: integer('retention_days').default(90),
  expiresAt: timestamp('expires_at'),
}, (table) => {
  return {
    userIdIdx: index('audit_user_idx').on(table.userId),
    timestampIdx: index('audit_timestamp_idx').on(table.timestamp),
    eventTypeIdx: index('audit_event_type_idx').on(table.eventType),
    // ... additional indexes
  };
});
```

### Integration Points to Update

#### 1. Update UploadSecurity.auditLog()
**File**: `backend/services/upload-security.ts`

Replace console logging with database insert:
```typescript
static async auditLog(userId: string, filename: string, fileHash: string, success: boolean, error?: string) {
  await db.insert(auditLogs).values({
    userId,
    eventType: 'file_upload',
    eventCategory: 'security',
    action: 'upload',
    resourceType: 'file',
    resourceName: filename,
    success,
    errorMessage: error,
    eventData: {
      filename,
      fileHash,
      fileSize: /* from upload */,
      threatLevel: /* from scan results */
    },
    severity: success ? 'info' : 'error',
    // ... additional fields
  });
}
```

#### 2. Add Tech Stack Manual Entry Logging
**File**: `backend/apps/threat-tracker/router/tech-stack.ts`

Log when users manually add entities:
```typescript
// In POST /api/tech-stack/add endpoint
await db.insert(auditLogs).values({
  userId,
  eventType: 'tech_stack_add',
  eventCategory: 'data_change',
  action: 'create',
  resourceType: entityType, // 'software', 'hardware', 'company'
  resourceId: entityId,
  resourceName: entityName,
  eventData: {
    entityType,
    entityName,
    entityVersion,
    addedBy: 'manual_input'
  }
});
```

#### 3. Add Audit Query Endpoints
**New file**: `backend/apps/threat-tracker/router/audit.ts`

```typescript
// GET /api/audit/uploads - Get upload history for user
router.get('/uploads', async (req, res) => {
  const userId = req.user?.id;
  const logs = await db.select()
    .from(auditLogs)
    .where(and(
      eq(auditLogs.userId, userId),
      eq(auditLogs.eventType, 'file_upload')
    ))
    .orderBy(desc(auditLogs.timestamp))
    .limit(100);
  res.json(logs);
});

// GET /api/audit/security - Security events for admins
router.get('/security', requireAdmin, async (req, res) => {
  const logs = await db.select()
    .from(auditLogs)
    .where(eq(auditLogs.eventCategory, 'security'))
    .orderBy(desc(auditLogs.timestamp));
  res.json(logs);
});
```

## Future Datadog Integration

### Why Database + Datadog?
- **Database**: Immediate local storage, no external dependencies, fast queries
- **Datadog**: Superior analytics, alerting, dashboards, correlation across services

### Integration Architecture
```
Upload Event → Database (immediate) → Background Job → Datadog API (batched)
                    ↓
              Local Queries
```

### Datadog Integration Options

1. **Log Forwarding Service**
```typescript
// backend/services/datadog-forwarder.ts
async function forwardLogsToDatadog() {
  // Query recent unforwarded logs
  const logs = await db.select()
    .from(auditLogs)
    .where(isNull(auditLogs.forwardedAt))
    .limit(100);
  
  // Send to Datadog Logs API
  await datadogClient.logs.send(logs);
  
  // Mark as forwarded
  await db.update(auditLogs)
    .set({ forwardedAt: new Date() })
    .where(inArray(auditLogs.id, logIds));
}
```

2. **Custom Metrics**
```typescript
// Send aggregated metrics hourly
const uploadMetrics = {
  'risqai.uploads.total': uploadCount,
  'risqai.uploads.failed': failedCount,
  'risqai.uploads.avg_entities': avgEntities
};
await datadogClient.metrics.send(uploadMetrics);
```

3. **Real-time Streaming**
```typescript
// In audit log function
if (process.env.DATADOG_API_KEY) {
  await datadogClient.logs.sendImmediate({
    ...logEntry,
    ddsource: 'risqai',
    service: 'threat-tracker',
    hostname: process.env.HOSTNAME
  });
}
```

### Datadog Configuration Requirements
- API Key stored in environment variables
- Log indexes configured for `service:risqai`
- Custom facets for `eventType`, `resourceType`, `threatLevel`
- Monitors for failed uploads, suspicious activity
- Dashboard for upload analytics

## Implementation Checklist

### Phase 1: Database Setup
- [ ] Create `shared/db/schema/audit-logs.ts`
- [ ] Export from main schema index
- [ ] Run `npm run db:push` to create table
- [ ] Test table creation with sample insert

### Phase 2: Update Upload Security
- [ ] Modify `UploadSecurity.auditLog()` to write to database
- [ ] Add transaction support for consistency
- [ ] Test with successful and failed uploads
- [ ] Verify audit records are created

### Phase 3: Add Manual Entry Logging
- [ ] Update tech stack add/remove endpoints
- [ ] Log entity creation/deletion events
- [ ] Include old/new values for updates
- [ ] Test audit trail completeness

### Phase 4: Query Endpoints
- [ ] Create audit router with query endpoints
- [ ] Add pagination for large result sets
- [ ] Implement filtering by date range, event type
- [ ] Add export capability (CSV/JSON)

### Phase 5: Retention Management
- [ ] Create cleanup job for expired logs
- [ ] Calculate `expiresAt` based on retention policy
- [ ] Schedule daily cleanup task
- [ ] Monitor storage usage

### Phase 6: Datadog Integration (Future)
- [ ] Set up Datadog API client
- [ ] Create log forwarding service
- [ ] Configure custom metrics
- [ ] Set up alerts and dashboards
- [ ] Test end-to-end flow

## Security Considerations

1. **PII Protection**: Audit logs may contain sensitive data
   - Hash or redact sensitive fields
   - Use `complianceFlags` to mark PII-containing logs
   - Implement role-based access to audit queries

2. **Log Tampering**: Audit logs must be immutable
   - No UPDATE allowed on audit_logs table
   - Consider write-only database user for audit service
   - Add cryptographic signing for critical events

3. **Storage Growth**: Audit logs can grow rapidly
   - Monitor table size
   - Implement partitioning for large deployments
   - Archive old logs to cold storage

## Testing Requirements

### Unit Tests
- File type verification with spoofed files
- Formula sanitization edge cases
- Rate limiting boundary conditions
- Audit log data structure validation

### Integration Tests
- Full upload flow with audit logging
- CSRF protection with multipart data
- Database transaction rollback scenarios
- Concurrent upload handling

### Security Tests
- Attempt formula injection attacks
- Upload malicious file types
- Exceed rate limits
- CSRF token manipulation

## Monitoring and Alerts

### Key Metrics to Track
- Upload success/failure rate
- Average processing time
- Entities extracted per upload
- Rate limit violations
- Storage usage growth

### Alert Conditions
- High failure rate (>10% in 5 minutes)
- Suspicious pattern detection
- Rate limit violations from single user
- Audit log write failures
- Storage approaching limits

## Related Files

- `backend/services/upload-security.ts` - Security implementation
- `backend/apps/threat-tracker/router/tech-stack.ts` - Upload endpoint
- `backend/middleware/csrf.ts` - CSRF protection
- `frontend/src/pages/dashboard/threat-tracker/tech-stack.tsx` - Upload UI
- `shared/db/schema/threat-tracker/entities.ts` - Entity schemas

## Notes for Implementation

1. The audit log table is designed to be generic for all event types, not just uploads
2. JSONB fields provide flexibility for different event data structures
3. Indexes are crucial for query performance - add more as needed
4. Consider using database triggers for automatic `expiresAt` calculation
5. Datadog integration should be asynchronous to not impact user experience
6. Rate limiting is currently in-memory - consider Redis for production
7. File hash can be used to detect and prevent duplicate processing

## Current Status
- ✅ File upload security fully implemented
- ✅ CSRF protection enhanced for multipart
- ✅ Rate limiting active (in-memory)
- ✅ Content scanning and sanitization working
- ❌ Audit logging only to console (needs database)
- ❌ No query capabilities for audit trails
- ❌ No Datadog integration yet

This implementation provides defense-in-depth security for file uploads while preparing for enterprise-grade audit logging and monitoring capabilities.