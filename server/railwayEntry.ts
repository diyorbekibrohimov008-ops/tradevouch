import { gunzipSync } from 'node:zlib';
import { createApp } from './app';
import { MemoryStore } from './memoryStore';
import { PostgresStore } from './postgresStore';
import { seedDemoData } from './seed';

declare const Bun:
  | {
      env?: Record<string, string | undefined>;
      serve?: (opts: {
        port: number;
        hostname: string;
        fetch: (req: Request) => Promise<Response>;
      }) => void;
    }
  | undefined;

const PLACEHOLDER_PREFIX = '__TRADEVOUCH_SPA';
const SPA_GZIP_B64 = envString('TRADEVOUCH_INLINE_SPA') ?? '__TRADEVOUCH_SPA_GZIP_B64__';

function envString(key: string): string | undefined {
  if (typeof Bun !== 'undefined' && Bun.env?.[key]) return Bun.env[key];
  return typeof process !== 'undefined' ? process.env?.[key] : undefined;
}

let cachedHtml: string | null = null;
function getSpaHtml(): string {
  if (cachedHtml !== null) return cachedHtml;
  if (!SPA_GZIP_B64 || SPA_GZIP_B64.startsWith(`${PLACEHOLDER_PREFIX}_`)) {
    cachedHtml = '<!doctype html><html><body><h1>TradeVouch Dev</h1></body></html>';
    return cachedHtml;
  }
  cachedHtml = gunzipSync(Buffer.from(SPA_GZIP_B64, 'base64')).toString('utf8');
  return cachedHtml;
}

const envObj: Record<string, string | undefined> =
  typeof Bun !== 'undefined' && Bun.env ? Bun.env : process.env;

const databaseUrl = envObj.DATABASE_URL?.trim();
const openAiKey = envObj.OPENAI_API_KEY?.trim();
const store = databaseUrl ? new PostgresStore(databaseUrl) : new MemoryStore();

// Warm schema & seed idempotently; retry once if Postgres is still booting
let seedPromise: Promise<void> = seedDemoData(store)
  .then(() => undefined)
  .catch(async (err) => {
    console.error('Initial seed deferred, will retry on first request:', err?.message ?? err);
    await new Promise((r) => setTimeout(r, 1500));
    return seedDemoData(store)
      .then(() => undefined)
      .catch((err2) => {
        console.error('Retry seed failed:', err2?.message ?? err2);
      });
  });

const app = createApp(store, {
  openAiKey,
  renderSpaHtml: () => getSpaHtml(),
});

const port = Number(envObj.PORT ?? 3000);

if (typeof Bun !== 'undefined' && typeof Bun.serve === 'function') {
  Bun.serve({
    port,
    hostname: '0.0.0.0',
    fetch: async (req: Request) => {
      const { pathname } = new URL(req.url);
      if (pathname !== '/api/health') {
        await seedPromise;
      }
      return app.fetch(req);
    },
  });
  console.log(`TradeVouch listening on http://0.0.0.0:${port} (${store.storageKind})`);
}

export { app };
