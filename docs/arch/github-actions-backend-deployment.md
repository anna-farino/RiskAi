# Backend Deployment GitHub Actions Documentation

## Overview

This document explains the GitHub Actions workflows that handle automatic backend deployment to Azure Container Apps for both staging and production environments.

## Workflows

1. **Staging**: `staging_backend-22.yml` - Deploys to staging environment
2. **Production**: `app-risqai-backend-prod-AutoDeployTrigger-5b42ba62-8b2b-45cd-997a-6613cdb8a5e9.yml` - Deploys to production environment

Both workflows follow the same pattern and have been standardized to ensure consistency between environments.

---

## Staging Workflow: `staging_backend-22.yml`

### Line-by-Line Explanation

```yaml
name: Backend – Build & Deploy (ACA)
```
**Line 1**: Workflow name displayed in GitHub Actions UI. "ACA" stands for Azure Container Apps.

---

```yaml
on:
  push:
    branches:
      - staging
```
**Lines 3-6**: Trigger conditions. This workflow runs automatically when code is pushed to the `staging` branch.

---

```yaml
    paths:
    - '**'
    - '.github/workflows/staging_backend-22.yml'
```
**Lines 7-9**: Path filters. The workflow only triggers if:
- ANY file changes (`'**'` matches all files)
- OR the workflow file itself changes

**Note**: This prevents empty commits from triggering deployment.

---

```yaml
  workflow_dispatch:
```
**Line 10**: Allows manual triggering of the workflow from GitHub Actions UI.

---

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
```
**Lines 12-14**: Defines the deployment job that runs on the latest Ubuntu runner.

---

```yaml
    permissions:
      id-token: write
      contents: read
```
**Lines 15-17**: Grants permissions needed for:
- `id-token: write` - Required for OpenID Connect (OIDC) authentication with Azure
- `contents: read` - Allows reading repository contents

---

```yaml
    environment: ${{ github.ref_name == 'main' && 'production' || github.ref_name == 'staging' && 'staging' || 'development' }}
```
**Line 18**: Dynamic environment selection based on branch name:
- If branch is `main` → uses `production` environment
- If branch is `staging` → uses `staging` environment
- Otherwise → uses `development` environment

This determines which environment's secrets and variables are available.

---

```yaml
    concurrency:
      group: backend-${{ github.ref_name }}
      cancel-in-progress: false
```
**Lines 19-21**: Concurrency control:
- `group: backend-${{ github.ref_name }}` - Creates a concurrency group per branch
- `cancel-in-progress: false` - Prevents canceling running deployments when new ones start

This ensures deployments complete sequentially and aren't interrupted.

---

```yaml
    env:
      REGISTRY_LOGIN_SERVER: ${{ vars.REGISTRY_LOGIN_SERVER }}
      IMAGE_NAME:            ${{ vars.IMAGE_NAME }}
      RESOURCE_GROUP:        ${{ vars.RESOURCE_GROUP }}
      CONTAINER_APP_NAME:    ${{ vars.CONTAINER_APP_NAME }}
```
**Lines 22-26**: Environment variables loaded from GitHub environment variables:
- `REGISTRY_LOGIN_SERVER` - Azure Container Registry URL (e.g., `risqaistg-dgdydvdyftghfra2.azurecr.io`)
- `IMAGE_NAME` - Docker image name (e.g., `xxxxxx`)
- `RESOURCE_GROUP` - Azure resource group name (e.g., `group-risqai-staging`)
- `CONTAINER_APP_NAME` - Azure Container App name (e.g., `app-risqai-backend`)

These are environment-specific and automatically loaded based on the environment selected in line 18.

---

```yaml
    steps:
      - uses: actions/checkout@v4
```
**Lines 28-29**: Checks out the repository code using GitHub's official checkout action (version 4).

---

```yaml
      - uses: azure/login@v2
        with:
          client-id:       ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id:       ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```
**Lines 31-35**: Authenticates with Azure using OIDC (OpenID Connect):
- `AZURE_CLIENT_ID` - Service principal client ID
- `AZURE_TENANT_ID` - Azure Active Directory tenant ID
- `AZURE_SUBSCRIPTION_ID` - Azure subscription ID

These secrets are stored in the GitHub environment and provide passwordless authentication to Azure.

---

```yaml
      - name: Build Docker image
        run: docker build -t "$REGISTRY_LOGIN_SERVER/$IMAGE_NAME:${{ github.sha }}" .
```
**Lines 37-38**: Builds Docker image:
- Tags image with format: `{registry}/{image-name}:{commit-sha}`
- Example: `risqaistg-dgdydvdyftghfra2.azurecr.io/xxxxxx:abc123def456`
- Uses git commit SHA for versioning, ensuring each deployment has a unique, traceable image

---

```yaml
      - name: Push Docker image
        run: |
          echo "${{ secrets.ACR_PASSWORD }}" | docker login "$REGISTRY_LOGIN_SERVER" -u "${{ secrets.ACR_USERNAME }}" --password-stdin
          docker push "$REGISTRY_LOGIN_SERVER/$IMAGE_NAME:${{ github.sha }}"
