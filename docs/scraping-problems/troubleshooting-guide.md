# Scraping Problems Troubleshooting Guide

**Version**: 1.0
**Last Updated**: 2025-09-13
**Scope**: Replit vs Azure scraping discrepancies

## Quick Reference

### Common Issues & Solutions
| Issue | Symptoms | Quick Fix | Full Solution |
|-------|----------|-----------|---------------|
| CycleTLS Silent Failures | Null responses, immediate Puppeteer fallback | Check architecture compatibility | [CycleTLS Binary Fixes](#cycletls-binary-issues) |
| IP-Based Blocking | 403 Forbidden from protected sites | Use different Azure region | [Azure Networking Solutions](#azure-ip-blocking) |
| darkreading.com Failures | Complete scraping failure | Enable enhanced anti-detection | [darkreading.com Specific Fixes](#darkreading-specific-issues) |
| Container Detection | High bot detection rates | Apply environment masking | [Anti-Detection Setup](#container-fingerprinting) |

### Emergency Procedures
```bash
# 1. Quick health check
npm run test:scraping-health

# 2. CycleTLS validation
npm run test:cycletls-compatibility

# 3. darkreading.com specific test
npm run test:darkreading-scraping

# 4. Full system diagnostics
npm run diagnose:scraping-issues
```

## Diagnostic Procedures

### Phase 1: Environment Validation
```bash
# Check current environment
echo "Platform: $(uname -m)"
echo "Node Arch: $(node -p 'process.arch')"
echo "IS_AZURE: $IS_AZURE"
echo "NODE_ENV: $NODE_ENV"

# Validate CycleTLS binaries
ls -la backend/node_modules/cycletls/dist/

# Check expected binary
EXPECTED_BINARY="cycletls-$(node -p 'process.platform')-$(node -p 'process.arch')"
echo "Expected binary: $EXPECTED_BINARY"
ls -la "backend/node_modules/cycletls/dist/$EXPECTED_BINARY" || echo "Binary not found!"
```

### Phase 2: Network Connectivity Testing
```bash
# Test basic connectivity to darkreading.com
curl -I https://www.darkreading.com

# Test with user agent (should get 403 in Azure)
curl -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -I https://www.darkreading.com

# Check current IP reputation
curl -s https://ipinfo.io/$(curl -s https://httpbin.org/ip | jq -r '.origin')
```

### Phase 3: Application-Level Diagnostics
```javascript
// Test CycleTLS manager directly
const { cycleTLSManager } = require('./backend/dist/index.js');

// Check compatibility
cycleTLSManager.isCompatible().then(compatible => {
  console.log('CycleTLS Compatible:', compatible);

  if (compatible) {
    // Test darkreading.com specifically
    cycleTLSManager.testDarkReadingCompatibility().then(result => {
      console.log('DarkReading Test:', result);
    });
  }

  // Get full stats
  console.log('Manager Stats:', cycleTLSManager.getStats());
});
```

## Issue Categories & Solutions

### CycleTLS Binary Issues

#### Symptoms
- CycleTLS `client.get()` returns `null` or empty responses
- No error messages, silent failures
- Immediate fallback to Puppeteer in Azure
- Works perfectly in Replit

#### Root Causes
1. **Architecture Mismatch**: Binary compiled for x64 but container running ARM64
2. **Binary Permissions**: Executable permissions not set correctly
3. **Path Resolution**: Binary not found in expected location
4. **Network Execution**: Binary loads but network requests fail

#### Diagnostic Commands
```bash
# Check binary architecture compatibility
file backend/node_modules/cycletls/dist/cycletls-linux-x64
# Should show: ELF 64-bit LSB executable, x86-64

# Verify binary permissions
ls -la backend/node_modules/cycletls/dist/cycletls-linux-x64
# Should show: -rwxr-xr-x (executable)

# Test binary execution
timeout 5 backend/node_modules/cycletls/dist/cycletls-linux-x64 --help
# Should not hang or crash
```

#### Solutions

**Immediate Fix (Dockerfile)**:
```dockerfile
# Add explicit architecture validation
RUN echo "=== ARCHITECTURE VALIDATION ===" && \
    echo "System: $(uname -m)" && \
    echo "Node arch: $(node -p 'process.arch')" && \
    if [ "$(node -p 'process.arch')" != "x64" ]; then \
        echo "ERROR: Expected x64 architecture, got $(node -p 'process.arch')" && exit 1; \
    fi

# Enhanced CycleTLS binary validation
RUN cd backend && \
    CYCLETLS_BINARY="node_modules/cycletls/dist/cycletls-linux-x64" && \
    if [ -f "$CYCLETLS_BINARY" ]; then \
        chmod +x "$CYCLETLS_BINARY" && \
        file "$CYCLETLS_BINARY" && \
        echo "✓ CycleTLS binary validated"; \
    else \
        echo "❌ CycleTLS binary not found" && exit 1; \
    fi
```

**Application Fix**: Use enhanced `CycleTLSManager` with comprehensive validation

**Monitoring**: Check `cycleTLSManager.getStats()` for compatibility status

### Azure IP Blocking

#### Symptoms
- 403 Forbidden responses from protected sites
- Cloudflare Ray IDs in response headers
- Works fine from other networks/environments
- Specific to Azure Container Apps IP `4.157.217.180`

#### Root Causes
1. **Datacenter IP**: Azure static IP flagged as Microsoft Corporation
2. **IP Reputation**: ASN AS8075 known as cloud provider
3. **Geographic Blocking**: Virginia datacenter location flagged
4. **ISP-Based Filtering**: Microsoft ISP automatically blocked

#### Diagnostic Commands
```bash
# Check current outbound IP
curl -s https://httpbin.org/ip

# Get IP reputation information
whois $(curl -s https://httpbin.org/ip | jq -r '.origin')

# Test IP from different perspective
curl -s "https://ipinfo.io/$(curl -s https://httpbin.org/ip | jq -r '.origin')"

# Test specific site blocking
curl -I -H "User-Agent: Mozilla/5.0" https://www.darkreading.com
```

#### Solutions

**Short-term: Multi-Region Deployment**
```bash
# Deploy to additional regions
az containerapp create --name scraping-westeurope \
  --resource-group rg-scraping \
  --location westeurope \
  --image your-image:tag

# Implement region-aware routing in code
```

**Medium-term: NAT Gateway with Static IP**
```bash
# Create custom VNet with NAT Gateway
az network vnet create --name vnet-scraping --address-prefix 10.0.0.0/16
az network nat gateway create --name nat-gateway-scraping --public-ip-addresses pip-nat
az containerapp env create --infrastructure-subnet-resource-id /subscriptions/.../subnets/...
```

**Long-term: Residential Proxy Integration**
- Integrate services like BrightData, Oxylabs, or SmartProxy
- Route high-risk domains through residential IPs
- Implement intelligent failover between direct and proxy

### darkreading.com Specific Issues

#### Symptoms
- Complete scraping failure despite working elsewhere
- 403 responses even with protection bypass
- Content extraction returns empty results
- High bot detection probability

#### Root Causes
1. **Enhanced Cloudflare Protection**: Advanced bot detection
2. **Site-Specific Fingerprinting**: Container environment detection
3. **Request Pattern Analysis**: Automated request timing detected
4. **IP Reputation**: Combined with other factors for blocking decision

#### Diagnostic Commands
```bash
# Test darkreading.com response with various methods
curl -I https://www.darkreading.com
curl -I -H "User-Agent: Mozilla/5.0..." https://www.darkreading.com
curl -I -X POST https://www.darkreading.com

# Check Cloudflare specifics
curl -s https://www.darkreading.com | grep -i "cloudflare\|ray.*id\|cf-"
```

#### Solutions

**Immediate**: Apply Azure Anti-Detection System
```typescript
import { azureAntiDetectionManager } from './core/azure-anti-detection';

// For Puppeteer
await azureAntiDetectionManager.setupAzureAntiDetection(page, url);

// For CycleTLS
const config = azureAntiDetectionManager.getAzureOptimizedCycleTLSConfig(url);
const client = await cycleTLSManager.getClient(config);
```

**Enhanced**: Site-Specific Handler
```typescript
// Implement darkreading.com custom scraper
class DarkReadingHandler {
  async scrape(url: string): Promise<ScrapingResult> {
    if (process.env.IS_AZURE === 'true') {
      return await this.azureOptimizedScrape(url);
    }
    return await this.standardScrape(url);
  }
}
```

### Container Fingerprinting

#### Symptoms
- High bot detection rates across multiple sites
- Container-specific detection patterns
- Different behavior between Replit and Azure

#### Root Causes
1. **WebDriver Detection**: `navigator.webdriver` property
2. **Hardware Concurrency**: Container-specific CPU reporting
3. **Screen Properties**: Consistent screen resolution
4. **Timing Patterns**: Predictable request timing

#### Solutions

**Apply Environment Masking**:
```typescript
await page.evaluateOnNewDocument(() => {
  // Remove webdriver property
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
    configurable: true
  });

  // Randomize hardware concurrency
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: () => Math.floor(Math.random() * 4) + 4,
    configurable: true
  });

  // Vary screen properties
  Object.defineProperty(screen, 'width', {
    get: () => 1920 + Math.floor(Math.random() * 200),
    configurable: true
  });
});
```

## Monitoring & Alerting

### Key Metrics to Monitor
```yaml
scraping_success_rates:
  overall: ">95%"
  darkreading_com: ">90%"
  cycletls_requests: ">95%"
  azure_vs_replit_parity: ">90%"

performance_metrics:
  average_response_time: "<30s"
  cycletls_compatibility_rate: ">95%"
  anti_detection_effectiveness: ">90%"

error_tracking:
  cycletls_null_responses: "<5%"
  ip_blocking_incidents: "<10 per day"
  container_detection_rate: "<20%"
```

### Automated Health Checks
```bash
#!/bin/bash
# health-check.sh

echo "=== Scraping Health Check ==="

# 1. CycleTLS compatibility
if node -e "require('./backend/dist/index.js').cycleTLSManager.isCompatible().then(c => process.exit(c ? 0 : 1))"; then
  echo "✓ CycleTLS compatible"
else
  echo "❌ CycleTLS incompatible"
  exit 1
fi

# 2. darkreading.com test
if curl -s --max-time 30 https://www.darkreading.com > /dev/null; then
  echo "✓ darkreading.com reachable"
else
  echo "❌ darkreading.com unreachable"
fi

# 3. IP reputation check
IP=$(curl -s https://httpbin.org/ip | jq -r '.origin')
if [[ "$IP" == "4.157.217.180" ]]; then
  echo "⚠️  Using known problematic IP: $IP"
else
  echo "✓ Using IP: $IP"
fi

echo "=== Health Check Complete ==="
```

### Alert Conditions
```typescript
// Integration with monitoring system
const alertConditions = {
  cycleTLSFailureRate: {
    threshold: 0.1, // 10%
    window: '5m',
    action: 'immediate_alert'
  },

  darkReadingFailureRate: {
    threshold: 0.5, // 50%
    window: '15m',
    action: 'escalate_to_team'
  },

  ipBlockingDetected: {
    threshold: 5, // 5 blocks
    window: '1h',
    action: 'trigger_region_failover'
  }
};
```

## Recovery Procedures

### Emergency Rollback
```bash
# If new changes cause issues, rollback immediately
kubectl rollout undo deployment/scraping-service
# OR
az containerapp revision set-active --name scraping-app --revision previous-revision
```

### Gradual Recovery
```bash
# 1. Validate fixes in staging
az containerapp update --name scraping-staging --image new-image:tag

# 2. Test critical functionality
npm run test:darkreading-scraping

# 3. Deploy with traffic splitting
az containerapp traffic set --traffic-weight previous=70,new=30

# 4. Monitor and gradually increase
az containerapp traffic set --traffic-weight previous=0,new=100
```

## Testing Procedures

### Pre-Deployment Testing
```bash
# 1. Local testing (must not regress)
npm test
npm run test:scraping-local

# 2. Replit compatibility verification
# (Run in Replit environment)
npm run test:scraping-full

# 3. Azure simulation testing
IS_AZURE=true npm run test:azure-simulation

# 4. Specific site testing
npm run test:darkreading-compatibility
npm run test:cycletls-validation
```

### Post-Deployment Validation
```bash
# 1. Health check
curl https://your-azure-app.azurecontainerapps.io/health

# 2. CycleTLS validation
curl -X POST https://your-azure-app.azurecontainerapps.io/test/cycletls

# 3. darkreading.com test
curl -X POST https://your-azure-app.azurecontainerapps.io/test/darkreading

# 4. Monitor logs
az containerapp logs show --name scraping-app --follow
```

## Performance Optimization

### Resource Scaling
```yaml
# Recommended Azure Container Apps configuration
resources:
  cpu: "4" # Up from 2 (for concurrent operations)
  memory: "6Gi" # Up from 4Gi (for CycleTLS + Puppeteer)

scaling:
  minReplicas: 2 # High availability
  maxReplicas: 10 # Scale for load

timeout:
  ingress: 300s # 5 minutes for complex scraping
```

### Performance Tuning
```typescript
// Optimize CycleTLS client pooling
const cycleTLSConfig = {
  maxClientReuse: 15, // Up from 10
  clientTimeout: 45000, // 45s for protected sites
  poolSize: 5 // Concurrent client pool
};

// Optimize Puppeteer resource usage
const puppeteerConfig = {
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage', // Important for Azure
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  ]
};
```

---

## Support & Escalation

### Internal Team Escalation
1. **Level 1**: Check this guide, run diagnostics
2. **Level 2**: Review Azure logs, test in staging
3. **Level 3**: Architecture review, consider infrastructure changes

### External Resources
- **Azure Support**: For Container Apps networking issues
- **CycleTLS Community**: For binary compatibility issues
- **Cloudflare Documentation**: For protection bypass techniques

### Documentation Updates
When resolving new issues:
1. Update this troubleshooting guide
2. Add test cases to prevent regression
3. Update monitoring dashboards
4. Share learnings with team

---

**Last Updated**: 2025-09-13
**Next Review**: After any major infrastructure changes
**Owner**: Development Team