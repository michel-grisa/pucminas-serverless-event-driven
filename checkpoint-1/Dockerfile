# Use lightweight Node.js active LTS alpine image
FROM node:22-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package.json ./

# Install dependencies (none currently, but ensures future-proofing)
RUN npm install --omit=dev

# Copy application source code
COPY index.js ./

# Expose port (note: GCP Cloud Run will inject its own PORT env var, typically 8080, and override this)
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Run the HTTP server
CMD [ "node", "index.js", "--server" ]
