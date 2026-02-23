# AGENTS.md - Debug Mode

This file provides debugging-specific guidance for agents working in this repository.

## Debugging Rules (Non-Obvious)

### Inventory Decrement Failures
- Lua script returns `-1` when insufficient inventory, `-2` when key not found
- Check Redis keys exist with `inventory:{productId}:{variantId}` before decrementing
- Run `initializeRedisInventory()` first to seed Redis from PostgreSQL

### Checkout Rollback Issues
- On `initiateCheckout` failure, inventory is automatically rolled back via `incrementInventory()`
- Check if reservations exist with `reservation:{orderId}` before confirming/cancelling

### Database Connection Errors
- Pool max 20 connections, 2s timeout - queries may fail under high load
- Check `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` in .env
- All queries logged with duration to console

### Redis Connection Issues
- Check `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` in .env
- Redis is required for inventory operations - app will fail without it

### Auth Failures
- JWT payload accessed via `request.user` has shape `{ userId, email, role }`
- Check `JWT_SECRET` in .env matches token issuer
- Unauthenticated requests return 401 "Unauthorized"

### Swagger Debugging
- Swagger UI at `/docs` (not `/api/docs`)
- All routes prefixed with `/api/` - health check at `/health` (no prefix)
