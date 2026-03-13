---
name: bland-knowledge-base
description: >
  Manage Bland AI knowledge bases: upload files, text, or web content to create
  searchable knowledge for your voice agents. List, inspect, update, and delete
  knowledge bases. Use when the user wants to give an agent reference material,
  upload documents, or manage existing knowledge bases.
user-invocable: true
---

# Bland AI Knowledge Base Management


## Create Knowledge Base

All creation methods use `POST https://api.bland.ai/v1/knowledge/learn`. The `type` field determines the source.

Knowledge bases start in `PROCESSING` status. Poll with the Get endpoint until `COMPLETED` before attaching to a call.

### Upload a File

Supports PDF, Word documents, text files, and more. Uses `multipart/form-data`.

```bash
source /tmp/bland_env.sh
curl -s -X POST https://api.bland.ai/v1/knowledge/learn \
  -H "authorization: $BLAND_API_KEY" \
  -F "type=file" \
  -F "name=Company FAQs" \
  -F "description=Frequently asked questions and policies" \
  -F "file=@/path/to/document.pdf"
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | yes | Must be `"file"` |
| `file` | yes | The file to upload (`@path/to/file`) |
| `name` | no | KB name (defaults to filename) |
| `description` | no | Optional description |

### Upload Text

For inline text content (max 1 MB). Uses `application/json`.

```bash
source /tmp/bland_env.sh
curl -s -X POST https://api.bland.ai/v1/knowledge/learn \
  -H "authorization: $BLAND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "name": "Product Info",
    "description": "Product specifications",
    "text": "Your text content here..."
  }'
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | yes | Must be `"text"` |
| `text` | yes | The text content (max 1 MB) |
| `name` | yes | KB name |
| `description` | no | Optional description |

### Scrape Websites

Create a KB from one or more URLs (max 100).

```bash
source /tmp/bland_env.sh
curl -s -X POST https://api.bland.ai/v1/knowledge/learn \
  -H "authorization: $BLAND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "web",
    "name": "Support Docs",
    "description": "Customer support documentation",
    "urls": [
      "https://example.com/docs/overview",
      "https://example.com/docs/faq"
    ]
  }'
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | yes | Must be `"web"` |
| `urls` | yes | Array of URLs to scrape (max 100) |
| `name` | yes | KB name |
| `description` | no | Optional description |

### Creation Response

All three methods return:

```json
{
  "data": {
    "id": "kb_01H8X9QK5R2N7P3M6Z8W4Y1V5T",
    "name": "Company FAQs",
    "status": "PROCESSING",
    "type": "FILE"
  },
  "errors": null
}
```

**Save the `id`** — you need it to check status, attach to calls, or delete later.

---

## Poll Until Ready

Knowledge bases are not immediately usable. Poll until `status` is `COMPLETED`:

```bash
KB_ID="kb_01H8X9QK5R2N7P3M6Z8W4Y1V5T"
while true; do
  STATUS=$(curl -s -H "authorization: $BLAND_API_KEY" \
    "https://api.bland.ai/v1/knowledge/$KB_ID" | jq -r '.data.status')
  echo "Status: $STATUS"
  if [ "$STATUS" = "COMPLETED" ]; then
    echo "Knowledge base ready"
    break
  elif [ "$STATUS" = "FAILED" ]; then
    curl -s -H "authorization: $BLAND_API_KEY" \
      "https://api.bland.ai/v1/knowledge/$KB_ID" | jq '.data.error_message'
    break
  fi
  sleep 5
done
```

Status flow: `PROCESSING` → `COMPLETED` or `FAILED`

---

## List Knowledge Bases

```bash
curl -s -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/knowledge" \
  | jq '.data.kbs[] | {id, name, status, type}'
```

With pagination:

```bash
curl -s -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/knowledge?page=1&limit=20" \
  | jq '{total: .data.total, kbs: [.data.kbs[] | {id, name, status, type}]}'
