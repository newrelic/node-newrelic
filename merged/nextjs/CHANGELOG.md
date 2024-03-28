### v0.9.0 (2024-03-28)

#### Features

* Added a shim to externalize all 3rd party libraries the Node.js agent instruments ([#175](https://github.com/newrelic/newrelic-node-nextjs/pull/175)) ([127e3c0](https://github.com/newrelic/newrelic-node-nextjs/commit/127e3c01a65a6ff3bef8bc9ae0759e42b69d2065))
* Added a test suite for App Router. ([#176](https://github.com/newrelic/newrelic-node-nextjs/pull/176)) ([e7bc0db](https://github.com/newrelic/newrelic-node-nextjs/commit/e7bc0db0599713036c2d63b70f960ef86ccde9b0))

#### Miscellaneous chores

* Updated CI process for releases ([#183](https://github.com/newrelic/newrelic-node-nextjs/pull/183)) ([99a61c5](https://github.com/newrelic/newrelic-node-nextjs/commit/99a61c5fb5cb603de692fe813351d3f7f0c43780))

### v0.8.0 (2024-03-12)

* Updated instrumentation to construct spec objects at instrumentation.
 * Fixed instrumentation to only pass in route parameters to be added to Next.js segments. 
 * Updated minimum version of agent to 11.12.0.
 * Updated dev deps `follow-redirects`, `@babel/traverse` to fix bugs and CVEs

### v0.7.0 (2023-08-29)

* Updated the module path to properly instrument Next.js with `require-in-the-middle`.

* Updated minimum version of peer dependency `newrelic` to `>=11.0.0` to ensure the new path to Next.js server instrumentation will work.

* Updated the contributing docs.

* Updated versioned test helper to handle next@13.4.15 changes.

### v0.6.0 (2023-08-09)

* **BREAKING** - Dropped support for Node 14.
* Added support for Node 20.
* Updated instrumentation to no longer record spans for middleware execution. Middleware instrumentation is now recorded only for Next.js 12.2.0-13.4.12.
* Updated instrumentation for api requests to properly extract the params and page.
* Updated CI to run against versions 16-20.
* Updated `semver`, `word-wrap`, `protobuf`, `fast-xml-parser`, and `@aws-sdk/client-lambda` to resolve CVEs.

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
