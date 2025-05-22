import { RisqCard, RisqCardContent, RisqCardHeader, RisqCardTitle } from "@/components/ui/risq-card";
import { RisqButton } from "@/components/ui/risq-button";
import { Clock, Play, PauseCircle, RotateCw, AlertCircle, FileDown, BarChart, Settings } from "lucide-react";

export default function NewsCapsuleHome() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RisqCard variant="glass">
          <RisqCardHeader className="pb-2">
            <RisqCardTitle className="text-lg font-medium flex items-center">
              <Clock className="mr-2 h-5 w-5 text-primary" />
              Current Capsule
            </RisqCardTitle>
          </RisqCardHeader>
          <RisqCardContent>
            <div className="text-2xl font-bold mb-1">Daily Digest</div>
            <div className="text-muted-foreground text-sm mb-4">Started 4 hours ago</div>
            <div className="mb-4 p-3 bg-muted/20 rounded-md">
              <div className="text-sm font-medium mb-1">Articles collected: 17</div>
              <div className="text-sm font-medium">Sources monitored: 35</div>
            </div>
            <div className="flex space-x-2">
              <RisqButton size="sm" variant="outline" className="gap-2">
                <PauseCircle className="h-4 w-4" />
                Pause
              </RisqButton>
              <RisqButton size="sm" variant="secondary" className="gap-2">
                <RotateCw className="h-4 w-4" />
                Refresh
              </RisqButton>
            </div>
          </RisqCardContent>
        </RisqCard>

        <RisqCard variant="glass">
          <RisqCardHeader className="pb-2">
            <RisqCardTitle className="text-lg font-medium flex items-center">
              <AlertCircle className="mr-2 h-5 w-5 text-primary" />
              Latest Alerts
            </RisqCardTitle>
          </RisqCardHeader>
          <RisqCardContent>
            <div className="space-y-3">
              <div className="p-3 bg-muted/20 rounded-md border border-primary/10">
                <div className="text-sm font-medium mb-1">Critical vulnerability found</div>
                <div className="text-xs text-muted-foreground">15 minutes ago</div>
              </div>
              <div className="p-3 bg-muted/20 rounded-md border border-primary/10">
                <div className="text-sm font-medium mb-1">Emerging threat detected</div>
                <div className="text-xs text-muted-foreground">1 hour ago</div>
              </div>
              <div className="p-3 bg-muted/20 rounded-md border border-primary/10">
                <div className="text-sm font-medium mb-1">Security advisory published</div>
                <div className="text-xs text-muted-foreground">3 hours ago</div>
              </div>
            </div>
          </RisqCardContent>
        </RisqCard>

        <RisqCard variant="glass">
          <RisqCardHeader className="pb-2">
            <RisqCardTitle className="text-lg font-medium flex items-center">
              <Play className="mr-2 h-5 w-5 text-primary" />
              Quick Actions
            </RisqCardTitle>
          </RisqCardHeader>
          <RisqCardContent>
            <div className="space-y-3">
              <RisqButton className="w-full justify-start gap-2" variant="outline">
                <Clock className="h-4 w-4" />
                Create New Capsule
              </RisqButton>
              <RisqButton className="w-full justify-start gap-2" variant="outline">
                <BarChart className="h-4 w-4" />
                Generate Summary Report
              </RisqButton>
              <RisqButton className="w-full justify-start gap-2" variant="outline">
                <Settings className="h-4 w-4" />
                Adjust Time Settings
              </RisqButton>
              <RisqButton className="w-full justify-start gap-2" variant="outline">
                <FileDown className="h-4 w-4" />
                Export Capsule Data
              </RisqButton>
            </div>
          </RisqCardContent>
        </RisqCard>
      </div>

      <RisqCard variant="glass" className="mt-6">
        <RisqCardHeader>
          <RisqCardTitle>Recent Collected Articles</RisqCardTitle>
        </RisqCardHeader>
        <RisqCardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((_, i) => (
              <div key={i} className="flex justify-between p-4 bg-muted/20 rounded-lg border border-primary/10 hover:bg-muted/30 transition-colors">
                <div>
                  <div className="font-medium mb-1">
                    {["Critical Windows Vulnerability Found", 
                      "New Ransomware Campaign Targeting Healthcare", 
                      "Zero-Day Exploit in Popular Browser", 
                      "Supply Chain Attack Affects Major Software", 
                      "Authentication Bypass in Cloud Service"][i]}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {["cybersecuritynews.com", "darkreading.com", "bleepingcomputer.com", 
                      "thehackernews.com", "krebsonsecurity.com"][i]}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {[10, 25, 45, 90, 120][i]} min ago
                </div>
              </div>
            ))}
          </div>
        </RisqCardContent>
      </RisqCard>
    </div>
  );
}