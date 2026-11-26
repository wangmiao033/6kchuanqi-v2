import { randomUUID, sign } from 'node:crypto';
import { next, rewrite, waitUntil } from '@vercel/functions';

const official = 'yszt.dxyx6888.com';
const collector = 'https://hufu-admin.hnchpower.cn/cq-admin/index.php?s=/data/adanalyse/website_event';
const currentApk = '/yszt-0.1.16.apk';
const versionedApks = new Set([currentApk]);

export function trafficEvent(request, url) {
  if (url.hostname !== official || request.method !== 'GET') return null;
  const purpose = request.headers.get('sec-purpose') || request.headers.get('purpose') || '';
  const agent = request.headers.get('user-agent') || '';
  if (/prefetch|prerender/i.test(purpose) || /bot|crawler|spider|preview|curl\/|wget\//i.test(agent)) return null;

  let action;
  if (url.pathname === '/' || url.pathname === '/index.html') action = 'landing';
  else if (url.pathname === '/go.html') action = 'go';
  else if (url.pathname === '/download.apk' || versionedApks.has(url.pathname)) {
    const range = request.headers.get('range');
    if (range && !/^bytes=0-/i.test(range)) return null;
    action = 'apk';
  }
  if (!action) return null;
  const tag = url.searchParams.get('src');
  const source = tag === 'dxyx_launch' || tag === 'qa' ? tag : 'untagged';
  return { id: randomUUID().replaceAll('-', ''), time: Math.floor(Date.now() / 1000), source, action };
}

async function record(event, key) {
  try {
    const body = JSON.stringify(event);
    const signature = sign('sha256', Buffer.from(body), key).toString('base64');
    await fetch(collector, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-yszt-signature': signature },
      body,
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // Traffic recording is best effort so download delivery stays available.
  }
}

export default function proxy(request) {
  const url = new URL(request.url);
  const event = trafficEvent(request, url);
  const key = process.env.YSZT_TRAFFIC_SIGNING_KEY;
  if (event && key) waitUntil(record(event, key));
  if (url.pathname === '/download.apk') {
    url.pathname = currentApk;
    return rewrite(url);
  }
  return next();
}
