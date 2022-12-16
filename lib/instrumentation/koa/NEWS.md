### v7.1.1 (2022-12-16)

* Updated Koa instrumentation to work in applications using the ES Modules loader.

### v7.1.0 (2022-11-14)

* Removed `__NR` prefixed properties in favor of symbols.

### v7.0.0 (2022-07-27)

* **BREAKING** Removed support for Node 12.

  The minimum supported version is now Node v14. For further information on our support policy, see: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent.

* Added support for Node 18.
* Resolved several dev-dependency audit warnings.

### v6.1.2 (2022-03-07)

* Bumps [urijs](https://github.com/medialize/URI.js) from 1.19.7 to 1.19.9.

* Stopped bundling versioned tests.

* Fixed discuss.newrelic.com link in README

* Resolved several dev-dependency audit warnings.

### v6.1.1 (2022-02-07)

* Updated `add-to-board` to use org level `NODE_AGENT_GH_TOKEN`

* Removed usages of internal tracer instance.

* Bumped `@newrelic/test-utilities` to ^6.3.0.

### v6.1.0 (2022-01-11)

* Removed context-less timer hop from transaction state test.

  The context-less timer hope was not specific to koa execution. With the upcoming AsyncLocal implementation there are new limitations to boundaries we can track promises that cause this to fail. Given this setup is not specific to koa functionality, modifying to remove.

* Added workflow to automate preparing release notes by reusing the newrelic/node-newrelic/.github/workflows/prep-release.yml@main workflow from agent repository.

* Added job to automatically add issues/pr to Node.js Engineering board

* Added a pre-commit hook to check if package.json changes and run oss third-party manifest and oss third-party notices. This will ensure the third_party_manifest.json and THIRD_PARTY_NOTICES.md are up to date.
 * Added a pre-commit hook to run linting via husky

* Added @newrelic/eslint-config to rely on a centralized eslint ruleset.

* Upgraded setup-node CI job to v2 and changed the linting node version to lts/* for future proofing

### 6.0.1 (2021-07-20)

* Added versioned tests to the files list within package.json

### 6.0.0 (2021-07-19)

* **BREAKING** Removed support for Node 10.

  The minimum supported version is now Node v12. For further information on our support policy, see: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent.

* Added support for Node 16.
* Updated module to use files array instead of publishing all except `.npmignore`.
* Removed the `methods` package as a dependency and updated code to just lowercase http methods.
* Upgraded tap to v15.
* Removed deprecated tap methods.
* Added @koa/router to the list of supported routing modules in README.
* Bumped `@newrelic/test-utilities` to ^5.1.0.

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
