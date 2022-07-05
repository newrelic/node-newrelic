# Segments and spans

Segments and spans (when distributed tracing is enabled) are captured for Next.js middleware and `getServerSideProps`(Server-Side Rendering).

## Next.js middleware segments/spans

[Next.js middleware](https://nextjs.org/docs/middleware) was made stable in 12.2.0.  As of v0.2.0 of `@newrelic/next`, it will only instrument Next.js middleware in versions greater than or equal to 12.2.0.

`/Nodejs/Middleware/Nextjs//middleware`

Since middleware executes for every request you will see the same span for every request if middleware is present even if you aren't executing any business logic for a given route.  If you have middleware in a deeply nested application, segments and spans will be created for every unique middleware.

## Server-side rendering segments/spans

`/Nodejs/Nextjs/getServerSideProps/<Next.js page name>`

Next.js pages that contain server-side rendering must export a function called `getServerSideProps`. The function execution will be captured and an additional attribute will be added for the name of the page.

**Attributes**
| Name      | Description                                                |
| --------- | ---------------------------------------------------------- |
| next.page | Name of the page, including dynamic route where applicable |
