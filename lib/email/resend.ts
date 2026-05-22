import { Resend } from "resend";

let cached: Resend | null = null;

export function getResend(): Resend {
  if (!cached) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY není nastaven");
    cached = new Resend(key);
  }
  return cached;
}
