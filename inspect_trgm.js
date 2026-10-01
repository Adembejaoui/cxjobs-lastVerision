const fs = require("fs");
const path = require("path");
const root = "node_modules/prisma";
const hits = [];
function walk(d) {
  for (const e of fs.readdirSync(d)) {
    const p = path.join(d, e);
    let st;
    try { st = fs.statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p);
    else {
      if (/\.node$/.test(e)) continue;
      let c;
      try { c = fs.readFileSync(p, "latin1"); } catch { continue; }
      if (/ILIKE|LOWER\(|contains.*insensitiv|mode.*insensitiv/.test(c)) {
        hits.push(p);
      }
    }
  }
}
walk(root);
console.log("hits:", hits.length);
hits.slice(0, 40).forEach((h) => console.log(" -", h));