```
**Lines 40-43**: Pushes Docker image to Azure Container Registry:
1. Logs into ACR using credentials from secrets:
   - `ACR_USERNAME` - Container registry username
   - `ACR_PASSWORD` - Container registry password
   - Uses `--password-stdin` for secure password input
2. Pushes the tagged image to the registry

---

```yaml
      - name: Deploy to Azure Container Apps
        run: |
          az containerapp update \
            --name "$CONTAINER_APP_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --image "$REGISTRY_LOGIN_SERVER/$IMAGE_NAME:${{ github.sha }}" \
            --min-replicas 1 \
            --max-replicas 10
```
**Lines 45-52**: Deploys to Azure Container Apps using Azure CLI:
- `az containerapp update` - Updates existing container app
- `--name` - Container app to update
- `--resource-group` - Azure resource group containing the app
- `--image` - New Docker image to deploy (with commit SHA tag)
- `--min-replicas 1` - Ensures at least 1 instance is always running
- `--max-replicas 10` - Allows auto-scaling up to 10 instances based on load

---

## Production Workflow: `app-risqai-backend-prod-AutoDeployTrigger-5b42ba62-8b2b-45cd-997a-6613cdb8a5e9.yml`

### Line-by-Line Explanation

```yaml
name: Backend – Build & Deploy (Production)
```
**Line 1**: Workflow name clearly identifies this as the production deployment workflow.

---

```yaml
on:
  push:
    branches:
      - master
```
**Lines 3-6**: Triggers when code is pushed to the `master` branch (production).

---

```yaml
    paths:
    - '**'
    - '.github/workflows/app-risqai-backend-prod-AutoDeployTrigger-5b42ba62-8b2b-45cd-997a-6613cdb8a5e9.yml'
```
**Lines 7-9**: Same path filter as staging - triggers on any file change or workflow file change.

---

```yaml
  workflow_dispatch:
```
**Line 10**: Allows manual triggering (useful for hotfixes or re-deployments).

---

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
```
**Lines 12-17**: Identical to staging - runs on Ubuntu with OIDC and read permissions.

---

```yaml
    environment: production
```
**Line 18**: **DIFFERENT FROM STAGING**: Hardcoded to use `production` environment.
- Staging uses dynamic environment selection based on branch
- Production explicitly specifies `production` environment
- This ensures production secrets/variables are always used

---

```yaml
    concurrency:
      group: backend-production
      cancel-in-progress: false
```
**Lines 19-21**: **DIFFERENT FROM STAGING**:
- Uses fixed group name `backend-production` instead of dynamic `backend-${{ github.ref_name }}`
- This is appropriate since production workflow only runs on master branch
- Prevents concurrent production deployments

---

```yaml
    env:
      REGISTRY_LOGIN_SERVER: ${{ vars.REGISTRY_LOGIN_SERVER }}
      IMAGE_NAME:            ${{ vars.IMAGE_NAME }}
      RESOURCE_GROUP:        ${{ vars.RESOURCE_GROUP }}
      CONTAINER_APP_NAME:    ${{ vars.CONTAINER_APP_NAME }}
```
**Lines 22-26**: Same as staging, but loads from production environment:
- `REGISTRY_LOGIN_SERVER`: `risqaiprod.azurecr.io`
- `IMAGE_NAME`: `app-risqai-backend-prod`
- `RESOURCE_GROUP`: `group-risqai-production`
- `CONTAINER_APP_NAME`: `app-risqai-backend-prod`

---

```yaml
    steps:
      - uses: actions/checkout@v4

      - uses: azure/login@v2
        with:
          client-id:       ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id:       ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Build Docker image
        run: docker build -t "$REGISTRY_LOGIN_SERVER/$IMAGE_NAME:${{ github.sha }}" .

      - name: Push Docker image
        run: |
          echo "${{ secrets.ACR_PASSWORD }}" | docker login "$REGISTRY_LOGIN_SERVER" -u "${{ secrets.ACR_USERNAME }}" --password-stdin
          docker push "$REGISTRY_LOGIN_SERVER/$IMAGE_NAME:${{ github.sha }}"

      - name: Deploy to Azure Container Apps
        run: |
          az containerapp update \
            --name "$CONTAINER_APP_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --image "$REGISTRY_LOGIN_SERVER/$IMAGE_NAME:${{ github.sha }}" \
            --min-replicas 1 \
            --max-replicas 10
```
**Lines 28-52**: **IDENTICAL TO STAGING** - Same deployment steps:
1. Checkout code
2. Login to Azure
3. Build Docker image
4. Push to container registry
5. Deploy to Azure Container Apps

---

## Key Differences: Staging vs Production

