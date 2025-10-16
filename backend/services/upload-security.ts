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
   * Check if XLSX/ZIP file is safe before decompression
   */
  static async isZipSafe(buffer: Buffer): Promise<{ safe: boolean; reason?: string }> {
    try {
      // Check ZIP structure without fully decompressing
      // ZIP Central Directory is at the end of the file
      const MIN_ZIP_SIZE = 22; // Minimum size for a valid ZIP
      const MAX_ENTRY_SIZE = 50 * 1024 * 1024; // 50MB max for any single entry decompressed
      const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB max total decompressed
      
      if (buffer.length < MIN_ZIP_SIZE) {
        return { safe: false, reason: 'File too small to be valid ZIP' };
      }
      
      // Look for End of Central Directory signature (0x06054b50) from the end
      let eocdOffset = -1;
      for (let i = buffer.length - MIN_ZIP_SIZE; i >= Math.max(0, buffer.length - 65557); i--) {
        if (buffer.readUInt32LE(i) === 0x06054b50) {
          eocdOffset = i;
          break;
        }
      }
      
      if (eocdOffset === -1) {
        return { safe: false, reason: 'Invalid ZIP structure - no central directory' };
      }
      
      // Read central directory info
      const cdSize = buffer.readUInt32LE(eocdOffset + 12);
      const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
      
      // Basic sanity checks
      if (cdOffset + cdSize > buffer.length) {
        return { safe: false, reason: 'Invalid ZIP structure - central directory out of bounds' };
      }
      
      // Parse central directory to check file sizes
      let offset = cdOffset;
      let totalUncompressedSize = 0;
      let fileCount = 0;
      
      while (offset < cdOffset + cdSize) {
        // Check for central directory file header signature
        if (buffer.readUInt32LE(offset) !== 0x02014b50) {
          break; // End of central directory entries
        }
        
        // Read uncompressed size (offset 24 from header start)
        let uncompressedSize = buffer.readUInt32LE(offset + 24);
        const filenameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        
        // Check for ZIP64 format (0xFFFFFFFF indicates ZIP64)
        if (uncompressedSize === 0xFFFFFFFF) {
          // Need to parse extra field for ZIP64 sizes
          if (extraLength >= 28) { // ZIP64 extra field is at least 28 bytes
            const extraFieldStart = offset + 46 + filenameLength;
            let extraOffset = 0;
            
            while (extraOffset < extraLength - 4) {
              const headerId = buffer.readUInt16LE(extraFieldStart + extraOffset);
              const dataSize = buffer.readUInt16LE(extraFieldStart + extraOffset + 2);
              
              if (headerId === 0x0001) { // ZIP64 extra field ID
                // ZIP64 extra field structure (when all fields present):
                // 0-7: Original uncompressed size (8 bytes) 
                // 8-15: Compressed size (8 bytes)
                // 16-23: Relative header offset (8 bytes)
                // 24-27: Disk start number (4 bytes)
                
                // The actual fields present depend on which are 0xFFFFFFFF in the main header
                // We know uncompressed size is 0xFFFFFFFF, so it should be first in extra data
                if (dataSize >= 8) {
                  // Read 64-bit uncompressed size (little-endian)
                  // Offset 4 is where the actual data starts (after header ID and size)
                  const sizeLow = buffer.readUInt32LE(extraFieldStart + extraOffset + 4);
                  const sizeHigh = buffer.readUInt32LE(extraFieldStart + extraOffset + 8);
                  
                  // If high 32 bits are non-zero, it's definitely too large (>4GB)
                  if (sizeHigh > 0) {
                    return { 
                      safe: false, 
                      reason: `ZIP64 entry too large (>4GB uncompressed)` 
                    };
                  }
                  uncompressedSize = sizeLow;
                }
                break;
              }
              extraOffset += 4 + dataSize;
            }
            
            // If we couldn't find ZIP64 extra field, reject the file
            if (uncompressedSize === 0xFFFFFFFF) {
              return { 
                safe: false, 
                reason: 'Invalid ZIP64 format - cannot determine actual file sizes' 
              };
            }
          } else {
            return { 
              safe: false, 
              reason: 'Invalid ZIP64 format - missing extra field data' 
            };
          }
        }
        
        // Check for suspicious file sizes
        if (uncompressedSize > MAX_ENTRY_SIZE) {
          const filename = buffer.toString('utf8', offset + 46, offset + 46 + Math.min(filenameLength, 100));
          return { 
            safe: false, 
            reason: `ZIP entry "${filename}" too large: ${(uncompressedSize / 1024 / 1024).toFixed(2)}MB uncompressed` 
          };
        }
        
        totalUncompressedSize += uncompressedSize;
        fileCount++;
        
        // Check for too many files (potential zip bomb)
        if (fileCount > 1000) {
          return { safe: false, reason: 'Too many files in ZIP archive (>1000)' };
        }
        
        // Move to next entry
        offset += 46 + filenameLength + extraLength + commentLength;
      }
      
      // Check total uncompressed size
      if (totalUncompressedSize > MAX_TOTAL_SIZE) {
        return { 
          safe: false, 
          reason: `Total uncompressed size too large: ${(totalUncompressedSize / 1024 / 1024).toFixed(2)}MB` 
        };
      }
      
      // Check compression ratio (potential zip bomb indicator)
      const compressionRatio = totalUncompressedSize / buffer.length;
      if (compressionRatio > 100) {
        return { 
          safe: false, 
          reason: `Suspicious compression ratio: ${compressionRatio.toFixed(0)}:1` 
        };
      }
      
      return { safe: true };
    } catch (error) {
      log(`Error checking ZIP safety: ${error}`, 'error');
      return { safe: false, reason: 'Failed to analyze ZIP structure' };
    }
  }
  
  /**
   * Verify file type by checking magic bytes (file signature)
   */
  static verifyFileType(buffer: Buffer, filename: string): boolean {
    try {
      const ext = filename.split('.').pop()?.toLowerCase();
      
      if (ext === 'csv') {
        // Enhanced CSV validation - must parse as valid CSV structure
        try {
          const text = buffer.toString('utf-8');
          
          // Check for BOM and other suspicious prefixes
          if (text.startsWith('\uFEFF')) {
            // Remove BOM if present
            const cleanText = text.substring(1);
            if (cleanText.length === 0) return false;
          }
          
          // Reject if contains null bytes or control characters (except tab/newline)
          if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) {
            log('CSV contains suspicious control characters', 'warn');
            return false;
          }
          
          // Must have CSV structure - at least one delimiter and reasonable content
          const hasComma = text.includes(',');
          const hasTab = text.includes('\t');
          const hasNewline = text.includes('\n') || text.includes('\r');
          
          if (!((hasComma || hasTab) && text.length > 5 && text.length < 10_000_000)) {
            return false;
          }
          
          // Parse first few lines to verify CSV structure
          const lines = text.split(/[\r\n]+/).slice(0, 5).filter(l => l.trim());
          if (lines.length === 0) return false;
          
          // Check consistency of column count (allowing for some variation)
          const delimiter = hasComma ? ',' : '\t';
          const columnCounts = lines.map(line => line.split(delimiter).length);
          const avgColumns = columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length;
          const maxDeviation = Math.max(...columnCounts.map(c => Math.abs(c - avgColumns)));
          
          // Reject if column structure is too inconsistent
          if (maxDeviation > avgColumns * 0.5 && lines.length > 1) {
            log('CSV has inconsistent column structure', 'warn');
            return false;
          }
          
          return true;
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
  static checkRateLimit(userId: string, maxAttempts: number = 2, windowMinutes: number = 1): boolean {
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