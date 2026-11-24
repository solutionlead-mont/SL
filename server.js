'use strict';

/**
 * Estimateur de revêtement de sol — serveur local.
 * Sert l'estimateur (public/index.html), la page admin (public/admin.html)
 * et une petite API JSON pour lire / écrire prices.json.
 *
 * Aucune dépendance : Node.js uniquement.
 *   npm start   (ou: node server.js)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const PRICES_FILE = path.join(ROOT, 'prices.json');
const CONFIG_FILE = path.join(ROOT, 'config.json');

const TYPES = ['hardwood', 'engineered', 'lvp', 'laminate', 'ceramic', 'stone', 'carpet', 'epoxy', 'polished'];
const TIERS = ['entry', 'mid', 'premium'];
const SURCHARGE_KEYS = ['commercial', 'outdoor_nonepoxy', 'outdoor_epoxy_uv', 'concrete_minor', 'concrete_major'];

const SURCHARGE_LABELS = {
  commercial: 'Commercial installation',
  outdoor_nonepoxy: 'Outdoor installation',
  outdoor_epoxy_uv: 'Outdoor UV coating',
  concrete_minor: 'Concrete — minor cracks',
  concrete_major: 'Concrete — major repair'
};

const DEFAULT_PRICES = {
  version: 1,
  updatedAt: null,
  basePricing: {
    hardwood: { entry: [6, 10], mid: [10, 16], premium: [16, 25] },
    engineered: { entry: [5, 9], mid: [9, 14], premium: [14, 22] },
    lvp: { entry: [4, 6], mid: [6, 9], premium: [9, 13] },
    laminate: { entry: [3, 6], mid: [5, 8], premium: [8, 11] },
    ceramic: { entry: [7, 11], mid: [11, 18], premium: [18, 35] },
    stone: { entry: [14, 20], mid: [20, 32], premium: [32, 60] },
    carpet: { entry: [2, 4], mid: [4, 6], premium: [6, 10] },
    epoxy: { entry: [4, 7], mid: [5, 9], premium: [8, 15] },
    polished: { entry: [3, 5], mid: [5, 8], premium: [8, 12] }
  },
  surcharges: {
    commercial: { label: SURCHARGE_LABELS.commercial, min: 2, max: 4 },
    outdoor_nonepoxy: { label: SURCHARGE_LABELS.outdoor_nonepoxy, min: 3, max: 6 },
    outdoor_epoxy_uv: { label: SURCHARGE_LABELS.outdoor_epoxy_uv, min: 1.5, max: 3 },
    concrete_minor: { label: SURCHARGE_LABELS.concrete_minor, min: 1, max: 2.5 },
    concrete_major: { label: SURCHARGE_LABELS.concrete_major, min: 3, max: 6 }
  }
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

/* ----------------------------- Configuration ----------------------------- */

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (err) {
    return {};
  }
}

const config = readConfig();
const PORT = Number(process.env.PORT || config.port || 3000);
const HOST = process.env.HOST || config.host || '127.0.0.1';
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || config.adminPassword || 'admin123');

/* ------------------------------- Prix JSON ------------------------------- */

function writePricesFile(data) {
  const tmp = PRICES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, PRICES_FILE);
}

function readPrices() {
  try {
    return JSON.parse(fs.readFileSync(PRICES_FILE, 'utf8'));
  } catch (err) {
    console.error('[prix] Lecture de prices.json impossible :', err.message);
    return { ...DEFAULT_PRICES, updatedAt: null };
  }
}

function ensurePricesFile() {
  if (!fs.existsSync(PRICES_FILE)) {
    writePricesFile({ ...DEFAULT_PRICES, updatedAt: new Date().toISOString() });
    console.log('[prix] prices.json créé avec les tarifs par défaut.');
  }
}

/* ------------------------------ Validation ------------------------------- */

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function readRate(raw) {
  if (Array.isArray(raw)) return { min: raw[0], max: raw[1] };
  if (raw && typeof raw === 'object') return { min: raw.min, max: raw.max };
  return { min: NaN, max: NaN };
}

/**
 * Valide le corps envoyé par l'admin et renvoie des données propres.
 * Accepte les paires [min,max] comme les objets {min,max}.
 */
