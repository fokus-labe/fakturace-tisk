import Anthropic from "@anthropic-ai/sdk";

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    "[anthropic] ANTHROPIC_API_KEY not set — OCR import will not work",
  );
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Sonnet 4.5 — dobrá kombinace cena/kvalita pro OCR účetních dokladů
export const OCR_MODEL = "claude-sonnet-4-5-20250929";
