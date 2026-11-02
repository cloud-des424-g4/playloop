import { LambdaClient } from '@aws-sdk/client-lambda';
import { env } from './env.js';

export const lambda = new LambdaClient({ region: env.aws.region });
