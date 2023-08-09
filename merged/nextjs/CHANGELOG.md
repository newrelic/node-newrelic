### v0.6.0 (2023-08-09)

* **BREAKING** - Dropped support for Node 14.

* Updated instrumentation to no longer record spans for middleware execution.
 * Updated instrumentation for api requests to properly extract the params and page.

* Updated CI to run against versions 16-20.

* Updated semver and word-wrap to resolve CVEs.

--- NOTES NEEDS REVIEW ---
Bumps [protobufjs](https://github.com/protobufjs/protobuf.js) from 7.2.3 to 7.2.4.
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
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/protobufjs/protobuf.js/commit/42e5a9ca85044800b16e193020e1d4d2e6b4010c"><code>42e5a9c</code></a> chore: release master (<a href="https://redirect.github.com/protobufjs/protobuf.js/issues/1900">#1900</a>)</li>
<li><a href="https://github.com/protobufjs/protobuf.js/commit/e66379f451b0393c27d87b37fa7d271619e16b0d"><code>e66379f</code></a> fix: do not let setProperty change the prototype (<a href="https://redirect.github.com/protobufjs/protobuf.js/issues/1899">#1899</a>)</li>
<li>See full diff in <a href="https://github.com/protobufjs/protobuf.js/compare/protobufjs-v7.2.3...protobufjs-v7.2.4">compare view</a></li>
</ul>
</details>
<br />


[![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=protobufjs&package-manager=npm_and_yarn&previous-version=7.2.3&new-version=7.2.4)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

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
You can disable automated security fix PRs for this repo from the [Security Alerts page](https://github.com/newrelic/newrelic-node-nextjs/network/alerts).

</details>
--------------------------

--- NOTES NEEDS REVIEW ---
Bumps [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) and [@aws-sdk/client-lambda](https://github.com/aws/aws-sdk-js-v3/tree/HEAD/clients/client-lambda). These dependencies needed to be updated together.
Updates `fast-xml-parser` from 4.2.4 to 4.2.5
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a href="https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/CHANGELOG.md">fast-xml-parser's changelog</a>.</em></p>
<blockquote>
<p>Note: If you find missing information about particular minor version, that version must have been changed without any functional change in this library.</p>
<p><strong>4.2.5 / 2023-06-22</strong></p>
<ul>
<li>change code implementation</li>
</ul>
<p><strong>4.2.4 / 2023-06-06</strong></p>
<ul>
<li>fix security bug</li>
</ul>
<p><strong>4.2.3 / 2023-06-05</strong></p>
<ul>
<li>fix security bug</li>
</ul>
<p><strong>4.2.2 / 2023-04-18</strong></p>
<ul>
<li>fix <a href="https://redirect.github.com/NaturalIntelligence/fast-xml-parser/issues/562">#562</a>: fix unpaired tag when it comes in last of a nested tag. Also throw error when unpaired tag is used as closing tag</li>
</ul>
<p><strong>4.2.1 / 2023-04-18</strong></p>
<ul>
<li>fix: jpath after unpaired tags</li>
</ul>
<p><strong>4.2.0 / 2023-04-09</strong></p>
<ul>
<li>support <code>updateTag</code> parser property</li>
</ul>
<p><strong>4.1.4 / 2023-04-08</strong></p>
<ul>
<li>update typings to let user create XMLBuilder instance without options (<a href="https://redirect.github.com/NaturalIntelligence/fast-xml-parser/issues/556">#556</a>) (By <a href="https://github.com/omggga">Patrick</a>)</li>
<li>fix: IsArray option isn't parsing tags with 0 as value correctly <a href="https://redirect.github.com/NaturalIntelligence/fast-xml-parser/issues/490">#490</a> (<a href="https://redirect.github.com/NaturalIntelligence/fast-xml-parser/issues/557">#557</a>) (By <a href="https://github.com/p-kuen">Aleksandr Murashkin</a>)</li>
<li>feature: support <code>oneListGroup</code> to group repeated children tags udder single group</li>
</ul>
<p><strong>4.1.3 / 2023-02-26</strong></p>
<ul>
<li>fix <a href="https://redirect.github.com/NaturalIntelligence/fast-xml-parser/issues/546">#546</a>: Support complex entity value</li>
</ul>
<p><strong>4.1.2 / 2023-02-12</strong></p>
<ul>
<li>Security Fix</li>
</ul>
<p><strong>4.1.1 / 2023-02-03</strong></p>
<ul>
<li>Fix <a href="https://redirect.github.com/NaturalIntelligence/fast-xml-parser/issues/540">#540</a>: ignoreAttributes breaks unpairedTags</li>
<li>Refactor XML builder code</li>
</ul>
<p><strong>4.1.0 / 2023-02-02</strong></p>
<ul>
<li>Fix '<!-- raw HTML omitted -->' in DTD comment throwing an error. (<a href="https://redirect.github.com/NaturalIntelligence/fast-xml-parser/issues/533">#533</a>) (By <a href="https://github.com/Cwazywierdo">Adam Baker</a>)</li>
<li>Set &quot;eNotation&quot; to 'true' as default</li>
</ul>
<p><strong>4.0.15 / 2023-01-25</strong></p>
<ul>
<li>make &quot;eNotation&quot; optional</li>
</ul>
<p><strong>4.0.14 / 2023-01-22</strong></p>
<ul>
<li>fixed: add missed typing &quot;eNotation&quot; to parse values</li>
</ul>
<p><strong>4.0.13 / 2023-01-07</strong></p>
<ul>
<li>preserveorder formatting (By <a href="https://github.com/mdeknowis">mdeknowis</a>)</li>
<li>support <code>transformAttributeName</code> (By <a href="https://github.com/erkie">Erik Rothoff Andersson</a>)</li>
</ul>
<p><strong>4.0.12 / 2022-11-19</strong></p>
<!-- raw HTML omitted -->
</blockquote>
<p>... (truncated)</p>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/NaturalIntelligence/fast-xml-parser/commit/643816d67b4c8b85ff97ba83e9bf41d23446c963"><code>643816d</code></a> update package details</li>
<li><a href="https://github.com/NaturalIntelligence/fast-xml-parser/commit/cc73065e1469147a0104dc122b0cdf6724354446"><code>cc73065</code></a> Remove unused code (<a href="https://redirect.github.com/NaturalIntelligence/fast-xml-parser/issues/587">#587</a>)</li>
<li><a href="https://github.com/NaturalIntelligence/fast-xml-parser/commit/9a880b887916855c3a510869fd1ee268d7fe58b1"><code>9a880b8</code></a> Merge pull request from GHSA-gpv5-7x3g-ghjv</li>
<li>See full diff in <a href="https://github.com/NaturalIntelligence/fast-xml-parser/compare/v4.2.4...v4.2.5">compare view</a></li>
</ul>
</details>
<br />

Updates `@aws-sdk/client-lambda` from 3.358.0 to 3.359.0
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a href="https://github.com/aws/aws-sdk-js-v3/releases"><code>@​aws-sdk/client-lambda</code>'s releases</a>.</em></p>
<blockquote>
<h2>v3.359.0</h2>
<h4>3.359.0(2023-06-23)</h4>
<h5>Chores</h5>
<ul>
<li><strong>fast-xml-parser:</strong>  bump to 4.2.5 (<a href="https://redirect.github.com/aws/aws-sdk-js-v3/pull/4879">#4879</a>) (<a href="https://github.com/aws/aws-sdk-js-v3/commit/61cadba28cf6ee34a313aa2e5e0d3984e55df000">61cadba2</a>)</li>
</ul>
<h5>Documentation Changes</h5>
<ul>
<li><strong>client-verifiedpermissions:</strong>  Added improved descriptions and new code samples to SDK documentation. (<a href="https://github.com/aws/aws-sdk-js-v3/commit/2eb1c55023b1c983e68982c70924a4bd229add47">2eb1c550</a>)</li>
<li><strong>client-fsx:</strong>  Update to Amazon FSx documentation. (<a href="https://github.com/aws/aws-sdk-js-v3/commit/daf0eeaa35965a5b816ec5839c2f0613e3f1e811">daf0eeaa</a>)</li>
<li><strong>client-rds:</strong>  Documentation improvements for create, describe, and modify DB clusters and DB instances. (<a href="https://github.com/aws/aws-sdk-js-v3/commit/8e56fb35705643d2d1e4b99534cea165d076308b">8e56fb35</a>)</li>
</ul>
<h5>New Features</h5>
<ul>
<li><strong>client-devops-guru:</strong>  This release adds support for encryption via customer managed keys. (<a href="https://github.com/aws/aws-sdk-js-v3/commit/8973478646dc64499325e67967b55efbda1fd3e8">89734786</a>)</li>
</ul>
</blockquote>
</details>
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a href="https://github.com/aws/aws-sdk-js-v3/blob/main/clients/client-lambda/CHANGELOG.md"><code>@​aws-sdk/client-lambda</code>'s changelog</a>.</em></p>
<blockquote>
<h1><a href="https://github.com/aws/aws-sdk-js-v3/compare/v3.358.0...v3.359.0">3.359.0</a> (2023-06-23)</h1>
<p><strong>Note:</strong> Version bump only for package <code>@​aws-sdk/client-lambda</code></p>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/aws/aws-sdk-js-v3/commit/e5d4fa851c9061bb71449280f667c2a67726d34c"><code>e5d4fa8</code></a> Publish v3.359.0</li>
<li>See full diff in <a href="https://github.com/aws/aws-sdk-js-v3/commits/v3.359.0/clients/client-lambda">compare view</a></li>
</ul>
</details>
<br />


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
You can disable automated security fix PRs for this repo from the [Security Alerts page](https://github.com/newrelic/newrelic-node-nextjs/network/alerts).

</details>
--------------------------

## Changes included in this PR

- Changes to the following files to upgrade the vulnerable dependencies to a fixed version:
    - package.json
    - package-lock.json

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
