import { useEffect, useMemo, useRef, useState } from 'react';
import { CsvOptions, csvToJson, jsonToCsv } from './convert';

type Dir = 'c2j' | 'j2c';
const LS = 'csv-json-converter:v1';
const DELIMS: { id: string; label: string; value: string }[] = [
  { id: 'comma', label: 'Comma  ,', value: ',' },
  { id: 'semicolon', label: 'Semicolon  ;', value: ';' },
  { id: 'tab', label: 'Tab', value: '\t' },
  { id: 'pipe', label: 'Pipe  |', value: '|' },
];

const SAMPLE_CSV = `product,price,in_stock
Widget,9.99,true
Gadget,19.5,false
"Doohickey, deluxe",4.25,true`;

function load(): { dir: Dir; input: string; delim: string; header: boolean; typed: boolean } {
  const p = new URLSearchParams(window.location.search);
  let stored: Partial<{ input: string }> = {};
  try {
    stored = JSON.parse(localStorage.getItem(LS) || '{}');
  } catch { /* ignore */ }
  return {
    dir: (p.get('d') === 'j2c' ? 'j2c' : 'c2j') as Dir,
    input: stored.input ?? SAMPLE_CSV,
    delim: DELIMS.some((x) => x.id === p.get('sep')) ? p.get('sep')! : 'comma',
    header: p.get('h') !== '0',
    typed: p.get('t') !== '0',
  };
}

export default function App() {
  const init = useMemo(load, []);
  const [dir, setDir] = useState<Dir>(init.dir);
  const [input, setInput] = useState(init.input);
  const [delimId, setDelimId] = useState(init.delim);
  const [header, setHeader] = useState(init.header);
  const [typed, setTyped] = useState(init.typed);
  const [copied, setCopied] = useState(false);
  const copyT = useRef<number>();

  const delimiter = DELIMS.find((x) => x.id === delimId)!.value;
  const opts: CsvOptions = { delimiter, header, typed };

  useEffect(() => {
    try {
      localStorage.setItem(LS, JSON.stringify({ input }));
    } catch { /* ignore */ }
  }, [input]);

  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.set('d', dir);
    u.searchParams.set('sep', delimId);
    u.searchParams.set('h', header ? '1' : '0');
    u.searchParams.set('t', typed ? '1' : '0');
    window.history.replaceState(null, '', u.toString());
  }, [dir, delimId, header, typed]);

  const result = useMemo(() => {
    if (!input.trim()) return { out: '', rows: 0, error: undefined as string | undefined };
    if (dir === 'c2j') {
      const r = csvToJson(input, opts);
      return { out: r.json, rows: r.rowCount, error: r.error };
    }
    const r = jsonToCsv(input, opts);
    return { out: r.csv, rows: r.rowCount, error: r.error };
  }, [input, dir, delimiter, header, typed]);

  const swap = () => {
    if (result.out && !result.error) setInput(result.out);
    setDir((d) => (d === 'c2j' ? 'j2c' : 'c2j'));
  };

  const copy = () => {
    navigator.clipboard.writeText(result.out).then(() => {
      setCopied(true);
      window.clearTimeout(copyT.current);
      copyT.current = window.setTimeout(() => setCopied(false), 1200);
    }).catch(() => {});
  };

  const loadSample = () => {
    setInput(dir === 'c2j' ? SAMPLE_CSV : JSON.stringify(
      [
        { product: 'Widget', price: 9.99, in_stock: true },
        { product: 'Gadget', price: 19.5, in_stock: false },
      ],
      null,
      2,
    ));
  };

  const inLabel = dir === 'c2j' ? 'CSV in' : 'JSON in';
  const outLabel = dir === 'c2j' ? 'JSON out' : 'CSV out';

  return (
    <div className="wrap">
      <header>
        <h1>CSV ⇄ JSON Converter</h1>
        <p className="sub">
          Paste CSV to get JSON, or JSON to get CSV. Handles quoted fields, custom delimiters and
          optional type detection. Everything stays in your browser — nothing is uploaded.
        </p>
      </header>

      <div className="bar">
        <div className="seg">
          <button className={dir === 'c2j' ? 'on' : ''} onClick={() => setDir('c2j')}>CSV → JSON</button>
          <button className={dir === 'j2c' ? 'on' : ''} onClick={() => setDir('j2c')}>JSON → CSV</button>
        </div>
        <div className="opts">
          <label className="sel">
            Delimiter
            <select value={delimId} onChange={(e) => setDelimId(e.target.value)}>
              {DELIMS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </label>
          <label><input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} /> Header row</label>
          <label><input type="checkbox" checked={typed} onChange={(e) => setTyped(e.target.checked)} /> Detect numbers &amp; booleans</label>
        </div>
      </div>

      <div className="panes">
        <div className="pane">
          <div className="phead"><span>{inLabel}</span>
            <button onClick={loadSample}>Sample</button>
          </div>
          <textarea className="box mono" value={input} spellCheck={false} onChange={(e) => setInput(e.target.value)} placeholder={dir === 'c2j' ? 'a,b,c\n1,2,3' : '[{"a":1,"b":2}]'} />
        </div>

        <button className="swap" onClick={swap} title="Swap input and output">⇅</button>

        <div className="pane">
          <div className="phead">
            <span>{outLabel}{result.rows > 0 && !result.error ? ` · ${result.rows} row${result.rows === 1 ? '' : 's'}` : ''}</span>
            <button onClick={copy} disabled={!result.out || !!result.error}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <textarea className={'box mono' + (result.error ? ' err' : '')} readOnly value={result.error ? '' : result.out} placeholder="output appears here" />
          {result.error && <p className="emsg">{result.error}</p>}
        </div>
      </div>

      <section className="explain">
        <h2>How the conversion works</h2>
        <p>
          <strong>CSV → JSON:</strong> with “header row” on, the first line becomes the object keys
          and every following row becomes an object. With it off, you get an array of arrays. Quoted
          fields keep their commas and line breaks, and <code>""</code> inside a quoted field is a
          literal quote (RFC 4180).
        </p>
        <p>
          <strong>JSON → CSV:</strong> an array of objects becomes a table — the column list is the
          union of every object's keys, so rows with missing keys get empty cells. An array of
          arrays is written row for row. A single object becomes a one-row table.
        </p>
        <h3>What does “detect numbers &amp; booleans” do?</h3>
        <p>
          When converting to JSON, it turns <code>42</code> into a number, <code>true</code>/<code>false</code>
          into booleans and <code>null</code> into null, instead of leaving everything as strings.
          Turn it off to keep values exactly as written — useful for IDs with leading zeros.
        </p>
        <h3>Is my data uploaded?</h3>
        <p>
          No. The conversion runs in your browser and your input is saved only in this browser's
          local storage. The options are in the page URL; the data is not.
        </p>
        <footer>CSV ⇄ JSON Converter · client-side · no sign-up · works offline</footer>
      </section>
    </div>
  );
}
