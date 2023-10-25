### v7.0.2 (2023-10-25)

* Removed `newrelic` as peer dependency since this package only gets bundled with agent.

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

Updates `@babel/traverse` from 7.20.5 to 7.23.2
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
You can disable automated security fix PRs for this repo from the [Security Alerts page](https://github.com/newrelic/node-newrelic-aws-sdk/network/alerts).

</details>
--------------------------

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
