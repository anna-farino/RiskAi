import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RisqWidget, WidgetGrid } from '@/components/widgets/RisqWidget';
import { Newspaper, AlertTriangle, TrendingUp, Radar, Settings, BarChart4, Search, Database, ShieldAlert, Bell, Lock, LineChart } from 'lucide-react';

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
            icon={<Newspaper className="w-10 h-10 text-[#BF00FF]" />}
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
            <div className="space-y-2">
              <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs bg-[#BF00FF]/20 text-[#00FFFF] px-2 py-0.5 rounded">Alert</span>
                  <span className="text-xs text-gray-400">2h ago</span>
                </div>
                <p className="text-xs text-gray-300">Critical vulnerability found in popular framework affecting cloud services</p>
              </div>
              
              <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs bg-[#5B21B6]/20 text-[#00FFFF] px-2 py-0.5 rounded">News</span>
                  <span className="text-xs text-gray-400">5h ago</span>
                </div>
                <p className="text-xs text-gray-300">New ransomware targeting critical infrastructure in energy sector</p>
              </div>
              
              <div className="bg-black/30 rounded-lg p-2 border border-red-500/20">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">CVE</span>
                  <span className="text-xs text-gray-400">30m ago</span>
                </div>
                <p className="text-xs text-gray-300">CVE-2025-0623 discovered in widely used authentication library</p>
              </div>
              
              <div className="bg-black/30 rounded-lg p-2 border border-[#00FFFF]/20">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs bg-[#00FFFF]/20 text-[#00FFFF] px-2 py-0.5 rounded">Update</span>
                  <span className="text-xs text-gray-400">Just now</span>
                </div>
                <p className="text-xs text-gray-300">Security patches released for three major operating systems</p>
              </div>
            </div>
          </RisqWidget>
          
          <RisqWidget
            title="Threat Tracker"
            description="Critical security alerts requiring attention"
            icon={<AlertTriangle className="w-10 h-10 text-[#00FFFF]" />}
            variant="interactive"
            delay={0.2}
            onClick={() => navigate("/dashboard/threat/home")}
            footer={
              <div className="mt-auto">
                <div className="text-xs text-gray-400 mt-2 text-center">
                  3 new alerts detected today
                </div>
              </div>
            }
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                <div className="text-red-400 flex-shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-medium text-xs">Critical Ransomware Alert</h4>
                  <p className="text-xs text-gray-400">Financial systems affected</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 bg-yellow-500/10 p-2 rounded-lg border border-yellow-500/20">
                <div className="text-yellow-400 flex-shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-medium text-xs">Supply Chain Compromise</h4>
                  <p className="text-xs text-gray-400">Multiple vendors affected</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 bg-purple-500/10 p-2 rounded-lg border border-purple-500/20">
                <div className="text-purple-400 flex-shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-medium text-xs">New Zero-Day Vulnerability</h4>
                  <p className="text-xs text-gray-400">Remote execution risk</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
                <div className="text-blue-400 flex-shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-medium text-xs">Phishing Campaign Detected</h4>
                  <p className="text-xs text-gray-400">Targeting healthcare sector</p>
                </div>
              </div>
            </div>
          </RisqWidget>
          
          
          
          <RisqWidget
            title="News Capsule"
            description="Process articles for executive reports"
            icon={<Radar className="w-10 h-10 text-[#BF00FF]" />}
            variant="interactive"
            delay={0.4}
            onClick={() => navigate("/dashboard/news-capsule/home")}
            footer={
              <div className="mt-auto">
                <div className="text-xs text-gray-400 mt-2 text-center">
                  4 articles processed today
                </div>
              </div>
            }
          >
            <div className="space-y-2">
              <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Processed</span>
                  <span className="text-xs text-gray-400">15m ago</span>
                </div>
                <p className="text-xs text-gray-300">Critical infrastructure security analysis from federal advisory report</p>
              </div>
              
              <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Analyzing</span>
                  <span className="text-xs text-gray-400">45m ago</span>
                </div>
                <p className="text-xs text-gray-300">Enterprise ransomware trends and mitigation strategies study</p>
              </div>
              
              <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs bg-[#BF00FF]/20 text-[#00FFFF] px-2 py-0.5 rounded">Processed</span>
                  <span className="text-xs text-gray-400">1h ago</span>
                </div>
                <p className="text-xs text-gray-300">Zero-day vulnerability disclosure impact on supply chain security</p>
              </div>
              
              <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">Queued</span>
                  <span className="text-xs text-gray-400">2h ago</span>
                </div>
                <p className="text-xs text-gray-300">Financial sector cybersecurity regulatory compliance framework analysis</p>
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
              icon={<Settings className="w-10 h-10 text-gray-300" />}
              variant="interactive"
              delay={0.6}
              onClick={() => navigate("/dashboard/settings")}
              className="col-span-1 md:col-span-1"
            >
              <div className="space-y-2">
                <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#00FFFF]" />
                    <span className="text-xs font-medium">Data Management</span>
                  </div>
                </div>
                
                <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-[#00FFFF]" />
                    <span className="text-xs font-medium">Search Preferences</span>
                  </div>
                </div>
                
                <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#00FFFF]" />
                    <span className="text-xs font-medium">Notification Settings</span>
                  </div>
                </div>
                
                <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#00FFFF]" />
                    <span className="text-xs font-medium">Security & Privacy</span>
                  </div>
                </div>
                
                <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                  <div className="flex items-center gap-2">
                    <BarChart4 className="w-4 h-4 text-[#00FFFF]" />
                    <span className="text-xs font-medium">Analytics Preferences</span>
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
