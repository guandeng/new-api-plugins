const model = "gemini-3.8-flash-lite-tts";
const transcriptionModel = "gemini-3.5-transcribe";
const wavHeaderBytes = 44;
const wavBytesPerSecond = 24000 * 2;
const maxTranscriptionBytes = 600 * wavBytesPerSecond + wavHeaderBytes;
const baseURL = "https://generativelanguage.googleapis.com";

export const meta = {
  apiVersion: 1,
  key: "gemini-voice",
  name: "Gemini 录音复刻",
  version: "1.0.11",
  author: { name: "Plugin Maintainers" },
  baseUrl: baseURL,
  auth: "api_key",
  models: ["gemini-3.8-flash-tts", model, transcriptionModel],
  usageProfiles: [{
    models: [model, transcriptionModel],
    schema: {
      input_tokens: { type: "number", unit: "token", description: { en: "Input tokens", zh: "输入 Token" } },
      output_tokens: { type: "number", unit: "token", description: { en: "Output tokens", zh: "输出 Token" } },
    },
    examples: [{ label: "Token 用量示例", facts: { input_tokens: 100, output_tokens: 500 } }],
  }],
  fetchMode: "per_task",
  routes: [
    { method: "POST", path: "/v1beta/voices", type: "submit", decode: "createVoice", render: "result", retainResult: false },
    { method: "GET", path: "/v1beta/voices", type: "submit", decode: "listVoices", render: "result", retainResult: false },
    { method: "POST", path: "/v1beta/interactions", type: "submit", decode: "synthesize", render: "result", retainResult: false },
    { method: "POST", path: "/v1beta/transcriptions", type: "submit", decode: "transcribe", render: "result", retainResult: false },
  ],
};

function jsonBody(ctx) {
  const body = ctx.body.value;
  if (ctx.body.kind !== "json" || !body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Expected a JSON object");
  }
  return body;
}

export const native = {
  createVoice(ctx) {
    const body = jsonBody(ctx);
    const voice = body.voice;
    if (typeof voice?.model !== "string" || voice.model.trim() === "" || voice.type !== "replicated") {
      throw new Error("Expected a replicated voice with a model");
    }
    if (!voice.replicated?.source_audio?.data || !voice.replicated?.consent_audio?.data) {
      throw new Error("Reference audio and consent audio are required");
    }
    return { kind: "submit", model: voice.model, action: "create-voice", requestBody: body };
  },
  listVoices(ctx) {
    if (ctx.query.type?.some((type) => type !== "replicated")) {
      throw new Error("Only replicated voices can be listed");
    }
    const requestBody = {};
    for (const name of ["pageSize", "pageToken"]) {
      const value = ctx.query[name]?.[0];
      if (value) requestBody[name] = value;
    }
    return { kind: "submit", model, action: "list-voices", requestBody };
  },
  synthesize(ctx) {
    const body = jsonBody(ctx);
    if (body.model !== model || body.response_format?.type !== "audio") {
      throw new Error("Expected an audio response for " + model);
    }
    if (body.stream === true || body.background === true) {
      throw new Error("Expected a synchronous synthesis request");
    }
    return { kind: "submit", model, action: "synthesize", requestBody: body };
  },
  transcribe(ctx) {
    if (ctx.body.kind === "json") {
      const { audio_base64: audioBase64 } = jsonBody(ctx);
      if (typeof audioBase64 !== "string" || audioBase64.length > Math.ceil(maxTranscriptionBytes / 3) * 4 ||
          audioBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(audioBase64)) {
        throw new Error("Expected a Base64 WAV in the audio_base64 field");
      }
      const padding = audioBase64.endsWith("==") ? 2 : audioBase64.endsWith("=") ? 1 : 0;
      const size = audioBase64.length / 4 * 3 - padding;
      if (size <= wavHeaderBytes || size > maxTranscriptionBytes) {
        throw new Error("Expected WAV audio within the supported size");
      }
      return { kind: "submit", model: transcriptionModel, action: "transcribe", requestBody: { audioBase64, audioBytes: size } };
    }
    if (ctx.body.kind !== "multipart" || ctx.body.files.length !== 1) {
      throw new Error("Expected one WAV file in the audio field");
    }
    const [audio] = ctx.body.files;
    if (audio.field !== "audio" || audio.mimeType !== "audio/wav" || audio.size <= wavHeaderBytes || audio.size > maxTranscriptionBytes) {
      throw new Error("Expected WAV audio within the supported size");
    }
    return { kind: "submit", model: transcriptionModel, action: "transcribe", requestBody: { audioRef: audio.ref, audioBytes: audio.size } };
  },
  result(_ctx, task) {
    return task.data;
  },
  error(_ctx, error) {
    return {
      __status: error.httpStatus,
      __body: { error: { code: error.code, message: error.message } },
    };
  },
};

