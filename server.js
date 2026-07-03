import express from 'express';
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const app = express();
app.use(express.json());

const API_TOKEN = process.env.WORKER_TOKEN || 'change-moi';
const CAPTURE_DIR = '/app/captures';

app.use((req, res, next) => {
  if (req.headers.authorization !== `Bearer ${API_TOKEN}`) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  next();
});

app.post('/capture', async (req, res) => {
  const { url, label = 'capture', viewport = 'desktop' } = req.body;
  if (!url) return res.status(400).json({ error: 'url manquante' });

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: viewport === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    userAgent: 'ChaboMaintenanceBot/1.0 (Playwright)',
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      networkErrors.push({ url: resp.url(), status: resp.status() });
    }
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.addStyleTag({
      content: `*, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }`,
    });
    await page.waitForTimeout(1500);

    const filename = `${label}-${viewport}-${Date.now()}.png`;
    const filepath = path.join(CAPTURE_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: true });

    res.json({
      ok: true,
      screenshot: filename,
      console_errors: consoleErrors,
      network_errors: networkErrors,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, console_errors: consoleErrors });
  } finally {
    await browser.close();
  }
});

app.get('/capture/:filename', (req, res) => {
  const filepath = path.join(CAPTURE_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Introuvable' });
  res.sendFile(filepath);
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(3000, () => console.log('Worker Playwright prêt sur :3000'));
