### v7.0.1 (2023-10-25)

* Removed `newrelic` as peer dependency since this package only gets bundled with agent.
* Bumped [@babel/traverse](https://github.com/babel/babel/tree/HEAD/packages/babel-traverse) from 7.17.3 and 7.20.5 to 7.23.2.

### v7.0.0 (2023-08-28)

* **BREAKING**: Removed support for Node 14.
* **BREAKING**: Removed ability to run `@newrelic/superagent` as a standalone package.
  * This is because in version 10 of Node.js agent, it does not function properly.

* Added support for Node 20.

* Updated vulnerable dependencies:
  - word-wrap from 1.2.3 to 1.2.4.
  - protobufjs from 7.2.3 to 7.2.4.
  - cookiejar from 2.1.3 to 2.1.4.
  - json5 from 2.2.1 to 2.2.3.
  - qs from 6.5.2 to 6.5.3.

* Updated README links to point to new forum link due to repolinter ruleset change

* Update README header image to latest OSS office required images

* Fixed dead links in the docs.

* Added lockfile checks to CI workflow to prevent malicious changes

### v6.0.0 (2022-07-27)

* **BREAKING** Removed support for Node 12.

  The minimum supported version is now Node v14. For further information on our support policy, see: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent.

* Added support for Node 18.
* Resolved several dev-dependency audit warnings.

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
