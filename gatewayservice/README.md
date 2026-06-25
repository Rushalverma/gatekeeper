# API Gateway & Rate-Limiting SaaS

A production-grade Node.js / Express API Gateway with robust horizontal scalability, Redis-backed rate limiting, and MySQL analytics tracking.

## Architecture Highlights
- **Distributed Rate Limiting:** Uses a Redis Token Bucket Lua script to ensure atomic, highly accurate rate-limiting across horizontally scaled Node.js instances.
- **Dynamic Load Balancing:** Ready for Nginx to round-robin traffic to multiple Node.js gateway instances using Docker internal networking.
- **Security:** JWT authentication, bcrypt password hashing, and masked API key storage.
- **Analytics:** Asynchronous request logging for analytics metrics, separating critical path latency from database I/O latency.
- **Tiered Plans:** Support for FREE, PRO, and ENTERPRISE usage quotas (e.g., 100 req/min up to 100k req/min).

## Prerequisites
- Node.js 18+
- MySQL 8+
- Redis 7+
- Docker & Docker Compose (for production deployments)

## Getting Started (Development)

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   # Update DB_PASS, JWT_SECRET, etc.
   ```

3. **Initialize Database Schema**
   You can run the schema file located at `config/schema.sql` against your MySQL database.

4. **Start the Server**
   ```bash
   npm run dev
   ```

## Getting Started (Docker / Production)

To run the full stack (Nginx, Redis, MySQL, and Horizontally Scaled Node.js Gateways):

```bash
docker compose up -d --scale gateway=3
```
This automatically boots:
- 1x Redis instance (shared state)
- 1x MySQL instance
- 3x Gateway Node.js replicas
- 1x Nginx Reverse Proxy (Exposed on port 80)

## API Endpoints

- **`POST /auth/register`** - Register a developer account.
- **`POST /auth/login`** - Login and receive a JWT.
- **`POST /api/keys/generate`** - Generate a new API key.
- **`GET /api/keys`** - List active API keys.
- **`GET /api/analytics/usage`** - 7-day usage analytics.
- **`ANY /v1/*`** - The Proxy Gateway endpoint. Authenticates the `X-Api-Key` header, rate limits via Redis, and forwards to your `PROXY_TARGET`.

## License
MIT License.
