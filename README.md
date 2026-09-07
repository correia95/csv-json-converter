# CSV ⇄ JSON Converter

Convert between CSV and JSON in the browser.

- **CSV → JSON**: header row → array of objects, or no header → array of arrays. RFC 4180 quoted
  fields, doubled quotes, CRLF/LF.
- **JSON → CSV**: array of objects → table (columns = union of keys), array of arrays → rows,
  single object → one row. Fields needing it are quoted and escaped.
- Delimiters: comma, semicolon, tab, pipe.
- Optional number / boolean / null detection when producing JSON.
- Swap button feeds the output back as input. Input persists in `localStorage`; options in the URL.

## Develop

```
npm install
npm run dev
npm run build
```

Engine and tests: [`src/convert.ts`](src/convert.ts) — a hand-written RFC 4180 CSV parser.
Static site on Cloudflare Workers.

Part of [Tiny Tools](https://tinytools.correia95.workers.dev).
