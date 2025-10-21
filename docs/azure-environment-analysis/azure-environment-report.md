# Azure Environment Analysis Report

**Organization:** Altair Integrated Services
**Report Generated:** October 14, 2025
**Prepared For:** Azure Managed Services Provider Evaluation
**Azure Subscription:** Azure subscription 1
**Subscription ID:** [REDACTED]

---

## Summary

### Environment Overview

| Category | Details |
|----------|---------|
| **Subscription** | Azure subscription 1 (Altair Integrated Services) |
| **Regions** | East US (backend/database), East US 2 (frontend) |
| **Architecture** | Full-stack cloud-native - Backend (Container Apps) + Frontend (Static Web Apps) |
| **Environments** | 2 (Staging + Production) |
| **Resource Groups** | 3 |

### Resource Inventory

| Resource Type | Count | Details |
|---------------|-------|---------|
| Virtual Machines | 0 | None - fully cloud-native architecture |
| Container Apps | 2 | Staging + Production backends |
| Static Web Apps | 3 | Staging + Production frontends + Landing page |
| Container Registries | 2 | Standard tier |
| PostgreSQL Databases | 2 | Flexible Server v17 |
| Storage Accounts | 0 | None - using DB storage |
| Key Vaults | 2 | Secret management |
| Log Analytics Workspaces | 2 | Monitoring & logging |

### Compute Capacity

| Environment | CPU (per replica) | Memory (per replica) | Replicas | Status |
|-------------|-------------------|----------------------|----------|---------|
| Staging | 3 cores | 6 GiB | 1-10 | Running |
| Production | 0.5 cores | 1 GiB | 1-10 | Running |

### Storage Capacity

- **Database:** 64 GB total (32 GB × 2)
- **Ephemeral:** Up to 100 GiB (scaled across replicas)
- **Images:** ~2-5 GB (container registry)

### Key Technologies

- **Backend Compute:** Azure Container Apps (serverless containers)
- **Frontend Hosting:** Azure Static Web Apps (serverless)
- **Database:** PostgreSQL 17 Flexible Server
- **Security:** Azure Key Vault, Managed Identities, Auto SSL
- **Monitoring:** Log Analytics, Azure Monitor
- **Networking:** Public endpoints, custom domains, SSL/TLS, Global CDN
- **CI/CD:** Azure Container Registry + GitHub Actions

### Monthly Service Hours
- **Container Apps:** 24/7 operation with auto-scaling
- **Databases:** 24/7 availability
- **Static Web Apps:** 24/7 globally distributed hosting
- **Regions:** East US + East US 2

---

## 1. Virtual Machines & Compute Resources

### Virtual Machines
**Answer: The organization does NOT use traditional virtual machines.**

The infrastructure is entirely containerized using Azure Container Apps, which provides:
- Automatic scaling based on demand
- Pay-per-use pricing model
- No VM management overhead
- Container orchestration without Kubernetes complexity

### Azure Container Apps (Serverless Containers)

The application uses **2 Azure Container Apps** for the backend services:

#### Staging Environment
- **Name:** app-risqai-backend
- **Resource Group:** group-risqai-staging
- **FQDN:** [REDACTED - Custom Domain]
- **Container Resources:**
  - CPU: 3 cores per container
  - Memory: 6 GiB per container
  - Ephemeral Storage: 8 GiB per container
- **Scaling Configuration:**
  - Minimum Replicas: 1
  - Maximum Replicas: 10
  - Auto-scale enabled
- **Runtime:** Node.js backend application
- **Port:** 3000
- **Status:** Running
- **Created:** August 12, 2025
- **Last Modified:** October 10, 2025

**Features:**
- System-assigned managed identity
- SSL/TLS with custom domain
- Integration with Azure Container Registry
- Environment variables for configuration
- Secret management for sensitive data

#### Production Environment
- **Name:** app-risqai-backend-prod
- **Resource Group:** group-risqai-production
- **FQDN:** [REDACTED - Custom Domain]
- **Container Resources:**
  - CPU: 0.5 cores per container
  - Memory: 1 GiB per container
  - Ephemeral Storage: 2 GiB per container
- **Scaling Configuration:**
  - Minimum Replicas: 1
  - Maximum Replicas: 10
  - Auto-scale enabled
- **Runtime:** Node.js backend application
- **Port:** 3000
- **Status:** Running
- **Created:** August 26, 2025
- **Last Modified:** October 2, 2025

