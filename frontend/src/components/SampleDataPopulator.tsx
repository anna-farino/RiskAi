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
import { useFetch } from "@/hooks/use-fetch";

const HAS_BEEN_POPULATED_KEY = 'sampleDataPopulated';

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

  const fetchWithAuth = useFetch()
  const makeRequest = async (endpoint: string, options: any = {}) => {
    const response = await fetchWithAuth(`/api${endpoint}`, {
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
      // Use the new API endpoint for status check
      const statusResponse = await makeRequest('/sample-data/status');
      
      setIsAuthorized(statusResponse.canPopulate);
      addLog(`User: ${statusResponse.userEmail}, Can populate: ${statusResponse.canPopulate}`, 
             statusResponse.canPopulate ? 'success' : 'warning');

      // Get current data counts
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
      
      return { hasData, isPopulated, status, canPopulate: statusResponse.canPopulate };
    },
    onError: (error: Error) => {
      setIsAuthorized(false);
      addLog(`Error: ${error.message}`, 'error');
    }
  });

  const populateMutation = useMutation({
    mutationFn: async () => {
      addLog(`Starting sample data population...`);
      setProgress(10);
      setProgressText('Initializing population...');

      // Use the new API endpoint
      const force = localStorage.getItem(HAS_BEEN_POPULATED_KEY) === 'true';
      const response = await makeRequest('/sample-data/populate', {
        method: 'POST',
        body: JSON.stringify({ force })
      });

      setProgress(100);
      setProgressText('Population complete!');
      
      // Mark as populated
      localStorage.setItem(HAS_BEEN_POPULATED_KEY, 'true');
      
      addLog(`Population completed! Created ${response.totalCreated} items total.`, 'success');
      addLog(`Details: ${response.details.sourcesCreated} sources, ${response.details.newsKeywordsCreated} news keywords, ${response.details.threatKeywordsCreated} threat keywords`, 'info');
      
      if (response.errors && response.errors.length > 0) {
        response.errors.forEach((error: string) => addLog(`Error: ${error}`, 'error'));
      }
      
      return response;
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
