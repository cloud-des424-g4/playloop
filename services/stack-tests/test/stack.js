import { once } from 'node:events';
import { createServer } from 'node:http';
import { createApp as createCommunity } from '../../community/src/app.js';
import { flushOutbox } from '../../community/src/modules/outbox/outbox.service.js';
import { createApp as createIdentity } from '../../identity/src/app.js';
import { createApp as createMedia } from '../../media/src/app.js';
import { createApp as createNotifications } from '../../notifications/src/app.js';

const ROUTES = [
  ['/api/auth', 'identity'],
  ['/api/me/notifications', 'notifications'],
  ['/api/uploads', 'media'],
  ['/api', 'community'],
];
const apps = {
  community: createCommunity(),
  identity: createIdentity(),
  media: createMedia(),
  notifications: createNotifications(),
};
const servers = {};
const urls = {};

const urlName = (service) => `${service.toUpperCase()}_URL`;

function setUrls() {
  for (const [service, url] of Object.entries(urls)) process.env[urlName(service)] = url;
}

export function createApp() {
  return (req, res) => {
    const [, service] = ROUTES.find(([prefix]) => req.url.startsWith(prefix)) ?? ROUTES.at(-1);
    apps[service](req, res);
  };
}

export async function startStack() {
  for (const [service, app] of Object.entries(apps)) {
    servers[service] = createServer(app).listen(0, '127.0.0.1');
    await once(servers[service], 'listening');
    urls[service] = `http://127.0.0.1:${servers[service].address().port}`;
  }
  setUrls();
}

export async function stopStack() {
  for (const server of Object.values(servers)) {
    server.closeAllConnections();
    server.close();
  }
}

export const settle = () => flushOutbox();

export async function withServiceDown(service, run) {
  process.env[urlName(service)] = 'http://127.0.0.1:9';
  try {
    return await run();
  } finally {
    setUrls();
  }
}
