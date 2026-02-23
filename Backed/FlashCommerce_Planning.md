# FlashCommerce – High-Traffic Flash Sale System
## Architectural Planning Document

**Scope**: This document describes what we'll build in Phase 1 and what we defer to Phase 2. The goal is a working, production-ready flash sale system that a single developer or small team can actually ship.

---

## 1. Project Overview

### What is FlashCommerce?

FlashCommerce is a flash sale platform that handles high-concurrency events where limited products sell at discounts for short windows. The challenge: thousands of users hitting the system within seconds of a sale going live.

The platform solves three problems:

**Traffic Surges**: When a product drops, users flood in. Without protection, servers crash. FlashCommerce uses a waiting room and rate limiting to control the flow.

**Inventory Race Conditions**: Multiple users buy the same item at the same time. Without proper locking, we oversell. FlashCommerce uses Redis atomic operations to reserve inventory before checkout completes.

**Fraud and Bots**: Scalpers use bots to grab inventory. FlashCommerce uses rate limiting, CAPTCHA, and basic device checks to filter abuse.

---

## 2. High-Level Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FlashCommerce System (Phase 1)                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                           Frontend Layer (React.js)                     │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │    │
│  │  │   Web App    │  │   Waiting    │  │  Checkout    │  │  Inventory │  │    │
│  │  │   (SPA)      │  │   Room UI    │  │   Flow       │  │   Display  │  │    │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │    │
│  └─────────┼─────────────────┼─────────────────┼─────────────────┼─────────┘    │
│            │                 │                 │                 │              │
│            └─────────────────┴─────────────────┴─────────────────┘              │
│                                        │                                        │
│                                        ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    CDN + Load Balancer (Cloudflare/AWS)                │    │
│  │         (Static assets, DDoS protection, SSL termination)              │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                        │                                        │
│                                        ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                     Single Node.js Backend (Fastify)                   │    │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐              │    │
│  │  │  Auth Module   │ │  Product/Inv   │ │  Order/Checkout │              │    │
│  │  │  (JWT, Login)  │ │  (Redis, DB)   │ │  (Stripe)       │              │    │
│  │  └────────────────┘ └────────────────┘ └────────────────┘              │    │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐              │    │
│  │  │  Queue/Waiting │ │  WebSocket     │ │  Rate Limiting │              │    │
│  │  │  Room Module   │ │  (Socket.io)   │ │  (express-rate) │              │    │
│  │  └────────────────┘ └────────────────┘ └────────────────┘              │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                        │                                        │
│                                        ▼                                        │
│  ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐        │
│  │  Redis             │   │  PostgreSQL        │   │  Stripe API       │        │
│  │  (Inventory Lock   │   │  (Users, Products,│   │  (Payments)       │        │
│  │   + Sessions +     │   │   Orders)          │   │                   │        │
│  │   Rate Limits)     │   │                   │   │                   │        │
│  └───────────────────┘   └───────────────────┘   └───────────────────┘        │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    WebSocket Server (Socket.io)                          │    │
│  │          (Single instance for Phase 1, Redis adapter in Phase 2)        │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Architecture Decision**: Single modular monolith for Phase 1. Microservices are deferred to Phase 2 when traffic justifies the operational complexity.

### Frontend Responsibilities (React.js)

The React.js frontend is a SPA that minimizes page reloads and provides responsive UX.

**Static Assets**: Served via CDN (Cloudflare, Vercel, or Netlify). Static files don't hit our servers.

**Waiting Room UI**: Simple page with queue position, countdown timer, and progress indicator.

**Optimistic Updates**: Cart and checkout actions update UI immediately, then confirm with backend.

**Real-Time Display**: WebSocket connection shows live inventory counts.

**State Management**: React Context or Zustand (simpler than Redux).

### Backend Responsibilities (Node.js with Fastify)

**Modular Monolith**: One Node.js process with clearly separated modules. Each module is a directory with routes, controllers, and services.

- **Auth Module**: JWT tokens, login/register, session validation
- **Product Module**: Product catalog, inventory reads (cached in Redis)
- **Inventory Module**: Redis-based locking, reservations, TTL handling
- **Order Module**: Order creation, status tracking, history
- **Checkout Module**: Stripe integration, payment intents, webhook handling
- **Queue Module**: Waiting room logic, queue position, admission control

