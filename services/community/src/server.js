import { startService } from '@playloop/kit';
import { createApp } from './app.js';

await startService({ name: 'community', defaultPort: 4002, createApp });
