# Auth0 Direct Signup URLs

**Date:** October 28, 2025
**Purpose:** Direct signup links for landing page integration

## Overview

Auth0 provides direct authorization URLs that can be used to send users straight to the signup screen instead of the login screen. This is accomplished using the `screen_hint=signup` parameter.

## Signup URLs

### Preview/Staging Environment

```
https://preview-risqai.us.auth0.com/authorize?response_type=code&client_id=UqTooW6L2MCy61CuMdiwemLyUw72xxCM&redirect_uri=https://preview.risqai.co/auth/login&scope=openid%20profile%20email&audience=https://api.preview.risqai.co&screen_hint=signup
```

### Production Environment

```
https://risqai.us.auth0.com/authorize?response_type=code&client_id=K2pr8mArmUomweVvK9m1xECgDFOEH8zS&redirect_uri=https://app.risqai.co/auth/login&scope=openid%20profile%20email&audience=https://api.app.risqai.co&screen_hint=signup
```

## Configuration Details

### Preview (Staging)

| Parameter | Value |
|-----------|-------|
| **Auth0 Domain** | `preview-risqai.us.auth0.com` |
| **Client ID** | `UqTooW6L2MCy61CuMdiwemLyUw72xxCM` |
| **Application Name** | Azure \| RisqAi \| Staging |
| **Application Type** | Single Page Web Application |
| **Callback URL** | `https://preview.risqai.co/auth/login` |
| **Audience** | `https://api.preview.risqai.co` |
| **Allowed Web Origins** | `https://preview.risqai.co`, `https://icy-plant-0e669a70f.2.azurestaticapps.net` |

### Production

| Parameter | Value |
|-----------|-------|
| **Auth0 Domain** | `risqai.us.auth0.com` |
| **Client ID** | `K2pr8mArmUomweVvK9m1xECgDFOEH8zS` |
| **Application Name** | Azure \| RisqAi \| Production |
| **Application Type** | Single Page Web Application |
| **Callback URL** | `https://app.risqai.co/auth/login` |
| **Audience** | `https://api.app.risqai.co` |
| **Allowed Web Origins** | `https://app.risqai.co` |

## URL Parameters Explained

| Parameter | Description |
|-----------|-------------|
| `response_type=code` | Uses Authorization Code flow with PKCE (recommended for SPAs) |
| `client_id` | The Auth0 application client ID |
| `redirect_uri` | Where Auth0 redirects after authentication |
| `scope` | Requested permissions: `openid profile email` |
| `audience` | API identifier (backend API) |
| `screen_hint=signup` | **Key parameter** - shows signup form instead of login form |

## Usage Examples

### HTML Link

```html
<!-- Production Signup Button -->
<a href="https://risqai.us.auth0.com/authorize?response_type=code&client_id=K2pr8mArmUomweVvK9m1xECgDFOEH8zS&redirect_uri=https://app.risqai.co/auth/login&scope=openid%20profile%20email&audience=https://api.app.risqai.co&screen_hint=signup"
   class="btn btn-primary">
  Sign Up Now
</a>
```

### React/JavaScript

```javascript
// Production signup URL
const SIGNUP_URL = 'https://risqai.us.auth0.com/authorize?response_type=code&client_id=K2pr8mArmUomweVvK9m1xECgDFOEH8zS&redirect_uri=https://app.risqai.co/auth/login&scope=openid%20profile%20email&audience=https://api.app.risqai.co&screen_hint=signup';

// Usage
<button onClick={() => window.location.href = SIGNUP_URL}>
  Sign Up
</button>
```

### As URL Builder Function

```javascript
function buildAuth0SignupUrl(environment = 'production') {
  const configs = {
    production: {
      domain: 'risqai.us.auth0.com',
      clientId: 'K2pr8mArmUomweVvK9m1xECgDFOEH8zS',
      redirectUri: 'https://app.risqai.co/auth/login',
      audience: 'https://api.app.risqai.co'
    },
    preview: {
      domain: 'preview-risqai.us.auth0.com',
      clientId: 'UqTooW6L2MCy61CuMdiwemLyUw72xxCM',
      redirectUri: 'https://preview.risqai.co/auth/login',
      audience: 'https://api.preview.risqai.co'
    }
  };

  const config = configs[environment];
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'openid profile email',
    audience: config.audience,
    screen_hint: 'signup'
  });

  return `https://${config.domain}/authorize?${params.toString()}`;
}

// Usage
const signupUrl = buildAuth0SignupUrl('production');
```

## Important Notes

### Security Considerations

1. **Allowed Callback URLs**: The `redirect_uri` must be pre-configured in the Auth0 application's "Allowed Callback URLs" setting
2. **Web Origins**: If your landing page domain differs from the app domain, add it to "Allowed Web Origins" in Auth0
3. **CORS**: Ensure proper CORS configuration if making Auth0 API calls from the landing page

### User Flow

1. User clicks signup link on landing page
2. Redirected to Auth0 with signup form displayed
3. User completes signup
4. Auth0 redirects to `redirect_uri` with authorization code
5. Application exchanges code for access token
6. User is authenticated and redirected to dashboard

### Switching Between Login and Signup

- **Signup**: Use `screen_hint=signup` parameter
- **Login**: Use `screen_hint=login` parameter (or omit the parameter)
- **Password Reset**: Direct users to Auth0's change password endpoint

## Testing

### Preview/Staging
1. Visit the preview signup URL
2. Complete the signup form
3. Verify redirect to `https://preview.risqai.co/auth/login`
4. Confirm user is created in Auth0 Dashboard

### Production
1. Test with a real email address
2. Complete signup and verify email
3. Ensure proper redirect and authentication

## Auth0 CLI Commands

### List Applications
```bash
# Preview
auth0 tenants use preview-risqai.us.auth0.com
auth0 apps list

# Production
auth0 tenants use risqai.us.auth0.com
auth0 apps list
```

### Show Application Details
```bash
# Preview
auth0 apps show UqTooW6L2MCy61CuMdiwemLyUw72xxCM

# Production
auth0 apps show K2pr8mArmUomweVvK9m1xECgDFOEH8zS
```

### List APIs/Audiences
```bash
auth0 apis list
```

## Related Documentation

- [Auth0 Authorization Code Flow](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow)
- [Auth0 Universal Login](https://auth0.com/docs/authenticate/login/auth0-universal-login)
- [Auth0 Signup Configuration](https://auth0.com/docs/authenticate/login/auth0-universal-login/configure-default-login-routes)

## Changelog

- **2025-10-28**: Initial documentation created with preview and production signup URLs
