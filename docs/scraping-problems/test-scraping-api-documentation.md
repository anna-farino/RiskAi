# Test Scraping API Documentation - September 13, 2025

**Version**: 1.0
**Created**: September 13, 2025
**Status**: Development/Testing Only

## Overview

The Test Scraping API provides a secure, unprotected endpoint for testing scraping functionality without affecting production data. This is particularly useful for debugging Azure vs Replit scraping differences and validating the enhanced scraping system.

## Security Model

- **No Auth0 Protection**: Routes are placed before Auth0 middleware
- **Password Protection**: Requires hardcoded password `TestTST` in request body
- **Production Blocked**: Automatically disabled in production environments (`NODE_ENV=production`)
- **Rate Limited**: Standard rate limiting applied
- **Read-Only**: No database writes, purely for testing

## Endpoints

### POST /api/test-scraping

Main endpoint for testing scraping functionality on any source URL.

#### Request Format

```json
{
  "password": "TestTST",
  "sourceUrl": "https://www.darkreading.com",
  "testMode": false
}
```

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `password` | string | Yes | Must be exactly `"TestTST"` |
| `sourceUrl` | string | Yes | Valid HTTP/HTTPS URL to scrape (max 500 chars) |
| `testMode` | boolean | No | If true, tests up to 3 sample articles instead of 1 |

#### Response Format

```json
{
  "success": boolean,
  "timestamp": "2024-12-XX...",
  "requestId": "uuid",
  "processingTimeMs": 1234,
  "source": {
    "url": "https://www.darkreading.com",
    "name": "Dark Reading",
    "isKnownSource": true,
    "sourceId": "uuid-if-known"
  },
  "scraping": {
    "articlesFound": 15,
    "articlesProcessed": 1,
    "sampleArticles": [
      {
        "url": "https://...",
        "title": "Article Title",
        "contentPreview": "First 200 chars...",
        "author": "Author Name",
        "publishDate": "2024-12-XX",
        "scrapingMethod": "cycletls_enhanced",
        "extractionSuccess": true,
        "errors": []
      }
    ],
    "errors": [],
    "timing": {
      "sourceScrapingMs": 1500,
      "articleScrapingMs": 2300,
      "totalMs": 3800
    }
  },
  "diagnostics": {
    "environment": "azure",
    "isAzure": true,
    "cycleTLSCompatible": true,
    "cycleTLSStats": {
      "architectureCompatible": true,
      "isArchitectureValidated": true,
      "binaryPath": "/app/backend/node_modules/cycletls/dist/cycletls-linux-x64",
      "lastCompatibilityCheck": "2024-12-XX..."
    },
    "ipAddress": "4.157.217.180",
    "userAgent": "TestScraper/1.0 (Node.js)",
    "antiDetectionApplied": true,
    "scrapingMethods": {
      "usedCycleTLS": true,
      "usedPuppeteer": false,
      "usedHttp": false
    }
  },
  "logs": [
    {
      "timestamp": "2024-12-XX...",
      "level": "info",
      "message": "Starting test scraping for: https://www.darkreading.com",
      "context": "test-scraper"
    }
  ],
  "serverInfo": {
    "nodeEnv": "production",
    "isAzure": true,
    "timestamp": "2024-12-XX..."
  }
}
```

#### HTTP Status Codes

| Status | Description |
|--------|-------------|
| 200 | Success - scraping completed successfully |
| 206 | Partial Content - some articles found but scraping had issues |
| 400 | Bad Request - validation failed (wrong password, invalid URL, etc.) |
| 403 | Forbidden - endpoint disabled in production environment |
| 404 | Not Found - no articles found on source page |
| 500 | Internal Server Error - system error |

### GET /api/test-scraping/health

Health check endpoint for the test scraping system.

#### Response Format

```json
{
  "status": "healthy",
  "timestamp": "2024-12-XX...",
  "environment": {
    "nodeEnv": "production",
    "isAzure": true,
    "hasDatabase": true
  },
  "scraping": {
    "unifiedScraperLoaded": true,
    "cycleTLSAvailable": true,
    "puppeteerAvailable": true
  }
}
```

## Usage Examples

### Basic Test - darkreading.com

```bash
curl -X POST http://localhost:5000/api/test-scraping \
  -H "Content-Type: application/json" \
  -d '{
    "password": "TestTST",
    "sourceUrl": "https://www.darkreading.com"
  }'
```

### Enhanced Test Mode - Multiple Articles

```bash
curl -X POST http://localhost:5000/api/test-scraping \
  -H "Content-Type: application/json" \
  -d '{
    "password": "TestTST",
    "sourceUrl": "https://www.darkreading.com",
    "testMode": true
  }'
```

### Test Unknown Source

```bash
curl -X POST http://localhost:5000/api/test-scraping \
  -H "Content-Type: application/json" \
  -d '{
    "password": "TestTST",
    "sourceUrl": "https://techcrunch.com"
  }'
```

### Health Check

```bash
curl http://localhost:5000/api/test-scraping/health
```

