### v6.0.0 (2022-07-27)

* Dropped Node 12 support
    * Updated the minimum version of the newrelic agent peer dependency to be `>=8.7.0`.

--- NOTES NEEDS REVIEW ---
Bumps [moment](https://github.com/moment/moment) from 2.29.2 to 2.29.4.
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a href="https://github.com/moment/moment/blob/develop/CHANGELOG.md">moment's changelog</a>.</em></p>
<blockquote>
<h3>2.29.4</h3>
<ul>
<li>Release Jul 6, 2022
<ul>
<li><a href="https://github-redirect.dependabot.com/moment/moment/pull/6015">#6015</a> [bugfix] Fix ReDoS in preprocessRFC2822 regex</li>
</ul>
</li>
</ul>
<h3>2.29.3 <a href="https://gist.github.com/ichernev/edebd440f49adcaec72e5e77b791d8be">Full changelog</a></h3>
<ul>
<li>Release Apr 17, 2022
<ul>
<li><a href="https://github-redirect.dependabot.com/moment/moment/pull/5995">#5995</a> [bugfix] Remove const usage</li>
<li><a href="https://github-redirect.dependabot.com/moment/moment/pull/5990">#5990</a> misc: fix advisory link</li>
</ul>
</li>
</ul>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/moment/moment/commit/000ac1800e620f770f4eb31b5ae908f6167b0ab2"><code>000ac18</code></a> Build 2.24.4</li>
<li><a href="https://github.com/moment/moment/commit/f2006b647939466f4f403721b8c7816d844c038c"><code>f2006b6</code></a> Bump version to 2.24.4</li>
<li><a href="https://github.com/moment/moment/commit/536ad0c348f2f99009755698f491080757a48221"><code>536ad0c</code></a> Update changelog for 2.29.4</li>
<li><a href="https://github.com/moment/moment/commit/9a3b5894f3d5d602948ac8a02e4ee528a49ca3a3"><code>9a3b589</code></a> [bugfix] Fix redos in preprocessRFC2822 regex (<a href="https://github-redirect.dependabot.com/moment/moment/issues/6015">#6015</a>)</li>
<li><a href="https://github.com/moment/moment/commit/6374fd860aeff75e6c9d9d11540c6b22bc7ef175"><code>6374fd8</code></a> Merge branch 'master' into develop</li>
<li><a href="https://github.com/moment/moment/commit/b4e615307ee350b58ac9899e3587ce43972b0753"><code>b4e6153</code></a> Revert &quot;[bugfix] Fix redos in preprocessRFC2822 regex (<a href="https://github-redirect.dependabot.com/moment/moment/issues/6015">#6015</a>)&quot;</li>
<li><a href="https://github.com/moment/moment/commit/7aebb1617fc9bced87ab6bc4c317644019b23ce7"><code>7aebb16</code></a> [bugfix] Fix redos in preprocessRFC2822 regex (<a href="https://github-redirect.dependabot.com/moment/moment/issues/6015">#6015</a>)</li>
<li><a href="https://github.com/moment/moment/commit/57c90622e402c929504cc6d6f3de4ebe2a9ffc73"><code>57c9062</code></a> Build 2.29.3</li>
<li><a href="https://github.com/moment/moment/commit/aaf50b6bca4075f40a3372c291ae8072fb4e9dcf"><code>aaf50b6</code></a> Fixup release complaints</li>
<li><a href="https://github.com/moment/moment/commit/26f4aef9ca0b4c998107bf7e2cf1c33c30368d44"><code>26f4aef</code></a> Bump version to 2.29.3</li>
<li>Additional commits viewable in <a href="https://github.com/moment/moment/compare/2.29.2...2.29.4">compare view</a></li>
</ul>
</details>
<br />


[![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=moment&package-manager=npm_and_yarn&previous-version=2.29.2&new-version=2.29.4)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

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

You can disable automated security fix PRs for this repo from the [Security Alerts page](https://github.com/newrelic/node-newrelic-superagent/network/alerts).

</details>
--------------------------

* Updated CI to run against Node versions 14-18.

--- NOTES NEEDS REVIEW ---
Bumps [protobufjs](https://github.com/protobufjs/protobuf.js) from 6.11.2 to 6.11.3.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a href="https://github.com/protobufjs/protobuf.js/releases">protobufjs's releases</a>.</em></p>
<blockquote>
<h2>v6.11.3</h2>
<h3><a href="https://github.com/protobufjs/protobuf.js/compare/v6.11.2...v6.11.3">6.11.3</a> (2022-05-20)</h3>
<h3>Bug Fixes</h3>
<ul>
<li><strong>deps:</strong> use eslint 8.x (<a href="https://github-redirect.dependabot.com/protobufjs/protobuf.js/issues/1728">#1728</a>) (<a href="https://github.com/protobufjs/protobuf.js/commit/a8681ceab4763e706a848121a2dde56791b89eea">a8681ce</a>)</li>
<li>do not let setProperty change the prototype (<a href="https://github-redirect.dependabot.com/protobufjs/protobuf.js/issues/1731">#1731</a>) (<a href="https://github.com/protobufjs/protobuf.js/commit/b5f1391dff5515894830a6570e6d73f5511b2e8f">b5f1391</a>)</li>
</ul>
</blockquote>
</details>
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a href="https://github.com/protobufjs/protobuf.js/blob/v6.11.3/CHANGELOG.md">protobufjs's changelog</a>.</em></p>
<blockquote>
<h3><a href="https://github.com/protobufjs/protobuf.js/compare/v6.11.2...v6.11.3">6.11.3</a> (2022-05-20)</h3>
<h3>Bug Fixes</h3>
<ul>
<li><strong>deps:</strong> use eslint 8.x (<a href="https://github-redirect.dependabot.com/protobufjs/protobuf.js/issues/1728">#1728</a>) (<a href="https://github.com/protobufjs/protobuf.js/commit/a8681ceab4763e706a848121a2dde56791b89eea">a8681ce</a>)</li>
<li>do not let setProperty change the prototype (<a href="https://github-redirect.dependabot.com/protobufjs/protobuf.js/issues/1731">#1731</a>) (<a href="https://github.com/protobufjs/protobuf.js/commit/b5f1391dff5515894830a6570e6d73f5511b2e8f">b5f1391</a>)</li>
</ul>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/protobufjs/protobuf.js/commit/b130dfd4f06b642d4b7c3ccc9f3f9fb6a6e6ed0d"><code>b130dfd</code></a> chore(6.x): release 6.11.3 (<a href="https://github-redirect.dependabot.com/protobufjs/protobuf.js/issues/1737">#1737</a>)</li>
<li><a href="https://github.com/protobufjs/protobuf.js/commit/c2c17ae66810378fbad616964d80894794f1dad1"><code>c2c17ae</code></a> build: publish to main</li>
<li><a href="https://github.com/protobufjs/protobuf.js/commit/b2c6a5c76eccd4bbe445d13e3a04b949f344dd63"><code>b2c6a5c</code></a> build: run tests if ci label added (<a href="https://github-redirect.dependabot.com/protobufjs/protobuf.js/issues/1734">#1734</a>)</li>
<li><a href="https://github.com/protobufjs/protobuf.js/commit/a8681ceab4763e706a848121a2dde56791b89eea"><code>a8681ce</code></a> fix(deps): use eslint 8.x (<a href="https://github-redirect.dependabot.com/protobufjs/protobuf.js/issues/1728">#1728</a>)</li>
<li><a href="https://github.com/protobufjs/protobuf.js/commit/b5f1391dff5515894830a6570e6d73f5511b2e8f"><code>b5f1391</code></a> fix: do not let setProperty change the prototype (<a href="https://github-redirect.dependabot.com/protobufjs/protobuf.js/issues/1731">#1731</a>)</li>
<li><a href="https://github.com/protobufjs/protobuf.js/commit/7afd0a39f41d6df5fda6fa10c319cdf829027d3e"><code>7afd0a3</code></a> build: configure 6.x as default branch</li>
<li><a href="https://github.com/protobufjs/protobuf.js/commit/37285d0cdc8b20acacd0227daa2e577921de46a7"><code>37285d0</code></a> build: configure backports</li>
<li>See full diff in <a href="https://github.com/protobufjs/protobuf.js/compare/v6.11.2...v6.11.3">compare view</a></li>
</ul>
</details>
<br />


[![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=protobufjs&package-manager=npm_and_yarn&previous-version=6.11.2&new-version=6.11.3)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

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

You can disable automated security fix PRs for this repo from the [Security Alerts page](https://github.com/newrelic/node-newrelic-superagent/network/alerts).

</details>
--------------------------

--- NOTES NEEDS REVIEW ---
Bumps [async](https://github.com/caolan/async) from 2.6.3 to 2.6.4.
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a href="https://github.com/caolan/async/blob/v2.6.4/CHANGELOG.md">async's changelog</a>.</em></p>
<blockquote>
<h1>v2.6.4</h1>
<ul>
<li>Fix potential prototype pollution exploit (<a href="https://github-redirect.dependabot.com/caolan/async/issues/1828">#1828</a>)</li>
</ul>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/caolan/async/commit/c6bdaca4f9175c14fc655d3783c6af6a883e6514"><code>c6bdaca</code></a> Version 2.6.4</li>
<li><a href="https://github.com/caolan/async/commit/8870da9d5022bab310413041b4079e10db3980b7"><code>8870da9</code></a> Update built files</li>
<li><a href="https://github.com/caolan/async/commit/4df6754ef4e96a742956df8782fee27242a2ea12"><code>4df6754</code></a> update changelog</li>
<li><a href="https://github.com/caolan/async/commit/8f7f90342a6571ba1c197d747ebed30c368096d2"><code>8f7f903</code></a> Fix prototype pollution vulnerability (<a href="https://github-redirect.dependabot.com/caolan/async/issues/1828">#1828</a>)</li>
<li>See full diff in <a href="https://github.com/caolan/async/compare/v2.6.3...v2.6.4">compare view</a></li>
</ul>
</details>
<details>
<summary>Maintainer changes</summary>
<p>This version was pushed to npm by <a href="https://www.npmjs.com/~hargasinski">hargasinski</a>, a new releaser for async since your current version.</p>
</details>
<br />


[![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=async&package-manager=npm_and_yarn&previous-version=2.6.3&new-version=2.6.4)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

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

You can disable automated security fix PRs for this repo from the [Security Alerts page](https://github.com/newrelic/node-newrelic-superagent/network/alerts).

</details>
--------------------------

* Bumped tap to ^16.0.1.

* Resolved dev-only audit warnings.

--- NOTES NEEDS REVIEW ---
Bumps [moment](https://github.com/moment/moment) from 2.29.1 to 2.29.2.
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a href="https://github.com/moment/moment/blob/develop/CHANGELOG.md">moment's changelog</a>.</em></p>
<blockquote>
<h3>2.29.2 <a href="https://gist.github.com/ichernev/1904b564f6679d9aac1ae08ce13bc45c">See full changelog</a></h3>
<ul>
<li>Release Apr 3 2022</li>
</ul>
<p>Address <a href="https://github.com/advisories/GHSA-8hfj-j24r-96c4">https://github.com/advisories/GHSA-8hfj-j24r-96c4</a></p>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/moment/moment/commit/75e2ac573e8cd62086a6bc6dc1b8d271e2804391"><code>75e2ac5</code></a> Build 2.29.2</li>
<li><a href="https://github.com/moment/moment/commit/5a2987758edc7d413d1248737d9d0d1b65a70450"><code>5a29877</code></a> Bump version to 2.29.2</li>
<li><a href="https://github.com/moment/moment/commit/4fd847b7a8c7065d88ba0a64b727660190dd45d7"><code>4fd847b</code></a> Update changelog for 2.29.2</li>
<li><a href="https://github.com/moment/moment/commit/4211bfc8f15746be4019bba557e29a7ba83d54c5"><code>4211bfc</code></a> [bugfix] Avoid loading path-looking locales from fs</li>
<li><a href="https://github.com/moment/moment/commit/f2a813afcfd0dd6e63812ea74c46ecc627f6a6a6"><code>f2a813a</code></a> [misc] Fix indentation (according to prettier)</li>
<li><a href="https://github.com/moment/moment/commit/7a10de889de64c2519f894a84a98030bec5022d9"><code>7a10de8</code></a> [test] Avoid hours around DST</li>
<li><a href="https://github.com/moment/moment/commit/e96809208c9d1b1bbe22d605e76985770024de42"><code>e968092</code></a> [locale] ar-ly: fix locale name (<a href="https://github-redirect.dependabot.com/moment/moment/issues/5828">#5828</a>)</li>
<li><a href="https://github.com/moment/moment/commit/53d7ee6ad8c60c891571c7085db91831bbc095b4"><code>53d7ee6</code></a> [misc] fix builds (<a href="https://github-redirect.dependabot.com/moment/moment/issues/5836">#5836</a>)</li>
<li><a href="https://github.com/moment/moment/commit/52019f1dda47c3e598aaeaa4ac89d5a574641604"><code>52019f1</code></a> [misc] Specify length of toArray return type (<a href="https://github-redirect.dependabot.com/moment/moment/issues/5766">#5766</a>)</li>
<li><a href="https://github.com/moment/moment/commit/0dcaaa689d02dde824029b09ab6aa64ff351ee2e"><code>0dcaaa6</code></a> [locale] tr: update translation of Monday and Saturday (<a href="https://github-redirect.dependabot.com/moment/moment/issues/5756">#5756</a>)</li>
<li>Additional commits viewable in <a href="https://github.com/moment/moment/compare/2.29.1...2.29.2">compare view</a></li>
</ul>
</details>
<br />


[![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=moment&package-manager=npm_and_yarn&previous-version=2.29.1&new-version=2.29.2)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

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

You can disable automated security fix PRs for this repo from the [Security Alerts page](https://github.com/newrelic/node-newrelic-superagent/network/alerts).

</details>
--------------------------

### v5.1.1 (2022-02-28)

* Removed versioned tests from npm artifact.

* Fixed link to discuss.newrelic.com in README

* Resolved several dev-dependency audit warnings.

* Bumped `tap` to ^15.1.6."

* Pinned version of `superagent` to `<7.1.0` until author fixes bug.

* Updated `add-to-board` to use org level `NODE_AGENT_GH_TOKEN`

* Updated semver ranges to exclude `7.1.0` as it is a broken version.

### v5.1.0 (2022-01-11)

* Added workflow to automate preparing release notes by reusing the newrelic/node-newrelic/.github/workflows/prep-release.yml@main workflow from agent repository.

* Added job to automatically add issues/pr to Node.js Engineering board

* Added a pre-commit hook to check if package.json changes and run oss third-party manifest and oss third-party notices. This will ensure the third_party_manifest.json and THIRD_PARTY_NOTICES.md are up to date.
 * Added a pre-commit hook to run linting via husky

* Added @newrelic/eslint-config to rely on a centralized eslint ruleset.

* Upgraded setup-node CI job to v2 and changed the linting node version to lts/* for future proofing

### 5.0.1 (2021-07-20)
* Added versioned tests to the files list within package.json

### 5.0.0 (2021-07-20)

* **BREAKING** Removed support for Node 10.

  The minimum supported version is now Node v12. For further information on our support policy, see: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent.

* Added support for Node 16.
* Added files list to package.json instead of using `.npmignore` for module publishing.
* Removed `methods` package and rely on `http.METHODS` and lower-case ourselves.
* Bumped `@newrelic/test-utilities` to ^5.1.0.
* Bumped `tap` to ^15.0.9.

### 4.0.0 (2020-11-02):

* Added Node v14.x to CI.
* Removed Node v8.x from CI.
* Updates to README, guidelines, and templates to match New Relic OSS template.
* Bumped node-test-utilities version to ^4.0.0.

### 3.0.0 (2020-07-16):

* Updated to Apache 2.0 license.
* Bumped minimum peer dependency (and dev dependency) of newrelic (agent) to 6.11 for license matching.
* Added third party notices file and metadata for dependencies.
* Updated readme with more detail.
* Added issue templates for bugs and enhancements.
* Added code of conduct file.
* Added contributing guide.
* Added pull request template.
* Migrated CI to GitHub Actions.
* Added copyright headers to all source files.
* Added repository property to package.json.
* Removed Coveralls integration.
* Bumped minimum versions of tap, eslint and @newrelic/test-utilities.
* Added .vscode to .gitignore.
* Added additional items to .npmignore.

### 2.0.1 (2020-02-26):

* Support the fixed segment naming in Node 8

### 2.0.0 (2019-10-28):

* **BREAKING** Removed support for Node 6, 7, and 9.

  The minimum supported version is now Node v8. For further information on our support policy, see: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent.

* Added support for Node v12.

### 1.0.3 (2019-03-04):

* Added missing `LICENSE` file.

  Thanks @jreidgreer for the catch!

### 1.0.2 (2019-01-07):

* Updated `@newrelic/test-utilities` dependency to v3.0.0.

### 1.0.1 (2018-11-20):
* Updated versioned test ranges to account for superagent v4 dropping support
  for node versions <6

* Pinned tap version to 11.

### 1.0.0 (2018-09-10):

* Initial release of super agent instrumentation.

  Fixes context state management for callbacks and promises.
