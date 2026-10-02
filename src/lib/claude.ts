import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { RepoPolish } from "./schema";
import { SYSTEM_PROMPT } from "./prompt";

export class GenerationError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

let client: Anthropic | null = null;

export async function generatePolish(userPrompt: string): Promise<RepoPolish> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new GenerationError("Server is missing ANTHROPIC_API_KEY. Add it to .env.local and restart.", 500);
  }
  client ??= new Anthropic();

  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // On a policy decline, retry server-side on the default fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
      output_config: { effort: "medium", format: betaZodOutputFormat(RepoPolish) },
    });

    if (response.stop_reason === "refusal") {
      throw new GenerationError("Claude declined this request. Try rephrasing the description.", 422);
    }
    if (response.stop_reason === "max_tokens") {
      throw new GenerationError("Output was too long and got cut off. Try again or turn off some README options.", 502);
    }
    if (!response.parsed_output) {
      throw new GenerationError("Couldn't parse the model output. Please try again.", 502);
    }
    return response.parsed_output;
  } catch (err) {
    if (err instanceof GenerationError) throw err;
    if (err instanceof Anthropic.AuthenticationError) {
      throw new GenerationError("Invalid ANTHROPIC_API_KEY.", 500);
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new GenerationError("Rate limited by the Claude API. Wait a moment and retry.", 429);
    }
    if (err instanceof Anthropic.APIError) {
      throw new GenerationError(`Claude API error${err.status ? ` ${err.status}` : ""}: ${err.message}`, 502);
    }
    throw err;
  }
}
