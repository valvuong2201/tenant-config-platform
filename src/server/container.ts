import path from "node:path";
import { TenantService } from "@/core/service";
import { JsonFileStore } from "@/store/jsonFileStore";
import { MemoryStore } from "@/store/memoryStore";
import { NeonStore } from "@/store/neonStore";
import type { ConfigStore } from "@/store/types";

function createStore(): ConfigStore {
  if (process.env.DATABASE_URL) return NeonStore.fromUrl(process.env.DATABASE_URL);
  if (process.env.VERCEL) {
    console.warn("DATABASE_URL is not set: using a per-instance in-memory store. Set it to a Neon connection string.");
    return new MemoryStore();
  }
  return new JsonFileStore(path.join(process.cwd(), "data", "store.json"));
}

const globalForService = globalThis as unknown as { __tenantService?: TenantService };

/** One service per server process, kept across dev hot reloads. */
export function getService(): TenantService {
  globalForService.__tenantService ??= new TenantService(createStore());
  return globalForService.__tenantService;
}
