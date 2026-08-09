# Multi-stage build for Railway
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all dependencies
RUN npm install
RUN cd backend && npm install
RUN cd frontend && npm install

# Copy source
COPY backend ./backend
COPY frontend ./frontend

# Generate Prisma client
RUN cd backend && npx prisma generate

# Build frontend
RUN cd frontend && npm run build

# Build backend
RUN cd backend && npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install production deps only
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy built assets
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/frontend/dist ./public
COPY --from=builder /app/backend/node_modules/.prisma ./node_modules/.prisma

# Run migrations and start
ENV NODE_ENV=production
EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
