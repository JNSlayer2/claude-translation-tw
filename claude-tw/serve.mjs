#!/usr/bin/env node
import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const statePath = path.join(__dirname, 'state.json');
function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

let state = readJson(statePath, {});

const PORT = Number(process.env.CLAUDE_TW_PROXY_PORT || state.proxyPort || 9223);
const cache = new Map();
let inFlight = 0;
const queue = [];
const MAX = 6;

function translateOne(text, sl = 'en', tl = 'zh-TW') {
  const key = `${sl}|${tl}|${text}`;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  return new Promise((resolve) => {
    queue.push({ text, sl, tl, key, resolve });
    drain();
  });
}

function drain() {
  while (inFlight < MAX && queue.length) {
    const job = queue.shift();
    inFlight++;
    requestGoogle(job)
      .catch(() => job.text)
      .then((out) => {
        cache.set(job.key, out);
        job.resolve(out);
      })
      .finally(() => {
        inFlight--;
        drain();
      });
  }
}

function requestGoogle({ text, sl, tl }) {
  return new Promise((resolve) => {
    const url =
      'https://translate.googleapis.com/translate_a/single' +
      `?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}` +
      `&dt=t&q=${encodeURIComponent(text)}`;
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15'
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const translated = (parsed[0] || [])
              .map((segment) => segment[0])
              .filter((segment) => typeof segment === 'string')
              .join('');
            resolve(translated || text);
          } catch {
            resolve(text);
          }
        });
      }
    );
    req.on('error', () => resolve(text));
    req.setTimeout(8000, () => {
      req.destroy();
      resolve(text);
    });
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});
  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true, cache: cache.size, port: PORT });
  }
  if (req.method === 'GET' && req.url === '/state') {
    return sendJson(res, 200, readJson(statePath, { enabled: false, proxyPort: PORT }));
  }
  if (req.method === 'GET' && req.url === '/overrides') {
    return sendJson(res, 200, readJson(path.join(__dirname, 'overrides.json'), {}));
  }
  if (req.method !== 'POST' || req.url !== '/translate') {
    return sendJson(res, 404, { error: 'not found' });
  }
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', async () => {
    try {
      const parsed = JSON.parse(body || '{}');
      const q = Array.isArray(parsed.q) ? parsed.q : [parsed.q];
      const list = q.filter((item) => typeof item === 'string');
      const result = await Promise.all(
        list.map((text) => translateOne(text, parsed.sl || 'en', parsed.tl || 'zh-TW'))
      );
      sendJson(res, 200, { result });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[claude-tw] proxy listening on http://127.0.0.1:${PORT}`);
});
