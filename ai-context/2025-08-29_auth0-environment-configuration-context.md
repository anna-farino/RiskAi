# Auth0 Environment Configuration Context

**Date Created**: August 29, 2025  
**Last Updated**: August 29, 2025  
**Context Type**: Authentication Infrastructure Configuration  

## Overview

This document provides comprehensive context about the Auth0 authentication architecture and environment configuration for the RisqAI application. This context is critical for understanding the complete authentication flow, environment-specific configurations, and troubleshooting authentication issues.

## Application Architecture

### Tech Stack
- **Frontend**: React SPA with Vite, hosted on Azure Static Web Apps
- **Backend**: Express.js API hosted on Azure Container Apps
- **Authentication**: Auth0 with custom domains
- **Database**: PostgreSQL on Azure with Row Level Security (RLS)
- **Encryption**: Azure Key Vault envelope encryption for sensitive data
- **CI/CD**: GitHub Actions with environment-specific deployments

### Production URLs (Current)
- **Frontend**: https://app.risqai.co
- **Backend API**: https://api.app.risqai.co
- **Auth0 Production**: https://risqai.us.auth0.com
- **Auth0 Staging**: https://preview-risqai.us.auth0.com
- **Auth0 Development**: https://dev-risqai.us.auth0.com

## Environment Configuration

### Production Environment

#### Frontend Environment Variables (GitHub Secrets)
```env
VITE_AUTH0_DOMAIN=https://risqai.us.auth0.com
VITE_AUTH0_CLIENT_ID=K2pr8mArmUomweVvK9m1xECgDFOEH8zS
VITE_AUTH0_AUDIENCE=https://api.app.risqai.co
VITE_AUTH0_CALLBACK_URL=https://app.risqai.co/auth/login
VITE_SERVER_URL=https://api.app.risqai.co
```

#### Backend Environment Variables (Azure Container Apps)
```env
NODE_ENV=production
AUTH0_DOMAIN=https://risqai.us.auth0.com
AUTH0_AUDIENCE=https://api.app.risqai.co
AUTH0_CLIENT_ID=V5VXGaU2EtEfkXi0Ey6haTPCtYveTNLi  # M2M Client ID
AUTH0_CLIENT_SECRET=[ENCRYPTED]  # M2M Client Secret
DATABASE_URL=postgresql://risqai_user:***@db-risqai-production.postgres.database.azure.com:5432/postgres?sslmode=require
AZURE_KEY_VAULT_NAME=risqai-keyv-production
AZURE_KEY_NAME=encryption-key
JWT_SECRET=[SECURE_RANDOM_STRING]
CSRF_SECRET=[SECURE_RANDOM_STRING]
```

### Staging Environment

#### Frontend Environment Variables
```env
VITE_AUTH0_DOMAIN=https://preview-risqai.us.auth0.com
VITE_AUTH0_CLIENT_ID=3KSrLuzhfByKoGZmDfdi7CdHoJDBpSVX
VITE_AUTH0_AUDIENCE=https://api.preview.risqai.co
VITE_AUTH0_CALLBACK_URL=https://preview.risqai.co/auth/login
VITE_SERVER_URL=https://api.preview.risqai.co
```

#### Backend Environment Variables
```env
NODE_ENV=staging
AUTH0_DOMAIN=https://preview-risqai.us.auth0.com
AUTH0_AUDIENCE=https://api.preview.risqai.co
# Other variables follow same pattern as production
```

## Auth0 Configuration

### Tenants
1. **Production**: `risqai.us.auth0.com`
2. **Staging**: `preview-risqai.us.auth0.com`  
3. **Development**: `dev-risqai.us.auth0.com`

### Applications

#### Single Page Application (SPA) - Production
- **Name**: Azure | RisqAi | Production
- **Client ID**: `K2pr8mArmUomweVvK9m1xECgDFOEH8zS`
- **Type**: Single Page Web Application
- **Callback URLs**: `https://app.risqai.co/auth/login`
- **Logout URLs**: `https://app.risqai.co`, `https://app.risqai.co/auth/login`
- **Web Origins**: `https://app.risqai.co`
- **Grant Types**: implicit, authorization_code, refresh_token

#### Machine-to-Machine (M2M) - Production
- **Name**: Production Backend M2M (Azure)
- **Client ID**: `V5VXGaU2EtEfkXi0Ey6haTPCtYveTNLi`
- **Type**: Machine to Machine
- **Grant Types**: client_credentials
- **Authorized APIs**: Management API, Backend API

### Auth0 Actions (Post-Login Flow)

