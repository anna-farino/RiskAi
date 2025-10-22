# Azure Infrastructure Implementation Guide
## Phases 0-2: Quick Wins, Foundation & Security

**Document Version:** 1.0
**Created:** October 9, 2025
**Project:** RisqAI Platform
**Target Audience:** DevOps Engineers, Backend Developers
**Estimated Total Time:** 8-12 weeks
**Estimated Total Cost Impact:** +$255-445/month

---

## Table of Contents

### Phase 0: Quick Wins (Week 1)
1. [Configure Azure Monitor Alerts](#phase-0-task-1-configure-azure-monitor-alerts)
2. [Implement Azure Cost Management Budgets](#phase-0-task-2-implement-azure-cost-management-budgets)
3. [Container Registry Lifecycle Policies](#phase-0-task-3-container-registry-lifecycle-policies)
4. [Verify PostgreSQL Backups](#phase-0-task-4-verify-postgresql-backups)

### Phase 1: Foundational Improvements (Weeks 2-5)
5. [Enable Application Insights](#phase-1-task-1-enable-application-insights)
6. [Configure Container Apps Auto-Scaling](#phase-1-task-2-configure-container-apps-auto-scaling)
7. [Extend Log Retention to 90 Days](#phase-1-task-3-extend-log-retention-to-90-days)
8. [Right-Size Container Resources](#phase-1-task-4-right-size-container-resources)
9. [Implement Health Probes](#phase-1-task-5-implement-health-probes)

### Phase 2: Security & Resilience (Weeks 6-12)
10. [Enable PostgreSQL High Availability](#phase-2-task-1-enable-postgresql-high-availability)
11. [Enable Microsoft Defender for Cloud](#phase-2-task-2-enable-microsoft-defender-for-cloud)
12. [Implement WAF with Azure Front Door](#phase-2-task-3-implement-waf-with-azure-front-door)

---

# Phase 0: Quick Wins (Week 1)

**Goal:** Establish basic monitoring, cost controls, and safety nets
**Total Time:** 2-3 days
**Total Cost:** -$5 to +$15/month
**Risk Level:** Low

---

## Phase 0, Task 1: Configure Azure Monitor Alerts

### What This Is

Azure Monitor Alerts is a proactive notification system that continuously watches your infrastructure metrics and logs, sending notifications when predefined thresholds are crossed. Think of it as your infrastructure's early warning system.

### What It Does

- **Monitors metrics** from Container Apps, PostgreSQL, Key Vault, and other Azure resources
- **Evaluates alert rules** every 1-5 minutes (depending on configuration)
- **Triggers actions** like sending emails, SMS, webhooks, or executing Azure Automation runbooks
- **Maintains alert history** for audit trails and trend analysis
- **Integrates with incident management** tools like PagerDuty, ServiceNow, or Slack

### Why You Need This

**Without alerts:**
- 😰 You discover outages when users complain
- 💸 Cost overruns go unnoticed until the bill arrives
- 🔥 Performance degradation escalates into full outages
- ⏰ Mean Time To Detection (MTTD) is measured in hours or days

**With alerts:**
- ✅ Know about issues in minutes, not hours
- ✅ Prevent small problems from becoming big ones
- ✅ Meet SLA commitments with confidence
- ✅ Sleep better knowing you'll be notified of issues

**Real-world scenario:** Container memory hits 95% → Alert fires → Team investigates → Find memory leak → Deploy fix → Prevent crash that would have affected thousands of users.

### Prerequisites

- [ ] Azure CLI installed and authenticated (`az login`)
- [ ] Access to Azure subscription with Contributor role
- [ ] Email addresses for alert recipients
- [ ] (Optional) Slack webhook or PagerDuty integration key

### Time Estimate

- **Setup:** 4 hours
- **Testing:** 2 hours
- **Documentation:** 1 hour
- **Total:** 1 day

### Cost Impact

- First 10 alert rules: **FREE**
- Each additional alert rule: **$0.10/month**
- Email actions: **FREE**
- SMS actions: **$0.15 per SMS**
- **Estimated total:** $2-5/month

---

### Implementation Steps

#### Step 1: Create Action Groups

Action Groups define WHO gets notified and HOW when an alert fires.

**1.1: Create Email Action Group**

```bash
# Create action group for email notifications
az monitor action-group create \
  --name ag-risqai-email-critical \
  --resource-group group-risqai-production \
  --short-name emailcrit \
  --action email engineering-team engineering@risqai.com \
  --action email devops-lead devops-lead@risqai.com
```

**1.2: Create SMS Action Group (Optional)**

```bash
# Create action group for SMS (critical alerts only)
az monitor action-group create \
  --name ag-risqai-sms-critical \
  --resource-group group-risqai-production \
  --short-name smscrit \
  --action sms oncall "+1234567890"
```

**1.3: Create Webhook Action Group for Slack (Optional)**

```bash
# Create action group for Slack webhook
az monitor action-group create \
  --name ag-risqai-slack \
  --resource-group group-risqai-production \
  --short-name slackalert \
  --action webhook slack-webhook https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

**Verification:**

```bash
# List all action groups
az monitor action-group list \
  --resource-group group-risqai-production \
  --output table

# Test action group (sends test notification)
az monitor action-group test-notifications create \
  --action-group-name ag-risqai-email-critical \
  --resource-group group-risqai-production \
  --notification-type Email \
  --test-notification-id "test-$(date +%s)"
```

---

#### Step 2: Create Container App Alerts

**2.1: CPU Usage Alert**

```bash
# Alert when Container App CPU > 90% for 10 minutes
az monitor metrics alert create \
  --name alert-containerapp-cpu-high-prod \
  --resource-group group-risqai-production \
  --scopes /subscriptions/{subscription-id}/resourceGroups/group-risqai-production/providers/Microsoft.App/containerApps/app-risqai-backend-prod \
  --condition "avg UsagePercentage > 90" \
  --window-size 10m \
  --evaluation-frequency 5m \
  --action ag-risqai-email-critical \
  --description "Container App CPU usage exceeded 90% for 10 minutes" \
  --severity 2
```

**Note:** Replace `{subscription-id}` with your actual subscription ID. Get it with: `az account show --query id -o tsv`

**2.2: Memory Usage Alert**

```bash
# Alert when Container App memory > 95% for 5 minutes
az monitor metrics alert create \
  --name alert-containerapp-memory-high-prod \
  --resource-group group-risqai-production \
  --scopes /subscriptions/{subscription-id}/resourceGroups/group-risqai-production/providers/Microsoft.App/containerApps/app-risqai-backend-prod \
  --condition "avg WorkingSetBytes > 1019215872" \
  --window-size 5m \
  --evaluation-frequency 5m \
  --action ag-risqai-email-critical \
  --action ag-risqai-sms-critical \
  --description "Container App memory usage exceeded 95% (970 MB out of 1024 MB)" \
  --severity 1
```

**Note:** 1019215872 bytes = 972 MB (95% of 1 GiB = 1024 MB)

**2.3: Container Restart Alert**

```bash
# Alert when containers restart frequently (sign of crashes)
az monitor metrics alert create \
  --name alert-containerapp-restarts-prod \
  --resource-group group-risqai-production \
  --scopes /subscriptions/{subscription-id}/resourceGroups/group-risqai-production/providers/Microsoft.App/containerApps/app-risqai-backend-prod \
  --condition "total Restarts > 3" \
  --window-size 1h \
  --evaluation-frequency 5m \
  --action ag-risqai-email-critical \
  --description "Container restarted more than 3 times in 1 hour" \
  --severity 2
```

**2.4: HTTP 5xx Error Rate Alert**

```bash
# Alert when error rate > 5% of requests
az monitor metrics alert create \
  --name alert-containerapp-errors-prod \
  --resource-group group-risqai-production \
  --scopes /subscriptions/{subscription-id}/resourceGroups/group-risqai-production/providers/Microsoft.App/containerApps/app-risqai-backend-prod \
  --condition "avg Requests where ResultCode >= 500 > 5" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action ag-risqai-email-critical \
  --action ag-risqai-sms-critical \
  --description "HTTP 5xx error rate exceeded 5%" \
  --severity 1
```

---

#### Step 3: Create PostgreSQL Database Alerts

**3.1: Database CPU Alert**

```bash
# Alert when database CPU > 80% for 15 minutes
az monitor metrics alert create \
  --name alert-postgres-cpu-high-prod \
  --resource-group group-risqai-production \
  --scopes /subscriptions/{subscription-id}/resourceGroups/group-risqai-production/providers/Microsoft.DBforPostgreSQL/flexibleServers/db-risqai-production \
  --condition "avg cpu_percent > 80" \
  --window-size 15m \
  --evaluation-frequency 5m \
  --action ag-risqai-email-critical \
  --description "PostgreSQL CPU usage exceeded 80% for 15 minutes" \
  --severity 2
```

**3.2: Database Connection Count Alert**

```bash
# Alert when connection count > 80% of max (Standard_D2ds_v5 supports ~100 connections)
az monitor metrics alert create \
  --name alert-postgres-connections-high-prod \
  --resource-group group-risqai-production \
  --scopes /subscriptions/{subscription-id}/resourceGroups/group-risqai-production/providers/Microsoft.DBforPostgreSQL/flexibleServers/db-risqai-production \
  --condition "avg active_connections > 80" \
  --window-size 15m \
  --evaluation-frequency 5m \
  --action ag-risqai-email-critical \
  --description "PostgreSQL active connections exceeded 80 (80% of max)" \
  --severity 2
```

**3.3: Database Storage Alert**

```bash
# Alert when storage > 85% full
az monitor metrics alert create \
  --name alert-postgres-storage-high-prod \
  --resource-group group-risqai-production \
  --scopes /subscriptions/{subscription-id}/resourceGroups/group-risqai-production/providers/Microsoft.DBforPostgreSQL/flexibleServers/db-risqai-production \
  --condition "avg storage_percent > 85" \
  --window-size 1h \
  --evaluation-frequency 15m \
  --action ag-risqai-email-critical \
  --description "PostgreSQL storage exceeded 85% of 32 GB capacity" \
  --severity 2
```

**3.4: Database Replication Lag Alert (if HA enabled later)**

```bash
# Alert when replication lag > 10 seconds (will only work after HA is enabled in Phase 2)
az monitor metrics alert create \
  --name alert-postgres-replication-lag-prod \
  --resource-group group-risqai-production \
  --scopes /subscriptions/{subscription-id}/resourceGroups/group-risqai-production/providers/Microsoft.DBforPostgreSQL/flexibleServers/db-risqai-production \
  --condition "max physical_replication_delay_in_seconds > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action ag-risqai-email-critical \
  --description "PostgreSQL replication lag exceeded 10 seconds" \
  --severity 2
```

---

#### Step 4: Create Key Vault Alerts

**4.1: Key Vault Access Denied Alert**

```bash
# Alert on any Key Vault access denied events
az monitor metrics alert create \
  --name alert-keyvault-access-denied-prod \
  --resource-group group-risqai-production \
  --scopes /subscriptions/{subscription-id}/resourceGroups/group-risqai-production/providers/Microsoft.KeyVault/vaults/risqai-keyv-production \
  --condition "total ServiceApiResult where StatusCode = 403 > 0" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action ag-risqai-email-critical \
  --description "Key Vault access denied - possible security issue" \
  --severity 1
```

**4.2: Key Vault Throttling Alert**

```bash
# Alert when Key Vault is being throttled (too many requests)
az monitor metrics alert create \
  --name alert-keyvault-throttled-prod \
  --resource-group group-risqai-production \
  --scopes /subscriptions/{subscription-id}/resourceGroups/group-risqai-production/providers/Microsoft.KeyVault/vaults/risqai-keyv-production \
  --condition "total ServiceApiResult where StatusCode = 429 > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action ag-risqai-email-critical \
  --description "Key Vault is being throttled - check request rate" \
  --severity 2
```

---

#### Step 5: Create Log Analytics Alerts

**5.1: Log Analytics Workspace Near Capacity**

```bash
# Alert when Log Analytics workspace is near daily cap
az monitor metrics alert create \
  --name alert-loganalytics-near-cap-prod \
  --resource-group group-risqai-production \
  --scopes /subscriptions/{subscription-id}/resourceGroups/group-risqai-production/providers/Microsoft.OperationalInsights/workspaces/workspace-risqai-production \
  --condition "avg PercentageUsage > 90" \
  --window-size 1h \
  --evaluation-frequency 15m \
  --action ag-risqai-email-critical \
  --description "Log Analytics workspace is at 90% of daily cap" \
  --severity 2
```

---

### Verification & Testing

**Test 1: Verify All Alerts Are Created**

```bash
# List all alert rules in production resource group
az monitor metrics alert list \
  --resource-group group-risqai-production \
  --output table

# Expected output: Should see all alert rules created above
```

**Test 2: Manually Trigger a Test Alert**

```bash
# Update an alert to trigger immediately (lower threshold temporarily)
az monitor metrics alert update \
  --name alert-containerapp-cpu-high-prod \
  --resource-group group-risqai-production \
  --condition "avg UsagePercentage > 1"  # Very low threshold

# Wait 5-10 minutes, check email for alert

# Restore original threshold
az monitor metrics alert update \
  --name alert-containerapp-cpu-high-prod \
  --resource-group group-risqai-production \
  --condition "avg UsagePercentage > 90"
```

**Test 3: Check Alert History**

```bash
# View alert history (last 24 hours)
az monitor metrics alert show \
  --name alert-containerapp-cpu-high-prod \
  --resource-group group-risqai-production \
  --query "'{name:name, enabled:enabled, condition:criteria.allOf[0].criterionType}'"
```

**Test 4: Verify Action Group Received Notification**

- Check email inbox for test notification
- Verify Slack channel received webhook (if configured)
- Check phone for SMS (if configured)

---

### Monitoring Dashboard Setup

**Create a Custom Dashboard in Azure Portal:**

1. Navigate to Azure Portal → Dashboards → New Dashboard
2. Name it: "RisqAI Production Monitoring"
3. Add tiles:
   - Container App CPU/Memory charts
   - PostgreSQL CPU/Connections/Storage charts
   - Key Vault request rate
   - Alert summary (active alerts)
   - Cost analysis widget

**Alternative: Create via CLI**

```bash
# Export dashboard configuration (after creating in portal)
az portal dashboard show \
  --name "RisqAI Production Monitoring" \
  --resource-group group-risqai-production \
  --output json > dashboard-config.json

# Import dashboard to staging (for consistency)
az portal dashboard create \
  --name "RisqAI Staging Monitoring" \
  --resource-group group-risqai-staging \
  --input-path dashboard-config.json
```

---

### Troubleshooting

**Problem: Alerts not firing**

```bash
# Check alert rule status
az monitor metrics alert show \
  --name alert-containerapp-cpu-high-prod \
  --resource-group group-risqai-production \
  --query "enabled"

# Enable if disabled
az monitor metrics alert update \
  --name alert-containerapp-cpu-high-prod \
  --resource-group group-risqai-production \
  --enabled true
```

**Problem: Too many false positives**

- Adjust thresholds (increase percentage or extend time window)
- Change evaluation frequency to reduce noise
- Consider using dynamic thresholds (AI-based)

```bash
# Update to dynamic threshold
az monitor metrics alert update \
  --name alert-containerapp-cpu-high-prod \
  --resource-group group-risqai-production \
  --condition "avg UsagePercentage > dynamic high 2"  # 2 = sensitivity
```

**Problem: Action group not receiving notifications**

```bash
# Verify action group configuration
az monitor action-group show \
  --name ag-risqai-email-critical \
  --resource-group group-risqai-production

# Test action group
az monitor action-group test-notifications create \
  --action-group-name ag-risqai-email-critical \
  --resource-group group-risqai-production \
  --notification-type Email \
  --test-notification-id "troubleshoot-$(date +%s)"
```

---

### Rollback Procedure

```bash
# Delete all alerts if needed
az monitor metrics alert delete \
  --name alert-containerapp-cpu-high-prod \
  --resource-group group-risqai-production

# Delete action groups
az monitor action-group delete \
  --name ag-risqai-email-critical \
  --resource-group group-risqai-production
```

---

### Success Metrics

- [ ] All 12 alert rules created and enabled
- [ ] Test notification received by email
- [ ] Alert fires when threshold is crossed
- [ ] Alert history visible in Azure Monitor
- [ ] Dashboard displays current metrics
- [ ] Team acknowledges understanding of alerts

### Documentation Requirements

Create a document: `docs/monitoring/alert-runbooks.md`

```markdown
# Alert Runbooks

## Alert: Container CPU High

**When:** CPU usage > 90% for 10 minutes

**Impact:** Performance degradation, slow response times

**Immediate Actions:**
1. Check Container App logs for errors
2. Check database query performance
3. Consider horizontal scaling (increase replicas)
4. Investigate recent code deployments

**Resolution Steps:**
1. Scale up replicas: `az containerapp update --name app-risqai-backend-prod --min-replicas 3`
2. Investigate root cause during business hours
3. Optimize code or increase CPU allocation if needed

## Alert: PostgreSQL Connections High

**When:** Active connections > 80

**Impact:** New connections may be refused, affecting availability

**Immediate Actions:**
1. Check for connection leaks in application code
2. Review long-running queries: `SELECT * FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL '1 hour';`
3. Consider killing idle connections

**Resolution Steps:**
1. Terminate idle connections: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < NOW() - INTERVAL '2 hours';`
2. Review application connection pooling settings
3. Increase max connections if appropriate (upgrade tier)

# ... (continue for each alert)
```

---

## Phase 0, Task 2: Implement Azure Cost Management Budgets

### What This Is

Azure Cost Management Budgets is a built-in financial governance tool that sets spending limits and sends proactive alerts BEFORE you exceed your budget. It's like a credit card spending alert, but for your cloud infrastructure.

### What It Does

- **Sets monthly/quarterly/annual budgets** at subscription or resource group level
- **Tracks actual spending** vs. forecasted spending
- **Sends email alerts** at 50%, 80%, 100% of budget
- **Provides cost trend analysis** and spending forecasts
- **Integrates with action groups** for automated responses (optional)
- **Supports resource tags** for cost allocation by team/project

### Why You Need This

**Real-world scenarios prevented:**
- 😱 "Our Azure bill jumped from $300 to $3,000 this month!" → Budget alert at $400 would have caught this
- 💸 Forgot to turn off staging environment over holidays → Budget alert prevents waste
- 🚨 Someone accidentally deployed 50 VMs instead of 5 → Immediate alert catches it

### Prerequisites

- [ ] Azure CLI authenticated
- [ ] Understanding of typical monthly spending
- [ ] Email addresses for budget alerts
- [ ] (Optional) Management team contacts for high-severity alerts

### Time Estimate

- **Setup:** 2 hours
- **Testing:** 30 minutes
- **Documentation:** 30 minutes
- **Total:** 3 hours

### Cost Impact

- **FREE** - Azure Cost Management is included in your subscription

---

### Implementation Steps

#### Step 1: Analyze Current Spending

**1.1: Review Last 3 Months of Spending**

```bash
# Get cost for last 3 months (production resource group)
az consumption usage list \
  --start-date $(date -d "90 days ago" +%Y-%m-%d) \
  --end-date $(date +%Y-%m-%d) \
  --query "[?contains(instanceId, 'group-risqai-production')].{date:usageStart, cost:pretaxCost}" \
  --output table

# Get cost breakdown by service
az cost-management query \
  --type ActualCost \
  --dataset-grouping name="ServiceName" type="Dimension" \
  --timeframe MonthToDate
```

**1.2: Identify Cost Trends**

Navigate to Azure Portal → Cost Management + Billing → Cost Analysis

- Select "Last 3 months"
- Group by: Service name, Resource group
- Look for: Unexpected spikes, trending increases, idle resources

**1.3: Calculate Budget Amounts**

Based on current assessment ($305-335/month) and Phase 0-1 increases (+$15-45/month):

- Production budget: **$400/month** (includes headroom for spikes)
- Staging budget: **$150/month** (lower usage)
- Total subscription budget: **$600/month**

---

#### Step 2: Create Resource Group Budgets

**2.1: Production Resource Group Budget**

```bash
# Create monthly budget for production
az consumption budget create \
  --budget-name budget-production-monthly \
  --amount 400 \
  --category Cost \
  --time-grain Monthly \
  --start-date 2025-11-01 \
  --end-date 2026-12-31 \
  --resource-group group-risqai-production \
  --notifications \
    threshold=50 \
    operator=GreaterThan \
    contactEmails="[\"devops@risqai.com\",\"finance@risqai.com\"]" \
    contactRoles="[\"Owner\",\"Contributor\"]" \
  --notifications \
    threshold=80 \
    operator=GreaterThan \
    contactEmails="[\"devops@risqai.com\",\"finance@risqai.com\",\"cto@risqai.com\"]" \
  --notifications \
    threshold=100 \
    operator=GreaterThan \
    contactEmails="[\"devops@risqai.com\",\"finance@risqai.com\",\"cto@risqai.com\",\"ceo@risqai.com\"]"
```

**2.2: Staging Resource Group Budget**

```bash
# Create monthly budget for staging
az consumption budget create \
  --budget-name budget-staging-monthly \
  --amount 150 \
  --category Cost \
  --time-grain Monthly \
  --start-date 2025-11-01 \
  --end-date 2026-12-31 \
  --resource-group group-risqai-staging \
  --notifications \
    threshold=80 \
    operator=GreaterThan \
    contactEmails="[\"devops@risqai.com\"]" \
  --notifications \
    threshold=100 \
    operator=GreaterThan \
    contactEmails="[\"devops@risqai.com\",\"finance@risqai.com\"]"
```

**2.3: Subscription-Level Budget (Overall Cap)**

```bash
# Get subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Create subscription-level budget
az consumption budget create \
  --budget-name budget-subscription-monthly \
  --amount 600 \
  --category Cost \
  --time-grain Monthly \
  --start-date 2025-11-01 \
  --end-date 2026-12-31 \
  --subscription $SUBSCRIPTION_ID \
  --notifications \
    threshold=75 \
    operator=GreaterThan \
    contactEmails="[\"devops@risqai.com\",\"finance@risqai.com\"]" \
  --notifications \
    threshold=90 \
    operator=GreaterThan \
    contactEmails="[\"devops@risqai.com\",\"finance@risqai.com\",\"cto@risqai.com\"]" \
  --notifications \
    threshold=100 \
    operator=GreaterThan \
    contactEmails="[\"devops@risqai.com\",\"finance@risqai.com\",\"cto@risqai.com\",\"ceo@risqai.com\"]"
```

---

#### Step 3: Configure Advanced Budget Alerts with Action Groups

**3.1: Create Action Group for Budget Alerts**

```bash
# Create action group that triggers when budget exceeds 100%
az monitor action-group create \
  --name ag-budget-exceeded \
  --resource-group group-risqai-production \
  --short-name budgetag \
  --action email finance finance@risqai.com \
  --action email devops devops@risqai.com \
  --action webhook slack https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

**3.2: Create Budget with Action Group Integration**

```bash
# This requires Azure Portal for now (CLI support limited)
# Navigate to: Cost Management + Billing → Budgets → Add

# Configuration:
# - Name: budget-production-monthly-automated
# - Amount: $400
# - Alerts:
#   - At 100%: Trigger action group ag-budget-exceeded
#   - At 100%: Send email to leadership
```

---

#### Step 4: Implement Cost Allocation Tags

**4.1: Define Tagging Strategy**

Create file: `docs/governance/tagging-strategy.md`

```markdown
# Required Tags

All Azure resources must have these tags:

| Tag | Values | Purpose |
|-----|--------|---------|
| environment | production, staging, development | Separate costs by environment |
| cost-center | engineering, marketing, sales | Allocate costs to departments |
| owner | team-name or email | Accountability |
| project | risqai-platform, risqai-landing | Project-specific costs |
| created-by | github-actions, manual, terraform | Track provisioning method |
```

**4.2: Tag Existing Resources**

```bash
# Tag production resources
az resource tag \
  --tags environment=production cost-center=engineering owner=devops project=risqai-platform created-by=manual \
  --ids $(az resource list --resource-group group-risqai-production --query "[].id" -o tsv)

# Tag staging resources
az resource tag \
  --tags environment=staging cost-center=engineering owner=devops project=risqai-platform created-by=manual \
  --ids $(az resource list --resource-group group-risqai-staging --query "[].id" -o tsv)
```

**4.3: Verify Tags Applied**

```bash
# List all resources with tags
az resource list \
  --resource-group group-risqai-production \
  --query "[].{name:name, type:type, tags:tags}" \
  --output table
```

---

#### Step 5: Create Cost Analysis Views

**5.1: Via Azure Portal (Recommended)**

1. Navigate to: Cost Management + Billing → Cost Analysis
2. Create custom views:

**View 1: "Environment Comparison"**
- Scope: Subscription
- Group by: Tag → environment
- Chart type: Stacked column
- Time: Last 6 months
- Save as: "Environment Comparison"

**View 2: "Service Cost Breakdown (Production)"**
- Scope: group-risqai-production
- Group by: Service name
- Chart type: Pie chart
- Time: Month to date
- Save as: "Production Service Costs"

**View 3: "Daily Cost Trend"**
- Scope: Subscription
- Group by: None
- Granularity: Daily
- Chart type: Line chart
- Time: Last 30 days
- Save as: "Daily Cost Trend"

**5.2: Schedule Automated Reports**

In Cost Management → Cost Analysis:
1. Click "Subscribe" (icon)
2. Configure:
   - Frequency: Weekly (every Monday)
   - Recipients: devops@risqai.com, finance@risqai.com
   - Format: Excel file
   - Include: All saved views

---

### Verification & Testing

**Test 1: Verify Budgets Created**

```bash
# List all budgets
az consumption budget list \
  --resource-group group-risqai-production \
  --output table

# Check subscription-level budgets
az consumption budget list \
  --subscription $SUBSCRIPTION_ID \
  --output table
```

**Test 2: Verify Budget Alert Recipients**

```bash
# Show budget details including notifications
az consumption budget show \
  --budget-name budget-production-monthly \
  --resource-group group-risqai-production \
  --query "notifications" \
  --output json
```

**Test 3: Simulate Budget Alert (Cannot be done automatically)**

- Wait for actual spending to reach threshold, OR
- Temporarily reduce budget amount to trigger alert:

```bash
# Reduce budget to trigger alert
az consumption budget update \
  --budget-name budget-production-monthly \
  --amount 1 \
  --resource-group group-risqai-production

# Wait 4-6 hours for budget evaluation cycle
# Check email for alert

# Restore actual budget
az consumption budget update \
  --budget-name budget-production-monthly \
  --amount 400 \
  --resource-group group-risqai-production
```

---

### Monitoring

**Weekly Review Process:**

1. Check Cost Analysis dashboard every Monday morning
2. Review budget utilization (should be ~23% by end of week 1)
3. Investigate any unexpected spikes > 20% week-over-week
4. Update budget forecasts quarterly

**Monthly Review Process:**

1. Compare actual vs. budgeted spending
2. Analyze variances > 10%
3. Update budgets based on new infrastructure (Phases 1-2)
4. Share cost report with leadership

---

### Success Metrics

- [ ] All budgets created (production, staging, subscription)
- [ ] All resources tagged with required tags
- [ ] Budget alerts configured for 50%, 80%, 100%
- [ ] Weekly cost reports scheduled
- [ ] Team trained on cost analysis dashboard
- [ ] Alert email received when budget threshold crossed

---

## Phase 0, Task 3: Container Registry Lifecycle Policies

### What This Is

Azure Container Registry (ACR) Lifecycle Policies automatically delete old, unused, or untagged container images based on rules you define. Think of it as an automated cleanup service that prevents your registry from becoming a junk drawer.

### What It Does

- **Automatically purges** old images beyond retention count
- **Removes untagged images** (dangling manifests from failed builds)
- **Filters by repository** and tag patterns
- **Runs on schedule** (daily, weekly, etc.)
- **Saves storage costs** by deleting unused images
- **Improves security** by removing old images with known vulnerabilities

### Why You Need This

**Without lifecycle policies:**
- 📦 ACR fills up with 100+ old images you'll never use
- 💸 Paying $0.10/GB/month for images from 6 months ago
- 🔒 Old images contain security vulnerabilities (outdated dependencies)
- 🐌 Slower image pulls due to large registry size

**With lifecycle policies:**
- ✅ Only keep last 10 images per repository
- ✅ Automatically remove untagged images weekly
- ✅ Reduce storage costs by 50-70%
- ✅ Cleaner registry, easier to manage

**Example:** Your `app-risqai-backend-prod` repository has 47 images dating back 4 months. You only ever use the latest 5. Policy keeps last 10, deletes 37 images → Saves ~3.7 GB × $0.10 = **$0.37/month per repo**.

### Prerequisites

- [ ] Azure CLI authenticated
- [ ] Contributor or Owner role on ACR
- [ ] Understanding of which images are critical (don't delete production tags!)

### Time Estimate

- **Setup:** 1 hour
- **Testing:** 1 hour
- **Documentation:** 30 minutes
- **Total:** 2.5 hours

### Cost Impact

- **Savings:** $10-15/month (depending on current registry size)
- **ACR tasks:** Free for first 6,000 task minutes/month

---

### Implementation Steps

#### Step 1: Audit Current Container Registry

**1.1: List All Repositories**

```bash
# Production ACR
az acr repository list \
  --name risqaiprod \
  --output table

# Staging ACR
az acr repository list \
  --name risqaistg \
  --output table
```

**1.2: Count Images Per Repository**

```bash
# Show all tags for backend production images
az acr repository show-tags \
  --name risqaiprod \
  --repository app-risqai-backend-prod \
  --output table

# Count total images
az acr repository show-tags \
  --name risqaiprod \
  --repository app-risqai-backend-prod \
  --output json | jq 'length'

# Show image details (size, created date)
az acr repository show \
  --name risqaiprod \
  --repository app-risqai-backend-prod \
  --output json | jq '.manifestCount, .tagCount'
```

**1.3: Calculate Storage Usage**

```bash
# Get total ACR storage usage
az acr show-usage \
  --name risqaiprod \
  --output table

# Example output:
# NAME      CURRENTVALUE    LIMIT
# Size      2.5 GB          500 GB
# Webhooks  3               100
```

---

#### Step 2: Create Image Retention Policy

**2.1: Keep Last 10 Images Per Repository**

```bash
# Create ACR task to purge old images daily
az acr task create \
  --name purge-old-backend-images \
  --registry risqaiprod \
  --cmd "acr purge \
    --filter 'app-risqai-backend-prod:.*' \
    --keep 10 \
    --ago 30d \
    --untagged" \
  --schedule "0 0 * * *" \
  --timeout 3600 \
  --context /dev/null

# Explanation:
# --filter 'app-risqai-backend-prod:.*' = Match all tags in this repo
# --keep 10 = Keep newest 10 images
# --ago 30d = Only delete images older than 30 days
# --untagged = Also delete untagged manifests
# --schedule "0 0 * * *" = Run daily at midnight UTC
```

**2.2: Create Policy for All Repositories**

```bash
# Purge old images from ALL repositories
az acr task create \
  --name purge-all-old-images \
  --registry risqaiprod \
  --cmd "acr purge \
    --filter '.*:.*' \
    --keep 10 \
    --ago 30d" \
  --schedule "0 1 * * *" \
  --timeout 3600 \
  --context /dev/null
```

---

#### Step 3: Create Untagged Image Cleanup Policy

**3.1: Remove Untagged Images Weekly**

```bash
# Remove untagged (dangling) images every Sunday at 2 AM
az acr task create \
  --name purge-untagged-images \
  --registry risqaiprod \
  --cmd "acr purge \
    --filter '.*:.*' \
    --untagged \
    --ago 7d" \
  --schedule "0 2 * * 0" \
  --timeout 1800 \
  --context /dev/null

# Explanation:
# --untagged = Only delete images with no tags
# --ago 7d = Only delete if older than 7 days (gives time for builds to complete)
# Schedule "0 2 * * 0" = Every Sunday at 2 AM UTC
```

---

#### Step 4: Implement Tag Protection (Critical Images)

**4.1: Create Protected Tags List**

Some images should NEVER be deleted (latest stable releases, disaster recovery images):

```bash
# Create a tag pattern for protected images
# Example: Keep all images tagged "stable", "v1.x.x", "dr-backup-*"

# Option 1: Use ACR repository scoped tokens (Premium SKU only)
# Option 2: Exclude from purge filter

# Modify purge task to exclude protected tags
az acr task update \
  --name purge-old-backend-images \
  --registry risqaiprod \
  --cmd "acr purge \
    --filter 'app-risqai-backend-prod:^(?!stable|v1\\\\..*).*' \
    --keep 10 \
    --ago 30d"

# Explanation:
# --filter uses regex negative lookahead to exclude tags matching "stable" or "v1.*"
```

---

#### Step 5: Apply to Staging Registry

**5.1: Replicate Policies to Staging**

```bash
# Staging: More aggressive cleanup (keep only 5 images)
az acr task create \
  --name purge-old-images-staging \
  --registry risqaistg \
  --cmd "acr purge \
    --filter '.*:.*' \
    --keep 5 \
    --ago 14d" \
  --schedule "0 3 * * *" \
  --timeout 3600 \
  --context /dev/null

# Staging: Remove untagged images more frequently
az acr task create \
  --name purge-untagged-staging \
  --registry risqaistg \
  --cmd "acr purge \
    --filter '.*:.*' \
    --untagged \
    --ago 3d" \
  --schedule "0 4 * * *" \
  --timeout 1800 \
  --context /dev/null
```

---

### Verification & Testing

**Test 1: Dry Run (See What Would Be Deleted)**

```bash
# Run purge task manually with --dry-run
az acr task run \
  --name purge-old-backend-images \
  --registry risqaiprod \
  --set CMD="acr purge --filter 'app-risqai-backend-prod:.*' --keep 10 --ago 30d --dry-run"

# Review output to see which images would be deleted
```

**Test 2: Verify Task Schedule**

```bash
# List all ACR tasks
az acr task list \
  --registry risqaiprod \
  --output table

# Show task details
az acr task show \
  --name purge-old-backend-images \
  --registry risqaiprod \
  --query "{name:name, status:status, schedule:trigger.timerTriggers[0].schedule}" \
  --output table
```

**Test 3: Manual Task Execution (Test Before Schedule)**

```bash
# Run task immediately to test
az acr task run \
  --name purge-old-backend-images \
  --registry risqaiprod

# Check task run history
az acr task list-runs \
  --registry risqaiprod \
  --output table

# View logs of last run
az acr task logs \
  --registry risqaiprod \
  --run-id {run-id-from-previous-command}
```

**Test 4: Verify Images Deleted**

```bash
# Check image count before and after
az acr repository show-tags \
  --name risqaiprod \
  --repository app-risqai-backend-prod \
  --output json | jq 'length'

# Compare to count before purge
# Should show reduction from 47 → 10 images (or whatever your keep value is)
```

---

### Monitoring

**Weekly Monitoring:**

```bash
# Check storage usage weekly
az acr show-usage \
  --name risqaiprod \
  --output table

# Track storage reduction over time
# Week 1: 2.5 GB
# Week 2: 2.1 GB (savings: 0.4 GB = $0.04/month)
# Week 4: 1.2 GB (savings: 1.3 GB = $0.13/month)
```

**Review Task Execution History:**

```bash
# List recent task runs
az acr task list-runs \
  --registry risqaiprod \
  --top 10 \
  --output table

# Check for failed runs
az acr task list-runs \
  --registry risqaiprod \
  --run-status Failed \
  --output table
```

---

### Troubleshooting

**Problem: Task Fails with "Unauthorized"**

```bash
# Grant ACR task identity permission to delete images
az acr update \
  --name risqaiprod \
  --admin-enabled true

# Or use managed identity
az acr task update \
  --name purge-old-backend-images \
  --registry risqaiprod \
  --assign-identity
```

**Problem: Task Deletes Too Many Images**

```bash
# Disable task immediately
az acr task update \
  --name purge-old-backend-images \
  --registry risqaiprod \
  --status Disabled

# Restore from backup (if you have one)
# Otherwise, rebuild images from git commits

# Fix: Increase --keep value
az acr task update \
  --name purge-old-backend-images \
  --registry risqaiprod \
  --cmd "acr purge --filter 'app-risqai-backend-prod:.*' --keep 20 --ago 60d"
```

---

### Success Metrics

- [ ] ACR tasks created for production and staging
- [ ] Dry run executed successfully (no errors)
- [ ] Storage usage reduced by > 20% after first run
- [ ] Task execution history shows successful runs
- [ ] Protected tags remain intact (stable, v1.x.x)
- [ ] Documentation created for team

---

## Phase 0, Task 4: Verify PostgreSQL Backups

### What This Is

PostgreSQL Flexible Server includes **automated backups** by default. This task verifies that backups are configured correctly, tests the restore process, and documents recovery procedures. Think of it as a fire drill for your database.

### What It Does

- **Automated daily backups** to Azure-managed storage
- **Point-in-time restore (PITR)** to any second within retention period
- **Geo-redundant backup** storage (optional, for disaster recovery)
- **Backup retention** from 7 to 35 days
- **Zero additional cost** for backups within retention period

### Why You Need This

**Disaster scenarios prevented:**
- 🗑️ Accidental `DROP TABLE` → Restore to 5 minutes before disaster
- 🐛 Bad deployment corrupts data → Rollback database to before deployment
- 🔥 Primary database zone fails → Restore to different zone
- 👾 Ransomware encrypts database → Restore from clean backup

**Real-world example:** Developer accidentally runs `DELETE FROM users WHERE true` instead of `WHERE id = 123`. Database backup from 10 minutes ago recovers all user data with zero loss.

### Prerequisites

- [ ] Azure CLI authenticated
- [ ] Contributor or Owner role on PostgreSQL resource
- [ ] Non-production test database or willing to test on staging
- [ ] psql client installed for testing restored database

### Time Estimate

- **Verification:** 1 hour
- **Test restore:** 2-3 hours (mostly waiting for restore)
- **Documentation:** 1 hour
- **Total:** 4-5 hours

### Cost Impact

- **FREE** - Automated backups included with PostgreSQL Flexible Server
- Backup storage within retention period: **No additional charge**
- Geo-redundant backup storage: **+~$5-10/month** (optional)

---

### Implementation Steps

#### Step 1: Verify Backup Configuration

**1.1: Check Current Backup Settings (Production)**

```bash
# Show backup configuration
az postgres flexible-server show \
  --name db-risqai-production \
  --resource-group group-risqai-production \
  --query "{name:name, backupRetentionDays:backup.backupRetentionDays, geoRedundantBackup:backup.geoRedundantBackup, earliestRestoreDate:backup.earliestRestoreDate}" \
  --output table

# Expected output:
# Name                   BackupRetentionDays    GeoRedundantBackup    EarliestRestoreDate
# db-risqai-production   7                      Disabled              2025-10-02T14:30:00Z
```

**1.2: Check Backup Storage Type**

```bash
# Check if geo-redundant backup is enabled
az postgres flexible-server show \
  --name db-risqai-production \
  --resource-group group-risqai-production \
  --query "backup.geoRedundantBackup" \
  --output tsv

# Output: Enabled or Disabled
```

---

#### Step 2: Configure Optimal Backup Settings

**2.1: Increase Backup Retention to 35 Days**

```bash
# Increase retention to maximum (35 days)
az postgres flexible-server update \
  --name db-risqai-production \
  --resource-group group-risqai-production \
  --backup-retention 35

# Verify change
az postgres flexible-server show \
  --name db-risqai-production \
  --resource-group group-risqai-production \
  --query "backup.backupRetentionDays" \
  --output tsv
```

**2.2: Enable Geo-Redundant Backup (Optional, for DR)**

```bash
# Enable geo-redundant backup (can only be set during server creation)
# If not already enabled, requires creating new server with geo-redundancy

# Check if enabled:
az postgres flexible-server show \
  --name db-risqai-production \
  --resource-group group-risqai-production \
  --query "backup.geoRedundantBackup" \
  --output tsv

# If Disabled and you want to enable:
# NOTE: Cannot change after creation. Must create new server with --geo-redundant-backup Enabled
# Plan this for Phase 2 when implementing HA
```

---

#### Step 3: Test Point-in-Time Restore (Staging Environment)

**3.1: Note Current Time (Before Test)**

```bash
# Record current timestamp
RESTORE_POINT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "Restore point: $RESTORE_POINT"

# Example output: 2025-10-09T14:30:00Z
```

**3.2: Make a Controlled Change to Staging Database**

```bash
# Connect to staging database
psql "host=db-risqay-staging.postgres.database.azure.com port=5432 dbname=postgres user=postgres password=YOUR_PASSWORD sslmode=require"

# Create a test table
CREATE TABLE backup_test (
  id SERIAL PRIMARY KEY,
  test_data TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

# Insert test data
INSERT INTO backup_test (test_data) VALUES ('Test data before restore');

# Verify data exists
SELECT * FROM backup_test;

# Exit psql
\q
```

**3.3: Wait 10 Minutes (For Backup to Capture Change)**

```bash
# Backups are captured continuously, but wait to ensure it's in backup
sleep 600  # Wait 10 minutes

# Record new timestamp (after change)
AFTER_CHANGE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "After change: $AFTER_CHANGE"
```

**3.4: Restore Database to Point Before Change**

```bash
# Restore staging database to before the test table was created
# This creates a NEW server, doesn't overwrite existing one

az postgres flexible-server restore \
  --name db-risqay-staging-restored \
  --resource-group group-risqai-staging \
  --source-server db-risqay-staging \
  --restore-time "$RESTORE_POINT"

# This takes 15-30 minutes, be patient
# Monitor progress:
az postgres flexible-server show \
  --name db-risqay-staging-restored \
  --resource-group group-risqai-staging \
  --query "state" \
  --output tsv

# Wait until state is "Ready"
```

**3.5: Verify Restored Data**

```bash
# Connect to restored database
psql "host=db-risqay-staging-restored.postgres.database.azure.com port=5432 dbname=postgres user=postgres password=YOUR_PASSWORD sslmode=require"

# Check if test table exists (it should NOT)
\dt backup_test

# Should show: "Did not find any relation named 'backup_test'"

# This confirms restore worked - data from AFTER restore point is gone

# Exit psql
\q
```

**3.6: Cleanup Test Restore**

```bash
# Delete the restored test server (to avoid extra costs)
az postgres flexible-server delete \
  --name db-risqay-staging-restored \
  --resource-group group-risqai-staging \
  --yes

# Verify deletion
az postgres flexible-server list \
  --resource-group group-risqai-staging \
  --output table
```

---

#### Step 4: Document Restore Procedures

Create file: `docs/disaster-recovery/database-restore-procedures.md`

```markdown
# Database Restore Procedures

## Point-in-Time Restore (PITR)

### When to Use
- Accidental data deletion or corruption
- Rollback after bad deployment
- Recovery from logical errors (not hardware failures)

### Recovery Point Objective (RPO)
- **1 minute** (backups are continuous)

### Recovery Time Objective (RTO)
- **15-30 minutes** for restore completion
- **+5 minutes** for DNS/connection updates
- **Total: ~20-35 minutes**

### Restore Procedure

#### Step 1: Identify Restore Point

\`\`\`bash
# Find the exact time BEFORE the incident
# Example: Bad deployment happened at 2025-10-09 14:30:00 UTC
# Restore to 14:29:00 UTC (1 minute before)

RESTORE_TIME="2025-10-09T14:29:00Z"
\`\`\`

#### Step 2: Verify Restore Point is Within Retention

\`\`\`bash
# Check earliest restore date
az postgres flexible-server show \\
  --name db-risqai-production \\
  --resource-group group-risqai-production \\
  --query "backup.earliestRestoreDate" \\
  --output tsv

# Ensure RESTORE_TIME is after earliestRestoreDate
\`\`\`

#### Step 3: Restore to New Server

\`\`\`bash
# Create restored database (new server)
az postgres flexible-server restore \\
  --name db-risqai-production-restored-$(date +%Y%m%d) \\
  --resource-group group-risqai-production \\
  --source-server db-risqai-production \\
  --restore-time "$RESTORE_TIME"

# Wait 15-30 minutes for restore to complete
\`\`\`

#### Step 4: Verify Restored Data

\`\`\`bash
# Connect to restored database
psql "host=db-risqai-production-restored-YYYYMMDD.postgres.database.azure.com \\
  port=5432 \\
  dbname=postgres \\
  user=postgres \\
  sslmode=require"

# Run verification queries
SELECT COUNT(*) FROM users;  -- Should match expected count
SELECT * FROM orders WHERE created_at > '$RESTORE_TIME';  -- Should be empty

\\q
\`\`\`

#### Step 5: Switch Application to Restored Database

**Option A: Update Connection String (Recommended)**

\`\`\`bash
# Update Container App environment variable
az containerapp update \\
  --name app-risqai-backend-prod \\
  --resource-group group-risqai-production \\
  --set-env-vars DATABASE_URL="postgresql://postgres:PASSWORD@db-risqai-production-restored-YYYYMMDD.postgres.database.azure.com:5432/postgres"

# Restart application
az containerapp revision restart \\
  --name app-risqai-backend-prod \\
  --resource-group group-risqai-production
\`\`\`

**Option B: Rename Servers (More Downtime)**

\`\`\`bash
# Stop application first
az containerapp update \\
  --name app-risqai-backend-prod \\
  --resource-group group-risqai-production \\
  --min-replicas 0 \\
  --max-replicas 0

# Rename old server
az postgres flexible-server update \\
  --name db-risqai-production \\
  --resource-group group-risqai-production \\
  --new-name db-risqai-production-old-$(date +%Y%m%d)

# Rename restored server to production name
az postgres flexible-server update \\
  --name db-risqai-production-restored-YYYYMMDD \\
  --resource-group group-risqai-production \\
  --new-name db-risqai-production

# Restart application
az containerapp update \\
  --name app-risqai-backend-prod \\
  --resource-group group-risqai-production \\
  --min-replicas 2 \\
  --max-replicas 10
\`\`\`

#### Step 6: Verify Application Functions

\`\`\`bash
# Test critical endpoints
curl https://app-risqai-backend-prod.FQDN.eastus.azurecontainerapps.io/health

# Check application logs
az containerapp logs show \\
  --name app-risqai-backend-prod \\
  --resource-group group-risqai-production \\
  --follow
\`\`\`

#### Step 7: Cleanup Old Database

\`\`\`bash
# WAIT 24-48 hours before deleting old database (in case rollback needed)

# After verification period:
az postgres flexible-server delete \\
  --name db-risqai-production-old-YYYYMMDD \\
  --resource-group group-risqai-production \\
  --yes
\`\`\`

## Geo-Restore (Disaster Recovery)

### When to Use
- Primary region is unavailable (Azure outage)
- Regional disaster (earthquake, fire, etc.)
- Compliance requirement for cross-region backups

### Prerequisites
- Geo-redundant backup enabled (set during server creation)
- Secondary region defined (e.g., West US)

### Restore Procedure

\`\`\`bash
# Restore from geo-redundant backup to different region
az postgres flexible-server geo-restore \\
  --name db-risqai-production-dr \\
  --resource-group group-risqai-dr \\
  --source-server /subscriptions/{sub-id}/resourceGroups/group-risqai-production/providers/Microsoft.DBforPostgreSQL/flexibleServers/db-risqai-production \\
  --location westus
\`\`\`

## Monthly Restore Testing

**Schedule:** First Monday of every month

**Checklist:**
- [ ] Document current database size
- [ ] Perform PITR restore to yesterday
- [ ] Verify data integrity
- [ ] Measure RTO (actual restore time)
- [ ] Document any issues
- [ ] Delete test restore
- [ ] Update runbook if procedures changed

## Contact Information

**Incident Commander:** DevOps Lead (devops-lead@risqai.com)
**Database Administrator:** DBA Team (dba@risqai.com)
**Escalation:** CTO (cto@risqai.com)
\`\`\`

---

### Verification Checklist

- [ ] Backup retention set to 35 days (production)
- [ ] Backup retention set to 7-14 days (staging)
- [ ] Earliest restore date is recent (< retention period)
- [ ] Test restore completed successfully
- [ ] Restored data verified for accuracy
- [ ] Restore procedures documented
- [ ] Team trained on restore process
- [ ] Monthly restore testing scheduled

---

### Success Metrics

- **RPO (Recovery Point Objective):** 1 minute
- **RTO (Recovery Time Objective):** 35 minutes
- **Backup retention:** 35 days
- **Test restore success rate:** 100%
- **Team readiness:** All DevOps members trained

---

# Phase 1: Foundational Improvements (Weeks 2-5)

**Goal:** Establish observability, reliability, and performance optimization
**Total Time:** 2-3 weeks
**Total Cost:** +$40-80/month
**Risk Level:** Low to Medium

---

## Phase 1, Task 1: Enable Application Insights

### What This Is

Azure Application Insights is a powerful Application Performance Management (APM) service that automatically instruments your application to collect detailed telemetry data. It's like having X-ray vision into your application's performance, errors, and user behavior.

### What It Does

**Automatic Collection:**
- HTTP request rates, response times, failure rates
- Database query performance and dependencies
- Exception stack traces with code context
- CPU, memory, I/O metrics per request
- Custom events and metrics you define

**Advanced Features:**
- **Distributed tracing:** Follow a request across multiple services
- **Live metrics:** Real-time performance dashboard
- **Smart detection:** AI-powered anomaly detection
- **Application map:** Visualize service dependencies
- **Usage analytics:** Track feature usage and user flows

**Integration:**
- Works seamlessly with Azure Monitor
- Alerts on performance degradation
- Integrates with Log Analytics for deep querying

### Why You Need This

**Before Application Insights:**
- 😰 "API is slow" → Which endpoint? Which query? Which user?
- 🐛 User reports error → No stack trace, can't reproduce
- 📊 "How many users hit this endpoint?" → No idea
- ⏱️ "Why is this page slow?" → Check every service manually

**After Application Insights:**
- ✅ "API /api/analyze is slow" → See database query taking 5 seconds → Optimize query
- ✅ Exception logged with full stack trace → Fix bug in 10 minutes instead of 2 hours
- ✅ Dashboard shows 10,000 requests/day to /api/analyze → Plan capacity
- ✅ See that 80% of time is spent in OpenAI API call → Add caching layer

**Real-world impact:**
- Reduced MTTR (Mean Time To Resolution) by 70%
- Identified and fixed performance issues before users noticed
- Optimized slow endpoints, improving user satisfaction
- Provided data-driven insights for product decisions

### Prerequisites

- [ ] Node.js application (backend is Node.js 20)
- [ ] Azure CLI authenticated
- [ ] Access to modify backend code
- [ ] Ability to redeploy application

### Time Estimate

- **Day 1:** Setup Application Insights resource, integrate SDK (4 hours)
- **Day 2:** Configure custom metrics and testing (4 hours)
- **Day 3:** Create dashboards and documentation (3 hours)
- **Total:** 2-3 days

### Cost Impact

- **Free tier:** 5 GB/month included
- **Overage:** $2.30/GB/month
- **Typical usage for this app:** 1-3 GB/month
- **Estimated cost:** $10-30/month (likely free tier)

---

### Implementation Steps

#### Step 1: Create Application Insights Resource

**1.1: Create Application Insights in Azure**

```bash
# Create Application Insights resource
az monitor app-insights component create \
  --app app-insights-risqai-prod \
  --location eastus \
  --resource-group group-risqai-production \
  --application-type Node.JS \
  --retention-time 90

# Get connection string (save this!)
az monitor app-insights component show \
  --app app-insights-risqai-prod \
  --resource-group group-risqai-production \
  --query "connectionString" \
  --output tsv

# Output: InstrumentationKey=XXXX;IngestionEndpoint=https://....;LiveEndpoint=https://...

# Also get instrumentation key (legacy, but some SDKs still use it)
az monitor app-insights component show \
  --app app-insights-risqai-prod \
  --resource-group group-risqai-production \
  --query "instrumentationKey" \
  --output tsv
```

**1.2: Store Connection String in Azure Key Vault**

```bash
# Add connection string to Key Vault (secure storage)
az keyvault secret set \
  --vault-name risqai-keyv-production \
  --name APPLICATION-INSIGHTS-CONNECTION-STRING \
  --value "InstrumentationKey=XXXX;IngestionEndpoint=https://....;LiveEndpoint=https://..."

# Verify stored
az keyvault secret show \
  --vault-name risqai-keyv-production \
  --name APPLICATION-INSIGHTS-CONNECTION-STRING \
  --query "value" \
  --output tsv
```

---

#### Step 2: Integrate Application Insights SDK into Backend

**2.1: Install Application Insights Package**

```bash
# Navigate to backend directory
cd backend

# Install Application Insights SDK
npm install applicationinsights@^2.9.0

# Update package.json
npm install --save applicationinsights
```

**2.2: Create Application Insights Configuration File**

Create file: `backend/config/applicationInsights.ts`

```typescript
import * as appInsights from 'applicationinsights';

/**
 * Initialize Application Insights for telemetry collection
 *
 * This must be called BEFORE any other imports to ensure
 * automatic instrumentation captures all dependencies
 */
export function initializeApplicationInsights() {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

  if (!connectionString) {
    console.warn('⚠️  Application Insights connection string not found. Telemetry disabled.');
    return null;
  }

  // Configure Application Insights
  appInsights.setup(connectionString)
    .setAutoDependencyCorrelation(true)    // Link requests across services
    .setAutoCollectRequests(true)          // Collect HTTP requests
    .setAutoCollectPerformance(true, true) // Collect CPU, memory, etc.
    .setAutoCollectExceptions(true)        // Collect unhandled exceptions
    .setAutoCollectDependencies(true)      // Collect database, HTTP calls
    .setAutoCollectConsole(true)           // Collect console.log statements
    .setUseDiskRetriesForTransientFailures(true) // Retry on network issues
    .setSendLiveMetrics(true)              // Enable Live Metrics dashboard
    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C);

  // Start Application Insights
  appInsights.start();

  console.log('✅ Application Insights initialized successfully');

  return appInsights.defaultClient;
}

/**
 * Get the Application Insights client for custom telemetry
 */
export function getAppInsightsClient() {
  return appInsights.defaultClient;
}
```

**2.3: Initialize Application Insights in Entry Point**

Edit file: `backend/index.ts`

```typescript
// ⚠️ IMPORTANT: Application Insights MUST be initialized FIRST
// This ensures automatic instrumentation captures all dependencies
import { initializeApplicationInsights } from './config/applicationInsights';

const appInsightsClient = initializeApplicationInsights();

// NOW import everything else
import express from 'express';
import dotenv from 'dotenv';
import { router } from './router';
// ... rest of imports

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use('/api', router);

// Health check endpoint (exclude from Application Insights)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    appInsights: appInsightsClient ? 'enabled' : 'disabled'
  });
});

// Error handler (Application Insights will automatically capture these)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);

  // Track error in Application Insights with context
  if (appInsightsClient) {
    appInsightsClient.trackException({
      exception: err,
      properties: {
        url: req.url,
        method: req.method,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });
  }

  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  if (appInsightsClient) {
    console.log('📊 Application Insights is collecting telemetry');
  }
});
```

---

#### Step 3: Add Custom Metrics and Events

**3.1: Track Custom Business Metrics**

Create file: `backend/middleware/telemetryMiddleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { getAppInsightsClient } from '../config/applicationInsights';

/**
 * Middleware to track custom business metrics
 */
export function telemetryMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const client = getAppInsightsClient();

  // Capture response completion
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    if (client) {
      // Track custom metric: API response time
      client.trackMetric({
        name: 'API_Response_Time',
        value: duration,
        properties: {
          endpoint: req.path,
          method: req.method,
          statusCode: res.statusCode.toString()
        }
      });

      // Track custom event for important operations
      if (req.path.includes('/analyze')) {
        client.trackEvent({
          name: 'Article_Analysis_Request',
          properties: {
            url: req.body?.url || 'unknown',
            duration: duration.toString(),
            success: res.statusCode < 400
          }
        });
      }

      // Track metrics for errors
      if (res.statusCode >= 400) {
        client.trackMetric({
          name: 'API_Error_Rate',
          value: 1,
          properties: {
            endpoint: req.path,
            statusCode: res.statusCode.toString()
          }
        });
      }
    }
  });

  next();
}
```

**3.2: Add Telemetry to Critical Functions**

Edit file: `backend/services/articleAnalysis.ts` (example)

```typescript
import { getAppInsightsClient } from '../config/applicationInsights';

export async function analyzeArticle(url: string, content: string) {
  const client = getAppInsightsClient();
  const startTime = Date.now();

  try {
    // Track dependency: External API call
    const dependencyStartTime = Date.now();

    const result = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: `Analyze this article: ${content}` }]
    });

    // Track OpenAI API call duration
    if (client) {
      client.trackDependency({
        dependencyTypeName: 'OpenAI API',
        name: 'chat.completions.create',
        data: 'gpt-4 analysis',
        duration: Date.now() - dependencyStartTime,
        success: true,
        resultCode: 200
      });

      // Track custom metric: Tokens used
      client.trackMetric({
        name: 'OpenAI_Tokens_Used',
        value: result.usage?.total_tokens || 0,
        properties: {
          model: 'gpt-4'
        }
      });
    }

    return result;
  } catch (error) {
    // Track failed dependency
    if (client) {
      client.trackDependency({
        dependencyTypeName: 'OpenAI API',
        name: 'chat.completions.create',
        data: 'gpt-4 analysis',
        duration: Date.now() - dependencyStartTime,
        success: false,
        resultCode: 500
      });

      client.trackException({
        exception: error as Error,
        properties: {
          operation: 'analyzeArticle',
          url: url
        }
      });
    }

    throw error;
  } finally {
    // Track total operation time
    if (client) {
      client.trackMetric({
        name: 'Article_Analysis_Duration',
        value: Date.now() - startTime,
        properties: {
          url: url
        }
      });
    }
  }
}
```

---

#### Step 4: Configure Environment Variables

**4.1: Add to Local Development Environment**

Edit file: `backend/.env.local`

```bash
# Application Insights
APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=XXXX;IngestionEndpoint=https://..."
```

**4.2: Add to Azure Container App**

```bash
# Update Container App with Application Insights connection string
az containerapp update \
  --name app-risqai-backend-prod \
  --resource-group group-risqai-production \
  --set-env-vars APPLICATIONINSIGHTS_CONNECTION_STRING=secretref:appinsights-connection

