### v7.0.3 (2023-12-07)

* Updated aws-sdk v3 instrumentation to only call `shim.setLibrary` and `shim.setDatastore` once instead of on every call to SQS, SNS, and DynamoDB.

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
You can disable automated security fix PRs for this repo from the [Security Alerts page](https://github.com/newrelic/node-newrelic-aws-sdk/network/alerts).

</details>
--------------------------

### v7.0.2 (2023-10-25)

* Removed `newrelic` as peer dependency since this package only gets bundled with agent.
* Bumped [@babel/traverse](https://github.com/babel/babel/tree/HEAD/packages/babel-traverse) from 7.17.3 and 7.20.5 to 7.23.2

### v7.0.1 (2023-09-19)

* Updated v3 smithy-client instrumentation to properly handle all types of clients for DynamoDB, SQS, and SNS.

### v7.0.0 (2023-08-28)

* **BREAKING**: Removed support for Node 14.

* Added support for Node 20.

* Simplified instrumentation to only register relevant v3 middleware once in the `send` method of the SmithyClient.

* Updated vulnerable dependencies:
  - word-wrap from 1.2.3 to 1.2.4.
  - protobufjs from 7.2.3 to 7.2.4.

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
