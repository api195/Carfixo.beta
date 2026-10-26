const { chromium } = require("playwright");
const fs = require("fs");
const [, , out, ...names] = process.argv;
(async () => {
  const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 640, height: 640 } });
  p.on("pageerror", e => console.log("ERR", String(e)));
  p.on("console", m => { if (m.type() === "error") console.log("CONSOLE", m.text()); });
  for (const n of names) {
    await p.goto(`http://localhost:8010/render.html?obj=${n}`);
    await p.waitForFunction(() => window.done, null, { timeout: 60000 });
    const url = await p.evaluate(() => document.querySelector("canvas").toDataURL("image/png"));
    fs.writeFileSync(`${out}/${n}.png`, Buffer.from(url.split(",")[1], "base64"));
    console.log("ok", n);
  }
  await b.close();
})();
