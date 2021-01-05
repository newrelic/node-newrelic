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
