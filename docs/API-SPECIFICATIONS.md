# Tanzania National Platform API Specifications

## Overview

This document defines the REST API specifications for the Tanzania National Digital Ecosystem Platform. The API follows RESTful principles with JSON payloads and uses JWT for authentication.

## Base URL
```
https://api.platform.tanzania.gov.tz/v1
```

## Authentication

All API requests require authentication using JWT tokens obtained through the identity service.

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-API-Key: <service_api_key>  # For service-to-service calls
```

## Common Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "request_id": "uuid-v4",
    "version": "1.0.0"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": { ... },
    "timestamp": "2024-01-01T00:00:00Z",
    "request_id": "uuid-v4"
  }
}
```

## Identity Layer API

### POST /identity/register
Register a new citizen identity with biometric verification.

**Request Body:**
```json
{
  "national_id": "19900101-12345-67890",
  "phone_number": "+255712345678",
  "email": "citizen@example.com",
  "biometric_data": {
    "fingerprint_hash": "sha256_hash",
    "facial_template": "base64_encoded_template",
    "voice_sample": "base64_encoded_audio"
  },
  "personal_info": {
    "first_name": "John",
    "last_name": "Doe",
    "date_of_birth": "1990-01-01",
    "gender": "M",
    "region": "Dar es Salaam",
    "district": "Kinondoni"
  },
  "consent": {
    "data_processing": true,
    "biometric_storage": true,
    "terms_accepted": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "did": "did:tanzania:1234567890abcdef",
    "verification_token": "verification_token",
    "status": "pending_verification"
  }
}
```

### POST /identity/verify
Complete biometric verification process.

**Request Body:**
```json
{
  "verification_token": "verification_token",
  "biometric_challenge": {
    "fingerprint_scan": "base64_encoded_scan",
    "facial_scan": "base64_encoded_image",
    "voice_verification": "base64_encoded_audio"
  }
}
```

### GET /identity/profile/{did}
Retrieve citizen profile information.

**Response:**
```json
{
  "success": true,
  "data": {
    "did": "did:tanzania:1234567890abcdef",
    "national_id": "19900101-12345-67890",
    "personal_info": { ... },
    "verification_status": "verified",
    "last_updated": "2024-01-01T00:00:00Z",
    "credentials": ["voting_rights", "social_access"]
  }
}
```

### POST /identity/authenticate
Authenticate user and obtain JWT token.

**Request Body:**
```json
{
  "identifier": "did:tanzania:1234567890abcdef",
  "biometric_auth": {
    "fingerprint_hash": "sha256_hash",
    "device_signature": "device_signature"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "jwt_access_token",
    "refresh_token": "jwt_refresh_token",
    "expires_in": 3600,
    "token_type": "Bearer"
  }
}
```

## Voting & Governance API

### GET /voting/elections
List available elections.

