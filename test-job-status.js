// Test script to verify job status API functionality
import fetch from 'node-fetch';

const baseUrl = 'https://cceb6049-09e4-4cfe-a3a8-4fb98356e9c4-00-29uhfg3yu3l6v.kirk.replit.dev:3000';

async function testJobStatus() {
  try {
    console.log('Testing job status endpoint...');
    
    const response = await fetch(`${baseUrl}/api/news-tracker/jobs/status`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));
    
    if (response.ok) {
      const data = await response.json();
      console.log('Response data:', data);
    } else {
      const text = await response.text();
      console.log('Error response:', text);
    }
    
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

testJobStatus();