| Aspect | Staging | Production |
|--------|---------|------------|
| **Workflow Name** | `Backend – Build & Deploy (ACA)` | `Backend – Build & Deploy (Production)` |
| **Trigger Branch** | `staging` | `master` |
| **Environment Selection** | Dynamic (based on branch name) | Hardcoded to `production` |
| **Concurrency Group** | `backend-${{ github.ref_name }}` (dynamic) | `backend-production` (fixed) |
| **Registry URL** | `risqaistg-dgdydvdyftghfra2.azurecr.io` | `risqaiprod.azurecr.io` |
| **Image Name** | `xxxxxx` | `app-risqai-backend-prod` |
| **Resource Group** | `group-risqai-staging` | `group-risqai-production` |
| **Container App** | `app-risqai-backend` | `app-risqai-backend-prod` |
| **Deployment Steps** | ✅ Identical | ✅ Identical |

## Environment Variables by Environment

### Staging Environment Variables
```
REGISTRY_LOGIN_SERVER: risqaistg-dgdydvdyftghfra2.azurecr.io
IMAGE_NAME: xxxxxx
RESOURCE_GROUP: group-risqai-staging
CONTAINER_APP_NAME: app-risqai-backend
VITE_ENV: staging
```

### Production Environment Variables
```
REGISTRY_LOGIN_SERVER: risqaiprod.azurecr.io
IMAGE_NAME: app-risqai-backend-prod
RESOURCE_GROUP: group-risqai-production
CONTAINER_APP_NAME: app-risqai-backend-prod
```

## Secrets Required

Both environments require the following secrets:

### Azure Authentication (OIDC)
- `AZURE_CLIENT_ID` - Service principal client ID for Azure authentication
- `AZURE_TENANT_ID` - Azure AD tenant ID
- `AZURE_SUBSCRIPTION_ID` - Azure subscription ID

### Container Registry Credentials
- `ACR_USERNAME` - Azure Container Registry username
- `ACR_PASSWORD` - Azure Container Registry password

## CI/CD Pipeline Flow

```
Developer Branches (roberto, anna, etc.)
    ↓
    ├── Push to dev branch
    ↓
dev branch
    ↓
    ├── Merge to staging
    ↓
staging branch
    ↓
    ├── staging_backend-22.yml triggers
    ├── Builds Docker image
    ├── Pushes to risqaistg-*.azurecr.io
    └── Deploys to app-risqai-backend (staging)
    ↓
    ├── Merge to master
    ↓
master branch (production)
    ↓
    ├── app-risqai-backend-prod-* workflow triggers
    ├── Builds Docker image
    ├── Pushes to risqaiprod.azurecr.io
    └── Deploys to app-risqai-backend-prod (production)
```

## Benefits of Standardized Workflows

1. **Consistency**: Both workflows follow identical deployment patterns
2. **Predictability**: If deployment works in staging, it will work in production
3. **Debuggability**: Standard Docker commands instead of GitHub Action abstractions
4. **Traceability**: Each deployment tagged with git commit SHA
5. **Safety**: Explicit replica configuration (min: 1, max: 10) ensures reliability
6. **Flexibility**: Environment-specific configuration via GitHub environment variables

## How to Manually Trigger Deployments

### Via GitHub CLI
```bash
# Trigger staging deployment
gh workflow run "Backend – Build & Deploy (ACA)"

# Trigger production deployment
gh workflow run "Backend – Build & Deploy (Production)"
```

### Via GitHub Web UI
1. Go to repository → Actions tab
2. Select the workflow (staging or production)
3. Click "Run workflow" button
4. Select branch and click "Run workflow"

## Troubleshooting

### Deployment Fails with "unauthorized" Docker Error
**Issue**: Cannot authenticate to Azure Container Registry

**Solution**:
1. Check ACR credentials are correct in environment secrets
2. Verify ACR admin user is enabled:
   ```bash
   az acr show --name risqaiprod --query adminUserEnabled
   ```
3. Regenerate credentials if needed:
   ```bash
   az acr credential show --name risqaiprod
   ```

### Deployment Doesn't Trigger
**Issue**: Workflow not running after push

**Solution**:
- Check if pushed to correct branch (`staging` for staging, `master` for production)
- Verify workflow file is present in the branch
- Check if commit changed any files (empty commits won't trigger due to `paths` filter)
- Manually trigger using `workflow_dispatch`

### Image Build Fails
**Issue**: Docker build errors

**Solution**:
1. Check Dockerfile exists in repository root
2. Verify all dependencies are properly specified
3. Check build logs for specific error messages
4. Test build locally:
   ```bash
   docker build -t test-image .
   ```

## Maintenance Notes

- **Workflow files should be synchronized** across all branches to prevent merge conflicts
- **Environment variables** should be updated in GitHub environment settings, not in workflow files
- **Secrets** should be rotated periodically for security
- **Replica counts** (min: 1, max: 10) can be adjusted in workflow files if needed
- Both workflows use `actions/checkout@v4` - keep actions updated for security patches
