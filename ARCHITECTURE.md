# FlashSales Architecture

## Overview

FlashSales (FlashCommerce) is a high-traffic flash sale backend designed to handle concurrent inventory management during time-limited sales events.

---

## Tech Stack

| Layer        | Technology              |
|--------------|-------------------------|
| Runtime      | Node.js + TypeScript    |
| Framework    | Fastify                 |
| Database     | PostgreSQL              |
| Cache/Lock   | Redis                   |
| Auth         | JWT (@fastify/jwt)      |
| Docs         | Swagger UI              |

---

## Project Structure

```
Backed/
├── src/
│   ├── server.ts           # Entry point, plugin registration, routes
│   ├── db/
│   │   ├── connection.ts   # PostgreSQL pool
│   │   └── migrate.ts      # Database schema migrations
│   ├── modules/
│   │   ├── auth/           # Authentication (register, login, JWT)
│   │   ├── product/        # Product catalog CRUD
│   │   ├── inventory/      # Stock management + Redis locking
│   │   ├── checkout/       # Checkout flow (reserve → confirm/cancel)
│   │   └── order/          # Order creation & status tracking
│   └── types/
│       └── index.ts        # TypeScript interfaces & Redis key constants
```

---

## Architecture Pattern

**Modular Monolith** - Single Fastify server with feature-based modules.

Each module contains:
- `routes.ts` - HTTP handlers with schema validation
- `service.ts` - Business logic and database queries

---

## Module Responsibilities

| Module      | Purpose                                      |
|-------------|----------------------------------------------|
| **auth**    | User registration, login, JWT token handling |
| **product** | Product CRUD, flash sale listings            |
| **inventory** | Redis-based atomic inventory locking       |
| **checkout** | Reserve → Pay → Confirm/Cancel flow         |
| **order**   | Order creation, status updates, history      |

---

## Data Flow (Flash Sale Purchase)

```
┌─────────────────────────────────────────────────────────────────┐
│                     CHECKOUT FLOW                               │
└─────────────────────────────────────────────────────────────────┘

  User                  API                    Redis              PostgreSQL
   │                     │                       │                     │
   │  POST /checkout     │                       │                     │
   │  ─────────────────► │                       │                     │
   │                     │  Atomic Decrement     │                     │
   │                     │  (Lua Script)         │                     │
   │                     │  ────────────────────►│                     │
   │                     │                       │                     │
   │                     │  ◄────────────────────│                     │
   │                     │  Success/Fail         │                     │
   │                     │                       │                     │
   │                     │  Set Reservation      │                     │
   │                     │  (15 min TTL)         │                     │
   │                     │  ────────────────────►│                     │
   │                     │                       │                     │
   │                     │                       │  Create Order       │
   │                     │                       │  ──────────────────►│
   │  ◄───────────────── │                       │                     │
   │  Order Created      │                       │                     │
   │                     │                       │                     │
   │  POST /confirm      │                       │                     │
   │  ─────────────────► │                       │                     │
   │                     │  Delete Reservation   │                     │
   │                     │  ────────────────────►│                     │
   │                     │                       │  Update Order       │
   │                     │                       │  ──────────────────►│
   │  ◄───────────────── │                       │                     │
   │  Confirmed          │                       │                     │
```

---

## Database Schema

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    users     │       │   products   │       │  inventory   │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │◄──────│ product_id   │
│ email        │       │ name         │       │ variant_id   │
│ password_hash│       │ sku          │       │ quantity     │
│ role         │       │ base_price   │       │ reserved     │
│ status       │       │ sale_price   │       └──────────────┘
└──────┬───────┘       │ status       │
       │               └──────────────┘
       │
       │               ┌──────────────┐       ┌──────────────┐
       │               │    orders    │       │ order_items  │
       │               ├──────────────┤       ├──────────────┤
       └──────────────►│ user_id      │◄──────│ order_id     │
                       │ order_number │       │ product_id   │
                       │ status       │       │ quantity     │
                       │ total_amount │       │ unit_price   │
                       └──────┬───────┘       └──────────────┘
                              │
                              │               ┌──────────────┐
                              │               │   payments   │
                              │               ├──────────────┤
                              └──────────────►│ order_id     │
                                              │ stripe_id    │
                                              │ amount       │
                                              │ status       │
                                              └──────────────┘
```

---

## Key Design Decisions

### 1. Redis for Inventory Locking
- Atomic operations via Lua scripts prevent overselling
- Reservations have 15-minute TTL (auto-release on timeout)

### 2. Two-Phase Checkout
- **Phase 1**: Reserve inventory in Redis, create pending order
- **Phase 2**: Confirm payment, finalize order in PostgreSQL

### 3. Role-Based Access
- `customer` - Standard user
- `admin` - Full system access
- `support` - Limited management access

### 4. Rate Limiting
- Global: 100 requests/minute per client
- Prevents abuse during high-traffic sales

---

## API Endpoints

| Prefix           | Description              |
|------------------|--------------------------|
| `/health`        | Health check             |
| `/docs`          | Swagger documentation    |
| `/api/auth`      | Authentication           |
| `/api/products`  | Product catalog          |
| `/api/inventory` | Stock management         |
| `/api/checkout`  | Checkout flow            |
| `/api/orders`    | Order management         |

---

## Environment Dependencies

- **PostgreSQL** - Primary data store
- **Redis** - Inventory locking, reservations, rate limiting
- **Stripe** (planned) - Payment processing
