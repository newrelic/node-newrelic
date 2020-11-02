### 5.0.0 (2020-11-02)

* Removed Node v8.x from CI

### 4.1.0 (2020-10-13)

* Fixed bug where _matchedRoute instrumentation would throw if there was
  no active transaction.

  Thank you to @jgeurts for the contribution!

* Added Node 14 testing to CI.

  Thank you to @jgeurts for the contribution!

  Node 14 appears safe to use with this package based on existing testing. Official
  sign-off on Node 14 support for the Node.js agent all supporting packages will come
  in a future release.

* Bumped node-test-utilities to ^4.0.0.

* Added additional dependency language to bottom of third party notices.

* Updated README, contrib guidelines and templates to better match new open
  by default standards.

* Updated readme with community-plus header.

* Updated README as part of the repo consistency project.

* Added additional files to npm ignore.

* Added open source policy workflow to repository.

### 4.0.0 (2020-07-13)

* Updated to Apache 2.0 license.
* Bumped minimum peer dependency (and dev dependency) of newrelic (agent) to 6.11 for license matching.
* Added code of conduct file.
* Updated readme with more detail.
* Updated pull request template.
* Added issue templates for bugs and enhancements.
* Updated contributing guide.
* Migrated CI to GitHub Actions.
* Added copyright headers to all source files.
* Removed Coveralls integration.
* Added third party notices file and metadata for dependencies.
* Bumped minimum versions of tap, coveralls and semver.
* Added repository property to package.json.
* Limited koa-router and @koa/router tests to below versions with known naming issues (8.0.3+).
* Modified router-instrumentation.js to fully conform with linting rules.

### 3.0.0 (2019-10-18):
* add @koa/router instrumentation

  Thanks to @zacanger for this contribution.

* **BREAKING** Removed support for Node 6, 7, and 9.

  The minimum supported version is now Node v8. For further information on our support policy, see: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent.

* Added support for Node v12.

* Bumps `tap` to latest major version.

### 2.0.0 (2019-05-21):

* `koa-router` instrumentation now names transactions after the internal `koa-router` matched route. In the case of multiple matches, the last matched route that can serve requests is used.

* Added `allowedMethods` middleware coverage.

* Fixed issue where `koa` middleware instrumentation did not accurately track `next` method. This could impact custom transaction naming and router framework naming, in certain situations.

### 1.0.8 (2019-01-07):

* Bumped `@newrelic/test-utilities` dependency to v3.0.0.

### 1.0.7 (2018-11-5):

* Adds support for naming transactions without setting the `context.body` property.

* Added missing instrumentation hooks when module imported directly.

* Upgraded dev dependencies.

### 1.0.6 (2018-09-12):

* Fixed coveralls link in readme to point at default branch.

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
