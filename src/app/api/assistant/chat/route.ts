import { NextResponse } from "next/server";
import {
  buildTradingAssistantPrompt,
  localTradingAssistantAnswer,
  normalizeAssistantMessages,
  sanitizeAssistantContext,
  tradingAssistantInstructions,
  tradingAssistantModels,
} from "@/lib/tradingAssistant";
import { cleanSecret, clientIp, hasValidUserSession, rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

type OpenAiResponsePayload = {
  id?: string;
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  usage?: Record<string, unknown>;
  error?: {
    message?: string;
    type?: string;
  };
};

type CompatibleChatPayload = {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: Record<string, unknown>;
  error?: {
    message?: string;
  };
};

export async function POST(request: Request) {
  if (!hasValidUserSession(request)) {
    return NextResponse.json({ ok: false, error: "A user session is required to use analyst chat." }, { status: 401 });
  }

  const limit = rateLimit({
    key: `assistant-chat:${clientIp(request)}`,
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Analyst chat is rate-limited. Try again shortly." },
      { status: 429, headers: { "retry-after": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    );
  }

  const body = await request.json().catch(() => null) as { messages?: unknown; context?: unknown } | null;
  const messages = normalizeAssistantMessages(body?.messages);
  const context = sanitizeAssistantContext(body?.context);
  const latest = messages[messages.length - 1];
  if (!latest || latest.role !== "user") {
    return NextResponse.json({ ok: false, error: "A latest user message is required." }, { status: 400 });
  }

  const apiKey = cleanSecret(process.env.OPENAI_API_KEY);
  const localBaseUrl = cleanSecret(process.env.LOCAL_LLM_BASE_URL);
  const localModel = cleanSecret(process.env.LOCAL_LLM_MODEL) || tradingAssistantModels.local;
  const primaryModel = cleanSecret(process.env.TRADING_ASSISTANT_MODEL) || tradingAssistantModels.primary;
  const fallbackModel = cleanSecret(process.env.TRADING_ASSISTANT_FALLBACK_MODEL) || tradingAssistantModels.fallback;
  const prompt = buildTradingAssistantPrompt({ messages, context });

  const configuredModels = {
    local: localBaseUrl ? localModel : "not-configured",
    primary: primaryModel,
    fallback: fallbackModel,
    fast: tradingAssistantModels.fast,
  };

  if (localBaseUrl) {
    const local = await requestCompatibleChatAnswer({
      baseUrl: localBaseUrl,
      apiKey: cleanSecret(process.env.LOCAL_LLM_API_KEY),
      model: localModel,
      prompt,
      timeoutMs: 10000,
    }).catch((error) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : "Local LLM request failed.",
    }));

    if (local.ok) {
      return NextResponse.json({
        ok: true,
        source: "local-openai-compatible",
        model: localModel,
        answer: local.answer,
        responseId: local.responseId,
        usage: local.usage,
        advisory: "Answered through the configured free/self-hosted OpenAI-compatible LLM endpoint.",
        configuredModels,
      });
    }
  }

  if (!apiKey) {
    return NextResponse.json({
      ok: true,
      source: "local-fallback",
      model: "local-context",
      answer: localTradingAssistantAnswer({ question: latest.content, context }),
      advisory: localBaseUrl
        ? "The configured local LLM was unavailable and OPENAI_API_KEY is not configured; answer generated from deterministic cockpit context only."
        : "No paid LLM key or free local LLM endpoint is configured; answer generated from deterministic cockpit context only.",
      configuredModels,
    });
  }

  const first = await requestOpenAiAnswer({ apiKey, model: primaryModel, prompt, timeoutMs: 12000 }).catch((error) => ({
    ok: false as const,
    error: error instanceof Error ? error.message : "OpenAI request failed.",
  }));

  if (first.ok) {
    return NextResponse.json({
      ok: true,
      source: "openai-responses",
      model: primaryModel,
      answer: first.answer,
      responseId: first.responseId,
      usage: first.usage,
      configuredModels,
    });
  }

  if (fallbackModel && fallbackModel !== primaryModel) {
    const fallback = await requestOpenAiAnswer({ apiKey, model: fallbackModel, prompt, timeoutMs: 8000 }).catch((error) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : "Fallback OpenAI request failed.",
    }));
    if (fallback.ok) {
      return NextResponse.json({
        ok: true,
        source: "openai-responses",
        model: fallbackModel,
        answer: fallback.answer,
        responseId: fallback.responseId,
        usage: fallback.usage,
        advisory: `Primary model ${primaryModel} was unavailable; answered with ${fallbackModel}.`,
        configuredModels,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    source: "local-fallback",
    model: "local-context",
    answer: localTradingAssistantAnswer({ question: latest.content, context }),
    advisory: `The configured LLM path was unavailable; answered from deterministic cockpit context. ${first.error}`,
    configuredModels,
  });
}

async function requestCompatibleChatAnswer({
  baseUrl,
  apiKey,
  model,
  prompt,
  timeoutMs = 10000,
}: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  prompt: string;
  timeoutMs?: number;
}): Promise<{ ok: true; answer: string; responseId?: string; usage?: Record<string, unknown> }> {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: tradingAssistantInstructions },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 1200,
        stream: false,
      }),
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Local LLM model ${model} timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => null) as CompatibleChatPayload | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Local LLM returned HTTP ${response.status}.`);
  }

  const answer = payload?.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    throw new Error("Local LLM returned an empty analyst answer.");
  }

  return {
    ok: true,
    answer,
    responseId: payload?.id,
    usage: payload?.usage,
  };
}

async function requestOpenAiAnswer({
  apiKey,
  model,
  prompt,
  timeoutMs = 10000,
}: {
  apiKey: string;
  model: string;
  prompt: string;
  timeoutMs?: number;
}): Promise<{ ok: true; answer: string; responseId?: string; usage?: Record<string, unknown> }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: tradingAssistantInstructions,
        input: prompt,
        reasoning: { effort: "medium" },
        text: { verbosity: "medium" },
        max_output_tokens: 1200,
        store: false,
      }),
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`OpenAI model ${model} timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => null) as OpenAiResponsePayload | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `OpenAI returned HTTP ${response.status}.`);
  }

  const answer = extractResponseText(payload);
  if (!answer) {
    throw new Error("OpenAI returned an empty analyst answer.");
  }

  return {
    ok: true,
    answer,
    responseId: payload?.id,
    usage: payload?.usage,
  };
}

function extractResponseText(payload: OpenAiResponsePayload | null) {
  if (!payload) return "";
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => Boolean(text?.trim()))
      .join("\n")
      .trim() ?? ""
  );
}
