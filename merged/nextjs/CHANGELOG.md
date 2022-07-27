### v0.3.0 (2022-07-27)

## Proposed Release Notes

* **BREAKING** Removed support for Node 12.

The minimum supported version is now Node v14. For further information on our support policy, see: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent.
  
* Added support for Node 18.x 

* Updated sample app to use `http.get` instead of `fetch` to make subrequests to API to avoid async context propagation breakage in Node 18.

## Links

* PR: https://github.com/newrelic/newrelic-node-nextjs/pull/80
* PR: https://github.com/newrelic/newrelic-node-nextjs/pull/78
* PR: https://github.com/newrelic/newrelic-node-nextjs/pull/75
* PR: https://github.com/newrelic/newrelic-node-nextjs/pull/77
* PR: https://github.com/newrelic/newrelic-node-nextjs/pull/73
* PR: https://github.com/newrelic/newrelic-node-nextjs/pull/76


### v0.2.0 (2022-07-05)

* **BREAKING**: Fixed instrumentation to only support middleware in `>=12.2.0` of Next.js
   * Next.js has made middleware [stable](https://nextjs.org/docs/advanced-features/middleware).
   * All attempts in `@newrelic/next` to track middleware before 12.2.0 have been removed.

* Added an additional path to register `next-server` when running a Next.js app with a standalone server.

* Updated dev-dependencies to clear security audit warnings.

### v0.1.1 (2022-04-04)

* Added support for middleware in > 12.1.1 of Next.js.  The return of `getModuleContext` is now an async function.

* Fixed a few small documentation items.

### v0.1.0 (2022-03-01)
 * Initial release of the Node.js Next.js instrumentation.
   * Transaction naming based on Next.js page or API route.
   * Segment/Span capture for middleware, and getServerSideProps.
   * Documentation around manually injecting the New Relic browser agent.
   * Verified support on Next.js >= 12.0.9