#### 1. Add Email to Token
```javascript
exports.onExecutePostLogin = async (event, api) => {
  const { email } = event.user;
  
  if (email) {
    api.idToken.setCustomClaim('email', email);
    api.accessToken.setCustomClaim('email', email);
  }
};
```

#### 2. Confirm Email is Verified
```javascript
exports.onExecutePostLogin = async (event, api) => {
  if (!event.user.email_verified) {
    api.access.deny('Please verify your email address before logging in.');
  }
};
```

#### 3. Trigger MFA when enabled
```javascript
exports.onExecutePostLogin = async (event, api) => {
  const mfaEnabled = event.user.user_metadata?.mfa_enabled;
  
  if (mfaEnabled) {
    // Check if user has enrolled MFA factors
    const hasEnrolledFactors = event.user.multifactor && 
      event.user.multifactor.length > 0;
    
    if (hasEnrolledFactors) {
      // User has MFA factors, require MFA
      api.multifactor.enable("any", { allowRememberBrowser: true });
    } else {
      // User has MFA enabled but no factors enrolled, force enrollment
      api.multifactor.enable("any", { allowRememberBrowser: false });
    }
  }
};
```

### API Configuration
- **Name**: RisqAI Backend API
- **Identifier**: `https://api.app.risqai.co` (Production)
- **Identifier**: `https://api.preview.risqai.co` (Staging)
- **Token Expiration**: 24 hours
- **Signing Algorithm**: RS256

### Connections
1. **Username-Password-Authentication**
   - Database Connection
   - Password Policy: Good (8+ characters)
   - MFA: Enabled
   - Brute Force Protection: Enabled

2. **Google OAuth2** 
   - Social Connection
   - Scopes: email, profile
   - **Note**: Currently using Auth0 dev keys, requires production Google OAuth credentials

## File Structure Context

### Key Configuration Files

#### Frontend Auth0 Integration
- **File**: `frontend/src/auth0-provider-with-navigate.tsx`
- **Purpose**: Auth0 React provider configuration
- **Key Environment Variables**: All VITE_AUTH0_* variables

#### Backend Auth0 Middleware
- **File**: `backend/middleware/auth0.ts`
- **Purpose**: JWT validation and user context
- **Dependencies**: AUTH0_DOMAIN, AUTH0_AUDIENCE

#### Backend CORS Configuration
- **File**: `backend/utils/cors-options.ts`
- **Purpose**: Cross-origin request configuration
- **Current Origins**:
  - `http://localhost:5174` (Local dev)
  - `https://preview.risqai.co` (Staging)
  - `https://app.risqai.co` (Production)
  - `/\.replit\.dev$/` (Replit development)

#### Logout Hook
- **File**: `frontend/src/hooks/use-logout.ts`
- **Purpose**: Handles Auth0 logout flow
- **Redirect**: Returns to `/auth/login` after logout

### GitHub Actions
- **File**: `.github/workflows/azure-static-web-apps-white-forest-0f977190f.yml`
- **Purpose**: Production frontend deployment
- **Environment**: Production
- **Build Process**: Injects environment variables during build

### Azure Resources

#### Production Resources
- **Resource Group**: `group-risqai-production`
- **Container App**: `app-risqai-backend-prod`
- **Container Environment**: `env-risqai-production`
- **Key Vault**: `risqai-keyv-production`
- **Database**: `db-risqai-production.postgres.database.azure.com`

#### Staging Resources
- **Resource Group**: `group-risqai-staging`
- **Container App**: `app-risqai-backend`
- **Container Environment**: `env-risqai-staging`
- **Database**: `db-risqay-staging.postgres.database.azure.com`

## Authentication Flow

### Standard Login Flow
1. User clicks Login → Redirect to Auth0
2. Auth0 Universal Login → User Authentication
3. Post-Login Actions execute (email claims, email verification, MFA)
4. Redirect to App with authorization code
5. Frontend gets tokens → API calls with JWT
6. Backend validates JWT → User context established

### MFA Flow Logic
```javascript
if (user.user_metadata.mfa_enabled) {
  if (user.multifactor && user.multifactor.length > 0) {
    // User has enrolled factors - require MFA
    api.multifactor.enable("any", { allowRememberBrowser: true });
  } else {
    // User needs to enroll - force MFA setup
    api.multifactor.enable("any", { allowRememberBrowser: false });
  }
}
```

