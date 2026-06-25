# API Gateway SaaS Dashboard

A modern, responsive, and dynamic dashboard built with React (Vite) and TailwindCSS for developers to manage their API Gateway usage.

## Features
- **Real-Time Analytics:** Visualizes successful vs. rate-limited requests over the last 7 days using Recharts.
- **Dynamic Feedback:** Auto-polling every 30s with countdown rings, pulse indicators, and animated counter states for a "live" feel.
- **API Key Management:** Generate and revoke secure API keys.
- **Built-in Traffic Generator:** Includes a tool to blast your gateway with varying speeds of requests (from 10 to a 200 "burst") to watch the Token Bucket rate limiter block excess requests in real-time.

## Tech Stack
- **Framework:** React + Vite
- **Styling:** TailwindCSS
- **Icons:** Lucide React
- **Charting:** Recharts
- **Routing:** React Router DOM

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   Set `VITE_API_URL` to point to the backend gateway service. If running locally with Node, this is typically `http://localhost:3000`. If running via the production Docker stack, point it to the Nginx load balancer.

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Build for Production**
   ```bash
   npm run build
   ```

## Design Language
This dashboard focuses on a premium developer experience with a dark-mode-first aesthetic inspired by tools like Vercel and Supabase.

## License
MIT License.
