/**
 * Excel Export Utilities
 * 
 * Provides sanitization and validation for Excel exports to prevent:
 * - CSV/Excel injection (formula injection)
 * - Excessive data exports (DoS protection)
 */

// Characters that can trigger formula execution in Excel
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r', '\n'];

// Maximum rows per export to prevent browser/Excel crashes
export const MAX_EXPORT_ROWS = 10000;

/**
 * Sanitizes a cell value to prevent Excel formula injection.
 * Prefixes potentially dangerous values with an apostrophe.
 */
export function sanitizeCellValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  const strValue = String(value);
  
  // Check if the value starts with a formula prefix
  if (strValue.length > 0 && FORMULA_PREFIXES.some(prefix => strValue.startsWith(prefix))) {
    // Prefix with apostrophe to prevent Excel from interpreting as formula
    return `'${strValue}`;
  }

  return strValue;
}

/**
 * Sanitizes an entire row object for Excel export.
 */
export function sanitizeRow<T extends Record<string, unknown>>(row: T): Record<string, string | number | boolean | null> {
  const sanitized: Record<string, string | number | boolean | null> = {};
  
  for (const [key, value] of Object.entries(row)) {
    sanitized[key] = sanitizeCellValue(value);
  }
  
  return sanitized;
}

/**
 * Sanitizes an array of rows for Excel export.
 * Also enforces the row limit.
 */
export function sanitizeExportData<T extends Record<string, unknown>>(
  data: T[],
  maxRows: number = MAX_EXPORT_ROWS
): {
  data: Record<string, string | number | boolean | null>[];
  truncated: boolean;
  originalCount: number;
} {
  const originalCount = data.length;
  const truncated = originalCount > maxRows;
  const limitedData = truncated ? data.slice(0, maxRows) : data;
  
  return {
    data: limitedData.map(row => sanitizeRow(row)),
    truncated,
    originalCount,
  };
}

/**
 * Formats a warning message for truncated exports.
 */
export function getTruncationWarning(originalCount: number, maxRows: number): string {
  return `O relatório foi limitado a ${maxRows.toLocaleString('pt-BR')} linhas. ` +
    `O total de registros (${originalCount.toLocaleString('pt-BR')}) excede o limite. ` +
    `Para exportar todos os dados, aplique filtros para reduzir o período ou refinar a busca.`;
}
