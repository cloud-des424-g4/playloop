import { startService } from '@playloop/kit';
import { createApp } from './app.js';
import { startOutbox, stopOutbox } from './modules/outbox/outbox.service.js';

await startService({
  name: 'community',
  defaultPort: 4002,
  createApp,
  onStart: startOutbox,
  onStop: stopOutbox,
});
