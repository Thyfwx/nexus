"""HF vision + zero-shot classification + OCR."""
import requests as req_lib
import base64
from ._keys import get_key


def call_hf_vision(model_id: str, prompt: str, image_b64: str, system: str) -> str:
    api_key = get_key("HF_API_KEY")
    if not api_key:
        raise ValueError("HF_API_KEY not set")

    print(f"[HF-VISION] {model_id}")
    url = f"https://router.huggingface.co/hf-inference/models/{model_id}"
    payload = {"inputs": {"image": image_b64, "text": f"{system}\n\nUSER UPLINK: {prompt}"}}

    resp = req_lib.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=60,
    )
    if resp.status_code != 200:
        raise Exception(f"Vision Node Error: {resp.status_code}")

    data = resp.json()
    if isinstance(data, list) and len(data) > 0:
        return data[0].get("generated_text", "Vision scan complete, but no data returned.")
    return str(data)


def classify_intent(text: str, labels: list[str] | None = None) -> str:
    """Zero-shot classification via BART-MNLI. Defaults to Nexus intent labels."""
    api_key = get_key("HF_API_KEY")
    if not api_key:
        return "general"

    labels = labels or ["coding", "aggressive", "creative", "educational", "philosophical"]
    try:
        url = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli"
        resp = req_lib.post(
            url,
            headers={"Authorization": f"Bearer {api_key}"},
            json={"inputs": text, "parameters": {"candidate_labels": labels}},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            return data["labels"][0]
    except Exception:
        pass
    return "general"


def zero_shot(text: str, labels: list[str]) -> dict:
    """Public zero-shot — returns full label/score table for tool use."""
    api_key = get_key("HF_API_KEY")
    if not api_key:
        raise ValueError("HF_API_KEY not set")
    if not labels:
        raise ValueError("labels required")
    url = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli"
    resp = req_lib.post(
        url,
        headers={"Authorization": f"Bearer {api_key}"},
        json={"inputs": text, "parameters": {"candidate_labels": labels}},
        timeout=15,
    )
    if resp.status_code != 200:
        raise Exception(f"{resp.status_code} {resp.text[:200]}")
    return resp.json()


def ocr_image(image_b64: str) -> str:
    """OCR via TrOCR (printed-text variant)."""
    api_key = get_key("HF_API_KEY")
    if not api_key:
        raise ValueError("HF_API_KEY not set")

    img_bytes = base64.b64decode(image_b64)
    url = "https://router.huggingface.co/hf-inference/models/microsoft/trocr-base-printed"
    resp = req_lib.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/octet-stream"},
        data=img_bytes,
        timeout=45,
    )
    if resp.status_code != 200:
        raise Exception(f"OCR error {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    if isinstance(data, list) and data:
        return data[0].get("generated_text", "")
    return str(data)
