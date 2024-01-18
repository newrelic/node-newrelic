### v7.1.0 (2024-01-18)

#### Features

* Added Bedrock LLM streamed response handling ([#245](https://github.com/newrelic/node-newrelic-aws-sdk/pull/245)) ([fb1911a](https://github.com/newrelic/node-newrelic-aws-sdk/commit/fb1911a122dd3b40d755b8a28126e81d6946279c))
* Added initial objects for LLM events ([#236](https://github.com/newrelic/node-newrelic-aws-sdk/pull/236)) ([0543609](https://github.com/newrelic/node-newrelic-aws-sdk/commit/054360929fce51126037b42c6de13142a0557fae))
* Added instrumentation for InvokeModelCommand ([#239](https://github.com/newrelic/node-newrelic-aws-sdk/pull/239)) ([42d04ff](https://github.com/newrelic/node-newrelic-aws-sdk/commit/42d04ff0912b6c3114df199930dfb63a9acf3ecf))
* Added LLama2 support to LLM events and mock server ([#238](https://github.com/newrelic/node-newrelic-aws-sdk/pull/238)) ([31dad9c](https://github.com/newrelic/node-newrelic-aws-sdk/commit/31dad9c8e9fcfe979d613bfcbfff8ac7805ce74a))
* Added llm attribute to all transactions that contain llm spans for bedrock ([#246](https://github.com/newrelic/node-newrelic-aws-sdk/pull/246)) ([3032545](https://github.com/newrelic/node-newrelic-aws-sdk/commit/3032545dfed38e02fa86f779aa9866248948d330))
* Added ability to store feedback ids by request id ([#240](https://github.com/newrelic/node-newrelic-aws-sdk/pull/240)) ([0bb4ffc](https://github.com/newrelic/node-newrelic-aws-sdk/commit/0bb4ffc56ffdce4dc04a32dcd2398f5a35471a3b))
* Added handling errors by adding additional attributes to the transaction errors. ([#244](https://github.com/newrelic/node-newrelic-aws-sdk/pull/244)) ([e9584b4](https://github.com/newrelic/node-newrelic-aws-sdk/commit/e9584b4a43cbcc3d02b6663cac4c0e4d4d128741))
* Record metric on every InvokeModelCommand ([#242](https://github.com/newrelic/node-newrelic-aws-sdk/pull/242)) ([0766bc6](https://github.com/newrelic/node-newrelic-aws-sdk/commit/0766bc6fd61fa87cb61065e83483ca401f34738c))

#### Code refactoring

* Added a serialize method to LlmEvent to remove the complex objects before enqueuing to the custom event aggregator ([#241](https://github.com/newrelic/node-newrelic-aws-sdk/pull/241)) ([993673e](https://github.com/newrelic/node-newrelic-aws-sdk/commit/993673eaa358fc15c9dae156102845abdfc6c012))
* Removed aws_bedrock_instrumentation feature flag as feature is ready ([#248](https://github.com/newrelic/node-newrelic-aws-sdk/pull/248)) ([e2dc0ad](https://github.com/newrelic/node-newrelic-aws-sdk/commit/e2dc0adb2968132eb01d64d95ede56810c02b850))

#### Miscellaneous chores

* Used latest of test deps for bedrock versioned tests ([#235](https://github.com/newrelic/node-newrelic-aws-sdk/pull/235)) ([bc0fa24](https://github.com/newrelic/node-newrelic-aws-sdk/commit/bc0fa24c25f1197867970389451847f6cca6e5bc))

#### Tests

* Added missing test files to config ([#233](https://github.com/newrelic/node-newrelic-aws-sdk/pull/233)) ([e4b504c](https://github.com/newrelic/node-newrelic-aws-sdk/commit/e4b504c76d1663c54504cd281087f3b69a585f84))
* Added mock server for Bedrock API ([#230](https://github.com/newrelic/node-newrelic-aws-sdk/pull/230)) ([c1e4c4c](https://github.com/newrelic/node-newrelic-aws-sdk/commit/c1e4c4c3a362923c368af3a072666153a0973df1))
* Pinned peer deps of @aws-sdk/util-dynamodb and @aws-sdk/client-dynamodb so the older versions of @aws-sdk/lib-dynamodb pass ([#231](https://github.com/newrelic/node-newrelic-aws-sdk/pull/231)) ([0a5773b](https://github.com/newrelic/node-newrelic-aws-sdk/commit/0a5773bf305592743ce37b6502e6e01affcaa877))
* Resolved issue with testing in main repo ([#234](https://github.com/newrelic/node-newrelic-aws-sdk/pull/234)) ([e5294ed](https://github.com/newrelic/node-newrelic-aws-sdk/commit/e5294edb4ccfe2bf2e8e053569e3edb38bcd63c5))

#### Continuous integration

* Fixed misspelling in prepare-release.yml ([#247](https://github.com/newrelic/node-newrelic-aws-sdk/pull/247)) ([783e474](https://github.com/newrelic/node-newrelic-aws-sdk/commit/783e474dbbb5167c3f76b4e89fe7c2e0853fd92d))
* Updated prepare-release to use conventional commit based releases. ([#232](https://github.com/newrelic/node-newrelic-aws-sdk/pull/232)) ([5cbb649](https://github.com/newrelic/node-newrelic-aws-sdk/commit/5cbb6497368a6301ad9ae551371c7d22937aba03))

### v7.0.3 (2023-12-07)

* Updated aws-sdk v3 instrumentation to only call `shim.setLibrary` and `shim.setDatastore` once instead of on every call to SQS, SNS, and DynamoDB.
* Updated [axios](https://github.com/axios/axios) from 0.21.4 to 1.6.0 
* Updated ancestor dependency [newrelic](https://github.com/newrelic/node-newrelic) from 11.0.0 to 11.5.0

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
