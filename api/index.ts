import { createApp } from '../server/app.js';
import { VercelBlobStore } from '../server/blobStore.js';
import { MemoryStore } from '../server/memoryStore.js';
import { seedDemoData } from '../server/seed.js';
import type { StoreAdapter } from '../server/store.js';

let runtimePromise: Promise<{
  store: StoreAdapter;
  app: ReturnType<typeof createApp>;
}> | null = null;

async function getRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const dbUrl = process.env.DATABASE_URL?.trim();
      let store: StoreAdapter;
      if (dbUrl) {
        const { PostgresStore } = await import('../server/postgresStore.js');
        store = new PostgresStore(dbUrl);
      } else if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
        store = new VercelBlobStore();
      } else {
        store = new MemoryStore();
      }
      await seedDemoData(store);
      const app = createApp(store, {
        openAiKey: process.env.OPENAI_API_KEY?.trim(),
      });
      return { store, app };
    })().catch((err) => {
      runtimePromise = null;
      throw err;
    });
  }
  return runtimePromise;
}

async function dispatchToHono(req: Request): Promise<Response> {
  try {
    const { app } = await getRuntime();
    const url = new URL(req.url, 'http://localhost');
    const routeParam = url.searchParams.get('__route');
    let targetReq = req;

    if (routeParam !== null) {
      url.searchParams.delete('__route');
      url.pathname = `/api/${routeParam.replace(/^\/+/, '')}`;
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.body !== null;
      if (hasBody) {
        const bodyBuf = await req.arrayBuffer();
        targetReq = new Request(url.toString(), {
          method: req.method,
          headers: req.headers,
          body: bodyBuf,
        });
      } else {
        targetReq = new Request(url.toString(), {
          method: req.method,
          headers: req.headers,
        });
      }
    }

    return await app.fetch(targetReq);
  } catch (err) {
    console.error('[api/index] unhandled error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = dispatchToHono;
export const POST = dispatchToHono;
export const PUT = dispatchToHono;
export const PATCH = dispatchToHono;
export const DELETE = dispatchToHono;
export const OPTIONS = dispatchToHono;
export const HEAD = dispatchToHono;