### JWT Token Structure
```json
{
  "iss": "https://risqai.us.auth0.com/",
  "sub": "auth0|64f8a1b2c3d4e5f6g7h8i9j0",
  "aud": [
    "https://api.app.risqai.co",
    "https://risqai.us.auth0.com/userinfo"
  ],
  "iat": 1693234567,
  "exp": 1693320967,
  "azp": "K2pr8mArmUomweVvK9m1xECgDFOEH8zS",
  "scope": "openid profile email read:settings write:settings",
  "email": "user@example.com"
}
```

## Database Integration

### Row Level Security (RLS)
- All tables have RLS enabled
- User context established via JWT sub claim
- File: `backend/db/with-user-context.ts` handles user context injection

### Encryption Integration
- **File**: `backend/utils/encryption-new.ts`
- **Method**: Envelope encryption with Azure Key Vault
- **Environment Handling**: Dev/staging/production key separation
- **Edge Cases**: Cross-environment data migration handled gracefully

## Common Issues & Troubleshooting

### Callback URL Mismatch
- **Error**: `The provided redirect_uri is not in the list of allowed callback URLs`
- **Solution**: Ensure Auth0 callback URL exactly matches: `https://app.risqai.co/auth/login`

### Invalid Client Error
- **Error**: `The OAuth client was not found`
- **Solution**: Verify client IDs match between GitHub secrets and Auth0 applications

### MFA Issues
- **Issue**: MFA not triggering after enabling
- **Cause**: Action logic checking for existing factors instead of forcing enrollment
- **Solution**: Use the corrected MFA action that forces enrollment when no factors exist

### Development Keys Warning
- **Warning**: Social connections using Auth0 development keys
- **Solution**: Configure production Google OAuth credentials in Google Cloud Console

### Cross-Environment Encryption Issues
- **Issue**: Double encryption when data migrated between environments
- **Solution**: Enhanced error handling in `encryption-new.ts` detects and re-encrypts with correct key

## Security Considerations

### Secrets Management
- All secrets stored in GitHub repository secrets (production environment)
- Azure Container Apps environment variables for backend
- No secrets in code or configuration files
- CSRF tokens required for state-changing operations

### CORS Configuration
- Strict origin allowlist
- Credentials enabled for authentication
- Only necessary headers allowed

### Key Rotation
- Azure Key Vault supports versioned keys
- Automatic key rotation implemented in encryption utilities
- Graceful fallback for invalid keys from different environments

## Deployment Process

### Frontend Deployment
1. GitHub Actions triggered on master branch push
2. Environment variables injected during build
3. Azure Static Web Apps deployment
4. Custom domain mapping to app.risqai.co

### Backend Deployment
1. Container image built and pushed to Azure Container Registry
2. Azure Container Apps deployment with environment variables
3. Database migrations run automatically
4. Health checks verify deployment success

## Documentation References

### Generated Documentation
- **File**: `docs/2025-08-28_auth0-architecture-environment-configuration.html`
- **Purpose**: Comprehensive HTML documentation with all configuration details
- **Audience**: Development team and stakeholders

### Context Files
- **File**: `ai-context/2025-08-25_envelope-encryption-context.md`
- **Purpose**: Encryption implementation context
- **Related**: Azure Key Vault and encryption utilities

## Debug Commands

### Auth0 CLI
```bash
auth0 tenants list
auth0 apps list
auth0 apis list
auth0 actions list
```

### GitHub CLI
```bash
gh secret list --env production
gh secret list --env staging
gh workflow run "Azure Static Web Apps CI/CD - Production"
```

### Azure CLI
```bash
az containerapp show --name app-risqai-backend-prod \
  --resource-group group-risqai-production \
  --query "properties.template.containers[0].env"
```

## Next Steps & Considerations

### Immediate Actions Required
1. **Google OAuth Production Credentials**: Replace Auth0 development keys with production Google OAuth credentials
2. **MFA Testing**: Comprehensive testing of MFA flow with both email and authenticator apps
3. **Environment Validation**: Regular checks of environment variable consistency across all platforms

### Future Enhancements
1. **Additional Social Providers**: Consider adding Microsoft/LinkedIn OAuth
2. **Advanced MFA**: Implement WebAuthn for passwordless authentication
3. **Monitoring**: Enhanced logging and monitoring for authentication flows
4. **Documentation**: Keep this context file updated with any configuration changes

## Change History

### August 29, 2025
- Initial context file creation
- Documented complete Auth0 configuration for all environments
- Added troubleshooting section for common issues
- Included all environment variables and application settings
- Added security considerations and deployment processes

---

**Note**: This file should be updated whenever authentication configuration changes occur. Critical for maintaining consistency across environments and troubleshooting authentication issues.