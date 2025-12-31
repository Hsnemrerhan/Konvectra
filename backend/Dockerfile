FROM node:20-bookworm-slim

WORKDIR /app

# 1. Gerekli Linux araçlarını, Python3'ü ve FFmpeg'i kur
# ca-certificates: SSL bağlantı hatalarını önler
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 2. Python kütüphanelerini kur
# Bookworm sürümünde bu bayrak zorunludur ve çalışır.
RUN pip3 install livekit livekit-api yt-dlp python-dotenv --break-system-packages

# 3. Node.js bağımlılıklarını kur
COPY package*.json ./
RUN npm install

# 4. Kodları kopyala
COPY . .

EXPOSE 5000

# Backend'i başlat
CMD ["npm", "run", "dev"]