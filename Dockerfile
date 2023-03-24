FROM node:14.21.3-alpine

RUN apk add --no-cache build-base python python-dev

ARG NODE_ENV

ENV NODE_ENV=${NODE_ENV}

COPY . /app

WORKDIR /app

RUN npm install --production

CMD ["node", "."]
