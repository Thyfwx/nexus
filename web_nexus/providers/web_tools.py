"""Free-tier web tools: search (DuckDuckGo HTML), Wikipedia, math (SymPy), chart (QuickChart), Python sandbox (Piston)."""
import requests as req_lib
import re
import html
from urllib.parse import quote


_BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": "https://duckduckgo.com/",
}


def web_search(query: str, max_results: int = 5) -> list[dict]:
    """DuckDuckGo Lite scrape — no API key required.

    Uses the lite endpoint which returns simpler HTML and is friendlier to scripts.
    Falls back to DDG Instant Answer API for related topics if Lite returns empty.
    """
    if not query:
        raise ValueError("query required")

    out: list[dict] = []
    # Try DDG Lite first
    try:
        r = req_lib.get(f"https://lite.duckduckgo.com/lite/?q={quote(query)}",
                        headers=_BROWSER_HEADERS, timeout=12)
        if r.status_code == 200:
            # Lite layout: each result is a <tr> sequence — title link in one cell, snippet in the next
            anchor = re.compile(r'<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>(.*?)</a>', re.S)
            snippet = re.compile(r'<td[^>]+class="result-snippet"[^>]*>(.*?)</td>', re.S)
            urls = anchor.findall(r.text)
            snips = snippet.findall(r.text)
            for i, (u, t) in enumerate(urls[:max_results]):
                title = re.sub(r"<[^>]+>", "", t).strip()
                snip  = re.sub(r"<[^>]+>", "", snips[i] if i < len(snips) else "").strip()
                if title:
                    out.append({"title": html.unescape(title), "url": u, "snippet": html.unescape(snip)})
    except Exception as e:
        print(f"[SEARCH] DDG Lite failed: {e}")

    if out:
        return out

    # Fallback: DDG Instant Answer API (always free, JSON, but limited to related topics)
    try:
        r = req_lib.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
            headers=_BROWSER_HEADERS, timeout=10,
        )
        d = r.json()
        if d.get("AbstractText"):
            out.append({
                "title": d.get("Heading", query),
                "url":   d.get("AbstractURL", ""),
                "snippet": d.get("AbstractText", ""),
            })
        for t in (d.get("RelatedTopics") or [])[: max_results - len(out)]:
            if isinstance(t, dict) and t.get("Text") and t.get("FirstURL"):
                out.append({
                    "title":   t["Text"].split(" - ")[0][:80],
                    "url":     t["FirstURL"],
                    "snippet": t["Text"],
                })
    except Exception as e:
        print(f"[SEARCH] DDG API fallback failed: {e}")

    return out


def wikipedia_summary(topic: str) -> dict:
    """Public Wikipedia REST summary — no key, JSON in one hop."""
    if not topic:
        raise ValueError("topic required")
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(topic.replace(' ', '_'))}"
    r = req_lib.get(url, headers={"User-Agent": "NexusBot/1.0"}, timeout=10)
    if r.status_code == 404:
        return {"title": topic, "extract": "No Wikipedia article found.", "url": ""}
    if r.status_code != 200:
        raise RuntimeError(f"Wikipedia HTTP {r.status_code}")
    d = r.json()
    return {
        "title": d.get("title", topic),
        "extract": d.get("extract", ""),
        "url": d.get("content_urls", {}).get("desktop", {}).get("page", ""),
        "thumbnail": (d.get("thumbnail") or {}).get("source", ""),
    }


def math_solve(expression: str) -> dict:
    """Symbolic math via SymPy. Handles equations, derivatives, integrals, limits, simplification."""
    if not expression:
        raise ValueError("expression required")
    try:
        import sympy
        from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application
    except Exception as e:
        raise RuntimeError(f"SymPy unavailable: {e}")

    expr = expression.strip()
    transforms = standard_transformations + (implicit_multiplication_application,)

    # Equation: contains '=' and not '=='
    if "=" in expr and "==" not in expr:
        try:
            lhs, rhs = expr.split("=", 1)
            lhs_e = parse_expr(lhs.strip(), transformations=transforms)
            rhs_e = parse_expr(rhs.strip(), transformations=transforms)
            sols  = sympy.solve(sympy.Eq(lhs_e, rhs_e))
            return {"input": expression, "kind": "equation", "result": str(sols)}
        except Exception as e:
            return {"input": expression, "kind": "equation", "error": str(e)}

    # Plain expression: try simplify + numeric eval
    try:
        e = parse_expr(expr, transformations=transforms)
        simp = sympy.simplify(e)
        try:
            num = float(simp.evalf())
            return {"input": expression, "kind": "expression", "simplified": str(simp), "value": num}
        except Exception:
            return {"input": expression, "kind": "expression", "simplified": str(simp)}
    except Exception as e:
        return {"input": expression, "kind": "expression", "error": str(e)}


def chart_url(chart_type: str, labels: list[str], values: list[float], title: str = "") -> str:
    """Build a QuickChart.io URL — free, no key, returns a PNG."""
    chart_type = (chart_type or "bar").lower()
    if chart_type not in ("bar", "pie", "line", "doughnut", "radar"):
        chart_type = "bar"
    spec = {
        "type": chart_type,
        "data": {
            "labels": labels,
            "datasets": [{"label": title or "data", "data": values}],
        },
        "options": {"plugins": {"title": {"display": bool(title), "text": title}}},
    }
    import json
    enc = quote(json.dumps(spec))
    return f"https://quickchart.io/chart?w=520&h=320&bkg=transparent&c={enc}"


