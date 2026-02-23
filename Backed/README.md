# FlashCommerce - High-Traffic Flash Sale System

## What is FlashCommerce?

FlashCommerce is a **backend system for flash sales** - think of limited-time product drops where thousands of people try to buy at once. It's designed to handle the chaos that happens when a popular item goes on sale.

### The Problem It Solves

When a hot product drops (like limited-edition sneakers or concert tickets), thousands of users hit the website simultaneously. This causes three main issues:

1. **Server Crashes** - Too much traffic overwhelms the system
2. **Overselling** - Multiple people buy the same item at the exact same time, leading to overselling
3. **Bots/Fraud** - Automated bots grab inventory faster than real humans

FlashCommerce solves these problems using Redis (for fast operations) and PostgreSQL (for data storage).

---

## How It Works (Simple Explanation)

### The Flash Sale Flow

```
User clicks "Buy" → Inventory Reserved in Redis (15 min timer) → Payment → Order Confirmed
```

1. **User initiates checkout** → System instantly reserves the item in Redis (not database)
2. **15-minute timer starts** → User has 15 minutes to complete payment
3. **Payment confirmed** → Reservation deleted, order saved to PostgreSQL
4. **Payment fails/timeout** → Inventory released back to Redis for others to buy

---

## Project Structure

```
src/
├── server.ts              # Main entry point - starts the API server
├── db/
│   ├── connection.ts     # Database connection setup
│   └── migrate.ts         # Database setup (creates tables)
├── modules/               # Feature modules (each has routes + service)
│   ├── auth/             # Login, registration, JWT tokens
│   ├── product/         # Product catalog
│   ├── inventory/       # Redis inventory management
│   ├── checkout/        # Checkout flow
│   └── order/           # Order management
└── types/
    └── index.ts          # TypeScript type definitions
```

### Each Module Has:
- **`routes.ts`** - Defines API endpoints (like `/api/products`)
- **`service.ts`** - Contains the actual business logic

---

## Key Technologies

| Technology | Purpose |
|------------|---------|
| **Node.js** | JavaScript runtime |
| **Fastify** | Web framework (handles HTTP requests) |
| **TypeScript** | Type safety |
| **PostgreSQL** | Main database (stores users, orders, products) |
| **Redis** | Fast in-memory storage (inventory locks, sessions) |
| **JWT** | Authentication (keeps users logged in) |

---

## API Endpoints

All endpoints start with `/api/`:

| Endpoint | Description |
|----------|-------------|
| `/api/auth/*` | Register, login, token refresh |
| `/api/products/*` | View product catalog |
| `/api/inventory/*` | Check stock levels |
| `/api/checkout/*` | Initiate, confirm, or cancel checkout |
| `/api/orders/*` | View order history |

**Bonus:**
- `/health` - Health check (is server running?)
- `/docs` - Interactive API documentation (Swagger UI)

---

## Running the Project

### Prerequisites
- Node.js installed
- PostgreSQL running
- Redis running

### Setup
```bash
# Install dependencies
npm install

# Copy environment variables
copy .env.example .env
# Edit .env with your database/Redis credentials

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Commands
```bash
npm run dev          # Start dev server (auto-reload)
npm run build        # Compile TypeScript
npm test            # Run tests
npm run type-check  # Check for TypeScript errors
```

---

## Understanding the Critical Parts

### 1. Inventory Management (The Most Important)

When someone buys an item, the system doesn't just "subtract 1" from a database. It uses a **Lua script** in Redis that ensures atomic operations:

```lua
-- This runs inside Redis (very fast, prevents race conditions)
if current_count < requested_quantity:
    return -1  -- Not enough inventory
else:
    decrement and return new count
```

This prevents two users from buying the last item at the exact same time.

### 2. Reservations with TTL

When checkout starts, inventory is "locked" for 15 minutes. This is called **TTL (Time To Live)** in Redis. If the user doesn't pay in 15 minutes, the reservation expires and inventory is released automatically.

### 3. Two-Layer Storage

| Layer | Technology | What it stores |
|-------|------------|----------------|
| **Fast** | Redis | Real-time inventory, sessions, rate limits |
| **Persistent** | PostgreSQL | Users, orders, product catalog |

Redis is extremely fast but temporary. PostgreSQL is slower but stores data permanently.

---

## Data Flow Example

Let's say Alice wants to buy 1 "Limited Edition Sneaker":

```
1. Alice clicks "Buy Now"
2. Backend checks Redis: is there inventory?
   - Redis: "Yes, 5 available"
3. Backend atomically decrements Redis: "Now 4 available"
4. Backend creates "reservation" in Redis with 15-min timer
5. Frontend shows: "Complete payment in 15:00"
6. Alice pays via Stripe (or test mode)
7. Backend receives payment confirmation
8. Backend:
   - Deletes the 15-min reservation
   - Creates order in PostgreSQL
   - Marks inventory as "reserved" in PostgreSQL
9. Alice sees: "Order confirmed! 🎉"
```

If Alice doesn't pay within 15 minutes:
```
1. Redis reservation expires automatically
2. Redis inventory increments back to 5
3. If Alice tries to pay later, system says "No inventory"
```

---

## Environment Variables

Create a `.env` file with:

```env
# Server
PORT=3000
FRONTEND_URL=http://localhost:3001

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flashcommerce
DB_USER=postgres
DB_PASSWORD=yourpassword

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Authentication
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=24h
```

---

## Summary

FlashCommerce is a **flash sale backend** that:
- Handles high traffic using Redis
- Prevents overselling with atomic operations
- Uses 15-minute reservation timers
- Stores persistent data in PostgreSQL
- Provides RESTful API with Swagger documentation

The key insight: **Redis handles the chaos of flash sales, PostgreSQL stores the truth.**
