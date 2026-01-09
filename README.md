# Youtube-AI-Agent-Software-Engineering-Project-

Distraction reduction for YouTube using AI classification guided by your custom keyword intent lists (showKeywords + hideKeywords). Every visible video title is sent to an AI provider and classified as EDUCATIONAL (show) or DISTRACTING (hide). No instant local keyword filtering – keywords only steer AI behavior.This project was developed as part of a **Software Engineering course**, focusing on applying software development life cycle (SDLC) principles, system design, database modeling, and implementation best practices.

## 1. Overview
The extension monitors the YouTube feed (including infinite scroll) and batches new video titles for AI classification. Your keyword lists guide the AI prompt:
- showKeywords: Positive / educational intent signals.
- hideKeywords: Distracting / entertainment intent signals.

The AI returns one label per title. The extension hides elements classified as DISTRACTING.

## 2. Key Features
- AI-Guided Filtering (no local hard hide/show).
- Custom keyword intent injection into prompt.
- Multi-provider support (Groq, OpenRouter, Gemini, Mistral, Cloudflare Workers AI, Hugging Face).
- Non-blocking MutationObserver + periodic scan.
- Lightweight popup to toggle extension, edit keywords, pick provider, set API key.
- Resilient message passing (runtime guard, error labels on elements).

## 3. How It Works
Flow:
1. Collect new video elements (ytd-rich-item-renderer).
2. Extract titles.
3. Send all titles plus keyword lists to background.js.
4. background.js builds a prompt and calls selected provider.
5. Provider returns a text response with one line per title (EDUCATIONAL or DISTRACTING).
6. content.js hides elements where decision === 'hide'.

No pre-filter by keywords; all decisions come from AI.

## 4. Supported AI Providers
| Provider | Model (default) | Notes |
|----------|-----------------|-------|
| Groq | llama-3.1-8b-instant | Fast & inexpensive. |
| OpenRouter | nvidia/nemotron-nano-12b-v2-vl:free | Free tier subject to quota. |
| Gemini | gemini-2.0-flash | Use correct endpoint; fallback logic provided. |
| Mistral AI | mistral-small-latest | Balanced speed/cost. |
| Cloudflare Workers AI | @cf/meta/llama-3-8b-instruct | API key format: accountId:token. |
| Hugging Face | facebook/bart-large-mnli | Zero-shot classification per title (slower for large batches). |

## 5. Installation (Extension)
1. Clone repository:
   git clone https://github.com/rjain60be24-cmd/Youtube-AI-Agent-Software-Engineering-Project-/blob/main/gitignore.txt
   cd youtube_ai_filter-
2. Open Chrome → chrome://extensions
3. Enable Developer Mode.
4. Click Load unpacked.
5. Select project root.
6. Extension appears in toolbar.

## 6. Configuration (Popup)
Fields:
- Extension Status (ON/OFF)
- AI Provider (dropdown)
- API Key (password input)
- Hide Keywords list editor
- Show Keywords list editor

Changes persist via chrome.storage.sync.

## 7. Keyword Strategy
- showKeywords: Terms strongly correlated with learning (e.g. tutorial, python, guide, course, programming).
- hideKeywords: Terms correlated with entertainment or distraction (e.g. vlog, prank, reaction, drama, exposed, compilation).
- Specificity matters: Add both broad (vlog) and niche (tmkoc, roast) distractors.

Effect: Keywords alter the AI prompt context, nudging classification. They do not directly hide content.

## 8. Privacy & Data Handling
- Only video titles (strings) plus keyword lists sent to provider endpoints.
- No user identifiers, no watch history, no cookies intentionally transmitted.
- Hugging Face path sends each title separately.
- For maximum privacy, prefer providers you trust or a self-hosted model (future roadmap).

## 9. Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
| All videos remain visible with ai-show/no-api-key | Missing API key | Enter and save key in popup. |
| "Extension context invalidated" spam | Reloaded extension with old content script active | Hard refresh YouTube tab (Ctrl+Shift+R). |
| Gemini 404 | Wrong model alias or endpoint version | Use gemini-2.0-flash v1beta endpoint. |
| Decisions always show | Prompt too weak / keywords empty | Populate hideKeywords with stronger patterns. |
| Hugging Face slow | Per-title inference | Use Groq or Gemini for batching. |

## 10. FAQ
Q: Why not hide immediately by keyword?
A: Design choice: unify all decisions under AI for consistency and adaptivity.

Q: Can I restore instant filtering later?
A: Yes. Reintroduce a local pass before sending to AI.

Q: Does it analyze thumbnails?
A: No, only title text currently.

Q: Can I add caching?
A: Yes. Add a Map<title, decision> in background.js to skip reclassification.

## 11. Roadmap
- Optional hybrid pre-filter toggle.
- Thumbnail OCR for richer signals.
- Local open-source model running via WebGPU (no external API).
- Confidence scoring display overlay.
- Keyword weighting (strong vs mild).
  
## 12. License
Open-source. Use, modify, extend freely.

## Developer Notes
- All classification requests go through background.js to avoid CORS issues.
- Gemini function uses -latest alias and fallback sequence to mitigate 404 responses.
- If you refactor to include a local Python agent again, adapt background.js to POST to localhost instead of remote provider.

