/*
 * Copy the web app's accounting core (ledger, statements, invoices, expenses,
 * BIR calendar…) into src/books so the phone computes exactly what the web
 * does. Re-run after those files change in the web repo:
 *
 *   node scripts/sync-books.mjs [path-to-kontabooks]
 *
 * Files are copied verbatim except for import paths: "@/lib/x" becomes
 * "@/books/x", and "@/lib/sync" points at the phone's own src/books/sync.ts.
 */
import fs from "node:fs";
import path from "node:path";

const web = process.argv[2] ?? path.resolve(import.meta.dirname, "../../kontabooks");
const FILES = [
  "ledger", "coa", "lineItems", "journal", "invoices", "expenses", "assets", "pos",
  "statements", "compliance", "fiscal", "eis", "customers", "suppliers",
];
const out = path.resolve(import.meta.dirname, "../src/books");
fs.mkdirSync(out, { recursive: true });

for (const f of FILES) {
  const src = fs.readFileSync(path.join(web, "src/lib", `${f}.ts`), "utf8");
  const body = src
    .replace(/^"use client";\s*\n/, "")
    .replace(/(["'])@\/lib\/([A-Za-z-]+)\1/g, (_, q, mod) => {
      if (!FILES.includes(mod) && mod !== "sync") throw new Error(`${f}.ts imports @/lib/${mod}, which isn't copied`);
      return `${q}@/books/${mod}${q}`;
    });
  fs.writeFileSync(path.join(out, `${f}.ts`), `// Copied from the web app (src/lib/${f}.ts) by scripts/sync-books.mjs — edit it there, not here.\n${body}`);
}
console.log(`Copied ${FILES.length} files from ${web} to src/books`);
