# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies (optional, reduces image size)
RUN npm prune --production

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/src/main.js"]