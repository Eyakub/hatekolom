FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install
COPY . .

EXPOSE 3001

# Always run npm install first — the volume mount overwrites node_modules from the build layer
CMD ["sh", "-c", "npm install && npm run dev"]
