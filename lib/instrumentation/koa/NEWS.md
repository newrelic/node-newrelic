### v7.1.1 (2022-12-16)

* Updated Koa instrumentation to work in applications using the ES Modules loader.

--- NOTES NEEDS REVIEW ---
Bumps [qs](https://github.com/ljharb/qs) from 6.5.2 to 6.5.3.
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a href="https://github.com/ljharb/qs/blob/main/CHANGELOG.md">qs's changelog</a>.</em></p>
<blockquote>
<h2><strong>6.5.3</strong></h2>
<ul>
<li>[Fix] <code>parse</code>: ignore <code>__proto__</code> keys (<a href="https://github-redirect.dependabot.com/ljharb/qs/issues/428">#428</a>)</li>
<li>[Fix] <code>utils.merge</code>: avoid a crash with a null target and a truthy non-array source</li>
<li>[Fix] correctly parse nested arrays</li>
<li>[Fix] <code>stringify</code>: fix a crash with <code>strictNullHandling</code> and a custom <code>filter</code>/<code>serializeDate</code> (<a href="https://github-redirect.dependabot.com/ljharb/qs/issues/279">#279</a>)</li>
<li>[Fix] <code>utils</code>: <code>merge</code>: fix crash when <code>source</code> is a truthy primitive &amp; no options are provided</li>
<li>[Fix] when <code>parseArrays</code> is false, properly handle keys ending in <code>[]</code></li>
<li>[Fix] fix for an impossible situation: when the formatter is called with a non-string value</li>
<li>[Fix] <code>utils.merge</code>: avoid a crash with a null target and an array source</li>
<li>[Refactor] <code>utils</code>: reduce observable [[Get]]s</li>
<li>[Refactor] use cached <code>Array.isArray</code></li>
<li>[Refactor] <code>stringify</code>: Avoid arr = arr.concat(...), push to the existing instance (<a href="https://github-redirect.dependabot.com/ljharb/qs/issues/269">#269</a>)</li>
<li>[Refactor] <code>parse</code>: only need to reassign the var once</li>
<li>[Robustness] <code>stringify</code>: avoid relying on a global <code>undefined</code> (<a href="https://github-redirect.dependabot.com/ljharb/qs/issues/427">#427</a>)</li>
<li>[readme] remove travis badge; add github actions/codecov badges; update URLs</li>
<li>[Docs] Clean up license text so it’s properly detected as BSD-3-Clause</li>
<li>[Docs] Clarify the need for &quot;arrayLimit&quot; option</li>
<li>[meta] fix README.md (<a href="https://github-redirect.dependabot.com/ljharb/qs/issues/399">#399</a>)</li>
<li>[meta] add FUNDING.yml</li>
<li>[actions] backport actions from main</li>
<li>[Tests] always use <code>String(x)</code> over <code>x.toString()</code></li>
<li>[Tests] remove nonexistent tape option</li>
<li>[Dev Deps] backport from main</li>
</ul>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/ljharb/qs/commit/298bfa55d6db00ddea78dd0333509aadf9bb3077"><code>298bfa5</code></a> v6.5.3</li>
<li><a href="https://github.com/ljharb/qs/commit/ed0f5dcbef4b168a8ae299d78b1e4a2e9b1baf1f"><code>ed0f5dc</code></a> [Fix] <code>parse</code>: ignore <code>__proto__</code> keys (<a href="https://github-redirect.dependabot.com/ljharb/qs/issues/428">#428</a>)</li>
<li><a href="https://github.com/ljharb/qs/commit/691e739cfa40cd42604dc05a54e6154371a429ab"><code>691e739</code></a> [Robustness] <code>stringify</code>: avoid relying on a global <code>undefined</code> (<a href="https://github-redirect.dependabot.com/ljharb/qs/issues/427">#427</a>)</li>
<li><a href="https://github.com/ljharb/qs/commit/1072d57d38a690e1ad7616dced44390bffedcbb2"><code>1072d57</code></a> [readme] remove travis badge; add github actions/codecov badges; update URLs</li>
<li><a href="https://github.com/ljharb/qs/commit/12ac1c403aaa04d1a34844f514ed9f9abfb76e64"><code>12ac1c4</code></a> [meta] fix README.md (<a href="https://github-redirect.dependabot.com/ljharb/qs/issues/399">#399</a>)</li>
<li><a href="https://github.com/ljharb/qs/commit/0338716b09fdbd4711823eeb0a14e556a2498e7a"><code>0338716</code></a> [actions] backport actions from main</li>
<li><a href="https://github.com/ljharb/qs/commit/5639c20ce0a7c1332200a3181339331483e5a3a1"><code>5639c20</code></a> Clean up license text so it’s properly detected as BSD-3-Clause</li>
<li><a href="https://github.com/ljharb/qs/commit/51b8a0b1b213596dd1702b837f5e7dec2229793d"><code>51b8a0b</code></a> add FUNDING.yml</li>
<li><a href="https://github.com/ljharb/qs/commit/45f675936e742d92fac8d4dae5cfc385c576a977"><code>45f6759</code></a> [Fix] fix for an impossible situation: when the formatter is called with a no...</li>
<li><a href="https://github.com/ljharb/qs/commit/f814a7f8f2af059f8158f7e4b2bf8b46aeb62cd3"><code>f814a7f</code></a> [Dev Deps] backport from main</li>
<li>Additional commits viewable in <a href="https://github.com/ljharb/qs/compare/v6.5.2...v6.5.3">compare view</a></li>
</ul>
</details>
<br />


[![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=qs&package-manager=npm_and_yarn&previous-version=6.5.2&new-version=6.5.3)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.

[//]: # (dependabot-automerge-start)
[//]: # (dependabot-automerge-end)

---

<details>
<summary>Dependabot commands and options</summary>
<br />

You can trigger Dependabot actions by commenting on this PR:
- `@dependabot rebase` will rebase this PR
- `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it
- `@dependabot merge` will merge this PR after your CI passes on it
- `@dependabot squash and merge` will squash and merge this PR after your CI passes on it
- `@dependabot cancel merge` will cancel a previously requested merge and block automerging
- `@dependabot reopen` will reopen this PR if it is closed
- `@dependabot close` will close this PR and stop Dependabot recreating it. You can achieve the same result by closing it manually
- `@dependabot ignore this major version` will close this PR and stop Dependabot creating any more for this major version (unless you reopen the PR or upgrade to it yourself)
- `@dependabot ignore this minor version` will close this PR and stop Dependabot creating any more for this minor version (unless you reopen the PR or upgrade to it yourself)
- `@dependabot ignore this dependency` will close this PR and stop Dependabot creating any more for this dependency (unless you reopen the PR or upgrade to it yourself)
- `@dependabot use these labels` will set the current labels as the default for future PRs for this repo and language
- `@dependabot use these reviewers` will set the current reviewers as the default for future PRs for this repo and language
- `@dependabot use these assignees` will set the current assignees as the default for future PRs for this repo and language
- `@dependabot use this milestone` will set the current milestone as the default for future PRs for this repo and language

You can disable automated security fix PRs for this repo from the [Security Alerts page](https://github.com/newrelic/node-newrelic-koa/network/alerts).

</details>
--------------------------

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
