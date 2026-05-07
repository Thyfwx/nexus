"""fal.ai image generation — premium tier, ~$0.025-0.05/image.

When FAL_API_KEY is set in .env AND DevPanel routes to fal.ai, this provider runs.
fal.ai's FLUX models handle compound NSFW scenes (multi-element + male/female anatomy)
much better than Replicate's standard models. The tradeoff: 18-35× more expensive.

Cost reference:
  - fal-ai/flux/dev:        ~$0.025/image
  - fal-ai/flux-realism:    ~$0.04/image (photoreal-tuned)
  - fal-ai/flux-lora:       ~$0.05/image (custom LoRA stack — best for NSFW)

$15 budget at $0.05/img = ~300 high-quality explicit images
$15 budget at $0.025/img = ~600 medium-quality images
$15 budget at Replicate Realistic Vision V5.1 = ~10,600 mid-quality images

Setup steps:
  1. Sign up at https://fal.ai (you already have an account)
  2. Get API key at https://fal.ai/dashboard/keys
  3. Paste into .env as: FAL_API_KEY="paste_key_here"
  4. Restart Nexus backend
  5. In DevPanel → IMAGE MODEL SELECTOR, switch primary paid tier to fal.ai
"""
import base64
import os
import time
import requests as req_lib

from ._keys import get_key


# Default model: fal-ai/flux/dev — cheapest fal model, decent NSFW with aggressive prompts.
# Override via FAL_MODEL env var or DevPanel selector.
DEFAULT_FAL_MODEL = "fal-ai/flux/dev"

FAL_QUEUE_BASE = "https://queue.fal.run"


def _current_fal_model() -> str:
    return os.getenv("FAL_MODEL", "").strip() or DEFAULT_FAL_MODEL


def text_to_image_fal(prompt: str, negative_prompt: str = "", timeout: int = 90) -> dict:
    """Submit a job to fal.ai, poll until done, return base64 image."""
    api_key = get_key("FAL_API_KEY") or os.getenv("FAL_API_KEY")
    if not api_key:
        raise RuntimeError("FAL_API_KEY not set")

    model = _current_fal_model()
    submit_url = f"{FAL_QUEUE_BASE}/{model}"
    headers = {
        "Authorization": f"Key {api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "prompt": prompt,
        "image_size": "portrait_4_3",
        "num_inference_steps": 28,
        "guidance_scale": 3.5,
        "num_images": 1,
        "enable_safety_checker": False,
    }

    print(f"[FAL] submitting · model={model} :: {prompt[:60]!r}")
    r = req_lib.post(submit_url, json=body, headers=headers, timeout=20)
    if r.status_code not in (200, 201, 202):
        raise RuntimeError(f"fal.ai submit failed {r.status_code}: {r.text[:200]}")

    job = r.json()
    # fal.ai returns either inline result OR a queued job
    img_url = None
    if "images" in job and job["images"]:
        img_url = job["images"][0].get("url")
    elif job.get("status_url"):
        # Poll the status URL until done
        status_url = job["status_url"]
        deadline = time.time() + timeout
        while time.time() < deadline:
            time.sleep(2)
            sr = req_lib.get(status_url, headers=headers, timeout=10)
            if not sr.ok:
                continue
            sdata = sr.json()
            if sdata.get("status") == "COMPLETED":
                response_url = sdata.get("response_url") or job.get("response_url")
                if response_url:
                    rr = req_lib.get(response_url, headers=headers, timeout=15)
                    if rr.ok:
                        result = rr.json()
                        if result.get("images"):
                            img_url = result["images"][0].get("url")
                            break
            if sdata.get("status") in ("FAILED", "CANCELED"):
                raise RuntimeError(f"fal.ai job failed: {sdata.get('error') or 'unknown'}")

    if not img_url:
        raise RuntimeError("fal.ai returned no image URL")

    ir = req_lib.get(img_url, timeout=30)
    if not ir.ok:
        raise RuntimeError(f"fal.ai image fetch {ir.status_code}")
    return {
        "image_b64": base64.b64encode(ir.content).decode("utf-8"),
        "source": f"fal:{model.split('/')[-1]}",
    }
