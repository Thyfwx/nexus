"""
Tool registry — single source of truth for /api/tool/{name} dispatch.

Each tool is a dict:
  - id:         URL-safe slug used by the dispatcher
  - label:      human-friendly name shown in the sidebar
  - icon:       short emoji/glyph for the button
  - description:tooltip text
  - owner_only: bool — gated to lovexdgamer@gmail.com
  - fn:         callable that takes a single dict (kwargs from request body)
  - returns:    'text' | 'image_b64' | 'audio_b64' | 'json'
"""
from . import hf_image, hf_audio, hf_text, hf_vision, web_tools


def _t_image_gen(p: dict) -> dict:
    """Image gen — SFW only as of 2026-05-06. Available in:
        - Nexus       (default photographic style)
        - Unfiltered  (cinematic / film-style)
       NOT available in:
        - Coder       (programming workspace — image gen is irrelevant)
        - Education   (text-based learning — image gen distracts; explicit user removal 2026-05-06)
    """
    prompt = (p.get("prompt") or "").strip()
    mode = (p.get("mode") or "nexus").lower()
    is_google = bool(p.get("_is_google") or p.get("_is_owner"))
    force_free = bool(p.get("_force_free"))
    if not prompt:
        raise ValueError("prompt required")

    # Coder + Education modes don't support image gen.
    if mode in ("coder", "education"):
        nice = "Coder" if mode == "coder" else "Education"
        raise ValueError(f"Image generation is disabled in {nice} mode. Switch to Nexus or Unfiltered if you want to generate an image.")

    # Per-mode style modifier — appended to the user's prompt.
    MODE_STYLES = {
        "nexus":      ", high quality photograph, sharp focus, balanced natural lighting, photographic detail",
        "unfiltered": ", gritty raw 35mm film photograph, harsh dramatic contrast, deep shadows, moody cinematic atmosphere, grainy texture, neo-noir lighting",
    }
    style = MODE_STYLES.get(mode, "")
    final_prompt = (prompt + style) if style else prompt
    return hf_image.text_to_image(final_prompt, mode=mode, is_google=is_google, force_free=force_free)


def _t_stt(p: dict) -> dict:
    audio_b64 = p.get("audio_b64") or ""
    if not audio_b64:
        raise ValueError("audio_b64 required")
    return {"text": hf_audio.call_hf_stt(audio_b64)}


def _t_tts(p: dict) -> dict:
    text = (p.get("text") or "").strip()
    if not text:
        raise ValueError("text required")
    return {"audio_b64": hf_audio.call_hf_tts(text)}


def _t_translate(p: dict) -> dict:
    text = (p.get("text") or "").strip()
    src = p.get("src") or "eng_Latn"
    tgt = p.get("tgt") or "spa_Latn"
    if not text:
        raise ValueError("text required")
    return {"text": hf_text.translate(text, src, tgt), "src": src, "tgt": tgt}


def _t_summarize(p: dict) -> dict:
    text = (p.get("text") or "").strip()
    flavor = (p.get("flavor") or "default").lower()
    if not text:
        raise ValueError("text required")
    if flavor == "dialog":
        return {"text": hf_text.summarize_dialog(text), "flavor": "dialog"}
    if flavor == "oneline" or flavor == "headline":
        return {"text": hf_text.summarize_oneline(text), "flavor": "oneline"}
    return {"text": hf_text.summarize(text,
                                       min_length=int(p.get("min_length", 30)),
                                       max_length=int(p.get("max_length", 200))),
            "flavor": "default"}


def _t_sentiment(p: dict) -> dict:
    text = (p.get("text") or "").strip()
    if not text:
        raise ValueError("text required")
    return hf_text.sentiment(text, flavor=(p.get("flavor") or "general"))


def _t_emotion(p: dict) -> dict:
    text = (p.get("text") or "").strip()
    if not text:
        raise ValueError("text required")
    return hf_text.emotion(text)


def _t_classify(p: dict) -> dict:
    text = (p.get("text") or "").strip()
    labels = p.get("labels") or []
    if not text or not labels:
        raise ValueError("text and labels[] required")
    return hf_vision.zero_shot(text, labels)


def _t_ocr(p: dict) -> dict:
    image_b64 = p.get("image_b64") or ""
    if not image_b64:
        raise ValueError("image_b64 required")
    return {"text": hf_vision.ocr_image(image_b64)}


def _t_embed(p: dict) -> dict:
    text = p.get("text")
    model = p.get("model") or "BAAI/bge-small-en-v1.5"
    if not text:
        raise ValueError("text required")
    return {"vector": hf_text.embed(text, model=model), "model": model}


def _t_search(p: dict) -> dict:
    return {"results": web_tools.web_search((p.get("query") or "").strip(),
                                            max_results=int(p.get("max_results", 5)))}


def _t_wiki(p: dict) -> dict:
    return web_tools.wikipedia_summary((p.get("topic") or "").strip())


def _t_math(p: dict) -> dict:
    return web_tools.math_solve((p.get("expression") or "").strip())


