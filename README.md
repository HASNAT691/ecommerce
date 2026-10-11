# 👗 Al-Rehan Garments — E-Commerce Platform

A full-featured e-commerce platform for women's garments, built with Node.js, Express.js, MongoDB (Mongoose), and EJS templating.

---

## 🚀 Features

- **Storefront & Catalog**: Featured collections, category & subcategory filtering, and product detail views.
- **Cart & Checkout**: Session-based cart with size selection, live quantity adjustments, and standard/express delivery options.
- **Payment Methods**: Cash on Delivery (COD) and EasyPaisa/JazzCash with payment screenshot verification.
- **Transactional Stock Management**: Multi-item stock deduction executed inside MongoDB atomic transactions to prevent overselling.
- **Order Tracking**: Public order lookup by readable order ID with sensitive customer data masking.
- **Customer Portal**: Account registration, authentication, shipping address management, and order history.
- **Admin Dashboard**: Full CRUD management for products & categories, order fulfillment workflows, customer directory, and sales analytics.
- **Security Hardened**: Double-Submit Cookie CSRF protection (`csrf-csrf`), Content Security Policy (Helmet), rate limiting, NoSQL injection defenses, and safe RegExp sanitization.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Mongoose ODM) with MongoStore session storage
- **Views**: EJS, Bootstrap 5, FontAwesome
- **File Uploads**: Multer with Cloudinary CDN integration and local fallback
- **Testing**: Node.js native test runner (`node --test`)
- **Containerization**: Docker, Docker Compose

---

## ⚙️ Quick Start

### 1. Prerequisites
- Node.js 18+
- MongoDB 6+ running locally or a MongoDB Atlas URI

### 2. Installation
```bash
git clone <repository-url>
cd ecommerce-main
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env` and configure your settings:
```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` or `production` |
| `PORT` | Application port (default: `5000`) |
| `MONGODB_CONNECTION_STRING` | MongoDB connection URI |
| `SESSION_SECRET` | Strong secret for express-session (required in production) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account name (optional) |
| `CLOUDINARY_API_KEY` | Cloudinary API key (optional) |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret (optional) |
| `ADMIN_REGISTRATION_SECRET` | Secret key required to register admin accounts |

### 4. Run the Application
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Visit `http://localhost:5000` in your browser.

---

## 🧪 Testing

Run the automated test suite:
```bash
npm test
```

---

## 🐳 Running with Docker Compose

```bash
docker-compose up --build
```
This launches both MongoDB and the application with built-in health checks.

---

## 📄 License
ISC License
