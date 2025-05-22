import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RisqWidget, WidgetGrid } from '@/components/widgets/RisqWidget';
import { Newspaper, AlertTriangle, TrendingUp, Radar, Settings, BarChart4, Search, Database, ShieldAlert, FileText } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8">
        {/* Dashboard introduction section - new design with brand styling */}
        <div className="mb-8">
          <div className="bg-black/40 border border-[#BF00FF]/20 rounded-lg p-6 backdrop-blur shadow-xl">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-[#BF00FF] to-[#00FFFF] p-[1px] rounded-lg shadow-glow">
                <div className="bg-black p-3 rounded-lg">
                  <ShieldAlert className="w-8 h-8 text-white" />
                </div>
              </div>
              
              <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#BF00FF] to-[#00FFFF]">
                  Your RisqAi Dashboard
                </h1>
                <p className="text-gray-400 mt-1">
                  Real-time security intelligence at your fingertips
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main navigation widgets */}
        <WidgetGrid>
          <RisqWidget
            title="News Radar"
            description="Latest security news from across the web"
            icon={<Newspaper className="w-10 h-10" />}
            variant="interactive"
            delay={0.1}
            onClick={() => navigate("/dashboard/news/home")}
            footer={
              <div className="mt-auto">
                <div className="text-xs text-gray-400 mt-2 text-center">
                  24/7 monitoring from 140+ sources
                </div>
              </div>
            }
          >
            <div className="space-y-3">
              <div className="bg-black/30 rounded-lg p-3 border border-[#BF00FF]/10">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs bg-[#BF00FF]/20 text-[#00FFFF] px-2 py-1 rounded">Alert</span>
                  <span className="text-xs text-gray-400">2h ago</span>
                </div>
                <p className="text-sm text-gray-300">Critical vulnerability found in popular framework...</p>
              </div>
              
              <div className="bg-black/30 rounded-lg p-3 border border-[#BF00FF]/10">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs bg-[#5B21B6]/20 text-[#00FFFF] px-2 py-1 rounded">News</span>
                  <span className="text-xs text-gray-400">5h ago</span>
                </div>
                <p className="text-sm text-gray-300">New ransomware targeting critical infrastructure...</p>
              </div>
            </div>
          </RisqWidget>
          
          <RisqWidget
            title="News Capsule"
            description="Scrape and summarize cybersecurity articles"
            icon={<FileText className="w-10 h-10" />}
            variant="interactive"
            delay={0.2}
            onClick={() => navigate("/dashboard/news-capsule")}
            footer={
              <div className="mt-auto">
                <div className="text-xs text-gray-400 mt-2 text-center">
                  Generate executive reports from articles
                </div>
              </div>
            }
          >
            <div className="space-y-3">
              <div className="text-xs text-gray-300">
                Enter a URL to scrape and summarize
              </div>
            </div>
          </RisqWidget>
          
          <RisqWidget
            title="Threat Tracker"
            description="Critical security alerts requiring attention"
            icon={<AlertTriangle className="w-10 h-10" />}
            variant="interactive"
            delay={0.3}
            onClick={() => navigate("/dashboard/threat/home")}
            footer={
              <div className="mt-auto">
                <div className="text-xs text-gray-400 mt-2 text-center">
                  3 new alerts detected today
                </div>
              </div>
            }
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                <div className="text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">Critical Ransomware Alert</h4>
                  <p className="text-xs text-gray-400">Affecting financial systems</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                <div className="text-yellow-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">Supply Chain Compromise</h4>
                  <p className="text-xs text-gray-400">Multiple vendors affected</p>
                </div>
              </div>
            </div>
          </RisqWidget>
          
          
          
          <RisqWidget
            title="News Capsule"
            description="Configure and launch news scanning operations"
            icon={<Radar className="w-10 h-10" />}
            variant="interactive"
            delay={0.4}
            onClick={() => navigate("/dashboard/capsule/home")}
            footer={
              <div className="mt-auto">
                <div className="text-xs text-gray-400 mt-2 text-center">
                  Last scan completed 25 minutes ago
                </div>
              </div>
            }
          >
            <div className="relative h-[100px] w-full overflow-hidden rounded-lg mb-2 bg-radar-gradient flex items-center justify-center">
              <div className="scanner-effect w-full h-full absolute"></div>
              <div className="z-10 text-center">
                <div className="text-lg font-bold">24/7 Monitoring</div>
              </div>
            </div>
          </RisqWidget>

          {false && <RisqWidget
            title="Trend Analysis"
            description="Security trends based on news data"
            icon={<TrendingUp className="w-10 h-10" />}
            variant="interactive"
            delay={0.3}
            onClick={() => navigate("/trend-analysis")}
            footer={
              <div className="mt-auto">
                <div className="text-xs text-gray-400 mt-2 text-center">
                  Based on 30-day analysis period
                </div>
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="bg-black/30 p-3 rounded-lg border border-[#BF00FF]/10 text-center">
                <div className="text-2xl font-bold text-[#00FFFF] mb-1">+24%</div>
                <div className="text-xs text-gray-400">Ransomware</div>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-[#BF00FF]/10 text-center">
                <div className="text-2xl font-bold text-[#FF00BF] mb-1">+18%</div>
                <div className="text-xs text-gray-400">Zero-Day</div>
              </div>
            </div>
          </RisqWidget>}
          <RisqWidget
              title="Settings & Preferences"
              description="Configure your News Radar experience"
              icon={<Settings className="w-10 h-10" />}
              variant="interactive"
              delay={0.6}
              onClick={() => navigate("/dashboard/settings")}
              className="col-span-1 md:col-span-1"
            >
              <div className="space-y-3">
                <div className="bg-black/30 rounded-lg p-3 border border-[#BF00FF]/10">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#00FFFF]" />
                    <span className="text-sm">Data Management</span>
                  </div>
                </div>
                
                <div className="bg-black/30 rounded-lg p-3 border border-[#BF00FF]/10">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-[#00FFFF]" />
                    <span className="text-sm">Search Preferences</span>
                  </div>
                </div>
              </div>
            </RisqWidget>
        </WidgetGrid>
        
        {/* Additional widgets row */}
        {false && <div className="mt-8">
          <WidgetGrid>
            <RisqWidget
              title="Analytics Dashboard"
              description="Advanced metrics and visualization tools"
              icon={<BarChart4 className="w-10 h-10" />}
              variant="interactive"
              delay={0.5}
              onClick={() => navigate("/trend-analysis")}
              className="col-span-1 md:col-span-2"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-black/30 p-3 rounded-lg border border-[#BF00FF]/10 text-center">
                  <div className="text-xl font-bold text-white mb-1">240</div>
                  <div className="text-xs text-gray-400">Total Threats</div>
                </div>
                
                <div className="bg-black/30 p-3 rounded-lg border border-[#BF00FF]/10 text-center">
                  <div className="text-xl font-bold text-[#00FFFF] mb-1">56</div>
                  <div className="text-xs text-gray-400">Critical</div>
                </div>
                
                <div className="bg-black/30 p-3 rounded-lg border border-[#BF00FF]/10 text-center">
                  <div className="text-xl font-bold text-[#FF00BF] mb-1">94</div>
                  <div className="text-xs text-gray-400">High</div>
                </div>
                
                <div className="bg-black/30 p-3 rounded-lg border border-[#BF00FF]/10 text-center">
                  <div className="text-xl font-bold text-gray-400 mb-1">90</div>
                  <div className="text-xs text-gray-400">Medium/Low</div>
                </div>
              </div>
            </RisqWidget>
            
            
            
            <RisqWidget
              title="My Account"
              description="Manage your account details and preferences"
              icon={<Settings className="w-10 h-10" />}
              variant="interactive"
              delay={0.7}
              onClick={() => navigate("/settings")}
              className="col-span-1 md:col-span-1"
            >
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#BF00FF]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-xl font-bold">U</span>
                  </div>
                  <div className="text-sm font-medium">User Account</div>
                  <div className="text-xs text-gray-400 mt-1">Click to manage</div>
                </div>
              </div>
            </RisqWidget>
          </WidgetGrid>
        </div>}
      </div>
    </div>
  );
}