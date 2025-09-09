import React from 'react';
import { RisqWidget, WidgetActions, WidgetButton } from './RisqWidget';
import { Newspaper, AlertTriangle, TrendingUp, Radar, Search, Filter, Download, RefreshCw } from 'lucide-react';

// News Summary Widget
export function NewsSummaryWidget({ delay = 0 }) {
  return (
    <RisqWidget
      title="News Radar"
      description="Recent top security news from industry sources"
      icon={<Newspaper className="w-10 h-10" />}
      delay={delay}
      variant="standard"
      footer={
        <WidgetActions explanation="Automatically refreshes every 30 minutes">
          <WidgetButton variant="ghost">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </WidgetButton>
          <WidgetButton variant="secondary">
            <Search className="mr-2 h-4 w-4" />
            Search
          </WidgetButton>
          <WidgetButton variant="primary">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </WidgetButton>
        </WidgetActions>
      }
    >
      <div className="space-y-4">
        <div className="bg-black/30 rounded-md p-3 border border-[#BF00FF]/10">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs bg-[#BF00FF]/20 text-[#00FFFF] px-2 py-1 rounded">CVE-2025-1234</span>
            <span className="text-xs text-gray-400">2h ago</span>
          </div>
          <h4 className="font-medium mb-1">Critical vulnerability found in popular framework</h4>
          <p className="text-sm text-gray-300">Researchers have discovered a zero-day vulnerability affecting millions of devices...</p>
        </div>
        
        <div className="bg-black/30 rounded-md p-3 border border-[#BF00FF]/10">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs bg-[#5B21B6]/20 text-[#00FFFF] px-2 py-1 rounded">Industry</span>
            <span className="text-xs text-gray-400">5h ago</span>
          </div>
          <h4 className="font-medium mb-1">New ransomware targeting critical infrastructure</h4>
          <p className="text-sm text-gray-300">A sophisticated ransomware campaign is targeting energy sectors...</p>
        </div>
      </div>
    </RisqWidget>
  );
}

// Threat Alerts Widget
export function ThreatAlertsWidget({ delay = 0 }) {
  return (
    <RisqWidget
      title="Threat Alerts"
      description="Critical security alerts requiring attention"
      icon={<AlertTriangle className="w-10 h-10" />}
      variant="interactive"
      delay={delay}
      onClick={() => console.log('Navigate to detailed alerts')}
      footer={
        <WidgetActions explanation="3 new alerts detected today">
          <WidgetButton variant="ghost">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </WidgetButton>
          <WidgetButton variant="secondary">
            <Download className="mr-2 h-4 w-4" />
            Export
          </WidgetButton>
          <WidgetButton variant="primary">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </WidgetButton>
        </WidgetActions>
      }
    >
      {/* Threat Metrics Summary Row */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-md p-2 text-center">
          <div className="text-lg font-bold text-red-400">47</div>
          <div className="text-xs text-gray-400">Active Threats</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-md p-2 text-center">
          <div className="text-lg font-bold text-green-400">23</div>
          <div className="text-xs text-gray-400">Resolved Today</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-md p-2 text-center">
          <div className="text-lg font-bold text-orange-400">High</div>
          <div className="text-xs text-gray-400">Risk Score</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-2 text-center">
          <div className="text-lg font-bold text-blue-400">2m ago</div>
          <div className="text-xs text-gray-400">Last Updated</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 bg-red-500/10 p-3 rounded-md border border-red-500/20">
          <div className="text-red-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-medium text-sm">Critical Ransomware Alert</h4>
            <p className="text-xs text-gray-400">Affecting financial systems</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-yellow-500/10 p-3 rounded-md border border-yellow-500/20">
          <div className="text-yellow-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-medium text-sm">Supply Chain Compromise</h4>
            <p className="text-xs text-gray-400">Multiple vendors affected</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-blue-500/10 p-3 rounded-md border border-blue-500/20">
          <div className="text-blue-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-medium text-sm">API Security Vulnerability</h4>
            <p className="text-xs text-gray-400">Authentication bypass possible</p>
          </div>
        </div>
      </div>
    </RisqWidget>
  );
}

// Trend Analysis Widget
export function TrendAnalysisWidget({ delay = 0 }) {
  return (
    <RisqWidget
      title="Trend Analysis"
      description="Security trends based on news data"
      icon={<TrendingUp className="w-10 h-10" />}
      variant="metric"
      delay={delay}
      footer={
        <WidgetActions explanation="Based on 14-day analysis period">
          <WidgetButton variant="ghost">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </WidgetButton>
          <WidgetButton variant="secondary">
            <Download className="mr-2 h-4 w-4" />
            Export
          </WidgetButton>
          <WidgetButton variant="primary">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </WidgetButton>
        </WidgetActions>
      }
    >
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-black/30 p-4 rounded-md border border-[#BF00FF]/10 text-center">
          <div className="text-3xl font-bold text-[#00FFFF] mb-1">+24%</div>
          <div className="text-xs text-gray-400">Ransomware</div>
        </div>
        
        <div className="bg-black/30 p-4 rounded-md border border-[#BF00FF]/10 text-center">
          <div className="text-3xl font-bold text-[#FF00BF] mb-1">+18%</div>
          <div className="text-xs text-gray-400">Zero-Day</div>
        </div>
        
        <div className="bg-black/30 p-4 rounded-md border border-[#BF00FF]/10 text-center">
          <div className="text-3xl font-bold text-green-400 mb-1">-7%</div>
          <div className="text-xs text-gray-400">DDoS</div>
        </div>
        
        <div className="bg-black/30 p-4 rounded-md border border-[#BF00FF]/10 text-center">
          <div className="text-3xl font-bold text-yellow-400 mb-1">+12%</div>
          <div className="text-xs text-gray-400">Phishing</div>
        </div>
      </div>
    </RisqWidget>
  );
}

// News Radar Widget
export function NewsRadarScanWidget({ delay = 0 }) {
  return (
    <RisqWidget
      title="News Radar Scan"
      description="Configure and launch news scanning operations"
      icon={<Radar className="w-10 h-10" />}
      variant="expandable"
      delay={delay}
      footer={
        <WidgetActions explanation="Last scan completed 25 minutes ago">
          <WidgetButton variant="ghost">
            <Filter className="mr-2 h-4 w-4" />
            Configure
          </WidgetButton>
          <WidgetButton variant="secondary">
            <Search className="mr-2 h-4 w-4" />
            Schedule
          </WidgetButton>
          <WidgetButton variant="primary">
            <Radar className="mr-2 h-4 w-4" />
            Scan Now
          </WidgetButton>
        </WidgetActions>
      }
    >
      <div className="relative h-40 w-full overflow-hidden rounded-md mb-4 bg-radar-gradient flex items-center justify-center">
        <div className="scanner-effect w-full h-full absolute"></div>
        <div className="z-10 text-center">
          <div className="text-xl font-bold mb-1">24/7 Monitoring</div>
          <div className="text-sm text-gray-300">Scanning 140+ news sources</div>
        </div>
      </div>
    </RisqWidget>
  );
}