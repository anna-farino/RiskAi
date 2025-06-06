import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { serverUrl } from "@/utils/server-url";
import { csfrHeader } from "@/utils/csrf-header";
import { AlertTriangle, Database, CheckCircle, XCircle, Loader2 } from "lucide-react";

const HAS_BEEN_POPULATED_KEY = 'sampleDataPopulated';

// Sample data configuration
const SAMPLE_DATA = {
  newsRadar: {
    sources: [
      { name: "AM Best", url: "https://news.ambest.com/PR/" },
      { name: "Cincinnati Business Journal", url: "https://www.bizjournals.com/cincinnati/news/" },
      { name: "Forbes", url: "https://forbes.com/news/" },
      { name: "Insurance Insider", url: "https://insuranceinsiderus.com/news" },
      { name: "Investing.com", url: "https://investing.com/news" },
      { name: "NY Times", url: "https://nytimes.com/" },
      { name: "Reinsurance News", url: "https://www.reinsurancene.ws/news" },
      { name: "The Insurer", url: "https://www.theinsurer.com/ti/news/" },
      { name: "Yahoo Finance", url: "https://finance.yahoo.com/news/" }
    ],
    keywords: [
      "AIG", "Core Specialty", "Enstar", "Lancer Insurance", "American Surety",
      "Starstone Specialty", "Starstone National", "Starstone", "Swiss Re",
      "American Life", "AMBAC", "Vanguard", "OpenAI", "President", "Market",
      "Dow", "NASDAQ", "S&P500", "Tariff", "Tesla", "Trump", "Musk"
    ]
  },
  threatTracker: {
    vendors: [
      "Access Point Technology Consulting, LLC", "Accurate Background", "Automatic Data Processing Group",
      "alangray", "Altair Integrated Services", "Amazon Web Services", "astound", "atlassian",
      "bitraser", "Bitsight Technologies", "BlackLine", "Bond-Pro, Inc.", "Chard Snyder",
      "Cigna", "Cisco", "claraanalytics", "Clearwater Analytics", "Cloudflare",
      "collectone", "contezza", "contractsafe", "Corporation Service Group of Companies",
      "darka", "Darktrace", "Datadog", "delinea", "Deloitte U.S.", "Delta Dental of Ohio",
      "Distinguished Programs Group", "DocuSign", "Duck Creek Technologies", "Dynatrace LLC",
      "Enghouse Systems", "EQuest LLC", "Flashpoint", "Focused Consulting", "GENPACT",
      "CARET", "Nitro Software, Inc.", "Green Leaf Consulting Group", "GUIDEWIRE",
      "harmon.ie", "Arbitration Forums, Inc.", "hyperexponential", "intellectdesign",
      "Jamf", "jetfiletech", "John Hancock", "Karen Clark & Company", "KEYSYS",
      "Latitude Subrogation Service", "RELX Ltd.", "Lincoln Financial Group", "Lifesize",
      "Lucid Software Inc.", "lumivero", "mandiant", "Microsoft", "Mitchell International, Inc.",
      "Northern Trust Careers", "Ntirety", "Omegablack, Inc.", "omegaconsulting", "One Inc",
      "Palo Alto Networks, Inc.", "Peakon", "CARET Legal", "profisee", "proofinsurance",
      "Proofpoint Corporation", "Qualys", "Quick Silver Systems, Inc.", "Qumodity",
      "rhymetec", "RSM US LLP", "SendGrid", "Sovos Compliance", "thequakerproject",
      "tinubu", "tkcllcconsulting", "Topbloc, LLC", "Trace3, Inc.", "TriTech Services Inc.",
      "Vision Service Plan Inc", "Ward Group", "Willis Towers Watson", "Workday",
      "Workiva Inc.", "Zscaler"
    ],
    hardware: [
      "Windows", "Mackbook", "Surfacebook", "iPhone", "Galaxy", "Dell Latitude",
      "Active Directory (AD)", "Azure", "AWS", "Entra"
    ]
  }
};

interface PopulationLog {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export default function SampleDataPopulator() {
  const [logs, setLogs] = useState<PopulationLog[]>([]);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("Ready to start");
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [dataStatus, setDataStatus] = useState<any>(null);
  
  const { data: user } = useAuth();