**Phase 2 Evolution**: When traffic demands it, these modules can be extracted into separate services with minimal code changes.

### Database Layer (PostgreSQL)

PostgreSQL is the source of truth for all data. Redis handles high-frequency operations.

**Tables**: Users, Products, Inventory, Orders, Payments (see Data Models section).

**Connection Pooling**: Built-in pg library pooling. For higher scale, add PgBouncer later.

**No Read Replicas in Phase 1**: Single PostgreSQL instance handles read/write. Add replicas if database becomes the bottleneck.

### Cache and Locking Layer (Redis)

Redis is critical for flash sale performance. It handles:

**Inventory Locking**: Atomic DECR/Lua scripts prevent overselling
**Rate Limiting**: Token bucket or sliding window counters
**Session Storage**: Fast JWT validation
**Caching**: Product data cached with 5-60 second TTLs
**Queue State**: Waiting room positions and admission tokens

**Phase 2**: Add Redis Cluster for horizontal scaling if a single Redis instance becomes a bottleneck.

### Payment Processing (Stripe)

Stripe handles all payment operations.

**Payment Intents**: Create, confirm, and retrieve payment status
**Webhooks**: Handle async payment events (succeeded, failed)
**Idempotency Keys**: Essential for preventing duplicate charges

### Real-Time Communication (WebSockets)

Socket.io handles real-time updates.

**Events**: Inventory changes, queue position updates, order confirmations

**Phase 2**: Add Redis adapter for multi-instance WebSocket scaling.

---

---

## 3. Core Functional Requirements

### Flash Sale Product Listing

**Pre-Sale Prep**: Admin configures sale (products, prices, quantities, start time). Data loads into Redis before sale starts.

**Cached Reads**: Product listings come from Redis (5-second TTL), not PostgreSQL. Sub-100ms response times.

**Frontend**: Simple grid of flash sale products with countdown timer and live inventory count.

### Inventory Management

**Real-Time Tracking**: Redis holds live inventory count. PostgreSQL is updated asynchronously after orders confirm.

**Reservation System**: When user enters checkout, inventory is reserved for 15 minutes (Redis TTL key). If payment fails or TTL expires, inventory returns to pool.

**Inventory Allocation**: After successful payment, PostgreSQL inventory is decremented permanently.

**Phase 2**: Automated reconciliation via cron job (runs every 5 minutes) to fix Redis/PostgreSQL drift.

### Waiting Room / Traffic Throttling

**Why**: Without a waiting room, traffic spikes crash servers. The queue controls admission rate.

**Queue Mechanics**:
- Redis sorted set tracks users by entry timestamp
- User queries position via ZRANK
- Admission token issued when it's their turn

**Simple Admission**: 100 users admitted every 10 seconds (adjust based on server capacity).

**Reconnection**: Session token preserved. User reconnects, checks queue position, continues waiting.

### Order Creation Flow

**Order Initiation**: User proceeds to checkout → reserve inventory in Redis → create pending order in PostgreSQL.

**Validation**: Check product availability, pricing, user eligibility. Fail fast if issues.

**Confirmation**: After Stripe payment succeeds → update order to "confirmed" → permanent inventory deduction → send confirmation.

### Payment Processing

**Payment Intent**: Create with idempotency key when checkout starts. Same key = same Payment Intent even on retry.

**Confirmation**: User completes payment on Stripe's hosted page. Stripe redirects back with result.

