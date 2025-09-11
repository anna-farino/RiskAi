# Azure Container Apps Resource Scaling Recommendations

**Date**: 2025-09-11  
**Current Status**: IMMEDIATE ACTION REQUIRED  
**Impact**: HIGH - Production scraping performance severely limited  

## Current Resource Allocation

Based on Azure Container Apps configuration analysis:

```json
{
  "resources": {
    "cpu": 2,
    "ephemeralStorage": "8Gi", 
    "memory": "4Gi"
  }
}
```

## Performance Analysis

### Current Issues
1. **CycleTLS Operations**: Require significant CPU for TLS computations
2. **Puppeteer Browser Engine**: Memory-intensive with 1-2GB baseline requirement  
3. **Concurrent Scraping**: Current config limits concurrent operations to 2-3 requests
4. **Architecture Mismatches**: Possible ARM64 vs x64 binary incompatibility

### Resource Usage Patterns
- **CycleTLS Client Creation**: ~200-400MB memory per client
- **Puppeteer Browser Instance**: ~500MB-1GB memory per browser
- **Concurrent Content Processing**: ~100-200MB per active scraping job
- **Peak Memory Usage**: Can reach 3.5GB+ during intensive scraping operations

## Recommended Resource Scaling

### **Phase 1: Immediate Scaling (Production Fix)**
**Target**: Fix current production failures

```json
{
  "resources": {
    "cpu": 4,           // +100% CPU increase
    "memory": "6Gi",    // +50% memory increase  
    "ephemeralStorage": "8Gi"
  }
}
```

**Benefits**:
- Supports 4-6 concurrent scraping operations
- Adequate memory for CycleTLS + Puppeteer concurrency
- Reduces resource exhaustion failures
- Estimated cost increase: ~100%

### **Phase 2: Performance Optimization (Post-Fix)**
**Target**: Match Replit performance levels

```json
{
  "resources": {
    "cpu": 6,           // Premium performance
    "memory": "8Gi",    // Comfortable memory headroom
    "ephemeralStorage": "10Gi"  
  }
}
```

**Benefits**:
- Supports 8-12 concurrent scraping operations  
- Full CycleTLS + Puppeteer + AI processing pipeline
- Buffer for traffic spikes and complex sites
- Estimated cost increase: ~200%

### **Phase 3: Auto-scaling Configuration**
**Target**: Dynamic resource allocation

```json
{
  "scale": {
    "minReplicas": 1,
    "maxReplicas": 3,
    "rules": [
      {
        "name": "cpu-scaling-rule",
        "custom": {
          "type": "cpu",
          "metadata": {
            "type": "Utilization",
            "value": "70"
          }
        }
      },
      {
        "name": "memory-scaling-rule", 
        "custom": {
          "type": "memory",
          "metadata": {
            "type": "Utilization",
            "value": "80"
          }
        }
      }
    ]
  }
}
```

## Implementation Commands

### Phase 1: Immediate Resource Scaling

```bash
# Update staging environment
az containerapp update \
  --name app-risqai-backend \
  --resource-group group-risqai-staging \
  --cpu 4 \
  --memory 6Gi

# Update production environment  
az containerapp update \
  --name app-risqai-backend-prod \
  --resource-group group-risqai-production \
  --cpu 4 \
  --memory 6Gi
```

### Phase 2: Performance Optimization

```bash
# After validating Phase 1 success
az containerapp update \
  --name app-risqai-backend \
  --resource-group group-risqai-staging \
  --cpu 6 \
  --memory 8Gi \
  --ephemeral-storage 10Gi
```

### Phase 3: Auto-scaling Setup

```bash
# Configure auto-scaling rules
az containerapp revision set-scale \
  --name app-risqai-backend \
  --resource-group group-risqai-staging \
  --min-replicas 1 \
  --max-replicas 3 \
  --scale-rules-type "cpu" \
  --scale-rules-metadata "type=Utilization" "value=70"
```

## Cost Impact Analysis

### Current Configuration Cost (Baseline)
- **CPU**: 2 cores × $X/hour
- **Memory**: 4GB × $Y/hour  
- **Estimated Monthly**: $Z

### Phase 1 Scaling Cost Impact
- **CPU**: 4 cores × $X/hour (+100%)
- **Memory**: 6GB × $Y/hour (+50%)
- **Estimated Monthly**: ~$2Z (+100% total)

### Optimization Opportunities
1. **Off-peak scaling**: Reduce resources during low traffic periods
2. **Regional optimization**: Consider cheaper Azure regions if latency allows
3. **Reserved capacity**: Use Azure Reserved Instances for 30-70% discounts
4. **Spot instances**: Use spot pricing for non-critical processing

## Monitoring and Alerts

### Key Metrics to Track
1. **CPU Utilization**: Should stay <80% under normal load
2. **Memory Usage**: Should stay <75% to allow for spikes
3. **Request Queue Depth**: Monitor scraping job backlog
4. **CycleTLS Success Rate**: Track architecture compatibility
5. **Response Times**: Should improve significantly post-scaling

### Recommended Alerts
```bash
# CPU utilization alert
az monitor metrics alert create \
  --name "High CPU Usage" \
  --resource-group group-risqai-staging \
  --scopes "/subscriptions/.../app-risqai-backend" \
  --condition "Percentage CPU > 85" \
  --window-size 5m \
  --evaluation-frequency 1m

# Memory utilization alert  
az monitor metrics alert create \
  --name "High Memory Usage" \
  --resource-group group-risqai-staging \
  --scopes "/subscriptions/.../app-risqai-backend" \
  --condition "Memory Usage > 80%" \
  --window-size 5m \
  --evaluation-frequency 1m
```

## Architecture Considerations

### CycleTLS Binary Compatibility
- **Current Issue**: Possible ARM64/x64 mismatch
- **Solution**: Enhanced Dockerfile diagnostics will identify architecture
- **Fallback**: Graceful fallback to Puppeteer when CycleTLS unavailable

### Performance vs Cost Balance
- **Start with Phase 1**: Immediate production fix
- **Monitor 24-48 hours**: Validate scraping success rate improvement  
- **Scale to Phase 2**: If traffic patterns justify higher performance
- **Implement auto-scaling**: For dynamic workload management

## Success Criteria

### Phase 1 Success Metrics
- [ ] Scraping success rate >90% (vs current <10%)
- [ ] CycleTLS requests returning valid responses  
- [ ] URL normalization errors eliminated
- [ ] Container startup diagnostics showing healthy CycleTLS binaries
- [ ] Average response time <30 seconds per scraping job

### Performance Benchmarks
- **Target**: Match or exceed Replit performance
- **Concurrent Operations**: 6-8 simultaneous scraping jobs
- **Memory Stability**: No memory-related crashes under normal load
- **Cost Efficiency**: Reasonable cost per successful scraping operation

## Rollback Plan

If resource scaling doesn't resolve issues:
1. **Immediate rollback** to previous configuration
2. **Architecture investigation**: Focus on binary compatibility  
3. **Alternative solutions**: Consider different base Docker images
4. **Environment migration**: Evaluate alternative cloud providers

---

**Next Steps**:
1. ✅ Implement Phase 1 scaling immediately
2. ⏳ Monitor performance for 24-48 hours  
3. ⏳ Validate CycleTLS architecture compatibility via enhanced diagnostics
4. ⏳ Proceed to Phase 2 if justified by usage patterns