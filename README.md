<div align="center">
  <h1>🛡️ API Gateway & Rate-Limiting SaaS</h1>
  <p>A production-grade, horizontally scalable Node.js API Gateway with a real-time React dashboard.</p>
</div>

---

## 📖 Overview
This project is a high-performance API Gateway designed to act as a protective proxy in front of upstream services. It features **atomic rate limiting**, **JWT authentication**, and a **real-time dynamic dashboard** for developers to monitor their API usage.

The architecture is built for production, using **Docker** and **Nginx** to dynamically load balance traffic across multiple Node.js instances, while keeping rate-limit state perfectly synchronized via **Redis**.

---

## 🏗️ Architecture & Tech Stack

### Backend (`gatewayservice`)
- **Node.js & Express.js**: High-throughput asynchronous routing.
- **Redis (Lua Scripts)**: Implements an atomic Token Bucket algorithm. Lua scripts guarantee race-condition-free rate limiting even when processing thousands of concurrent requests across multiple Node.js instances.
- **MySQL**: Persistent storage for users, masked API keys, and asynchronous request logging.
- **Nginx**: Operates as a Reverse Proxy & Load Balancer. It receives all external traffic on port `80` and distributes it (round-robin) to internal Node.js instances.
- **Docker Compose**: Orchestrates the entire stack, enabling zero-downtime horizontal scaling.

### Frontend (`gateway-dashboard`)
- **React 18 & Vite**: Fast, modern frontend tooling.
- **TailwindCSS**: Beautiful, dark-mode first UI styling.
- **Recharts**: Renders real-time, animated charts showing successful vs. blocked requests.
- **Lucide React**: Premium iconography.

---

## ⚡ Features

1. **Distributed Rate Limiting (Token Bucket)**
   - Protects upstream servers from DDoS or abusive traffic.
   - Tiered plans: `FREE` (100 req/min), `PRO` (10,000 req/min), `ENTERPRISE` (100,000 req/min).

2. **Real-Time Analytics Dashboard**
   - Auto-polls traffic data every 30 seconds.
   - Smooth count-up animations for KPI cards and live visual charts.
   - Shows "Live pulse" indicators and dynamic empty states.

3. **Asynchronous Fire-and-Forget Logging**
   - Gateway routes traffic to the upstream and responds to the client *before* logging the request to MySQL, ensuring database latency never affects the critical request path.

4. **Built-in Traffic Generator**
   - The dashboard includes a testing tool to blast your gateway with burst traffic (e.g., 200 requests in 5ms) to watch the rate-limiter actively block excess traffic in real-time.

---

## 📊 Performance Metrics & Benchmarks

The gateway has been rigorously stress-tested using **Artillery**.

| Metric | Result |
|---|---|
| Gateway Overhead (p95) | **2ms** |
| Max Throughput (PRO tier) | **10,000+ req/min** |
| Incorrect Rate-Limit Blocks | **0** (race-condition free) |
| Behavior at 500 req/sec spike | Graceful `429` / `502`, no crash |
| Redis Lua atomic checks | ~9,692 in one test run |

---

## 🚀 Getting Started

> **There are two ways to run this project.** Choose the one that fits your need.

---

### Mode 1 — Local Development (No Docker)

Use this mode when you want to quickly run and modify the code. You will need **MySQL** and **Redis** installed and running on your machine.

**Step 1 — Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

**Step 2 — Configure the backend environment**
```bash
cd gatewayservice
cp .env.example .env
```
Open `.env` and fill in your local MySQL credentials, a JWT secret, and Redis details. Then initialize the database schema:
```bash
# Run this SQL file against your MySQL instance to create all tables
mysql -u root -p < config/schema.sql
```

**Step 3 — Start the backend API Gateway**
```bash
npm install
npm run dev
```
Your API Gateway is now running at **`http://localhost:3000`**.

**Step 4 — Configure and start the frontend dashboard**

Open a **second terminal** in the repo root:
```bash
cd gateway-dashboard
cp .env.example .env    # VITE_API_URL is set to http://localhost:3000 by default
npm install
npm run dev
```
Your dashboard is now running at **`http://localhost:5173`**.