  const addLog = (message: string, type: PopulationLog['type'] = 'info') => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }]);
  };

  const checkEnvironmentSafety = () => {
    const viteEnv = process.env.NODE_ENV;
    if (viteEnv === 'production') {
      return {
        safe: false,
        reason: 'Cannot run in production environment (VITE_ENV=production)'
      };
    }
    
    if (!viteEnv) {
      addLog('Warning: VITE_ENV is not set, proceeding with caution', 'warning');
    }
    
    return { safe: true };
  };

  const checkUserAuthorization = () => {
    if (!user || !user.email) {
      return {
        authorized: false,
        reason: 'User email not found'
      };
    }
    
    if (!user.email.endsWith('@altairtek.com')) {
      return {
        authorized: false,
        reason: 'Only @altairtek.com email addresses are authorized to use this feature'
      };
    }
    
    return { authorized: true };
  };

  const makeRequest = async (endpoint: string, options: any = {}) => {
    const response = await fetch(`${serverUrl}/api${endpoint}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        [csfrHeader().name]: csfrHeader().token,
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  };

  const checkDataMutation = useMutation({
    mutationFn: async () => {
      // Check environment safety
      const envCheck = checkEnvironmentSafety();
      if (!envCheck.safe) {
        throw new Error(envCheck.reason);
      }

      // Check user authorization
      const authCheck = checkUserAuthorization();
      if (!authCheck.authorized) {
        throw new Error(authCheck.reason);
      }

      setIsAuthorized(true);
      addLog(`Authorized user: ${user?.email}`, 'success');

      // Check current data
      const [sources, keywords, threatKeywords] = await Promise.all([
        makeRequest('/news-tracker/sources'),
        makeRequest('/news-tracker/keywords'),
        makeRequest('/threat-tracker/keywords')
      ]);

      const status = {
        newsRadarSources: sources.length,
        newsRadarKeywords: keywords.length,
        threatTrackerKeywords: threatKeywords.length
      };

      setDataStatus(status);
      addLog(`Current data: ${status.newsRadarSources} sources, ${status.newsRadarKeywords + status.threatTrackerKeywords} keywords`);
      
      const hasData = status.newsRadarSources > 0 || status.newsRadarKeywords > 0 || status.threatTrackerKeywords > 0;
      const isPopulated = localStorage.getItem(HAS_BEEN_POPULATED_KEY) === 'true';
      
      return { hasData, isPopulated, status };
    },
    onError: (error: Error) => {
      setIsAuthorized(false);
      addLog(`Error: ${error.message}`, 'error');
    }
  });

  const populateMutation = useMutation({
    mutationFn: async () => {
      // Environment and authorization checks
      const envCheck = checkEnvironmentSafety();
      if (!envCheck.safe) {
        throw new Error(envCheck.reason);
      }

      const authCheck = checkUserAuthorization();
      if (!authCheck.authorized) {
        throw new Error(authCheck.reason);
      }

      addLog(`Starting population for authorized user: ${user?.email}`);
      
      let totalCreated = 0;
      
      // Step 1: Populate News Radar Sources
      setProgress(10);
      setProgressText('Creating News Radar sources...');
      addLog('Populating News Radar sources...');
      
      for (const source of SAMPLE_DATA.newsRadar.sources) {
        try {
          await makeRequest('/news-tracker/sources', {
            method: 'POST',
            body: JSON.stringify(source)
          });
          totalCreated++;
          addLog(`✓ Created source: ${source.name}`, 'success');
        } catch (error: any) {
          addLog(`✗ Failed to create source: ${source.name} - ${error.message}`, 'error');
        }
      }

      // Step 2: Populate News Radar Keywords
      setProgress(40);
      setProgressText('Creating News Radar keywords...');
      addLog('Populating News Radar keywords...');
      
      for (const term of SAMPLE_DATA.newsRadar.keywords) {
        try {
          await makeRequest('/news-tracker/keywords', {
            method: 'POST',
            body: JSON.stringify({ term })
          });
          totalCreated++;
          addLog(`✓ Created keyword: ${term}`, 'success');
        } catch (error: any) {
          addLog(`✗ Failed to create keyword: ${term} - ${error.message}`, 'error');
        }
      }

      // Step 3: Populate Threat Tracker Keywords (Vendors)
      setProgress(70);
      setProgressText('Creating Threat Tracker vendor keywords...');
      addLog('Populating Threat Tracker vendor keywords...');
      
      for (const term of SAMPLE_DATA.threatTracker.vendors) {
        try {
          await makeRequest('/threat-tracker/keywords', {
            method: 'POST',
            body: JSON.stringify({ term, category: 'vendor' })
          });
          totalCreated++;
          addLog(`✓ Created vendor keyword: ${term}`, 'success');
        } catch (error: any) {
          addLog(`✗ Failed to create vendor keyword: ${term} - ${error.message}`, 'error');
        }
      }

      // Step 4: Populate Threat Tracker Keywords (Hardware)
      setProgress(90);
      setProgressText('Creating Threat Tracker hardware keywords...');
      addLog('Populating Threat Tracker hardware keywords...');
      
      for (const term of SAMPLE_DATA.threatTracker.hardware) {
        try {
          await makeRequest('/threat-tracker/keywords', {
            method: 'POST',
            body: JSON.stringify({ term, category: 'hardware' })
          });
          totalCreated++;
          addLog(`✓ Created hardware keyword: ${term}`, 'success');
        } catch (error: any) {
          addLog(`✗ Failed to create hardware keyword: ${term} - ${error.message}`, 'error');
        }
      }

      setProgress(100);
      setProgressText('Population complete!');
      
      // Mark as populated
      localStorage.setItem(HAS_BEEN_POPULATED_KEY, 'true');
      
      addLog(`Population completed! Created ${totalCreated} items total.`, 'success');
      
      return totalCreated;
    },
    onError: (error: Error) => {
      addLog(`Population failed: ${error.message}`, 'error');
      setProgressText('Failed');
      setProgress(0);
    }
  });

  const handlePopulate = () => {
    if (localStorage.getItem(HAS_BEEN_POPULATED_KEY) === 'true') {
      const proceed = confirm('Sample data appears to have been populated already. Continue anyway?');
      if (!proceed) {
        addLog('Population cancelled', 'warning');
        return;
      }
    }
    
    setLogs([]);
    setProgress(0);
    populateMutation.mutate();
  };

  return (
    <div className="bg-black/40 backdrop-blur border border-[#BF00FF]/20 rounded-xl p-6 hover:border-[#BF00FF]/40 transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-lg">
          <Database className="h-5 w-5 text-[#BF00FF]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Sample Data Population</h2>
          <p className="text-sm text-gray-400">Populate your account with comprehensive sample data</p>
        </div>
      </div>

      {/* Authorization Banner */}
      <div className="mb-6 p-4 border border-yellow-500/20 bg-yellow-500/10 rounded-lg flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
        <div className="text-yellow-200 text-sm">
          <strong>Authorization Required:</strong> Only @altairtek.com users in non-production environments can use this feature.
        </div>
      </div>

      {/* Data Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-black/30 rounded-lg">
          <div className="text-lg font-bold text-white">9</div>
          <div className="text-xs text-gray-400">News Sources</div>
        </div>
        <div className="text-center p-3 bg-black/30 rounded-lg">
          <div className="text-lg font-bold text-white">22</div>
          <div className="text-xs text-gray-400">News Keywords</div>
        </div>
        <div className="text-center p-3 bg-black/30 rounded-lg">
          <div className="text-lg font-bold text-white">80+</div>
          <div className="text-xs text-gray-400">Threat Keywords</div>
        </div>
      </div>

      {/* Current Status */}
      {dataStatus && (
        <div className="mb-4 p-3 bg-black/30 rounded-lg">
          <div className="text-sm text-gray-300 mb-2">Current Data:</div>
          <div className="flex gap-4 text-xs">
            <Badge variant="outline" className="text-white">
              Sources: {dataStatus.newsRadarSources}
            </Badge>
            <Badge variant="outline" className="text-white">
              News Keywords: {dataStatus.newsRadarKeywords}
            </Badge>
            <Badge variant="outline" className="text-white">
              Threat Keywords: {dataStatus.threatTrackerKeywords}
            </Badge>
          </div>
        </div>
      )}

      {/* Progress */}
      {progress > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-300 mb-2">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="mb-2" />
          <div className="text-xs text-gray-400">{progressText}</div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 mb-4">
        <Button
          onClick={() => checkDataMutation.mutate()}
          disabled={checkDataMutation.isPending}
          variant="outline"
          size="sm"
          className="flex-1"
        >
          {checkDataMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Check Status
        </Button>
        
        <Button
          onClick={handlePopulate}
          disabled={populateMutation.isPending || isAuthorized === false}
          size="sm"
          className="flex-1 bg-[#BF00FF] hover:bg-[#BF00FF]/80"
        >
          {populateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {populateMutation.isPending ? 'Populating...' : 'Start Population'}
        </Button>
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <div className="bg-black/50 border border-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto">
          <div className="text-xs font-mono space-y-1">
            {logs.map((log, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-gray-500 shrink-0">[{log.timestamp}]</span>
                <div className="flex items-center gap-1">
                  {log.type === 'success' && <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />}
                  {log.type === 'error' && <XCircle className="h-3 w-3 text-red-500 shrink-0" />}
                  {log.type === 'warning' && <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />}
                  <span className={`${
                    log.type === 'success' ? 'text-green-400' :
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'warning' ? 'text-yellow-400' :
                    'text-gray-300'
                  } text-xs`}>
                    {log.message}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}