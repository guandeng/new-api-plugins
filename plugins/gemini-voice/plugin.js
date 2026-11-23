const model = "gemini-3.8-flash-lite-tts";
const replicationModels = ["gemini-3.8-flash-tts", model];
const baseURL = "https://generativelanguage.googleapis.com";

export const meta = {
  apiVersion: 1,
  key: "gemini-voice",
  name: "Gemini 录音复刻",
  version: "1.0.3",
  author: { name: "Plugin Maintainers" },
  baseUrl: baseURL,
  auth: "api_key",
  models: replicationModels,
  fetchMode: "per_task",
  routes: [
    { method: "POST", path: "/v1beta/voices", type: "submit", decode: "createVoice", render: "result", retainResult: false },
    { method: "GET", path: "/v1beta/voices", type: "submit", decode: "listVoices", render: "result", retainResult: false },
    { method: "POST", path: "/v1beta/interactions", type: "submit", decode: "synthesize", render: "result", retainResult: false },
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
    if (!replicationModels.includes(voice?.model) || voice.type !== "replicated") {
      throw new Error("Expected a replicated voice for " + replicationModels.join(" or "));
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

export function buildQueryRequest() {
  throw new Error("Gemini voice operations complete synchronously");
}

export function parseTaskResult() {
  throw new Error("Gemini voice operations do not have a polling result");
}
