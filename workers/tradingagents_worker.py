#!/usr/bin/env python3
"""HTTP bridge between Trading Intel and TauricResearch TradingAgents.

Run this outside Vercel, in an environment where the Python TradingAgents package
and your chosen LLM/data-provider keys are installed.
"""

from __future__ import annotations

import json
import os
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any


def env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def jsonable(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return jsonable(value.model_dump())
    if hasattr(value, "dict"):
        return jsonable(value.dict())
    if isinstance(value, dict):
        return {str(key): jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(item) for item in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def clean_symbols(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned: list[str] = []
    for item in value:
        symbol = str(item).strip().upper()
        if symbol and all(char.isalnum() or char in ".=/_-" for char in symbol):
            cleaned.append(symbol)
    return list(dict.fromkeys(cleaned))[:8]


def depth_rounds(depth: str) -> int:
    return {"fast": 1, "standard": 2, "deep": 3}.get(depth, 2)


def build_config(parameters: dict[str, Any]) -> dict[str, Any]:
    from tradingagents.default_config import DEFAULT_CONFIG

    depth = str(parameters.get("depth") or os.getenv("TRADINGAGENTS_DEPTH") or "standard")
    config = DEFAULT_CONFIG.copy()
    config["llm_provider"] = str(parameters.get("provider") or os.getenv("TRADINGAGENTS_LLM_PROVIDER") or config.get("llm_provider", "openai"))
    config["deep_think_llm"] = os.getenv("TRADINGAGENTS_DEEP_MODEL") or str(parameters.get("deepModel") or config.get("deep_think_llm", "gpt-5.4"))
    config["quick_think_llm"] = os.getenv("TRADINGAGENTS_QUICK_MODEL") or str(parameters.get("quickModel") or config.get("quick_think_llm", "gpt-5.4-mini"))
    config["max_debate_rounds"] = int(parameters.get("maxDebateRounds") or os.getenv("TRADINGAGENTS_MAX_DEBATE_ROUNDS") or depth_rounds(depth))
    config["max_risk_discuss_rounds"] = int(parameters.get("maxRiskRounds") or os.getenv("TRADINGAGENTS_MAX_RISK_ROUNDS") or depth_rounds(depth))
    config["checkpoint_enabled"] = str(os.getenv("TRADINGAGENTS_CHECKPOINT", "false")).lower() == "true"
    config["output_language"] = os.getenv("TRADINGAGENTS_OUTPUT_LANGUAGE") or str(parameters.get("outputLanguage") or config.get("output_language", "English"))
    return config


def run_tradingagents(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        from tradingagents.graph.trading_graph import TradingAgentsGraph
    except Exception as exc:  # pragma: no cover - depends on external Python env
        raise RuntimeError(
            "TradingAgents is not installed. Install it with: "
            "pip install git+https://github.com/TauricResearch/TradingAgents.git"
        ) from exc

    if payload.get("jobType") != "agent-debate":
        raise ValueError("TradingAgents worker only accepts agent-debate jobs.")

    symbols = clean_symbols(payload.get("symbols"))
    if not symbols:
        raise ValueError("At least one valid symbol is required.")

    parameters = payload.get("parameters") if isinstance(payload.get("parameters"), dict) else {}
    analysis_date = str(parameters.get("analysisDate") or date.today().isoformat())
    graph = TradingAgentsGraph(debug=os.getenv("TRADINGAGENTS_DEBUG", "false").lower() == "true", config=build_config(parameters))

    decisions = []
    for symbol in symbols:
        _, decision = graph.propagate(symbol, analysis_date)
        decisions.append(
            {
                "symbol": symbol,
                "analysisDate": analysis_date,
                "decision": jsonable(decision),
            }
        )

    return {
        "ok": True,
        "engine": "TauricResearch/TradingAgents",
        "analysisDate": analysis_date,
        "decisions": decisions,
        "advisory": "Research-only multi-agent analysis. Do not route directly to broker execution.",
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "TradingAgentsBridge/1.0"

    def do_GET(self) -> None:
        if self.path.rstrip("/") != "/health":
            self.respond(404, {"ok": False, "error": "Not found"})
            return
        self.respond(
            200,
            {
                "ok": True,
                "engine": "TradingAgents",
                "configured": {
                    "provider": os.getenv("TRADINGAGENTS_LLM_PROVIDER", "openai"),
                    "sharedSecret": bool(os.getenv("WORKER_SHARED_SECRET")),
                },
            },
        )

    def do_POST(self) -> None:
        if self.path.rstrip("/") not in ("", "/run", "/analyze"):
            self.respond(404, {"ok": False, "error": "Not found"})
            return
        if not self.authorized():
            self.respond(401, {"ok": False, "error": "Unauthorized worker request."})
            return
        try:
            length = int(self.headers.get("content-length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            self.respond(200, run_tradingagents(payload))
        except Exception as exc:
            self.respond(503, {"ok": False, "error": str(exc)})

    def authorized(self) -> bool:
        secret = os.getenv("WORKER_SHARED_SECRET")
        if not secret:
            return True
        expected = f"Bearer {secret}"
        return self.headers.get("authorization") == expected

    def respond(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    host = os.getenv("TRADINGAGENTS_HOST", "0.0.0.0")
    port = env_int("TRADINGAGENTS_PORT", 8765)
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"TradingAgents worker listening on http://{host}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
