# IP Switching Implementation Plan - OxyLabs Integration

## Executive Summary

This document outlines the implementation plan for integrating IP switching capabilities into the RisqAi web scraper using OxyLabs as the proxy service provider. The goal is to avoid IP blocks and improve scraping success rates while maintaining the existing architecture.

## Provider Selection: OxyLabs

### Why OxyLabs?
- **Premium reliability**: 99.95% success rate
- **Massive IP pool**: 175M+ IP addresses
- **AI-powered rotation**: Intelligent proxy selection
- **Comprehensive coverage**: 195+ countries
- **Enterprise-grade**: Proven for large-scale operations
- **Protocol support**: HTTP/HTTPS/SOCKS5

### OxyLabs Pricing (2025)
- **Residential Proxies**: $8/GB
- **Mobile Proxies**: $9/GB  
- **Datacenter Proxies**: $0.66/GB
- **ISP Proxies**: Available
- **Free trial**: 7-day trial available

### Service Features
- **Sticky sessions**: 1-30 minutes
- **Geo-targeting**: Country/city level
- **User-agent rotation**: Built-in
- **CAPTCHA solving**: Available
- **24/7 support**: Enterprise support

## Current System Integration Points

### Existing Architecture
- **HTTP Scraper**: `backend/services/scraping/scrapers/http-scraper.ts`
- **Puppeteer Scraper**: `backend/services/scraping/scrapers/puppeteer-scraper/main-scraper.ts`
- **Method Selector**: `backend/services/scraping/core/method-selector.ts`
- **Page Setup**: `backend/services/scraping/core/page-setup.ts`

### Integration Strategy
1. **Modify HTTP scraper** to support proxy rotation
2. **Update Puppeteer configuration** for proxy support
3. **Add proxy management layer** for health monitoring
4. **Implement failover mechanisms** for reliability

## Technical Implementation Plan

### Phase 1: Core Proxy Integration

#### 1.1 OxyLabs Configuration
```javascript
// OxyLabs configuration
const OXYLABS_CONFIG = {
  residential: {
    endpoint: 'pr.oxylabs.io:7777',
    username: process.env.OXYLABS_USERNAME,
    password: process.env.OXYLABS_PASSWORD
  },
  mobile: {
    endpoint: 'mobile.oxylabs.io:8001',
    username: process.env.OXYLABS_USERNAME,
    password: process.env.OXYLABS_PASSWORD
  },
  datacenter: {
    endpoint: 'dc.oxylabs.io:8000',
    username: process.env.OXYLABS_USERNAME,
    password: process.env.OXYLABS_PASSWORD
  }
};
```

#### 1.2 Proxy Manager Service
**New File**: `backend/services/scraping/core/proxy-manager.ts`
```javascript
class OxyLabsProxyManager {
  constructor(config) {
    this.config = config;
    this.failedProxies = new Set();
    this.requestCounts = new Map();
    this.healthCheckUrl = 'https://httpbin.org/ip';
  }

  getProxy(type = 'residential') {
    // Return OxyLabs proxy configuration
    return this.config[type];
  }

  async healthCheck(proxyConfig) {
    // Implement health checking logic
  }

  markProxyFailed(proxyConfig) {
    // Track failed proxies
  }
}
```

