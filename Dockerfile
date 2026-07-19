# ---- Base Stage ----
FROM node:18-alpine AS base
WORKDIR /app

# ---- Dependencies Stage ----
FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# ---- Release Stage ----
FROM base AS release

# Copy production node_modules from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy application source code
COPY . .

# Create uploads directory if it doesn't exist (for multer)
RUN mkdir -p /app/uploads

# Expose the application port
EXPOSE 5000

# Start the application
CMD ["node", "server.js"]
