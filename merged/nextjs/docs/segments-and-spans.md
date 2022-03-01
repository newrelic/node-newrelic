# Segments and spans

Segments and spans (when distributed tracing is enabled) are captured for Next.js middleware and `getServerSideProps`(Server-Side Rendering).

## Next.js middleware segments/spans

[Next.js middleware](https://nextjs.org/docs/middleware) is currently a beta feature and our instrumentation may be subject to change and/or break during patch, or minor upgrades of Next.js.

`/Nodejs/Middleware/Nextjs/<middleware location>`

If you have middleware in a deeply nested application, segments and spans will be created for every unique middleware.

```sh
  pages
    _middleware
      nested
        _middleware
          last
            _middleware.js
            [id].js
```

If a request is made to `pages/nested/last/1`, there will be 4 segments:

 * `Nodejs/Middleware/Nextjs//_middleware`
 * `Nodejs/Middleware/Nextjs/nested/_middleware`
 * `Nodejs/Middleware/Nextjs/nested/last/_middleware`
 * `Nodejs/Nextjs/getServerSideProps//pages/nested/last/[id]`


## Server-side rendering segments/spans

`/Nodejs/Nextjs/getServerSideProps/<Next.js page name>`

Next.js pages that contain server-side rendering must export a function called `getServerSideProps`. The function execution will be captured and an additional attribute will be added for the name of the page.

**Attributes**
| Name      | Description                                                |
| --------- | ---------------------------------------------------------- |
| next.page | Name of the page, including dynamic route where applicable |

