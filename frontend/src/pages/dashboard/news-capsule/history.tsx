import { RisqCard, RisqCardContent, RisqCardHeader, RisqCardTitle } from "@/components/ui/risq-card";
import { RisqButton } from "@/components/ui/risq-button";
import { Clock, Download, Eye, BarChart, Calendar } from "lucide-react";

export default function NewsCapsuleHistory() {
  // Sample history data - would come from API in real implementation
  const capsuleHistory = [
    {
      id: "cap-001",
      title: "Daily Security Digest",
      date: "May 22, 2025",
      duration: "24h",
      articleCount: 42,
      sourcesScanned: 35,
      type: "Automated"
    },
    {
      id: "cap-002",
      title: "Weekly Roundup",
      date: "May 15-21, 2025",
      duration: "7d",
      articleCount: 187,
      sourcesScanned: 35,
      type: "Scheduled"
    },
    {
      id: "cap-003",
      title: "Supply Chain Focus",
      date: "May 10, 2025",
      duration: "12h",
      articleCount: 24,
      sourcesScanned: 15,
      type: "Custom"
    },
    {
      id: "cap-004",
      title: "Vulnerability Special Report",
      date: "May 5, 2025",
      duration: "6h",
      articleCount: 31,
      sourcesScanned: 20,
      type: "Custom"
    },
    {
      id: "cap-005",
      title: "April Monthly Overview",
      date: "Apr 1-30, 2025",
      duration: "30d",
      articleCount: 732,
      sourcesScanned: 35,
      type: "Scheduled"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Capsule History</h2>
        <div className="flex gap-3">
          <RisqButton variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            Calendar View
          </RisqButton>
          <RisqButton variant="outline" className="gap-2">
            <BarChart className="h-4 w-4" />
            Analytics
          </RisqButton>
        </div>
      </div>

      <div className="grid gap-4">
        {capsuleHistory.map((capsule) => (
          <RisqCard key={capsule.id} variant="glass">
            <RisqCardContent className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-6 items-center p-4">
                <div className="md:col-span-2 flex items-center gap-3 mb-2 md:mb-0">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{capsule.title}</h3>
                    <p className="text-sm text-muted-foreground">{capsule.date}</p>
                  </div>
                </div>
                <div className="md:col-span-3 grid grid-cols-3 gap-4 text-center mb-2 md:mb-0">
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="font-medium">{capsule.duration}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Articles</p>
                    <p className="font-medium">{capsule.articleCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="font-medium">{capsule.type}</p>
                  </div>
                </div>
                <div className="md:col-span-1 flex justify-end gap-2">
                  <RisqButton variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </RisqButton>
                  <RisqButton variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </RisqButton>
                </div>
              </div>
            </RisqCardContent>
          </RisqCard>
        ))}
      </div>
    </div>
  );
}