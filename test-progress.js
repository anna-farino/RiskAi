// Simple test to set progress as active and verify the component shows up
const { updateNewsRadarProgress } = require('./backend/utils/scraping-progress');

// Set progress to active for testing
updateNewsRadarProgress({
  isActive: true,
  currentSource: "Test Source",
  totalSources: 5,
  currentSourceIndex: 2,
  articlesAdded: 3,
  articlesSkipped: 1,
  errors: [],
  startTime: new Date()
});

console.log("Progress set to active for testing");