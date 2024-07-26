# Transactions

Transactions are captured as web transactions and named based on the Next.js page or API route. If you are using Next.js as a [custom server](https://nextjs.org/docs/advanced-features/custom-server), our Next.js instrumentation overrides the transaction naming of existing instrumentation for the custom server framework (for example, express, fastify, hapi, koa). Also, the transaction will be renamed based on the Next.js page or API route.

Let's say we have a Next.js app with the following application structure:

```
pages
  index.js
  dynamic
    static.js
    [id].js
api
  hiya.js
  dynamic
    [id].js
```

The transactions will be named as follows:

| Request                | Transaction Name                 |
| ---------------------  | -------------------------------- |
| /pages/                | Nextjs/GET//                     |
| /pages/dynamic/static  | Nextjs/GET//pages/dynamic/static |
| /pages/dynamic/example | Nextjs/GET//pages/dynamic/[id]   |
| /api/hiya              | Nextjs/GET//api/hiya             |
| /api/dynamic/example   | Nextjs/GET//api/dynamic/[id]     |


## Errors
There are two exceptions to the transaction naming above.

### 404s
If a request to a non-existent page or API route is made, the transaction name will flow through the Next.js 404 page and will be named as `Nextjs/GET//404`.

### Non 404 errors
If a request is made that results in a 4xx or 5xx error, the transaction will flow through the Next.js error component and will be named as `Nextjs/GET//_error`.


