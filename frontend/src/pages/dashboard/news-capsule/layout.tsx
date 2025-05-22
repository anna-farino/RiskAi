import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { NEWS_CAPSULE } from '../../../lib/constants';

export default function NewsCapsuleLayout() {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-800 text-white p-4">
        <h1 className="text-2xl font-bold">{NEWS_CAPSULE.DASHBOARD_TITLE}</h1>
        <p className="text-sm text-gray-300 mt-1">
          Track and analyze cybersecurity news from around the web
        </p>
      </div>
      
      <div className="bg-gray-700 text-white p-2">
        <nav className="flex space-x-4">
          <NavLink 
            to="/dashboard/news-capsule" 
            end
            className={({ isActive }) => 
              isActive 
                ? "px-3 py-2 rounded bg-gray-600 text-white font-medium" 
                : "px-3 py-2 rounded hover:bg-gray-600 text-gray-300"
            }
          >
            Dashboard
          </NavLink>
          <NavLink 
            to="/dashboard/news-capsule/submit" 
            className={({ isActive }) => 
              isActive 
                ? "px-3 py-2 rounded bg-gray-600 text-white font-medium" 
                : "px-3 py-2 rounded hover:bg-gray-600 text-gray-300"
            }
          >
            Submit Article
          </NavLink>
          <NavLink 
            to="/dashboard/news-capsule/reports" 
            className={({ isActive }) => 
              isActive 
                ? "px-3 py-2 rounded bg-gray-600 text-white font-medium" 
                : "px-3 py-2 rounded hover:bg-gray-600 text-gray-300"
            }
          >
            Reports
          </NavLink>
        </nav>
      </div>
      
      <div className="flex-1 p-6 bg-gray-100 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}