**Features:**
- System-assigned managed identity
- SSL/TLS with custom domain
- Integration with Azure Container Registry
- Environment variables for configuration
- Secret management for sensitive data

### Compute Summary Table

| Environment | Container App | CPU | Memory | Storage | Min Replicas | Max Replicas | Status |
|-------------|---------------|-----|---------|---------|--------------|--------------|---------|
| Staging | app-risqai-backend | 3 cores | 6 GiB | 8 GiB | 1 | 10 | Running |
| Production | app-risqai-backend-prod | 0.5 cores | 1 GiB | 2 GiB | 1 | 10 | Running |

**Total Potential Compute:**
- Staging: Up to 30 CPU cores and 60 GiB memory (at max scale)
- Production: Up to 5 CPU cores and 10 GiB memory (at max scale)

### Azure Static Web Apps (Frontend)

The application uses **3 Azure Static Web Apps** for frontend hosting:

#### Staging Frontend
- **Name:** frontend-risqai-staging
- **Resource Group:** group-risqai-staging
- **Location:** East US 2
- **SKU:** Standard
- **Default Hostname:** [REDACTED].azurestaticapps.net
- **Custom Domains:** [REDACTED]
- **GitHub Integration:** Connected to repository (staging branch)
- **CDN Status:** Enterprise-grade CDN disabled
- **Created:** August 13, 2025
- **Status:** Succeeded

#### Production Frontend (App)
- **Name:** frontend-risqai-production
- **Resource Group:** group-risqai-production
- **Location:** East US 2
- **SKU:** Standard
- **Default Hostname:** [REDACTED].azurestaticapps.net
- **Custom Domains:** [REDACTED], [REDACTED]
- **GitHub Integration:** Connected to repository (master branch)
- **CDN Status:** Enterprise-grade CDN disabled
- **Created:** August 27, 2025
- **Status:** Succeeded

#### Production Frontend (Landing Page)
- **Name:** landing-page-prod
- **Resource Group:** group-risqai-production
- **Location:** East US 2
- **SKU:** Standard
- **Default Hostname:** [REDACTED].azurestaticapps.net
- **Custom Domains:** [REDACTED], [REDACTED]
- **GitHub Integration:** Connected to separate repository (main branch)
- **CDN Status:** Enterprise-grade CDN disabled
- **Staging Environment Policy:** Enabled
- **Created:** August 27, 2025
- **Status:** Succeeded

**Static Web Apps Features:**
- Globally distributed static content
- Built-in CI/CD from GitHub
- Automatic HTTPS/SSL for custom domains
- Free SSL certificates
- GitHub Actions for deployment
- Preview environments (landing page)

---

## 2. Container Infrastructure

### Azure Container Registry

The environment uses **2 Azure Container Registries** to store and manage container images:

#### Staging Registry
- **Name:** [REDACTED]
- **Login Server:** [REDACTED].azurecr.io
- **SKU:** Standard
- **Location:** East US
- **Admin User:** Enabled
- **Public Network Access:** Enabled
- **Image Retention:** 7 days (currently disabled)
- **Created:** August 12, 2025
- **Status:** Succeeded

#### Production Registry
- **Name:** [REDACTED]
- **Login Server:** [REDACTED].azurecr.io
- **SKU:** Standard
- **Location:** East US
- **Admin User:** Enabled
- **Public Network Access:** Enabled
- **Image Retention:** 7 days (currently disabled)
- **Created:** August 26, 2025
- **Status:** Succeeded

**Container Registry Features:**
- Azure AD authentication enabled
- Export policy enabled
- Quarantine policy: Disabled
- Geo-replication: Not configured
- Zone redundancy: Disabled

### Managed Environments

Both container apps run in Azure Container Apps Managed Environments:

#### Staging Environment
- **Name:** [REDACTED]
- **Domain Suffix:** [REDACTED].eastus.azurecontainerapps.io
- **Identity:** System-assigned

#### Production Environment
- **Name:** [REDACTED]
- **Domain Suffix:** [REDACTED].eastus.azurecontainerapps.io
- **Identity:** System-assigned

---

## 3. Database Services

### PostgreSQL Flexible Server

The application uses **2 PostgreSQL Flexible Server instances** for database services:

#### Staging Database
- **Name:** [REDACTED]
- **FQDN:** [REDACTED].postgres.database.azure.com
- **Resource Group:** group-risqai-staging
- **PostgreSQL Version:** 17.5
- **SKU:** Standard_B2s (Burstable tier)
- **vCores:** 2
- **Storage:** 32 GB
- **Storage Auto-Grow:** Disabled
- **IOPS:** 120
- **Availability Zone:** 1
- **High Availability:** Disabled
- **State:** Ready
- **Created:** August 12, 2025

