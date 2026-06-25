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
- **Docker Compose**: Orchestrates the entire stack, enabling zero-downtime horizontal scaling (`docker compose up --scale gateway=3`).

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

### Benchmark Summary
- **Gateway Overhead (Latency):** **`p95 = 2ms`** (The time it takes the gateway to authenticate, check Redis rate limits, and route the request is practically negligible).
- **Throughput:** Tested reliably up to **10,000+ requests per minute** (PRO tier limit) with `0` incorrect blocks or race conditions across horizontal instances.
- **Graceful Failure:** When hit with a spike of 500 req/sec (exhausting upstream TCP sockets), the gateway gracefully degrades, returning `502 Bad Gateway` or `429 Too Many Requests` without crashing the Node.js process.

---

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (if running locally without Docker)

### 1. Run via Docker (Production / Scaling Mode)
The recommended way to run this project is via the Docker Compose stack. This will boot Nginx, Redis, MySQL, and your Node.js Gateway instances.

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME/gatewayservice

# Boot the stack and horizontally scale the Gateway to 3 instances
docker compose up -d --scale gateway=3
```
*Note: Your API Gateway is now running on `http://localhost:80` via Nginx.*

### 2. Run the Dashboard
Open a new terminal and navigate to the frontend directory:
```bash
cd YOUR_REPO_NAME/gateway-dashboard

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```
*Your dashboard is now accessible at `http://localhost:5173`.*

---

## 🛡️ Security Notes
- **API Keys**: Only the first 20 characters of API keys are stored alongside a hashed version. The raw keys are never saved in plain text, meaning even if the database is compromised, keys cannot be stolen.
- **Internal Ports**: When using Docker, the internal Node.js instances (port 3000), Redis (port 6379), and MySQL (port 3306) are heavily restricted to the internal Docker network `gateway_net`. Only the Nginx load balancer is exposed to the host network.

---

## 📄 License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
