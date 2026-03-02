# Sweetgreen Take-Home

A GraphQL checkout service with loyalty reward integration, built with NestJS, Apollo Server, Prisma, and PostgreSQL.

---

## Written Prompts

Answers to the written questions are in [WRITTEN-PROMPTS.md](./WRITTEN-PROMPTS.md).

---

## Quick Start (Docker — recommended)

### 1. Start the loyalty service

```bash
cd mock-loyalty-service-candidate
npm install
node server.js
```

Verify it's running:
```bash
curl http://localhost:3001/health
# {"status":"ok","timestamp":"..."}
```

### 2. Start the checkout service

```bash
cd mock-checkout-service
docker compose up --build
```

The GraphQL playground is available at **http://localhost:3000/graphql**.

To stop:
```bash
docker compose down
```

---

## Example Queries

### Health check
```graphql
query {
  health
}
```

### Browse the menu
```graphql
query {
  menuItems {
    id
    name
    priceCents
    available
  }
}
```

### Add an item to the cart
```graphql
mutation {
  addToCart(userId: "user-1", menuItemId: "<id from menuItems>", quantity: 2) {
    id
    items {
      id
      name
      priceCents
      quantity
      lineCents
    }
    subtotalCents
    totalCents
  }
}
```

### View the cart
```graphql
query {
  cart(userId: "user-1") {
    id
    items {
      id
      name
      quantity
      lineCents
    }
    subtotalCents
    discountCents
    totalCents
    reward {
      code
      discountCents
      status
    }
  }
}
```

### Update item quantity
```graphql
mutation {
  updateCartItemQuantity(userId: "user-1", cartItemId: "<id from cart>", quantity: 3) {
    id
    items {
      id
      name
      quantity
      lineCents
    }
    totalCents
  }
}
```

### Remove an item
```graphql
mutation {
  removeFromCart(userId: "user-1", cartItemId: "<id from cart>") {
    id
    items {
      id
      name
      quantity
    }
    totalCents
  }
}
```

### Apply a loyalty reward
```graphql
mutation {
  applyReward(userId: "user-1", code: "SAVE500") {
    id
    subtotalCents
    discountCents
    totalCents
    reward {
      code
      discountCents
      status
    }
  }
}
```

### Remove a reward
```graphql
mutation {
  removeReward(userId: "user-1") {
    id
    subtotalCents
    discountCents
    totalCents
  }
}
```

### Checkout
```graphql
mutation {
  checkout(userId: "user-1") {
    id
    subtotalCents
    discountCents
    totalCents
    loyaltyStatus
    redemptionId
    items {
      name
      priceCents
      quantity
      lineCents
    }
    createdAt
  }
}
```

### View an order
```graphql
query {
  order(orderId: "<id from checkout>") {
    id
    subtotalCents
    discountCents
    totalCents
    loyaltyStatus
    redemptionId
    items {
      name
      priceCents
      quantity
      lineCents
    }
    createdAt
  }
}
```

---

## Alternative: Local Dev Mode

See [mock-checkout-service/README.md](./mock-checkout-service/README.md) for local setup without Docker.

---

## Running Tests

```bash
cd mock-checkout-service
npm test
```
