from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os

from scanner import scan_aws, graph_to_json
from attack_engine import find_attack_paths, get_risk_summary
from nl_parser import parse_nl_query, apply_filter

load_dotenv()

app = FastAPI(title="CloudGuard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cache — no Redis needed for POC
_graph_cache = None
_graph_json_cache = None


@app.get("/")
def root():
    return {"status": "CloudGuard API running"}


@app.post("/scan")
def scan(region: str = "us-east-1"):
    """Scan AWS account and build the resource graph."""
    global _graph_cache, _graph_json_cache
    try:
        G = scan_aws(region=region)
        _graph_cache = G
        _graph_json_cache = graph_to_json(G)
        summary = get_risk_summary(G)
        return {
            "status": "ok",
            "summary": summary,
            "graph": _graph_json_cache,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/graph")
def get_graph():
    """Return the last scanned graph."""
    if _graph_json_cache is None:
        raise HTTPException(status_code=404, detail="No scan yet. Call POST /scan first.")
    return _graph_json_cache


@app.get("/attack-paths")
def get_attack_paths():
    """Return computed attack paths from the last scan."""
    if _graph_cache is None:
        raise HTTPException(status_code=404, detail="No scan yet. Call POST /scan first.")
    paths = find_attack_paths(_graph_cache)
    return {"attack_paths": paths}


class NLQuery(BaseModel):
    query: str

@app.post("/query")
def nl_query(body: NLQuery):
    """
    Accept a natural language query, parse it with Groq LLM,
    and return a filtered graph.
    """
    if _graph_json_cache is None:
        raise HTTPException(status_code=404, detail="No scan yet. Call POST /scan first.")
    filters = parse_nl_query(body.query)
    filtered = apply_filter(_graph_json_cache, filters)
    return {
        "filters_applied": filters,
        "graph": filtered,
    }


@app.get("/summary")
def summary():
    """Return risk summary of last scan."""
    if _graph_cache is None:
        raise HTTPException(status_code=404, detail="No scan yet. Call POST /scan first.")
    return get_risk_summary(_graph_cache)
