import { startService } from '@playloop/kit';
import { createApp } from './app.js';

await startService({ name: 'identity', defaultPort: 4001, createApp });
