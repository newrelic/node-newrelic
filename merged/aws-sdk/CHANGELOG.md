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
