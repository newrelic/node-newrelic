### v0.8.0 (2024-03-12)

* Updated instrumentation to construct spec objects at instrumentation.
 * Fixed instrumentation to only pass in route parameters to be added to Next.js segments. 
 * Updated minimum version of agent to 11.12.0.

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
You can disable automated security fix PRs for this repo from the [Security Alerts page](https://github.com/newrelic/newrelic-node-nextjs/network/alerts).

</details>
--------------------------

## Changes included in this PR

- Changes to the following files to upgrade the vulnerable dependencies to a fixed version:
    - package.json
    - package-lock.json

--- NOTES NEEDS REVIEW ---
Bumps  and [@babel/traverse](https://github.com/babel/babel/tree/HEAD/packages/babel-traverse). These dependencies needed to be updated together.
Updates `@babel/traverse` from 7.17.3 to 7.23.2
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a href="https://github.com/babel/babel/releases"><code>@​babel/traverse</code>'s releases</a>.</em></p>
<blockquote>
<h2>v7.23.2 (2023-10-11)</h2>
<p><strong>NOTE</strong>: This release also re-publishes <code>@babel/core</code>, even if it does not appear in the linked release commit.</p>
<p>Thanks <a href="https://github.com/jimmydief"><code>@​jimmydief</code></a> for your first PR!</p>
<h4>:bug: Bug Fix</h4>
<ul>
<li><code>babel-traverse</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/16033">#16033</a> Only evaluate own String/Number/Math methods (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-preset-typescript</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/16022">#16022</a> Rewrite <code>.tsx</code> extension when using <code>rewriteImportExtensions</code> (<a href="https://github.com/jimmydief"><code>@​jimmydief</code></a>)</li>
</ul>
</li>
<li><code>babel-helpers</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/16017">#16017</a> Fix: fallback to typeof when toString is applied to incompatible object (<a href="https://github.com/JLHwung"><code>@​JLHwung</code></a>)</li>
</ul>
</li>
<li><code>babel-helpers</code>, <code>babel-plugin-transform-modules-commonjs</code>, <code>babel-runtime-corejs2</code>, <code>babel-runtime-corejs3</code>, <code>babel-runtime</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/16025">#16025</a> Avoid override mistake in namespace imports (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
</ul>
<h4>Committers: 5</h4>
<ul>
<li>Babel Bot (<a href="https://github.com/babel-bot"><code>@​babel-bot</code></a>)</li>
<li>Huáng Jùnliàng (<a href="https://github.com/JLHwung"><code>@​JLHwung</code></a>)</li>
<li>James Diefenderfer (<a href="https://github.com/jimmydief"><code>@​jimmydief</code></a>)</li>
<li>Nicolò Ribaudo (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
<li><a href="https://github.com/liuxingbaoyu"><code>@​liuxingbaoyu</code></a></li>
</ul>
<h2>v7.23.1 (2023-09-25)</h2>
<p>Re-publishing <code>@babel/helpers</code> due to a publishing error in 7.23.0.</p>
<h2>v7.23.0 (2023-09-25)</h2>
<p>Thanks <a href="https://github.com/lorenzoferre"><code>@​lorenzoferre</code></a> and <a href="https://github.com/RajShukla1"><code>@​RajShukla1</code></a> for your first PRs!</p>
<h4>:rocket: New Feature</h4>
<ul>
<li><code>babel-plugin-proposal-import-wasm-source</code>, <code>babel-plugin-syntax-import-source</code>, <code>babel-plugin-transform-dynamic-import</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15870">#15870</a> Support transforming <code>import source</code> for wasm (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-helper-module-transforms</code>, <code>babel-helpers</code>, <code>babel-plugin-proposal-import-defer</code>, <code>babel-plugin-syntax-import-defer</code>, <code>babel-plugin-transform-modules-commonjs</code>, <code>babel-runtime-corejs2</code>, <code>babel-runtime-corejs3</code>, <code>babel-runtime</code>, <code>babel-standalone</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15878">#15878</a> Implement <code>import defer</code> proposal transform support (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-generator</code>, <code>babel-parser</code>, <code>babel-types</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15845">#15845</a> Implement <code>import defer</code> parsing support (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
<li><a href="https://redirect.github.com/babel/babel/pull/15829">#15829</a> Add parsing support for the &quot;source phase imports&quot; proposal (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-generator</code>, <code>babel-helper-module-transforms</code>, <code>babel-parser</code>, <code>babel-plugin-transform-dynamic-import</code>, <code>babel-plugin-transform-modules-amd</code>, <code>babel-plugin-transform-modules-commonjs</code>, <code>babel-plugin-transform-modules-systemjs</code>, <code>babel-traverse</code>, <code>babel-types</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15682">#15682</a> Add <code>createImportExpressions</code> parser option (<a href="https://github.com/JLHwung"><code>@​JLHwung</code></a>)</li>
</ul>
</li>
<li><code>babel-standalone</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15671">#15671</a> Pass through nonce to the transformed script element (<a href="https://github.com/JLHwung"><code>@​JLHwung</code></a>)</li>
</ul>
</li>
<li><code>babel-helper-function-name</code>, <code>babel-helper-member-expression-to-functions</code>, <code>babel-helpers</code>, <code>babel-parser</code>, <code>babel-plugin-proposal-destructuring-private</code>, <code>babel-plugin-proposal-optional-chaining-assign</code>, <code>babel-plugin-syntax-optional-chaining-assign</code>, <code>babel-plugin-transform-destructuring</code>, <code>babel-plugin-transform-optional-chaining</code>, <code>babel-runtime-corejs2</code>, <code>babel-runtime-corejs3</code>, <code>babel-runtime</code>, <code>babel-standalone</code>, <code>babel-types</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15751">#15751</a> Add support for optional chain in assignments (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-helpers</code>, <code>babel-plugin-proposal-decorators</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15895">#15895</a> Implement the &quot;decorator metadata&quot; proposal (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-traverse</code>, <code>babel-types</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15893">#15893</a> Add <code>t.buildUndefinedNode</code> (<a href="https://github.com/liuxingbaoyu"><code>@​liuxingbaoyu</code></a>)</li>
</ul>
</li>
<li><code>babel-preset-typescript</code></li>
</ul>
<!-- raw HTML omitted -->
</blockquote>
<p>... (truncated)</p>
</details>
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a href="https://github.com/babel/babel/blob/main/CHANGELOG.md"><code>@​babel/traverse</code>'s changelog</a>.</em></p>
<blockquote>
<h2>v7.23.2 (2023-10-11)</h2>
<h4>:bug: Bug Fix</h4>
<ul>
<li><code>babel-traverse</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/16033">#16033</a> Only evaluate own String/Number/Math methods (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-preset-typescript</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/16022">#16022</a> Rewrite <code>.tsx</code> extension when using <code>rewriteImportExtensions</code> (<a href="https://github.com/jimmydief"><code>@​jimmydief</code></a>)</li>
</ul>
</li>
<li><code>babel-helpers</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/16017">#16017</a> Fix: fallback to typeof when toString is applied to incompatible object (<a href="https://github.com/JLHwung"><code>@​JLHwung</code></a>)</li>
</ul>
</li>
<li><code>babel-helpers</code>, <code>babel-plugin-transform-modules-commonjs</code>, <code>babel-runtime-corejs2</code>, <code>babel-runtime-corejs3</code>, <code>babel-runtime</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/16025">#16025</a> Avoid override mistake in namespace imports (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
</ul>
<h2>v7.23.0 (2023-09-25)</h2>
<h4>:rocket: New Feature</h4>
<ul>
<li><code>babel-plugin-proposal-import-wasm-source</code>, <code>babel-plugin-syntax-import-source</code>, <code>babel-plugin-transform-dynamic-import</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15870">#15870</a> Support transforming <code>import source</code> for wasm (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-helper-module-transforms</code>, <code>babel-helpers</code>, <code>babel-plugin-proposal-import-defer</code>, <code>babel-plugin-syntax-import-defer</code>, <code>babel-plugin-transform-modules-commonjs</code>, <code>babel-runtime-corejs2</code>, <code>babel-runtime-corejs3</code>, <code>babel-runtime</code>, <code>babel-standalone</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15878">#15878</a> Implement <code>import defer</code> proposal transform support (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-generator</code>, <code>babel-parser</code>, <code>babel-types</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15845">#15845</a> Implement <code>import defer</code> parsing support (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
<li><a href="https://redirect.github.com/babel/babel/pull/15829">#15829</a> Add parsing support for the &quot;source phase imports&quot; proposal (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-generator</code>, <code>babel-helper-module-transforms</code>, <code>babel-parser</code>, <code>babel-plugin-transform-dynamic-import</code>, <code>babel-plugin-transform-modules-amd</code>, <code>babel-plugin-transform-modules-commonjs</code>, <code>babel-plugin-transform-modules-systemjs</code>, <code>babel-traverse</code>, <code>babel-types</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15682">#15682</a> Add <code>createImportExpressions</code> parser option (<a href="https://github.com/JLHwung"><code>@​JLHwung</code></a>)</li>
</ul>
</li>
<li><code>babel-standalone</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15671">#15671</a> Pass through nonce to the transformed script element (<a href="https://github.com/JLHwung"><code>@​JLHwung</code></a>)</li>
</ul>
</li>
<li><code>babel-helper-function-name</code>, <code>babel-helper-member-expression-to-functions</code>, <code>babel-helpers</code>, <code>babel-parser</code>, <code>babel-plugin-proposal-destructuring-private</code>, <code>babel-plugin-proposal-optional-chaining-assign</code>, <code>babel-plugin-syntax-optional-chaining-assign</code>, <code>babel-plugin-transform-destructuring</code>, <code>babel-plugin-transform-optional-chaining</code>, <code>babel-runtime-corejs2</code>, <code>babel-runtime-corejs3</code>, <code>babel-runtime</code>, <code>babel-standalone</code>, <code>babel-types</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15751">#15751</a> Add support for optional chain in assignments (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-helpers</code>, <code>babel-plugin-proposal-decorators</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15895">#15895</a> Implement the &quot;decorator metadata&quot; proposal (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-traverse</code>, <code>babel-types</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15893">#15893</a> Add <code>t.buildUndefinedNode</code> (<a href="https://github.com/liuxingbaoyu"><code>@​liuxingbaoyu</code></a>)</li>
</ul>
</li>
<li><code>babel-preset-typescript</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15913">#15913</a> Add <code>rewriteImportExtensions</code> option to TS preset (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-parser</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15896">#15896</a> Allow TS tuples to have both labeled and unlabeled elements (<a href="https://github.com/yukukotani"><code>@​yukukotani</code></a>)</li>
</ul>
</li>
</ul>
<h4>:bug: Bug Fix</h4>
<ul>
<li><code>babel-plugin-transform-block-scoping</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15962">#15962</a> fix: <code>transform-block-scoping</code> captures the variables of the method in the loop (<a href="https://github.com/liuxingbaoyu"><code>@​liuxingbaoyu</code></a>)</li>
</ul>
</li>
</ul>
<h4>:nail_care: Polish</h4>
<ul>
<li><code>babel-traverse</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15797">#15797</a> Expand evaluation of global built-ins in <code>@babel/traverse</code> (<a href="https://github.com/lorenzoferre"><code>@​lorenzoferre</code></a>)</li>
</ul>
</li>
<li><code>babel-plugin-proposal-explicit-resource-management</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15985">#15985</a> Improve source maps for blocks with <code>using</code> declarations (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
</ul>
<h4>:microscope: Output optimization</h4>
<ul>
<li><code>babel-core</code>, <code>babel-helper-module-transforms</code>, <code>babel-plugin-transform-async-to-generator</code>, <code>babel-plugin-transform-classes</code>, <code>babel-plugin-transform-dynamic-import</code>, <code>babel-plugin-transform-function-name</code>, <code>babel-plugin-transform-modules-amd</code>, <code>babel-plugin-transform-modules-commonjs</code>, <code>babel-plugin-transform-modules-umd</code>, <code>babel-plugin-transform-parameters</code>, <code>babel-plugin-transform-react-constant-elements</code>, <code>babel-plugin-transform-react-inline-elements</code>, <code>babel-plugin-transform-runtime</code>, <code>babel-plugin-transform-typescript</code>, <code>babel-preset-env</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15984">#15984</a> Inline <code>exports.XXX =</code> update in simple variable declarations (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
</ul>
<h2>v7.22.20 (2023-09-16)</h2>
<!-- raw HTML omitted -->
</blockquote>
<p>... (truncated)</p>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/babel/babel/commit/b4b9942a6cde0685c222eb3412347880aae40ad5"><code>b4b9942</code></a> v7.23.2</li>
<li><a href="https://github.com/babel/babel/commit/b13376b346946e3f62fc0848c1d2a23223314c82"><code>b13376b</code></a> Only evaluate own String/Number/Math methods (<a href="https://github.com/babel/babel/tree/HEAD/packages/babel-traverse/issues/16033">#16033</a>)</li>
<li><a href="https://github.com/babel/babel/commit/ca58ec15cb6dde6812c36997477e44880bec0bba"><code>ca58ec1</code></a> v7.23.0</li>
<li><a href="https://github.com/babel/babel/commit/0f333dafcf470f1970083e4e695ced6aec8bead0"><code>0f333da</code></a> Add <code>createImportExpressions</code> parser option (<a href="https://github.com/babel/babel/tree/HEAD/packages/babel-traverse/issues/15682">#15682</a>)</li>
<li><a href="https://github.com/babel/babel/commit/3744545649fdc21688a2f3c97e1e39dbebff0d21"><code>3744545</code></a> Fix linting</li>
<li><a href="https://github.com/babel/babel/commit/c7e6806e2194deb36c330f543409c792592b22d4"><code>c7e6806</code></a> Add <code>t.buildUndefinedNode</code> (<a href="https://github.com/babel/babel/tree/HEAD/packages/babel-traverse/issues/15893">#15893</a>)</li>
<li><a href="https://github.com/babel/babel/commit/38ee8b4dd693f1e2bd00107bbc1167ce84736ea0"><code>38ee8b4</code></a> Expand evaluation of global built-ins in <code>@babel/traverse</code> (<a href="https://github.com/babel/babel/tree/HEAD/packages/babel-traverse/issues/15797">#15797</a>)</li>
<li><a href="https://github.com/babel/babel/commit/9f3dfd90211472cf0083a3234dd1a1b857ce3624"><code>9f3dfd9</code></a> v7.22.20</li>
<li><a href="https://github.com/babel/babel/commit/3ed28b29c1fb15588369bdd55187b69f1248e87d"><code>3ed28b2</code></a> Fully support <code>||</code> and <code>&amp;&amp;</code> in <code>pluginToggleBooleanFlag</code> (<a href="https://github.com/babel/babel/tree/HEAD/packages/babel-traverse/issues/15961">#15961</a>)</li>
<li><a href="https://github.com/babel/babel/commit/77b0d7359909c94f3797c24006f244847fbc8d6d"><code>77b0d73</code></a> v7.22.19</li>
<li>Additional commits viewable in <a href="https://github.com/babel/babel/commits/v7.23.2/packages/babel-traverse">compare view</a></li>
</ul>
</details>
<br />

Updates `@babel/traverse` from 7.20.0 to 7.23.2
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a href="https://github.com/babel/babel/releases"><code>@​babel/traverse</code>'s releases</a>.</em></p>
<blockquote>
<h2>v7.23.2 (2023-10-11)</h2>
<p><strong>NOTE</strong>: This release also re-publishes <code>@babel/core</code>, even if it does not appear in the linked release commit.</p>
<p>Thanks <a href="https://github.com/jimmydief"><code>@​jimmydief</code></a> for your first PR!</p>
<h4>:bug: Bug Fix</h4>
<ul>
<li><code>babel-traverse</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/16033">#16033</a> Only evaluate own String/Number/Math methods (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-preset-typescript</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/16022">#16022</a> Rewrite <code>.tsx</code> extension when using <code>rewriteImportExtensions</code> (<a href="https://github.com/jimmydief"><code>@​jimmydief</code></a>)</li>
</ul>
</li>
<li><code>babel-helpers</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/16017">#16017</a> Fix: fallback to typeof when toString is applied to incompatible object (<a href="https://github.com/JLHwung"><code>@​JLHwung</code></a>)</li>
</ul>
</li>
<li><code>babel-helpers</code>, <code>babel-plugin-transform-modules-commonjs</code>, <code>babel-runtime-corejs2</code>, <code>babel-runtime-corejs3</code>, <code>babel-runtime</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/16025">#16025</a> Avoid override mistake in namespace imports (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
</ul>
<h4>Committers: 5</h4>
<ul>
<li>Babel Bot (<a href="https://github.com/babel-bot"><code>@​babel-bot</code></a>)</li>
<li>Huáng Jùnliàng (<a href="https://github.com/JLHwung"><code>@​JLHwung</code></a>)</li>
<li>James Diefenderfer (<a href="https://github.com/jimmydief"><code>@​jimmydief</code></a>)</li>
<li>Nicolò Ribaudo (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
<li><a href="https://github.com/liuxingbaoyu"><code>@​liuxingbaoyu</code></a></li>
</ul>
<h2>v7.23.1 (2023-09-25)</h2>
<p>Re-publishing <code>@babel/helpers</code> due to a publishing error in 7.23.0.</p>
<h2>v7.23.0 (2023-09-25)</h2>
<p>Thanks <a href="https://github.com/lorenzoferre"><code>@​lorenzoferre</code></a> and <a href="https://github.com/RajShukla1"><code>@​RajShukla1</code></a> for your first PRs!</p>
<h4>:rocket: New Feature</h4>
<ul>
<li><code>babel-plugin-proposal-import-wasm-source</code>, <code>babel-plugin-syntax-import-source</code>, <code>babel-plugin-transform-dynamic-import</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15870">#15870</a> Support transforming <code>import source</code> for wasm (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-helper-module-transforms</code>, <code>babel-helpers</code>, <code>babel-plugin-proposal-import-defer</code>, <code>babel-plugin-syntax-import-defer</code>, <code>babel-plugin-transform-modules-commonjs</code>, <code>babel-runtime-corejs2</code>, <code>babel-runtime-corejs3</code>, <code>babel-runtime</code>, <code>babel-standalone</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15878">#15878</a> Implement <code>import defer</code> proposal transform support (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-generator</code>, <code>babel-parser</code>, <code>babel-types</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15845">#15845</a> Implement <code>import defer</code> parsing support (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
<li><a href="https://redirect.github.com/babel/babel/pull/15829">#15829</a> Add parsing support for the &quot;source phase imports&quot; proposal (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-generator</code>, <code>babel-helper-module-transforms</code>, <code>babel-parser</code>, <code>babel-plugin-transform-dynamic-import</code>, <code>babel-plugin-transform-modules-amd</code>, <code>babel-plugin-transform-modules-commonjs</code>, <code>babel-plugin-transform-modules-systemjs</code>, <code>babel-traverse</code>, <code>babel-types</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15682">#15682</a> Add <code>createImportExpressions</code> parser option (<a href="https://github.com/JLHwung"><code>@​JLHwung</code></a>)</li>
</ul>
</li>
<li><code>babel-standalone</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15671">#15671</a> Pass through nonce to the transformed script element (<a href="https://github.com/JLHwung"><code>@​JLHwung</code></a>)</li>
</ul>
</li>
<li><code>babel-helper-function-name</code>, <code>babel-helper-member-expression-to-functions</code>, <code>babel-helpers</code>, <code>babel-parser</code>, <code>babel-plugin-proposal-destructuring-private</code>, <code>babel-plugin-proposal-optional-chaining-assign</code>, <code>babel-plugin-syntax-optional-chaining-assign</code>, <code>babel-plugin-transform-destructuring</code>, <code>babel-plugin-transform-optional-chaining</code>, <code>babel-runtime-corejs2</code>, <code>babel-runtime-corejs3</code>, <code>babel-runtime</code>, <code>babel-standalone</code>, <code>babel-types</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15751">#15751</a> Add support for optional chain in assignments (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-helpers</code>, <code>babel-plugin-proposal-decorators</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15895">#15895</a> Implement the &quot;decorator metadata&quot; proposal (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-traverse</code>, <code>babel-types</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15893">#15893</a> Add <code>t.buildUndefinedNode</code> (<a href="https://github.com/liuxingbaoyu"><code>@​liuxingbaoyu</code></a>)</li>
</ul>
</li>
<li><code>babel-preset-typescript</code></li>
</ul>
<!-- raw HTML omitted -->
</blockquote>
<p>... (truncated)</p>
</details>
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a href="https://github.com/babel/babel/blob/main/CHANGELOG.md"><code>@​babel/traverse</code>'s changelog</a>.</em></p>
<blockquote>
<h2>v7.23.2 (2023-10-11)</h2>
<h4>:bug: Bug Fix</h4>
<ul>
<li><code>babel-traverse</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/16033">#16033</a> Only evaluate own String/Number/Math methods (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-preset-typescript</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/16022">#16022</a> Rewrite <code>.tsx</code> extension when using <code>rewriteImportExtensions</code> (<a href="https://github.com/jimmydief"><code>@​jimmydief</code></a>)</li>
</ul>
</li>
<li><code>babel-helpers</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/16017">#16017</a> Fix: fallback to typeof when toString is applied to incompatible object (<a href="https://github.com/JLHwung"><code>@​JLHwung</code></a>)</li>
</ul>
</li>
<li><code>babel-helpers</code>, <code>babel-plugin-transform-modules-commonjs</code>, <code>babel-runtime-corejs2</code>, <code>babel-runtime-corejs3</code>, <code>babel-runtime</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/16025">#16025</a> Avoid override mistake in namespace imports (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
</ul>
<h2>v7.23.0 (2023-09-25)</h2>
<h4>:rocket: New Feature</h4>
<ul>
<li><code>babel-plugin-proposal-import-wasm-source</code>, <code>babel-plugin-syntax-import-source</code>, <code>babel-plugin-transform-dynamic-import</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15870">#15870</a> Support transforming <code>import source</code> for wasm (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-helper-module-transforms</code>, <code>babel-helpers</code>, <code>babel-plugin-proposal-import-defer</code>, <code>babel-plugin-syntax-import-defer</code>, <code>babel-plugin-transform-modules-commonjs</code>, <code>babel-runtime-corejs2</code>, <code>babel-runtime-corejs3</code>, <code>babel-runtime</code>, <code>babel-standalone</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15878">#15878</a> Implement <code>import defer</code> proposal transform support (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-generator</code>, <code>babel-parser</code>, <code>babel-types</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15845">#15845</a> Implement <code>import defer</code> parsing support (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
<li><a href="https://redirect.github.com/babel/babel/pull/15829">#15829</a> Add parsing support for the &quot;source phase imports&quot; proposal (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-generator</code>, <code>babel-helper-module-transforms</code>, <code>babel-parser</code>, <code>babel-plugin-transform-dynamic-import</code>, <code>babel-plugin-transform-modules-amd</code>, <code>babel-plugin-transform-modules-commonjs</code>, <code>babel-plugin-transform-modules-systemjs</code>, <code>babel-traverse</code>, <code>babel-types</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15682">#15682</a> Add <code>createImportExpressions</code> parser option (<a href="https://github.com/JLHwung"><code>@​JLHwung</code></a>)</li>
</ul>
</li>
<li><code>babel-standalone</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15671">#15671</a> Pass through nonce to the transformed script element (<a href="https://github.com/JLHwung"><code>@​JLHwung</code></a>)</li>
</ul>
</li>
<li><code>babel-helper-function-name</code>, <code>babel-helper-member-expression-to-functions</code>, <code>babel-helpers</code>, <code>babel-parser</code>, <code>babel-plugin-proposal-destructuring-private</code>, <code>babel-plugin-proposal-optional-chaining-assign</code>, <code>babel-plugin-syntax-optional-chaining-assign</code>, <code>babel-plugin-transform-destructuring</code>, <code>babel-plugin-transform-optional-chaining</code>, <code>babel-runtime-corejs2</code>, <code>babel-runtime-corejs3</code>, <code>babel-runtime</code>, <code>babel-standalone</code>, <code>babel-types</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15751">#15751</a> Add support for optional chain in assignments (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-helpers</code>, <code>babel-plugin-proposal-decorators</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15895">#15895</a> Implement the &quot;decorator metadata&quot; proposal (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-traverse</code>, <code>babel-types</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15893">#15893</a> Add <code>t.buildUndefinedNode</code> (<a href="https://github.com/liuxingbaoyu"><code>@​liuxingbaoyu</code></a>)</li>
</ul>
</li>
<li><code>babel-preset-typescript</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15913">#15913</a> Add <code>rewriteImportExtensions</code> option to TS preset (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
<li><code>babel-parser</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15896">#15896</a> Allow TS tuples to have both labeled and unlabeled elements (<a href="https://github.com/yukukotani"><code>@​yukukotani</code></a>)</li>
</ul>
</li>
</ul>
<h4>:bug: Bug Fix</h4>
<ul>
<li><code>babel-plugin-transform-block-scoping</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15962">#15962</a> fix: <code>transform-block-scoping</code> captures the variables of the method in the loop (<a href="https://github.com/liuxingbaoyu"><code>@​liuxingbaoyu</code></a>)</li>
</ul>
</li>
</ul>
<h4>:nail_care: Polish</h4>
<ul>
<li><code>babel-traverse</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15797">#15797</a> Expand evaluation of global built-ins in <code>@babel/traverse</code> (<a href="https://github.com/lorenzoferre"><code>@​lorenzoferre</code></a>)</li>
</ul>
</li>
<li><code>babel-plugin-proposal-explicit-resource-management</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15985">#15985</a> Improve source maps for blocks with <code>using</code> declarations (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
</ul>
<h4>:microscope: Output optimization</h4>
<ul>
<li><code>babel-core</code>, <code>babel-helper-module-transforms</code>, <code>babel-plugin-transform-async-to-generator</code>, <code>babel-plugin-transform-classes</code>, <code>babel-plugin-transform-dynamic-import</code>, <code>babel-plugin-transform-function-name</code>, <code>babel-plugin-transform-modules-amd</code>, <code>babel-plugin-transform-modules-commonjs</code>, <code>babel-plugin-transform-modules-umd</code>, <code>babel-plugin-transform-parameters</code>, <code>babel-plugin-transform-react-constant-elements</code>, <code>babel-plugin-transform-react-inline-elements</code>, <code>babel-plugin-transform-runtime</code>, <code>babel-plugin-transform-typescript</code>, <code>babel-preset-env</code>
<ul>
<li><a href="https://redirect.github.com/babel/babel/pull/15984">#15984</a> Inline <code>exports.XXX =</code> update in simple variable declarations (<a href="https://github.com/nicolo-ribaudo"><code>@​nicolo-ribaudo</code></a>)</li>
</ul>
</li>
</ul>
<h2>v7.22.20 (2023-09-16)</h2>
<!-- raw HTML omitted -->
</blockquote>
<p>... (truncated)</p>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/babel/babel/commit/b4b9942a6cde0685c222eb3412347880aae40ad5"><code>b4b9942</code></a> v7.23.2</li>
<li><a href="https://github.com/babel/babel/commit/b13376b346946e3f62fc0848c1d2a23223314c82"><code>b13376b</code></a> Only evaluate own String/Number/Math methods (<a href="https://github.com/babel/babel/tree/HEAD/packages/babel-traverse/issues/16033">#16033</a>)</li>
<li><a href="https://github.com/babel/babel/commit/ca58ec15cb6dde6812c36997477e44880bec0bba"><code>ca58ec1</code></a> v7.23.0</li>
<li><a href="https://github.com/babel/babel/commit/0f333dafcf470f1970083e4e695ced6aec8bead0"><code>0f333da</code></a> Add <code>createImportExpressions</code> parser option (<a href="https://github.com/babel/babel/tree/HEAD/packages/babel-traverse/issues/15682">#15682</a>)</li>
<li><a href="https://github.com/babel/babel/commit/3744545649fdc21688a2f3c97e1e39dbebff0d21"><code>3744545</code></a> Fix linting</li>
<li><a href="https://github.com/babel/babel/commit/c7e6806e2194deb36c330f543409c792592b22d4"><code>c7e6806</code></a> Add <code>t.buildUndefinedNode</code> (<a href="https://github.com/babel/babel/tree/HEAD/packages/babel-traverse/issues/15893">#15893</a>)</li>
<li><a href="https://github.com/babel/babel/commit/38ee8b4dd693f1e2bd00107bbc1167ce84736ea0"><code>38ee8b4</code></a> Expand evaluation of global built-ins in <code>@babel/traverse</code> (<a href="https://github.com/babel/babel/tree/HEAD/packages/babel-traverse/issues/15797">#15797</a>)</li>
<li><a href="https://github.com/babel/babel/commit/9f3dfd90211472cf0083a3234dd1a1b857ce3624"><code>9f3dfd9</code></a> v7.22.20</li>
<li><a href="https://github.com/babel/babel/commit/3ed28b29c1fb15588369bdd55187b69f1248e87d"><code>3ed28b2</code></a> Fully support <code>||</code> and <code>&amp;&amp;</code> in <code>pluginToggleBooleanFlag</code> (<a href="https://github.com/babel/babel/tree/HEAD/packages/babel-traverse/issues/15961">#15961</a>)</li>
<li><a href="https://github.com/babel/babel/commit/77b0d7359909c94f3797c24006f244847fbc8d6d"><code>77b0d73</code></a> v7.22.19</li>
<li>Additional commits viewable in <a href="https://github.com/babel/babel/commits/v7.23.2/packages/babel-traverse">compare view</a></li>
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
You can disable automated security fix PRs for this repo from the [Security Alerts page](https://github.com/newrelic/newrelic-node-nextjs/network/alerts).

</details>
--------------------------

### v0.7.0 (2023-08-29)

* Updated the module path to properly instrument Next.js with `require-in-the-middle`.

* Updated minimum version of peer dependency `newrelic` to `>=11.0.0` to ensure the new path to Next.js server instrumentation will work.

* Updated the contributing docs.

* Updated versioned test helper to handle next@13.4.15 changes.

### v0.6.0 (2023-08-09)

* **BREAKING** - Dropped support for Node 14.
* Added support for Node 20.
* Updated instrumentation to no longer record spans for middleware execution. Middleware instrumentation is now recorded only for Next.js 12.2.0-13.4.12.
* Updated instrumentation for api requests to properly extract the params and page.
* Updated CI to run against versions 16-20.
* Updated `semver`, `word-wrap`, `protobuf`, `fast-xml-parser`, and `@aws-sdk/client-lambda` to resolve CVEs.

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
