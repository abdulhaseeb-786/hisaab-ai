"""Which Gemini model to call, and what to do when one is retired or overloaded.

Google retires model names ("gemini-2.5-flash is no longer available to new users", 404)
and its newest models are often overloaded (503 "high demand", 504 after ~20 s, 429).
Instead of the copilot and voice entry silently dropping to the offline tier, try the
configured model first, then the fallbacks in GEMINI_FALLBACK_MODELS.

- A retired model is skipped for the rest of the run.
- A busy model rests for BUSY_COOLDOWN_SECONDS: it moves to the back of the line, so one
  voice question (an audio call plus two or three copilot rounds) does not wait on the
  same overloaded model again and again. After the rest it is first again, because the
  fallbacks (lite models) hear Urdu less accurately and should only stand in for it.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

BUSY_COOLDOWN_SECONDS = 60.0

_working: str | None = None
_retired: set[str] = set()
_resting_until: dict[str, float] = {}
_clock = time.monotonic


def candidates() -> list[str]:
    names = [settings.GEMINI_MODEL, *[m.strip() for m in settings.GEMINI_FALLBACK_MODELS.split(",")]]
    out: list[str] = []
    for n in names:
        if n and n not in out and n not in _retired:
            out.append(n)
    now = _clock()
    # Resting models go last (still tried if every other model fails), in their usual order.
    return sorted(out, key=lambda m: _resting_until.get(m, 0.0) > now)


def _is_missing_model(exc: Exception) -> bool:
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    text = str(exc).lower()
    return code == 404 or "404" in text and ("not found" in text or "no longer available" in text)


def _is_busy(exc: Exception) -> bool:
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    text = str(exc).lower()
    return code in (429, 500, 503, 504) or any(w in text for w in ("unavailable", "high demand", "deadline", "overloaded", "timed out", "timeout"))


def _call(client: Any, model: str, contents: Any, config: Any) -> Any:
    try:
        return client.models.generate_content(model=model, contents=contents, config=config)
    except Exception as exc:
        # Some models (flash-lite) refuse a thinking setting with a bare "invalid argument":
        # ask the same model again without it.
        code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
        if code == 400 and getattr(config, "thinking_config", None) is not None:
            return client.models.generate_content(model=model, contents=contents,
                                                  config=config.model_copy(update={"thinking_config": None}))
        raise


def generate(client: Any, contents: Any, config: Any) -> Any:
    """client.models.generate_content with the retired / busy model fallback."""
    global _working
    last: Exception | None = None
    for model in candidates():
        try:
            resp = _call(client, model, contents, config)
        except Exception as exc:
            if _is_missing_model(exc):
                logger.warning("Gemini model %s is not available; trying the next one", model)
                _retired.add(model)
                last = exc
                continue
            if _is_busy(exc):
                logger.warning("Gemini model %s is busy (%s); resting it for %.0f s", model, exc.__class__.__name__,
                               BUSY_COOLDOWN_SECONDS)
                _resting_until[model] = _clock() + BUSY_COOLDOWN_SECONDS
                last = exc
                continue
            raise
        _resting_until.pop(model, None)
        if _working != model:
            if model != settings.GEMINI_MODEL:
                logger.warning("Using Gemini model %s instead of GEMINI_MODEL=%s", model, settings.GEMINI_MODEL)
            _working = model
        return resp
    raise last or RuntimeError("No Gemini model configured")


def current() -> str | None:
    return _working
