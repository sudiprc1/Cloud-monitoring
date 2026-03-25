import boto3
from botocore.exceptions import ClientError, NoCredentialsError
import networkx as nx
from typing import Dict, List

def scan_aws(region: str = "us-east-1") -> nx.DiGraph:
    """
    Scans AWS account using read-only describe* calls.
    Returns a NetworkX directed graph of resources and their relationships.
    """
    G = nx.DiGraph()

    try:
        ec2 = boto3.client("ec2", region_name=region)
        s3  = boto3.client("s3")
        lam = boto3.client("lambda", region_name=region)
        iam = boto3.client("iam")
    except NoCredentialsError:
        raise Exception("AWS credentials not found. Run 'aws configure' first.")

    # ── EC2 Instances ────────────────────────────────────────────────────────
    try:
        reservations = ec2.describe_instances()["Reservations"]
        for r in reservations:
            for inst in r["Instances"]:
                iid   = inst["InstanceId"]
                state = inst["State"]["Name"]
                itype = inst.get("InstanceType", "unknown")
                public_ip = inst.get("PublicIpAddress")
                G.add_node(iid,
                    type="ec2",
                    label=iid,
                    state=state,
                    instance_type=itype,
                    public_ip=public_ip,
                    is_public=public_ip is not None,
                    risk="high" if public_ip else "low"
                )
                # Link instance → security groups
                for sg in inst.get("SecurityGroups", []):
                    sgid = sg["GroupId"]
                    if not G.has_node(sgid):
                        G.add_node(sgid, type="security_group",
                                   label=sg["GroupName"], risk="medium")
                    G.add_edge(iid, sgid, relation="protected_by")

                # Link instance → VPC
                vpc_id = inst.get("VpcId")
                if vpc_id:
                    if not G.has_node(vpc_id):
                        G.add_node(vpc_id, type="vpc", label=vpc_id, risk="low")
                    G.add_edge(vpc_id, iid, relation="contains")
    except ClientError as e:
        print(f"[scanner] EC2 error: {e}")

    # ── Security Group Rules ─────────────────────────────────────────────────
    try:
        sgs = ec2.describe_security_groups()["SecurityGroups"]
        for sg in sgs:
            sgid = sg["GroupId"]
            if not G.has_node(sgid):
                G.add_node(sgid, type="security_group",
                           label=sg["GroupName"], risk="medium")
            # Check for 0.0.0.0/0 inbound — high risk
            for perm in sg.get("IpPermissions", []):
                for ipr in perm.get("IpRanges", []):
                    if ipr.get("CidrIp") == "0.0.0.0/0":
                        G.nodes[sgid]["risk"] = "critical"
                        G.nodes[sgid]["open_to_world"] = True
    except ClientError as e:
        print(f"[scanner] SG error: {e}")

    # ── S3 Buckets ───────────────────────────────────────────────────────────
    try:
        buckets = s3.list_buckets().get("Buckets", [])
        for b in buckets:
            name = b["Name"]
            risk = "low"
            is_public = False
            try:
                acl = s3.get_bucket_acl(Bucket=name)
                for grant in acl.get("Grants", []):
                    grantee = grant.get("Grantee", {})
                    if grantee.get("URI", "").endswith("AllUsers"):
                        risk = "critical"
                        is_public = True
            except ClientError:
                pass
            G.add_node(f"s3:{name}",
                type="s3",
                label=name,
                risk=risk,
                is_public=is_public
            )
    except ClientError as e:
        print(f"[scanner] S3 error: {e}")

    # ── Lambda Functions ─────────────────────────────────────────────────────
    try:
        fns = lam.list_functions().get("Functions", [])
        for fn in fns:
            fname = fn["FunctionName"]
            farn   = fn["FunctionArn"]
            role   = fn.get("Role", "")
            G.add_node(farn,
                type="lambda",
                label=fname,
                risk="medium",
                role_arn=role
            )
            # Link lambda → IAM role
            if role:
                if not G.has_node(role):
                    G.add_node(role, type="iam_role", label=role.split("/")[-1],
                               risk="medium")
                G.add_edge(farn, role, relation="assumes_role")
    except ClientError as e:
        print(f"[scanner] Lambda error: {e}")

    # ── IAM Roles (top 50) ───────────────────────────────────────────────────
    try:
        roles = iam.list_roles(MaxItems=50).get("Roles", [])
        for role in roles:
            rarn = role["Arn"]
            rname = role["RoleName"]
            if not G.has_node(rarn):
                G.add_node(rarn, type="iam_role", label=rname, risk="medium")
    except ClientError as e:
        print(f"[scanner] IAM error: {e}")

    print(f"[scanner] Graph built: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    return G


def graph_to_json(G: nx.DiGraph) -> Dict:
    """Convert NetworkX graph to JSON for frontend D3.js"""
    nodes = []
    for nid, data in G.nodes(data=True):
        nodes.append({
            "id": nid,
            "label": data.get("label", nid),
            "type": data.get("type", "unknown"),
            "risk": data.get("risk", "low"),
            "is_public": data.get("is_public", False),
            **{k: v for k, v in data.items()
               if k not in ("label", "type", "risk", "is_public")}
        })

    links = []
    for src, dst, data in G.edges(data=True):
        links.append({
            "source": src,
            "target": dst,
            "relation": data.get("relation", "connects")
        })

    return {"nodes": nodes, "links": links}
