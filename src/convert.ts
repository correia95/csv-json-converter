// CSV <-> JSON. CSV parsing follows RFC 4180 (quoted fields, doubled quotes,
// CRLF or LF), with a configurable delimiter.

export interface CsvOptions {
  delimiter: string; // ',' ';' '\t' '|'
  header: boolean; // first row is column names
  typed: boolean; // coerce numbers / booleans / null when parsing to JSON
}

export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const s = text;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delimiter) {
      pushField();
      i++;
      continue;
    }
    if (c === '\r') {
      if (s[i + 1] === '\n') i++;
      pushRow();
      i++;
      continue;
    }
    if (c === '\n') {
      pushRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // trailing field / row (unless the file ended on a newline with nothing after)
  if (field !== '' || row.length > 0) pushRow();
  return rows;
}

function coerce(v: string): unknown {
  if (v === '') return '';
  const t = v.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t) && Number.isFinite(Number(t))) return Number(t);
  return v;
}

export function csvToJson(text: string, o: CsvOptions): { json: string; rowCount: number; error?: string } {
  const grid = parseCsv(text.replace(/^﻿/, ''), o.delimiter).filter((r) => !(r.length === 1 && r[0] === ''));
  if (grid.length === 0) return { json: '[]', rowCount: 0 };

  const cast = (v: string) => (o.typed ? coerce(v) : v);

  if (o.header) {
    const keys = grid[0];
    const out = grid.slice(1).map((r) => {
      const obj: Record<string, unknown> = {};
      keys.forEach((k, i) => {
        obj[k || `column${i + 1}`] = cast(r[i] ?? '');
      });
      return obj;
    });
    return { json: JSON.stringify(out, null, 2), rowCount: out.length };
  }
  const out = grid.map((r) => r.map(cast));
  return { json: JSON.stringify(out, null, 2), rowCount: out.length };
}

function esc(v: unknown, delimiter: string): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (s.includes('"') || s.includes(delimiter) || s.includes('\n') || s.includes('\r')) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function jsonToCsv(text: string, o: CsvOptions): { csv: string; rowCount: number; error?: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { csv: '', rowCount: 0, error: (e as Error).message };
  }
  if (!Array.isArray(data)) {
    if (data && typeof data === 'object') data = [data];
    else return { csv: '', rowCount: 0, error: 'JSON must be an array (or a single object)' };
  }
  const arr = data as unknown[];
  if (arr.length === 0) return { csv: '', rowCount: 0 };

  const d = o.delimiter;
  const allObjects = arr.every((x) => x && typeof x === 'object' && !Array.isArray(x));

  if (allObjects) {
    const keys: string[] = [];
    for (const row of arr) for (const k of Object.keys(row as object)) if (!keys.includes(k)) keys.push(k);
    const lines: string[] = [];
    if (o.header) lines.push(keys.map((k) => esc(k, d)).join(d));
    for (const row of arr) {
      lines.push(keys.map((k) => esc((row as Record<string, unknown>)[k], d)).join(d));
    }
    return { csv: lines.join('\r\n'), rowCount: arr.length };
  }

  // array of arrays / primitives
  const lines = arr.map((row) =>
    Array.isArray(row) ? row.map((c) => esc(c, d)).join(d) : esc(row, d),
  );
  return { csv: lines.join('\r\n'), rowCount: arr.length };
}
