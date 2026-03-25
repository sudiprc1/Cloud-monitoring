import os
import json
from groq import Groq
from typing import Dict

client = None

def get_client():
    global client
    if client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise Exception("GROQ_API_KEY not set in .env file")
        client = Groq(api_key=api_key)
    return client

SYSTEM_PROMPT = """You are a cloud security assistant. The user will ask questions about their AWS infrastructure in plain English.
Your job is to return a JSON filter object that describes what resources to show.

The filter object must have these fields (all optional):
- resource_types: list of resource types to show. Options: "ec2", "s3", "lambda", "iam_role", "security_group", "vpc"
- risk_levels: list of risk levels to highlight. Options: "critical", "high", "medium", "low"
- show_attack_paths: boolean — true if user wants to see attack paths
- public_only: boolean — true if user only wants public-facing resources
- keyword: a string to filter resource names/labels by

Return ONLY a valid JSON object. No explanation, no markdown, no extra text.

Examples:
User: "show me all public S3 buckets"
{"resource_types": ["s3"], "public_only": true}

User: "what are the critical risks?"
{"risk_levels": ["critical"], "show_attack_paths": true}

User: "show lambda functions and their IAM roles"
{"resource_types": ["lambda", "iam_role"]}

User: "find attack paths from EC2 to IAM"
{"resource_types": ["ec2", "iam_role"], "show_attack_paths": true}

User: "show everything"
{}
"""

def parse_nl_query(query: str) -> Dict:
    """
    Sends a natural language query to Groq (free Llama 3) and returns
    a structured filter dict.
    """
    try:
        c = get_client()
        response = c.chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": query}
            ],
            temperature=0.1,
            max_tokens=200,
        )
        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: return empty filter (show all)
        return {}
    except Exception as e:
        print(f"[nl_parser] Groq error: {e}")
        return {}


def apply_filter(graph_json: Dict, filters: Dict) -> Dict:
    """
    Applies a filter dict to a graph JSON (nodes + links).
    Returns a filtered graph JSON.
    """
    nodes = graph_json["nodes"]
    links = graph_json["links"]

    # Filter nodes
    filtered_nodes = nodes

    if filters.get("resource_types"):
        types = filters["resource_types"]
        filtered_nodes = [n for n in filtered_nodes if n["type"] in types]

    if filters.get("public_only"):
        filtered_nodes = [n for n in filtered_nodes if n.get("is_public")]

    if filters.get("risk_levels"):
        levels = filters["risk_levels"]
        filtered_nodes = [n for n in filtered_nodes if n.get("risk") in levels]

    if filters.get("keyword"):
        kw = filters["keyword"].lower()
        filtered_nodes = [n for n in filtered_nodes
                          if kw in n.get("label", "").lower() or kw in n["id"].lower()]

    # Keep only links where both endpoints are in filtered nodes
    node_ids = {n["id"] for n in filtered_nodes}
    filtered_links = [
        l for l in links
        if l["source"] in node_ids and l["target"] in node_ids
    ]

    return {"nodes": filtered_nodes, "links": filtered_links}
