console.log("Edu-Filter background service worker loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message && message.action === "runAIClassification") {
      handleAIClassification(message, sendResponse);
      return true; // async
    }
  } catch (e) {
    console.error("Background onMessage error:", e);
    sendResponse({ success: false, error: e.message, decisions: (message.titles || []).map(() => "show") });
  }
});

function isLatin1(str) {
  return Array.from(String(str || "")).every(c => c.charCodeAt(0) <= 255);
}
function asciiHeader(value) {
  return Array.from(String(value || ""))
    .filter(c => c.charCodeAt(0) <= 255)
    .join("")
    .replace(/\s+/g, "")
    .trim();
}
function sanitizeText(text) {
  return String(text || "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "")
    .trim();
}

async function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(
      {
        llmApiKey: "",
        llmProvider: "groq"
      },
      resolve
    );
  });
}

async function handleAIClassification(message, sendResponse) {
  const titles = Array.isArray(message.titles) ? message.titles : [];
  const showKeywords = Array.isArray(message.showKeywords) ? message.showKeywords : [];
  const hideKeywords = Array.isArray(message.hideKeywords) ? message.hideKeywords : [];

  try {
    const settings = await loadSettings();
    const key = settings.llmApiKey;

    if (!key) {
      sendResponse({ success: false, error: "No API key configured", decisions: titles.map(() => "show") });
      return;
    }
    if (!isLatin1(key)) {
      console.error("Stored API key contains non Latin-1 characters");
      sendResponse({ success: false, error: "API key invalid (non Latin-1)", decisions: titles.map(() => "show") });
      return;
    }

    const cleanTitles = titles.map(sanitizeText);
    const decisions = await classifyWithLLM(cleanTitles, settings, showKeywords, hideKeywords);
    sendResponse({ success: true, decisions });
  } catch (err) {
    console.error("AI Classification error:", err);
    sendResponse({ success: false, error: err.message, decisions: titles.map(() => "show") });
  }
}

async function classifyWithLLM(titles, settings, showKeywords = [], hideKeywords = []) {
  const provider = settings.llmProvider;
  const apiKey = asciiHeader(settings.llmApiKey);

  switch (provider) {
    case "groq":
      return await classifyWithGroq(titles, apiKey, showKeywords, hideKeywords);
    case "OpenRouter":
      return await classifyWithOpenRouter(titles, apiKey, showKeywords, hideKeywords);
    case "gemini":
      return await classifyWithGemini(titles, apiKey, showKeywords, hideKeywords);
    case "Hugging Face":
      return await classifyWithHuggingFace(titles, apiKey, showKeywords, hideKeywords);
    case "Mistral AI":
      return await classifyWithMistral(titles, apiKey, showKeywords, hideKeywords);
    case "Cloudflare Workers AI":
      return await classifyWithCloudflare(titles, apiKey, showKeywords, hideKeywords);
    default:
      throw new Error("Unknown provider: " + provider);
  }
}

function buildPrompt(titles, showKeywords = [], hideKeywords = []) {
  const showList = showKeywords.length ? showKeywords.join(", ") : "(none)";
  const hideList = hideKeywords.length ? hideKeywords.join(", ") : "(none)";
  let prompt = "";
  prompt += "You are an AI that classifies YouTube video titles.\n";
  prompt += "SHOW (educational) keyword intent: " + showList + "\n";
  prompt += "HIDE (distracting) keyword intent: " + hideList + "\n";
  prompt += "Short forms may appear (e.g. TMKOC = Taarak Mehta Ka Ooltah Chashmah).\n";
  prompt += "For each title output exactly one word: EDUCATIONAL or DISTRACTING.\n\n";
  titles.forEach((t, i) => {
    prompt += (i + 1) + ". " + t + "\n";
  });
  prompt += "\nOnly output EDUCATIONAL or DISTRACTING, one per line, same order.";
  return prompt;
}

function parseAIResponse(responseText, expectedCount) {
  const lines = String(responseText || "").split("\n").map(l => l.trim()).filter(Boolean);
  const decisions = [];
  for (let i = 0; i < expectedCount; i++) {
    const line = (lines[i] || "").toLowerCase();
    if (line.includes("educational")) decisions.push("show");
    else if (line.includes("distracting")) decisions.push("hide");
    else decisions.push("show");
  }
  return decisions;
}

// Providers

async function classifyWithGroq(titles, apiKey, showKeywords, hideKeywords) {
  const headers = new Headers();
  headers.set("Authorization", "Bearer " + apiKey);
  headers.set("Content-Type", "application/json");

  const body = {
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: "You classify YouTube titles as EDUCATIONAL or DISTRACTING." },
      { role: "user", content: buildPrompt(titles, showKeywords, hideKeywords) }
    ],
    temperature: 0.2,
    max_tokens: 256
  };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error("Groq API error: " + res.status + " " + text);
  }
  const data = await res.json();
  return parseAIResponse(data.choices[0].message.content, titles.length);
}

