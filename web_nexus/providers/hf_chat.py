"""Hugging Face router — OpenAI-compatible chat completions."""
import requests as req_lib
from ._keys import get_key


def call_hf(model_id: str, prompt: str, history: list | None, system: str,
            temperature: float = 1.0, top_p: float = 0.9) -> str:
    api_key = get_key("HF_API_KEY")
    if not api_key:
        raise ValueError("HF_API_KEY not set")

    messages = [{"role": "system", "content": system}]
    temp_msgs: list[dict] = []
    for h in (history or []):
        if not h or not isinstance(h, dict):
            continue
        h_role = str(h.get("role", "user")).lower()
        role = "assistant" if h_role in ["assistant", "model", "ai", "nexus"] else "user"
        content = str(h.get("content", ""))
        if temp_msgs and temp_msgs[-1]["role"] == role:
            temp_msgs[-1]["content"] += "\n" + content
        else:
            temp_msgs.append({"role": role, "content": content})

    messages.extend(temp_msgs)
    if messages and messages[-1]["role"] == "user":
        messages[-1]["content"] += "\n" + prompt
    else:
        messages.append({"role": "user", "content": prompt})

    print(f"[HF] {model_id} (T={temperature}, TopP={top_p})")
    url = f"https://router.huggingface.co/hf-inference/models/{model_id}/v1/chat/completions"
    resp = req_lib.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": model_id, "messages": messages, "max_tokens": 1024,
              "stream": False, "temperature": temperature, "top_p": top_p},
        timeout=60,
    )
    if resp.status_code != 200:
        raise Exception(f"{resp.status_code} {resp.text[:200]}")
    return resp.json()["choices"][0]["message"]["content"]