# Add secret to Container App
az containerapp secret set \
  --name app-risqai-backend-prod \
  --resource-group group-risqai-production \
  --secrets appinsights-connection="InstrumentationKey=XXXX;..."
```

**4.3: Update GitHub Actions Workflow**

Edit file: `.github/workflows/app-risqai-backend-prod-AutoDeployTrigger.yml`

```yaml
# Add step to retrieve Application Insights connection string from Key Vault
- name: Get Application Insights Connection String
  run: |
    echo "APPINSIGHTS_CONNECTION=$(az keyvault secret show --vault-name risqai-keyv-production --name APPLICATION-INSIGHTS-CONNECTION-STRING --query value -o tsv)" >> $GITHUB_ENV

# Update Container App deployment to include environment variable
- name: Deploy to Azure Container Apps
  uses: azure/container-apps-deploy-action@v2
  with:
    containerAppName: app-risqai-backend-prod
    resourceGroup: group-risqai-production
    imageToDeploy: risqaiprod.azurecr.io/app-risqai-backend-prod:${{ github.sha }}
    environmentVariables: |
      APPLICATIONINSIGHTS_CONNECTION_STRING=secretref:appinsights-connection
```

---

#### Step 5: Deploy and Verify

**5.1: Test Locally**

```bash
# Start backend locally
cd backend
npm run dev

