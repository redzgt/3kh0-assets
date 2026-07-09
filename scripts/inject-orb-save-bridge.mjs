import { promises as fs } from "node:fs";
import path from "node:path";

const targetDir = path.resolve(process.argv[2] || "_site");
const scriptTag = '<script defer src="/orb-save-bridge.js" data-orb-save-bridge></script>';
const marker = "data-orb-save-bridge";

let checked = 0;
let injected = 0;
let skipped = 0;

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walk(fullPath);
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      yield fullPath;
    }
  }
}

function inject(html) {
  if (html.includes(marker)) {
    return { html, changed: false };
  }

  const headClose = /<\/head\s*>/i;
  if (headClose.test(html)) {
    return {
      html: html.replace(headClose, `  ${scriptTag}\n</head>`),
      changed: true
    };
  }

  const bodyClose = /<\/body\s*>/i;
  if (bodyClose.test(html)) {
    return {
      html: html.replace(bodyClose, `  ${scriptTag}\n</body>`),
      changed: true
    };
  }

  return {
    html: `${html}\n${scriptTag}\n`,
    changed: true
  };
}

try {
  const stat = await fs.stat(targetDir);
  if (!stat.isDirectory()) {
    throw new Error(`${targetDir} is not a directory`);
  }

  for await (const htmlPath of walk(targetDir)) {
    checked += 1;
    const original = await fs.readFile(htmlPath, "utf8");
    const result = inject(original);

    if (!result.changed) {
      skipped += 1;
      continue;
    }

    await fs.writeFile(htmlPath, result.html, "utf8");
    injected += 1;
  }

  console.log(`Orb save bridge injection complete: ${injected} injected, ${skipped} skipped, ${checked} HTML files checked.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
