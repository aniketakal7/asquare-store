FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 native compilation
RUN apk add --no-python3 make g++ python3

COPY package*.json ./
RUN npm ci

COPY . .

# Final runtime image
FROM node:20-alpine

WORKDIR /app

# Copy built app and node_modules
COPY --from=builder /app /app

RUN mkdir -p public/apps public/uploads/icons db

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
