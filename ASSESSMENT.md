# Senior Backend Engineer — Take-Home Assessment

**Suggested Time Box:** 4–5 days

## Overview

You'll build a small backend service that handles a simplified **checkout flow with loyalty rewards**—a scenario that mirrors real challenges on our team: coordinating state across services, integrating with external vendors, and handling failures gracefully.

We're not looking for a production-ready system. We're looking for **evidence of senior-level thinking**: clear code, thoughtful trade-offs, and an eye toward reliability and operability.

---

## Scenario

You're building the backend for a food ordering app. Customers can browse a menu, add items to a cart, apply loyalty rewards, and check out.

**The twist:** Loyalty points are managed by an external vendor. You'll integrate with a provided loyalty service that is *intentionally unreliable*—it may be slow, return errors, or behave unexpectedly.

Your system needs to handle this gracefully.

---

## Setup

You'll run two services locally:

```
┌─────────────────────┐         ┌─────────────────────┐
│                     │  HTTP   │                     │
│  Your Checkout API  │────────▶│  Mock Loyalty       │
│  (you build this)   │◀────────│  Service            │
│                     │         │  (we provide this)  │
│  localhost:3000     │         │  localhost:3001     │
└─────────────────────┘         └─────────────────────┘
```

### Step 1: Start the Mock Loyalty Service

We've provided a mock loyalty service that simulates an external vendor. **You must integrate with this service—do not stub or mock it in your code.**

```bash
# Option A: Docker (recommended)
cd mock-loyalty-service
docker build -t mock-loyalty-service .
docker run -p 3001:3001 mock-loyalty-service

# Option B: Node.js directly
cd mock-loyalty-service
npm install
node server.js
```

Verify it's running:
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}
```

### Step 2: Build Your Service

Build your checkout service to run on a different port (e.g., `localhost:3000`). Your service should call the loyalty service at `http://localhost:3001`.

**Important:** Make the loyalty service URL configurable (e.g., via environment variable). Don't hardcode `localhost:3001`.

---

## Core Requirements

Build a backend service (GraphQL strongly preferred; REST acceptable with justification) that supports:

1. **Browse menu** — Return a list of available items with prices
2. **Manage cart** — Add/remove items, view cart with running total
3. **Apply loyalty reward** — Validate a reward code via the loyalty service; apply the discount to the cart if valid
4. **Checkout** — Convert the cart to an order; return an order confirmation with ID, item summary, discount applied, and final total
5. **View order** — Retrieve a previously placed order by ID

---

## Loyalty Service Integration

The mock loyalty service exposes two endpoints your service must call:

### `POST http://localhost:3001/validate`

Validates a reward code before applying it to the cart.

```bash
curl -X POST http://localhost:3001/validate \
  -H "Content-Type: application/json" \
  -d '{"code": "SAVE500", "cartTotal": 1500}'
```

**Response (valid):**
```json
{
  "valid": true,
  "discountCents": 500,
  "rewardId": "rwd_abc123",
  "expiresAt": "2025-01-27T00:00:00.000Z"
}
```

**Response (invalid):**
```json
{
  "valid": false,
  "reason": "expired"
}
```

### `POST http://localhost:3001/redeem`

Redeems a reward when the customer checks out.

```bash
curl -X POST http://localhost:3001/redeem \
  -H "Content-Type: application/json" \
  -d '{"rewardId": "rwd_abc123", "orderId": "order_456"}'
```

**Response (success):**
```json
{
  "success": true,
  "redemptionId": "rdm_xyz789"
}
```

### Test Codes

Use these codes for predictable behavior during development:

| Code | Behavior |
|------|----------|
| `SAVE500` | Valid, $5.00 discount |
| `SAVE1000` | Valid, $10.00 discount |
| `PERCENT20` | Valid, 20% off cart total |
| `EXPIRED2024` | Invalid (expired) |
| `MINIMUM50` | Valid only if cart ≥ $50.00 |

### ⚠️ Failure Behavior

**The loyalty service is intentionally unreliable.** Your service must handle:

| Scenario | What you'll see |
|----------|-----------------|
| Slow responses | Takes several seconds |
| Timeouts | Never responds |
| 500 errors on `/validate` | Service temporarily unavailable |
| 503 errors | Service overloaded |
| 500 errors on `/redeem` | **Ambiguous** — may or may not have succeeded |

**Critical:** When `/redeem` returns a 500 error, you cannot assume the redemption failed. The reward may have been successfully redeemed despite the error. Your system must handle this ambiguity.

---

## Technical Guidance

- **Language/Framework:** Your choice. Our stack uses TypeScript/NestJS/GraphQL, but we value clear thinking over stack match.
- **Persistence:** SQLite, Postgres, or similar preferred. We want to see your data modeling. In-memory acceptable only if you explain the trade-off.
- **Testing:** Include at least a few tests that demonstrate your testing philosophy. We don't expect full coverage.
- **Auth:** Not required. Assume a single-user system or pass a user ID as a header.

---

## Edge Cases to Consider

You don't need to solve all of these perfectly, but we want to see that you've *thought* about them:

- What happens if a customer applies a reward, then the service is down at checkout?
- What if `/redeem` times out—do you complete the order? With or without the discount?
- How do you avoid charging full price if the discount was already shown in the cart?
- What if two concurrent checkouts try to use the same reward?

**Document your decisions.** "I chose X because Y, accepting trade-off Z" is exactly what we want to see.

---

## Submission

Provide a GitHub repository (or zip file) containing:

1. **Your checkout service code** — Runnable with clear setup instructions
2. **A README or design document** addressing the prompts below

**Note:** You don't need to include the mock loyalty service in your submission—we have it.

---

## Written Prompts

### 1. System Overview
Describe the end-to-end checkout flow, including how you handle the loyalty service integration. A diagram is welcome but not required.

### 2. Failure Handling
Explain how your system behaves when the loyalty service is slow, returns errors, or is completely unavailable. What trade-offs did you make between correctness and availability?

### 3. Data Model
Walk us through your data model. How do you represent carts, orders, and the reward lifecycle? How would this model evolve if we added multiple users or payment processing?

### 4. Observability
If this were a production service, what metrics, logs, or alerts would you add? How would you know if the loyalty integration was degraded before customers started complaining?

### 5. Technology Choices
Why did you choose your language/framework? What would you choose differently if this were a high-throughput production service?

---

## Evaluation Criteria

| Area | What we're looking for |
|------|------------------------|
| **Code quality** | Readable, well-structured, idiomatic |
| **API design** | Intuitive contracts, clear error handling, safe to consume |
| **Resilience** | Graceful degradation, timeouts, sensible retry logic |
| **Data modeling** | Appropriate schema, state transitions make sense |
| **Trade-off reasoning** | You can articulate *why*, not just *what* |
| **Written communication** | Clear, concise, demonstrates systems thinking |

We'd rather see a focused, well-reasoned solution than a feature-complete one. **If you run out of time, document what you'd do next.**

---

## What We're *Not* Evaluating

- Frontend skills
- DevOps/infrastructure setup
- Authentication/authorization implementation
- Payment processing

---

## Questions?

If anything is unclear, make a reasonable assumption and document it. That's part of the job.
