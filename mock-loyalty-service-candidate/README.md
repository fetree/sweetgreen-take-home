# Loyalty Service

This is a mock external loyalty vendor service for the take-home assessment.

## Running the Service

### Option 1: Docker (Recommended)

```bash
docker build -t mock-loyalty-service .
docker run -p 3001:3001 mock-loyalty-service
```

### Option 2: Node.js

```bash
npm install
node server.js
```

### Verify it's running

```bash
curl http://localhost:3001/health
```

---

## API Endpoints

### `POST /validate`

Validates a reward code and returns the discount if valid.

**Request:**
```json
{
  "code": "SAVE500",
  "cartTotal": 1500
}
```

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | The reward code to validate |
| `cartTotal` | integer | Cart total in cents |

**Response (valid code):**
```json
{
  "valid": true,
  "discountCents": 500,
  "rewardId": "rwd_a1b2c3d4e5f6",
  "expiresAt": "2025-01-27T00:00:00.000Z"
}
```

**Response (invalid code):**
```json
{
  "valid": false,
  "discountCents": 0,
  "rewardId": null,
  "reason": "expired"
}
```

| Reason | Description |
|--------|-------------|
| `expired` | Code has expired |
| `already_redeemed` | Code was already used |
| `not_found` | Code doesn't exist |
| `minimum_not_met` | Cart total below minimum |

---

### `POST /redeem`

Redeems a validated reward, associating it with an order.

**Request:**
```json
{
  "rewardId": "rwd_a1b2c3d4e5f6",
  "orderId": "your-order-id-123"
}
```

**Response (success):**
```json
{
  "success": true,
  "redemptionId": "rdm_x7y8z9",
  "redeemedAt": "2025-01-26T15:30:00.000Z"
}
```

**Response (failure):**
```json
{
  "success": false,
  "error": "already_redeemed"
}
```

---

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-26T15:30:00.000Z"
}
```

---

## Test Codes

Use these codes for predictable testing:

| Code | Behavior |
|------|----------|
| `SAVE500` | Valid, $5.00 discount |
| `SAVE1000` | Valid, $10.00 discount |
| `PERCENT20` | Valid, 20% off cart total |
| `EXPIRED2024` | Invalid (expired) |
| `MINIMUM50` | Valid only if cart ≥ $50.00, then $10.00 discount |

---

## ⚠️ Failure Behavior

**This service is intentionally unreliable.** You should expect and handle:

| Scenario | What happens |
|----------|--------------|
| Slow responses | Response may take several seconds |
| Timeouts | Response may never return |
| 500 errors | Service temporarily unavailable |
| 503 errors | Service overloaded (check `Retry-After` header) |

### Critical: Ambiguous Redemption State

When `/redeem` returns a 500 error, **you cannot assume the redemption failed**. The reward may have been successfully redeemed despite the error response.

Your system must handle this ambiguity gracefully.

---

## Example Integration Flow

```
1. Customer enters code "SAVE500" with $15.00 cart

2. POST /validate
   Request:  { "code": "SAVE500", "cartTotal": 1500 }
   Response: { "valid": true, "discountCents": 500, "rewardId": "rwd_abc123", ... }

3. Display to customer: "Discount: $5.00 — New total: $10.00"

4. Customer clicks "Place Order"

5. POST /redeem
   Request:  { "rewardId": "rwd_abc123", "orderId": "order_456" }

6. Handle the response:
   • success: true  → Complete order with discount
   • success: false → Complete order without discount
   • 500 error      → ??? (this is where your design matters)
```

---

## Quick Test

```bash
# Validate a code
curl -X POST http://localhost:3001/validate \
  -H "Content-Type: application/json" \
  -d '{"code": "SAVE500", "cartTotal": 1500}'

# Redeem (use the rewardId from above)
curl -X POST http://localhost:3001/redeem \
  -H "Content-Type: application/json" \
  -d '{"rewardId": "rwd_...", "orderId": "test-order-1"}'
```
