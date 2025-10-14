/**
 * Utility functions for intelligent entity processing
 * Used by both article scraping and tech stack management
 */

/**
 * Extracts version from a software name string
 * @returns Object with cleaned name and extracted version
 * 
 * Examples:
 * - "macOS Big Sur 11.7.10" -> { name: "macOS Big Sur", version: "11.7.10" }
 * - "Apache 2.4.54" -> { name: "Apache", version: "2.4.54" }
 * - "nginx/1.22.0" -> { name: "nginx", version: "1.22.0" }
 * - "Redis v7.0.5" -> { name: "Redis", version: "7.0.5" }
 * - "PostgreSQL 15 beta 2" -> { name: "PostgreSQL", version: "15 beta 2" }
 */
export function extractVersion(input: string): { name: string; version: string | null } {
  // Common version patterns
  const versionPatterns = [
    // Standard version numbers (1.0, 2.4.3, 10.5.8)
    /\s+v?(\d+(?:\.\d+)*(?:[-\s]?(?:alpha|beta|rc|release|final|stable|dev|preview|snapshot)(?:[-\s]?\d+)?)?)/gi,
    // Version with forward slash (nginx/1.22.0)
    /\/v?(\d+(?:\.\d+)*)/gi,
    // Version in parentheses (Software (1.2.3))
    /\s*\(v?(\d+(?:\.\d+)*)\)/gi,
    // Version with dash (software-1.2.3)
    /-v?(\d+(?:\.\d+)*(?:[-\s]?(?:alpha|beta|rc|release|final|stable|dev|preview|snapshot)(?:[-\s]?\d+)?)?)/gi,
    // Year-based versions (Office 2019, Visual Studio 2022)
    /\s+(20\d{2})(?:\s|$)/gi,
    // Single major version (Python 3, Java 17)
    /\s+(\d{1,2})(?:\s|$)/gi,
  ];

  let cleanedName = input;
  let extractedVersion: string | null = null;

  // Try each pattern in order of specificity
  for (const pattern of versionPatterns) {
    const matches = input.match(pattern);
    if (matches && matches.length > 0) {
      // Get the last match (usually the most specific version)
      const versionMatch = matches[matches.length - 1];
      
      // Extract just the version number part
      const versionOnly = versionMatch.replace(/^[\s\/\-\(]+|[\s\)]+$/g, '').replace(/^v/i, '');
      
      // Only accept versions that look valid
      if (versionOnly && /\d/.test(versionOnly)) {
        extractedVersion = versionOnly;
        // Remove the version from the name
        cleanedName = input.replace(versionMatch, '').trim();
        break;
      }
    }
  }

  // Clean up the name
  cleanedName = cleanedName
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/[\(\)]/g, '') // Remove stray parentheses
    .replace(/\s*-\s*$/, '') // Remove trailing dash
    .replace(/\s*\/\s*$/, '') // Remove trailing slash
    .trim();

  return {
    name: cleanedName || input,
    version: extractedVersion
  };
}

/**
 * Software to company mapping knowledge base
 * Maps common software names to their vendor companies
 */