### Azure Production Test

```bash
curl -X POST https://your-azure-app.azurecontainerapps.io/api/test-scraping \
  -H "Content-Type: application/json" \
  -d '{
    "password": "TestTST",
    "sourceUrl": "https://www.darkreading.com",
    "testMode": true
  }'
```

## Diagnostic Information

The API provides comprehensive diagnostic information to help debug scraping issues:

### Environment Detection
- **environment**: `"azure"`, `"local"`, or `"unknown"`
- **isAzure**: Boolean flag for Azure Container Apps
- **nodeEnv**: Current NODE_ENV value

### CycleTLS Diagnostics
- **cycleTLSCompatible**: Whether CycleTLS binaries are compatible
- **cycleTLSStats**: Detailed compatibility information
- **Binary path and architecture validation results**

### Network Information
- **ipAddress**: Current outbound IP address (detected via httpbin.org)
- **userAgent**: User agent being used for requests

### Anti-Detection Status
- **antiDetectionApplied**: Whether Azure anti-detection measures were applied
- **High-risk domain detection results**

### Scraping Method Tracking
- **usedCycleTLS**: Whether CycleTLS was successfully used
- **usedPuppeteer**: Whether Puppeteer fallback was used
- **usedHttp**: Whether basic HTTP was used

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Forbidden" | Production environment detected | Only available in development/staging environments |
| "Invalid password" | Wrong password in request | Use `"TestTST"` exactly |
| "sourceUrl must be a valid URL" | Malformed URL | Provide valid HTTP/HTTPS URL |
| "No article links found" | Source page has no extractable links | Check if URL is a news source homepage |
| "CycleTLS module loading failed" | Binary compatibility issues | Check Azure container architecture |

### Error Response Format

```json
{
  "success": false,
  "error": "Detailed error message",
  "requestId": "uuid",
  "timestamp": "2024-12-XX...",
  "processingTimeMs": 123,
  "stack": "Error stack (development only)"
}
```

## Implementation Details

### Core Components

1. **Handler** (`index.ts`): Request validation, security, response formatting
2. **Scraper** (`scraper.ts`): Production scraping logic wrapper with diagnostics
3. **Types** (`types.ts`): TypeScript definitions for requests/responses

### Production Integration

The test API uses the **exact same scraping logic** as production:

- `unifiedScraper.scrapeSourceUrl()` - Extract article links
- `unifiedScraper.scrapeArticleUrl()` - Extract article content
- `GlobalStrategy` context - Same strategy as global scheduler
- `cycleTLSManager` - Same CycleTLS management
- `azureAntiDetectionManager` - Same anti-detection system

### Security Considerations

- **Production Protection**: Automatically disabled when `NODE_ENV=production`
- **Password Protection**: Hardcoded password prevents unauthorized access
- **Rate Limiting**: Standard Express rate limiting applied
- **URL Validation**: Strict URL format and length validation
- **No Database Writes**: Read-only operations only
- **Request Logging**: All requests logged with IDs for monitoring

## Troubleshooting

### Azure vs Replit Testing

Use this API to compare results between environments:

1. **Test in Replit**:
   ```bash
   curl -X POST https://your-replit-app.com/api/test-scraping \
     -d '{"password":"TestTST","sourceUrl":"https://www.darkreading.com","testMode":true}'
   ```

2. **Test in Azure**:
   ```bash
   curl -X POST https://your-azure-app.azurecontainerapps.io/api/test-scraping \
     -d '{"password":"TestTST","sourceUrl":"https://www.darkreading.com","testMode":true}'
   ```

3. **Compare Diagnostic Sections**:
   - IP addresses
   - CycleTLS compatibility
   - Anti-detection application
   - Scraping methods used
   - Success rates

### Common Debugging Steps

1. **Check Health**: Start with `/api/test-scraping/health`
2. **Test Known Source**: Use darkreading.com which is in the database
3. **Enable Test Mode**: Use `"testMode": true` for more detailed output
4. **Check Logs**: Review the `logs` array in response
5. **Monitor Timing**: Look at `timing` object for performance issues

## Future Enhancements

Potential improvements for this testing system:

- **Environment Variable Password**: Move password to env var
- **Multiple Source Testing**: Test multiple sources in one request
- **Performance Benchmarking**: Compare timing across environments
- **Scheduled Testing**: Automated testing with alerting
- **Test Result Storage**: Save test results for trend analysis

## Removal Instructions

When this testing route is no longer needed:

1. Remove routes from `backend/router/index.ts`:
   ```typescript
   // Remove these lines:
   router.post("/test-scraping", limiter, handleTestScraping);
   router.get("/test-scraping/health", handleTestScrapingHealth);
   ```

2. Remove import:
   ```typescript
   // Remove this line:
   import { handleTestScraping, handleTestScrapingHealth } from "backend/test-scraping";
   ```

3. Delete entire `backend/test-scraping/` directory

---

**⚠️ Warning**: This is a development/testing tool only. Do not use in production without proper authentication and authorization mechanisms.