---

### Mode 2 — Docker (Production / Horizontal Scaling)

Use this mode to run the full production-grade stack with Nginx load balancing, Redis, MySQL, and multiple Node.js Gateway instances — all from a single command. **Docker & Docker Compose must be installed.**

**Step 1 — Clone and configure**
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME/gatewayservice
cp .env.example .env
```
Fill in `DB_PASS`, `JWT_SECRET`, and any other required values in `.env`.

**Step 2 — Boot the full stack with 3 Gateway instances**
```bash
docker compose up -d --scale gateway=3
```
This single command starts:
- ✅ **1× Nginx** — exposed on `http://localhost:80`, routes all traffic
- ✅ **3× Node.js Gateway** — internal only, load-balanced by Nginx
- ✅ **1× Redis** — shared rate-limit state across all 3 instances
- ✅ **1× MySQL** — persists users, API keys, and request logs

**Step 3 — Start the frontend dashboard**
```bash
cd ../gateway-dashboard
npm install
npm run dev
```
Open your browser at **`http://localhost:5173`**. The dashboard connects to the API at `http://localhost:3000` by default (which Nginx proxies on port `80` in Docker mode — update `VITE_API_URL` in `gateway-dashboard/.env` if needed).

**To scale up or down at any time (zero downtime):**
```bash
docker compose up -d --scale gateway=5   # scale up to 5 instances
docker compose up -d --scale gateway=2   # scale down to 2 instances
docker compose logs -f nginx             # see which instance handled each request
```

---

## 🧑‍💻 How to Use the Project

Once both the backend and dashboard are running, here is the complete user journey:

### 1. Register an Account
Go to **`http://localhost:5173`** and click **Register**. Create an account with your email and password. Your account starts on the **FREE** tier (100 requests/minute).

### 2. Generate an API Key
After logging in, navigate to the **API Keys** section in the dashboard and click **Generate New Key**. Copy the key immediately — it is only shown once.

### 3. Make Requests Through the Gateway
Use your API key in the `X-Api-Key` header to send requests through the gateway. The gateway proxies all `/v1/*` traffic to `https://jsonplaceholder.typicode.com`.

**On Linux/macOS/Git Bash:**
```bash
curl -H "X-Api-Key: gw_live_YOUR_KEY_HERE" http://localhost:3000/v1/posts
curl -H "X-Api-Key: gw_live_YOUR_KEY_HERE" http://localhost:3000/v1/posts/1
curl -H "X-Api-Key: gw_live_YOUR_KEY_HERE" http://localhost:3000/v1/users
```

**On Windows PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/v1/posts" -Headers @{ "X-Api-Key" = "gw_live_YOUR_KEY_HERE" }
```

### 4. Watch the Rate Limiter in Action
Once you exceed **100 requests in a 60-second window** (FREE tier), the gateway will return:
```json
{
  "error": "Rate limit exceeded.",
  "message": "Your FREE plan allows 100 requests per 60 seconds.",
  "retry_after": "45 seconds"
}
```

### 5. Use the Built-in Traffic Generator
Don't want to run `curl` manually? Use the **Traffic Generator** panel directly on the dashboard:
- Select your API key from the dropdown.
- Choose a preset (10, 50, 100 requests) or select **Burst 200** to fire 200 requests at once.
- Hit **Send Requests** and watch the Blocked (429) counter rise in real-time on the analytics charts.

### 6. Upgrade to PRO (Optional)
To raise your limit to 10,000 requests/min, call the upgrade endpoint:
```bash
curl -X PATCH http://localhost:3000/api/user/tier \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "PRO"}'
```

---

## 🛡️ Security Notes
- **API Keys**: The full raw key is shown only once on generation. What is stored in the database is only the first 20 characters plus a masked suffix — the key cannot be recovered from the database.
- **Internal Ports**: In the Docker stack, Node.js (port 3000), Redis (6379), and MySQL (3306) are all internal-only. Only Nginx on port `80` is accessible from outside the Docker network.

---

## 📄 License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
