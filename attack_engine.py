import networkx as nx
from typing import List, Dict

RISK_SCORE = {"critical": 4, "high": 3, "medium": 2, "low": 1}

def find_attack_paths(G: nx.DiGraph) -> List[Dict]:
    """
    Finds potential attack paths in the cloud resource graph.
    Strategy: look for paths from public-facing resources to sensitive ones.
    Returns list of attack path dicts with nodes, severity, and description.
    """
    paths = []

    # Find entry points (public-facing)
    entry_points = [
        n for n, d in G.nodes(data=True)
        if d.get("is_public") or d.get("open_to_world") or d.get("risk") == "critical"
    ]

    # Find sensitive targets
    sensitive = [
        n for n, d in G.nodes(data=True)
        if d.get("type") in ("iam_role", "s3") or d.get("risk") in ("high", "critical")
    ]

    undirected = G.to_undirected()

    seen_paths = set()

    for entry in entry_points:
        for target in sensitive:
            if entry == target:
                continue
            try:
                path = nx.shortest_path(undirected, source=entry, target=target)
                key = tuple(path)
                if key in seen_paths or len(path) < 2:
                    continue
                seen_paths.add(key)

                # Score the path by max risk of any node in it
                max_risk = max(
                    RISK_SCORE.get(G.nodes[n].get("risk", "low"), 1)
                    for n in path
                )

                severity = {4: "critical", 3: "high", 2: "medium", 1: "low"}[max_risk]

                entry_data  = G.nodes[entry]
                target_data = G.nodes[target]

                description = (
                    f"Public {entry_data.get('type','resource')} "
                    f"'{entry_data.get('label', entry)}' can reach "
                    f"{target_data.get('type','resource')} "
                    f"'{target_data.get('label', target)}' "
                    f"in {len(path)-1} hop(s)."
                )

                paths.append({
                    "path": path,
                    "severity": severity,
                    "description": description,
                    "hops": len(path) - 1,
                    "entry": entry,
                    "target": target,
                })

            except nx.NetworkXNoPath:
                continue
            except nx.NodeNotFound:
                continue

    # Sort by severity desc, then fewest hops
    paths.sort(key=lambda x: (-RISK_SCORE.get(x["severity"], 1), x["hops"]))
    return paths[:20]  # return top 20 paths


def get_risk_summary(G: nx.DiGraph) -> Dict:
    """Returns a quick risk summary of the scanned graph."""
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for _, d in G.nodes(data=True):
        r = d.get("risk", "low")
        if r in counts:
            counts[r] += 1

    public_resources = [
        {"id": n, "label": d.get("label", n), "type": d.get("type")}
        for n, d in G.nodes(data=True)
        if d.get("is_public") or d.get("open_to_world")
    ]

    return {
        "total_resources": G.number_of_nodes(),
        "total_connections": G.number_of_edges(),
        "risk_counts": counts,
        "public_resources": public_resources,
        "public_count": len(public_resources),
    }
