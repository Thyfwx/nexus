"""Google Gemini chat completions (with optional vision input)."""
import base64
from google import genai
from google.genai import types
from ._keys import get_key


def call_gemini(model_id: str, prompt: str, history: list | None, system: str,
                temperature: float = 0.7, top_p: float = 0.9,
                image_b64: str | None = None) -> str:
    api_key = get_key("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)

    contents = []
    for h in (history or []):
        if not h or not isinstance(h, dict):
            continue
        h_role = str(h.get("role", "user")).lower()
        role = "model" if h_role in ["assistant", "model", "ai", "nexus"] else "user"
        content = str(h.get("content", ""))

        if contents and contents[-1].role == role:
            existing_parts = contents[-1].parts
            if existing_parts and len(existing_parts) > 0:
                current_text = str(existing_parts[0].text or "")
                existing_parts[0].text = current_text + "\n" + content
        else:
            part = types.Part(text=content)
            contents.append(types.Content(role=role, parts=[part]))

    # Build the final user turn: text + optional inline image
    user_parts = [types.Part(text=prompt)]
    if image_b64:
        try:
            img_bytes = base64.b64decode(image_b64)
            user_parts.insert(0, types.Part(inline_data=types.Blob(mime_type="image/png", data=img_bytes)))
            print(f"[GEMINI VISION] attaching {len(img_bytes)} bytes of image input")
        except Exception as e:
            print(f"[GEMINI VISION] decode failed: {e}")

    if contents and contents[-1].role == "user" and not image_b64:
        # text-only continuation: append to last user turn
        last_parts = contents[-1].parts
        if last_parts and len(last_parts) > 0:
            current_prompt_text = str(last_parts[0].text or "")
            last_parts[0].text = current_prompt_text + "\n" + prompt
    else:
        contents.append(types.Content(role="user", parts=user_parts))

    print(f"[GEMINI] {model_id} (T={temperature}, TopP={top_p}) {len(contents)} segments")
    response = client.models.generate_content(
        model=model_id,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=1024,
            temperature=temperature,
            top_p=top_p,
            safety_settings=[
                types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
                types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
                types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
                types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
                types.SafetySetting(category="HARM_CATEGORY_CIVIC_INTEGRITY", threshold="BLOCK_NONE"),
            ],
        ),
    )
    if not response.text:
        reason = response.candidates[0].finish_reason if response.candidates else "EMPTY"
        raise RuntimeError(f"Gemini returned no text (Reason: {reason})")
    return response.text
