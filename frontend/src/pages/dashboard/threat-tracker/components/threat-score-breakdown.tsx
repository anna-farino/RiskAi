import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Zap, 
  Shield, 
  AlertTriangle, 
  Package, 
  Building, 
  HardDrive,
  Target,
  Key,
  Bug,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ThreatScoreBreakdownProps {
  // Severity components (user-independent)
  threatSeverityScore: number;
  cvssScore?: number;
  exploitabilityScore?: number;
  impactScore?: number;
  attackVectorScore?: number;
  
  // Relevance components (user-specific)
  relevanceScore: number;
  softwareScore?: number;
  hardwareScore?: number;
  vendorScore?: number;
  clientScore?: number;
  keywordScore?: number;
  
  // Entity information
  entities?: {
    software?: Array<{ name: string; versionFrom?: string; versionTo?: string }>;
    hardware?: Array<{ name: string; manufacturer?: string }>;
    companies?: Array<{ name: string; type: string; mentionType?: string }>;
    cves?: Array<{ cveId: string; cvssScore?: number }>;
    threatActors?: Array<{ name: string; type?: string }>;
  };
  
  // Matched user entities
  matchedSoftware?: string[];
  matchedHardware?: string[];
  matchedCompanies?: string[];
  matchedKeywords?: string[];
}

