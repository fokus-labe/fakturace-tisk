import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const PREFIX = "ftk_";

export function generateApiKey(): { key: string; prefix: string } {
  const random = crypto.randomBytes(32).toString("base64url");
  const key = `${PREFIX}${random}`;
  const prefix = key.slice(0, 12);
  return { key, prefix };
}

export async function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, 10);
}

export async function verifyApiKey(
  key: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(key, hash);
}

export function isApiKeyHeader(authorization: string | null): string | null {
  if (!authorization) return null;
  const m = authorization.match(/^Bearer\s+(ftk_[A-Za-z0-9_-]+)$/);
  return m ? m[1] : null;
}

export interface AuthenticatedApiKey {
  id: string;
  name: string;
  scopes: string[];
}

export async function authenticateApiKey(
  supabase: SupabaseClient,
  rawKey: string,
): Promise<AuthenticatedApiKey | null> {
  const { data: keys, error } = await supabase
    .from("api_keys")
    .select("id, name, scopes, key_hash")
    .is("revoked_at", null);

  if (error || !keys) return null;

  for (const k of keys) {
    if (await verifyApiKey(rawKey, k.key_hash)) {
      await supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", k.id);
      return { id: k.id, name: k.name, scopes: k.scopes ?? [] };
    }
  }
  return null;
}
