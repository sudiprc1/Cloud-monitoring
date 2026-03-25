# CloudGuard POC

NL → Cloud Diagram + Attack Path Mapper. Runs 100% locally. Zero cost.

## Requirements
- Python 3.9+
- Node.js 18+
- AWS credentials configured (`aws configure`)
- Free Groq API key → https://console.groq.com

## Setup

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
uvicorn main:app --reload --port 8000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### 3. Use it
1. Open http://localhost:5173
2. Select your AWS region
3. Click "Scan AWS"
4. Type any question in plain English:
   - "show me public S3 buckets"
   - "find attack paths from EC2 to IAM"
   - "what are the critical risks?"
5. Click "Show on graph" in the attack paths panel

## AWS Permissions needed (read-only)
The scanner only calls describe/list APIs. Attach this IAM policy to your user:
- ec2:DescribeInstances
- ec2:DescribeSecurityGroups
- s3:ListBuckets
- s3:GetBucketAcl
- lambda:ListFunctions
- iam:ListRoles

## Cost: $0
- Backend: runs locally
- Frontend: runs locally
- LLM: Groq free tier (14,400 req/day)
- AWS calls: all free describe* APIs
- No database: graph stored in memory