export const SOFTWARE_COMPANY_MAP: { [key: string]: { company: string; aliases?: string[] } } = {
  // Apple
  'macos': { company: 'Apple', aliases: ['mac os', 'mac os x', 'osx', 'os x'] },
  'ios': { company: 'Apple', aliases: ['iphone os'] },
  'ipados': { company: 'Apple', aliases: ['ipad os'] },
  'watchos': { company: 'Apple', aliases: ['watch os'] },
  'tvos': { company: 'Apple', aliases: ['tv os', 'apple tv'] },
  'safari': { company: 'Apple' },
  'xcode': { company: 'Apple' },
  'final cut': { company: 'Apple', aliases: ['final cut pro'] },
  'logic pro': { company: 'Apple' },
  
  // Microsoft
  'windows': { company: 'Microsoft', aliases: ['windows server', 'windows nt'] },
  'office': { company: 'Microsoft', aliases: ['microsoft office', 'ms office'] },
  'excel': { company: 'Microsoft', aliases: ['microsoft excel', 'ms excel'] },
  'word': { company: 'Microsoft', aliases: ['microsoft word', 'ms word'] },
  'powerpoint': { company: 'Microsoft', aliases: ['microsoft powerpoint', 'ms powerpoint'] },
  'outlook': { company: 'Microsoft', aliases: ['microsoft outlook'] },
  'teams': { company: 'Microsoft', aliases: ['microsoft teams', 'ms teams'] },
  'edge': { company: 'Microsoft', aliases: ['microsoft edge'] },
  'visual studio': { company: 'Microsoft', aliases: ['vs code', 'vscode', 'visual studio code'] },
  'azure': { company: 'Microsoft', aliases: ['microsoft azure'] },
  '.net': { company: 'Microsoft', aliases: ['dotnet', 'dot net'] },
  'sql server': { company: 'Microsoft', aliases: ['mssql', 'ms sql'] },
  
  // Google
  'chrome': { company: 'Google', aliases: ['google chrome'] },
  'android': { company: 'Google' },
  'chromeos': { company: 'Google', aliases: ['chrome os'] },
  'gmail': { company: 'Google' },
  'google workspace': { company: 'Google', aliases: ['g suite', 'gsuite'] },
  'google cloud': { company: 'Google', aliases: ['gcp', 'google cloud platform'] },
  'firebase': { company: 'Google' },
  'tensorflow': { company: 'Google' },
  'kubernetes': { company: 'Google', aliases: ['k8s'] },
  'angular': { company: 'Google' },
  
  // Amazon
  'aws': { company: 'Amazon', aliases: ['amazon web services'] },
  'ec2': { company: 'Amazon' },
  's3': { company: 'Amazon', aliases: ['amazon s3'] },
  'lambda': { company: 'Amazon', aliases: ['aws lambda'] },
  'dynamodb': { company: 'Amazon' },
  'rds': { company: 'Amazon', aliases: ['aws rds'] },
  'cloudfront': { company: 'Amazon' },
  'alexa': { company: 'Amazon' },
  
  // Meta (Facebook)
  'react': { company: 'Meta', aliases: ['reactjs', 'react.js'] },
  'react native': { company: 'Meta' },
  'pytorch': { company: 'Meta' },
  'whatsapp': { company: 'Meta' },
  'instagram': { company: 'Meta' },
  'messenger': { company: 'Meta', aliases: ['facebook messenger'] },
  
  // Oracle
  'java': { company: 'Oracle' },
  'mysql': { company: 'Oracle' },
  'virtualbox': { company: 'Oracle' },
  'oracle database': { company: 'Oracle', aliases: ['oracle db'] },
  'weblogic': { company: 'Oracle', aliases: ['oracle weblogic'] },
  'solaris': { company: 'Oracle' },
  
  // Adobe
  'photoshop': { company: 'Adobe', aliases: ['adobe photoshop'] },
  'illustrator': { company: 'Adobe', aliases: ['adobe illustrator'] },
  'premiere': { company: 'Adobe', aliases: ['adobe premiere', 'premiere pro'] },
  'after effects': { company: 'Adobe', aliases: ['adobe after effects'] },
  'acrobat': { company: 'Adobe', aliases: ['adobe acrobat'] },
  'lightroom': { company: 'Adobe', aliases: ['adobe lightroom'] },
  'xd': { company: 'Adobe', aliases: ['adobe xd'] },
  'pdf': { company: 'Adobe' },
  
  // Linux Distributions & Companies
  'ubuntu': { company: 'Canonical' },
  'red hat': { company: 'Red Hat', aliases: ['redhat', 'rhel', 'red hat enterprise linux'] },
  'fedora': { company: 'Red Hat' },
  'centos': { company: 'Red Hat' },
  'debian': { company: 'Debian Project' },
  'suse': { company: 'SUSE', aliases: ['opensuse', 'sles'] },
  'arch linux': { company: 'Arch Linux', aliases: ['arch'] },
  'mint': { company: 'Linux Mint', aliases: ['linux mint'] },
  
  // Database & Infrastructure
  'postgresql': { company: 'PostgreSQL Global Development Group', aliases: ['postgres'] },
  'mongodb': { company: 'MongoDB Inc.', aliases: ['mongo'] },
  'redis': { company: 'Redis Ltd.' },
  'elasticsearch': { company: 'Elastic', aliases: ['elastic'] },
  'kibana': { company: 'Elastic' },
  'logstash': { company: 'Elastic' },
  'docker': { company: 'Docker Inc.' },
  'jenkins': { company: 'Jenkins Project' },
  'nginx': { company: 'F5 Networks' },
  'apache': { company: 'Apache Software Foundation', aliases: ['apache http server', 'httpd'] },
  'tomcat': { company: 'Apache Software Foundation', aliases: ['apache tomcat'] },
  'kafka': { company: 'Apache Software Foundation', aliases: ['apache kafka'] },
  'spark': { company: 'Apache Software Foundation', aliases: ['apache spark'] },
  'hadoop': { company: 'Apache Software Foundation', aliases: ['apache hadoop'] },
  
  // Development Tools
  'git': { company: 'Software Freedom Conservancy' },
  'github': { company: 'Microsoft' },
  'gitlab': { company: 'GitLab Inc.' },
  'bitbucket': { company: 'Atlassian' },
  'jira': { company: 'Atlassian' },
  'confluence': { company: 'Atlassian' },
  'slack': { company: 'Salesforce', aliases: ['slack technologies'] },
  'zoom': { company: 'Zoom Video Communications' },
  'nodejs': { company: 'OpenJS Foundation', aliases: ['node.js', 'node'] },
  'npm': { company: 'GitHub' },
  'yarn': { company: 'Meta' },
  'webpack': { company: 'OpenJS Foundation' },
  'vue': { company: 'Vue.js', aliases: ['vuejs', 'vue.js'] },
  
  // Security Tools
  'wireshark': { company: 'Wireshark Foundation' },
  'metasploit': { company: 'Rapid7' },
  'nmap': { company: 'Gordon Lyon' },
  'burp suite': { company: 'PortSwigger', aliases: ['burp'] },
  'nessus': { company: 'Tenable' },
  'splunk': { company: 'Splunk Inc.' },
  
  // Other Notable Software
  'firefox': { company: 'Mozilla', aliases: ['mozilla firefox'] },
  'thunderbird': { company: 'Mozilla', aliases: ['mozilla thunderbird'] },
  'dropbox': { company: 'Dropbox Inc.' },
  'spotify': { company: 'Spotify Technology' },
  'vmware': { company: 'VMware', aliases: ['vmware workstation', 'vmware esxi'] },
  'citrix': { company: 'Citrix Systems', aliases: ['citrix workspace'] },
  'sap': { company: 'SAP SE' },
  'salesforce': { company: 'Salesforce' },
  'tableau': { company: 'Salesforce' },
  'matlab': { company: 'MathWorks' },
  'autocad': { company: 'Autodesk' },
  'maya': { company: 'Autodesk', aliases: ['autodesk maya'] },
  '3ds max': { company: 'Autodesk', aliases: ['3d studio max'] },
  'unity': { company: 'Unity Technologies' },
  'unreal engine': { company: 'Epic Games', aliases: ['unreal'] },
  'fortnite': { company: 'Epic Games' },
};

/**
 * Find the company associated with a software name
 * @param softwareName The software name to look up
 * @returns The company name if found, null otherwise
 */
export function findSoftwareCompany(softwareName: string): string | null {
  const normalized = softwareName.toLowerCase().trim();
  
  // Direct match
  if (SOFTWARE_COMPANY_MAP[normalized]) {
    return SOFTWARE_COMPANY_MAP[normalized].company;
  }
  
  // Check aliases
  for (const [key, value] of Object.entries(SOFTWARE_COMPANY_MAP)) {
    if (value.aliases) {
      for (const alias of value.aliases) {
        if (normalized === alias.toLowerCase() || normalized.includes(alias.toLowerCase())) {
          return value.company;
        }
      }
    }
    // Check if the key is contained in the software name
    if (normalized.includes(key)) {
      return value.company;
    }
  }
  
  return null;
}