# Untrace API Schemas & Data Formats

This document provides quick reference for all API endpoints, data schemas, and integration formats.

## 🔑 Authentication

### API Key Header
```http
X-Untrace-Key: tr_live_1234567890abcdef
```

### API Key Format
```
tr_{environment}_{random_32_chars}
```
- Environments: `live`, `test`
- Example: `tr_live_sk9f8sd7f6s8d7f6s8d7f6s8d7f6s8df`

---

## 📨 Core API Endpoints

### 1. Trace Submission

#### POST /v1/traces
Submit a single trace event.

**Request:**
```json
{
  "id": "trace_123abc",
  "parentId": "trace_parent_456",
  "sessionId": "session_789",
  "timestamp": "2025-01-15T10:30:00Z",
  "provider": "openai",
  "model": "gpt-4",
  "request": {
    "messages": [
      {
        "role": "user",
        "content": "What is the weather?"
      }
    ],
    "temperature": 0.7,
    "max_tokens": 150
  },
  "response": {
    "id": "chatcmpl-123",
    "choices": [{
      "message": {
        "role": "assistant",
        "content": "I don't have access to real-time weather data."
      },
      "finish_reason": "stop"
    }],
    "usage": {
      "prompt_tokens": 10,
      "completion_tokens": 20,
      "total_tokens": 30
    }
  },
  "metadata": {
    "environment": "production",
    "userId": "user_123",
    "applicationId": "app_456",
    "version": "1.0.0",
    "tags": {
      "feature": "chat",
      "experiment": "v2"
    }
  },
  "metrics": {
    "latency_ms": 1234,
    "time_to_first_token_ms": 523,
    "tokens_per_second": 15.2
  }
}
```

**Response:**
```json
{
  "id": "trace_123abc",
  "status": "accepted",
  "message": "Trace queued for processing"
}
```

### 2. Batch Trace Submission

#### POST /v1/traces/batch
Submit multiple traces at once (max 1000).

**Request:**
```json
{
  "traces": [
    { /* trace object 1 */ },
    { /* trace object 2 */ }
  ]
}
```

**Response:**
```json
{
  "accepted": 2,
  "rejected": 0,
  "errors": []
}
```

### 3. Routing Rules

#### GET /v1/routing/rules
Get all routing rules for the account.

**Response:**
```json
{
  "rules": [
    {
      "id": "rule_123",
      "name": "Route GPT-4 to LangSmith",
      "enabled": true,
      "priority": 100,
      "conditions": {
        "all": [
          {
            "field": "model",
            "operator": "eq",
            "value": "gpt-4"
          }
        ]
      },
      "actions": {
        "destinations": ["langsmith"],
        "sampling": {
          "rate": 0.1,
          "type": "random"
        }
      }
    }
  ]
}
```

#### POST /v1/routing/rules
Create a new routing rule.

**Request:**
```json
{
  "name": "High Cost Traces",
  "conditions": {
    "all": [
      {
        "field": "metrics.estimated_cost",
        "operator": "gt",
        "value": 0.10
      }
    ]
  },
  "actions": {
    "destinations": ["langsmith", "langfuse"],
    "transformations": ["pii_redaction"]
  }
}
```

### 4. Destinations

#### GET /v1/destinations
List all configured destinations.

**Response:**
```json
{
  "destinations": [
    {
      "id": "dest_123",
      "name": "Production LangSmith",
      "type": "langsmith",
      "enabled": true,
      "config": {
        "apiUrl": "https://api.langsmith.com",
        "projectId": "proj_123"
      },
      "health": {
        "status": "healthy",
        "lastCheck": "2025-01-15T10:00:00Z",
        "successRate": 0.999
      }
    }
  ]
}
```

#### POST /v1/destinations
Add a new destination.

**Request:**
```json
{
  "name": "Dev Langfuse",
  "type": "langfuse",
  "config": {
    "apiUrl": "https://api.langfuse.com",
    "publicKey": "pk_123",
    "secretKey": "sk_***"
  }
}
```

---

## 🔄 OpenAI Proxy Format

### Proxy URL
```
https://api.untrace.dev/v1/proxy/openai
```

### Usage Example
```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-...",  # Your OpenAI key
    base_url="https://api.untrace.dev/v1/proxy/openai",
    default_headers={
        "X-Untrace-Key": "tr_live_...",  # Your Untrace key
        "X-Untrace-Metadata": json.dumps({
            "userId": "user_123",
            "environment": "production"
        })
    }
)
```

---

## 📤 Destination Formats

### 1. LangSmith Format
```json
{
  "id": "run_123",
  "name": "ChatCompletion",
  "run_type": "llm",
  "start_time": "2025-01-15T10:30:00Z",
  "end_time": "2025-01-15T10:30:01.234Z",
  "inputs": {
    "messages": [...],
    "model": "gpt-4",
    "temperature": 0.7
  },
  "outputs": {
    "generations": [[{
      "text": "Response text",
      "message": {...}
    }]]
  },
  "extra": {
    "metadata": {...},
    "metrics": {...}
  }
}
```