export function buildSubmitRequest(ctx) {
  const headers = { "x-goog-api-key": ctx.apiKey, Accept: "application/json", "Content-Type": "application/json" };
  switch (ctx.action) {
    case "create-voice":
      return { url: baseURL + "/v1beta/voices", method: "POST", headers, body: ctx.requestBody };
    case "list-voices": {
      let query = "type=replicated";
      for (const name of ["pageSize", "pageToken"]) {
        const value = ctx.requestBody[name];
        if (value !== undefined) query += "&" + name + "=" + encodeURIComponent(value);
      }
      return { url: baseURL + "/v1beta/voices?" + query, method: "GET", headers };
    }
    case "synthesize":
      return { url: baseURL + "/v1beta/interactions", method: "POST", headers, body: ctx.requestBody };
    case "transcribe":
      return {
        url: baseURL + "/v1beta/interactions",
        method: "POST",
        headers,
        body: {
          model: transcriptionModel,
          store: false,
          input: [{
            type: "audio",
            mime_type: "audio/wav",
            data: ctx.requestBody.audioBase64 ?? { __fileRef: ctx.requestBody.audioRef, encoding: "base64", maxBytes: maxTranscriptionBytes },
          }],
          generation_config: {
            transcription_config: { mode: { type: "verbatim", timestamp_granularities: ["word"] } },
          },
        },
      };
    default:
      throw new Error("Unsupported Gemini voice action");
  }
}

export function parseSubmitResponse(ctx, response) {
  return {
    taskId: ctx.publicTaskId,
    taskData: response.body,
    immediate: { status: "SUCCESS", progress: "100%" },
  };
}

export function extractUsage(ctx) {
  if (ctx.usagePurpose === "billing_ratios") return null;
  switch (ctx.action) {
    case "create-voice":
    case "list-voices":
      return ctx.model === model || ctx.upstreamModel === model ? { input_tokens: 0, output_tokens: 0 } : null;
    case "synthesize":
      // 请求没有可靠的输出长度，按 Flash-Lite TTS 的输入、输出上限预扣。
      return { input_tokens: 8192, output_tokens: 16384 };
    case "transcribe": {
      // 用 24 kHz、单声道、16 位 PCM 的文件大小估算，实际扣费取上游用量。
      const seconds = (ctx.requestBody.audioBytes - wavHeaderBytes) / wavBytesPerSecond;
      return { input_tokens: Math.ceil(seconds * 25), output_tokens: Math.ceil(seconds * 175 / 60) };
    }
    default:
      return null;
  }
}

export function extractUsageOnComplete(ctx, _result, body) {
  if (ctx.action !== "synthesize" && ctx.action !== "transcribe") return null;
  const input = body?.usage?.total_input_tokens;
  const output = body?.usage?.total_output_tokens;
  const thought = body?.usage?.total_thought_tokens ?? 0;
  if (![input, output, thought, output + thought].every((count) => Number.isSafeInteger(count) && count >= 0)) {
    throw new Error("Gemini response token usage is missing or invalid");
  }
  return { input_tokens: input, output_tokens: output + thought };
}

export function buildQueryRequest() {
  throw new Error("Gemini voice operations complete synchronously");
}

export function parseTaskResult() {
  throw new Error("Gemini voice operations do not have a polling result");
}
