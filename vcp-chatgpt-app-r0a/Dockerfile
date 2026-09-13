FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
ENV HOST=0.0.0.0
ENV PORT=3010
EXPOSE 3010
CMD ["node", "src/server.mjs"]
