import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Shield, FileText, Globe, Tag, Cpu } from 'lucide-react';

export default function NewsCapsuleLayout() {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname.includes(path);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex flex-col gap-3 sm:gap-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white">
              News Capsule Pro
            </h1>
            <p className="text-base sm:text-lg text-slate-300 max-w-3xl">
              Cybersecurity threat intelligence platform for tracking, analyzing, and reporting on IT security news.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Link
            to="/dashboard/news-capsule/home"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              isActive('/news-capsule/home')
                ? 'bg-purple-950 border-purple-500 text-white'
                : 'border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Shield size={18} />
            <span>Dashboard</span>
          </Link>
          
          <Link
            to="/dashboard/news-capsule/submit"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              isActive('/news-capsule/submit')
                ? 'bg-purple-950 border-purple-500 text-white'
                : 'border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Globe size={18} />
            <span>Submit Article</span>
          </Link>
          
          <Link
            to="/dashboard/news-capsule/reports"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              isActive('/news-capsule/reports')
                ? 'bg-purple-950 border-purple-500 text-white'
                : 'border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <FileText size={18} />
            <span>Reports</span>
          </Link>
        </div>

        <main className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}