FROM mcr.microsoft.com/playwright:v1.53.0-noble
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
RUN mkdir -p /app/captures
EXPOSE 3000
CMD ["node", "server.js"]
