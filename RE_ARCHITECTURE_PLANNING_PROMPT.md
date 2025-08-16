# Re-Architecture Planning Prompt

Create a plan to re-architect our application from a user-specific article scraping system to a global, shared scraping infrastructure with the following requirements and constraints:

## Core Architecture Changes

### 1. Database Schema Transformation
- **Articles Table**: Transform from user-specific to global shared table (remove userId foreign key)
- **Sources Table**: Consolidate into single shared table accessible by all users
- **Keywords Table**: Maintain user-specific structure but change functionality from scraping triggers to query-time filters
- **New Fields Required**: Add threat tracking flags and security scoring fields to articles table

### 2. Scraping System Migration
- **From**: User-triggered, keyword-based scraping tied to userId
- **To**: Global automated scraping every 3 hours that collects ALL articles
- **Preserve**: All existing scraping logic, bot bypass mechanisms, and extraction algorithms
- **Remove**: Keyword processing during scraping, userId dependencies

### 3. Article Processing Pipeline
- **Stage 1**: Scrape and save all articles to database
- **Stage 2**: AI evaluation to determine if article is cybersecurity/IT vulnerability related
- **Stage 3**: If cybersecurity-related, calculate security risk score
- **Stage 4**: Flag articles for appropriate app visibility (all for News Radar, cybersecurity only for Threat Tracker)

### 4. User Experience Transformation
- **Source Management**: Users can only enable/disable existing sources (no adding new sources)
- **Keyword Management**: Keywords become query-time filters instead of scraping triggers
- **App Independence**: Each app (News Radar/Threat Tracker) has independent keyword and source filters
- **Article Visibility**: News Radar sees all articles, Threat Tracker only sees flagged cybersecurity articles

## Planning Requirements

The plan should address:

### Phase 1: Database Migration Strategy
- How to migrate existing user-specific articles to global table
- Schema changes needed for new flags and scoring fields
- Handling of existing user keywords and sources
- Data integrity during transition

### Phase 2: Backend Service Re-architecture
- Redesign of scraping scheduler (removal of user-specific jobs)
- New global scraping job implementation
- AI processing pipeline for threat detection and scoring
- Query-time filtering implementation for keywords and sources

### Phase 3: API Endpoint Updates
- Changes to article retrieval endpoints (filtering instead of user-specific queries)
- Source management endpoint modifications (enable/disable only)
- Keyword functionality changes (filter application)
- Maintaining backward compatibility during transition

### Phase 4: Frontend Adjustments
- UI changes for source management (remove add functionality)
- Update article display logic for filtering
- Maintain app-specific views with shared data
- User feedback during transition

### Phase 5: Migration Execution
- Zero-downtime migration strategy
- Rollback procedures
- Data validation steps
- Performance testing approach

## Constraints and Considerations

1. **Must Preserve**: All existing scraping logic, bot bypass mechanisms, and content extraction algorithms
2. **Performance**: Plan for handling significantly larger article volume (all articles vs keyword-filtered)
3. **Scalability**: Design for efficient querying of large shared tables with user-specific filters
4. **Security**: Ensure users can only see appropriate articles based on app context
5. **Backwards Compatibility**: Plan for gradual migration without breaking existing functionality

## Deliverables Expected

1. **Technical Architecture Document**: Detailed system design with component diagrams
2. **Database Migration Plan**: Step-by-step schema changes and data migration scripts
3. **Implementation Timeline**: Phased approach with milestones
4. **Risk Assessment**: Potential issues and mitigation strategies
5. **Testing Strategy**: Comprehensive testing plan for each phase
6. **Rollback Plan**: Procedures for reverting changes if needed

## Success Criteria

- All articles are scraped globally every 3 hours without user intervention
- Users can effectively filter articles using keywords and sources at query time
- News Radar displays all articles while Threat Tracker only shows cybersecurity-flagged content
- Existing scraping reliability and bot bypass capabilities are maintained
- System performance remains acceptable with larger data volumes
- User experience is improved with real-time filtering capabilities

## Questions to Address

1. How will we handle the initial population of the global articles table?
2. What AI model/logic will determine cybersecurity relevance?
3. How will security risk scoring be calculated and stored?
4. What indexing strategy will optimize query-time filtering performance?
5. How do we handle existing user data during migration?
6. What monitoring will ensure the 3-hour global scraping remains reliable?
7. How do we manage source quality and relevance without user input?
8. What caching strategies will improve performance with shared data?

Please provide a comprehensive plan that addresses all these requirements while minimizing disruption to the existing system and maintaining all current scraping capabilities.