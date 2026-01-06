
---

# 📦 Zap Shift — Server Side (README.md)

```md
# ⚡ Zap Shift — Server Side

This repository contains the **backend REST API** for **Zap Shift**, a parcel management platform.  
The server handles authentication, role-based authorization, parcel workflows, rider assignment, and Stripe payment verification.

---

## 🚀 Live API
🔗 **Server URL:** https://zap-shift-by-ashiqur.vercel.app/

---

## ✨ Core Responsibilities

- 📦 Parcel lifecycle management
- 👥 Role-based authorization (User, Moderator, Rider)
- 🚴 Rider assignment and delivery workflow
- 💳 Stripe payment intent creation & verification
- 🔐 Firebase token verification
- 📊 Secure CRUD operations
- 🌐 RESTful API architecture

---

## 🛠️ Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB (NoSQL)
- Mongoose

### Security & Auth
- Firebase Admin SDK
- JWT via Firebase token verification
- Role-based middleware

### Deployment
- Vercel (Server Hosting)

---

## 🔐 Authentication & Authorization

- Firebase token validation middleware
- Role verification middleware
- Protected API routes
- Secure user access control

---

## 📁 Project Structure
src/
├── routes/
├── controllers/
├── middlewares/
├── models/
├── utils/
└── index.js

## 🔗 API Endpoints (Sample)

```http
POST   /parcels
GET    /parcels
PATCH  /parcels/:id
POST   /payments/create-intent
PATCH  /riders/assign

## ⚙️ Installation & Setup
git clone https://github.com/your-username/zap-shift-server.git
cd zap-shift-server
npm install
npm run dev

## 🔑 Environment Variables
Create a .env file and add:
PORT=5000
MONGO_URI=your_mongodb_uri
STRIPE_SECRET_KEY=your_key
FIREBASE_SERVICE_ACCOUNT=your_credentials

## 🔄 Deployment
Deployed using Vercel
Environment variables securely managed
Production-ready configuration

## 📌 Related Repository
Client Side: https://github.com/ashiqur0/zap-shift-client

## 👨‍💻 Author
Md Ashiqur Rahman
Full-Stack MERN Developer
GitHub: https://github.com/ashiqur0
Portfolio: https://ashiqur0.vercel.app/
