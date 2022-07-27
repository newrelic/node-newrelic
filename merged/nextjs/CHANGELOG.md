### v0.3.0 (2022-07-27)

* Dropped support for Node 12 
    * Dropped 12 from engines in project and versioned tests.

* Updated CI to run for Node versions 14-18.

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

You can disable automated security fix PRs for this repo from the [Security Alerts page](https://github.com/newrelic/newrelic-node-nextjs/network/alerts).

</details>
--------------------------

* Updated `README` and segment/span docs to call out middleware behavior in the plugin.
    * Middleware is now stable in Next.js as of 12.2.0, the plugin only supports 12.2.0+.

* Updated sample app to use `http.get` instead of `fetch` to make subrequests to API to avoid async context propogation breakage in Node 18.

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
