import { startService } from '@playloop/kit';
import { createApp } from './app.js';

await startService({ name: 'notifications', defaultPort: 4003, createApp });
