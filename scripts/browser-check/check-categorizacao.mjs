// QA visual pontual: filtro ano/mês + paginação na fila de Categorização
// (feedback do CEO pós-Sprint 6 — botão Confirmar parecia travar).

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shotsDir = path.join(__dirname, "shots");
mkdirSync(shotsDir, { recursive: true });

const url = process.argv[2] || "http://financeirov2.duckdns.org:8080/";
const token = process.env.FINANCEIRO_SESSION_TOKEN;
if (!token) {
  console.error("defina FINANCEIRO_SESSION_TOKEN no ambiente");
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const u = new URL(url);
await context.addCookies([
  { name: "financeiro_session", value: token, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Lax" },
]);
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

await page.goto(url, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Categorizar" }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(shotsDir, "categorizacao-01-pagina1.png"), fullPage: true });

const t0 = Date.now();
await page.getByRole("button", { name: "Próxima →" }).click();
await page.waitForTimeout(600);
const elapsed = Date.now() - t0;
await page.screenshot({ path: path.join(shotsDir, "categorizacao-02-pagina2.png"), fullPage: true });

console.log(`clique em "Próxima" -> render em ~${elapsed}ms`);
console.log(consoleErrors.length ? consoleErrors.join("\n") : "no console errors");
await browser.close();
