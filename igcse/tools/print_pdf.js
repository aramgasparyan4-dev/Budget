// Usage: node print_pdf.js <input.html> <output.pdf> <footer-title>
const { chromium } = require('playwright');

(async () => {
  const [input, output, title, mode] = process.argv.slice(2);
  const num = mode === 'nonum' ? '' :
    '<span><span class="pageNumber"></span> / <span class="totalPages"></span></span>';
  const footer = `
    <div style="width:100%; font-size:8pt; color:#888; font-family:sans-serif;
                padding:0 13mm; display:flex; justify-content:space-between;">
      <span>${title}</span>
      ${num}
    </div>`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + input);
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: output,
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: footer,
  });
  await browser.close();
})();
