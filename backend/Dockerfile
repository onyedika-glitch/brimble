FROM node:20-slim

# Install dependencies for Railpack and Docker CLI
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    python3 \
    make \
    g++ \
    bash \
    && bash -c "curl -fsSL https://get.docker.com | sh" \
    && bash -c "curl -sSL https://railpack.com/install.sh | sh -s -- --bin-dir /usr/local/bin" \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 3001

CMD npx prisma generate && npx prisma db push --accept-data-loss && npm run dev
