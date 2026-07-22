// Swap providers by changing LLM_PROVIDER in .env — nothing else in the app
// needs to change. Add more providers below following the same shape:
// an async function that takes (system, userText) and returns plain text.

const PROVIDER = process.env.LLM_PROVIDER || "anthropic";

let getCompletion;

if (PROVIDER === "openai") {
  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-4o";

  getCompletion = async (system, userText, maxTokens = 1000, expectJson = false) => {
    const completion = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      ...(expectJson ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: userText }
      ]
    });
    return completion.choices[0].message.content;
  };
} else if (PROVIDER === "huggingface") {
  // Hugging Face's router speaks the OpenAI chat-completions protocol, so the
  // OpenAI SDK works here too — just point it at a different base URL. This
  // gives access to open models (Llama, Qwen, Mistral, DeepSeek, etc.) instead
  // of a named-lab model.
  const OpenAI = require("openai");
  const client = new OpenAI({
    apiKey: process.env.HF_TOKEN,
    baseURL: "https://router.huggingface.co/v1"
  });
  const model = process.env.HF_MODEL || "meta-llama/Llama-3.1-8B-Instruct";

  getCompletion = async (system, userText, maxTokens = 1000) => {
    const completion = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userText }
      ]
    });
    return completion.choices[0].message.content;
  };
} else if (PROVIDER === "ollama") {
  // Ollama runs entirely on your own machine — no API key, no external
  // network call at all once the model is pulled. It also exposes an
  // OpenAI-compatible endpoint, so the same SDK works here; the "apiKey" is
  // never actually checked by Ollama, it just needs to be a non-empty string.
  // Install: https://ollama.com — then `ollama pull llama3.1` before running this.
  const OpenAI = require("openai");
  const client = new OpenAI({
    apiKey: "ollama",
    baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1"
  });
  const model = process.env.OLLAMA_MODEL || "llama3.1";

  getCompletion = async (system, userText, maxTokens = 1000) => {
    const completion = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userText }
      ]
    });
    return completion.choices[0].message.content;
  };
} else if (PROVIDER === "gemini") {
  // Google's free tier (as of writing) needs no payment method — just a
  // Google account. Get a key at https://aistudio.google.com/apikey
  // Gemini has a native JSON mode (responseMimeType), similar reliability
  // to OpenAI's response_format for the structured-output agents.
  const { GoogleGenAI } = require("@google/genai");
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  getCompletion = async (system, userText, maxTokens = 1000, expectJson = false) => {
    const response = await client.models.generateContent({
      model,
      contents: userText,
      config: {
        systemInstruction: system,
        maxOutputTokens: maxTokens,
        ...(expectJson ? { responseMimeType: "application/json" } : {})
      }
    });
    return response.text;
  };
} else {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  getCompletion = async (system, userText, maxTokens = 1000) => {
    const message = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userText }]
    });
    return message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  };
}

module.exports = { getCompletion, PROVIDER };