function normalizePrices(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: ['Données invalides : un objet JSON est attendu.'], data: null };
  }

  const basePricing = {};
  const surcharges = {};

  if (!input.basePricing || typeof input.basePricing !== 'object') {
    errors.push('Section "basePricing" manquante.');
  } else {
    for (const type of TYPES) {
      basePricing[type] = {};
      for (const tier of TIERS) {
        const raw = input.basePricing[type] ? input.basePricing[type][tier] : undefined;
        const { min, max } = readRate(raw);
        const label = `${type}.${tier}`;
        if (!isNum(min) || !isNum(max)) {
          errors.push(`${label} : deux nombres sont requis (min et max).`);
          continue;
        }
        if (min < 0 || max < 0) {
          errors.push(`${label} : les prix doivent être positifs.`);
          continue;
        }
        if (min > max) {
          errors.push(`${label} : le prix minimum dépasse le prix maximum.`);
          continue;
        }
        if (max > 10000) {
          errors.push(`${label} : prix maximum trop élevé (limite 10 000 $/sqft).`);
          continue;
        }
        basePricing[type][tier] = [round2(min), round2(max)];
      }
    }
  }

  if (!input.surcharges || typeof input.surcharges !== 'object') {
    errors.push('Section "surcharges" manquante.');
  } else {
    for (const key of SURCHARGE_KEYS) {
      const raw = input.surcharges[key];
      if (!raw) {
        errors.push(`Supplément "${key}" manquant.`);
        continue;
      }
      const { min, max } = readRate(raw);
      if (!isNum(min) || !isNum(max)) {
        errors.push(`${key} : deux nombres sont requis (min et max).`);
        continue;
      }
      if (min < 0 || max < 0) {
        errors.push(`${key} : les montants doivent être positifs.`);
        continue;
      }
      if (min > max) {
        errors.push(`${key} : le montant minimum dépasse le montant maximum.`);
        continue;
      }
      if (max > 10000) {
        errors.push(`${key} : montant maximum trop élevé (limite 10 000 $/sqft).`);
        continue;
      }
      const rawLabel = typeof raw.label === 'string' ? raw.label.trim() : '';
      const label = (rawLabel || SURCHARGE_LABELS[key]).slice(0, 80);
      surcharges[key] = { label, min: round2(min), max: round2(max) };
    }
  }

  if (errors.length) return { errors, data: null };

  return {
    errors: [],
    data: {
      version: 1,
      updatedAt: new Date().toISOString(),
      basePricing,
      surcharges
    }
  };
}

/* --------------------------------- HTTP ---------------------------------- */

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
}

function readJsonBody(req, limit = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Corps de requête trop volumineux.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(Object.assign(new Error('JSON invalide.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function passwordMatches(provided) {
  const a = crypto.createHash('sha256').update(String(provided == null ? '' : provided), 'utf8').digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendText(res, 405, 'Méthode non autorisée.');
    return;
  }

  let rel;
  if (pathname === '/' || pathname === '') rel = 'index.html';
  else if (pathname === '/admin' || pathname === '/admin/') rel = 'admin.html';
  else rel = pathname.replace(/^\/+/, '');

  const filePath = path.resolve(PUBLIC_DIR, rel);
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    sendText(res, 403, 'Accès interdit.');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      sendText(res, 404, '404 — Page introuvable.');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
      'Content-Length': stat.size
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
}

async function handleApi(req, res, pathname) {
  // Lecture publique des prix (utilisée par l'estimateur).
  if (pathname === '/api/prices') {
    if (req.method === 'GET') return sendJson(res, 200, readPrices());
    if (req.method === 'PUT') {
      if (!passwordMatches(req.headers['x-admin-password'])) {
        return sendJson(res, 401, { error: 'Mot de passe incorrect.' });
      }
      const body = await readJsonBody(req);
      const { errors, data } = normalizePrices(body);
      if (errors.length) return sendJson(res, 400, { error: 'Données invalides.', details: errors });
      writePricesFile(data);
      console.log(`[admin] Tarifs mis à jour (${data.updatedAt})`);
      return sendJson(res, 200, { ok: true, data });
    }
    return sendJson(res, 405, { error: 'Méthode non autorisée.' });
  }

  // Réinitialisation aux tarifs d'origine.
  if (pathname === '/api/prices/reset') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Méthode non autorisée.' });
    if (!passwordMatches(req.headers['x-admin-password'])) {
      return sendJson(res, 401, { error: 'Mot de passe incorrect.' });
    }
    const data = { ...DEFAULT_PRICES, updatedAt: new Date().toISOString() };
    writePricesFile(data);
    console.log(`[admin] Tarifs réinitialisés (${data.updatedAt})`);
    return sendJson(res, 200, { ok: true, data });
  }

  // Connexion admin.
  if (pathname === '/api/login') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Méthode non autorisée.' });
    const body = await readJsonBody(req);
    if (!passwordMatches(body.password)) {
      await sleep(400);
      return sendJson(res, 401, { error: 'Mot de passe incorrect.' });
    }
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: 'Route inconnue.' });
}

const server = http.createServer(async (req, res) => {
  let pathname = '/';
  try {
    const url = new URL(req.url, 'http://localhost');
    pathname = decodeURIComponent(url.pathname);
  } catch (err) {
    return sendText(res, 400, 'Requête invalide.');
  }

  try {
    if (pathname.startsWith('/api/')) {
      return await handleApi(req, res, pathname);
    }
    return serveStatic(req, res, pathname);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error('[serveur] Erreur :', err);
    return sendJson(res, status, { error: err.message || 'Erreur serveur.' });
  }
});

ensurePricesFile();

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nLe port ${PORT} est déjà utilisé. Changez "port" dans config.json ou définissez la variable PORT.\n`);
  } else {
    console.error('[serveur]', err);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const shownHost = HOST === '0.0.0.0' || HOST === '127.0.0.1' ? 'localhost' : HOST;
  console.log('');
  console.log('  Estimateur  : http://' + shownHost + ':' + PORT + '/');
  console.log('  Admin       : http://' + shownHost + ':' + PORT + '/admin');
  console.log('');
  if (ADMIN_PASSWORD === 'admin123') {
    console.log('  ⚠  Mot de passe admin par défaut : admin123');
    console.log('     Modifiez-le dans config.json (ou via ADMIN_PASSWORD).');
    console.log('');
  }
  console.log('  Ctrl+C pour arrêter le serveur.');
});
