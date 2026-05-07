"""HF audio: TTS (mms-tts-eng) + STT (Whisper-large-v3)."""
import requests as req_lib
import base64
from ._keys import get_key


def call_hf_tts(text: str) -> str:
    """Convert text to base64 audio using HF MMS-TTS. Returns "" on failure (silent)."""
    api_key = get_key("HF_API_KEY")
    if not api_key:
        return ""
    try:
        print("[HF-TTS] Synthesizing voice…")
        url = "https://router.huggingface.co/hf-inference/models/facebook/mms-tts-eng"
        resp = req_lib.post(
            url,
            headers={"Authorization": f"Bearer {api_key}"},
            json={"inputs": text},
            timeout=15,
        )
        if resp.status_code == 200:
            return base64.b64encode(resp.content).decode("utf-8")
        print(f"[HF-TTS] {resp.status_code} {resp.text[:120]}")
    except Exception as e:
        print(f"[TTS ERROR] {e}")
    return ""


def call_hf_stt(audio_b64: str) -> str:
    """Speech-to-text via Whisper-large-v3. Audio is base64 of raw audio bytes (wav/m4a/webm)."""
    api_key = get_key("HF_API_KEY")
    if not api_key:
        raise ValueError("HF_API_KEY not set")

    audio_bytes = base64.b64decode(audio_b64)
    print(f"[HF-STT] Transcribing {len(audio_bytes)} bytes via Whisper…")
    url = "https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3"
    resp = req_lib.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/octet-stream"},
        data=audio_bytes,
        timeout=60,
    )
    if resp.status_code != 200:
        raise Exception(f"STT error {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    return data.get("text", "")