# Make test requests
curl http://localhost:8080/health
curl http://localhost:8080/api/analyze -X POST -H "Content-Type: application/json" -d '{"url":"https://example.com"}'

# Check console output for Application Insights messages
```

**5.2: Deploy to Staging First**

```bash
# Commit changes
git add backend/config/applicationInsights.ts backend/index.ts backend/middleware/telemetryMiddleware.ts
git commit -m "feat: integrate Application Insights for observability"
git push origin staging

# Wait for staging deployment
# Test staging environment
curl https://app-risqai-backend.STAGING_FQDN.eastus.azurecontainerapps.io/health
```

**5.3: Deploy to Production**

```bash
# Merge to master
git checkout master
git merge staging
git push origin master

# Monitor deployment
az containerapp revision list \
  --name app-risqai-backend-prod \
  --resource-group group-risqai-production \
  --output table
```

---

#### Step 6: Verify Telemetry Collection

**6.1: Check Application Insights Portal**

Navigate to Azure Portal → Application Insights → app-insights-risqai-prod

**Check these tabs:**
1. **Live Metrics:** Should see real-time requests within 1-2 minutes
2. **Failures:** Any errors/exceptions will appear here
3. **Performance:** API response times and dependencies
4. **Application Map:** Visual diagram of your services

**6.2: Query Telemetry Data**

Navigate to: Application Insights → Logs

**Query 1: Request Rate Over Time**

```kusto
requests
| where timestamp > ago(1h)
| summarize RequestCount = count() by bin(timestamp, 5m)
| render timechart
```

**Query 2: Slowest API Endpoints**

```kusto
requests
| where timestamp > ago(24h)
| summarize avg(duration), percentile(duration, 95), percentile(duration, 99) by name
| order by avg_duration desc
| take 10
```

**Query 3: Error Rate**

```kusto
requests
| where timestamp > ago(1h)
| summarize TotalRequests = count(), FailedRequests = countif(success == false)
| extend ErrorRate = (FailedRequests * 100.0) / TotalRequests
| project ErrorRate, TotalRequests, FailedRequests
```

**Query 4: OpenAI API Performance**

```kusto
dependencies
| where type == "OpenAI API"
| summarize avg(duration), count() by name
| order by avg_duration desc
```

---

#### Step 7: Create Application Insights Dashboards

**7.1: Create Performance Dashboard**

Azure Portal → Dashboards → New Dashboard → "RisqAI Performance"

Add tiles:
1. **Request Rate:** Line chart of requests/minute
2. **Response Time (P95):** 95th percentile response time
3. **Error Rate:** Percentage of failed requests
4. **OpenAI Token Usage:** Custom metric we tracked
5. **Database Query Performance:** Dependency duration

**7.2: Create Business Metrics Dashboard**

Add tiles:
1. **Article Analysis Requests:** Custom event count
2. **User Sessions:** Unique users per day
3. **Feature Usage:** Most popular API endpoints
4. **Geographic Distribution:** User locations

---

### Monitoring & Alerts

**Create Application Insights Alerts:**

```bash
# Alert: Response time > 2 seconds
az monitor metrics alert create \
  --name alert-appinsights-slow-response \
  --resource-group group-risqai-production \
  --scopes /subscriptions/{sub-id}/resourceGroups/group-risqai-production/providers/Microsoft.Insights/components/app-insights-risqai-prod \
  --condition "avg requests/duration > 2000" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action ag-risqai-email-critical \
  --description "API response time exceeded 2 seconds" \
  --severity 2

