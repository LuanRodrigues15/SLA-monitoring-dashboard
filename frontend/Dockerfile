FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ARG VITE_API_URL=http://trino.example.internal:8091
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM node:20-alpine
RUN npm install -g serve
COPY --from=builder /app/dist /app/dist
EXPOSE 3001
CMD ["serve", "-s", "/app/dist", "-l", "3001"]