```

## Get Knowledge Base Details

```bash
curl -s -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/knowledge/<kb_id>" \
  | jq '.data | {id, name, description, status, type, created_at, updated_at}'
```

**Key response fields**:
- `id` — unique identifier (use this in `tools` when creating calls)
- `status` — `PROCESSING`, `COMPLETED`, `FAILED`, or `DELETED`
- `type` — `FILE`, `TEXT`, or `WEB_SCRAPE`
- `error_message` — present when status is `FAILED`
- `file` — object with `file_name`, `file_size`, `file_type` (for FILE type)

## Update Knowledge Base

Rename or change description (does not modify content):

```bash
curl -s -X PUT "https://api.bland.ai/v1/knowledge/<kb_id>" \
  -H "authorization: $BLAND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name", "description": "New description"}'
```

Pass `"description": null` to remove the description.

## Delete Knowledge Base

Soft-deletes by setting status to `DELETED`:

```bash
curl -s -X DELETE -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/knowledge/<kb_id>" | jq '.data'
```

---

## Attaching a Knowledge Base to a Call

Once a KB is `COMPLETED`, pass its ID in the `tools` array when creating a call. Remember, a KB ID is prefixed with `KB-`:

```bash
curl -s -X POST https://api.bland.ai/v1/calls \
  -H "authorization: $BLAND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+14155551234",
    "task": "You are a support agent. Use your knowledge base to answer questions.",
    "tools": ["'"$KB_ID"'"],
    "record": true,
    "max_duration": 5
  }'
```

The `tools` array accepts both knowledge base IDs and custom tool IDs:
```json
"tools": ["KB-01H8...", "TL-ba6c4237-..."]
```

See the `create-call` skill for full call creation documentation.

---

## Common Patterns

### Upload a file and make a call with it

```bash
source /tmp/bland_env.sh

# 1. Upload
KB_ID=$(curl -s -X POST https://api.bland.ai/v1/knowledge/learn \
  -H "authorization: $BLAND_API_KEY" \
  -F "type=file" \
  -F "name=Product Guide" \
  -F "file=@product_guide.pdf" | jq -r '.data.id')
echo "Created KB: $KB_ID"

# 2. Wait for processing
while true; do
  STATUS=$(curl -s -H "authorization: $BLAND_API_KEY" \
    "https://api.bland.ai/v1/knowledge/$KB_ID" | jq -r '.data.status')
  [ "$STATUS" = "COMPLETED" ] && break
  [ "$STATUS" = "FAILED" ] && echo "Failed!" && exit 1
  sleep 5
done

# 3. Create call with KB attached
curl -s -X POST https://api.bland.ai/v1/calls \
  -H "authorization: $BLAND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+1XXXXXXXXXX",
    "task": "You are a product specialist. Use your knowledge base to answer any questions about the product.",
    "tools": ["'"$KB_ID"'"],
    "record": true,
    "max_duration": 5
  }'
```

### Quick text KB for a one-off call

```bash
source /tmp/bland_env.sh

KB_ID=$(curl -s -X POST https://api.bland.ai/v1/knowledge/learn \
  -H "authorization: $BLAND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "name": "Call Context",
    "text": "The customer ordered item #12345 on March 1. It shipped on March 3 via FedEx tracking 789456123. Expected delivery is March 7."
  }' | jq -r '.data.id')

# Wait for processing (text KBs are usually fast)
sleep 3
STATUS=$(curl -s -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/knowledge/$KB_ID" | jq -r '.data.status')
echo "KB status: $STATUS"
```

## Error Handling

- **401**: Invalid API key — check `$BLAND_API_KEY`
- **400**: Missing required fields or invalid input
- **404**: Knowledge base not found or access denied
- **429**: Rate limited — wait 10 seconds between uploads, or wait for current upload to complete
- **413**: File too large
- **500**: Server error — retry after 5 seconds
