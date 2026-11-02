import { startService } from '@playloop/kit';
import { createApp } from './app.js';

await startService({ name: 'media', defaultPort: 4004, createApp });