def weather(location: str) -> dict:
    """wttr.in JSON — free, no key. Current conditions for any city."""
    if not location:
        raise ValueError("location required")
    r = req_lib.get(f"https://wttr.in/{quote(location)}",
                    params={"format": "j1"}, timeout=10,
                    headers={"User-Agent": "NexusBot/1.0"})
    if r.status_code != 200:
        raise RuntimeError(f"wttr.in HTTP {r.status_code}")
    d = r.json()
    cur = (d.get("current_condition") or [{}])[0]
    area = (d.get("nearest_area") or [{}])[0]
    return {
        "location":      f"{(area.get('areaName') or [{}])[0].get('value','?')}, {(area.get('country') or [{}])[0].get('value','?')}",
        "temp_c":        cur.get("temp_C"),
        "temp_f":        cur.get("temp_F"),
        "feels_like_c":  cur.get("FeelsLikeC"),
        "humidity":      cur.get("humidity"),
        "wind_kph":      cur.get("windspeedKmph"),
        "description":   (cur.get("weatherDesc") or [{}])[0].get("value", ""),
        "obs_time":      cur.get("observation_time"),
    }


def currency(amount: float, src: str, tgt: str) -> dict:
    """exchangerate.host — free public FX API, no key."""
    if not src or not tgt:
        raise ValueError("src and tgt currency codes required")
    r = req_lib.get("https://api.exchangerate.host/convert",
                    params={"from": src.upper(), "to": tgt.upper(), "amount": amount},
                    timeout=10)
    if r.status_code != 200:
        raise RuntimeError(f"exchangerate.host HTTP {r.status_code}")
    d = r.json()
    return {
        "amount": amount, "from": src.upper(), "to": tgt.upper(),
        "result": d.get("result"), "rate": (d.get("info") or {}).get("rate"),
        "date": d.get("date"),
    }


def qr_url(text: str, size: int = 320) -> str:
    """qrserver.com — free GET endpoint that returns a PNG."""
    if not text:
        raise ValueError("text required")
    return f"https://api.qrserver.com/v1/create-qr-code/?size={size}x{size}&data={quote(text)}"


def timezone_now(tz: str) -> dict:
    """worldtimeapi.org — current time in any IANA zone."""
    if not tz:
        raise ValueError("tz required (e.g. America/New_York)")
    r = req_lib.get(f"https://worldtimeapi.org/api/timezone/{tz}", timeout=8)
    if r.status_code != 200:
        raise RuntimeError(f"worldtimeapi HTTP {r.status_code}")
    d = r.json()
    return {
        "timezone": d.get("timezone"),
        "datetime": d.get("datetime"),
        "utc_offset": d.get("utc_offset"),
        "abbreviation": d.get("abbreviation"),
        "day_of_week": d.get("day_of_week"),
    }


def color_palette(seed: str) -> dict:
    """color.pizza-style palette generator — free public APIs.
    Uses ColourLovers random palette as a fallback-free alternative isn't ideal,
    so we generate locally via a hash → 5 hsl variations.
    """
    if not seed:
        raise ValueError("seed required")
    # Seeded local generator — no external dependency, always returns palette
    h = 0
    for c in seed:
        h = (h * 31 + ord(c)) & 0xffffffff
    base = h % 360
    palette = []
    for i in range(5):
        hue = (base + i * 30) % 360
        sat = 65 + ((h >> (i * 4)) & 0x1f)
        lit = 45 + ((h >> (i * 5)) & 0x1f) % 25
        # convert HSL to hex via simple formula
        import colorsys
        r, g, b = colorsys.hls_to_rgb(hue / 360.0, lit / 100.0, sat / 100.0)
        palette.append("#{:02x}{:02x}{:02x}".format(int(r * 255), int(g * 255), int(b * 255)))
    return {"seed": seed, "palette": palette}


def ner_extract(text: str) -> list[dict]:
    """Named entity recognition via dslim/bert-base-NER (HF free tier)."""
    api_key = get_key("HF_API_KEY")
    if not api_key:
        raise ValueError("HF_API_KEY not set")
    r = req_lib.post(
        "https://router.huggingface.co/hf-inference/models/dslim/bert-base-NER",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"inputs": text}, timeout=15,
    )
    if r.status_code != 200:
        raise RuntimeError(f"NER HTTP {r.status_code}: {r.text[:200]}")
    return r.json()


def run_python(code: str) -> dict:
    """Sandboxed Python execution via Piston (free, no key, public infra)."""
    if not code:
        raise ValueError("code required")
    payload = {
        "language": "python",
        "version": "3.10.0",
        "files": [{"content": code}],
        "stdin": "",
        "compile_timeout": 5000,
        "run_timeout": 4000,
    }
    r = req_lib.post("https://emkc.org/api/v2/piston/execute",
                     json=payload, timeout=15,
                     headers={"User-Agent": "NexusBot/1.0"})
    if r.status_code != 200:
        raise RuntimeError(f"Piston HTTP {r.status_code}: {r.text[:200]}")
    d = r.json()
    run = d.get("run", {})
    return {
        "stdout": run.get("stdout", ""),
        "stderr": run.get("stderr", ""),
        "code":   run.get("code"),
        "signal": run.get("signal"),
        "version": d.get("version", ""),
    }