**Backup Configuration:**
- Retention Period: 7 days
- Geo-Redundant Backup: Disabled
- Earliest Restore Date: October 7, 2025

**Security:**
- Administrator: [REDACTED]
- Password Authentication: Enabled
- Active Directory Auth: Disabled
- Public Network Access: Enabled
- SSL Mode: Required

#### Production Database
- **Name:** [REDACTED]
- **FQDN:** [REDACTED].postgres.database.azure.com
- **Resource Group:** group-risqai-production
- **PostgreSQL Version:** 17.5
- **SKU:** Standard_D2ds_v5 (General Purpose tier)
- **vCores:** 2
- **Storage:** 32 GB
- **Storage Auto-Grow:** Enabled
- **IOPS:** 120
- **Availability Zone:** 1
- **High Availability:** Disabled
- **State:** Ready
- **Created:** August 26, 2025

**Backup Configuration:**
- Retention Period: 7 days
- Geo-Redundant Backup: Disabled
- Earliest Restore Date: October 8, 2025

**Security:**
- Administrator: [REDACTED]
- Password Authentication: Enabled
- Active Directory Auth: Disabled
- Public Network Access: Enabled
- SSL Mode: Required

### Database Summary Table

| Environment | Server Name | SKU | vCores | Storage | Auto-Grow | HA | Backup Retention | Status |
|-------------|-------------|-----|---------|---------|-----------|----|-----------------:|--------|
| Staging | [REDACTED] | Standard_B2s (Burstable) | 2 | 32 GB | No | No | 7 days | Ready |
| Production | [REDACTED] | Standard_D2ds_v5 (General Purpose) | 2 | 32 GB | Yes | No | 7 days | Ready |

**Total Database Storage:** 64 GB

---

## 4. Storage Requirements Summary

### Database Storage
- **Staging Database:** 32 GB (PostgreSQL)
- **Production Database:** 32 GB (PostgreSQL)
- **Total Persistent Storage:** 64 GB

### Container Ephemeral Storage
- **Staging Container:** 8 GiB per replica (max 10 replicas = 80 GiB potential)
- **Production Container:** 2 GiB per replica (max 10 replicas = 20 GiB potential)

### Storage Accounts
**Note:** No standalone Azure Storage Accounts detected. The application uses:
- Database storage for persistent data
- Container ephemeral storage for temporary files
- Container registries for image storage

### Storage Growth Considerations
- **Production database** has auto-grow enabled (can expand beyond 32 GB as needed)
- **Staging database** has auto-grow disabled (manual intervention required if limit reached)

---

## 5. Security & Secrets Management

### Azure Key Vault

The environment uses **2 Key Vault instances** for secure secrets management:

#### Staging Key Vault
- **Name:** [REDACTED]
- **Resource Group:** group-risqai-staging
- **Location:** East US
- **Purpose:** Stores encryption keys and sensitive configuration for staging environment

**Integrated Keys:**
- encryption-key (referenced by container apps)

#### Production Key Vault
- **Name:** [REDACTED]
- **Resource Group:** group-risqai-production
- **Location:** East US
- **Purpose:** Stores encryption keys and sensitive configuration for production environment

**Integrated Keys:**
- encryption-key (referenced by container apps)

### Managed Identities

**System-Assigned Identities** (Automatically managed by Azure):
- Staging Container App: `[REDACTED]`
- Production Container App: `[REDACTED]`

These identities provide secure, credential-free access to:
- Azure Container Registry
- Azure Key Vault
- Other Azure services

### Secrets Management

Container apps use Azure-managed secrets for:
- Database connection strings
- Authentication credentials (Auth0)
- API keys (OpenAI, SendGrid)
- JWT secrets
- CSRF tokens
- Encryption keys

**Security Note:** All sensitive credentials are stored as container app secrets or Key Vault entries, not in environment variables in plain text.

### SSL/TLS Certificates

**Staging:**
- Custom Domain: [REDACTED]
- Certificate: Managed by Azure Container Apps
- Binding: SNI Enabled

**Production:**
- Custom Domain: [REDACTED]
- Certificate: Managed by Azure Container Apps
- Binding: SNI Enabled

---

## 6. Monitoring & Logging

