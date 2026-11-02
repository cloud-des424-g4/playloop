import { createApp as createCommunity } from '../../community/src/app.js';

const ROUTES = [['/api', 'community']];
const apps = { community: createCommunity() };

export function createApp() {
  return (req, res) => {
    const [, service] = ROUTES.find(([prefix]) => req.url.startsWith(prefix)) ?? ROUTES.at(-1);
    apps[service](req, res);
  };
}
