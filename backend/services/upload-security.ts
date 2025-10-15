import crypto from 'crypto';
import { log } from '../utils/log';

// Magic bytes for file type verification
const FILE_SIGNATURES = {
  xlsx: [
    [0x50, 0x4B, 0x03, 0x04], // ZIP-based Office files
    [0x50, 0x4B, 0x05, 0x06], // Empty ZIP
  ],
  xls: [
    [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], // OLE Compound File
  ],
  csv: [
    // CSV doesn't have magic bytes, we'll validate by parsing
  ]
};

// Rate limiting store (in production, use Redis)
const uploadAttempts = new Map<string, { count: number; resetTime: number }>();

export class UploadSecurity {
  /**
   * Verify file type by checking magic bytes (file signature)
   */
  static verifyFileType(buffer: Buffer, filename: string): boolean {
    try {
      const ext = filename.split('.').pop()?.toLowerCase();
      
      if (ext === 'csv') {
        // CSV files don't have magic bytes, validate by trying to parse as text
        try {
          const text = buffer.toString('utf-8');
          // Check for valid UTF-8 and basic CSV structure
          return text.includes(',') || text.includes('\t') || text.includes('\n');
        } catch {
          return false;
        }
      }
      
      // Check magic bytes for Excel files
      const signatures = ext === 'xlsx' ? FILE_SIGNATURES.xlsx : 
                        ext === 'xls' ? FILE_SIGNATURES.xls : null;
      
      if (!signatures) return false;
      
      // Check if file starts with any valid signature
      for (const signature of signatures) {
        let match = true;
        for (let i = 0; i < signature.length; i++) {
          if (buffer[i] !== signature[i]) {
            match = false;
            break;
          }
        }
        if (match) return true;
      }
      
      return false;
    } catch (error) {
      log(`File type verification error: ${error}`, 'error');
      return false;
    }
  }
  
  /**
   * Sanitize spreadsheet data to prevent formula injection
   */
  static sanitizeSpreadsheetData(data: any[][]): any[][] {
    const dangerousPrefixes = ['=', '+', '-', '@', '\t=', '\t+', '\t-', '\t@', ' =', ' +', ' -', ' @'];
    
    return data.map(row => 
      row.map(cell => {
        if (typeof cell !== 'string') return cell;
        
        // Check for dangerous formula prefixes
        for (const prefix of dangerousPrefixes) {
          if (cell.startsWith(prefix)) {
            // Neutralize by prepending with single quote
            return `'${cell}`;
          }
        }
        
        // Check for embedded formulas (e.g., in concatenation)
        if (cell.includes('HYPERLINK') || 
            cell.includes('cmd|') || 
            cell.includes('powershell') ||
            cell.includes('file://') ||
            cell.includes('\\\\')) {
          // Neutralize suspicious content
          return cell.replace(/[=+\-@]/g, '');
        }
        
        return cell;
      })
    );
  }
  
  /**
   * Check rate limiting for user uploads
   */
  static checkRateLimit(userId: string, maxAttempts: number = 5, windowMinutes: number = 1): boolean {
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;
    
    const userAttempts = uploadAttempts.get(userId);
    
    if (!userAttempts || now > userAttempts.resetTime) {
      // Create new window
      uploadAttempts.set(userId, {
        count: 1,
        resetTime: now + windowMs
      });
      return true;
    }
    
    if (userAttempts.count >= maxAttempts) {
      log(`Rate limit exceeded for user ${userId}`, 'warn');
      return false;
    }
    
    userAttempts.count++;
    return true;
  }
  
  /**
   * Generate file hash for audit logging
   */
  static generateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
  
  /**
   * Audit log for upload attempts
   */
  static auditLog(userId: string, filename: string, fileHash: string, success: boolean, error?: string) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId,
      filename,
      fileHash,
      success,
      error: error || null,
      ip: 'N/A' // In production, get from req.ip
    };
    
    log(`UPLOAD_AUDIT: ${JSON.stringify(logEntry)}`, success ? 'info' : 'error');
  }
  
  /**
   * Scan for suspicious patterns in file content
   */
  static scanForSuspiciousContent(data: any[][]): { safe: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let cellCount = 0;
    let formulaCount = 0;
    let linkCount = 0;
    let scriptCount = 0;
    
    for (const row of data) {
      for (const cell of row) {
        if (!cell) continue;
        cellCount++;
        
        const cellStr = String(cell);
        
        // Check for formulas
        if (cellStr.match(/^[=+\-@]/)) {
          formulaCount++;
        }
        
        // Check for URLs/links
        if (cellStr.match(/https?:\/\/|file:\/\/|\\\\[\w]/i)) {
          linkCount++;
        }
        
        // Check for script-like content
        if (cellStr.match(/<script|javascript:|eval\(|exec\(|cmd\||powershell/i)) {
          scriptCount++;
          warnings.push(`Suspicious script-like content found in cell: ${cellStr.substring(0, 50)}...`);
        }
        
        // Check for excessive length (potential buffer overflow attempt)
        if (cellStr.length > 10000) {
          warnings.push(`Unusually long cell content detected (${cellStr.length} chars)`);
        }
      }
    }
    
    // Analyze patterns
    const formulaRatio = formulaCount / cellCount;
    const linkRatio = linkCount / cellCount;
    
    if (formulaRatio > 0.5) {
      warnings.push(`High formula ratio detected (${(formulaRatio * 100).toFixed(1)}% of cells)`);
    }
    
    if (linkRatio > 0.3) {
      warnings.push(`High link ratio detected (${(linkRatio * 100).toFixed(1)}% of cells)`);
    }
    
    if (scriptCount > 0) {
      warnings.push(`${scriptCount} cells with potential script content detected`);
    }
    
    // Determine if file is safe
    const safe = scriptCount === 0 && warnings.length < 3;
    
    return { safe, warnings };
  }
  
  /**
   * Clean up old rate limit entries (run periodically)
   */
  static cleanupRateLimits() {
    const now = Date.now();
    for (const [userId, attempts] of uploadAttempts.entries()) {
      if (now > attempts.resetTime) {
        uploadAttempts.delete(userId);
      }
    }
  }
}

// Clean up rate limits every 5 minutes
setInterval(() => {
  UploadSecurity.cleanupRateLimits();
}, 5 * 60 * 1000);