### Log Analytics Workspaces

The environment uses **2 Log Analytics Workspaces** for centralized logging and monitoring:

#### Staging Workspace
- **Name:** [REDACTED]
- **Resource Group:** group-risqai-staging
- **Location:** East US
- **Customer ID:** [REDACTED]
- **Pricing Tier:** Pay-as-you-go (PerGB2018)
- **Data Retention:** 30 days
- **Daily Quota:** Unlimited (-1.0 GB)
- **Created:** August 12, 2025
- **Status:** Succeeded

#### Production Workspace
- **Name:** [REDACTED]
- **Resource Group:** group-risqai-production
- **Location:** East US
- **Customer ID:** [REDACTED]
- **Pricing Tier:** Pay-as-you-go (PerGB2018)
- **Data Retention:** 30 days
- **Daily Quota:** Unlimited (-1.0 GB)
- **Created:** August 26, 2025
- **Status:** Succeeded

### Monitoring Features

- **Container App Logs:** Captured in Log Analytics
- **Database Metrics:** Available through PostgreSQL insights
- **Public Network Access:** Enabled for both ingestion and query
- **Data Ingestion Status:** Active (RespectQuota)

### Additional Monitoring Resource
- **Resource Group:** LogAnalyticsDefaultResources (East US)
- Purpose: Azure-managed logging infrastructure

---

## 7. Networking

### Network Architecture

The application uses **public networking** with the following configuration:

#### Virtual Networks
**Note:** No custom Virtual Networks (VNets) detected. Container apps and databases use Azure-managed networking with public endpoints.

### Custom Domains

#### Staging
- **Application Domain:** [REDACTED]
- **Container App FQDN:** [REDACTED].eastus.azurecontainerapps.io

#### Production
- **Application Domain:** [REDACTED]
- **Container App FQDN:** [REDACTED].eastus.azurecontainerapps.io

### Outbound IP Addresses

Both container apps share a pool of approximately 96 outbound IP addresses for external communications.

**Use Case:** These IPs can be provided to external services for firewall whitelisting when the application needs to make outbound connections. (Specific IPs redacted from this report but available upon request.)

### Database Network Access
- **Staging Database:** Public access enabled (port 5432)
- **Production Database:** Public access enabled (port 5432)
- **SSL/TLS:** Required for all database connections

### Network Security Considerations

**Current State:**
- Public endpoints for all services
- No private networking (VNet integration)
- No network security groups (NSGs) configured
- SSL/TLS encryption for all connections

**Recommendations for Managed Services Provider:**
Consider discussing:
- VNet integration for private connectivity
- Azure Firewall or Network Security Groups
- Private endpoints for databases
- Azure Front Door or Application Gateway for WAF capabilities

---

## Appendix A: Resource Details

### Container App Specifications

#### Staging Container App
- **ID:** [REDACTED - Full Azure Resource ID]
- **Revision Mode:** Single
- **Workload Profile:** Consumption
- **Latest Revision:** [REDACTED]
- **Custom Domain Verification ID:** [REDACTED]

#### Production Container App
- **ID:** [REDACTED - Full Azure Resource ID]
- **Revision Mode:** Single
- **Workload Profile:** Consumption
- **Latest Revision:** [REDACTED]
- **Custom Domain Verification ID:** [REDACTED]

### Database Specifications

#### Staging Database
- **ID:** [REDACTED - Full Azure Resource ID]
- **Maintenance Window:** Sunday 00:00 UTC
- **Replica Capacity:** 5

#### Production Database
- **ID:** [REDACTED - Full Azure Resource ID]
- **Maintenance Window:** Sunday 00:00 UTC
- **Replica Capacity:** 5

---

## Appendix C: Contact Information

### Azure Subscription
- **Tenant:** Altair Integrated Services
- **Domain:** Altairtek.com
- **Primary Contact:** [Contact details available upon request]
- **Tenant ID:** [REDACTED]

### Application Domains
- **Staging:** [REDACTED]
- **Production:** [REDACTED]

---

## Document Control

- **Report Version:** 1.0
- **Generated:** October 14, 2025
- **Generated By:** Azure CLI automated analysis
- **Data Source:** Azure Resource Manager
- **Sensitive Data:** All credentials, keys, and secrets redacted
- **Validity:** Current as of generation date

---

**End of Report**

*This report is intended for evaluation by Azure Managed Services providers. All sensitive information including passwords, connection strings, API keys, and secrets have been redacted and marked as [REDACTED].*