### 2. Langfuse Format
```json
{
  "id": "trace_123",
  "timestamp": "2025-01-15T10:30:00Z",
  "name": "chat-completion",
  "userId": "user_123",
  "metadata": {...},
  "release": "v1.0.0",
  "version": "1.0.0",
  "sessionId": "session_123",
  "input": {...},
  "output": {...},
  "model": "gpt-4",
  "modelParameters": {
    "temperature": 0.7,
    "maxTokens": 150
  },
  "usage": {
    "input": 10,
    "output": 20,
    "total": 30,
    "unit": "TOKENS",
    "inputCost": 0.0003,
    "outputCost": 0.0006,
    "totalCost": 0.0009
  }
}
```

### 3. Keywords.ai Format
```json
{
  "request_id": "req_123",
  "created_at": 1736935800,
  "model": "gpt-4",
  "messages": [...],
  "completion": {...},
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  },
  "metadata": {
    "user_id": "user_123",
    "tags": ["production", "chat"]
  },
  "metrics": {
    "latency": 1234,
    "ttft": 523
  }
}
```

### 4. Custom Webhook Format
```json
{
  "version": "1.0",
  "timestamp": "2025-01-15T10:30:00Z",
  "trace": {
    /* Full trace object */
  },
  "routing": {
    "rules": ["rule_123"],
    "destinations": ["webhook_prod"]
  }
}
```

---

## 📊 Webhook Events

### Trace Processed
```json
{
  "event": "trace.processed",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "traceId": "trace_123",
    "destinations": {
      "langsmith": "success",
      "langfuse": "success"
    }
  }
}
```

### Destination Failed
```json
{
  "event": "destination.failed",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "destinationId": "dest_123",
    "error": "Connection timeout",
    "retryCount": 3,
    "willRetry": true
  }
}
```

---

## 🛠️ SDK Methods

### TypeScript SDK
```typescript
import { Untrace } from '@untrace/sdk';

const tracer = new Untrace({
  apiKey: 'tr_live_...',
  baseUrl: 'https://api.untrace.dev', // optional
  maxRetries: 3, // optional
  timeout: 30000 // optional
});

// Manual trace
await tracer.trace({
  provider: 'openai',
  model: 'gpt-4',
  request: { /* ... */ },
  response: { /* ... */ },
  metadata: { /* ... */ }
});

// Automatic OpenAI wrapper
import { OpenAI } from '@untrace/openai';

const openai = new OpenAI({
  apiKey: 'sk-...',
  tracerApiKey: 'tr_live_...'
});

// Use exactly like OpenAI SDK
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### Python SDK
```python
from untrace import Untrace

tracer = Untrace(
    api_key="tr_live_...",
    base_url="https://api.untrace.dev",  # optional
    max_retries=3,  # optional
    timeout=30  # optional
)

# Manual trace
tracer.trace({
    "provider": "openai",
    "model": "gpt-4",
    "request": {...},
    "response": {...},
    "metadata": {...}
})

# Context manager
with tracer.span(name="my-operation") as span:
    # Your LLM call here
    response = call_llm()
    span.set_output(response)

# Automatic OpenAI wrapper
from untrace.openai import OpenAI

client = OpenAI(
    api_key="sk-...",
    tracer_api_key="tr_live_..."
)

# Use exactly like OpenAI SDK
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

---

## 🔍 Query Parameters

### Common Query Parameters
- `limit`: Number of results (default: 20, max: 100)
- `offset`: Pagination offset
- `sort`: Sort field (e.g., `created_at`, `-created_at` for DESC)
- `filter`: JSON filter object

### Filter Examples
```
# Get traces for specific model
?filter={"model":"gpt-4"}

# Get high-cost traces
?filter={"metrics.estimated_cost":{"$gt":0.10}}

# Get traces from last hour
?filter={"timestamp":{"$gte":"2025-01-15T09:00:00Z"}}
```

---

## 🚨 Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please retry after 60 seconds.",
    "details": {
      "limit": 1000,
      "window": "1h",
      "retry_after": 60
    }
  }
}
```

### Common Error Codes
- `INVALID_API_KEY`: Invalid or missing API key
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INVALID_REQUEST`: Malformed request body
- `DESTINATION_ERROR`: Failed to deliver to destination
- `INTERNAL_ERROR`: Server error (500)
- `NOT_FOUND`: Resource not found
- `FORBIDDEN`: Insufficient permissions
- `CONFLICT`: Resource already exists

---

## 📈 Metrics & Monitoring

### Health Check Endpoint
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-01-15T10:30:00Z",
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "kafka": "healthy",
    "destinations": {
      "langsmith": "healthy",
      "langfuse": "healthy"
    }
  }
}
```

### Metrics Endpoint
```http
GET /metrics
```

Returns Prometheus-formatted metrics:
```
# HELP untrace_traces_total Total number of traces processed
# TYPE untrace_traces_total counter
untrace_traces_total{status="success"} 1234567

# HELP untrace_api_latency_seconds API endpoint latency
# TYPE untrace_api_latency_seconds histogram
untrace_api_latency_seconds_bucket{le="0.005"} 1234
```

---

## 🔐 Security Headers

### Required Headers
```http
X-Untrace-Key: tr_live_...
Content-Type: application/json
```

### Optional Headers
```http
X-Untrace-Metadata: {"userId":"123","env":"prod"}
X-Idempotency-Key: unique-request-id
X-Untrace-Dry-Run: true
```

---

This document serves as a quick reference during implementation. For detailed specifications, refer to the full API documentation.