export function ThreatScoreBreakdown({
  threatSeverityScore = 0,
  cvssScore = 0,
  exploitabilityScore = 0,
  impactScore = 0,
  attackVectorScore = 0,
  relevanceScore = 0,
  softwareScore = 0,
  hardwareScore = 0,
  vendorScore = 0,
  clientScore = 0,
  keywordScore = 0,
  entities = {},
  matchedSoftware = [],
  matchedHardware = [],
  matchedCompanies = [],
  matchedKeywords = []
}: ThreatScoreBreakdownProps) {
  
  // Helper function to get color based on score (0-10 scale)
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-red-500";
    if (score >= 6) return "text-orange-500";
    if (score >= 4) return "text-yellow-500";
    return "text-green-500";
  };
  
  // Progress bar color based on score
  const getProgressColor = (score: number) => {
    if (score >= 8) return "bg-red-500";
    if (score >= 6) return "bg-orange-500";
    if (score >= 4) return "bg-yellow-500";
    return "bg-green-500";
  };
  
  // Badge variant based on score
  const getScoreBadgeVariant = (score: number): "destructive" | "secondary" | "default" | "outline" => {
    if (score >= 8) return "destructive";
    if (score >= 6) return "secondary";
    if (score >= 4) return "default";
    return "outline";
  };

  return (
    <div className="space-y-4">
        {/* Overall Scores Summary */}
        <div className="grid grid-cols-2 gap-4">
          {/* Threat Severity Score */}
          <Card className="border-slate-700/50 bg-gradient-to-b from-transparent to-black/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-red-500" />
                Threat Severity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className={cn("text-2xl font-bold", getScoreColor(threatSeverityScore))}>
                  {threatSeverityScore.toFixed(1)}
                </span>
                <span className="text-xs text-slate-400">/10</span>
              </div>
              <Progress 
                value={threatSeverityScore * 10} 
                className="h-2 mt-2 bg-slate-700/50"
                indicatorClassName={getProgressColor(threatSeverityScore)}
              />
            </CardContent>
          </Card>
          
          {/* Relevance Score */}
          <Card className="border-slate-700/50 bg-gradient-to-b from-transparent to-black/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                Personal Relevance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className={cn("text-2xl font-bold", getScoreColor(relevanceScore))}>
                  {relevanceScore.toFixed(1)}
                </span>
                <span className="text-xs text-slate-400">/10</span>
              </div>
              <Progress 
                value={relevanceScore * 10} 
                className="h-2 mt-2 bg-slate-700/50"
                indicatorClassName={getProgressColor(relevanceScore)}
              />
            </CardContent>
          </Card>
        </div>
        
        {/* Severity Components Breakdown */}
        <Card className="border-slate-700/50 bg-gradient-to-b from-transparent to-black/10">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Severity Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cvssScore > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bug className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-300">CVSS Score</span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={cvssScore * 10} 
                    className="h-1.5 w-20 bg-slate-700/50"
                    indicatorClassName={getProgressColor(cvssScore)}
                  />
                  <span className={cn("text-xs font-medium", getScoreColor(cvssScore))}>
                    {cvssScore.toFixed(1)}
                  </span>
                </div>
              </div>
            )}
            
            {exploitabilityScore > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-300">Exploitability</span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={exploitabilityScore * 10} 
                    className="h-1.5 w-20 bg-slate-700/50"
                    indicatorClassName={getProgressColor(exploitabilityScore)}
                  />
                  <span className={cn("text-xs font-medium", getScoreColor(exploitabilityScore))}>
                    {exploitabilityScore.toFixed(1)}
                  </span>
                </div>
              </div>
            )}
            
            {impactScore > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-300">Impact</span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={impactScore * 10} 
                    className="h-1.5 w-20 bg-slate-700/50"
                    indicatorClassName={getProgressColor(impactScore)}
                  />
                  <span className={cn("text-xs font-medium", getScoreColor(impactScore))}>
                    {impactScore.toFixed(1)}
                  </span>
                </div>
              </div>
            )}
            
            {attackVectorScore > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-300">Attack Vector</span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={attackVectorScore * 10} 
                    className="h-1.5 w-20 bg-slate-700/50"
                    indicatorClassName={getProgressColor(attackVectorScore)}
                  />
                  <span className={cn("text-xs font-medium", getScoreColor(attackVectorScore))}>
                    {attackVectorScore.toFixed(1)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Relevance Components Breakdown */}
        <Card className="border-slate-700/50 bg-gradient-to-b from-transparent to-black/10">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Relevance Factors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {softwareScore > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-300">Software Match</span>
                  {matchedSoftware.length > 0 && (
                    <Badge variant="outline" className="text-xs px-1 py-0 h-4" title={matchedSoftware.join(", ")}>
                      {matchedSoftware.length}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={softwareScore * 10} 
                    className="h-1.5 w-20 bg-slate-700/50"
                    indicatorClassName={getProgressColor(softwareScore)}
                  />
                  <span className={cn("text-xs font-medium", getScoreColor(softwareScore))}>
                    {softwareScore.toFixed(1)}
                  </span>
                </div>
              </div>
            )}
            
            {hardwareScore > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-300">Hardware Match</span>
                  {matchedHardware.length > 0 && (
                    <Badge variant="outline" className="text-xs px-1 py-0 h-4" title={matchedHardware.join(", ")}>
                      {matchedHardware.length}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={hardwareScore * 10} 
                    className="h-1.5 w-20 bg-slate-700/50"
                    indicatorClassName={getProgressColor(hardwareScore)}
                  />
                  <span className={cn("text-xs font-medium", getScoreColor(hardwareScore))}>
                    {hardwareScore.toFixed(1)}
                  </span>
                </div>
              </div>
            )}
            
            {(vendorScore > 0 || clientScore > 0) && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-300">Company Match</span>
                  {matchedCompanies.length > 0 && (
                    <Badge variant="outline" className="text-xs px-1 py-0 h-4" title={matchedCompanies.join(", ")}>
                      {matchedCompanies.length}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={Math.max(vendorScore, clientScore) * 10} 
                    className="h-1.5 w-20 bg-slate-700/50"
                    indicatorClassName={getProgressColor(Math.max(vendorScore, clientScore))}
                  />
                  <span className={cn("text-xs font-medium", getScoreColor(Math.max(vendorScore, clientScore)))}>
                    {Math.max(vendorScore, clientScore).toFixed(1)}
                  </span>
                </div>
              </div>
            )}
            
            {keywordScore > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-300">Keyword Match</span>
                  {matchedKeywords.length > 0 && (
                    <Badge 
                      variant="outline" 
                      className="text-xs px-1 py-0 h-4" 
                      title={matchedKeywords.slice(0, 5).join(", ") + (matchedKeywords.length > 5 ? ` +${matchedKeywords.length - 5} more` : "")}
                    >
                      {matchedKeywords.length}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={keywordScore * 10} 
                    className="h-1.5 w-20 bg-slate-700/50"
                    indicatorClassName={getProgressColor(keywordScore)}
                  />
                  <span className={cn("text-xs font-medium", getScoreColor(keywordScore))}>
                    {keywordScore.toFixed(1)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Detected Entities */}
        {entities && Object.keys(entities).length > 0 && (
          <Card className="border-slate-700/50 bg-gradient-to-b from-transparent to-black/10">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Detected Entities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* CVEs */}
              {entities.cves && entities.cves.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Bug className="h-3.5 w-3.5 text-red-400" />
                    <span className="text-xs font-medium text-slate-300">CVEs</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {entities.cves.map((cve, idx) => (
                      <Badge 
                        key={idx}
                        variant={getScoreBadgeVariant(cve.cvssScore || 0)}
                        className="text-xs"
                      >
                        {cve.cveId}
                        {cve.cvssScore && (
                          <span className="ml-1 opacity-70">({cve.cvssScore})</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Threat Actors */}
              {entities.threatActors && entities.threatActors.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-3.5 w-3.5 text-orange-400" />
                    <span className="text-xs font-medium text-slate-300">Threat Actors</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {entities.threatActors.map((actor, idx) => (
                      <Badge 
                        key={idx}
                        variant="secondary"
                        className="text-xs bg-orange-500/10 text-orange-400 border-orange-500/30"
                      >
                        {actor.name}
                        {actor.type && (
                          <span className="ml-1 opacity-70">({actor.type})</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Software */}
              {entities.software && entities.software.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-xs font-medium text-slate-300">Affected Software</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {entities.software.slice(0, 5).map((sw, idx) => (
                      <Badge 
                        key={idx}
                        variant="outline"
                        className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30"
                      >
                        {sw.name}
                        {sw.versionFrom && (
                          <span className="ml-1 opacity-70">
                            ({sw.versionFrom}{sw.versionTo && `-${sw.versionTo}`})
                          </span>
                        )}
                      </Badge>
                    ))}
                    {entities.software.length > 5 && (
                      <span className="text-xs text-slate-400">
                        +{entities.software.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Hardware */}
              {entities.hardware && entities.hardware.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive className="h-3.5 w-3.5 text-cyan-400" />
                    <span className="text-xs font-medium text-slate-300">Affected Hardware</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {entities.hardware.slice(0, 5).map((hw, idx) => (
                      <Badge 
                        key={idx}
                        variant="outline"
                        className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                      >
                        {hw.name}
                        {hw.manufacturer && (
                          <span className="ml-1 opacity-70">({hw.manufacturer})</span>
                        )}
                      </Badge>
                    ))}
                    {entities.hardware.length > 5 && (
                      <span className="text-xs text-slate-400">
                        +{entities.hardware.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Companies */}
              {entities.companies && entities.companies.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Building className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-xs font-medium text-slate-300">Mentioned Companies</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {entities.companies.slice(0, 5).map((company, idx) => (
                      <Badge 
                        key={idx}
                        variant="outline"
                        className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30"
                      >
                        {company.name}
                        {company.mentionType && (
                          <span className="ml-1 opacity-70">({company.mentionType})</span>
                        )}
                      </Badge>
                    ))}
                    {entities.companies.length > 5 && (
                      <span className="text-xs text-slate-400">
                        +{entities.companies.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
  );
}