**Query Parameters:**
- `status`: active, upcoming, completed
- `region`: filter by region
- `limit`: number of results (default: 20)
- `offset`: pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "elections": [
      {
        "id": "election_uuid",
        "title": "Presidential Election 2024",
        "description": "General presidential election",
        "start_date": "2024-10-01T08:00:00Z",
        "end_date": "2024-10-01T20:00:00Z",
        "status": "active",
        "region": "national",
        "eligible_voters": 65000000,
        "total_votes": 0,
        "candidates": [...]
      }
    ],
    "meta": {
      "total": 1,
      "limit": 20,
      "offset": 0
    }
  }
}
```

### POST /voting/vote
Cast a vote in an election.

**Request Body:**
```json
{
  "election_id": "election_uuid",
  "candidate_id": "candidate_uuid",
  "vote_data": {
    "encrypted_vote": "encrypted_vote_data",
    "proof_of_vote": "zkp_proof",
    "timestamp": "2024-01-01T12:00:00Z"
  },
  "receipt_request": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vote_id": "vote_uuid",
    "receipt": {
      "transaction_hash": "hedera_transaction_hash",
      "block_number": 12345,
      "timestamp": "2024-01-01T12:00:00Z",
      "verification_code": "verification_code"
    },
    "status": "confirmed"
  }
}
```

### GET /voting/results/{election_id}
Get election results.

**Response:**
```json
{
  "success": true,
  "data": {
    "election_id": "election_uuid",
    "status": "completed",
    "total_votes": 45000000,
    "results": [
      {
        "candidate_id": "candidate_uuid",
        "candidate_name": "John Doe",
        "party": "Tanzania Unity Party",
        "votes": 22500000,
        "percentage": 50.0
      }
    ],
    "metadata": {
      "verified_votes": 45000000,
      "invalid_votes": 50000,
      "turnout_percentage": 69.2,
      "last_updated": "2024-10-01T22:00:00Z"
    }
  }
}
```

### POST /voting/verify-vote
Verify a vote using receipt.

**Request Body:**
```json
{
  "election_id": "election_uuid",
  "verification_code": "verification_code",
  "receipt_data": {
    "transaction_hash": "hedera_transaction_hash",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

## Social Engagement API

### POST /social/posts
Create a new social post.

**Request Body:**
```json
{
  "content": {
    "text": "This is my post about community development",
    "media": [
      {
        "type": "image",
        "url": "https://storage.platform.tanzania.gov.tz/uploads/image.jpg",
        "caption": "Community center construction"
      }
    ],
    "language": "sw"
  },
  "visibility": "public",
  "tags": ["community", "development", "tanzania"],
  "location": {
    "region": "Dar es Salaam",
    "district": "Kinondoni",
    "coordinates": [-6.7924, 39.2083]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "post_id": "post_uuid",
    "content_hash": "ipfs_content_hash",
    "moderation_status": "pending",
    "created_at": "2024-01-01T10:00:00Z",
    "hedera_transaction": "transaction_hash"
  }
}
```

### GET /social/feed
Get personalized social feed.

**Query Parameters:**
- `limit`: number of posts (default: 20)
- `offset`: pagination offset
- `filter`: trending, following, local, national

**Response:**
```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "id": "post_uuid",
        "author": {
          "did": "did:tanzania:author_did",
          "display_name": "John Citizen",
          "verified": true
        },
        "content": { ... },
        "engagement": {
          "likes": 1250,
          "comments": 89,
          "shares": 45
        },
        "moderation_status": "approved",
        "created_at": "2024-01-01T10:00:00Z"
      }
    ],
    "meta": {
      "total": 1000,
      "limit": 20,
      "offset": 0,
      "next_cursor": "next_page_cursor"
    }
  }
}
```

### POST /social/posts/{post_id}/moderate
Submit moderation decision (admin only).

**Request Body:**
```json
{
  "decision": "approve",
  "reason": "Content complies with community guidelines",
  "moderator_id": "moderator_did",
  "ai_confidence": 0.95
}
```

## Knowledge & Intelligence API

### GET /knowledge/search
Search knowledge base with RAG.

**Query Parameters:**
- `query`: search query
- `language`: sw, en
- `domain`: constitution, laws, policies, news
- `limit`: results limit

**Request Body:**
```json
{
  "query": "What are the rights of citizens regarding education?",
  "context": {
    "user_location": "Dar es Salaam",
    "user_interests": ["education", "rights"],
    "conversation_history": [...]
  },
  "filters": {
    "date_range": {
      "start": "2020-01-01",
      "end": "2024-12-31"
    },
    "sources": ["constitution", "education_act"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "What are the rights of citizens regarding education?",
    "results": [
      {
        "id": "knowledge_uuid",
        "title": "Article 11 - Right to Education",
        "content": "Every citizen has the right to education...",
        "source": "Tanzania Constitution 1977",
        "relevance_score": 0.95,
        "citations": [...],
        "related_topics": [...]
      }
    ],
    "generated_response": {
      "answer": "According to Article 11 of the Tanzania Constitution...",
      "confidence": 0.92,
      "sources_used": [...],
      "follow_up_questions": [...]
    },
    "meta": {
      "total_results": 25,
      "processing_time": 0.45,
      "model_version": "opencog-hyperon-v2.1"
    }
  }
}
```

### POST /knowledge/feedback
Submit feedback on knowledge response.

**Request Body:**
```json
{
  "query_id": "query_uuid",
  "response_id": "response_uuid",
  "rating": 5,
  "feedback": "Very helpful and accurate",
  "corrections": null
}
```

## Analytics & Reporting API

### GET /analytics/dashboard
Get platform analytics dashboard data.

**Query Parameters:**
- `time_range`: 1h, 24h, 7d, 30d, 90d
- `region`: specific region or 'national'
- `metrics`: participation, engagement, security

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_users": 65000000,
      "active_users_24h": 5200000,
      "total_posts": 15000000,
      "total_votes": 45000000,
      "platform_health": 99.8
    },
    "metrics": {
      "user_engagement": {
        "daily_active_users": [...],
        "post_creation_rate": [...],
        "vote_participation": [...]
      },
      "security": {
        "failed_auth_attempts": 1250,
        "moderation_actions": 890,
        "system_uptime": 99.95
      },
      "performance": {
        "api_response_time": 245,
        "error_rate": 0.02,
        "throughput": 12500
      }
    },
    "regional_breakdown": [...],
    "trends": {
      "participation_trend": "increasing",
      "engagement_trend": "stable",
      "issues_trend": "decreasing"
    }
  }
}
```

### GET /analytics/reports/{report_type}
Generate specific reports.

**Report Types:**
- `user-demographics`
- `election-results`
- `content-moderation`
- `security-incidents`
- `performance-metrics`

**Response:**
```json
{
  "success": true,
  "data": {
    "report_id": "report_uuid",
    "type": "user-demographics",
    "generated_at": "2024-01-01T00:00:00Z",
    "period": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    },
    "data": { ... },
    "export_formats": ["pdf", "csv", "json"],
    "download_url": "https://storage.platform.tanzania.gov.tz/reports/report_uuid.pdf"
  }
}
```

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `VALIDATION_ERROR` | Invalid request parameters | 400 |
| `AUTHENTICATION_ERROR` | Invalid or missing authentication | 401 |
| `AUTHORIZATION_ERROR` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `CONFLICT` | Resource conflict | 409 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable | 503 |

## Rate Limits

- **Identity endpoints**: 100 requests/minute per user
- **Voting endpoints**: 10 requests/minute per user (election day: 5/hour)
- **Social endpoints**: 500 requests/minute per user
- **Knowledge endpoints**: 200 requests/minute per user
- **Analytics endpoints**: 50 requests/minute per user

## Webhooks

The platform supports webhooks for real-time notifications:

### Election Results Webhook
```json
{
  "event": "election.results.updated",
  "data": {
    "election_id": "election_uuid",
    "results": { ... },
    "timestamp": "2024-01-01T22:00:00Z"
  }
}
```

### Moderation Alert Webhook
```json
{
  "event": "content.moderation.alert",
  "data": {
    "post_id": "post_uuid",
    "moderation_decision": "flagged",
    "reason": "hate_speech",
    "confidence": 0.87
  }
}
```

## SDKs and Libraries

Official SDKs available for:
- JavaScript/Node.js
- Python
- Java
- Go
- Mobile (React Native, Flutter)

## Versioning

API versioning follows semantic versioning (MAJOR.MINOR.PATCH).

- **Breaking changes**: Increment MAJOR version
- **New features**: Increment MINOR version
- **Bug fixes**: Increment PATCH version

Current version: `1.0.0`