FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache ffmpeg

COPY package*.json ./

RUN npm install

COPY . .

# Vite varsayılan olarak 5173 portunu kullanır
EXPOSE 5173

# Dışarıdan erişim için --host parametresi şarttır
CMD ["npm", "run", "dev", "--", "--host"]