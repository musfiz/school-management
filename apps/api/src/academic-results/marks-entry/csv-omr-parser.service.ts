import { BadRequestException, Injectable } from '@nestjs/common';

export interface ParsedCsvRow {
  /** 1-based physical line number in the source text (header = 1). */
  lineNumber: number;
  cells: Record<string, string>;
}

export interface ParsedCsv {
  headers: string[];
  rows: ParsedCsvRow[];
}

export type CellKind = 'EMPTY' | 'ABSENT' | 'EXEMPT' | 'NUMBER' | 'INVALID';

export interface ClassifiedCell {
  kind: CellKind;
  value: string;
}

const ABSENT_TOKENS = new Set(['A', 'AB', 'ABS', 'ABSENT']);
const EXEMPT_TOKENS = new Set(['E', 'EX', 'EXEMPT', 'EXEMPTED', '-']);

/**
 * Parses the marks import file. CSV today (Excel/NU-style exports); the same
 * normalised `ParsedCsv` shape is what an OMR scanner bridge would produce, so
 * only `parse` would be swapped for an OMR reader.
 *
 * Cell conventions: blank/`-` = skip, `A`/`ABSENT` = absent, `E`/`EXEMPT` = exempt,
 * otherwise a numeric raw mark.
 */
@Injectable()
export class CsvOmrParserService {
  parse(text: string): ParsedCsv {
    if (!text || !text.trim()) throw new BadRequestException('The import file is empty');

    const records = this.splitRecords(text);
    if (records.length < 2) {
      throw new BadRequestException('The import file needs a header row and at least one data row');
    }

    const headers = records[0].cells.map((h) => h.trim());
    if (headers.some((h) => !h)) throw new BadRequestException('The header row has an empty column name');

    const rows: ParsedCsvRow[] = [];
    for (let i = 1; i < records.length; i += 1) {
      const record = records[i];
      const cells: Record<string, string> = {};
      headers.forEach((header, index) => {
        cells[header] = (record.cells[index] ?? '').trim();
      });
      // Skip fully blank lines (trailing newlines etc.).
      if (Object.values(cells).every((v) => v === '')) continue;
      rows.push({ lineNumber: record.lineNumber, cells });
    }

    return { headers, rows };
  }

  classifyCell(raw: string): ClassifiedCell {
    const value = (raw ?? '').trim();
    if (!value) return { kind: 'EMPTY', value };
    const upper = value.toUpperCase();
    if (ABSENT_TOKENS.has(upper)) return { kind: 'ABSENT', value };
    if (EXEMPT_TOKENS.has(upper)) return { kind: 'EXEMPT', value };
    if (/^-?\d+(\.\d+)?$/.test(value)) return { kind: 'NUMBER', value };
    return { kind: 'INVALID', value };
  }

  /** RFC4180-ish split: quoted fields, escaped quotes, CRLF or LF. */
  private splitRecords(text: string): Array<{ lineNumber: number; cells: string[] }> {
    const records: Array<{ lineNumber: number; cells: string[] }> = [];
    let cells: string[] = [];
    let field = '';
    let inQuotes = false;
    let lineNumber = 1;
    let recordLine = 1;

    const pushField = () => {
      cells.push(field);
      field = '';
    };
    const pushRecord = () => {
      pushField();
      records.push({ lineNumber: recordLine, cells });
      cells = [];
      recordLine = lineNumber;
    };

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          if (ch === '\n') lineNumber += 1;
          field += ch;
        }
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        pushField();
      } else if (ch === '\n') {
        pushRecord();
        lineNumber += 1;
        recordLine = lineNumber;
      } else if (ch === '\r') {
        // swallow; \n handles the record boundary
      } else {
        field += ch;
      }
    }
    if (field !== '' || cells.length) pushRecord();
    return records;
  }
}
