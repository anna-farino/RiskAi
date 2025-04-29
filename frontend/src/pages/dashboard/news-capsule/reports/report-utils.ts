import { getOSConnectionContent, getOSConnectionTitle, isArticleRelevantForOS, ThreatReport } from "./os-utils";


export function getVisibleReports({
  reports,
  hiddenReports,
  targetOS
}: {
  reports: ThreatReport[] | undefined,
  hiddenReports: string[],
  targetOS: string
}) {
  return reports?.filter(report => {
    // First filter by hidden reports
    if (hiddenReports.includes(report.id)) return false;
    // If viewing "All", show all reports
    if (targetOS === "All Applications") return true;
    // When viewing specific OS, only show reports that have at least one article that impacts that OS
    return report.articles.some(article => isArticleRelevantForOS(article, targetOS));
  }) || [];
}


// Function to export reports in the News Capsule Pro format
export function exportToFormat({
  visibleReports,
  toast,
  targetOS
} : {
  visibleReports: ThreatReport[],
  toast: (args: Record<string, string | number>) => void,
  targetOS: string
}) {
  if (!visibleReports || visibleReports.length === 0) {
    toast({
      title: "No reports available",
      description: "There are no reports available to export.",
      variant: "destructive",
    });
    return;
  }
  // Create formatted text for each report
  const formattedReports = visibleReports.map(report => {
    // Filter articles based on OS selection using our smart filter
    const filteredArticles = report.articles.filter(article => 
      targetOS === "All Applications" ? true : isArticleRelevantForOS(article, targetOS)
    );
    
    // Format each article in the standard News Capsule Pro format
    const articlesContent = filteredArticles.map(article => {
      return [
        `Title: ${article.title}`,
        `Threat Name(s): ${article.threatName}`,
        `Summary: ${article.summary}`,
        `Impacts: ${getOSConnectionContent(article.impacts, targetOS, article.title)}`,
        `Attack Vector: ${article.attackVector || "Unknown attack vector"}`,
        `${getOSConnectionTitle(targetOS)}: ${getOSConnectionContent(article.microsoftConnection, targetOS, article.title)}`,
        `Source: ${article.sourcePublication}`
      ].join('\n');
    }).join('\n\n');
    
    return articlesContent;
  }).join('\n\n');
  
  // Create the final report content
  const fullContent = formattedReports;
  
  const blob = new Blob([fullContent], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `news-capsule-pro-${new Date().toISOString().split("T")[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  toast({
    title: "Report exported",
    description: "Your News Capsule Pro has been exported.",
    duration: 2000
  });
};



// Function to export reports in JSON format
export function exportToJson({
  visibleReports,
  toast,
  targetOS
}: {
  visibleReports: ThreatReport[],
  toast: (args: Record<string, string | number>) => void,
  targetOS: string
}) {
  if (!visibleReports || visibleReports.length === 0) {
    toast({
      title: "No reports available",
      description: "There are no reports available to export.",
      variant: "destructive",
    });
    return;
  }
  
  // Create a modified version of visible reports with filtered articles
  const filteredReports = visibleReports.map(report => {
    return {
      ...report,
      articles: report.articles.filter(article => 
        targetOS === "All Applications" ? true : isArticleRelevantForOS(article, targetOS)
      )
    };
  });
  
  const blob = new Blob([JSON.stringify(filteredReports, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `threat-reports-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  toast({
    title: "Reports exported",
    description: "The reports have been exported as a JSON file.",
  });
};




export function handleFormatReport(
  report: ThreatReport, 
  toast: (args: Record<string, string | number>) => void,
  targetOS: string
) {
  // Format articles in the same way as the full export
  const articlesContent = report.articles.map(article => {
    return [
      `Title: ${article.title}`,
      `Threat Name(s): ${article.threatName}`,
      `Summary: ${article.summary}`,
      `Impacts: ${article.impacts}`,
      `Attack Vector: ${article.attackVector || "Unknown attack vector"}`,
      `${getOSConnectionTitle(targetOS)}: ${getOSConnectionContent(article.microsoftConnection, targetOS)}`,
      `Source: ${article.sourcePublication}`
    ].join('\n');
  }).join('\n\n');
  
  // Create blob and download
  const blob = new Blob([articlesContent], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `my-news-capsule-${report.id}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  toast({
    title: "Report exported",
    description: `The "${report.threatName}" report has been exported to your News Capsule.`,
  });
}

