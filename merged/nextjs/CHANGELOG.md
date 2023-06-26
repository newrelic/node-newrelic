### v0.5.2 (2023-06-26)

* Fixed Next.js `getServerSideProps` instrumentation to register via `renderToResponseWithComponents` instead of `renderHTML`

* Updated README links to point to new forum link due to repolinter ruleset change

### v0.5.1 (2023-05-22)

* Updated instrumentation to work in versions >= 13.3.1 as the methods we try to wrap no longer have setters.

### v0.5.0 (2023-04-19)

* **BREAKING** - Route (URL) parameters are now stored as `request.parameters.route.*` attributes on Transactions

* Updated README header image to latest OSS office required images

* Bumped [json5](https://github.com/json5/json5) from 2.2.1 to 2.2.3.

* Added lockfile checks to CI workflow to prevent malicious changes

### v0.4.0 (2022-12-15)

* Added ability to capture code level metrics attributes for middleware, `getServerSideProps` functions, and API handlers. 
   * This will require customers to use New Relic Node.js version >= 9.7.1.
   * Please note that the integration with CodeStream is not finished. A future release of agent will enable code level metrics by default.

* Updated versioned tests to include v13 of Next.js.

### v0.3.1 (2022-10-17)

* Updated newrelic peer dependency to be >= 8.14.0. This makes the hasToRemoveScriptWrapper property available for api.getBrowserTimingHeader.
 
  Thanks for your contribution @siuvdlec!

* Updated injecting browser agent snippet in both README and docs.
 * Updated example application to include the browser agent snippet and README to using example project.

 * Removed browser agent injection test from versioned tests

### v0.3.0 (2022-07-27)

* **BREAKING** Removed support for Node 12.

The minimum supported version is now Node v14. For further information on our support policy, see: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent.
  
* Added support for Node 18.x 

* Updated sample app to use `http.get` instead of `fetch` to make subrequests to API to avoid async context propagation breakage in Node 18.

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
