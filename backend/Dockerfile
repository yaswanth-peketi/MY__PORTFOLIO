FROM node:20-alpine

WORKDIR /app

# Copy package descriptors first for layer caching
COPY package*.json ./

RUN npm install --omit=dev

# Copy backend source files
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
