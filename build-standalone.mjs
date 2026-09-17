import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const publicRoot = join(projectRoot, "public");
const outputFile = join(projectRoot, "..", "UniKit_Edinburgh_Shareable_Web.html");
const directOpenFile = join(projectRoot, "..", "UniKit_Edinburgh_直接双击打开.html");
const sendableFile = join(projectRoot, "..", "UniKit_Edinburgh.html");
const previewFile = join(publicRoot, "share.html");

const [template, styles, catalogSource, contractSource, engineSource, appSource] = await Promise.all([
  readFile(join(publicRoot, "index.html"), "utf8"),
  readFile(join(publicRoot, "styles.css"), "utf8"),
  readFile(join(publicRoot, "js", "catalog.js"), "utf8"),
  readFile(join(publicRoot, "js", "contract.js"), "utf8"),
  readFile(join(publicRoot, "js", "engine.js"), "utf8"),
  readFile(join(publicRoot, "js", "app.js"), "utf8")
]);

function makeClassicScript(source) {
  return source
    .replace(/^import\s+.*?;\s*$/gm, "")
    .replace(/^export\s+/gm, "");
}

const bundledScript = [catalogSource, contractSource, engineSource, appSource]
  .map(makeClassicScript)
  .join("\n\n");

const standalone = template
  .replace(
    /<link rel="stylesheet" href="\/styles\.css\?v=[^"]+">/,
    () => `<style>\n${styles}\n</style>`
  )
  .replace(
    /<script type="module" src="\/js\/app\.js\?v=[^"]+"><\/script>/,
    () => `<script>\n${bundledScript}\n</script>`
  )
  .replace(
    "<title>UniKit Edinburgh｜第一周采购助手</title>",
    '<title>UniKit Edinburgh｜第一周采购助手 · 可分享版</title>\n  <meta name="unikit-build" content="standalone-1.7.0">'
  );

const utf8Standalone = `\uFEFF${standalone}`;

await Promise.all([
  writeFile(outputFile, utf8Standalone, "utf8"),
  writeFile(directOpenFile, utf8Standalone, "utf8"),
  writeFile(sendableFile, utf8Standalone, "utf8"),
  writeFile(previewFile, standalone, "utf8")
]);

console.log(sendableFile);
