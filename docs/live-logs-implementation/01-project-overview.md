# Live Server Logs Implementation

**Implementation Date**: 2025-09-13
**Environment**: Staging Only (NODE_ENV=staging)
**Purpose**: Real-time debugging tool for scraping operations

## Project Requirements

### Core Features
1. **Real-time log streaming** via WebSockets (socket.io)
2. **Permission-based access** using `devs_allowed_logs` table
3. **Frontend interface** with start/stop and clear functionality
4. **Integration with existing logging** without breaking current functionality
5. **Environment restriction** to staging only

### Use Cases
- **Live debugging** of scraping protection bypass attempts (darkreading.com, bizjournals.com)
- **Real-time monitoring** of CycleTLS, Puppeteer, and Azure anti-detection measures
- **Immediate visibility** into scraping pipeline issues during development

## Architecture Overview

### Database Layer
```
devs_allowed_logs table:
- id (uuid, primary key)
- email (text, unique)
- created_at (timestamp)
- created_by (text)
- notes (text, optional)
```

### Backend Components
1. **Socket.io Integration**: WebSocket server for real-time communication
2. **Log Interceptor**: Wrapper around existing `log()` function
3. **Permission Middleware**: Email-based access verification
4. **Selective Streaming**: Filter logs by context/level

### Frontend Components
1. **Live Logs Page**: `/dev/live-logs` (staging-only route)
2. **Sidebar Integration**: Button after existing navigation items
3. **Simple UI**: Start/Stop toggle, Clear button, scrollable log area
4. **WebSocket Client**: Real-time log reception and display

## Technical Decisions

### Log Interceptor Pattern (Chosen)
- **Advantage**: Non-invasive, wraps existing `log()` function
- **Alternative Rejected**: Direct replacement of all log calls (too invasive)

### Selective Log Streaming
- **Include**: `scraper`, `test-scraper`, `scraper-error` contexts
- **Exclude**: General application logs, sensitive authentication data
- **Rationale**: Focus on debugging scraping operations

### Permission Model
- **Simple email-based**: Direct lookup in `devs_allowed_logs` table
- **Alternative Considered**: RBAC integration (rejected as overkill)
- **Security**: Combined with staging-only restriction

## Implementation Status

### Phase 1: Database Setup ✅
- [x] Created Drizzle schema for `devs_allowed_logs`
- [ ] Generate and run migration
- [x] Created documentation folder

### Phase 2: Backend Infrastructure (Pending)
- [ ] Install and configure socket.io
- [ ] Create log interceptor wrapper
- [ ] Add permission middleware
- [ ] Implement selective streaming

### Phase 3: Frontend (Pending)
- [ ] Create live logs page
- [ ] Add sidebar navigation
- [ ] Implement WebSocket client
- [ ] Build UI components

### Phase 4: Testing (Pending)
- [ ] Test with darkreading.com scraping
- [ ] Test with bizjournals.com scraping
- [ ] Performance testing
- [ ] Security validation

## Context: Why This Is Needed

### Current Debugging Challenges
During recent investigation of scraping issues:
- **darkreading.com**: Cloudflare blocking with 35+ second bypass attempts
- **bizjournals.com**: Incapsula "false positive" bypass returning incident pages
- **Manual log checking**: Requires Azure Container Apps log access, slow feedback loop

### Expected Benefits
- **Immediate feedback** during scraping tests
- **Live monitoring** of protection bypass strategies
- **Faster debugging** of complex scraping scenarios
- **Better visibility** into CycleTLS and Puppeteer fallback behavior

## Next Steps
1. Generate migration file for `devs_allowed_logs` table
2. Set up socket.io infrastructure
3. Implement log interceptor pattern
4. Build frontend interface
5. Test with real scraping operations