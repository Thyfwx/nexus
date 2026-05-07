"""HF text utilities: translate (NLLB), summarize (BART-CNN), embed (MiniLM)."""
import requests as req_lib
from ._keys import get_key


# Translation now uses Helsinki-NLP/opus-mt-{src}-{tgt} models (one per pair),
# which ARE supported by the HF serverless free tier. NLLB is paid-tier only as of 2026-05.
# Frontend keeps NLLB-style codes for backwards compat; we map to ISO before model lookup.
NLLB_LANGS = {
    "English":    "eng_Latn",
    "Spanish":    "spa_Latn",
    "French":     "fra_Latn",
    "German":     "deu_Latn",
    "Italian":    "ita_Latn",
    "Portuguese": "por_Latn",
    "Russian":    "rus_Cyrl",
    "Arabic":     "arb_Arab",
    "Chinese":    "zho_Hans",
    "Japanese":   "jpn_Jpan",
    "Korean":     "kor_Hang",
    "Hindi":      "hin_Deva",
    "Dutch":      "nld_Latn",
    "Swedish":    "swe_Latn",
}

_NLLB_TO_ISO = {
    "eng_Latn": "en", "spa_Latn": "es", "fra_Latn": "fr", "deu_Latn": "de",
    "ita_Latn": "it", "por_Latn": "pt", "rus_Cyrl": "ru", "arb_Arab": "ar",
    "zho_Hans": "zh", "jpn_Jpan": "ja", "kor_Hang": "ko", "hin_Deva": "hi",
    "nld_Latn": "nl", "swe_Latn": "sv",
}


def translate(text: str, src: str, tgt: str) -> str:
    """Translate via Helsinki-NLP opus-mt (one model per language pair).

    src/tgt accept either NLLB codes ('eng_Latn') or bare ISO ('en').
    """
    api_key = get_key("HF_API_KEY")
    if not api_key:
        raise ValueError("HF_API_KEY not set")

    src_iso = _NLLB_TO_ISO.get(src, src.split("_")[0] if "_" in src else src)
    tgt_iso = _NLLB_TO_ISO.get(tgt, tgt.split("_")[0] if "_" in tgt else tgt)
    if src_iso == tgt_iso:
        return text

    model = f"Helsinki-NLP/opus-mt-{src_iso}-{tgt_iso}"
    url = f"https://router.huggingface.co/hf-inference/models/{model}"
    resp = req_lib.post(
        url,
        headers={"Authorization": f"Bearer {api_key}"},
        json={"inputs": text},
        timeout=30,
    )
    if resp.status_code == 404:
        raise Exception(f"No Helsinki-MT model exists for {src_iso}→{tgt_iso}. Try a different pair (English ↔ Spanish/French/German/etc. all work).")
    if resp.status_code != 200:
        raise Exception(f"Translate error {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    if isinstance(data, list) and data:
        return data[0].get("translation_text", "")
    return str(data)


def summarize(text: str, min_length: int = 30, max_length: int = 200) -> str:
    """Summarize via BART-large-CNN."""
    api_key = get_key("HF_API_KEY")
    if not api_key:
        raise ValueError("HF_API_KEY not set")
    url = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-cnn"
    resp = req_lib.post(
        url,
        headers={"Authorization": f"Bearer {api_key}"},
        json={"inputs": text, "parameters": {"min_length": min_length, "max_length": max_length}},
        timeout=45,
    )
    if resp.status_code != 200:
        raise Exception(f"Summarize error {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    if isinstance(data, list) and data:
        return data[0].get("summary_text", "")
    return str(data)


def embed(text, model: str = "BAAI/bge-small-en-v1.5") -> list:
    """Sentence embeddings via BGE (free tier). 384-dim small / 1024-dim large."""
    api_key = get_key("HF_API_KEY")
    if not api_key:
        raise ValueError("HF_API_KEY not set")
    url = f"https://router.huggingface.co/hf-inference/models/{model}"
    resp = req_lib.post(
        url,
        headers={"Authorization": f"Bearer {api_key}"},
        json={"inputs": text, "options": {"wait_for_model": True}},
        timeout=30,
    )
    if resp.status_code != 200:
        raise Exception(f"Embed error {resp.status_code}: {resp.text[:200]}")
    return resp.json()


def summarize_dialog(text: str) -> str:
    """Dialogue / chat-log summarization via SAMSum-finetuned BART."""
    api_key = get_key("HF_API_KEY")
    if not api_key:
        raise ValueError("HF_API_KEY not set")
    url = "https://router.huggingface.co/hf-inference/models/philschmid/bart-large-cnn-samsum"
    resp = req_lib.post(url, headers={"Authorization": f"Bearer {api_key}"},
                        json={"inputs": text}, timeout=45)
    if resp.status_code != 200:
        raise Exception(f"Summarize-dialog error {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    return (data[0].get("summary_text", "") if isinstance(data, list) and data else str(data))


def summarize_oneline(text: str) -> str:
    """One-line extreme summarization via BART-XSum."""
    api_key = get_key("HF_API_KEY")
    if not api_key:
        raise ValueError("HF_API_KEY not set")
    url = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-xsum"
    resp = req_lib.post(url, headers={"Authorization": f"Bearer {api_key}"},
                        json={"inputs": text}, timeout=45)
    if resp.status_code != 200:
        raise Exception(f"Summarize-oneline error {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    return (data[0].get("summary_text", "") if isinstance(data, list) and data else str(data))


def sentiment(text: str, flavor: str = "general") -> dict:
    """flavor: 'general' (pos/neg/neutral) | 'finance' (bullish/bearish/neutral)."""
    api_key = get_key("HF_API_KEY")
    if not api_key:
        raise ValueError("HF_API_KEY not set")
    model = "ProsusAI/finbert" if flavor == "finance" else "cardiffnlp/twitter-roberta-base-sentiment-latest"
    url = f"https://router.huggingface.co/hf-inference/models/{model}"
    resp = req_lib.post(url, headers={"Authorization": f"Bearer {api_key}"},
                        json={"inputs": text}, timeout=20)
    if resp.status_code != 200:
        raise Exception(f"Sentiment error {resp.status_code}: {resp.text[:200]}")
    return {"model": model, "scores": resp.json()}


def emotion(text: str) -> dict:
    """7-emotion detection (joy/anger/fear/sadness/surprise/disgust/neutral)."""
    api_key = get_key("HF_API_KEY")
    if not api_key:
        raise ValueError("HF_API_KEY not set")
    url = "https://router.huggingface.co/hf-inference/models/j-hartmann/emotion-english-distilroberta-base"
    resp = req_lib.post(url, headers={"Authorization": f"Bearer {api_key}"},
                        json={"inputs": text}, timeout=20)
    if resp.status_code != 200:
        raise Exception(f"Emotion error {resp.status_code}: {resp.text[:200]}")
    return {"scores": resp.json()}