# Alert: Error rate > 5%
az monitor metrics alert create \
  --name alert-appinsights-error-rate \
  --resource-group group-risqai-production \
  --scopes /subscriptions/{sub-id}/resourceGroups/group-risqai-production/providers/Microsoft.Insights/components/app-insights-risqai-prod \
  --condition "avg requests/failed > 5" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action ag-risqai-email-critical \
  --action ag-risqai-sms-critical \
  --description "API error rate exceeded 5%" \
  --severity 1
```

---

### Success Metrics

- [ ] Application Insights resource created
- [ ] SDK integrated and deployed to production
- [ ] Live Metrics showing data within 5 minutes
- [ ] Custom metrics and events tracked
- [ ] Dashboards created and shared with team
- [ ] Alerts configured for performance and errors
- [ ] Team trained on querying telemetry data
- [ ] Documentation completed

---

### Troubleshooting

**Problem: No data appearing in Application Insights**

```bash
# Check connection string is correct
echo $APPLICATIONINSIGHTS_CONNECTION_STRING

# Check application logs for errors
az containerapp logs show \
  --name app-risqai-backend-prod \
  --resource-group group-risqai-production \
  --follow | grep -i "application insights"

# Verify environment variable in container
az containerapp show \
  --name app-risqai-backend-prod \
  --resource-group group-risqai-production \
  --query "properties.template.containers[0].env" \
  --output json | jq '.[] | select(.name=="APPLICATIONINSIGHTS_CONNECTION_STRING")'
```

**Problem: Performance overhead too high**

```bash
# Reduce sampling (send only 50% of telemetry)
# Add to applicationInsights.ts:
appInsights.defaultClient.config.samplingPercentage = 50;
```

---

Due to length constraints, I'll continue the detailed implementation guide for the remaining tasks in the next response. This guide covers the comprehensive approach for each task with real code examples, verification steps, and troubleshooting.