**Webhook**: Listen for `payment_intent.succeeded` to confirm orders (handles cases where user doesn't return).

**Failure**: Clear error message. User can retry from checkout page with new payment attempt.

### Real-Time Inventory Updates

**WebSocket**: Socket.io pushes inventory updates to connected clients.

**What Gets Pushed**: Inventory count changes, sale status changes, queue updates.

**No Complex Batching in Phase 1**: Every purchase triggers an immediate update. If this overwhelms clients, add throttling in Phase 2.

---

---

## 4. Non-Functional Requirements

### What Breaks First (and How We Protect It)

**Redis is the bottleneck**: At 10,000+ concurrent users, Redis handles thousands of ops/sec easily. If it slows down, inventory locks time out and users see errors. Solution: Keep operations atomic and fast.

**PostgreSQL connections**: Each request holds a connection briefly. At 500+ concurrent requests, we hit connection limits. Solution: Connection pooling, short request times.

**Node.js event loop**: Long-running requests block other users. Solution: Fastify + async operations + request timeouts.

**Stripe rate limits**: Too many payment intents in short window. Solution: Queue payment creation, retry with backoff.

### Performance Targets

- **API responses**: < 200ms for 95% of requests
- **Inventory operations**: < 50ms (Redis is fast)
- **Page loads**: < 2 seconds first contentful paint
- **WebSocket latency**: < 200ms for updates

### Scaling Strategy (Phase 1 → Phase 2)

**Phase 1**: Single backend instance, single Redis, single PostgreSQL. Handles 5,000-10,000 concurrent users.

**Phase 2**: Multiple backend instances behind load balancer. Redis Cluster. PostgreSQL read replicas.

### Fault Tolerance

**Redis down**: Cannot process new orders. Show "high traffic" message, queue orders in memory, process when Redis returns.

**PostgreSQL down**: Can't save orders. Temporary failures retry. Extended outages require manual recovery.

**Stripe down**: Can reserve inventory but cannot process payment. User sees "try again later" message.

**No complex circuit breakers in Phase 1**: Simple try/catch with retry is sufficient.

---

---

## 5. Inventory Locking Strategy (Redis)

### Why Redis (Not PostgreSQL)

PostgreSQL locks block other requests. At 500 concurrent purchases/second, the database becomes the bottleneck.

Redis:
- **Sub-millisecond ops**: 50,000+ inventory operations/second on cheap hardware
- **Atomic commands**: DECR is atomic—two requests never read the same count
- **TTL built-in**: Reservations auto-expire without cleanup jobs

### How Locking Works

**Redis Key per Variant**:
```
inventory:{productId}:{variantId} = available count
```

**Lock Acquisition**:
```
1. Lua script: check count >= requested
2. Lua script: atomically decrement
3. If result < 0: rollback (increment back)
4. Create reservation key with 15-minute TTL
5. Async: save order to PostgreSQL
```

**Lua Script (Atomic)**:
```lua
local current = redis.call('GET', KEYS[1])
if tonumber(current) < tonumber(ARGV[1]) then
    return -1  -- insufficient inventory
end
return redis.call('DECRBY', KEYS[1], ARGV[1])  -- returns new count
```

### Preventing Overselling

**Lua script guarantees**: Inventory never goes below zero. Each request sees the updated count.

**Reservation TTL**: 15-minute key `reservation:{orderId}` with TTL. Auto-releases on expiration.

**Phase 2**: Simple cron job every 5 minutes compares Redis vs PostgreSQL counts and alerts on drift.

### Failure Handling

**Server crashes during checkout**: Reservation TTL releases inventory automatically.

**Payment succeeds but order fails to save**: Stripe webhook confirms payment, retry order save.

**Redis restarts**: Data is gone. Reload inventory from PostgreSQL before next sale.

---

---

## 6. Waiting Room & Throttling Strategy

### Why a Waiting Room

Without it, traffic spikes crash servers. Users see timeouts, retry, making it worse.

Waiting room:
- Controls how many users hit our servers
- Gives users a clear status (position in queue)
- Creates urgency without frustration

### Queue Mechanism (Simple)

**Redis Sorted Set**:
```
ZADD queue:{saleId} {timestamp} {sessionId}
ZRANK queue:{saleId} {sessionId}  -- get position
ZREM queue:{saleId} {sessionId}     -- leave queue
```

**Admission**: Every 10 seconds, admit next N users (tune N based on server capacity).

**Token**: User receives admission token with 5-minute expiry. Token presented to access backend.

**Phase 2**: More sophisticated admission based on actual server load metrics.

### Rate Limiting

**Per-user limits** (express-rate-limit middleware):
- 60 requests/minute for product pages
- 10 requests/minute for checkout operations
- 5 failed checkout attempts -> 15-minute block

**What breaks without it**: Bots or abusive users overwhelm specific endpoints.

### Simple Backend Protection

**Request timeout**: 5 seconds max per request
**Connection pool**: 20 connections to PostgreSQL
**Input validation**: Fastify schema validation on all inputs

---

---

## 7. Payment Flow with Stripe

### Order → Payment Lifecycle

1. **Checkout Start**: Reserve inventory, create pending order, create Stripe Payment Intent with idempotency key
2. **User Pays**: User enters card details on Stripe's hosted checkout page
3. **Payment Result**: Stripe redirects back with success/failure
4. **Order Confirm**: Webhook or redirect confirms order, finalizes inventory in PostgreSQL

### Idempotency Keys

**Why**: Network timeout → user retries → duplicate charge without idempotency.

**How**: Each checkout gets unique key `checkout:{orderId}:{timestamp}`. Same key = same Payment Intent.

### Handling Failures

**Timeout on payment create**: Retry with same idempotency key. Stripe returns cached result.

**Payment declined**: Show user error message. Inventory reservation held (15 min) for retry.

**User doesn't return**: Webhook `payment_intent.succeeded` confirms order regardless.

**Webhook idempotency**: Track processed event IDs in Redis to prevent double-processing.

### Preventing Double Charges

- Payment Intent can only be confirmed once
- Order status check before processing webhooks
- Database unique constraint on order numbers
- Stripe Radar handles fraud detection (we don't build this ourselves)

---

---

## 8. Real-Time Updates (WebSockets)

### Why WebSockets

HTTP polling can't deliver rapid inventory updates. Users need to see changes instantly.

WebSockets:
- Push inventory updates immediately
- Show queue position changes in real-time
- Create urgency (see others buying)

### Events Sent to Clients

**Inventory Update**:
```json
{"event": "inventory", "productId": "prod-123", "available": 42}
```

**Queue Position**:
```json
{"event": "queue", "position": 342, "estimatedWait": 180}
```

**Order Confirmed**:
```json
{"event": "order", "orderId": "ord-987", "status": "confirmed"}
```

### Phase 1 Implementation

- Single Socket.io server
- Direct emit on inventory changes
- Heartbeat every 30 seconds
- Auto-reconnect on disconnect

### Phase 2 Improvements

- Redis adapter for multi-instance WebSockets
- Update batching if clients overwhelm
- Connection limits per user

---

---

## 9. Data Models (Conceptual – Simplified)

### User

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| email | String | Unique, used for login |
| passwordHash | String | bcrypt hash |
| firstName | String | |
| lastName | String | |
| role | Enum | customer, admin |
| status | Enum | active, suspended |
| createdAt | Timestamp | |

### Product

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Display name |
| description | Text | |
| sku | String | Unique SKU |
| basePrice | Decimal | Regular price |
| salePrice | Decimal | Flash sale price |
| imageUrl | String | Primary image |
| status | Enum | draft, active, deleted |
| createdAt | Timestamp | |

### Inventory

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| productId | UUID | FK to Product |
| variantId | String | Size/color variant |
| quantity | Integer | Total units |
| reserved | Integer | Currently reserved |
| available | Integer | Computed: quantity - reserved |
| createdAt | Timestamp | |

### Order

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| orderNumber | String | Unique order # |
| userId | UUID | FK to User |
| status | Enum | pending, confirmed, cancelled, refunded |
| totalAmount | Decimal | Final charged amount |
| stripePaymentId | String | Stripe Payment Intent ID |
| createdAt | Timestamp | |
| confirmedAt | Timestamp | When payment succeeded |

### Payment

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| orderId | UUID | FK to Order |
| stripePaymentIntentId | String | Stripe ID |
| amount | Decimal | |
| status | Enum | pending, succeeded, failed |
| createdAt | Timestamp | |

---

---

## 10. API Design (High-Level)

### Authentication

**JWT tokens** for authenticated users. Public routes (product listing) don't require auth.

```
Authorization: Bearer {token}
```

Refresh tokens stored in HTTP-only cookies.

### Endpoints

**Auth**:
- `POST /auth/register` - Create account
- `POST /auth/login` - Get tokens
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Clear session

**Products**:
- `GET /products` - List products (cached, 5s TTL)
- `GET /products/:id` - Product details with inventory
- `GET /products/flash-sale` - Active flash sale items

**Inventory**:
- `POST /inventory/reserve` - Reserve inventory for checkout
- `DELETE /inventory/reserve/:id` - Release reservation

**Orders**:
- `GET /orders` - User's order history
- `GET /orders/:id` - Order details

**Checkout**:
- `POST /checkout/initiate` - Start checkout, reserve inventory
- `POST /checkout/confirm` - Confirm payment, complete order
- `POST /checkout/cancel` - Cancel, release inventory

**Queue**:
- `POST /queue/join` - Enter waiting room
- `GET /queue/position` - Get queue position

**Webhooks**:
- `POST /webhooks/stripe` - Stripe payment events

---

---

## 11. System Risks and Mitigations

### Overselling

**Risk**: Two users buy the last item simultaneously.

**Mitigation**: Redis Lua script atomically decrements. If result < 0, rollback.

### Payment Duplication

**Risk**: Network timeout → user retries → duplicate charge.

**Mitigation**: Stripe idempotency key. Same key = same Payment Intent.

### Redis Fails

**Risk**: Can't lock inventory, can't process orders.

**Mitigation**: Show "high traffic" message. Queue orders locally, process when Redis returns. Reload inventory from PostgreSQL on restart.

### PostgreSQL Fails

**Risk**: Can't save orders.

**Mitigation**: Retry transient failures. For extended outages, manual recovery.

### Traffic Spike

**Risk**: 10x normal traffic crashes servers.

**Mitigation**: Waiting room caps active users. Rate limiting blocks abuse. CDN serves static assets.

### Stripe Issues

**Risk**: Payment processing slowed or unavailable.

**Mitigation**: Queue payment creation. Show user-friendly error. Try again later.

---

---

## 12. Assumptions and Constraints

### Traffic Assumptions

- **10,000 concurrent users** during peak flash sales
- **80% arrive within 5 minutes** of sale start
- **Most traffic is reads** (product pages, inventory checks)

### What We're Building (Phase 1)

- Single Node.js/Fastify backend (modular monolith)
- Single Redis instance for inventory locks, sessions, rate limits
- Single PostgreSQL instance for durable data
- Stripe for payments
- Socket.io for real-time updates
- Simple waiting room (Redis sorted set)

### What We Defer (Phase 2)

- Redis Cluster or multi-instance setup
- PostgreSQL read replicas
- Multi-instance WebSocket servers (Redis adapter)
- Advanced fraud detection
- Complex reconciliation jobs
- Auto-scaling infrastructure

### Third-Party Limits

**Stripe**: Rate limits apply. High-volume sales may need pre-approval.

**Redis**: Single instance fits <1GB inventory data. Upgrade to cluster if needed.

**PostgreSQL**: Connection pooling required (pgBouncer) at scale.

**CDN**: Static assets cached. Dynamic content not cached long-term.

### Business Constraints

- Flash sales: 1-24 hours duration
- Payment methods: Credit cards + digital wallets (via Stripe)
- Currencies: USD, EUR (expand later)
- Refunds: Standard Stripe refund flow

---

## Implementation Phases

### Phase 1 (Core - Weeks 1-4)
1. Project setup: Node.js, Fastify, PostgreSQL, Redis
2. Database schemas (users, products, inventory, orders, payments)
3. Auth module (JWT, login/register)
4. Product catalog with Redis caching
5. Basic checkout flow without payment

### Phase 2 (Flash Sale Features - Weeks 5-8)
1. Redis inventory locking with Lua scripts
2. Reservation system with TTL
3. Waiting room with Redis sorted set
4. Rate limiting middleware
5. WebSocket real-time inventory updates

### Phase 3 (Payments - Weeks 9-10)
1. Stripe Payment Intents integration
2. Webhook handling for payment confirmation
3. Idempotency key implementation
4. Order confirmation flow

### Phase 4 (Frontend - Weeks 11-14)
1. React SPA setup
2. Product listing and detail pages
3. Waiting room UI
4. Checkout flow with Stripe Elements
5. Order history

### Phase 5 (Production - Weeks 15-16)
1. Load testing (10,000 concurrent users)
2. Performance tuning
3. Deployment configuration (Docker, CI/CD)
4. Monitoring setup

---
