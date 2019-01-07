
### 1.0.8 (2019-01-07):

* Bumped `@newrelic/test-utilities` dependency to v3.0.0.

### 1.0.7 (2018-11-5):

* Adds support for naming transactions without setting the `context.body` property.

* Added missing instrumentation hooks when module imported directly.

* Upgraded dev dependencies.

### 1.0.6 (2018-09-12):

* Fixed coveralls link in readme to point at master branch.

* Removed testing on Node 4 and 5 for Koa and dependent modules.

  Koa versions that supported Node 4 and 5 had an open dependency on `debug`
  (e.g. `"debug": "*"`). The latest major version of `debug` no longer works on
  Node <6 thus rendering these older versions of Koa unusable on Node <6 as well.

### 1.0.5 (2018-04-12):

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
