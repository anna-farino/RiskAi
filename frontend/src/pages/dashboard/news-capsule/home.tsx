import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Play, PauseCircle, RotateCw, AlertCircle } from "lucide-react";

export default function NewsCapsuleHome() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center">
              <Clock className="mr-2 h-5 w-5 text-primary" />
              Current Capsule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-1">Daily Digest</div>
            <div className="text-muted-foreground text-sm mb-4">Started 4 hours ago</div>
            <div className="mb-4 p-3 bg-muted rounded-md">
              <div className="text-sm font-medium mb-1">Articles collected: 17</div>
              <div className="text-sm font-medium">Sources monitored: 35</div>
            </div>
            <div className="flex space-x-2">
              <Button size="sm" variant="outline">
                <PauseCircle className="mr-2 h-4 w-4" />
                Pause
              </Button>
              <Button size="sm" variant="default">
                <RotateCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center">
              <AlertCircle className="mr-2 h-5 w-5 text-primary" />
              Latest Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-md">
                <div className="text-sm font-medium mb-1">Critical vulnerability found</div>
                <div className="text-xs text-muted-foreground">15 minutes ago</div>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <div className="text-sm font-medium mb-1">Emerging threat detected</div>
                <div className="text-xs text-muted-foreground">1 hour ago</div>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <div className="text-sm font-medium mb-1">Security advisory published</div>
                <div className="text-xs text-muted-foreground">3 hours ago</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center">
              <Play className="mr-2 h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button className="w-full justify-start" variant="outline">
                Create New Capsule
              </Button>
              <Button className="w-full justify-start" variant="outline">
                Generate Summary Report
              </Button>
              <Button className="w-full justify-start" variant="outline">
                Adjust Time Settings
              </Button>
              <Button className="w-full justify-start" variant="outline">
                Export Capsule Data
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent Collected Articles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((_, i) => (
              <div key={i} className="flex justify-between p-4 bg-muted rounded-lg">
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
        </CardContent>
      </Card>
    </div>
  );
}