#### 1.3 HTTP Scraper Integration
**Modify**: `backend/services/scraping/scrapers/http-scraper.ts`
```javascript
import { OxyLabsProxyManager } from '../core/proxy-manager';

export async function scrapeWithHTTP(url: string, options?: HTTPScrapingOptions) {
  const proxyManager = new OxyLabsProxyManager(OXYLABS_CONFIG);
  const proxy = proxyManager.getProxy('residential');
  
  // Configure fetch with proxy
  const response = await fetch(url, {
    headers: generateHeaders(),
    agent: new HttpsProxyAgent(`http://${proxy.username}:${proxy.password}@${proxy.endpoint}`)
  });
}
```

#### 1.4 Puppeteer Integration
**Modify**: `backend/services/scraping/scrapers/puppeteer-scraper/main-scraper.ts`
```javascript
export async function scrapeWithPuppeteer(url: string, options?: PuppeteerScrapingOptions) {
  const proxyManager = new OxyLabsProxyManager(OXYLABS_CONFIG);
  const proxy = proxyManager.getProxy('residential');
  
  const browser = await puppeteer.launch({
    args: [
      `--proxy-server=http://${proxy.endpoint}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  
  // Authenticate with OxyLabs
  await page.authenticate({
    username: proxy.username,
    password: proxy.password
  });
}
```

### Phase 2: Advanced Features

#### 2.1 Intelligent Proxy Selection
```javascript
class IntelligentProxySelector {
  selectProxyType(url, previousAttempts) {
    // Analyze target site characteristics
    if (this.isHighSecuritySite(url)) {
      return 'residential';
    } else if (this.isMobileSite(url)) {
      return 'mobile';
    } else {
      return 'datacenter'; // Fastest for basic sites
    }
  }

  isHighSecuritySite(url) {
    const highSecurityDomains = [
      'cloudflare.com',
      'akamai.com',
      'incapsula.com'
    ];
    return highSecurityDomains.some(domain => url.includes(domain));
  }
}
```

#### 2.2 Geographic Targeting
```javascript
class GeoTargetingManager {
  getCountryCode(url) {
    // Extract country requirements from URL or user settings
    const countryMappings = {
      'news.google.com': 'US',
      'bbc.co.uk': 'UK',
      'spiegel.de': 'DE'
    };
    
    for (const [domain, country] of Object.entries(countryMappings)) {
      if (url.includes(domain)) {
        return country;
      }
    }
    
    return 'US'; // Default
  }

  configureGeoProxy(proxyConfig, countryCode) {
    // Add country parameter to OxyLabs request
    proxyConfig.sessionId = `session_${countryCode}_${Date.now()}`;
    return proxyConfig;
  }
}
```

#### 2.3 Session Management
```javascript
class SessionManager {
  constructor() {
    this.activeSessions = new Map();
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
  }

  getSession(url) {
    const domain = new URL(url).hostname;
    
    if (this.activeSessions.has(domain)) {
      const session = this.activeSessions.get(domain);
      if (Date.now() - session.created < this.sessionTimeout) {
        return session.id;
      }
    }
    
    // Create new session
    const sessionId = `session_${domain}_${Date.now()}`;
    this.activeSessions.set(domain, {
      id: sessionId,
      created: Date.now()
    });
    
    return sessionId;
  }
}
```

### Phase 3: Monitoring and Analytics

#### 3.1 Performance Monitoring
```javascript
class ProxyPerformanceMonitor {
  constructor() {
    this.metrics = {
      successRate: new Map(),
      responseTime: new Map(),
      errorTypes: new Map(),
      usage: new Map()
    };
  }

  recordSuccess(proxyType, responseTime) {
    // Track successful requests
    this.updateMetric('successRate', proxyType, true);
    this.updateMetric('responseTime', proxyType, responseTime);
  }

  recordFailure(proxyType, error) {
    // Track failed requests
    this.updateMetric('successRate', proxyType, false);
    this.updateMetric('errorTypes', proxyType, error.code);
  }

  generateReport() {
    return {
      successRates: Object.fromEntries(this.metrics.successRate),
      averageResponseTimes: Object.fromEntries(this.metrics.responseTime),
      errorDistribution: Object.fromEntries(this.metrics.errorTypes),
      usageStats: Object.fromEntries(this.metrics.usage)
    };
  }
}
```

#### 3.2 Cost Tracking
```javascript
class CostTracker {
  constructor(pricing) {
    this.pricing = pricing; // OxyLabs pricing per GB
    this.usage = new Map();
  }

  trackUsage(proxyType, dataTransferred) {
    const current = this.usage.get(proxyType) || 0;
    this.usage.set(proxyType, current + dataTransferred);
  }

  calculateCost() {
    let totalCost = 0;
    
    for (const [proxyType, usage] of this.usage) {
      const usageGB = usage / (1024 * 1024 * 1024);
      const cost = usageGB * this.pricing[proxyType];
      totalCost += cost;
    }
    
    return totalCost;
  }
}
```

## Configuration Management

### Environment Variables
```bash
# OxyLabs Credentials
OXYLABS_USERNAME=your_username
OXYLABS_PASSWORD=your_password

# Proxy Configuration
PROXY_ENABLED=true
PROXY_TYPE=residential
PROXY_COUNTRY=US
PROXY_SESSION_TIMEOUT=1800000
PROXY_HEALTH_CHECK_INTERVAL=300000

# Monitoring
PROXY_MONITORING_ENABLED=true
PROXY_COST_TRACKING_ENABLED=true
```

### Configuration Schema
```javascript
const proxyConfig = {
  enabled: process.env.PROXY_ENABLED === 'true',
  defaultType: process.env.PROXY_TYPE || 'residential',
  geoTargeting: {
    enabled: true,
    defaultCountry: process.env.PROXY_COUNTRY || 'US'
  },
  session: {
    timeout: parseInt(process.env.PROXY_SESSION_TIMEOUT) || 1800000,
    sticky: true
  },
  monitoring: {
    enabled: process.env.PROXY_MONITORING_ENABLED === 'true',
    healthCheckInterval: parseInt(process.env.PROXY_HEALTH_CHECK_INTERVAL) || 300000
  },
  fallback: {
    enabled: true,
    maxRetries: 3,
    retryDelay: 1000
  }
};
```

## Implementation Timeline

### Week 1: Foundation
- [ ] Set up OxyLabs account and obtain credentials
- [ ] Implement basic proxy manager service
- [ ] Add proxy support to HTTP scraper
- [ ] Create configuration management system

### Week 2: Core Integration
- [ ] Integrate proxy support into Puppeteer scraper
- [ ] Implement basic rotation logic
- [ ] Add authentication and session management
- [ ] Test with existing scraping workflows

### Week 3: Advanced Features
- [ ] Implement intelligent proxy selection
- [ ] Add geographic targeting capabilities
- [ ] Create health monitoring system
- [ ] Implement failover mechanisms

### Week 4: Monitoring & Optimization
- [ ] Deploy performance monitoring
- [ ] Implement cost tracking
- [ ] Create reporting dashboard
- [ ] Optimize based on usage patterns

## Testing Strategy

### Unit Tests
```javascript
describe('OxyLabsProxyManager', () => {
  test('should select appropriate proxy type', () => {
    const manager = new OxyLabsProxyManager(config);
    const proxy = manager.getProxy('residential');
    expect(proxy.endpoint).toBe('pr.oxylabs.io:7777');
  });

  test('should handle authentication', async () => {
    const manager = new OxyLabsProxyManager(config);
    const result = await manager.authenticate(proxyConfig);
    expect(result).toBe(true);
  });
});
```

### Integration Tests
```javascript
describe('Proxy Integration', () => {
  test('HTTP scraper with proxy', async () => {
    const result = await scrapeWithHTTP('https://httpbin.org/ip');
    expect(result.success).toBe(true);
    expect(result.html).toContain('origin');
  });

  test('Puppeteer scraper with proxy', async () => {
    const result = await scrapeWithPuppeteer('https://httpbin.org/ip');
    expect(result.success).toBe(true);
    expect(result.html).toContain('origin');
  });
});
```

### Performance Tests
```javascript
describe('Proxy Performance', () => {
  test('should maintain response time under 5 seconds', async () => {
    const startTime = Date.now();
    await scrapeWithHTTP('https://example.com');
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(5000);
  });

  test('should achieve 95% success rate', async () => {
    const results = await Promise.allSettled(
      Array(100).fill().map(() => scrapeWithHTTP('https://httpbin.org/ip'))
    );
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    expect(successCount).toBeGreaterThan(95);
  });
});
```

## Monitoring and Alerts

### Key Metrics
- **Success Rate**: Target >95%
- **Response Time**: Target <3 seconds
- **Error Rate**: Target <5%
- **Cost per GB**: Monitor against budget
- **Proxy Health**: Automated health checks

### Alert Thresholds
```javascript
const alertConfig = {
  successRate: {
    warning: 0.90,
    critical: 0.85
  },
  responseTime: {
    warning: 3000,
    critical: 5000
  },
  errorRate: {
    warning: 0.05,
    critical: 0.10
  },
  cost: {
    dailyLimit: 100,
    monthlyLimit: 2000
  }
};
```

## Cost Optimization

### Usage Patterns
- **Residential**: Use for high-security sites only
- **Mobile**: Use for mobile-specific content
- **Datacenter**: Use for basic scraping (cheapest)
- **ISP**: Use for balance of speed and legitimacy

### Cost Reduction Strategies
1. **Intelligent proxy selection** based on site requirements
2. **Session reuse** to minimize connection overhead
3. **Compression** to reduce data transfer
4. **Caching** to avoid duplicate requests
5. **Rate limiting** to prevent excessive usage

### Budget Management
```javascript
class BudgetManager {
  constructor(monthlyBudget) {
    this.monthlyBudget = monthlyBudget;
    this.currentUsage = 0;
  }

  checkBudget(estimatedCost) {
    const projectedTotal = this.currentUsage + estimatedCost;
    const budgetRemaining = this.monthlyBudget - projectedTotal;
    
    if (budgetRemaining < 0) {
      throw new Error('Budget exceeded');
    }
    
    return budgetRemaining;
  }
}
```

## Security Considerations

### Credential Management
- Store OxyLabs credentials in environment variables
- Use secure credential rotation
- Implement access logging
- Monitor for unauthorized usage

### Data Protection
- Encrypt proxy configurations
- Secure session management
- Implement request logging
- Monitor for data leaks

## Rollback Plan

### Fallback Mechanism
```javascript
class ProxyFallbackManager {
  constructor() {
    this.directAccessEnabled = true;
    this.fallbackThreshold = 0.80; // 80% success rate
  }

  shouldFallback(successRate) {
    return successRate < this.fallbackThreshold;
  }

  async fallbackToDirectAccess(url, options) {
    console.log('Falling back to direct access');
    return await scrapeWithoutProxy(url, options);
  }
}
```

### Rollback Triggers
- Success rate drops below 80%
- Response time exceeds 10 seconds
- Budget exceeded
- Service unavailable

## Success Metrics

### Key Performance Indicators
- **Success Rate**: >95% (target: 99%)
- **Response Time**: <3 seconds average
- **Cost Efficiency**: <$0.10 per successful scrape
- **Uptime**: >99.9% availability
- **Error Rate**: <5% total errors

### Monitoring Dashboard
Create a real-time dashboard showing:
- Current success rates by proxy type
- Response time trends
- Cost utilization
- Error distribution
- Geographic performance

## Next Steps

1. **Account Setup**: Create OxyLabs account and obtain credentials
2. **Environment Setup**: Configure development environment with proxy support
3. **Implementation**: Start with Phase 1 basic integration
4. **Testing**: Implement comprehensive testing suite
5. **Deployment**: Deploy to staging environment for testing
6. **Monitoring**: Set up monitoring and alerting
7. **Production**: Deploy to production with gradual rollout
8. **Optimization**: Monitor and optimize based on usage patterns

---

*This document should be updated as implementation progresses and new requirements are identified.*