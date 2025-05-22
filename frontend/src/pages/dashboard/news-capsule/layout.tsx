import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs';

export default function NewsCapsuleLayout() {
  const location = useLocation();
  const currentPath = location.pathname;

  // Determine which tab is active
  const getActiveTab = () => {
    if (currentPath.includes('/dashboard/news-capsule/reports')) {
      return 'reports';
    } else {
      return 'home';
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">News Capsule</h1>
        <p className="text-gray-500 mt-1">
          Scrape and summarize cybersecurity articles for executive reports
        </p>
      </div>

      <Tabs value={getActiveTab()} className="mb-8">
        <TabsList>
          <TabsTrigger value="home" asChild>
            <Link to="/dashboard/news-capsule">Dashboard</Link>
          </TabsTrigger>
          <TabsTrigger value="reports" asChild>
            <Link to="/dashboard/news-capsule/reports">Reports</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Outlet />
    </div>
  );
}