### v7.0.0 (2023-08-17)

* Simplified instrumentation to only register relevant v3 middleware once in the `send` method of the SmithyClient.

* **BREAKING**: Removed support for Node 14.

--- NOTES NEEDS REVIEW ---
Bumps [word-wrap](https://github.com/jonschlinkert/word-wrap) from 1.2.3 to 1.2.4.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a href="https://github.com/jonschlinkert/word-wrap/releases">word-wrap's releases</a>.</em></p>
<blockquote>
<h2>1.2.4</h2>
<h2>What's Changed</h2>
<ul>
<li>Remove default indent by <a href="https://github.com/mohd-akram"><code>@​mohd-akram</code></a> in <a href="https://redirect.github.com/jonschlinkert/word-wrap/pull/24">jonschlinkert/word-wrap#24</a></li>
<li>🔒fix: CVE 2023 26115 (2) by <a href="https://github.com/OlafConijn"><code>@​OlafConijn</code></a> in <a href="https://redirect.github.com/jonschlinkert/word-wrap/pull/41">jonschlinkert/word-wrap#41</a></li>
<li>:lock: fix: CVE-2023-26115 by <a href="https://github.com/aashutoshrathi"><code>@​aashutoshrathi</code></a> in <a href="https://redirect.github.com/jonschlinkert/word-wrap/pull/33">jonschlinkert/word-wrap#33</a></li>
<li>chore: publish workflow by <a href="https://github.com/OlafConijn"><code>@​OlafConijn</code></a> in <a href="https://redirect.github.com/jonschlinkert/word-wrap/pull/42">jonschlinkert/word-wrap#42</a></li>
</ul>
<h2>New Contributors</h2>
<ul>
<li><a href="https://github.com/mohd-akram"><code>@​mohd-akram</code></a> made their first contribution in <a href="https://redirect.github.com/jonschlinkert/word-wrap/pull/24">jonschlinkert/word-wrap#24</a></li>
<li><a href="https://github.com/OlafConijn"><code>@​OlafConijn</code></a> made their first contribution in <a href="https://redirect.github.com/jonschlinkert/word-wrap/pull/41">jonschlinkert/word-wrap#41</a></li>
<li><a href="https://github.com/aashutoshrathi"><code>@​aashutoshrathi</code></a> made their first contribution in <a href="https://redirect.github.com/jonschlinkert/word-wrap/pull/33">jonschlinkert/word-wrap#33</a></li>
</ul>
<p><strong>Full Changelog</strong>: <a href="https://github.com/jonschlinkert/word-wrap/compare/1.2.3...1.2.4">https://github.com/jonschlinkert/word-wrap/compare/1.2.3...1.2.4</a></p>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/jonschlinkert/word-wrap/commit/f64b188c7261d26b99e1e2075d6b12f21798e83a"><code>f64b188</code></a> run verb to generate README</li>
<li><a href="https://github.com/jonschlinkert/word-wrap/commit/03ea08256ba0c8e8b02b1b304f0f5bd2b1863207"><code>03ea082</code></a> Merge pull request <a href="https://redirect.github.com/jonschlinkert/word-wrap/issues/42">#42</a> from jonschlinkert/chore/publish-workflow</li>
<li><a href="https://github.com/jonschlinkert/word-wrap/commit/420dce9a2412b21881202b73a3c34f0edc53cb2e"><code>420dce9</code></a> Merge pull request <a href="https://redirect.github.com/jonschlinkert/word-wrap/issues/41">#41</a> from jonschlinkert/fix/CVE-2023-26115-2</li>
<li><a href="https://github.com/jonschlinkert/word-wrap/commit/bfa694edf55bb84ff84512f13da6d68bf7593f06"><code>bfa694e</code></a> Update .github/workflows/publish.yml</li>
<li><a href="https://github.com/jonschlinkert/word-wrap/commit/ace0b3c78f81aaf43040bab3bc91d3c5546d3fd2"><code>ace0b3c</code></a> chore: bump version to 1.2.4</li>
<li><a href="https://github.com/jonschlinkert/word-wrap/commit/6fd727594676f3e1b196b08a320908bec2f4ca02"><code>6fd7275</code></a> chore: add publish workflow</li>
<li><a href="https://github.com/jonschlinkert/word-wrap/commit/30d6daf60fce429f5f559252fa86ee78200652c4"><code>30d6daf</code></a> chore: fix test</li>
<li><a href="https://github.com/jonschlinkert/word-wrap/commit/655929cabea6299dddf3b4a21fc3713fca701b48"><code>655929c</code></a> chore: remove package-lock</li>
<li><a href="https://github.com/jonschlinkert/word-wrap/commit/49e08bbc32a84da5d79e6b7e0fa74ff6217f6d81"><code>49e08bb</code></a> chore: added an additional testcase</li>
<li><a href="https://github.com/jonschlinkert/word-wrap/commit/9f626935f3fac6ec0f3c4b26baea4eb9740d9645"><code>9f62693</code></a> fix: cve 2023-26115</li>
<li>Additional commits viewable in <a href="https://github.com/jonschlinkert/word-wrap/compare/1.2.3...1.2.4">compare view</a></li>
</ul>
</details>
<br />


[![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=word-wrap&package-manager=npm_and_yarn&previous-version=1.2.3&new-version=1.2.4)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

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
You can disable automated security fix PRs for this repo from the [Security Alerts page](https://github.com/newrelic/node-newrelic-aws-sdk/network/alerts).

</details>
--------------------------

* Updated CI to run against versions 16-20.

--- NOTES NEEDS REVIEW ---
Bumps [protobufjs](https://github.com/protobufjs/protobuf.js) from 7.2.2 to 7.2.4.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a href="https://github.com/protobufjs/protobuf.js/releases">protobufjs's releases</a>.</em></p>
<blockquote>
<h2>protobufjs: v7.2.4</h2>
<h2><a href="https://github.com/protobufjs/protobuf.js/compare/protobufjs-v7.2.3...protobufjs-v7.2.4">7.2.4</a> (2023-06-23)</h2>
<h3>Bug Fixes</h3>
<ul>
<li>do not let setProperty change the prototype (<a href="https://redirect.github.com/protobufjs/protobuf.js/issues/1899">#1899</a>) (<a href="https://github.com/protobufjs/protobuf.js/commit/e66379f451b0393c27d87b37fa7d271619e16b0d">e66379f</a>)</li>
</ul>
<h2>protobufjs: v7.2.3</h2>
<h2><a href="https://github.com/protobufjs/protobuf.js/compare/protobufjs-v7.2.2...protobufjs-v7.2.3">7.2.3</a> (2023-03-27)</h2>
<h3>Bug Fixes</h3>
<ul>
<li>type names can be split into multiple tokens (<a href="https://redirect.github.com/protobufjs/protobuf.js/issues/1877">#1877</a>) (<a href="https://github.com/protobufjs/protobuf.js/commit/8817ee613dfcf55f7f6fa8704f3fdd3e68c0e1d8">8817ee6</a>)</li>
</ul>
</blockquote>
</details>
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a href="https://github.com/protobufjs/protobuf.js/blob/master/CHANGELOG.md">protobufjs's changelog</a>.</em></p>
<blockquote>
<h2><a href="https://github.com/protobufjs/protobuf.js/compare/protobufjs-v7.2.3...protobufjs-v7.2.4">7.2.4</a> (2023-06-23)</h2>
<h3>Bug Fixes</h3>
<ul>
<li>do not let setProperty change the prototype (<a href="https://redirect.github.com/protobufjs/protobuf.js/issues/1899">#1899</a>) (<a href="https://github.com/protobufjs/protobuf.js/commit/e66379f451b0393c27d87b37fa7d271619e16b0d">e66379f</a>)</li>
</ul>
<h2><a href="https://github.com/protobufjs/protobuf.js/compare/protobufjs-v7.2.2...protobufjs-v7.2.3">7.2.3</a> (2023-03-27)</h2>
<h3>Bug Fixes</h3>
<ul>
<li>type names can be split into multiple tokens (<a href="https://redirect.github.com/protobufjs/protobuf.js/issues/1877">#1877</a>) (<a href="https://github.com/protobufjs/protobuf.js/commit/8817ee613dfcf55f7f6fa8704f3fdd3e68c0e1d8">8817ee6</a>)</li>
</ul>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/protobufjs/protobuf.js/commit/42e5a9ca85044800b16e193020e1d4d2e6b4010c"><code>42e5a9c</code></a> chore: release master (<a href="https://redirect.github.com/protobufjs/protobuf.js/issues/1900">#1900</a>)</li>
<li><a href="https://github.com/protobufjs/protobuf.js/commit/e66379f451b0393c27d87b37fa7d271619e16b0d"><code>e66379f</code></a> fix: do not let setProperty change the prototype (<a href="https://redirect.github.com/protobufjs/protobuf.js/issues/1899">#1899</a>)</li>
<li><a href="https://github.com/protobufjs/protobuf.js/commit/56b1e64979dae757b67a21d326e16acee39f2267"><code>56b1e64</code></a> chore: release master (<a href="https://redirect.github.com/protobufjs/protobuf.js/issues/1879">#1879</a>)</li>
<li><a href="https://github.com/protobufjs/protobuf.js/commit/8817ee613dfcf55f7f6fa8704f3fdd3e68c0e1d8"><code>8817ee6</code></a> fix: type names can be split into multiple tokens (<a href="https://redirect.github.com/protobufjs/protobuf.js/issues/1877">#1877</a>)</li>
<li>See full diff in <a href="https://github.com/protobufjs/protobuf.js/compare/protobufjs-v7.2.2...protobufjs-v7.2.4">compare view</a></li>
</ul>
</details>
<br />


[![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=protobufjs&package-manager=npm_and_yarn&previous-version=7.2.2&new-version=7.2.4)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

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
You can disable automated security fix PRs for this repo from the [Security Alerts page](https://github.com/newrelic/node-newrelic-aws-sdk/network/alerts).

</details>
--------------------------

### v6.0.0 (2023-06-30)

* **BREAKING**: Removed ability to run `@newrelic/aws-sdk` as a standalone module. This package gets bundled with agent and no longer can run as a standalone in v10 of the newrelic agent.

* Fixed instrumentation in AWS 3.363.0.

* Updated README links to point to new forum link due to repolinter ruleset change.

### v5.0.5 (2023-05-01)

* Assigned shimName to v3 instrumentation hooks to avoid duplicate middleware crashes.

### v5.0.4 (2023-04-04)

* Fixed issue where agent instrumentation caused unusable presigned urls to be generated by `@aws-sdk/s3-request-presigner`

### v5.0.3 (2023-03-15)

* Updated name of header in `NewRelicHeader` middleware to avoid crashing in versions >= 3.290.0

* Updated README header image to latest OSS office required images.

* Added lockfile checks to CI workflow to prevent malicious changes.

### v5.0.2 (2022-11-07)

* Fixed a crash when using versions >3.192.0 of AWS sdk v3 where a customer would see an error of `error: TypeError: config.endpoint is not a function`.

* Updated versioned tests to exclude 3.194.0-3.196.0 from tests because they contain breaking changes. 

### v5.0.1 (2022-10-10)

* Updated DynamoDB instrumentation to default port to 443 when not specified from the endpoint.

### v5.0.0 (2022-07-28)

* **BREAKING** Removed support for Node 12.

The minimum supported version is now Node v14. For further information on our support policy, see: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent.
  
* Added support for Node 18.x 

* Updated the minimum version of the newrelic agent peer dependency to be `>=8.7.0`.

* Removed usage of `async` module.

* Bumped tap to ^16.0.1.

* Resolved several dev-dependency audit warnings.

### v4.1.2 (2022-03-07)

* Removed versioned tests from npm artifact.

* Fixed link to discuss.newrelic.com in README

* Updated newrelic from 8.7.0 to 8.7.1.

* Resolved several dev-dependency audit warnings.

* Updated `add-to-board` to use org level `NODE_AGENT_GH_TOKEN`

### v4.1.1 (2022-01-13)

* Fixed issue where v3 instrumentation checks against agent version would result in a logged error and fail to apply instrumentation.

### v4.1.0 (2022-01-06)

* Added support for AWS SDK v3 🎉

  * Instrumented the following packages: `@aws-sdk/client-sns`, `@aws-sdk/client-sqs`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`.

  * Captured generic AWS requests by instrumenting the `@aws-sdk/smithy-client`.

* Required agent version to be `>=8.7.0` to register the instrumentation to support AWS SDK v3

* Added workflow to automate preparing release notes by reusing the `newrelic/node-newrelic/.github/workflows/prep-release.yml@main` workflow from agent repository.

* Added job to automatically add issues/pr to Node.js Engineering board

* Upgraded `@newrelic/test-utilities` to enable running 1 file through versioned runner

* Added a pre-commit hook to check if package.json changes and run oss third-party manifest and oss third-party notices. This will ensure the third_party_manifest.json and THIRD_PARTY_NOTICES.md are up to date.

* Added a pre-commit hook to run linting via husky

* Added @newrelic/eslint-config to rely on a centralized eslint ruleset.

* Upgraded setup-node CI job to v2 and changed the linting node version to lts/* for future proofing

### 4.0.1 (2021-07-20):
* Added versioned tests to the files list within package.json

### 4.0.0 (2021-07-20):

* **BREAKING** Removed support for Node 10.

  The minimum supported version is now Node v12. For further information on our support policy, see: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent.

* Added support for Node 16.
* Added files list to package.json instead of using `.npmignore` for module publishing.
* Bumped `@newrelic/test-utilities` to ^5.1.0.
* Bumped `tap` to ^15.0.9.

### 3.1.0 (2021-01-05):

* Properly instrument dynamodb batchGet, batchWrite, transactGet, and transactWrite calls as database
  operations instead of External service calls.

### 3.0.0 (2020-11-02):

* Removed Node v8.x from CI.
* Added Node v14.x to CI.
* Update README for consistency with New Relic OSS repositories
* Remove Code of Conduct doc and link to New Relic org Code of Conduct in
  Contributing doc.

### 2.0.0 (2020-08-03):

* Updated to Apache 2.0 license.
* Bumped minimum peer dependency (and dev dependency) of newrelic (agent) to 6.11 for license matching.
* Added third party notices file and metadata for dependencies.
* Updated README with more detail.
* Added issue templates for bugs and enhancements.
* Added code of conduct file.
* Added contributing guide.
* Added pull request template.
* Migrated CI to GitHub Actions.
* Added copyright headers to all source files.
* Bumped @newrelic/test-utils to 4.0.0
* Added additional items to .npmignore.
* Removed AWS servers as dependency for versioned tests.
  Enables versioned test to run successfully for forked repo PRs.

### 1.1.3 (2020-06-12):

* Fixed issue where instrumentation would produce a `TypeError: Cannot read property 'lastIndexOf' of undefined` error if a program called `sqs.receiveMessage` without a `QueueUrl` parameter.

### 1.1.2 (2020-02-20):

* Fixed issue where instrumentation would crash pulling `host` and `port` values when `AmazonDaxClient` was used as the service for `DocumentClient.`

  `AmazonDaxClient` requests will report 'unknown' for `host` and `port` attributes. Other oddities may still exist until DAX officially supported.

### 1.1.1 (2020-01-27):

* Bumps DynamoDB tap.test timeout to avoid versioned test terminations when table creates are slow.

### 1.1.0 (2020-01-23):

* Adds official support for API promise calls.
  For example: `await ddb.createTable(params).promise()`.

  * Fixed issue where external spans/segments would be incorrectly created in addition to more specific types such as datastore spans/segments. This also resulted in missing attributes from the more specific spans/segments.
  * Fixed issue where spans/segments would not have timing update appropriately upon promise resolution. These would show sub-millisecond execution time as the time captured was the execution of the initial function not accounting for async execution.

* Adds check before applying instrumentation to avoid breaking for very old versions of `aws-sdk`.

### 1.0.0 (2019-10-25):

* **BREAKING** Removed support for Node 6, 7, and 9.

  The minimum supported version is now Node v8. For further information on our support policy, see: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent.

### 0.3.0 (2019-07-18):

* Adds support for DocumentClient API calls to be captured as Datastore segments/metrics.

  Supported calls are: `get`, `put`, `update`, `delete`, `query` and `scan`. These will be named according to the underlying DynamoDB operation that is executed. For example: `get` will be named `getItem`. DocumentClient calls not listed above will still be captured as Externals.

* Fixed issue that would prevent multiple DynamoDB instances from being instrumented.

* Replaced `database_name` with `collection` in DynamoDB attributes.

* Moved `name` property to the root of DynamoDB segment description object.

  Previously, segments were being incorrectly named `"Datastore/operation/DynamoDB/undefined"`, due to the operation name being misplaced.


### 0.2.0 (2019-02-19):

* Added instrumentation for SNS `publish` API.

* Added instrumentation for SQS `sendMessage`, `sendMessageBatch` and
  `receiveMessageBatch` APIs.


### 0.1.0 (2019-02-13):

* Added instrumentation for services to be recorded as HTTP externals.

  * APIGateway
  * ELB
  * ElastiCache
  * Lambda
  * RDS
  * Redshift
  * Rekognition
  * S3
  * SES

* Added instrumentation for DynamoDB.