async function classifyWithOpenRouter(titles, apiKey, showKeywords, hideKeywords) {
  const headers = new Headers();
  headers.set("Authorization", "Bearer " + apiKey);
  headers.set("Content-Type", "application/json");

  const body = {
    model: "nvidia/nemotron-nano-12b-v2-vl:free",
    messages: [
      { role: "system", content: "You classify YouTube titles as EDUCATIONAL or DISTRACTING." },
      { role: "user", content: buildPrompt(titles, showKeywords, hideKeywords) }
    ],
    temperature: 0.2
  };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error("OpenRouter API error: " + res.status + " " + text);
  }
  const data = await res.json();
  return parseAIResponse(data.choices[0].message.content, titles.length);
}

// CORRECTED GEMINI IMPLEMENTATION
// ...keep all existing code above...

async function classifyWithGemini(titles, apiKey, showKeywords, hideKeywords) {
  const model = "gemini-2.0-flash"; // alias stays current
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;

  const systemInstruction =
    "You classify YouTube video titles strictly as EDUCATIONAL or DISTRACTING.\n" +
    "SHOW (educational) keywords: " + (showKeywords.length ? showKeywords.join(", ") : "(none)") + "\n" +
    "HIDE (distracting) keywords: " + (hideKeywords.length ? hideKeywords.join(", ") : "(none)") + "\n" +
    "Rules:\n" +
    "1. Output exactly one word per line, in order: EDUCATIONAL or DISTRACTING.\n" +
    "2. EDUCATIONAL if it helps learning, tech, tutorials, programming, study, factual deep explanation.\n" +
    "3. DISTRACTING if it is entertainment, pranks, vlogs, clickbait, gossip, drama, reaction, compilation.\n" +
    "4. No extra commentary.";

  let userList = "";
  titles.forEach((t, i) => { userList += (i + 1) + ". " + t + "\n"; });

  const body = {
    contents: [
      { role: "user", parts: [{ text: systemInstruction + "\n\nTitles:\n" + userList + "\nAnswer:" }] }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 256
    }
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error("Gemini API error " + res.status + ": " + text);
  }

  const data = await res.json();
  const candidate = (data.candidates && data.candidates[0]) || null;
  if (!candidate || !candidate.content || !candidate.content.parts) {
    console.warn("[Gemini] Empty response:", data);
    return titles.map(() => "show");
  }

  const raw = candidate.content.parts.map(p => p.text || "").join("\n");
  return parseAIResponse(raw, titles.length);
}

// ...keep all existing provider functions below (remove the old classifyWithGemini)...

async function classifyWithHuggingFace(titles, apiKey, showKeywords, hideKeywords) {
  const decisions = [];
  const hypothesis = "This video title is {label} given user preferences: show=[" +
    (showKeywords || []).join(", ") + "] hide=[" + (hideKeywords || []).join(", ") + "].";
  for (const t of titles) {
    const res = await fetch("https://api-inference.huggingface.co/models/facebook/bart-large-mnli", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: t,
        parameters: {
          candidate_labels: ["educational", "distracting"],
          hypothesis_template: hypothesis,
          multi_label: false
        }
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error("HuggingFace API error: " + res.status + " " + text);
    }
    const data = await res.json();
    const topLabel = (data.labels && data.labels[0]) || "educational";
    decisions.push(topLabel === "educational" ? "show" : "hide");
  }
  return decisions;
}

async function classifyWithMistral(titles, apiKey, showKeywords, hideKeywords) {
  const headers = new Headers();
  headers.set("Authorization", "Bearer " + apiKey);
  headers.set("Content-Type", "application/json");

  const body = {
    model: "mistral-small-latest",
    messages: [
      { role: "system", content: "You classify YouTube titles as EDUCATIONAL or DISTRACTING." },
      { role: "user", content: buildPrompt(titles, showKeywords, hideKeywords) }
    ],
    temperature: 0.2,
    max_tokens: 256
  };

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error("Mistral API error: " + res.status + " " + text);
  }
  const data = await res.json();
  return parseAIResponse(data.choices[0].message.content, titles.length);
}

async function classifyWithCloudflare(titles, apiKey, showKeywords, hideKeywords) {
  const parts = String(apiKey).split(":");
  const accountId = asciiHeader(parts[0] || "");
  const token = asciiHeader(parts[1] || "");

  const headers = new Headers();
  headers.set("Authorization", "Bearer " + token);
  headers.set("Content-Type", "application/json");

  const body = {
    messages: [
      { role: "system", content: "You classify YouTube titles as EDUCATIONAL or DISTRACTING." },
      { role: "user", content: buildPrompt(titles, showKeywords, hideKeywords) }
    ]
  };

  const url = "https://api.cloudflare.com/client/v4/accounts/" + accountId + "/ai/run/@cf/meta/llama-3-8b-instruct";
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error("Cloudflare API error: " + res.status + " " + text);
  }
  const data = await res.json();
  return parseAIResponse((data.result && data.result.response) || "", titles.length);
}