def _t_chart(p: dict) -> dict:
    return {"url": web_tools.chart_url(
        p.get("chart_type") or "bar",
        list(p.get("labels") or []),
        list(p.get("values") or []),
        title=p.get("title", "")
    )}


def _t_run_py(p: dict) -> dict:
    return web_tools.run_python((p.get("code") or "").strip())


# All tools below verified live on HF free serverless tier 2026-05.
# Image gen: unfiltered mode bypasses HF safety by routing straight to Pollinations.
TOOLS: list[dict] = [
    {"id": "image_gen", "label": "Image Generator", "icon": "🎨", "description": "FLUX.1-schnell · Pollinations fallback. Unfiltered mode bypasses safety.", "owner_only": False, "fn": _t_image_gen, "returns": "image_b64"},
    {"id": "translate", "label": "Translator",      "icon": "🌐", "description": "Helsinki-NLP opus-mt. EN ↔ ES/FR/DE/IT/ZH and more.",                       "owner_only": False, "fn": _t_translate, "returns": "text"},
    {"id": "summarize", "label": "Summarizer",      "icon": "📝", "description": "BART-CNN (default), SAMSum (dialog), XSum (one-liner).",                   "owner_only": False, "fn": _t_summarize, "returns": "text"},
    {"id": "sentiment", "label": "Sentiment",       "icon": "📊", "description": "RoBERTa pos/neg/neutral. Set flavor='finance' for FinBERT.",                "owner_only": False, "fn": _t_sentiment, "returns": "json"},
    {"id": "emotion",   "label": "Emotion",         "icon": "😊", "description": "DistilRoBERTa — 7-emotion classifier (joy/anger/fear/sadness/...).",       "owner_only": False, "fn": _t_emotion,   "returns": "json"},
    {"id": "embed",     "label": "Embeddings",      "icon": "🧬", "description": "BGE-small (384-dim) for semantic search / RAG.",                            "owner_only": True,  "fn": _t_embed,     "returns": "json"},
    {"id": "search",    "label": "Web Search",      "icon": "🔎", "description": "DuckDuckGo HTML — top 5 live results, no API key.",                         "owner_only": False, "fn": _t_search,    "returns": "json"},
    {"id": "wiki",      "label": "Wikipedia",       "icon": "📚", "description": "Wikipedia REST summary — title, extract, link.",                            "owner_only": False, "fn": _t_wiki,      "returns": "json"},
    {"id": "math",      "label": "Math Solver",     "icon": "🧮", "description": "SymPy: simplify, solve equations, evaluate expressions.",                  "owner_only": False, "fn": _t_math,      "returns": "json"},
    {"id": "chart",     "label": "Chart",           "icon": "📈", "description": "QuickChart.io PNG — bar / pie / line / radar / doughnut.",                  "owner_only": False, "fn": _t_chart,     "returns": "json"},
    {"id": "weather",   "label": "Weather",         "icon": "🌤️", "description": "wttr.in — current conditions for any city, no key.",                       "owner_only": False, "fn": lambda p: web_tools.weather((p.get("location") or "").strip()), "returns": "json"},
    {"id": "currency",  "label": "Currency",        "icon": "💱", "description": "exchangerate.host — free FX conversion.",                                   "owner_only": False, "fn": lambda p: web_tools.currency(float(p.get("amount", 1)), p.get("src","USD"), p.get("tgt","EUR")), "returns": "json"},
    {"id": "qr",        "label": "QR Code",         "icon": "🔲", "description": "qrserver.com — PNG QR code for any text.",                                  "owner_only": False, "fn": lambda p: {"url": web_tools.qr_url((p.get("text") or "").strip(), int(p.get("size", 320)))}, "returns": "json"},
    {"id": "timezone",  "label": "Timezone",        "icon": "⏰", "description": "worldtimeapi.org — current time in any IANA zone.",                         "owner_only": False, "fn": lambda p: web_tools.timezone_now((p.get("tz") or "").strip()), "returns": "json"},
    {"id": "palette",   "label": "Color Palette",   "icon": "🎨", "description": "Seeded 5-color palette generator — deterministic from any string.",         "owner_only": False, "fn": lambda p: web_tools.color_palette((p.get("seed") or "").strip()), "returns": "json"},
    {"id": "ner",       "label": "Named Entities",  "icon": "🏷️", "description": "dslim/bert-base-NER — pull people / places / orgs from text.",             "owner_only": False, "fn": lambda p: {"entities": web_tools.ner_extract((p.get("text") or "").strip())}, "returns": "json"},
    # run_py disabled: Piston public API is whitelist-only as of Feb 2026.
    # Re-enable by hosting our own Piston container or wiring Pyodide client-side.
    # {"id": "run_py", "label": "Python Sandbox", "icon": "🐍", "description": "Piston runner — executes Python in a sandbox.", "owner_only": False, "fn": _t_run_py, "returns": "json"},
]


def get_tool(tool_id: str) -> dict | None:
    for t in TOOLS:
        if t["id"] == tool_id:
            return t
    return None


def public_manifest() -> list[dict]:
    """Strip the fn callable from each tool — safe to send to the browser."""
    return [{k: v for k, v in t.items() if k != "fn"} for t in TOOLS]
