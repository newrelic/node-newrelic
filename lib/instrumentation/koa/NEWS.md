### v9.0.0 (2024-03-12)

* Updated koa instrumentation to construct specs at instrumentation

--- NOTES NEEDS REVIEW ---
Bumps [follow-redirects](https://github.com/follow-redirects/follow-redirects) from 1.15.3 to 1.15.4.
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/follow-redirects/follow-redirects/commit/65858205e59f1e23c9bf173348a7a7cbb8ac47f5"><code>6585820</code></a> Release version 1.15.4 of the npm package.</li>
<li><a href="https://github.com/follow-redirects/follow-redirects/commit/7a6567e16dfa9ad18a70bfe91784c28653fbf19d"><code>7a6567e</code></a> Disallow bracketed hostnames.</li>
<li><a href="https://github.com/follow-redirects/follow-redirects/commit/05629af696588b90d64e738bc2e809a97a5f92fc"><code>05629af</code></a> Prefer native URL instead of deprecated url.parse.</li>
<li><a href="https://github.com/follow-redirects/follow-redirects/commit/1cba8e85fa73f563a439fe460cf028688e4358df"><code>1cba8e8</code></a> Prefer native URL instead of legacy url.resolve.</li>
<li><a href="https://github.com/follow-redirects/follow-redirects/commit/72bc2a4229bc18dc9fbd57c60579713e6264cb92"><code>72bc2a4</code></a> Simplify _processResponse error handling.</li>
<li><a href="https://github.com/follow-redirects/follow-redirects/commit/3d42aecdca39b144a0a2f27ea134b4cf67dd796a"><code>3d42aec</code></a> Add bracket tests.</li>
<li><a href="https://github.com/follow-redirects/follow-redirects/commit/bcbb096b32686ecad6cd34235358ed6f2217d4f0"><code>bcbb096</code></a> Do not directly set Error properties.</li>
<li>See full diff in <a href="https://github.com/follow-redirects/follow-redirects/compare/v1.15.3...v1.15.4">compare view</a></li>
</ul>
</details>
<br />


[![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=follow-redirects&package-manager=npm_and_yarn&previous-version=1.15.3&new-version=1.15.4)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

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
- `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the specified dependency
- `@dependabot ignore this major version` will close this PR and stop Dependabot creating any more for this major version (unless you reopen the PR or upgrade to it yourself)
- `@dependabot ignore this minor version` will close this PR and stop Dependabot creating any more for this minor version (unless you reopen the PR or upgrade to it yourself)
- `@dependabot ignore this dependency` will close this PR and stop Dependabot creating any more for this dependency (unless you reopen the PR or upgrade to it yourself)
You can disable automated security fix PRs for this repo from the [Security Alerts page](https://github.com/newrelic/node-newrelic-koa/network/alerts).

</details>
--------------------------

--- NOTES NEEDS REVIEW ---
Bumps [axios](https://github.com/axios/axios) to 1.6.0 and updates ancestor dependency [newrelic](https://github.com/newrelic/node-newrelic). These dependencies need to be updated together.

Updates `axios` from 0.21.4 to 1.6.0
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a href="https://github.com/axios/axios/releases">axios's releases</a>.</em></p>
<blockquote>
<h2>Release v1.6.0</h2>
<h2>Release notes:</h2>
<h3>Bug Fixes</h3>
<ul>
<li><strong>CSRF:</strong> fixed CSRF vulnerability CVE-2023-45857 (<a href="https://redirect.github.com/axios/axios/issues/6028">#6028</a>) (<a href="https://github.com/axios/axios/commit/96ee232bd3ee4de2e657333d4d2191cd389e14d0">96ee232</a>)</li>
<li><strong>dns:</strong> fixed lookup function decorator to work properly in node v20; (<a href="https://redirect.github.com/axios/axios/issues/6011">#6011</a>) (<a href="https://github.com/axios/axios/commit/5aaff532a6b820bb9ab6a8cd0f77131b47e2adb8">5aaff53</a>)</li>
<li><strong>types:</strong> fix AxiosHeaders types; (<a href="https://redirect.github.com/axios/axios/issues/5931">#5931</a>) (<a href="https://github.com/axios/axios/commit/a1c8ad008b3c13d53e135bbd0862587fb9d3fc09">a1c8ad0</a>)</li>
</ul>
<h3>PRs</h3>
<ul>
<li>CVE 2023 45857 ( <a href="https://api.github.com/repos/axios/axios/pulls/6028">#6028</a> )</li>
</ul>
<pre><code>
⚠️ Critical vulnerability fix. See https://security.snyk.io/vuln/SNYK-JS-AXIOS-6032459
</code></pre>
<h3>Contributors to this release</h3>
<ul>
<li><!-- raw HTML omitted --> <a href="https://github.com/DigitalBrainJS" title="+449/-114 ([#6032](https://github.com/axios/axios/issues/6032) [#6021](https://github.com/axios/axios/issues/6021) [#6011](https://github.com/axios/axios/issues/6011) [#5932](https://github.com/axios/axios/issues/5932) [#5931](https://github.com/axios/axios/issues/5931) )">Dmitriy Mozgovoy</a></li>
<li><!-- raw HTML omitted --> <a href="https://github.com/valentin-panov" title="+4/-4 ([#6028](https://github.com/axios/axios/issues/6028) )">Valentin Panov</a></li>
<li><!-- raw HTML omitted --> <a href="https://github.com/therealrinku" title="+1/-1 ([#5889](https://github.com/axios/axios/issues/5889) )">Rinku Chaudhari</a></li>
</ul>
<h2>Release v1.5.1</h2>
<h2>Release notes:</h2>
<h3>Bug Fixes</h3>
<ul>
<li><strong>adapters:</strong> improved adapters loading logic to have clear error messages; (<a href="https://redirect.github.com/axios/axios/issues/5919">#5919</a>) (<a href="https://github.com/axios/axios/commit/e4107797a7a1376f6209fbecfbbce73d3faa7859">e410779</a>)</li>
<li><strong>formdata:</strong> fixed automatic addition of the <code>Content-Type</code> header for FormData in non-browser environments; (<a href="https://redirect.github.com/axios/axios/issues/5917">#5917</a>) (<a href="https://github.com/axios/axios/commit/bc9af51b1886d1b3529617702f2a21a6c0ed5d92">bc9af51</a>)</li>
<li><strong>headers:</strong> allow <code>content-encoding</code> header to handle case-insensitive values (<a href="https://redirect.github.com/axios/axios/issues/5890">#5890</a>) (<a href="https://redirect.github.com/axios/axios/issues/5892">#5892</a>) (<a href="https://github.com/axios/axios/commit/4c89f25196525e90a6e75eda9cb31ae0a2e18acd">4c89f25</a>)</li>
<li><strong>types:</strong> removed duplicated code (<a href="https://github.com/axios/axios/commit/9e6205630e1c9cf863adf141c0edb9e6d8d4b149">9e62056</a>)</li>
</ul>
<h3>Contributors to this release</h3>
<ul>
<li><!-- raw HTML omitted --> <a href="https://github.com/DigitalBrainJS" title="+89/-18 ([#5919](https://github.com/axios/axios/issues/5919) [#5917](https://github.com/axios/axios/issues/5917) )">Dmitriy Mozgovoy</a></li>
<li><!-- raw HTML omitted --> <a href="https://github.com/DavidJDallas" title="+11/-5 ()">David Dallas</a></li>
<li><!-- raw HTML omitted --> <a href="https://github.com/fb-sean" title="+2/-8 ()">Sean Sattler</a></li>
<li><!-- raw HTML omitted --> <a href="https://github.com/0o001" title="+4/-4 ()">Mustafa Ateş Uzun</a></li>
<li><!-- raw HTML omitted --> <a href="https://github.com/sfc-gh-pmotacki" title="+2/-1 ([#5892](https://github.com/axios/axios/issues/5892) )">Przemyslaw Motacki</a></li>
<li><!-- raw HTML omitted --> <a href="https://github.com/Cadienvan" title="+1/-1 ()">Michael Di Prisco</a></li>
</ul>
<h2>Release v1.5.0</h2>
<h2>Release notes:</h2>
<h3>Bug Fixes</h3>
<ul>
<li><strong>adapter:</strong> make adapter loading error more clear by using platform-specific adapters explicitly (<a href="https://redirect.github.com/axios/axios/issues/5837">#5837</a>) (<a href="https://github.com/axios/axios/commit/9a414bb6c81796a95c6c7fe668637825458e8b6d">9a414bb</a>)</li>
<li><strong>dns:</strong> fixed <code>cacheable-lookup</code> integration; (<a href="https://redirect.github.com/axios/axios/issues/5836">#5836</a>) (<a href="https://github.com/axios/axios/commit/b3e327dcc9277bdce34c7ef57beedf644b00d628">b3e327d</a>)</li>
<li><strong>headers:</strong> added support for setting header names that overlap with class methods; (<a href="https://redirect.github.com/axios/axios/issues/5831">#5831</a>) (<a href="https://github.com/axios/axios/commit/d8b4ca0ea5f2f05efa4edfe1e7684593f9f68273">d8b4ca0</a>)</li>
<li><strong>headers:</strong> fixed common Content-Type header merging; (<a href="https://redirect.github.com/axios/axios/issues/5832">#5832</a>) (<a href="https://github.com/axios/axios/commit/8fda2766b1e6bcb72c3fabc146223083ef13ce17">8fda276</a>)</li>
</ul>
<h3>Features</h3>
<!-- raw HTML omitted -->
</blockquote>
<p>... (truncated)</p>
</details>
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a href="https://github.com/axios/axios/blob/v1.x/CHANGELOG.md">axios's changelog</a>.</em></p>
<blockquote>
<h1><a href="https://github.com/axios/axios/compare/v1.5.1...v1.6.0">1.6.0</a> (2023-10-26)</h1>
<h3>Bug Fixes</h3>
<ul>
<li><strong>CSRF:</strong> fixed CSRF vulnerability CVE-2023-45857 (<a href="https://redirect.github.com/axios/axios/issues/6028">#6028</a>) (<a href="https://github.com/axios/axios/commit/96ee232bd3ee4de2e657333d4d2191cd389e14d0">96ee232</a>)</li>
<li><strong>dns:</strong> fixed lookup function decorator to work properly in node v20; (<a href="https://redirect.github.com/axios/axios/issues/6011">#6011</a>) (<a href="https://github.com/axios/axios/commit/5aaff532a6b820bb9ab6a8cd0f77131b47e2adb8">5aaff53</a>)</li>
<li><strong>types:</strong> fix AxiosHeaders types; (<a href="https://redirect.github.com/axios/axios/issues/5931">#5931</a>) (<a href="https://github.com/axios/axios/commit/a1c8ad008b3c13d53e135bbd0862587fb9d3fc09">a1c8ad0</a>)</li>
</ul>
<h3>PRs</h3>
<ul>
<li>CVE 2023 45857 ( <a href="https://api.github.com/repos/axios/axios/pulls/6028">#6028</a> )</li>
</ul>
<pre><code>
⚠️ Critical vulnerability fix. See https://security.snyk.io/vuln/SNYK-JS-AXIOS-6032459
</code></pre>
<h3>Contributors to this release</h3>
<ul>
<li><!-- raw HTML omitted --> <a href="https://github.com/DigitalBrainJS" title="+449/-114 ([#6032](https://github.com/axios/axios/issues/6032) [#6021](https://github.com/axios/axios/issues/6021) [#6011](https://github.com/axios/axios/issues/6011) [#5932](https://github.com/axios/axios/issues/5932) [#5931](https://github.com/axios/axios/issues/5931) )">Dmitriy Mozgovoy</a></li>
<li><!-- raw HTML omitted --> <a href="https://github.com/valentin-panov" title="+4/-4 ([#6028](https://github.com/axios/axios/issues/6028) )">Valentin Panov</a></li>
<li><!-- raw HTML omitted --> <a href="https://github.com/therealrinku" title="+1/-1 ([#5889](https://github.com/axios/axios/issues/5889) )">Rinku Chaudhari</a></li>
</ul>
<h2><a href="https://github.com/axios/axios/compare/v1.5.0...v1.5.1">1.5.1</a> (2023-09-26)</h2>
<h3>Bug Fixes</h3>
<ul>
<li><strong>adapters:</strong> improved adapters loading logic to have clear error messages; (<a href="https://redirect.github.com/axios/axios/issues/5919">#5919</a>) (<a href="https://github.com/axios/axios/commit/e4107797a7a1376f6209fbecfbbce73d3faa7859">e410779</a>)</li>
<li><strong>formdata:</strong> fixed automatic addition of the <code>Content-Type</code> header for FormData in non-browser environments; (<a href="https://redirect.github.com/axios/axios/issues/5917">#5917</a>) (<a href="https://github.com/axios/axios/commit/bc9af51b1886d1b3529617702f2a21a6c0ed5d92">bc9af51</a>)</li>
<li><strong>headers:</strong> allow <code>content-encoding</code> header to handle case-insensitive values (<a href="https://redirect.github.com/axios/axios/issues/5890">#5890</a>) (<a href="https://redirect.github.com/axios/axios/issues/5892">#5892</a>) (<a href="https://github.com/axios/axios/commit/4c89f25196525e90a6e75eda9cb31ae0a2e18acd">4c89f25</a>)</li>
<li><strong>types:</strong> removed duplicated code (<a href="https://github.com/axios/axios/commit/9e6205630e1c9cf863adf141c0edb9e6d8d4b149">9e62056</a>)</li>
</ul>
<h3>Contributors to this release</h3>
<ul>
<li><!-- raw HTML omitted --> <a href="https://github.com/DigitalBrainJS" title="+89/-18 ([#5919](https://github.com/axios/axios/issues/5919) [#5917](https://github.com/axios/axios/issues/5917) )">Dmitriy Mozgovoy</a></li>
<li><!-- raw HTML omitted --> <a href="https://github.com/DavidJDallas" title="+11/-5 ()">David Dallas</a></li>
<li><!-- raw HTML omitted --> <a href="https://github.com/fb-sean" title="+2/-8 ()">Sean Sattler</a></li>
<li><!-- raw HTML omitted --> <a href="https://github.com/0o001" title="+4/-4 ()">Mustafa Ateş Uzun</a></li>
<li><!-- raw HTML omitted --> <a href="https://github.com/sfc-gh-pmotacki" title="+2/-1 ([#5892](https://github.com/axios/axios/issues/5892) )">Przemyslaw Motacki</a></li>
<li><!-- raw HTML omitted --> <a href="https://github.com/Cadienvan" title="+1/-1 ()">Michael Di Prisco</a></li>
</ul>
<h3>PRs</h3>
<ul>
<li>CVE 2023 45857 ( <a href="https://api.github.com/repos/axios/axios/pulls/6028">#6028</a> )</li>
</ul>
<pre><code>
⚠️ Critical vulnerability fix. See https://security.snyk.io/vuln/SNYK-JS-AXIOS-6032459
</code></pre>
<h1><a href="https://github.com/axios/axios/compare/v1.4.0...v1.5.0">1.5.0</a> (2023-08-26)</h1>
<!-- raw HTML omitted -->
</blockquote>
<p>... (truncated)</p>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/axios/axios/commit/f7adacdbaa569281253c8cfc623ad3f4dc909c60"><code>f7adacd</code></a> chore(release): v1.6.0 (<a href="https://redirect.github.com/axios/axios/issues/6031">#6031</a>)</li>
<li><a href="https://github.com/axios/axios/commit/9917e67cbb6c157382863bad8c741de58e3f3c2b"><code>9917e67</code></a> chore(ci): fix release-it arg; (<a href="https://redirect.github.com/axios/axios/issues/6032">#6032</a>)</li>
<li><a href="https://github.com/axios/axios/commit/96ee232bd3ee4de2e657333d4d2191cd389e14d0"><code>96ee232</code></a> fix(CSRF): fixed CSRF vulnerability CVE-2023-45857 (<a href="https://redirect.github.com/axios/axios/issues/6028">#6028</a>)</li>
<li><a href="https://github.com/axios/axios/commit/7d45ab2e2ad6e59f5475e39afd4b286b1f393fc0"><code>7d45ab2</code></a> chore(tests): fixed tests to pass in node v19 and v20 with <code>keep-alive</code> enabl...</li>
<li><a href="https://github.com/axios/axios/commit/5aaff532a6b820bb9ab6a8cd0f77131b47e2adb8"><code>5aaff53</code></a> fix(dns): fixed lookup function decorator to work properly in node v20; (<a href="https://redirect.github.com/axios/axios/issues/6011">#6011</a>)</li>
<li><a href="https://github.com/axios/axios/commit/a48a63ad823fc20e5a6a705f05f09842ca49f48c"><code>a48a63a</code></a> chore(docs): added AxiosHeaders docs; (<a href="https://redirect.github.com/axios/axios/issues/5932">#5932</a>)</li>
<li><a href="https://github.com/axios/axios/commit/a1c8ad008b3c13d53e135bbd0862587fb9d3fc09"><code>a1c8ad0</code></a> fix(types): fix AxiosHeaders types; (<a href="https://redirect.github.com/axios/axios/issues/5931">#5931</a>)</li>
<li><a href="https://github.com/axios/axios/commit/2ac731d60545ba5c4202c25fd2e732ddd8297d82"><code>2ac731d</code></a> chore(docs): update readme.md (<a href="https://redirect.github.com/axios/axios/issues/5889">#5889</a>)</li>
<li><a href="https://github.com/axios/axios/commit/88fb52b5fad7aabab0532e7ad086c5f1b0178905"><code>88fb52b</code></a> chore(release): v1.5.1 (<a href="https://redirect.github.com/axios/axios/issues/5920">#5920</a>)</li>
<li><a href="https://github.com/axios/axios/commit/e4107797a7a1376f6209fbecfbbce73d3faa7859"><code>e410779</code></a> fix(adapters): improved adapters loading logic to have clear error messages; ...</li>
<li>Additional commits viewable in <a href="https://github.com/axios/axios/compare/v0.21.4...v1.6.0">compare view</a></li>
</ul>
</details>
<br />

Updates `newrelic` from 11.0.0 to 11.5.0
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a href="https://github.com/newrelic/node-newrelic/releases">newrelic's releases</a>.</em></p>
<blockquote>
<h2>v11.5.0</h2>
<h4>Miscellaneous chores</h4>
<ul>
<li><strong>dep:</strong> Updated <code>@​newrelic/security-agent</code> to v0.4.0 (<a href="https://redirect.github.com/newrelic/node-newrelic/pull/1837">#1837</a>) (<a href="https://github.com/newrelic/node-newrelic/commit/fb06ac930269b784fcea6c2b8ea5e54158677ec4">fb06ac9</a>)</li>
</ul>
<h4>Continuous integration</h4>
<ul>
<li>Disable fail-fast on nightly versioned test runs (<a href="https://redirect.github.com/newrelic/node-newrelic/pull/1836">#1836</a>) (<a href="https://github.com/newrelic/node-newrelic/commit/fe1b4fc4c00b2e4ea4c7b6fa5a8c1cd6e864145a">fe1b4fc</a>)</li>
</ul>
<h3>Support statement:</h3>
<p>We recommend updating to the latest agent version as soon as it's available. If you can't upgrade to the latest version, update your agents to a version no more than 90 days old. Read more about keeping agents up to date. (<a href="https://docs.newrelic.com/docs/new-relic-solutions/new-relic-one/install-configure/update-new-relic-agent/">https://docs.newrelic.com/docs/new-relic-solutions/new-relic-one/install-configure/update-new-relic-agent/</a>)</p>
<p>See the New Relic Node.js agent EOL policy for information about agent releases and support dates. (<a href="https://docs.newrelic.com/docs/apm/agents/nodejs-agent/getting-started/nodejs-agent-eol-policy/">https://docs.newrelic.com/docs/apm/agents/nodejs-agent/getting-started/nodejs-agent-eol-policy/</a>)</p>
<h2>v11.4.0</h2>
<h4>Features</h4>
<ul>
<li>Added support for parsing container ids from docker versions using cgroups v2. (<a href="https://redirect.github.com/newrelic/node-newrelic/pull/1830">#1830</a>) (<a href="https://github.com/newrelic/node-newrelic/commit/98929013da3e62e2223f94531b8d6f59eecfc35b">9892901</a>)</li>
</ul>
<h4>Miscellaneous chores</h4>
<ul>
<li>[Snyk] Upgraded <code>@​grpc/grpc-js</code> from 1.9.2 to 1.9.4. (<a href="https://redirect.github.com/newrelic/node-newrelic/pull/1823">#1823</a>) (<a href="https://github.com/newrelic/node-newrelic/commit/81f945033376e4d33651d1e42afc30aea19dbdeb">81f9450</a>)</li>
<li><strong>deps:</strong> Updated aws-sdk, koa, superagent (<a href="https://redirect.github.com/newrelic/node-newrelic/pull/1831">#1831</a>) (<a href="https://github.com/newrelic/node-newrelic/commit/8b4e963e84d34e4727b9fda3aa630ef119aa3905">8b4e963</a>)</li>
</ul>
<h4>Tests</h4>
<ul>
<li>Increased timeout for integration tests to avoid random failures. (<a href="https://redirect.github.com/newrelic/node-newrelic/pull/1827">#1827</a>) (<a href="https://github.com/newrelic/node-newrelic/commit/52020485191868f479092ae4860019acf105b3eb">5202048</a>)</li>
</ul>
<h3>Support statement:</h3>
<p>We recommend updating to the latest agent version as soon as it's available. If you can't upgrade to the latest version, update your agents to a version no more than 90 days old. Read more about keeping agents up to date. (<a href="https://docs.newrelic.com/docs/new-relic-solutions/new-relic-one/install-configure/update-new-relic-agent/">https://docs.newrelic.com/docs/new-relic-solutions/new-relic-one/install-configure/update-new-relic-agent/</a>)</p>
<p>See the New Relic Node.js agent EOL policy for information about agent releases and support dates. (<a href="https://docs.newrelic.com/docs/apm/agents/nodejs-agent/getting-started/nodejs-agent-eol-policy/">https://docs.newrelic.com/docs/apm/agents/nodejs-agent/getting-started/nodejs-agent-eol-policy/</a>)</p>
<p>v11.3.0 (2023-10-23)</p>
<h4>Features</h4>
<ul>
<li>Updated agent initialization to allow running in worker threads when config.worker_threads.enabled is true (<a href="https://redirect.github.com/newrelic/node-newrelic/pull/1817">#1817</a>) (<a href="https://github.com/newrelic/node-newrelic/commit/a39f0ef5ac670d03ab407b24e5aeccd8d5e8c680">a39f0ef</a>)</li>
</ul>
<h4>Bug fixes</h4>
<ul>
<li>Updated Elasticsearch instrumentation to register on v7.13.0+ only (<a href="https://redirect.github.com/newrelic/node-newrelic/pull/1816">#1816</a>) (<a href="https://github.com/newrelic/node-newrelic/commit/6437671b921cd6bd73ed31180b0d62f62cc229a2">6437671</a>)</li>
</ul>
<h4>Miscellaneous chores</h4>
<ul>
<li><strong>dev-deps:</strong> Bumped <code>@​babel/traverse</code> (<a href="https://redirect.github.com/newrelic/node-newrelic/pull/1818">#1818</a>) (<a href="https://github.com/newrelic/node-newrelic/commit/d3c8d04b74b7a84846609b744e3b4922136dbdd6">d3c8d04</a>)</li>
</ul>
<!-- raw HTML omitted -->
</blockquote>
<p>... (truncated)</p>
</details>
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a href="https://github.com/newrelic/node-newrelic/blob/main/changelog.json">newrelic's changelog</a>.</em></p>
<blockquote>
<p>{
&quot;repository&quot;: &quot;newrelic/node-newrelic&quot;,
&quot;entries&quot;: [
{
&quot;version&quot;: &quot;11.5.0&quot;,
&quot;changes&quot;: {
&quot;security&quot;: [],
&quot;bugfixes&quot;: [],
&quot;features&quot;: []
}
},
{
&quot;version&quot;: &quot;11.4.0&quot;,
&quot;changes&quot;: {
&quot;security&quot;: [],
&quot;bugfixes&quot;: [],
&quot;features&quot;: [
&quot;Added support for parsing container ids from docker versions using cgroups v2.&quot;
]
}
},
{
&quot;version&quot;: &quot;11.3.0&quot;,
&quot;changes&quot;: {
&quot;security&quot;: [],
&quot;bugfixes&quot;: [
&quot;Updated Elasticsearch instrumentation to register only on v7.13.0+&quot;
],
&quot;features&quot;: [
&quot;Updated agent initialization to allow running in worker threads when config.worker_threads.enabled is true&quot;
]
}
},
{
&quot;version&quot;: &quot;11.2.1&quot;,
&quot;changes&quot;: {
&quot;security&quot;: [],
&quot;bugfixes&quot;: [
&quot;Updated initialization to return the api on start up to the security agent properly&quot;
],
&quot;features&quot;: []
}
},
{
&quot;version&quot;: &quot;11.2.0&quot;,
&quot;changes&quot;: {
&quot;security&quot;: [],
&quot;bugfixes&quot;: [
&quot;Updated agent to create a stub api when running in a worker thread to avoid Next.js early return errors.&quot;,
&quot;Updated shimmer to allow registering instrumentation for different versions of the same module.&quot;</p>
<!-- raw HTML omitted -->
</blockquote>
<p>... (truncated)</p>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/newrelic/node-newrelic/commit/20b7680c819661455d30a2fc9bfbc4e00c677d23"><code>20b7680</code></a> chore: Release v11.5.0 (<a href="https://redirect.github.com/newrelic/node-newrelic/issues/1839">#1839</a>)</li>
<li><a href="https://github.com/newrelic/node-newrelic/commit/fb06ac930269b784fcea6c2b8ea5e54158677ec4"><code>fb06ac9</code></a> chore(dep): Updated <code>@​newrelic/security-agent</code> to v0.4.0 (<a href="https://redirect.github.com/newrelic/node-newrelic/issues/1837">#1837</a>)</li>
<li><a href="https://github.com/newrelic/node-newrelic/commit/fe1b4fc4c00b2e4ea4c7b6fa5a8c1cd6e864145a"><code>fe1b4fc</code></a> ci: Disable fail-fast on nightly versioned test runs (<a href="https://redirect.github.com/newrelic/node-newrelic/issues/1836">#1836</a>)</li>
<li><a href="https://github.com/newrelic/node-newrelic/commit/06b33649c22c85c13ad8e6dfafbd4fe63da58607"><code>06b3364</code></a> chore: Release v11.4.0 (<a href="https://redirect.github.com/newrelic/node-newrelic/issues/1833">#1833</a>)</li>
<li><a href="https://github.com/newrelic/node-newrelic/commit/8b4e963e84d34e4727b9fda3aa630ef119aa3905"><code>8b4e963</code></a> chore(deps): Updated aws-sdk, koa, superagent (<a href="https://redirect.github.com/newrelic/node-newrelic/issues/1831">#1831</a>)</li>
<li><a href="https://github.com/newrelic/node-newrelic/commit/98929013da3e62e2223f94531b8d6f59eecfc35b"><code>9892901</code></a> feat: Added support for parsing container ids from docker versions using cgro...</li>
<li><a href="https://github.com/newrelic/node-newrelic/commit/81f945033376e4d33651d1e42afc30aea19dbdeb"><code>81f9450</code></a> chore: [Snyk] Upgraded <code>@​grpc/grpc-js</code> from 1.9.2 to 1.9.4. (<a href="https://redirect.github.com/newrelic/node-newrelic/issues/1823">#1823</a>)</li>
<li><a href="https://github.com/newrelic/node-newrelic/commit/52020485191868f479092ae4860019acf105b3eb"><code>5202048</code></a> test: Increased timeout for integration tests to avoid random failures. (<a href="https://redirect.github.com/newrelic/node-newrelic/issues/1827">#1827</a>)</li>
<li><a href="https://github.com/newrelic/node-newrelic/commit/1ed0c5c6188472a6ad727b45563b105d6e60153f"><code>1ed0c5c</code></a> chore: release v11.3.0 (<a href="https://redirect.github.com/newrelic/node-newrelic/issues/1826">#1826</a>)</li>
<li><a href="https://github.com/newrelic/node-newrelic/commit/a39f0ef5ac670d03ab407b24e5aeccd8d5e8c680"><code>a39f0ef</code></a> feat: Updated agent initialization to allow running in worker threads when co...</li>
<li>Additional commits viewable in <a href="https://github.com/newrelic/node-newrelic/compare/v11.0.0...v11.5.0">compare view</a></li>
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
- `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the specified dependency
- `@dependabot ignore this major version` will close this PR and stop Dependabot creating any more for this major version (unless you reopen the PR or upgrade to it yourself)
- `@dependabot ignore this minor version` will close this PR and stop Dependabot creating any more for this minor version (unless you reopen the PR or upgrade to it yourself)
- `@dependabot ignore this dependency` will close this PR and stop Dependabot creating any more for this dependency (unless you reopen the PR or upgrade to it yourself)
You can disable automated security fix PRs for this repo from the [Security Alerts page](https://github.com/newrelic/node-newrelic-koa/network/alerts).

</details>
--------------------------

### v8.0.1 (2023-10-25)

* Removed `newrelic` as peer dependency since this package only gets bundled with agent.
* Updated [@babel/traverse](https://github.com/babel/babel/tree/HEAD/packages/babel-traverse) from 7.17.3 and 7.21.4 to 7.23.2.

--------------------------

### v8.0.0 (2023-08-28)

* **BREAKING**: Removed support for Node 14.

* **BREAKING**: Removed ability to run `@newrelic/koa` as a standalone module. This package gets bundled with agent and no longer can run as a standalone in v10 of the newrelic agent.

* Added support for Node 20.

* Updated vulnerable dependencies:
    - word-wrap from 1.2.3 to 1.2.4.
    - protobufjs from 7.2.3 to 7.2.4.

* Added test for registering instrumentation via nr-hooks.

* Updated README links to point to new forum link.


### v7.2.0 (2023-04-19)

* Updated the registration of instrumentation to indicate that it will share a shim instance id for checking if items are wrapped.

* Updated README header image to latest OSS office required images

* Fixed dead links in the docs.

* Added testing coverage to ensure Code Level Metrics functionality with Koa instrumentation

* Added lockfile checks to CI workflow to prevent malicious changes

* Updated json5 devDependency to latest.

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
