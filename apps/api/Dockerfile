FROM node:24-alpine

WORKDIR /app/apps/api

COPY apps/api/package*.json ./
COPY apps/api/prisma ./prisma
COPY apps/api/prisma.config.ts ./
# El lock actual está atrasado respecto de package.json; npm install resuelve
# las dependencias declaradas para que el servicio local pueda construirse.
RUN npm install

COPY apps/api ./
COPY assets /app/assets

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
