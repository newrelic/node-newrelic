### 1.0.5 (2018-4-12):

* Upgraded `newrelic` peerDep semver to allow newest major version.

  Thanks @cesine for the PR!

### 1.0.4 (2018-04-11):

* Moved `methods` from `devDependencies` to `dependencies`.

  This fixes an error caused by an oversight in the last release, which included `methods` used as a core dep.

### 1.0.3 (2018-04-10):

* Added support for the `koa-route` routing module.

  Transactions will now be correctly named when routing using the `koa-route`
  module.  Huge thanks to @shumsky for the contribution!

### 1.0.2 (2018-03-22):

* Added check against `Koa.prototype` before instrumenting.

  This ensures that we aren't wrapping versions below 2.0, which would break once middleware
  are executed.

### 1.0.1 (2018-03-15):

* Updated instrumentation to hook into `context.response._body` instead of
  `context.body`.

  This ensures delegation is not overridden regardless of whether users define
  the body directly on `ctx`, or on `ctx.response`. Thanks @qventura for the investigation!
  modules.
