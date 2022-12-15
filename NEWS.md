### v9.7.4 (2022-12-15)

* Fixed system info gathering to prevent unhandled promise rejection when an error occurs reading `/proc` information.

### v9.7.3 (2022-12-12)

* Added support for Code Level Metrics on API methods: `startSegment`, `startBackgroundTransaction`, and `startWebTransaction`.

### v9.7.2 (2022-12-07)

* Updated `@grpc/grpc-js` instrumentation to work with 1.8.0.

### v9.7.1 (2022-12-06)

* Reintroduced throttling during reading of instrumented application's dependency tree during startup, to prevent EMFILE issues.

* Improved Restify support
  * Added a new test stanza to run restify >=10 on Node 18.
  * Update our versioned tests to support Restify 9.0.0.

* Laid foundation for supporting Code Level Metrics via [Codestream](https://docs.newrelic.com/docs/codestream/how-use-codestream/performance-monitoring/). Note that this integration is not fully finished and should not be used.

* Improved the readability and maintainability of agent by reducing the [Cognitive Complexity](https://www.sonarsource.com/resources/cognitive-complexity/) of various aspects of the agent.

* Added `newrelic.noticeError()` example to our API docs.

* Upgraded @grpc/grpc-js from 1.6.9 to 1.7.3.

* Upgraded @grpc/proto-loader from 0.6.13 to 0.7.3.

* Removed async from benchmark tests, fixed failing benchmark suites, and removed deprecated suite.

### v9.7.0 (2022-11-14)

* Added new configuration option, `grpc.ignore_status_codes`, which can be used to select nonzero gRPC status codes to ignore and not report as errors.

### v9.6.0 (2022-11-09)

* Dropped support for `vision`, and instead only instrument `@hapi/vision`.

* Updated configuration system to automatically create an environment variable mapping for a new config value.
   * It will follow a convention of `NEW_RELIC_PATH_TO_CONFIG_KEY`.
   * For example if there is a new configuration option of `config.nested.object_path.enabled` the env var would be `NEW_RELIC_NESTED_OBJECT_PATH.ENABLED`.
   
* Removed `transaction_tracer.hide_internals` configuration. All of the internal configuration is now handled by Javascript symbols instead of non-enumerable properties, so there is no longer a performance penalty, as symbols are already hidden by default.

### v9.5.0 (2022-10-26)

* Increased the default limit of custom events from 1,000 events per minute to 3,000 events per minute. In the scenario that custom events were being limited, this change will allow more custom events to be sent to New Relic. There is also a new configurable maximum limit of 100,000 events per minute. To change the limits, see the documentation for [custom_insights_events](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration#custom_events_max_samples_stored). To learn more about the change and how to determine if custom events are being dropped, see our Explorers Hub [post](https://discuss.newrelic.com/t/send-more-custom-events-with-the-latest-apm-agents/190497).

* Updated CI process to include collection of code coverage statistics.

* Added a [document](./documentation/feature-flags.md) for our current feature flags.

### v9.4.0 (2022-10-24)

* Removed legacy agent async context propagation. The default behavior is now what was behind the `feature_flag.new_promise_tracking`. You can read more about the difference [here](https://docs.newrelic.com/docs/release-notes/agent-release-notes/nodejs-release-notes/node-agent-7-3-0#new-features). 

* Fixed an issue with the ES Module loader that properly registers instrumentation when the file path included url encoded characters.

* Added an API for enqueuing application logs for forwarding 

```js
newrelic.recordLogEvent({ message: 'hello world', level: 'info' })`
```


**Note**: If you are including a serialized error make sure it is on the `error` key of the log event: 

```js
const error = new Error('testing errors'); 
newrelic.recordLogEvent({ message: 'error example', level: 'error', error })
```

* Fixed `cassandra-driver` instrumentation to properly set instance details on query segments/spans.

* Added a new context manager that leverages AsyncLocalStorage for async context propagation.
    * This will be available via a feature flag  `config.feature_flag.async_local_context`
    * Alternatively you can set the environment variable of `NEW_RELIC_FEATURE_FLAG_ASYNC_LOCAL_CONTEXT=1`
    * By enabling this feature flag it should make the agent use less memory and CPU.

### v9.3.0 (2022-10-17)

* Added instrumentation to bunyan to support application logging use cases: forwarding, local decorating, and metrics.
   
   Big thanks to @brianphillips for his contribution 🚀

* Added c8 to track code coverage.

* Added documentation about custom instrumentation in ES module applications

### v9.2.0 (2022-10-06)

* Added ability to instrument ES Modules with the New Relic ESM Loader.
  * [Example ESM application](https://github.com/newrelic/newrelic-node-examples/tree/main/esm-app)

* Added support for custom ESM instrumentation.
  * There is structure to registering custom ESM instrumentation.  Set the relative path to the instrumentation entry point via `api.esm.custom_instrumentation_entrypoint`
  * [Sample custom ESM instrumentation entrypoint](https://github.com/newrelic/newrelic-node-examples/blob/main/esm-app/custom-instrumentation/index.js)
  * All the `newrelic.instrument*` methods will still work except `newrelic.instrumentLoadedModule`.  This is because it is geared toward CommonJS modules. 

* Added test for asserting ESM loader functionality on ESM-only package

* Added supportability metric of `Supportability/Nodejs/Collector/MaxPayloadSizeLimit/<endpoint>` when `max_payload_size_in_bytes` configuration value is exceeded.

* Removed `application_logging.forwarding.enabled` stanza from sample config as the feature is now enabled by default.

### v9.1.0 (2022-09-22)

* Added [experimental loader](https://nodejs.org/api/esm.html#loaders) to support instrumentation of CommonJS packages in ECMAScript Module(ESM) applications.
  * It only supports versions of Node.js >= `16.12.0`.
  * It is subject to change due to its experimental stability.

* Enhanced supportability metrics for ESM support.
  * Added new metrics to track usage of ESM loader(`Supportability/Features/ESM/Loader` and `Supportability/Features/ESM/UnsupportedLoader`).
  * Updated instrumentation map to include an optional "friendly name" for tracking metrics.

* Enabled re-throwing ESM import errors of `newrelic.js` so that the user is informed to rename it to `newrelic.cjs`

* Fixed an issue with mongodb instrumentation where IPv6 address([::1]) was not getting mapped to localhost when setting the host attribute on the segment.

* Added a test ESM loader to properly mock out agent in versioned tests.

* Added ESM versioned tests for: `express`, `pg`, `mongodb`, and `@grpc/grpc-js`.

### v9.0.3 (2022-09-06)

* Updated gRPC client instrumentation to respect `grpc.record_errors` when deciding to log errors on gRPC client requests.

* Fixed transaction name finalization to properly copy the appropriate transaction name to root segment.

### v9.0.2 (2022-08-23)

* Added unit test suite for `lib/logger.js`.

* Added destructive integration test for Configuration instantiation.

* Added a special case to serialize BigInts when sending them to New Relic. BigInts can appear in log data that our customers may be trying to forward.

* Exposed  `compressed_content_encoding` configuration and defaulted it to "gzip".

* Fixed public jsdoc generation.

* Added`minami` back as a dev dependency for use with `jsdoc-conf.js`.

### v9.0.1 (2022-08-18)

* Fixed properly setting logging metrics when using custom levels with winston.

* Handled setting the logging metric name to `UNKNOWN` when using custom log levels in pino and/or winston.
    Thanks for your contribution @billouboq 🎉

* Removed unnecessary unit test and fixture for OSS license generation.

* Updated versioned tests to remove the use of the `async` module.

* Removed 3rd party `async` library from agent code.

### v9.0.0 (2022-08-03)

* Added official parity support for Node 18.

* **BREAKING**: Dropped Node 12.x support.  For further information on our support policy,
   see: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent

  * Upgraded `@newrelic/superagent` `@newrelic/aws-sdk` `@newrelic/koa` `@newrelic/native-metrics` and `@newrelic/test-utilities` to the latest major versions
  * Removed Node 12 from CI workflows.
  * Updated engines stanza to be `>=14`.
  * Updated all versioned tests stanza to be `>=14`
  * Converted `fs.rmdirSync` to `fs.rmSync` in `test/unit/config/config-location.test.js`.
  * Converted uses of `/dev/null` to `os.devNull` in tests.

* **BREAKING**: Removed certificate bundle from agent. The configuration value `config.feature_flag.certificate_bundle` will no longer work.

    The agent no-longer includes the New Relic certificate bundle when using the 'certificates' configuration (commonly with proxies). If you find this breaking your current environment, we recommend getting a CA bundle such as the one from Mozilla.

* **BREAKING**: The agent now excludes port when making external HTTPS requests to port 443 to be in compliance with the spec and other agents.

    Previous external segments would be named `External/example.com:443` when using default HTTPS port.
    The external segment will now be named `External/example.com`.

* **BREAKING**: Removed ability to disable async hooks based promise context tracking via the `await_support` feature flag. This also removes the legacy Promise instrumentation.

    Released the `await_support` feature flag. The agent now relies on async_hooks to track async promise propagation.  The net result is the if you had `feature_flag.await_support` set to false, the legacy instrumentation tracked every function in a promise chain as a separate segment.

* **BREAKING**: Removed instrumentation for the obsolete [oracle](https://www.npmjs.com/package/oracle) npm package.

* **BREAKING**: Updated the minimum version of `pg` to be 8.2.x.  This is the earliest support version that runs on Node 14+.

* **BREAKING**: Updated the minimum supported version of hapi to be >= v20.0.0. All versions < v20.0.0 are deprecated by hapi for security reasons, see their [support policy](https://hapi.dev/policies/support/).
  * Dropped tests for hapi < v20.0.0.

* Bumped `@newrelic/test-utilities` to ^7.0.0.

  This new version of test utilities defaults the number of concurrent jobs to currently available CPUs. For local development on modern machines, this can speed up full versioned test runs by 30-40%.

* Introduced JOBS ENV var for agent versioned test runs to control number of attempted concurrent test folder runs. Set to 4 for CI runs in GHA.

* Removed the async library from distributed tracing and pricing integration tests

### v8.17.1 (2022-08-02)
 * Fixed issue where instrumented code invoked within a @grpc/grpc-js client callback would not get tracked by the agent.

   Bound the external client segment to the onReceiveStatus listener to propagate transaction context to the grpc client callbacks.

 * Fixed issue with truncate in `lib/util/application-logging.js`. It now checks that the argument is a string before checking its length.

### v8.17.0 (2022-07-27)

* Added instrumentation for `grpc-js` server unary, client-streaming, server-streaming and bidirectional streaming handlers.

### v8.16.0 (2022-07-21)

* Automatic application log forwarding is now enabled by default. This version of the agent will automatically send enriched application logs to New Relic. To learn more about about this feature, see the [APM logs in context documentation](https://docs.newrelic.com/docs/apm/new-relic-apm/getting-started/get-started-logs-context/). For additional configuration options, see the [Node.js logs in context documentation](https://docs.newrelic.com/docs/logs/logs-context/configure-logs-context-nodejs). To learn about how to toggle log ingestion on or off by account, see our documentation to [disable automatic logging](https://docs.newrelic.com/docs/logs/logs-context/disable-automatic-logging) via the UI or API.

* Added a support statement to our release notes

* Added node 18 to CI workflows.

### v8.15.0 (2022-07-07)

* Added instrumentation for grpc-js unary, streaming, and bidirectional client calls.

* Added ability to disable server-side configuration via local configuration setting: `ignore_server_configuration` or environmental variable of `NEW_RELIC_IGNORE_SERVER_SIDE_CONFIG`.

* Added tests for client, server and bidirectional streaming of gRPC client.

* Updated [got](https://github.com/sindresorhus/got) from 8.3.2 to 11.8.5.

* Updated [moment](https://github.com/moment/moment) from 2.29.2 to 2.29.4

### v8.14.1 (2022-06-09)

* Added defensive code in redis v4 instrumentation to check for `opts.socket` first before evaluating `opts.socket.path`.
  Thanks @RAshidAZ for your contribution!

* Updated `@grpc/proto-loader` to v0.6.13 to pickup security fixes in protobufjs.

### v8.14.0 (2022-06-06)

* Fixed issue with `api.getBrowserTimingHeader` optional script unwrapping issue with util.format.
  Thanks for your contribution @github-dd-nicolas 🎉

* Fixed winston instrumentation to not exit early when `winston.createLogger` is created without options.

* Updated pino instrumentation to not override user log configurations.

### v8.13.2 (2022-05-31)

* Upgraded `protobufjs` to resolve  CVE-2022-25878

### v8.13.1 (2022-05-27)

* Fixed passing undefined as a formatter options to `winston.format.combine`

  Thanks to Rana Mohammad (@rjmohammad) for the contribution. 🎉

### v8.13.0 (2022-05-26)

* Moved log forwarding logic to a transport so customer transports are not polluted with NR linking metadata and timestamp and error manipulations.

* Prevented transmitting logs when application level logging has been disabled.

### v8.12.0 (2022-05-24)

* Added instrumentation to pino to support application logging use cases: forwarding, local decorating, and metrics.

* Added supportability metrics about the data usage bytes of harvested data to the collector endpoints.

* Added an optional way to avoid wrapping browser agent script with <script> tag when using `api.getBrowserTimingHeader`.  This will ease usage with Component based libraries like React.

  Thanks to @github-dd-nicolas for the contribution. 🎉

* Upgraded `@grpc/proto-loader` to fix a [CVE](https://security.snyk.io/vuln/SNYK-JS-PROTOBUFJS-2441248) with `protobufjs`.

* Upgraded `@newrelic/test-utilities` to resolve a dev-only audit warning.

### v8.11.2 (2022-05-23)

* Fixed winston instrumentation to no longer coerce every log line to be json.

### v8.11.1 (2022-05-13)

* Fixed an issue with winston instrumentation that caused agent to crash when creating a winston logger from an existing instantiated logger.

### v8.11.0 (2022-05-11)

* Added application logging for Winston in the Node.js agent

    * Ability to forward logs, send log metrics, and perform local log decoration

    * Added application log aggregator to collect logs with adaptive sampling and appropriate max samples stored.

    * Added `application_logging` configuration and env vars with appropriate defaults.

    * Added `application_logging.enabled` configuration value, defaulting to true.

    * Set `application_logging.forwarding.enabled` to false when High Security Mode (HSM) is set.

    * Enabled log forwarding by default in the example config.

    * Added sent, seen and dropped metrics that collected on every harvest cycle around log lines.

    * Added supportability metrics for some popular logging frameworks.

    * Added supportability metrics to record if the logging features are enabled.

    * Added a storage mechanisms to transactions to keep logs until transaction ends.

* Removed distributed tracing setting from example config

* Fixed a typo in lib/instrumentation/core/child_process.js
  Thanks to  Eito Katagiri (@eitoball) for the contribution

* Support automatic instrumentation of Redis v4

* Bumped [moment](https://github.com/moment/moment) from 2.29.1 to 2.29.2.

* Bumped `tap` to 16.x.

* Updated `ansi-regex` to resolve a dev dependency audit warning.

### v8.10.0 (2022-04-18)

* Added instrumentation for `mysql2/promise`.
   * This previously only existed in our standalone `@newrelic/mysql`, but now gives feature partiy between the two.

* Removed unused native CPU metric sampler.  This logic was no longer getting touched if running Node.js > 6.1.0.

* Fixed promise interceptor from re-throwing errors.

* Added transaction naming documentation ported from a discussion forum post: https://discuss.newrelic.com/t/relic-solution-the-philosophy-of-naming-your-node-agent-transactions/.

* Added `promises.tap.js` to mysql2 versioned tests.

* Updated @newrelic/test-utilities to latest.
 * Removed unused test file in restify versioned tests.
  * Added `--strict` flag to versioned test runner to properly fail CI runs when test files are not included.

### v8.9.1 (2022-03-22)

* Fixed `shim.wrapReturn` to call `Reflect.construct` in construct Proxy trap.  Also including `newTarget` to work with inherited classes.

* Added link to New Relic Node.js Examples repository.

* Excluded installing dependencies in `versioned-external` folders when running integration tests.

### v8.9.0 (2022-03-15)

* Added support for `initializeUnorderedBulkOp`, and `initializeOrderedBulkOp` in mongodb v3 instrumentation.

  Thanks to Denis Lantsman (@dlants) for the contribution.

* Updated logger to delay logging until configuration is parsed. The logger will now queue all log entries that occur before the agent can parse the configuration.

  Thanks to Cody Landry (@codylandry) for the contribution.

* Added `NEW_RELIC_ALLOW_ALL_HEADERS` as a boolean environment variable, same behavior as existing `allow_all_headers`.

* Updated the AWS IMDBS v2 endpoint to use `latest` to align with the internal agent specification.

* Bumped `@newrelic/koa` to ^6.1.1.

* Added Next.js to External Modules list in README.

* Updated mysql and mysql2 versioned tests to run against their own databases on the MySQL instance.

* Removed upper-bound testing from restify versioned tests so future major versions will be covered.

* Removed upper-bound testing from mysql2 versioned tests to cover existing and future major versions.

  Continues to skip version 1.6.2 which had a bug that broke tests which was resolved in 1.6.3.

* Updated @hapi/hapi Node 16 versioned test runs to run against @hapi/hapi >=20.1.2 so future major releases will be ran.

* Fixed sparse checkout of non-default branch for external versioned tests.

* Added external versioned tests for the Apollo Server plugin instrumentation.

* Added nock delay to test timeouts in utilization integration tests.

* Added newrelic-node-nextjs to external versioned tests to be run on every PR.

* Updated external version test running to support more test scenarios.
  * Adds `test/versioned-external` to lint ignore to avoid issues for scripts in tests that auto run linting tools (next/react).
  * Adds `index.js` and `nr-hooks.js` to files automatically checked-out for test runs.

### v8.8.0 (2022-02-23)

* Updated AWS metadata capture to utilize IMDSv2.

* Fixed link to discuss.newrelic.com in README

* Updated minimum Node version warning to output current Node version from process.

* Bumped `@newrelic/native-metrics` to ^7.1.1.

* Added `Nextjs` to a framework constant within the webframework-shim.

* Updated shim to pass active segment to inContext callback.

* Bumped `@grpc/grpc-js` to ^1.5.5.

* Bumped `@grpc/proto-loader` to ^0.6.9.

* Bumped `@newrelic/superagent` to ^5.1.0.

* Bumped `@newrelic/koa` to ^6.1.0.

* Bumped `async` to ^3.2.3.

* Resolved several npm audit warnings for dev deps.

* Fixed Post Release workflow by properly configuring git credentials so it can push API docs to branch
 * Added `set -e` in publish docs script to exit on possible failures
 * Removed redundant `npm ci` in publish API docs script

* Added ability to ignore certain PRs in `bin/pending-prs.js` report to slack

* Updated README to include `@newrelic/pino-enricher` as an external module.

* Fixed documentation in a sample of the Datastore Instrumentation for Node.js.

* Added a new `mongo:5` container to `npm run sevices` to test mongodb driver >=4.2.0.

* Fixed conditions in post release workflow to function when triggered via successful release and manual invoked.

* Updated method for retrieving agent version from repository by using `cat package.json | jq .version`

* Fixed minor formatting and spelling issues in `create-docs-pr.js`.

* Fixed an issue with the docs PR script that assumed `\n` in the NEWS.md file when extract version and release date

### v8.7.1 (2022-01-18)

* Bumped @newrelic/aws-sdk to ^4.1.1.

* Upgraded `@newrelic/test-utilities` to ^6.3.0.

  Includes `helpers.getShim` so sub packages properly execute.

* Resolved dependabot and certain npm audit warnings.

* Automation and CI improvements:
  * Added a script to be used by agent developers to add a PR to `docs-website` after the release of agent.
  * Changed the trigger for post release jobs.
  * Updated the `create-release-tag` script to pass in workflows to check before creating tag.
    * Fixed `create-release-tag` to properly filter out all async workflow run checks
    * Updated agent release to pass in a different list of workflows vs the default
  * Fixed release creation reusable workflow by passing in repo to `bin/create-release-tag.js` and `bin/create-github-release.js`.
  * Added `workflow_dispatch` to Agent Post Release workflow for manual testing.
  * Added a reusable workflow to create a release tag, publish to NPM and publish a GitHub release.
    * Updated agent release workflow to reference reusable workflow.
    * Added a new workflow to update RPM and publish API docs on a published release event type.


### v8.7.0 (2022-01-04)

* Updated `onResolved` instrumentation hook to only be called the first time we see a specific module filepath resolved.

* Removed `tracer.segment` in place of direct usage of context manager.

* Fixed an issue where multiple calls to `instrumentLoadedModule` resulted in re-instrumenting the same module.

* Fixed issue where `instrumentLoadedModule` would return `true` even if the instrumentation handler indicated it did not apply instrumentation.

* Added support metrics for tracking when instrumentation was applied per module.

  * `Supportability/Features/Instrumentation/OnResolved/<module-name>`
  * `Supportability/Features/Instrumentation/OnResolved/<module-name>/Version/<major version>`
  * `Supportability/Features/Instrumentation/OnRequire/<module-name>`
  * `Supportability/Features/Instrumentation/OnRequire/<module-name>/Version/<major version>`

* Fixed issue where expected status code ranges would not be parsed until ignored status codes were also defined.

* Added an input `changelog_file` to pass in name of changelog.  This defaults to `NEWS.md` but some repos use `CHANGELOG.md`

* Abstracted `bin/prepare-release.js` to work against other repositories.

* Added reusable prepare-release workflow that can be referenced in all other newrelic Node.js repositories.

* Updated pending PRs workflow to check all repos the team owns.

* Changed the event type from `pull_request` to `pull_request_target` to allow for auto assign of PRs to the Node.js Engineering Board

* Fixed add to board workflow to properly pass repository secrets into reusable board workflow.

* Changes token used to post issues to org level project board

* Runs versioned tests for external modules against tests defined in the external repository instead of tests published in npm modules.

* Added a reusable workflow to automatically add issues to the Node.js Engineering Board when created.

* Added CI job to update system configurations with new agent version on release.

* Moved `methods.js` under bluebird versioned test folder.

### v8.6.0 (2021-11-17)

* Added `onResolved` instrumentation hook to apply instrumentation prior to module load.

  This hook fires after the module filepath has been resolved just prior to the module being loaded by the CommonJS module loader.

* Fixed issue where `recordConsume` was not binding consumer if it was a promise

* Pinned mongo versioned tests to `<4.2.0` until we can address https://github.com/newrelic/node-newrelic/issues/982

* Introduced a context management API to be used in place of manually calling tracer.segment get/set.

### v8.5.2 (2021-11-09)

* Fixed issue where unhandled promise rejections were not getting logged as errors in a lambda execution

### v8.5.1 (2021-11-03)

* Fixed bug where failure to retrieve CPU/Memory details for certain Linux distros could result in a crash.

  `parseProcCPUInfo` and `parseProcMeminfo` now check for `null` input prior to processing.

* Updated README to favor using `-r` to load the agent vs `require('newrelic')`.

* Updated `@newrelic/test-utilities` to 6.1.1 and applied a global sampling value of 10 for versioned tests.

* Migrated utilization unit tests from mocha to tap.

* Migrated logger unit tests from mocha to tap.

* Cleaned up or added future removal comments for several deprecation warnings.

* Added a script and corresponding CI job that will check for PRs that have been merged and not release and notify the team in a private slack channel.

* Updated the versioned test runner to always run against minor versions.

* Fixed a high severity npm audit failure.

### v8.5.0 (2021-10-12)

* Added full support for Fastify v2 and v3. Fastify instrumentation is now GA.
  * Removed fastify feature flag.
  * Instrumented Fastify routes by wrapping `addHook`.
  * Added middleware mounting for fastify v3.
  * Fixed capturing of mount point for middleware naming.
  * Fixed the WebFramework spec definitions for Fastify middleware and route handlers to properly retrieve the IncomingMessage from a request object.
  * Added proper definition to middleware handlers so that the relationship to consecutive middleware and route handler are siblings and not direct children.

* Added experimental instrumentation for the [undici](https://github.com/nodejs/undici) http client behind a feature flag.

  To enable undici support, add the following into your config: `{ feature_flag: { undici_instrumentation: true } }`.  The support for undici client is Node.js 16.x as it takes advantage of the [diagnostics_channel](https://nodejs.org/dist/latest-v16.x/docs/api/diagnostics_channel.html). Lastly, you must be using [v4.7.0+](https://github.com/nodejs/undici/releases/tag/v4.7.0) of the undici client for any of the instrumentation to work.

  Note: There are currently some state issues if requests to an app are made with keep alive and you have multiple undici requests being made in parallel. In this case, set feature_flag: `{ undici_async_tracking: false }` which avoids these state issues at the cost of some broken segment nesting.

### v8.4.0 (2021-09-28)

* **Deprecation Warning**: Cross Application Tracing (CAT) has been deprecated and will be removed in a future major release. For applications that explicitly disable Distributed Tracing (DT) to leverage CAT, we recommend migrating to DT to avoid loss of cross-service visibility.
  * Disables CAT by default. You must explicitly enable CAT along with turning off DT.
  * Adds a deprecation warning when CAT is enabled and active (DT disabled).

* Fixed issue with `clearTimeout` that could result in dropping parent segments or spans.

  This bug resulted in some MongoDB calls being dropped from Transaction Traces and Distributed Traces (spans): https://github.com/newrelic/node-newrelic/issues/922.

* Removed warnings from agent tests for `no-var` eslint rule.

* Added support for Cassandra driver v4.0.0 and above.

* Fixed issue where DT headers would not be processed by `transaction-shim.handleCATHeaders()` when CAT was explicitly disabled. This primarily impacts `amqplib` instrumentation.

* Transitioned aws-lambda.test.js to use Tap over Mocha.

* Removed warnings from agent for `no-var` eslint rule.

* Refactored `transaction-shim`, `http` and `http-outbound` to use centralized CAT methods in `util/cat`

* Replaced http-outbound test call to use example.com to avoid unpredictable connection resets.

* Migrated sql query parser tests to tap

* Added more API usage examples.

* Added a README to the `examples/` folder discussing how to use the examples.

* Fixed `message-shim` test assertion to avoid flakiness based on precision differences(ms vs ns)

* Applied new lint rules barring the use of `var` and preferring the use of `const` wherever possible.

### v8.3.0 (2021-09-09)

* Enabled Distributed Tracing (DT) by default.
  * Added ability to configure the maximum number of spans that can be collected per minute via `span_events.max_samples_stored` and environment variable, `NEW_RELIC_SPAN_EVENTS_MAX_SAMPLES_STORED`.
  * Added supportability metric SpanEvent/Limit.

* Added support for properly setting the `host` and `port` for mongodb requests that are to cluster.

* Fixes issue where `.fastify` and `.default` properties would be missing from the `fastify` export when instrumented.

  Instrumentation now sets `.fastify` and `.default` properties to the wrapped `fastify` export function for fastify v3.

* Added the following environment variables for the corresponding configuration items:
  * **config item:** `transaction_events.max_samples_stored`
**env var:** `NEW_RELIC_TRANSACTION_EVENTS_MAX_SAMPLES_STORED`

  * **config item:** `custom_insights_events.max_samples_stored`
**env var:** `NEW_RELIC_CUSTOM_INSIGHTS_EVENTS_MAX_SAMPLES_STORED`

  * **config item:** `error_collector.max_event_samples_stored`
**env var:** `NEW_RELIC_ERROR_COLLECTOR_MAX_EVENT_SAMPLES_STORED`

* Converted several unit tests to use the tap API.

* Changed assertions for 2 http error msg tests to work with all versions of Node.js.

### v8.2.0 (2021-08-25)

* Added a new feature flag `unresolved_promise_cleanup` that defaults to true only when `new_promise_tracking` feature flag is set to `true`.  If disabled, this will help with performance of agent when an application has a lot of promises.  To disable set in your config `feature_flag.unresolved_promise_cleanup` to `false` or pass in the env var of `NEW_RELIC_FEATURE_FLAG_UNRESOLVED_PROMISE_CLEANUP=false` when starting application with agent.

    **WARNING**: If you set `unresolved_promise_cleanup` to `false`, failure to resolve all promises in your application will result in memory leaks even if those promises are garbage collected

* Supported using `connect` to route middleware calls.

* Removed stubbed out tests in memcached unit tests

* Refactored `dropTestCollections` in mongo versioned tests to await for all `dropCollection` operations to be finished before closing connection and returning.

* Ported remaining mocha tests in `test/unit/instrumentation` to exclusively use tap.

* Added `@newrelic/eslint-config` to rely on a centralized eslint ruleset.

* Removed integration tests for oracle.

* Converted config unit tests to fully use tap API and extracted related tests into more-specific test files.

* Added a pre-commit hook to check if package.json changes and run `oss third-party manifest` and `oss third-party notices`.  This will ensure the `third_party_manifest.json` and `THIRD_PARTY_NOTICES.md` up to date

* Replaced `JSV` with `ajv` for JSON schema validation in tests

* Removed `through` in lieu of core Node.js implementation of Transform stream in tests.

### v8.1.0 (2021-08-05)

* Added necessary instrumentation to support v4 of `mongodb`.
  * Explicitly enabled APM for `mongodb` instrumentation(`client.monitorCommands = true`)

* Fixed issue where Promise based `pg.Client.query` timings were always in sub-millisecond range.

* Fixed bug where `API.shutdown` would not harvest or keep process active effectively after an agent restart.

  The agent will now correctly update its state to 'started' after a reconnect has completed.

* Added an eslint rule to verify every file includes the copyright statement.

* Fixed the `homepage` field in package.json to use `https` in the link to the github repo. Thank you @pzrq for the contribution.

### v8.0.0 (2021-07-26)

* Added official parity support for Node 16.

* **BREAKING**: Dropped Node v10.x support. For further information on our support policy,
  see: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent.
  * Upgraded `@newrelic/superagent` `@newrelic/aws-sdk` `@newrelic/koa` `@newrelic/native-metrics` and `@newrelic/test-utilities` to the latest major versions.
  * Refactored creation of span event aggregator to prevent crash of gRPC when running on invalid Node.js version.
  * Added check for minimum `node` version >= 12.
  * Set package.json engines `node` field >= 12 and `npm` field to >=6.
  * Removed Node v10 from ci workflow and smoke-test version matrix.
  * Removed comments around replacing `temporarilyOverrideTapUncaughtBehavior` test helper function.
  * Removed non-applicable semver checks for versions the agents no longer supports.

* **BREAKING**: The agent no-longer includes the New Relic certificate bundle automatically when using the 'certificates' configuration (commonly with proxies). If you find this breaking your current environment, you may leverage a feature-flag to temporarily restore this functionality. Example configuration: feature_flag: { certificate_bundle: true }. In this case, we recommend getting a certificate bundle for your environment such as the one from Mozilla. The New Relic bundle and feature flag will be fully removed in next major release.
   * Defaulted config.feature_flags.certificate_bundle to false.

* **BREAKING**: Removed `serverless_mode` as a feature flag.

  The standard `serverless_mode` configuration still exists.

* Added hapi 19 and 20 to versioned tests for Node.js `>=12` and `<16`
 * Added hapi `^20.1.2` to versioned tests for for Node.js `>=16`

* Upgraded tap to v15.

* Upgraded https-proxy-agent to v5.0.0.

* Updated linting to always use latest LTS Node version.

* Updated CI and Smoke Test scripts to use setup-node@v2.

* Added `no-const-assign` to eslint ruleset.

* Pinned mongodb versioned tests to <4.0.0.

### v7.5.2 (2021-07-07)

* Fixed bug where promise-based cursor methods would not properly measure the duration of execution.

### v7.5.1 (2021-06-21)

* Fixed loading config from the main module's directory. Thank you @alexpls for the contribution.

* Moved all integration tests that required secrets to the smoke folder.

* Fixed LASP/CSP tests so they don't skip on runs where secrets are available.

* Modified self-signed SSL cert to use 'localhost' instead of 'ssl.lvh.me' for SSL testing.

* Removed unnecessary trace observer configuration validation for host and port.

### v7.5.0 (2021-06-01)

* Added default support for config files with a 'cjs' extension (`newrelic.cjs`) in addition to `newrelic.js`.

  Thank you to @Maddemacher for the contribution!

* Added ability to specify a custom config file name with the `NEW_RELIC_CONFIG_FILENAME` environment variable.

  Thank you to @Maddemacher for the contribution!

* Fixed issue when using the 'new_promise_tracking' feature flag where segment mapping may not get cleaned up for promises which never resolve but have all references removed (and thus get cleaned up by GC).

  Adds segment cleanup on 'destroy' when using 'new_promise_tracking' feature flag in addition to the existing 'promiseResolve' hook. Unfortunately, preventing leaks for this edge-case does come with additional overhead due to adding another hook. Memory gains from feature flag usage should still be worth the trade-off and reduced garbage collection may offset perf/CPU impacts or event still result in net gain, depending on the application.

* Bumped `@newrelic/test-utilities` to ^5.1.0.

* Replaced deprecated `util.isArray` with `Array.isArray`.

* Removed unused `listenerCount` method on `Shim`.

* Properly bootstraped husky as a `prepare` script.

* Removed commented-out console log from fastify instrumentation.

### v7.4.0 (2021-05-11)

* Updated third party notices and manifest for husky and lint-staged.

* Updated redis versioned tests to use unique DB indexes per file to avoid collisions and flushing of in-progress tests.

* Pinned hapi 17 versioned tests to only minor/patch versions within 17.x.

* Bumped timeout for redis versioned tests.

* Wired up husky + lint staged to execute linting on all changed files in pre-commit hook.

* Handled a proxy misconfiguration of collector and log an actionable warning message.

* Added `flaky_code` and `success_delay_ms` handling of flaky grpc connections to infinite tracing.

* Added resources to README to highlight external modules that customers should be aware of and possibly use for their applications.

* Logged all New Relic metadata env vars at startup.

* Fixed images for improved reader experience.

  Thank you to @henryjw for the contribution.

### v7.3.1 (2021-04-14)

* Fixed issue with 'new_promise_tracking' feature flag functionality where segments for ended transactions would get propagated in certain cases by promises that had no continuations scheduled (via await or manually).

  If you are experiencing high overhead levels with your promise usage and the agent attached, we recommend testing your application with  'new_promise_tracking' set to true to see if overhead is reduced. You'll also want to verify your data is still being captured correctly in case it falls into a known or unknown limitation of this approach.  **NOTE: chaining of promise continuations onto an already resolved promise across an async hop (scheduled timer) will result in state-loss with this new functionality turned on. This is a less-common use-case but worth considering with your applications.**

**Deprecation Warning:** The certificate bundle automatically included by New Relic when using the 'certificates' configuration (commonly with proxies) will be disabled by default in the next major version. This is currently targeted for sometime in May. The bundle will be fully removed in later major versions. We recommend testing with the 'certificate_bundle' feature flag set to `false` to determine if you will need to modify your environment or setup your own appropriate bundle. Example configuration: `feature_flag: { certificate_bundle: false }`.

### v7.3.0 (2021-04-06)

* Added new feature-flag 'new_promise_tracking' which enables cleaning up of segment references on native promise resolve instead of destroy. Includes usage of async-await. This can be enabled via `feature_flag: { new_promise_tracking: true }` in the config file or `NEW_RELIC_FEATURE_FLAG_NEW_PROMISE_TRACKING=1` in your ENV vars.

  Applications with heavy promise usage or high-throughput applications with some promise usage should see moderate to high reduction in memory usage and may see a slight reduction in CPU usage. A bump in throughput may also be noticed in some cases. Results will vary by application.

  If you are experiencing high overhead levels with your promise usage and the agent attached, we recommend testing your application with  'new_promise_tracking' set to true to see if overhead is reduced. You'll also want to verify your data is still being captured correctly in case it falls into a known or unknown limitation of this approach.  **NOTE: chaining of promise continuations onto an already resolved promise across an async hop (scheduled timer) will result in state-loss with this new functionality turned on. This is a less-common use-case but worth considering with your applications.**

* Fixed memory leak introduced when Infinite Tracing is enabled.

  When Infinite Tracing endpoints reconnected they would instantiate a new gRPC client prior to calling `client.recordSpan()`. It appears several objects created by grpc-js (`ChannelImplementation` and child objects, promises, etc.) are held in memory indefinitely due to scheduled timers even when the client is no-longer referenced and the associated stream closed. We now avoid this situation by only creating the client once and then reusing it to establish new stream connections.

### v7.2.1 (2021-03-29)

* Dev-only sub-dependency bump of 'y18n' to clear npm audit warnings.

* Bumped @grpc/grpc-js to ^1.2.11.

* Bumped @grpc/proto-loader to ^0.5.6.

* Agent no longer propagates segments for promises via async-hooks when the transaction associated with the parentSegment has ended.

  This change reduces the amount of context tracking work needed for certain rare edge-case scenarios involving promises.

* Fixed issue where capturing axios request errors could result in a memory leak.

  The agent now clears error references on transaction end, which are not used for later processing. Errors returned from 'axios' requests contain a reference to the request object which deeper down has a handle to a promise in `handleRequestError`. The TraceSegment associated with that promise has a handle to the transaction, which through the error capture ultimately kept the promise in memory and prevented it from being destroyed to free-up the TraceSegment from the segment map. This change also has the benefit of  freeing up some memory early for transactions held onto for transaction traces.

* Added active transaction check to `wrappedResEnd` to prevent unecessary work for ended transactions in the case of multiple `Response.prototype.end()` invocations.

### v7.2.0 (2021-03-23)

* Added feature flag to allow disabling of certificate bundle usage.

  **Deprecation Warning:** The certificate bundle included by New Relic will be disabled by default and then fully removed in later major versions. We recommend testing with the certificate_bundle feature flag set to `false` to determine if you will need to modify your environment or setup your own appropriate bundle. Example configuration: `feature_flag: { certificate_bundle: false }`.

* The `NEW_RELIC_NO_CONFIG_FILE` environment variable is no longer needed to run the agent without a configuration file.

  * If a configuration file is used with agent configuration environment variables, the environment variables will override the corresponding configuration file settings.

* Fixed bug where applications with multiple names on a dynamically named host (UUID like) would have instances consolidated, losing per-host breakdowns.

  Removed 'host' from agent 'identifier' override to prevent server safety mechanism from kicking in. Host will still be used to identify unique agent instances, so was unnecessary to include as part of the identifier. This also resulted in additional processing overhead on the back-end. The identifier override is still kept in place with multiple application names to continue to allow uniquely identifying instances on the same host with multiple application names where the first name may be identical. For example `app_name['myName', 'unique1']` and `app_name['myName', 'unique2']`. These names would consolidate down into a single instance on the same host without the identifier override.

* Fixed bug where truncated http (external) or datastore segments would generate generic spans instead of appropriate http or datastore spans.

* Set distributed tracing to enabled in the `newrelic.js` template configuration file supplied with the agent.

* Added module root to shim.require() logging to aid debugging.

* Migrated from .npmignore to 'files' list in package.json to control which files are packaged.

  Thank you to @JamesPeiris for the initial nudge via PR to move in this direction.

* Converted remaining collector unit tests to use tap API.

* Added linting to scripts in /bin folder.

  Linting rules added are slightly more permissive than production rules and allow full ecma 8.

* Added new developer documentation to /docs folder.

  This information is ported over from private GHE wiki used prior to going open source. S/O @astorm for original versions of the function wrapping and module instrumentation docs.

### v7.1.3 (2021-03-09)

* Bumped @grpc/grpc-js to ^1.2.7.

* Removed index-bad-config test which tested a no-longer possible use-case.

* Removed license-key test logic from serverless-harvest test.

  Serverless mode does not require a license key as data transfer is handled by the integration.

* Added support metric to be able to track usage of cert bundle via usage of custom certificates.

* Removed requirement to configure application name when running in AWS Lambda (serverless mode).

  Application name is not currently leveraged by New Relic for Lambda invocations. The agent now defaults the application name in serverless mode to remove the requirement of end-user configuration while handling cases if it were to be leveraged in the future.

* Stopped binding/propagating segments via `setImmediate` for ended transactions.

* Fixed bug where agent would attempt to call the 'preconnect' endpoint on the redirect host returned by the previous 'preconnect' call when reconnecting to the New Relic servers.

  The 'preconnect' calls will now always use the original agent configuration value. Subsequent endpoints (connect, harvest endpoints, etc.) will continue to leverage the new redirect host value returned by 'preconnect.' The original config values are no-longer overridden.

* Fixed issue where a call to `transaction.acceptDistributedTraceHeaders` would throw an error when the `headers` parameter is a string.

* Improved clarity of logging between 'no log file' or disabled agent startup issues.

  * Logs no-config file error to initialized logger (stdout) in addition to existing console.error() logging.
  * Adds specific message to no config file separate from being disabled.

* Removed aws-sdk versioned test filtering.

* Removed unused Travis CI scripts.

### v7.1.2 (2021-02-24)

* Fixed bug where the agent failed to reconnect to Infinite Tracing gRPC streams on Status OK at higher log levels.

  Node streams require all data be consumed for the end/status events to fire. We were only reading data at lower log levels where we'd use/log the data. This resulted in a failure to reconnect and 'ERR_STREAM_WRITE_AFTER_END' errors. The agent now always listens to the 'data' event, even if not logging, and will also reconnect (with 15 second delay) on any 'ERR_STREAM_WRITE_AFTER_END' error.

* Removed initial harvest send() call on streaming span event aggregator to prevent warning in logs.

* Bumped @newrelic/aws-sdk to ^3.1.0.

### v7.1.1 (2021-02-01)

* Upgrade @grpc/grpc-js to v1.2.5 to fix non-propagation of internal http2 errors
  Now allows minor and patch auto-updates.

* Added workflow for publishing to npm when a v* tag is pushed to the repo.

* Fixes resolveMx test by using example.com for a valid exchange.

### 7.1.0 (2021-01-05):

* Fixed SQL traces being generated with invalid ID.
* Fixed log message for minimum supported Node.js version.
* Added Fastify v3 support.
* Fixed empty log message for Infinite Tracing connections.
* Upgraded grpc version.
* Fixed bug that prevented users from changing Infinite Tracing queue size.

### 7.0.2 (2020-12-01):

* Fixed a bug where the `http.statusCode` attribute was not being captured for an async invoked lambda.
* Fixed typos in code comments, documentation, and debugging logger messages.
  Thank you @TysonAndre for the contribution.

### 7.0.1 (2020-11-17):

* Fixed a bug where spans queued up during backpressure situations would be improperly formatted and ultimately dropped when sent to an Infinite Tracing trace observer.
* Updated @grpc/grpc-js to version v1.2.0.
* Updated tap to clear up npm audit issues around lodash sub-dependency.

### 7.0.0 (2020-11-09):

* Added official parity support for Node 14

* Dropped Node v8.x support. For further information on our support policy,
  see: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent.
  * Removed Node v8.x from CI
  * Adds check that minimum Node version is >=10 and warns if >=15
  * Sets Node engine to >=10
  * **BREAKING** Dropped support for Node v8.x HTTP get() function signature
    * strictly uses global.URL class in http core instrumentation
    * removes Nodejs 8.x - 9.x checks
  * Update New Relic Dependencies to versions with updated Node version support
    * @newrelic/aws-sdk v3.0.0
    * @newrelic/koa v5.0.0
    * @newrelic/native-metrics v6.0.0
    * @newrelic/superagent v4.0.0
    * @newrelic/test-utilities v5.0.0

* **BREAKING** Removed deprecated setIgnoreTransaction API method

* **BREAKING** Removed deprecated httpResponseCode, response.status and
  httpResponseMessage http response attributes

* **BREAKING** Removed the api.custom_parameters_enabled configuration item and
  associated environment variable NEW_RELIC_API_CUSTOM_PARAMETERS. Please use
  api.custom_attributes_enabled instead

* **BREAKING** Removed deprecated Distributed Tracing API methods,
  createDistributedTracePayload() and acceptDistributedTracePayload()

* Finalized removal of ignored_params and capture_params

* Added additional logging to W3C Trace Context header creation

### 6.14.0 (2020-10-28):

* Updated README for consistency.

* Fixed issue where gRPC connection used for infinite tracing could throw if the server
  shutdown during disconnect of an existing connection.

* Bumped @grpc/grpc-js to 1.1.7.

* Bumped @grpc/proto-loader to ^0.5.5.

* Infinite tracing logging and support metric improvements.

  * Increased logging level of certain infinite tracing / gRPC errors.
  * Decreased logging interval of dropped span warning for infinite tracing.
  * Added additional support metrics and logging for infinite tracing.

* Fixed bug where errors would still be collected for transactions with ignored error
  status codes in certain situations.

* Converted errors ignore unit tests to tap API.

* Added Node 14 to CI test coverage.

  Many thanks to @jgeurts for the contribution.

### 6.13.2 (2020-10-13):

* Removed lodash as a development dependency

* Check for named pipe existence before each flush

  This removes the cached value used in 6.13.1

* Update shim documentation

  Thank you to @ronen-e for the contribution!

### 6.13.1 (2020-09-24):

* Fixed named-pipe check for lambda invocations to avoid race-condition.

  Named-pipe existence will now be checked just prior to first write and then cached.

* Updated README with community-plus header.

* Updated README config copy example.

* Added Open Source Policy workflow.

* Removed repository CoC in favor of centralized CoC at org root.

### 6.13.0 (2020-08-25):

* Added ability for the agent to write to a named pipe, instead of stdout, when in serverless mode.

### 6.12.1 (2020-08-20):

* **Security fix:** Resolves an issue where transaction traces will still capture the request URI when the Node.js agent is configured to exclude the 'request.uri' attribute. This can be problematic for certain customers in environments where sensitive information is included in the URI. See security bulletin [NR20-02](https://docs.newrelic.com/docs/security/new-relic-security/security-bulletins/security-bulletin-nr20-02).

  The request URI will now be excluded from transaction traces if the 'request.uri' attribute has been set to be excluded at either the top-level 'attributes.exclude' configuration or at the 'transaction_tracer.attributes.exclude' configuration.

### 6.12.0 (2020-08-11):

* Fixes obfuscation of SQL queries with large data inserts.
Special thanks to Tomáš Hanáček (@tomashanacek) for tracking down the issue and providing the fix.
* On failed instrumentation, prevent multiple requires from re-wrapping shims.
Special thanks to Ryan Copley (@RyanCopley) for the contribution.
* Upgrade `async` to `v3.2.0`. Special thanks to Yohan Siguret (@Crow-EH) for the contribution
* Bumped `@newrelic/native-metrics` to `^5.3.0`.
* Bumped `@newrelic/aws-sdk` to `^2.0.0`.
* Bumped `node-test-utilities` to `^4.0.0`.
* Bumped `@newrelic/superagent` to `^3.0.0`.
* Bumps `@newrelic/koa` to `^4.0.0`.
* Updated `SECURITY.md` with coordinated disclosure program link.
* Updated guidelines and templates for contributing to the project.

### 6.11.0 (2020-07-07):

* Updated to Apache 2.0 license
* Added CODE_OF_CONDUCT.md file
* Streamlined README.md file
* Updated CONTRIBUTING.md file
* Added additional guidance to bug report template
* Added copyright headers to all source files
* Added Distributed Tracing option to config file used for first time customers
* Converted some test files to Node-tap
* Removed "hidden" and unused code injector diagnostic capability
* Upgraded @grpc/grpc-js from 1.0.4 to 1.0.5

### 6.10.0 (2020-06-22):

* Additional Transaction Information applied to Span Events
  * When Distributed Tracing and/or Infinite Tracing are enabled, the Agent will now incorporate additional information from the Transaction Event on to the currently available Span Event of the transaction.
    * The following items are affected:
      * `aws-lambda` related attributes
      * `error.message`
      * `error.class`
      * `error.expected`
      * `http.statusCode`
      * `http.statusText`
      * `message.*`
      * `parent.type`
      * `parent.app`
      * `parent.account`
      * `parent.transportType`
      * `parent.transportDuration`
      * Request Parameters `request.parameters.*`
      * `request.header.*`
      * `request.method`
      * `request.uri`
  * Custom Attributes
    * Custom transaction attributes added via `API.addCustomAttribute` or `API.addCustomAttributes` will now be propagated to the currently active span, if available.
  * **Security Recommendation:**
    * Review your Transaction Event attributes configuration. Any attribute include or exclude setting specific to Transaction Events should be applied to your Span Attributes configuration or global attributes configuration. Please see [Node.js agent attributes](https://docs.newrelic.com/docs/agents/nodejs-agent/attributes/nodejs-agent-attributes#configure-attributes) for more on how to configure.
* Upgraded @grpc/grpc-js from 1.0.3 to 1.0.4
* Modified redis callback-less versioned test to use `commandQueueLength` as indicator redis command has completed and test can continue. This is in effort to further reduce these test flickers. Additionally, added wait for client 'ready' before moving on to tests.
* Updated force secret test runs to run on branch pushes to the main repository.

### 6.9.0 (2020-06-08):

* Added AWS API Gateway V2 Support to lambda instrumentation.

* Added 'transaction.name' intrinsic to active span at time transaction name is finalized.

  This enables finding transaction name for traces that may not have a matching transaction event.

* Added 'error.expected' attribute to span active at time expected error was noticed.

* Dropped errors earlier during collection when error collection is disabled.

  Error attributes will no longer show up on spans when error collection has been disabled. Other unnecessary work will also be avoided.

* Removed allocation of logging-only objects used by transaction naming when those log levels are disabled.

* Upgraded escodegen from 1.12.0 to 1.14.1.

* Upgraded readable-stream from 3.4.0 to 3.6.0.

* Upgraded @grpc/proto-loader from 0.5.3 to 0.5.4.

* Converted facts unit test to use tap API.

* Converted transaction 'finalizeName...' unit tests to use tap API.

* Added several items to .npmignore to prevent accidental publishing.

* Fixed Redis client w/o callback versioned test flicker.

  Doesn't end transaction until error encountered. Increases wait time for first operation which has to complete for the second operation to be successful.

### 6.8.0 (2020-05-21):

* Bumped @newrelic/native-metrics to ^5.1.0.

  Upgraded nan to ^2.14.1 to resolve 'GetContents' deprecation warning with Node 14. This version of the native metrics module is tested against Node 14 and includes a pre-built binary download backup for Node 14.

* Added whitespace trimming of license key configuration values.

  Previously, when a license key was entered with leading or trailing whitespace, it would be used as-is and result in a validation failure. This most commonly occurred with environment variable based configuration.

* Moved to GitHub actions for CI.

* Updated PR template and added initial issue templates.

* Converted most of the collector API unit tests to use the tap API. Split larger test groupings into their own test files.

### 6.7.1 (2020-05-14):

* Added synthetics headers to transaction event intrinsics for DT

* Fixed stale comment documentation with regards to segment recording

### 6.7.0 (2020-05-06):

* Added a configurable-length span queue to Infinite Tracing:
  infinite_tracing.span_events.queue_size.

  The queue length can be modified to balance the needs of keeping full traces
  against trade-off of memory usage and CPU overhead in a high-throughput
  application.

* Fixed issue where API.instrumentLoadedModule could throw an exception when it
  failed.

  Error details will now be caught and logged.

* Resolved non-proxy minimist security warnings by bumping dependencies.

  These updates only impact development dependencies. Thank you to @devfreddy for
  the contribution.

  * Updated minimist sub-deps to resolve most related security warnings.
  * Updated tap to resolve remaining tap security warnings.
  * Updated @newrelic/proxy.

* Updated remaining /api unit tests to use tap API.

* Updated @grpc/grpc-js to v1.0.3.

### 6.6.0 (2020-04-20):

* Added support for [Infinite Tracing on New Relic
  Edge](https://docs.newrelic.com/docs/understand-dependencies/distributed-tracing/enable-configure/enable-distributed-tracing).

  Infinite Tracing observes 100% of your distributed traces and provides
  visualizations for the most actionable data so you have the examples of errors
  and long-running traces so you can better diagnose and troubleshoot your systems.

  You configure your agent to send traces to a trace observer in New Relic Edge.
  You view your distributed traces through the New Relic’s UI. There is no need to
  install a collector on your network.

  Infinite Tracing is currently available on a sign-up basis. If you would like to
  participate, please contact your sales representative.

* Added `function_version` to lambda metadata payload.

  This is pulled from an invocation's `context.functionVersion` value.

### 6.5.0 (2020-03-18):

* Added error attributes to spans.
  * The public api method `noticeError()` now attaches exception details to the currently executing
    span. Spans with error details are now highlighted red in the Distributed Tracing UI. Also, the
    attributes `error.class` and `error.message` are added to the span. If multiple errors are
    recorded for a single span, only the final error's attributes will be added to the span.

  * Added ID of the span in which an error occurred to the corresponding transaction error event.

* Added new public API methods `addCustomSpanAttribute` and `addCustomSpanAttributes` to add
  attributes to the currently executing span.

* Added new attributes to http outbound spans: `http.statusCode` and `http.statusText`.

* Updated W3C Trace Context "Known Issues and Workaround" notes with latest accurate consideration.

* Converted unit tests to run via `tap`. Removes `mocha` dependency.

* Fixed route naming when hapi's `pre` route handlers share functions.

* Fixed `child_process` instrumentation so that handlers can be effectively removed
  when attached via `.once()` or manually removed via `removeListener()`.

### 6.4.2 (2020-02-27):

* Support new http[s] get/request function signature in Node v10+

* Added the following Span Event attributes:
  - http.statusCode
  - http.statusText

  The above attributes will be replacing the following *deprecated* attributes:
  - httpResponseCode
  - response.status
  - response.statusMessage

  The deprecated attributes will be removed with the next major release of the Agent.

* Updates version check to be in alignment with [our stated support
  policy](https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent)
  and the version constraints in package.json

* Redacts individual certificates configuration values before sending to server
  settings. When configured, these values will now appear like: `{certificates.0: ****}`.

### 6.4.1 (2020-02-20):

* Bumped `@newrelic/aws-sdk` version to `v1.1.2` from `v1.1.1`.
  https://github.com/newrelic/node-newrelic-aws-sdk/blob/master/CHANGELOG.md

  Notable improvements include:
  * Fixed issue where instrumentation would crash pulling `host` and `port` values
  when `AmazonDaxClient` was used as the service for `DocumentClient`.

* Prevented passing CI with `.only()` in mocha tests.

* Removed CI restriction for Node `12.15`. Node shipped a fix for the `12.16`
  breakage in `12.16.1`.

* Removed calls to `OutgoingMessage.prototype._headers` in favor of using public
  `getHeaders` API (thanks to @adityasabnis for bringing this to our attention).

* Removed engine upper-bound to enable easier experimentation of newer Node versions
  with the agent for customers.

  Please see https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent for officially supported versions.
  Incompatibilities are expected for odd-numbered releases, which are not supported,
  and even-numbered releases before "official" support has been released.

* Reduced "... Aggregator data send." log messages to `debug` level to reduce noise
  of default logs.

* Fixed issue where disabled agent would return an empty string instead of an empty
  object from API#getLinkingMetadata().

  This issue would cause the `@newrelic/winston-enricher` module to crash when
  attempting to inject log metadata.

* Reduced logging level of raw `x-queue-start` or `x-request-start` header values
  to avoid logging very large values at default logging levels.

### 6.4.0 (2020-02-12):

* Added support for W3C Trace Context, with easy upgrade from New Relic trace
  context.

  * Distributed Tracing now supports W3C Trace Context headers for HTTP protocols
    when distributed tracing is enabled. Our implementation can accept and emit both
    the W3C trace header format and the New Relic trace header format. This simplifies
    agent upgrades, allowing trace context to be propagated between services with older
    and newer releases of New Relic agents. W3C trace header format will always be
    accepted and emitted. New Relic trace header format will be accepted, and you can
    optionally disable emission of the New Relic trace header format.

  * When distributed tracing is enabled with `distributed_tracing.enabled: true`,
    the Node agent will now accept W3C's `traceparent` and `tracestate` headers when
    calling `TransactionHandle#acceptDistributedTraceHeaders` or automatically via
    `http` instrumentation. When calling `Transaction#insertDistributedTraceHeaders`,
    or automatically via `http` instrumentation, the Node agent will include the W3C
    headers along with the New Relic distributed tracing header, unless the New Relic
    trace header format is disabled using `distributed_tracing.exclude_newrelic_header:true`.

  * Added `TransactionHandle#acceptDistributedTraceHeaders` API for accepting both
    New Relic and W3C TraceContext distributed traces.

    Deprecated `TransactionHandle#acceptDistributedTracePayload` which will be removed
    in a future major release.

  * Added `TransactionHandle#insertDistributedTraceHeaders` API for adding outbound
    distributed trace headers. Both W3C TraceContext and New Relic formats will be
    included unless `distributed_tracing.exclude_newrelic_header: true`.

    Deprecated `TransactionHandle#createDistributedTracePayload` which will be removed
    in a future major release.

  Known Issues and Workarounds

  * If a .NET agent is initiating distributed traces as the root service, you must update
    that .NET agent to version `8.24` or later before upgrading your downstream Node
    New Relic agents to this agent release.

* Pins Node 12 version to `v12.15` to avoid breakages with `v12.16.0` until cause(s)
  resolved.

* AWS Lambda Improvements

  * Fixed issue where lambda invocation errors were not noticed in Node 10 or Node 12 environments.
  * Added collection of additional AWS Lambda event source meta data.
  * Added event type detection for lambda invocation events.
  * Expanded ARN harvest to include ALB and CloudWatch.

* Improved Transaction and Trace ID generation.

* Updated publish-docs script to use `npm run` instead of `make`.

### 6.3.0 (2020-01-27):

* Bumped `@newrelic/aws-sdk` to `v1.1.1` from `v1.0.0`.
 https://github.com/newrelic/node-newrelic-aws-sdk/blob/master/CHANGELOG.md
 Notable improvements include:
   * Added official support for API promise calls, fixing two critical bugs.
   * Added check before applying instrumentation to avoid breaking for very old
  versions.

* Added `bindPromise()` to `Shim` prototype for direct usage by instrumentation.
 Previously, `_bindPromise()` was a private function in the `Shim` module.

* Fixed spelling in configuration error.
  Thank you to David Ray (@daaray) for the contribution.

* Fixed long-log truncation issue in Serverless mode.

* Updated language in agent to be in line with New Relic Standards.

### 6.2.0 (2019-11-25):

* Upgraded `tap` to resolve `handlebars` audit warnings.

* Added `getLinkingMetadata()` method to the API.

  This new method can be used to retrieve the identifying information for the
  agent and current active span and trace. Please consult [the documentation](https://docs.newrelic.com/docs/agents/nodejs-agent/api-guides/nodejs-agent-api#getLinkingMetadata)
  for more information.

* Added `getTraceMetadata()` to the agent API.

  This new method can be used to retrieve the current active Distributed Tracing
  span and trace ids. Please consult [the documentation](https://docs.newrelic.com/docs/agents/nodejs-agent/api-guides/nodejs-agent-api#getTraceMetadata)
  for more information.

* Added an `isSampled()` method to `Transaction` and `TransactionHandle`.

  This new method can be used to retrieve the sampling decision made for a given
  transaction. Please consult [the documentation](https://docs.newrelic.com/docs/agents/nodejs-agent/api-guides/nodejs-agent-api#transaction-handle-isSampled)
  for more information.

### 6.1.0 (2019-11-05):

* `@newrelic/native-metrics` module is defaulted to disabled in serverless mode.

  This can reduce lambda cold-start times by up to 170ms. The `native-metrics` module
  can rarely load in serverless environments due to differences from build environment to
  deployed environment and offers little value in a serverless environment.

* Added env var `NEW_RELIC_NATIVE_METRICS_ENABLED` to enable/disable the
  native-metrics module

* Added a test for querying poolCluster.of()

* Removed unused `mysql` bootstrap test code.

* Increased timeout for `index-bad-version` test to reduce flickers on Node 12.

* Changed file modification to leverage `writeFile` for `watchFile` test. This
  triggers the watcher in a reasonable amount of time much more consistently.

* Added `@newrelic/aws-sdk` module to agent for auto-include on install.

* Added splitting of application name using semicolons in the env var.

* Removed testing of Bluebird 3.7 on Node v10 until they fix [the segfault
  issue](https://github.com/petkaantonov/bluebird/issues/1618).

* Instrumented `connection.execute` for `mysql2`.

* Added HTTP method to segment attributes for external requests.

* Updated the `bin/ssl.sh` such that it uses verbose output, will exit on first
  error code, and will refuse to proceed with LibreSSL (which can't generate certs).

* Added a `clear` sub-command to `bin/ssl.sh` that will allow developers to quickly
  remove generated ssl/cert files and regenerate (useful is switch between platforms
  via containers/docker and certs needs to be regenerated)

### 6.0.0 (2019-10-29):

* Added official parity support for Node 12.
  * Exception: Errors resulting in unhandled rejections will no longer be scoped to the
  transaction that was active when the rejected promise was created.

    As of node 12, the promise responsible for triggering the init async hook will
  no longer be passed through on the promise wrap instance. This breaks the linkage
  used to relate a given promise rejection to the transaction it was scheduled in.

* **BREAKING** Removed support for Node 6, 7, and 9.

  The minimum supported version is now Node v8. For further information on our
  support policy, see:
  https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent.

  * Bumped version of `@newrelic/superagent` instrumentation to `v2.0.0`.
  * Bumped version of `@newrelic/native-metrics` to `v5.0.0`.

* **BREAKING** Bumped version of `@newrelic/koa` instrumentation to `v3.0.0`
  `@newrelic/koa` update includes changes to transaction naming in addition to
  dropping Node versions 6, 7, and 9. See `@newrelic/koa`release notes for what was
  included in `v2.0.0` and `v3.0.0` updates. https://github.com/newrelic/node-newrelic-koa/blob/master/NEWS.md.

* **BREAKING** `max_samples_stored` behavior has changed to replace
  `max_samples_per_minute`. `max_samples_per_minute` is no longer a configuration
  parameter.

  The new behavior for `max_samples_stored` is as follows: "The agent will collect
  all events up to this number per minute. If there are more than that, a statistical
  sampling will be collected." This usage of the configuration is consistent with
  other agents.

  If your application has previously used `max_samples_per_minute` as an upper bound,
  you may need to lower the threshold to a valid maximum to avoid data being dropped
  on the server. No larger than 10k is recommended.

* Updated utilization callback test to point to a host that can't represent a valid
  provider. Previously, location where CI provider runs tests could cause test to
  fail.

* Added support for `Promise.allSettled()` method in Bluebird 3.7.

* Bumped `mongodb` dev dependency past security warning.

* Fixed `mongodb` versioned tests so they are self-contained by using version under
  test for setup/teardown instead of agent dev-dependency version.

* Forced filename resolution if not already cached on module load. This should not
  occur in normal/non-test scenarios but provides a fall-back to maintain
  functionality.

* Refactored `restify` versioned tests to be less dependent on the order of asynchronous
  operations.

* Updated README to reference Pug rather than Jade.

### 5.13.1 (2019-10-10):

* Added back generation of entity stats logging and uninstrumented support metric
  generation on metric harvests.

* Removed legacy harvest code from main agent.

* Updated `https-proxy-agent` to v3 for security fix.

  Shoutout to @asturur for the contribution.

* Added diagnostic code injector.

  The agent may now be configured to make transaction state checks via code
  injection. This may be turned on by setting `code_injector.diagnostics.enabled`
  to `true`. While this option is enabled, code around async boundaries will be added
  to track transactions, and log a message when they are not properly reinstated.

* Fixed bug where `API.shutdown()` would not properly harvest when configured to.

* `primary_application_id` now defaults to 'Unknown' in serverless mode to allow
  Distributed Tracing to function correctly when `NEW_RELIC_PRIMARY_APPLICATION_ID`
  is not defined.

* Upgraded `tap` to latest version

* Upgraded `mocha` to latest version.

* Adds `--exit` flag to mocha test runs to prevent infinite runs on CI.

* Fixed bug where multiple agent restarts would cause the number of 'stopped'
  listeners to exceed limit.

* Fixed inconsistent async return from collector API.

  This could result in an infinite loop due to attempting to merge before clearing.
  *This bug should not have impacted normal agent runs but was uncovered for certain
  test cases.*

* Fixed tests that leave work scheduled on the event loop.

* Fixed issue that could result in vendor utilization detection failure.
  As a part of this fix, the request that hits the timeout will immediately abort
  instead of hanging around for the default timeout.

### 5.13.0 (2019-10-01):

* Same as 5.12.0

### 5.12.0 (2019-10-01):

* Now supports Restify 7 and 8.

* Distributed Tracing is now enabled by default in serverless mode.

* Maximum event limits are now enforced by the server. This includes
  a new maximum of 10000 transaction events per minute.

* Harvesting is now completed by individually scheduled harvesters per data type.

* Bumps tap version to move beyond handlebars audit warning.

* Bumps `restify` dev dependency past audit warning.

* HTTPS connections to New Relic now use a keep alive HTTP-Agent.

* Drops old odd-numbered node versions that are no longer supported by node from
  travis testing.

* Fixed bug where segment reference on the outbound request was enumerable.

* Fixed bug where incorrect config information was sent to New Relic.

* Updated Mocha and Docker links in CONTRIBUTING.md.

* The agent will now end/serialize transactions in the event of an uncaught
  exception while operating in serverless mode.

### 5.11.0 (2019-07-29):

* Implements Expected and Ignored Errors functionality

* Bumps jsdoc and lodash dev dependency to avoid upstream vulnerability warning.

* Added support for scoped package name introduced in hapi v18 (@hapi/hapi).

  This will provide functionality at parity with instrumentation for hapi v17. Any
  new features may not yet be supported.

 Huge shoutout to Aori Nevo (@aorinevo) for this contribution.

* Fixed bug where agent would count errors towards error metrics even if they were
  dropped due to the error collector being disabled.

* The agent will now properly track cached paths to files in loaded modules on Node
  versions >10.

  As of Node v11, the path to a file in a module being loaded will only be resolved
  on the first load; subsequent resolution of that file will use a cached value.
  The agent records this resolved path and uses it for relative file look ups in
  order to deep link into modules using `Shim#require`. Since the agent couldn't
  reliably get at the path on the subsequent calls to require, it now replicates
  the caching logic and hold onto the resolved path for a given file.

* Adds detailed logging through harvest/collector code to increase supportability.

### 5.10.0 (2019-06-11):

* The agent now allows installation on node v11 and v12.

  This change relaxes the engines restriction to include Node v11 and v12. This does
  not constitute official support for those versions, and users on those versions
  may run into subtle incompatibilities. For those users who are interested in
  experimenting with the agent on v11 and v12, we are tracking relevant issues
  here: https://github.com/newrelic/node-newrelic/issues/279.

* Lambda invocations ended with promises will now be recorded properly.

  Previously, the lambda instrumentation was not intercepting the promise
  resolution/rejection returned from a lambda handler. The instrumentation now
  properly observes the promise, and ends the transaction when the promise has
  finished.

* Lambda invocations will only attempt to end the related transaction a single time.

  In the event of two lambda response events (e.g. callback called, and a promise
  returned), the agent would attempt to end the transaction twice, producing an
  extraneous empty payload. The agent now limits itself to a single end call for
  a given transaction.

* The agent will now properly end transactions in the face of uncaught exceptions
  while in serverless mode.

* Enables ability to migrate to Configurable Security Policies (CSP) on a per agent
  basis for accounts already using High Security Mode (HSM).

  When both HSM and CSP are enabled for an account, an agent (this version or later)
  can successfully connect with either `high_security: true` or the appropriate
  `security_policies_token` configured. `high_security` has been added as part of
  the preconnect payload.

### 5.9.1 (2019-05-28):

* moved third party notices to `THIRD_PARTY_NOTICES.md`

* Shim#require will now operate as expected.

  Previously, the module interception code made the faulty assumption that a module's
  filepath would be resolved before the module load call was invoked. This caused
  the wrap filepath to be attributed to the modules being instrumented. This meant
  that attempted relative require calls using Shim#require would resolved from the
  incorrect path. The logic has been changed to keep a stack of the resolved
  filepaths, resolving the issue.

* Updates error message for license check to indicate all places that need to be
  updated.

* Shim#wrapReturn now uses ES6 proxies to wrap its methods.

  This will accurately propagate look up and assignment onto the underlying wrapped
  function, while maintaining all previous functionality.

* Updated versioned test configurations to reflect current engine support.

### 5.9.0 (2019-05-20):

* Removed older versions of Cassandra from versioned tests

* For debug/test runs, shimmer will now cleanup the __NR_shim property on
  instrumented methods. This leftover property did not result in any negative
  behaviors but cleaning up for thoroughness and to prevent potential confusion.

* `serverless_mode` feature flag is now enabled by default.

* Fixes `recordMiddleware` promise parenting for certain cases where child segments
  are created within resolving middleware `next()` promises.

* Added `instrumentLoadedModule` function to the API, allowing end-users to manually
  apply an instrumentation to a loaded module. Useful for cases where some module
  needs to be loaded before newrelic

### 5.8.0 (2019-05-06):

* Modifies `MiddlewareSpec` route property to allow functions. Defers route
  processing and segment naming until just before needed (each middleware
  invocation).

* Fixed outdated `license` ref in `package.json`.

* Middleware instrumentation now honors `spec.appendPath` for more cases and will
  not pop paths when it has not appended a path.

### 5.7.0 (2019-04-24):

* Added `getStatusName` to `NameState`.

  Now web transactions will be named after known status code messages (404, 405,
  and 501).

* Broke apart `integration` script test globs.

* Added `appendPath` option to MiddlewareSpec.

### 5.6.4 (2019-04-16):

* Refactored config to log warning and disable distributed tracing if enabled in
  serverless mode, but missing required config setting.

* Serverless mode no longer sets different data collection limits.

* The agent will no longer crash the process in the event of unexpected calls to
  the harvest callback.

* Updated required config values when using distributed tracing in `serverless_mode`
  to only include `account_id`.

### 5.6.3 (2019-04-01):

* The agent will now accurately filter out request parameters while operating under
  CSP or HSM.

  You can find more information about this change here:
  https://docs.newrelic.com/docs/using-new-relic/new-relic-security/security-bulletins/security-bulletin-nr19-02

### 5.6.2 (2019-03-25):

* Agent now respects attribute type restrictions on trace/segment attributes, as
  well as error event/trace attributes.

* Fixes potential for `RangeError: Maximum call stack size exceeded` error on
  Transaction/Trace end.

* Custom events no longer accept attributes with invalid types.

  The only attribute types accepted by the backend are `boolean`, `string`, and
  `number`; any attribute assigned to a custom event outside these types would be
  dropped on ingest. The agent now filters these attributes out, and logs out a
  helpful message detailing the issue.

### 5.6.1 (2019-03-11):

* Updated log message for not adding attributes and change the log level to debug.

* Fixed an issue where exclusive time would be improperly calculated in some cases.

### 5.6.0 (2019-03-04):

* Added `product` attribute to existing datastore instrumentations.

* Added `db.collection` to datastore span event attributes.

* `trusted_account_key`, `account_id`, and `primary_application_id` may now be
  configured via a configuration file while in serverless mode.

* Fixed a bug where data belonging to distributed traces starting in the Node.js
  agent would be prioritized over data produced from traces starting in other
  language agents.

  Previously, the agent would use the same random number for both the transaction
  priority (used for data sampling) and the Distributed Tracing trace sampling
  decision (whether to create DT data for a given transaction). This random number
  reuse resulted in a bias that caused data from distributed traces started in the
  Node.js agent to be prioritized above data that belongs to distributed traces
  started in other language agents. The agent now makes individual rolls for each
  of these quantities (i.e. the transaction priority and trace sampling decision),
  eliminating the bias.

* Optimized exclusive time duration calculator.

  Previously, the agent would spend a lot of time sorting redundant arrays while
  calculating the exclusive time for the segments of a trace. This has been
  refactored into a single postorder traversal over the tree which will calculate
  the exclusive time for all segments in the subtree rooted at a given segment.

* Prevent a split on undefined location under certain conditions in Memcached.

 Special thanks to Ben Wolfe (@bwolfe) for this fix!

### 5.4.0 (2019-02-19):

* Fixed issue where `shim.createSegment()` could result in modifying the parent
  when opaque.

* Fixed issue where `http-outbound` would modify parent segments when parent is
  opaque.

* Moved processing of exclusive time attribute out of `toJSON` and into `finalize`
  to only be calculated once.

  Previously, serializing a segment would result in calculating and caching exclusive
  time which could result in issues if serialized prior to ending.

* Added `SNS` to message shim library names.

* Added check for `collect_span_events` in config sent from the server on connect.

  Collection of span events can be disabled from the server configuration, but not
  enabled.

* Refactored `Segment#toJSON` to be more readable.

* Added a `try/catch` to config initialization to safely handle invalid setting
  combinations.

  When an error is caught the agent is marked as disabled, which ultimately returns
  a stub API and keeps the process running.

* String truncation is now done using a binary search over the byte length of the
  string.

  Previously this truncation was done using a linear search for the proper byte
  length.

* Optimized segment and span attribute filtering.

### 5.3.0 (2019-02-12):

* Added `span_events` and `transaction_segments` attribute destinations.

  Span event and segment attributes can now be filtered using the same
  include/exclude config rules as other types. See [agent attribute
  configuration](https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration#node-js-attributes)
  for more details.

* Added `metadata` field to connect payload, for collecting
  `NEW_RELIC_METADATA_`-prefixed environment variables.

* Added DynamoDB to datastores.

* Added `opaque` option to datastore operation spec.

* Added Kubernetes utilization detection.

* Upgraded `concat-stream` and `readable-stream` to next major version.

  These modules had previously been held back due to support for Node <6. Since
  v5.0.0 we dropped that support thus enabling these updates.

* Added SQS as a supported messaging library name.

* Fixed opaque segment functionality for `message-shim.recordProduce`.

* Fixed opaque segment functionality for `message-shim.recordConsume`.

* Enabled tracking of callback via `message-shim.recordConsume` when no
  messageHandler provided.

* Replaced `make` rules with npm scripts.

* The agent will now consistently harvest in all response cases when in serverless
  mode.

  Previously, the agent's harvest was in a race with process suspension in the event
  of an uncaught exception, or responding without calling a callback. A synchronous
  harvesting process is now used to circumvent this racing issue.

* Fixed issue with socket connection errors causing the agent to stop attempting
  to connect at startup.

### 5.2.1 (2019-01-28):

* Fixed bug where agent would stop sending data to New Relic servers when a
  connectivity issue was encountered.

* Removed installation of Oracle container test scripts.

* Replaced explicit `config.high_security === true` checks with general truthiness
  checks.

  The agent will now treat any truthy value in the `high_security` config setting
  as if it is enabled.

* Fixed unit test with incorrect usage of cross application tracing.

### 5.2.0 (2019-01-23):

* Upgraded to `@newrelic/native-metrics` v4.

* Removed outdated config files.

* Removed old, outdated examples.

* Fixed an issue where old CAT headers would be injected while distributed tracing
  was enabled.

  This would happen if both `cross_application_tracing.enabled` and
  `distributed_tracing.enabled` were set to `true` and an instrumentation disabled
  tracing for an outbound request.

* Fixed access to `ConglomerateShim` in `shimmer`.

* Added Neptune to the known database names.

* Updated log messages for missing configuration files to point at the base
  configuration.

  Previously the log messages pointed at an internal file defining default values
  for every configuration.

### 5.1.0 (2019-01-16):

* Added new shim type: `ConglomerateShim`

  This shim class is useful for instrumenting modules which implement several service
  interfaces of different types.

* Disabled logging by default when serverless_mode is enabled. Please note
  serverless/lambda monitoring is not yet officially released.

* `null` trace attribute values are no longer sent to New Relic.

  This change brings the Node agent in alignment with the behavior of other language
  agents.

### 5.0.0 (2019-01-08):

* Dropped support for Node versions less than 6.

* Agent no longer creates transactions when in a `stopped`, `stopping` or `errored`
  state.

* Removed public API methods that have been deprecated since Agent v2:
  `createTracer`, `createWebTransaction`, `createBackgroundTransaction`, and
  `addCustomParameter`/`(s)`. See the [Migration
  Guide](https://github.com/newrelic/node-newrelic/blob/master/Migration%20Guide.md)
  for more information.

* Flagged `API#setIgnoreTransaction` as deprecated; `TransactionHandle#ignore`
  should be used instead.

* Released several feature flags. These flags are no longer used:

 - `feature_flag.custom_instrumentation`
 - `feature_flag.custom_metrics`
 - `feature_flag.synthetics`
 - `feature_flag.native_metrics`

* Added `plugins.native_metrics.enabled` configuration value.

  This configuration value controls the use of the `@newrelic/native-metrics` module.
  When set to `false` the agent will not attempt to load that module.

* Custom metrics recorded via `recordMetric` and `incrementMetric` API calls now
  automatically have the name prepended with `'Custom/'`. Usages of these APIs that
  manually prepend with `'Custom/'` will need to remove the manually specified one
  or will end up with metrics prepended with `'Custom/Custom/'`.

* Dropped support for `node-cassandra-cql`.

* Removed from `ignore_server_configuration` config setting.

* Removed deprecated configuration settings `capture_params` and `ignored_params`.

* The agent will no longer cause a stack overflow when logging at trace level to
  stdout.

  Previously, the agent would inadvertently trigger a trace level log from its trace
  level log (through wrapping a nextTick call), causing a stack overflow. The agent
  now detects this case and aborts the nested call.

### 4.13.0 (2018-12-20):

* Fixed clearing of active harvest via `_stopHarvester()`.

* Fixed handling of harvest endpoints when not all fail.

* Added agent state "connecting" to indicate when handshake with New Relic servers
  is starting. This can be triggered on startup and restarts.

* Added `--no-package-lock` to `unit` and `integration` rules.

* Released `protocol_17` feature flag.

* The agent now reacts to failed New Relic requests based on response code, as
  opposed to parsing an exception message in the response body.

* Replaced `nsp` with `npm audit` in security checks.

* Collector now specify `application/json` content-type when data is compressed
  instead of `octet-stream`.

* Bumped ecmaVersion in test .eslintrc to 8

### 4.12.0 (2018-12-03):

* Converted error handling in `CollectorAPI` and `RemoteMethod` to callbacks.

  Previously many of the errors were thrown. For consistency with async errors,
  these are now handed to the callback instead of thrown. The old behavior could
  result in a crash under a few circumstances, such as when the agent exceeded a
  configured maximum payload size. These errors came from `RemoteMethod._safeRequest`.
  Since these errors are handed to the callback instead of thrown, this bug is no
  longer a potential.

* Added IP address collection and forwarding of metadata headers for upcoming
  protocol 17.

  These features are currently behind the `protocol_17` feature flag until all
  parts of protocol 17 are implemented.

* Refactored harvest interactions in preparation for protocol 17 status codes.

### 4.11.0 (2018-11-15):

* Changed totalTime attribute to be in decimal seconds instead of milliseconds for
  transaction events.

* Agent no longer produces spans on ignored transactions.

  Previously, the agent would produce distributed tracing span events regardless
  of the ignored status of the transaction the events originated from.

* Extended Restify instrumentation to mark possible transaction names in order to
  account for async response methods.

* Added `protocol_17` feature flag.

  Flag will be removed and protocol will be hard-coded to `17` once functionality
  is released on New Relic backend.

* Added switch statement indenting standard to eslintrc

* This release also includes changes to the agent to enable monitoring of Lambda
  functions. If you are interested in learning more or previewing New Relic Lambda
  monitoring please email lambda_preview@newrelic.com.

* Introduced "warn" level 2 space rule to eslintrc

* Updated `hapi@16` versioned tests to only run on Node 6 and above.

* Upgraded `@newrelic/test-utilities` to v2.

* Pinned mysql2 to `<1.6.2` in versioned tests.

* Added `waitForIdle` option to `API#shutdown`.

  This new option will make the agent wait for all active transactions to finish
  before actually shutting down. This does not pre-empt creation of new transactions,
  so care must be taken to ensure the active transaction pool drains or the agent
  will never shut down.

### 4.10.0 (2018-11-01):

* Added `DatastoreShim#getDatabaseNameFromUseQuery`

  This new method can be used to extract the database name from `USE` SQL queries.

* Added link to CONTRIBUTING.md file in README.md

  Thanks to Yuri Tkachenko (@tamtamchik) for the contribution.

* Added VS Code settings to git ignore.

* Fixed bug preventing Distributed Tracing (DT) from fully functioning when Cross
  Application Tracing (CAT) was disabled.

* The agent will no longer break express routers in the case of using regex paths
  in a list.

  Previously, the agent would overwrite the regex with the source of the regex. The
  agent now makes a copy of the route array and mutates that instead.

* Attributes will now be properly propagated to PageView events.

  The agent may now be configured to pass attributes along to the browser agent.
  The attributes that match the include/exclude rules in the
  `browser_monitor.attributes` section will now be placed on PageView events.

* Renames better-cat integration test organization to be distributed-tracing and
  updated some test verbiage to use DT or distributed tracing instead of CAT or
  cross application tracing.

### 4.9.0 (2018-10-01):

* Updated DT payload creation to use `primary_application_id` from connect response.

* Added protection against functions with modified prototypes in `shim.applySegment`.

* Replaced SQL ID hash generation algorithm with SHA1 instead of MD5 to allow usage
  in FIPS compliant environments.

* Leveraged 16 hex digits for creation of SQL ID.

* Fixed `codec.decode()` callback bug that would re-call a callback with an error
  thrown within the callback.

* Added `superagent` as built-in instrumentation.

  This instrumentation just maintains transaction state when using the `superagent`
  module to make HTTP requests with either callbacks or promises.

* Updated `noticeError` API method to be partially functional in High Security Mode.

  In HSM, any custom attributes will be ignored, but the error will still be tracked.
  This brings the Node agent in line with the behavior of other language agents.

* Upgraded ejs module to get rid of Github security warnings. The ejs module was
  only used for tests and not in main agent code.

* Fixed bug requiring Cross Application Tracing (CAT) to be enabled for Distributed
  Tracing (DT) `createDistributedTracePayload` and `acceptDistributedTracePayload`
  APIs to function. DT configuration will no longer consider CAT configuration.

* Changes DT payload configuration log messages to debug level as it is not uncommon
  for calls to occur before server configuration has been retrieved.

* Converted `net` instrumentation to use shim api.

* Converted child_process instrumentation to newer shim style.

* Converted Timers instrumentation to newer shim style.

* Fixed bug in wrap() that would fail to wrap callbacks if the callback index was 0.

* Added `PromiseShim` class for instrumenting promise libraries.

* Support for setting `transaction_tracer.transaction_threshold` to 0 has been added.

* The agent now respects `NEW_RELIC_TRACER_THRESHOLD`.

  Previously, this environment variable was stored as a string. The environment
  variable is now stored as a float.

* Converted zlib instrumentation to use shim API.

### 4.8.1 (2018-08-27):

* Converted File System instrumentation to use newer shim style.

* Agent instrumentation will no longer interfere with promisification of core
  methods.

  Some core methods expose pre-promisified versions of the methods as a reference
  on the method itself. When instrumenting these methods, it neglected to forward
  these references onto the wrapper function. Now the instrumentation will properly
  forward property look ups to the original method.

* Converted DNS instrumentation to newer shim style.

* Added tracking of callbacks to DNS instrumentation.

* Converted crypto instrumentation to newer shim style.

* Updated domains instrumentation to use an instrumentation shim.

* Refactored the global instrumentation to use the shim API.

* Ported inspector instrumentation to use an instrumentation shim.

* Ported async_hooks based promise instrumentation over to using shims.

* Added shim types for core instrumentations.

* Fixed outbound https call to use example.com to resolve integration test issue.

* Fixed tests for ioredis 4.0.0 and above.

* Improved benchmark comparison output.

* Added `http` benchmark tests.

### 4.8.0 (2018-08-13):

* Added JSON-formatted output to benchmarks to enable automated benchmark comparison.

* Updated the benchmark runner to measure specifically userland CPU overhead.

* Added DatastoreShim benchmarks.

* Fixed MongoDB instrumentation for driver versions greater than 3.0.6.

  Mongo 3.0.6 removed metadata the Agent relied upon to instrument the driver. This
  fixes that by going back to the old method of manually listing all objects and
  methods to instrument.

* Implemented enforcement of `max_payload_size_in_bytes` config value.

  Any payload during the harvest sequence that exceeds the configured limit will
  be discarded.

* Updated MySQL versioned tests to run against the latest release.

### 4.7.0 (2018-07-31):

* Added support for distributed tracing.

  Distributed tracing lets you see the path that a request takes as it travels
  through your distributed system. By showing the distributed activity through a
  unified view, you can troubleshoot and understand a complex system better than
  ever before.

  Distributed tracing is available with an APM Pro or equivalent subscription.
  To see a complete distributed trace, you need to enable the feature on a set of
  neighboring services. Enabling distributed tracing changes the behavior of some
  New Relic features, so carefully consult the [transition guide](https://docs.newrelic.com/docs/transition-guide-distributed-tracing) before
  you enable this feature.

  To enable distributed tracing, set `distributed_tracing.enabled` to `true` in
  your `newrelic.js` file, or set `NEW_RELIC_DISTRIBUTED_TRACING_ENABLED` in your
  environment.

* Added a warning for too-new versions of Node.js during agent startup.

* Appropriately obfuscated SQL statements will now be included in all transaction
  traces.

  Previously, the agent would only include the SQL statements if the corresponding
  query was sufficiently slow.

* Added ability to execute instrumentation functions in the context of the segment
  the segment descriptor is describing.

  All `record*` methods supplied by all instrumentation shim classes now allow for
  a function to be executed under the context of the segment the record call will
  produce. This may be done by supplying a function in the `inContext` key for the
  segment descriptor passed to the record method.

* Reservoirs will now respect setting their size to 0.

### 4.6.0 (2018-07-24):

* Added full support for Node v10.

* Added instrumentation for `crypto.scrypt`.

* Added instrumentation for `fs.realpath.native`.

* Added instrumentation for `process.setUncaughtExceptionCaptureCallback`.

* Updated tests to use `asyncResource.runInAsyncScope` instead of `emitBefore` and
  `emitAfter`

* Pulled `distributed_tracing` config value from behind `feature_flag`.

### 4.5.1 (2018-07-18):

- The agent will now properly remerge event data on collection failure.

  Previously, the agent wouldn't observe the correct format for remerging, causing
  undefined events to be pushed into the reservoir.

### 4.5.0 (2018-07-16):

* Feature flags may now be set from environment variables.

  Using the naming convention `NEW_RELIC_FEATURE_FLAG_<feature flag name in upper
  case>`.

* Transaction events may be harvested in two payloads now.

  This change reduces the occurrence of harvests being rejected due to large
  payloads. Payloads will only be split when they are large (greater than 1/3 the
  maximum).

* Updated Hapi v17 instrumentation to wrap `server` export, in addition to `Server`.

* `ROOT` segment no longer turns into a span event.

* Fixed span collection when transactions are `sampled=false`.

* Removed `grandparentId` from spans.

### 4.4.0 (2018-07-12):

* Added config `utilization` env vars to the `BOOLEAN_VARS` set.

  This ensures that if these boolean config values are set outside of a config file,
  their values are respected, particularly when they are disabled.

* Replaced `trusted_account_ids` array with `trusted_account_key`.

* Added node v10 to the test matrix.

* Converted distributed trace `x-newrelic-trace` header name to `newrelic`.

* Added support for different transport types in distributed tracing.

* Added more tests around priority/sampled attributes on traces and events.

* Lazily calculate transaction priority only when needed.

* Transaction priority is now truncated to 6 decimal places on generation.

* Adaptive sampling now uses the `sampling_target` and
  `sampling_target_period_in_seconds` configuration values.

  With these configurations, the adaptive sampling window is separated from the
  harvest window.

* Removed `nr.tripId` attribute from distributed trace intrinsics.

* Default span events to enabled.

  These are still protected behind `feature_flag.distributed_tracing` which defaults
  to `false`.

### 4.3.0 (2018-07-09):

* Added `nonce` option for `newrelic.getBrowserTimingHeader()`

  This allows people to pass in a string to be injected as the `nonce` property of
  the generated script tag. Special thanks to João Vieira (@joaovieira) for
  contributing this feature!

* Added check to mark Hapi `'onPreResponse'` extensions as error handlers.

  Previously, the agent was unable to mark any Hapi errors as handled, even if they
  were, resulting in inaccurate reporting. This change assumes that `'onPreResponse'`
  extensions act as error handlers, so errors are only reported if they persist to
  the final response.

* Expose the External segment on the `http` request instance for outbound calls.

### 4.2.1 (2018-07-02):

* Fixed issue with tracking external requests to default ports.

  Special thanks to Ryan King for pinpointing the cause of this issue.

* Added extra check for handling arrays of functions when wrapping middleware
  mounters.

  This fixes a bug with the agent incorrectly assuming that arrays passed as the
  first argument in middleware would only contain route paths, causing a fatal error.

* The agent now reports the total time of the transaction on transaction events.

* Added more tests for transaction naming with Restify.

### 4.2.0 (2018-06-19):

* Refactored harvest cycle into separate class.

  This refactoring eases managing harvested data and re-merging unharvested values
  on failure.

* Added seen/sent/dropped supportability metrics for all event collections.

* Updated `WebFrameworkShim` to handle arrays of routes when wrapping middleware
  mounters.

  Previously, a transaction that hit a shared middleware (eg, `app.use(['/one',
  '/two'], ...)`) would always be tagged with `<unknown>` in its name, due to the
  agent not interpreting arrays of paths. Now transaction names will include all
  paths for a shared middleware, comma-delimited, followed by the current route
  (`'WebTransaction/Expressjs/GET//one,/two/one'`).

* Added an option for using the `finally` method on promises for instrumentation.

  The promise instrumentation would use `Promise#finally` if available. This change
  is in response to Node v10 promises calling `then` inside their `finally` method,
  which caused infinite recursion in the agent's promise instrumentation.

* No longer download gcc on test suites that do not require it.

* Added `url` parameter to `http` external segments.

* Renamed request parameters on external segments.

  Previously these were named just the parameter name (e.g. `/foo?bar=baz` would
  become the parameter `"bar": "baz"`). Now they are prefixed with
  `request.parameter`. (e.g. `"request.parameter.bar": "baz"`).

* Added `EventAggregator` base class.

  The `ErrorAggregator` class was refactored and most generic event aggregation
  logic was moved to the new `EventAggregator` class.

* Added `SpanEvent` and `SpanAggregator` classes.

* Added Span event generation to the trace `end` method.

* Added Span events to harvest cycle steps.

### 4.1.5 (2018-06-11):

* Make `require()` statements explicitly reference `package.json` as a `.json` file.

  This solves a problem when requiring/importing newrelic from a Typescript file.
  Thanks @guyellis for the submission!

* Check if `process.mainModule.filename` exists before using in missing config file
  check.

  When the agent is preloaded with Node's `--require` flag, `mainModule` is not yet
  defined when the agent checks for a config file, resulting in a `TypeError` in
  the event that no config file exists. Defaulting to the file path being executed
  in `process.argv` ensures that the app will not crash when preloaded without a
  config file.

* Updated dev dependency `tap` to v12.0.1.

* Fixed identification of errors with express.

  Previously the call `next('router')` was considered an error. This is actually
  valid usage of express and will no longer generate an error.

* Removed `debug.internal_metrics` configuration.

  This legacy debug configuration was never used since trace-level logging provides
  everything this did and more.

* Upgraded optional dependency `@newrelic/native-metrics` to v3.

  With this update comes pre-built binaries for Node 5 and 7. GC metrics are also
  now aggregated in C++ until the agent is ready to harvest them instead of hopping
  into JS for each event.

* Added additional checks to `uninstrumented` ensuring that files with names
  matching instrumented modules do not result in a false uninstrumented status.

  For example, some users load config/env info before the agent. In that case, a
  file responsible for exporting DB config information (`config/redis.js`), may
  result in a false `uninstrumented` status, because the agent would interpret
  `redis.js` as the module itself.

* Moved `computeSampled` call to `Transaction` constructor.

  Previously it was only called in `createDistributedTracePayload`, but this
  gives all transactions a `sampled` value, and potentially a boosted priority.

### 4.1.4 (2018-06-04):

* Transaction stubs are now created properly in `api#getTransaction`

  During a refactor to use classes for the `TransactionHandle` class, the
  `TransactionHandleStub` was converted into a class. This change in interface
  wasn't reflected in the use around the agent and would pass back the class
  instead of an instance.

  Big shoutout to Roy Miloh (@roymiloh) for submitting the fix to this!

* Upgraded dev dependency `chai` to version 4.

### 4.1.3 (2018-05-29):

* Fixed metric merging when using `debug.internal_metrics`.

  The debug metrics cache would cause timestamps for harvested metrics to get stuck
  at agent startup. This will no longer happen, and the debug cache is reset each
  harvest.

* Modularlized configuration constants to improve readability.

* Added `distributed_tracing` feature flag.

* Added `acceptDistributedTracePayload` method to `Transaction`.

* Added `createDistributedTracePayload` method to `Transaction`.

* Updated `Agent#recordSupportability` to not include `Nodejs/` in the default metric name.

* Added distributed tracing methods to `TransactionHandle`.

* Added distributed tracing cases for `http` and `other` metric recorders.

* Implemented `_addDistributedTraceInstrinsics` on `Transaction`.

  If the `distributed_tracing` feature flag is enabled, the agent will ignore old
  CAT attributes in favor of distributed trace–related ones.

* Added integration tests around better CAT functionality.

### 4.1.2 (2018-05-22):

* Fixed access to properties on promisified methods.

  Thanks to John Morrison (@jrgm) for pointing this out and providing a
  reproduction.

* Updated use of `fs.unlink` without a callback to `fs.unlinkSync`.

  As of Node v10, the callback is [no longer optional](https://nodejs.org/dist/latest-v10.x/docs/api/fs.html#fs_fs_unlink_path_callback), which was causing a false
  test failure.

### 4.1.1 (2018-05-14):

* Logger no longer tries to create very large log messages.

  When a message is created that would be too large to log, a process warning is
  emitted.

* Optimized `unhandledRejection` reporting when using `async_hooks`.

* The agent no longer resizes the metric timeslice start time to be the earliest
  start time of the transactions that finish during the timeslice.

* Replaced all uses of `util._extend` with `Object.assign`.

* Background transactions created may now be named through `API#setTransactionName`.

  Previously, the agent didn't respect the transaction naming precedence for
  background transactions. Background transaction naming behavior is now in line
  with web transaction behavior.

* Completed TODOs regarding the Node 0.10 and 0.12 deprecation.

* Added PriorityQueue serialization benchmarks.

* Added check for a route prefix when wrapping Hapi route handlers.

  Previously, route prefixes specified via plugin options weren't being included
  in transaction names. Now, if the agent finds a route prefix associated with a
  given realm, it is prepended to the route path in the transaction name.

* The agent will now respect event count limits when merging data from a failed send.

  Previously, when merging data into an event pool the agent wouldn't maintain the
  size limit of the reservoir.

### 4.1.0 (2018-04-23):

* Updated logic around wrapping route handlers when `config` object is present.

  Before, the agent would only attempt to wrap `config.handler` when any `config`
  object was present, without defaulting to the root `handler` if it didn't exist.

* Added `PriorityQueue` class for collecting events.

  This replaces the `Reservoir` class for event sampling. Using priority sampling
  allows the agent to maintain randomness across a given time period while
  improving the chances that events will be coordinated across Transaction, Error,
  and Custom event pools.

* The agent will now allow external instrumentation modules to fail in a safe way.

  Previously, the agent would stop running if an externally loaded instrumentation
  failed for any reason. Due to the way external instrumentations can be updated
  independently, the agent should allow them to fail and carry on after logging a
  warning.

* Added the `strip_exception_messages.enabled` config option.

  The agent can now be configured to redact error messages on collected errors.

* Added the `attributes.include_enabled` config option.

  The agent can now be configured to disallow attribute include patterns to be
  specified.

### 4.0.0 (2018-04-12):

* BREAKING: Updated the version of `https-proxy-agent` to v2.x - Dropped support
  for v0.10 and v0.12 of node.

  The version of `https-proxy-agent` used in the agent has a known security
  issue you can read about here: https://snyk.io/vuln/npm:https-proxy-agent:20180402
  In order to resolve this issue, the dependency had to be updated to at least
  v2.2.0, which only supported node versions >=4.  The update to this dependency
  forces the incompatibility of the agent with versions 0.10 and 0.12 of Node.

  In order to use use the Node.js agent, please upgrade node to version >=4, or you can
  continue to use the agent on Node versions 0.10 and 0.12 by pinning the agent
  to v3.

  You can read more about the issue here: https://docs.newrelic.com/docs/using-new-relic/new-relic-security/security-bulletins/security-bulletin-nr18-08

### 3.3.1 (2018-04-10):

* Added a type check to attribute validation, restricting values to primitive types
  (but not `undefined`).

  Previously the agent was only enforcing byte limits on string values, resulting
  in overly large arrays being collected. This brings the agent in line with other
  language agents.

* The `DatastoreShim` will now respect specified `after` handlers.

  Previously on methods like `DatastoreShim#recordQuery` the `after` handler would
  be dropped. The property is now correctly propagated to the underlying
  `Shim#record` call.

* The agent will now check that a specified parent segment is part of an active
  segment before running a method under instrumentation.

  Previously the agent would unconditionally run a method under a specified
  parent. The shim expects the parent to exist and be active, and will throw
  errors in the case where the parent belongs to an inactive transaction.

### 3.3.0 (2018-03-27):

* Added `newrelic.startSegment()` which replaces `newrelic.createTracer()`.

  This new API method allows you to create custom segments using either callbacks
  or promises.

* Fixed bug in `pre` route config option in Hapi instrumentation.

  Only applies to Hapi v16 and below. The `pre` handler wrapping was not properly
  returning in cases when the element was a string referring to a registered server
  method, and as a result these elements would be replaced with `undefined`.

### 3.2.0 (2018-03-14):

* Added [`@newrelic/koa`](https://github.com/newrelic/node-newrelic-koa) as a
  dependency.

  This introduces instrumentation for **Koa v2.0.0** or higher. It will be treated
  as first-party instrumentation within the agent, but publishing it as a
  separate module allows it to be installed independently according to users' needs.

* Refactored instrumentation hooks to work with modules.

  With this change it is now possible to link against external instrumentation
  modules.

### 3.1.0 (2018-03-13):

* Promise based web framework middleware instrumentation now supports callback
  based sequencing.

  Previously, a promise based middleware was assumed to continue to the next
  middleware once the promise it returned resolved.  This assumption has been
  relaxed to allow for a callback to be supplied to the middleware to invoke the
  next middleware.

### 3.0.0 (2018-03-06):

* Removed the `ssl` configuration option.

  TLS is now always used in communication with New Relic Servers. The `ssl`
  configuration value and `NEW_RELIC_USE_SSL` environment value are no longer
  used. Setting either value to anything other than `true` will result in a
  warning.

* Security bulletin [NR18-05](https://docs.newrelic.com/docs/accounts-partnerships/new-relic-security/security-bulletins/security-bulletin-nr18-06):

  Fixes issue introduced in 2.8.0 where the agent may have captured all
  transaction attributes, even with High Security Mode enabled on the account.
  This may have included sensitive data attached to transactions.

* All request parameters now prefixed with `request.parameters.`.

  Previously request parameters such as route and query parameters were added
  as attributes without any name changes. For example `/foo?bar=value` would add
  the attribute `bar` to the transaction. Now this attribute would be named
  `request.parameters.bar`.

  Any Insights dashboards, alerts, or other NRQL queries using these attributes
  must be updated to use the new attribute names.

### 2.9.1 (2018-03-05):

* Security bulletin [NR18-05](https://docs.newrelic.com/docs/accounts-partnerships/new-relic-security/security-bulletins/security-bulletin-nr18-06):

  Fixes issue introduced in 2.8.0 where the agent may have captured all
  transaction attributes, even with High Security Mode enabled on the account.
  This may have included sensitive data attached to transactions.

* Removed support for agent attributes include/exclude rules.

  These will be coming back in Node Agent v3.0.0. The fix for the above security
  bulletin required a backwards incompatible change to our attributes.

* Fixed bug in Bluebird instrumentation.

  Some methods were not instrumented correctly. This would cause a problem if a
  function was passed to these methods.

  Special thanks to Andreas Lind (@papandreou) for helping us find this bug.

### 2.9.0 (2018-02-27):

* Added the `WebFrameworkShim#savePossibleTransactionName` method.

  This method may be used to mark the current running middleware as a potential
  responder. `savePossibleTransactionName` should be used if a middleware can't
  be determined to be a terminal middleware while it executes, but may be
  responsible for responding after execution has finished.

* Fixed `dns.resolve` results assertion.

* Added check for `parentSegment` in `async_hooks` instrumentation, to help
  ensure that transaction context is maintained.

* Expanded `async_hooks` tests around maintain transaction context.

* Added Koa to metric naming objects.

* Added `callback` prop to `middlewareWithPromiseRecorder` return spec.

  While we aren't actually wrapping any callback, this is a workaround that gives
  us access to the active segment. This ensures that all segments inside Koa
  transaction traces are named correctly, particularly in cases when transaction
  context may be lost.

* Updated `after` prop in `middlewareWithPromiseRecorder` return spec to set
  `txInfo.errorHandled = true` in cases when there is no error.

  Because Koa has no concept of errorware in the same sense as Express or Connect
  (`(err, req, res, next)`), the agent now assumes if a middleware resolves, any
  error that may have occurred can be marked as handled.

* Upgraded `tap` dev dependency to v10.

* Added a check for the function's prototype in `shim#wrapReturn`.

  The agent used to throw if a function with no prototype was passed into
  `wrapReturn`, then `bind` was called on the wrapper.

### 2.8.0 (2018-02-21):

* Added instrumentation support for MongoDB version 3.

  Version 3 of [mongodb](https://npmjs.org/package/mongodb) is now supported.
  Previously datastore host information (instance metrics) was incorrectly
  captured by the agent with `mongodb` v3. This has been fixed and all features
  should be functional now.

* Enable certain agent attributes when high security mode is enabled.

  During the switch from the old `capture_params`/`ignored_params` to the new
  attribute include/exclude rules, high security mode was over-zealous in what
  attributes it disallowed. This has been trimmed back to be in line with other
  agents.

* Updated documentation for `apdex_t` setting and removed environment variable.

  This was never configurable on client side and the documentation was misleading.

* Documented environment variables for `slow_sql` configurations.

  Thanks to Olivier Tassinari (@oliviertassinari) for the update!

* Updated `hapi/hapi-pre-17/package.json` to run `errors.tap.js` in more versions.

* Added internal cache to unwrapped core modules for agent use.

* Improved logging around environment facts gathering.

### 2.7.1 (2018-02-08):

* Change `attributes.enabled` to `true` by default.

  In the previous version we defaulted this to `false` to maintain parity with
  `capture_params` which defaulted to `false`. However, this is a invalid parity
  because `attribute.enabled` controls more attributes than `capture_params`.

* The agent will no longer generate browser data for ignored transactions.

* Removed unnecessary checks around `Timer.unref()` calls.

  `unref` has been supported since Node v0.9, meaning it will always be present
  in timers set by the agent (with 0.10 being the earliest supported version).

* Expanded Hapi instrumentation to support route [`pre` handlers](https://github.com/hapijs/hapi/blob/v16/API.md#route-prerequisites).

  This is a Hapi route config option that was previously uninstrumented, causing
  transaction names to become invalid. This expanded instrumentation ensures
  that all additional handlers are wrapped and associated with the main route.

* Added a split in the node versions for the `mysql2` and `cassandra` versioned
  tests.

  As of `mysql2` v1.3.1 and `cassandra` v3.4.0 the minimum supported version of
  Node is 4.

* Replaced as many instances of `{}` as possible with `Object.create(null)`.

* Removed extraneous logger arg in `addCustomAttribute` call.

### 2.7.0 (2018-02-01):

* Added agent attribute filtering via include and exclude rules.

  Agent attributes can now be controlled using fine grained include and exclude
  rules. These rules, described below, replace `capture_params` and
  `ignored_params`. Any attributes listed in `ignored_params` will be migrated
  to `attributes.exclude` internally, unless `attributes.exclude` is explicitly
  set.

  There are three new configuration properties added to the root config and
  each destination (more on destinations later). These new configurations are:

  * `attributes.enabled` - Enables collection of attributes for the destination.
  * `attributes.include` - A list of attributes or wildcard rules to include.
  * `attributes.exclude` - A list of attributes or wildcard rules to exclude.

  The include and exclude rules can be exact rules (for example
  `request.headers.contentLength`), or wildcard rules which match just the
  beginning of attribute keys (for example `request.headers.*` would match any
  request header).

  These rules can be specified globally at the root of the configuration, or
  for specific destinations. These destinations are:

  * `transaction_tracer` - Controls transaction trace attributes.
  * `transaction_events` - Controls transaction event attributes.
  * `error_collector` - Controls error event attributes.
  * `browser_monitoring` - Controls browser/RUM transaction attributes.

* Renamed `addCustomParameter` to `addCustomAttribute`.

  The `addCustomParameter` method is now deprecated and will be removed in a
  future release of the agent. The `addCustomAttribute` method is a drop-in
  replacement for it.

* Added cache to agent attribute filtering.

  To minimize the overhead of applying attribute rules, the agent caches results
  of filtering specific attribute keys and destinations. The cache is limited to
  1000 destination-key pairs by default but can be configured with
  `attributes.filter_cache_limit`. This cache offers a 10x improvement for
  applying filter rules for cache-hits.

* Added limits for agent attributes to keep monitoring overhead down.

  Attribute keys and values are limited to 255 bytes each. Keys which are larger
  than 255 bytes are dropped, and a warning message is logged. Values larger
  than 255 bytes are truncated to 255 bytes, respecting multi-byte UTF-8
  encoding. Custom attributes are limited to 64 per transaction. Attributes
  beyond the 64th are silently ignored.

* Added `allow_all_headers` to config options and updated `http` instrumentation.

  When set to `true`, the agent will collect all request headers. This collection
  respects the agent attribute include and exclude rules. A default set of
  exclusion rules are provided in `newrelic.js`. These rules exclude all cookies
  and authentication headers.

* The agent will no longer crash when `crypto.DEFAULT_ENCODING` has been changed.

  Previously, the agent would assume the result of `hash.digest()` was an
  instance of a Buffer. If `crypto.DEFAULT_ENCODING` is changed, `hash.digest()`
  will return a string and the agent would crash.  The agent now ensures that
  the value is a Buffer instance before moving on.

* Renamed `request_uri` attribute to `request.uri`.

  This brings the attribute name in line with all other request attributes.

* Updated `https-proxy-agent` dependency from `^0.3.5` to `^0.3.6`.

* Updated versioned tests where applicable to ensure most minor versions of
  instrumented modules work as expected.

* Fixed stalling test for v1 line of Mongo driver.

* Added tests verifying Hapi 404 transactions result in correctly named metrics.

  The Hapi instrumentation was doing the correct thing, but we did not have tests
  for this specific case.

* Fixed error if `process.config.variables.node_prefix` missing.

  If `process.config.variables.node_prefix` is falsey (which can happen if using
  electron, leading to this issue https://discuss.newrelic.com/t/new-relic-on-electron-nodejs/53601)
  the `getGlobalPackages` function in `lib/environment.js` will give an err when
  it shouldn't.

  Thanks to Jarred Filmer (@BrighTide) for the fix!

* Segments may now be flagged as opaque, causing internal segments to be omitted
  from the transaction trace.

* Added error to collector connection failure log message.

### 2.6.1 (2018-01-18):

* Fixed naming bug in Restify instrumentation regarding parameters to `next`.

  The instrumentation previously considered any truthy value passed to `next` to
  be an error. It is possible to pass a string or boolean to `next` in Restify
  to control further routing of the request. This would cause the middleware's
  mounting path to be erroneously appended to the transaction name.

* Fixed access to `bluebird.coroutine.addYieldHandler`.

  This was accidentally not copied by our instrumentation making access to the
  function fail. This has been resolved and tests expanded to ensure no other
  properties were missed.

* Added regression test for promise instrumentation and stack overflows.

### 2.6.0 (2018-01-09):

* Fixed a crashing error in the hapi instrumentation.

  When recording the execution of an extension listening to a server event
  (e.g. 'onPreStart') the agent would crash due to the lack of a `raw` property
  on the first argument passed to the extension handler. The agent now checks
  the event before wrapping the extension handler, and checks for the existence
  of the `raw` property before attempting to dereference off it.

* Fixed an incompatibility with the npm module `mimic-response`.

  The agent's HTTP instrumentation previously did not play well with the way
  `mimic-response` copied properties from an `http.IncomingMessage`. This caused
  modules that relied on that, such as `got`, to hang.

* Refactored promise instrumentation.

  This new instrumentation is far more performant than the previous and
  maintains a more sensible trace structure under a wider range of sequences.

* Added `transaction_tracer.hide_internals` configuration.

  This configuration controls the enumerability of the internal properties the
  agent. Making these properties non-enumerable can have an impact on the
  performance of the agent. Disabling this option may decrease agent overhead.

* Added concurrent environment scanning, limited to 2 reads at a time.

  This improves the performance of dependency scanning at agent startup,
  allowing the agent to connect to our services more quickly.

* Refactored instrumentation tests to run against wide range of module versions.

  Instrumentation tests will be run against all supported major versions of
  every instrumented module. For releases, we will test against every supported
  minor version of the modules. This vastly improves our test coverage and
  should reduce the instances of regressions for specific versions of modules.

* Added tests for _all_ of bluebird's promise methods.

  These tests ensure that we 100% instrument bluebird. Some gaps in
  instrumentation were found and fixed. Anyone using bluebird should upgrade.

* Fixed naming rule testing tool to use same url scrubbing as the agent itself.

### 2.5.0 (2018-01-03):
* Added hapi v17 instrumentation

  Hapi v17 added support for promise-based middleware which broke transaction
  tracking in the agent.  This caused issues in naming, as the agent will name
  the transaction after the path to the middleware that responded to a request.

* Added instrumentation for `vision@5`

  Due to the way `vision` is mounted to the hapi server when using hapi v17.x,
  the agent's instrumentation would not pick up on the middleware being mounted.
  This new instrumentation now correctly times rendering done in the `vision`
  middleware.

* Added `unwrapOnce` method to shim object

  This new method can be used to unwrap a single layer of instrumentation.
  `unwrapOnce` is useful in cases where multiple instrumentations wrap the same
  method and unwrapping of the top level is required.

* Added `isErrorWare` checks around `nameState.appendPath`/`nameState.popPath`
  calls to avoid doubling up paths in transaction names

  Previously, the agent would append its transaction name with the path fragment
  where an error handler middleware was mounted.  The extraneous path fragment
  will now be omitted, and the transaction will be named properly after the
  middleware that threw the error.

* Added `parent` property to webframework-shim segment description

* Added support for pg-latest on Node 5 or higher

* Fixed creating supportability metric when mysql2 goes uninstrumented.

* Added a `segmentStack.pop`to the middleware `after` in cases when an error is
  caught and there is no next handler

* Fixed determining parents for middleware segments when transaction state is
  lost and reinstated

* Refactored existing hapi instrumentation for different `server.ext()`
  invocations

* Refactored webframework-shim `_recordMiddleware` to construct different
  segment descriptions for callback- or promise-based middleware

* Added check to `_recordMiddleware` to avoid prepending a slash if original
  `route` is an array

* Changed logic in http instrumentation to attach `response.status` to the
  transaction as a string

* Updated `startWebTransaction` and `startBackgroundTransaction` to add nested
  transactions as segments to parent transactions

* Updated `node-postgres@^6` versioned tests to avoid deprecation warning on
  direct module `connect` and `end` calls

* Fixed running domain tests on Node 9.3.0.

* Improved logging for CAT headers and transaction name-state management.

* All `json-safe-stringify` calls now wrapped in `try/catch`

* Removed `lib/util/safe-json`

### 2.4.2 (2017-12-12):
* Added Peter Svetlichny to the contributors list!

* Optimized `NameState#getPath`.

* Optimized `shim.record`.

* Optimized `shim.recordMiddleware`.

* Upgraded `eslint` to v4.

* Fixed parsing SQL for queries containing newlines.

### 2.4.1 (2017-11-28):
* Added promise benchmarks to test non-async_hooks instrumentation.

* Added logging for external calls made outside of a transaction.

* Added logging for when `unhandledRejection` is noticed.

* Improved performance of creating and merging metrics.

* Improved performance of `tracer.bindFunction`.

* Moved `require` calls for vendor metadata to module-level.

* Removed try-catch around internal property setting on older versions of Node.

### 2.4.0 (2017-11-15):
* Instrumentation will now only modify the arity of wrapped functions when needed.

  This can be controlled with the `matchArity` property on a `WrapSpec`.
  Disabling arity matching has a significant, positive impact on the performance
  of instrumentation.

* Added benchmarks for shimmer methods.

* Pinned hapi tests at v16 due to incompatibility in hapi v17 with Node.js
  versions <8.

* The agent's parsed queries will now only hold onto the stack that the query
  was made at, instead of an error object instance.

  Previously, the parsed query objects would hold onto an error instance, which
  would in turn hold onto references to all the functions in the stack when the
  error was created. This could cause memory issues if the functions were
  holding onto references to other pieces of data.

* Revert wrapping of `https` for Node `^8.9.1`.

  The original cause for this problem was reverted by Node.

### 2.3.2 (2017-11-02):

* Fixed a bug with Node >=8.9 that prevented https externals from being recorded.

* Added Node 9 to test suite.

* Removed problematic tests for ancient version of Hapi (7.1).

* Document purpose of `throw` in tracer to prevent developer confusion.

* Added script for running agent micro benchmarks.

* Added benchmarks for all the `Shim` and `Tracer` methods.

### 2.3.1 (2017-10-24):
* Agent will attempt to reconnect to the collector forever after backing off to
  5 minute delays.

* Refactored environment scan to improve startup time and fix cyclical symlink
  resolving.

### 2.3.0 (2017-10-16):
* The agent will now support the `await` keyword by default.

* Added cases for omitting the agent with and without async hooks to the async
  hooks microbenchmark.

* Pinned version of Mocha to 3.x due to the incompatibility of Mocha v4 and Node
  v0.10 and v0.12.

* Added benchmark for performance of function wrapping.

* Added GC information to async_hooks benchmark.

* Improved trace-level logging for capturing queries.

### v2.2.2 (2017-09-26):
* Hapi handlers will now preserve the defaults associated with them.

  Previously when wrapping handlers, the agent would drop the associated defaults on
  the ground, these are now properly forwarded to the wrapper.  Big thanks to Sean
  Parmelee (@seanparmelee) for finding the root cause of this bug and reporting it!

* Pinned `request` version for testing old versions of Node.

* Added tests for feature flags created at agent initialization.

* Fixed starting the agent with an invalid process version.

### v2.2.1 (2017-09-11):
* Added metrics for enabled/disabled feature flags.

* Fixed transaction naming for Hapi plugins.

  Thanks Marc Höffl (@KeKs0r) for providing a reproduction!

### v2.2.0 (2017-08-22):
* Added support for ignoring ranges of status codes.

  The configuration `error_collector.ignore_status_codes` can now take ranges
  of numbers. For example, `ignore_status_codes: ['400-404']` would ignore 400,
  401, 402, 403, and 404.

* Fixed a bug when a custom collector port was provided in the configuration
  that prevented redirected connections from working.

* Fixed a bug in `Shim#record` that could cause an exception when trying to
  create a new segment as part of an ended/inactive transaction.

* Fixed issue with custom Hapi handlers causing an error.

  Previously custom Hapi handlers defined using the `server.handler()` method
  were causing the Hapi server to return a 500 error. Now they are correctly
  handled and recorded as middleware functions.

* Transaction state is now maintained in `ChildProcess` event listeners.

* Updated examples and documentation regarding custom transaction creation.

  All examples and documentation now point at the `newrelic.start*Transaction`
  methods.

* Reducing logging verbosity in the SQL query obfuscator.

* Experimental instrumentation for `async/await`

  This is experimental instrumentation and has not yet been tested in a wide
  array of production environments. The feature is currently off by default
  behind a feature flag. To enable this experimental instrumentation, add
  `await_support: true` to the `feature_flag` setting in your agent config
  file.

### v2.1.0 (2017-08-08):
* Improved metadata collection for AWS, Azure, GCE, and Pivotal Cloud Foundry.

* Fixed a bug in PG query obfuscation for `$` placeholders.

  The agent used to mis-detect `$1` value placeholders as unmatched
  dollar-quoted strings causing the whole query to be obfuscated to just `?`.
  These placeholders are now correctly detected and obfuscated.

### v2.0.2 (2017-08-01):
* Improved documentation for `newrelic.start*Transaction` and `TransactionHandle.`

  Formatting for the `startWebTransaction` and `startBackgroundTransaction`
  methods was fixed and documentation for the `TransactionHandle` class which
  `getTransaction` returns was added.

* Fixed parsing the table name from SQL queries.

  Quotes around the table name are now stripped after parsing the query and
  before constructing the metrics.

* Fixed unhandled rejection error caused by `ioredis` instrumentation.

### v2.0.1 (2017-07-25):
* Fixed issue with transaction events not including correct duration values.

  This issue was introduced in v2.0.0, and it has affected web transactions histogram
  and percentile charts.

* Fixed issue with Redis instrumentation causing the agent to crash in some cases.

  Previously, the Redis instrumentation would crash the agent when Redis commands were
  called without a callback and after the transaction has ended.

* Fixed issue with the agent crashing on Node v4.0-4.4 and v5.0-5.9.

  This issue was caused by incorrect shim for Buffer.from(), and it affected older minor
  versions of Node v4 and v5.

### v2.0.0 (2017-07-17):
* [The New Relic Node Agent v2 is here!](https://blog.newrelic.com/2017/07/18/nodejs-agent-v2-api/)

  This release contains major changes to the agent instrumentation API, making
  it easier to create and distribute your own instrumentation for third party
  modules. Check out [Upgrade the Node agent](https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/upgrade-nodejs-agent)
  or the [Migration Guide](./Migration%20Guide.md) for more information on
  upgrading your application to this version.

* BREAKING: Reversed naming and ignore rules.

  Naming rules are now applied in the order they are defined.

* BREAKING: De-duplicated HTTP request transactions.

  Only one transaction is created per `request` event emitted by an HTTP server.
  Previously this was one transaction per listener per event emitted.

* BREAKING: Stopped swallowing outbound request errors.

  Errors emitted by outbound HTTP requests will no longer be swallowed by the
  agent.

* BREAKING: Node v0.8 is no longer supported. Minimum version is now v0.10.

  The v1 agent will continue to support Node 0.8 but will no longer receive
  updates.

* BREAKING: npm v1 is no longer supported. Minimum version is now v2.0.0.

* Added API for writing messaging framework instrumentation.

  Introduced new `MessageShim` class for writing instrumentation. This shim
  can be accessed using the `newrelic.instrumentMessages()` API method.

* Added `amqplib` instrumentation.

  Applications driven by `amqplib` consumers will now have transactions
  automatically created for consumed messages. See
  [Troubleshoot message consumers](https://docs.newrelic.com/docs/agents/nodejs-agent/troubleshooting/troubleshoot-message-consumers)
  for more information on this instrumentation and its limitations.

* Advanced instrumentation API is now generally available.

  New methods for instrumenting common modules were introduced during the Agent
  v2 beta. These APIs are now available to everyone:

  * `newrelic.instrument()`/`Shim`: This method can be used to instrument
    generic modules, such as connection pooling libraries, task schedulers, or
    anything else not covered by a specialized class.

  * `newrelic.instrumentDatastore()`/`DatastoreShim`: This method is good for
    instrumenting datastore modules such as `mongodb`, `mysql`, or `pg`.

  * `newrelic.instrumentWebframework()`/`WebFrameworkShim`: This method is
    used for instrumenting web frameworks like `restify` or `express`.

  Documentation and tutorials for the new API can be found on our GitHub
  documentation page: http://newrelic.github.io/node-newrelic/docs/

* Rewrote built-in instrumentation using the new `Shim` classes.

  The following instrumentations have been rewritten:
    * Datastores
      * `cassandra-driver`
      * `ioredis`
      * `memcached`
      * `mongodb`
      * `mysql`
      * `node-cassandra-cql`
      * `pg`
      * `redis`
    * Web frameworks
      * `director`
      * `express`
      * `hapi`
      * `restify`

* The `@newrelic/native-metrics` module is now included as an optional dependency.

  This module will be installed automatically with Agent v2. If it fails to
  install the agent will still function.

### v1.40.0 (2017-06-07):
* Node v8 is officially supported with exception of `async`/`await`.

  Support for the new [`async`/`await`][mdn-async-function] keywords is coming
  in a future release. Until this support is added, using the agent with
  applications that utilize async/await is unsupported and highly discouraged as
  it could result in transaction state loss and data being mixed between
  transactions.

  Fixed issues related to changes in the core networking modules that resulted
  in transaction state loss. Also instrumented new asynchronous API methods in
  crypto and [inspector](https://nodejs.org/dist/v8.0.0/docs/api/inspector.html).

### v1.39.1 (2017-05-11):
* Fixed a transaction state loss introduced in Node 7.10.0 when using
  `net.createConnection`.

  Added a new segment for `net.connect`, `net.createConnection`, and
  `http.Agent#createConnection`. Sockets created within a transaction also have
  their `emit` bound to the segment.

* Fixed a typo about the name of the default configuration file. Thanks Jacob
  LeGrone (@jlegrone)!

### v1.39.0 (2017-05-01):
* Updated the default value for `transaction_tracer.record_sql` to `obfuscated`.

  This value was previously `off` by default. This change brings the New Relic
  Node Agent defaults in line with other New Relic Agents.

* Our when instrumentation better detects when a module is actually `when`.

  Thanks to Pasi Eronen (@pasieronen) for the contribution!

* Quiet a warning in our native promise instrumentation on Node 0.10.

* Error messages are redacted in High Security Mode now.

* New configurations were added for disabling some New Relic API methods. These
  default to enabled and are all disabled in High Security Mode.

  * `api.custom_parameters_enabled` controls `newrelic.addCustomParameters()`
  * `api.custom_events_enabled` controls `newrelic.recordCustomEvent()`
  * `api.notice_error_enabled` controls `newrelic.noticeError()`

* Fixed a bug in the generic pool instrumentation affecting version 3.

### v2.6.0 / beta-47 (2017-05-03):
* Incorporated fixes and features from 1.38.0, 1.38.1, and 1.38.2.

* Fixed the beta sign up link in the [readme](README.md).

* Improved API for writing web framework instrumentation.

  Introduced a new `WebFrameworkShim` class for writing instrumentation. This
  shim can be accessed using the `newrelic.instrumentWebframework` API method.

* Rewrote instrumentation for Connect, Director, Express, Hapi, and Restify.

  These instrumentations were rewritten using the new `WebFrameworkShim`. As a
  consequence of this rewrite, all our instrumentations now have feature parity,
  meaning every instrumentation will create Middleware metrics for your server.

  Tutorials on using the new instrumentation shim can be found on our API docs:
  http://newrelic.github.io/node-newrelic/docs/.

* Removed `express_segments` feature flag.

  This configuration previously controlled the creation of middleware metrics in
  our Express instrumentation. With the move to the WebFrameworkShim this was
  dropped.

* Only one transaction is created for each request emitted by a server.

  Previously we created a transaction for each _listener_ on the `request` event.

* Dropped support for Express <4.6.

### v1.38.2 (2017-03-29):
* When.js hooks similar to `Promise.onPotentiallyUnhandledRejection` now function
  as intended.

  Previously, hooks like `Promise.onPotentiallyUnhandledRejection` would not
  work due to the way the agent wraps the promise constructor. When.js expects
  these handles to be assigned directly onto the promise constructor, and our
  wrapper was intercepting the assignment. The wrapper will now properly proxy
  these values and assign them onto the original constructor, restoring the
  proper behavior.

* Express route parameters will now be properly attached to the corresponding
  transaction.

  Previously, our express instrumentation would read the route parameters and
  place them on the segment responsible for matching the parameters. This
  behavior did not place the parameters on the transaction that the segments
  belonged to, causing the parameters to not show up properly on transaction
  traces and transaction events.

### v1.38.1 (2017-03-17):
* Fixed issue with when.js instrumentation not preserving all properties on wrapped
  Promise constructor.

  Previously, the when.js instrumentation would cause an unhandled exception when private
  methods on the Promise constructor were called (e.g. when adapting functions that do
  not use promises).

### v1.38.0 (2017-03-16):
* We're excited to announce the addition of a new Node VMs page to the UI that provides a
  curated view of the cpu, memory, garbage collection, and event loop metrics that we have
  added over the past several releases of the node agent and native-metrics module.

  For more information, see [our documentation.](https://docs.newrelic.com/docs/agents/nodejs-agent/supported-features/node-vms-statistics-page)

* Added instrumentation of When.js promise library.

 Previously, the transaction state could get lost when multiple promises resolved close
  to each other.

* Fixed name of environment variable in error message when configuration file cannot be found.
  Thanks to @Maubic for the contribution!

* Updated tests to work with the latest version of Node 7.

### v2.5.0 / beta-46 (2017-02-22):
* Incorporated fixes and features from 1.36.2, 1.37.0, and 1.37.1.

* Domains are no longer preemptively instrumented, thus applications that do not
  use domains will not load the domain module.

  Including the domain module causes a small amount of extra overhead in other
  core libraries that must keep the domain state set correctly.

* Added support for recording interfaces that return promises instead of taking
  callbacks. See `RecorderSpec.promise` for more details.

  Thanks to Gert Sallaerts (@Gertt) for this contribution.

### v1.37.1 (2017-02-16):
* Agent now wraps `emit` on http request/response objects instead of relying
  on listeners.

* Fixed a bug in normalization rules when replacements do not maintain initial `/`.

* Removed unused `yakaa` dependency.

* Better de-duplication of errors when the same error instance is used multiple
  times.

* Server-side naming rules are now applied even when user defined ones have
  matched.

* Improved documentation for `newrelic.noticeError()` and `ignore_status_codes`
  configuration.

  The documentation now makes it clear that errors recorded using `noticeError()`
  do not obey the `ignore_status_codes` configuration value.

* Errors reported outside of a transaction now include their stack trace on the
  error analytics page.

* A potential stack overflow in trace serialization has been removed.

* Fixed an issue with our Express and domain instrumentation related to a loss
  of transaction state that could result in incorrect transaction names, traces,
  and events.

* Nested background transactions now report the correct number of metrics.

### v1.37.0 (2017-02-08):
* The agent now reports event loop metrics on supported platforms.

  On node versions 0.12, 4, 6, and 7 the agent will now record the number of event loop
  ticks per minute, and CPU time spent in each tick. You can read more about it on
  [our docs site!](https://docs.newrelic.com/docs/agents/nodejs-agent/supported-features/node-vm-measurements)

* The agent no longer creates a segment for each row returned from a PG query when the
  pg-query-stream module is used.

* Removed io.js from our test suite, since it has not been supported for some time.

* Internal properties used in our promise instrumentation are now non-enumerable to
  prevent unexpected keys showing up for clients.

* Agent now uses safe stringification when encoding payloads in order to prevent an issue
  with circular references.

* Fixed issue with the agent holding the process open when retrying to connect to the
  collector.

* Quieted a log message warning users about their own settings.

* Fixed typo in a log message.  Thanks to Dave Bobak (@davebobak) for the contribution.

### v1.36.2 (2017-01-26):
* Fixed issue with timing Redis operations when called without a callback.

  Previously these operations would continue to be timed until the transaction ended, and
  as a result reported incorrect times.

* Transactions that result in a 404 HTTP error are now named "(not found)".

  Previously these transactions were reported with no name (e.g. get /).

* When the newrelic.js configuration file is not present, the agent now logs a message
  to the console and no longer prevents the app from starting up.

### v2.4.0 / beta-45 (2017-01-25):
* Rewrote the `cassandra-cql` and `memcached` instrumentations using the
  `DatastoreShim`.

* Improved instrumentation matching.

  Previously, the agent would determine which instrumentation would run for a
  given module being loaded using the basename of the file path. This lead to
  false positives (e.g. `myapp/lib/express.js` would trigger the express
  instrumentation) which we previously just ignored. Matches are now determined
  using the string passed to `require`. This means you can now match local
  relative paths (`./lib/something`) as well as package-relative paths
  (`amqplib/callback_api`).

### v2.3.1 / beta-44 (2017-01-12):
* Incorporated fixes from 1.36.1

### v1.36.1 (2017-01-12):
* Stop collecting URL parameters from the HTTP referer header

  The Node agent collects the request headers during an error trace to help determine
  the root cause of problems. The referer header is the URI that identifies the address
  of the webpage that linked to the resource being requested. It is possible that
  the referer URI may contain sensitive information in the request query parameters.
  New Relic has found that the query parameters are not properly stripped during
  the error trace. This update fixes this by stripping the query parameters from
  the referer in the request header before sending this data to New Relic.

  This release fixes [New Relic Security Bulletin NR17-01](https://docs.newrelic.com/docs/accounts-partnerships/accounts/security-bulletins/security-bulletin-nr17-01).

* Improved logging of modules that did not get instrumented.

### v2.3.0 / beta-43 (2017-01-04):
* Incorporated new features and fixes from 1.34.0, 1.35.1, and 1.36.0

* The `@newrelic/native-metrics` module is now an optional dependency of the
  agent.

  Now npm will attempt to install the module when the agent is installed. If it
  fails for whatever reason, the agent itself will still be installed correctly
  and the rest of the npm install will finish normally.

### v1.36.0 (2016-12-21):
* Added CPU metric gathering to Node.js versions <6.1

  As of this release the agent will attempt to gather CPU usage metrics via the
  optional `@newrelic/native-metrics` module.

* Added additional memory usage classification metrics.

  The agent will now report memory metrics that break down memory by its current
  use.

  For more information on these features, see [our documentation.](https://docs.newrelic.com/docs/agents/nodejs-agent/supported-features/node-vm-measurements)

### v1.35.1 (2016-12-13):
* Removed automatic installation of `@newrelic/native-metrics`.

  Due to the way npm v3+ flatten dependencies, a bug in the version of npm
  packaged with Node v5, and npm v1's ungraceful handling of scoped packages
  we have opted to not automatically install this module.

  If you would like to see native metrics for your application, you can add the
  `@newrelic/native-metrics` module to your `package.json` and the Node Agent
  will automatically pick it up.

* Corrected attribution of the Bluebird patch in the last release's notes.

  Thanks to Matt Lavin (@mdlavin) for this correction!

### v1.35.0 (2016-12-12):
* The agent will now report garbage collection statistics on supported
  platforms.

  On node versions 0.10, 0.12, 4, 6, and 7 the agent will now record the time
  spent in, the number of, and type of garbage collection cycles. You can read
  more about it on [our docs
  site!](https://docs.newrelic.com/docs/agents/nodejs-agent/supported-features/node-vm-measurements)

* The agent no longer double counts MySQL query times when using a connection
  pool.

  Previously, when using a pool of connections a query done through the pool
  would be recorded as the time it took on the pool, as well as the connection,
  effectively counting the time twice.  This is no longer the case.

* The agent will no longer lose transaction state across Bluebird's `promise.nodify`.

  Thanks to Matt Lavin (@mdlavin) for this contribution!

### v1.34.0 (2016-11-10):

* The agent now collects CPU metrics when running under Node 6.1.0 and higher.

  Node 6.1.0 introduced an API to get CPU time usage of the running Node process.
  We are now collecting this data as new metrics.

* The agent now has a separate configuration for audit logging.

  Previously the data that the agent sends to the collector was logged only in trace
  logging mode, making the logs unnecessarily large and noisy.  The agent can now include
  this data independent of the logging level using separate configuration settings.

* A new API method addCustomParameters() has been added to allow adding multiple custom
  parameters at once.  Thanks to Austin Peterson (@AKPWebDesign) for this contribution!

* The shutdown() API now waits for connection to collect pending data.

  When a flag to collect pending data is provided to the shutdown() method, the agent now
  ensures a connection to the collector has been established.  This is useful when
  the Node process is short-lived, such as in AWS Lambda.

* Updated tests to run on Node 7.

  Node 7 is officially supported as of the previous release, v1.33.0.

* The setIgnoreTransaction() API now works for background transactions.

* Fixed issue with Synthetics result not displaying a link to the corresponding
  transaction trace.

* Added running the nsp (Node Security Platform) tool to the test suite to help with
  detecting security-related vulnerabilities.

### v2.2.0 / beta-42 (2016-11-09):

* Incorporated new features and fixes from v1.30.4, v1.30.5, v1.31.0, v1.32.0,
  and v1.33.0.

### v1.33.0 (2016-10-31):

* The agent now collects database instance information for Memcached operations.
  This information (database server and database name) is displayed in transaction
  traces and slow query traces.

* socket.io long-polling requests are now ignored by default.

  Collecting metrics for these requests is typically not desirable since they are
  frequent and do not represent business transactions.  Previously we recommended adding
  an ignore rule manually.  Now it is included by default.

* Improved test coverage for Postgres and MongoDB instrumentations.

### v1.32.0 (2016-10-20):

* The agent now collects database instance information for MySQL and MongoDB
  operations. This information (database server and database name) is displayed in
  transaction traces and slow query traces.

* Datastore instance configuration can now be done through environment
  variables.  These can be set through `NEW_RELIC_DATASTORE_INSTANCE_REPORTING_ENABLED`
  and `NEW_RELIC_DATASTORE_DATABASE_NAME_REPORTING_ENABLED`

* The agent will no longer crash the process when an express param handler is
  executed when a transaction is not active.

### v1.31.0 (2016-10-12):

* The agent now collects database instance information for PostgreSQL and Redis
  operations.  This information (database server and database name) is displayed in
  transaction traces and slow query traces.

### v1.30.5 (2016-10-04):

* Fixed issue with aborted requests causing the agent to crash in some cases.

  Previously the agent would crash when the client request aborted before Express server
  sent a response and encountered an error.

* Upgraded integration tests to work with the latest version of node-tap.

### v1.30.4 (2016-09-27):

* Improved instrumentation of native promises.

  Native promises now use the same instrumentation as Bluebird, making
  instrumentation easier to maintain and more consistent across libraries.

* Fixed issue with reloading normalization rules from the server.

  Upon reset, the agent will clear the existing naming rules, removing any
  vestigial rules that may have changed or been disabled.

* Fixed issue with key transactions Apdex metric.

  Key transactions now effect the global Apdex metric according to their own
  ApdexT instead of the default ApdexT value.

* Fixed issue with closing transactions when the request is aborted.

  Previously, aborted requests would result in the transaction remaining open
  indefinitely. Now the transaction will be correctly finished and its resources
  freed.

* Fixed format of external calls metric.

  External service URLs will now be formatted the same as they are in the
  originating application.

### v2.1.1 / beta-41 (2016-09-15):

* Incorporated fixes from v1.30.1, v1.30.2, and v1.30.3.

### v1.30.3 (2016-09-14):

* Published with npm v2.

### v1.30.2 (2016-09-13):

* Added instrumentation of the param() function in Express.

  The agent will now create metrics and transaction segments when the Express param()
  function is called as a part of a route.  This also fixes an issue with transaction
  naming when the HTTP response is ended within a param() method.

* Fixed an issue with naming Express transactions that result in 404 errors.

  Previously transactions were not always correctly normalized for URLs that caused
  404 errors. The transactions will now always be reported with the same normalized name
  (e.g. "get /").

* Fixed instrumentation of Express v4.0 - v4.5.

  Previously transactions were not correctly named on older versions of Express 4.

* Minor updates to logging.

### v1.30.1 (2016-09-01):

* The `shutdown` method is now on the stub API.

  Previously when the agent was disabled the stub API passed back on require
  did not have the `shutdown` method.  Thanks goes to Vlad Fedosov (@StyleT) for
  this contribution!

* Global timers will now be wrapped correctly regardless of being wrapped by
  something else.

  The logic to check whether to wrap the `global` timers was looking to see if
  the `global` timers were the same function reference as the ones in the
  `timers` module.  This would break in cases where either the `global` or
  `timers` functions had been wrapped.

* Director instrumentation now correctly handles the case of null route handlers
  being passed in.

  Previously the agent's director instrumentation would crash in cases of null
  route handlers in director.

### v2.1.0 / beta-40 (2016-08-29)

* Incorporated fixes from v1.30.0

* Added `rowCallback` property to datastore segment descriptors.

  With this parameter the shim will record the given function/parameter as a
  per-row callback which may be called multiple times. These calls will be
  counted up for traces.

* Rewrote PostgreSQL instrumentation using new `DatastoreShim` class.

* Reversed `reverse_naming_rules` default.

  Naming rules now default to evaluating in forward order.

### v1.30.0 (2016-08-25):

* A number of improvements and fixes to transaction naming rules.

  Added attributes `terminate_chain`, `replace_all`, and `precedence` to allow more
  control over how naming rules are executed.  Please see the updated documentation in
  our README file.

  The order in which naming rules are executed can now be reversed with a feature flag
  `reverse_naming_rules`.

  When applying naming rules, the regular expression matching is now case insensitive.

  We have added a tool for testing naming rules.  When the agent is installed, the tool
  can be run in terminal by executing `node node_modules/.bin/newrelic-naming-rules`.

  We have also improved our trace logging around transaction naming.

* Fixed issue with reporting errors from domains.

  When an error is handled by using the `error` event of the domain, it is no longer
  reported as an uncaught exception.

* Added trace logging to track number of transactions and segments in progress, and to
  better track segments created with the Express instrumentation.

* Fixed mysql2 tests that were not being run correctly.

### v2.0.0 / beta-39 (2016-08-04):

* Dropped support for Nodejs < 0.10.

  Starting with agent 2.0.0 we are no longer testing or supporting the agent on
  Node.js prior to 0.10. Customers are strongly encouraged to follow best
  practices and run supported versions of the Node.js runtime so that you can
  get the latest and greatest New Relic features. For legacy Node support, agent
  versions 1.x will continue to work, but we have no plans to backport any
  future features or fixes.

* Dropped support for `node-mysql` < 1.0.0.

  Support for versions of the MySQL driver <1.0.0 has been removed. They will
  not work with the agent versions >=2.0.0.

* Improved API for writing instrumentation.

  Introduced new classes for writing instrumentation, `Shim` and `DatastoreShim`.
  These classes along with the new `newrelic.instrument` and
  `newrelic.instrumentDatastore` methods make writing 3rd party instrumentation
  much easier.

* Rewrote instrumentation for Cassandra, Redis, ioredis, MySQL, and MongoDB.

  These instrumentations were rewritten using the new `DatastoreShim` interface.
  Their functionality is largely unchanged but the new code should be easier to
  maintain and extend.

* Added public API documentation.

  Documentation for the New Relic agent API has been generated using JSDoc and
  is now hosted on GitHub at https://newrelic.github.io/node-newrelic. There you
  can find documentation on the new classes as well as the pre-existing API
  methods.

### v1.29.0 (2016-08-03):

* Reworked the SQL parser to handle new lines in the query.

  Previously the agent would have difficulty classifying queries with new lines
  in them.  Thanks to Libin Lu (@evollu) for the fix!

* Postgres instrumentation is now compatible with inputs with text getter attributes.

  Thanks again to Libin Lu (@evollu) for the fix!

* Domain error handlers will now be scoped to the transaction the error occurred in.

  Previously, the `'error'` event handlers would not be scoped to a transaction causing
  our API methods to not associate data correctly (e.g. using `noticeError`
  would not associate the error with the transaction and would instead be
  unscoped).

### v1.28.3 (2016-07-13):

* Removed excessive segment creation from PG instrumentation.

  For queries with many results we would create a segment for each result. This
  would result in excessive object allocation and then cause harsh GC thrashing.

* Improved agent startup speed by ~10% by simplifying environment checks.

  Removed prolific `fs.exists` and `fs.stat` checks, instead simply handling the
  error for mis-used files which greatly reduces disk access.

* Fixed a bug in agent connect that could cause an identity crisis under
  specific use cases.

  When using the agent with multiple app names, transaction information could be
  misattributed to other services if they share the same first app name. This
  resolves that by using all of the host names to uniquely identify the agent.

* Added slightly more trace-level logging around the creation of segments.

* Added examples for using the `newrelic.createBackgroundTransaction` method in
  a number of different use cases.

### v1.28.2 (2016-07-07):

* Director instrumentation that will now name the transaction correctly,
  as well as create segments corresponding to the handlers registered
  with director.

* Transaction naming refactor - this should clear up some inconsistent naming
  issues in our router instrumentations.

  Previously the instrumentation was tasked with the maintenance of the
  transaction state name, now this has been abstracted into its own class to be
  used by instrumentations.

* Express instrumentation refactored to scope transaction storage to the
  incoming request object.

  Previously the express instrumentation used a stack to track which router was
  expecting middleware to finish and keep track of which transaction is being
  executed. The new implementation has a stronger guarantee on scoping work to
  the correct transaction.

* The agent now uses the correct units for slow queries - this fixes and issue
  where query traces in the databases tab were slower than the reported maximum.

### v1.28.1 (2016-06-15):

* The following attributes are now sent to Insights along with transaction events:  databaseDuration, databaseCallCount.

* Fixed a few issues with the Express instrumentation.

  Middleware functions mounted with a path variable now generate the correct middleware metrics.  Routers mounted using route methods now generate the correct trace segments and times.  Routers mounted on root path are now not included in trace when they contain no matching routes.

* Updated Redis instrumentation to work with version 2.x of the redis module.

* Improvements to error tracking on systems that have a lot of errors.

* Other minor changes to tests and logging.

### v1.28.0 (2016-05-25):

* Express middleware metrics are now enabled by default.

* The following attributes are now sent to Insights along with transaction events:
  externalDuration, externalCallCount, and queueDuration.

* Custom SSL certificates (from the agent configuration) are now used even when a proxy
  is not explicitly defined. This is useful in some environments that use an implicit
  proxy for all network traffic.

### v1.27.2 (2016-05-05):

* Fixed duplicated external transactions for `https` requests in Node > 0.10.

  Any external transaction that used the `https` module to make the request
  would appear twice in transaction traces due to `https.request` internally
  using `http.request`. This has now been resolved.

* Updated eslint dev dependency to 2.9.0 (was 0.24.1).

* Fixed an issue with transaction naming precedence.

  Custom naming of transactions will no longer be replaced by names generated by
  the instrumentation.

* Fixed tests which broke under Node 6.0.

  Node 6.0.0 changed some messaging and internal functionality which our tests
  were asserting on. These tests have been updated to work with either the new
  version or the older ones.

* Fixed installing GCC 5 in Travis for testing native modules in Node >= 3.0.

  Starting in Node 3.0, native modules were compiled with C++11 features
  enabled. The version of GCC preinstalled on Travis was too old to support that
  so we now manually install GCC 5 and set it as the system compiler.

* Fixed metrics that were being scoped to themselves.

  Some metrics were scoped to themselves causing a strange visual glitch in the
  RPM UI. This self-scoping has been removed.

* Added tests for transaction naming with parallel requests in Express.

### v1.27.1 (2016-05-03):

* Fixed issue with checking listener count for uncaughtException and unhandledRejection
  global events.

* Fixed a number of issues with promise instrumentation of Bluebird.

### v1.27.0 (2016-04-21):

* Added a .npmignore file to exclude non-essential files.

  The agent will now omit tests and examples on install from npm, drastically
  improving download times.  Thanks to Serge Havas (@Sinewyk) for the
  contribution!

* The agent now properly checks for custom SSL certificates.

  The check previously was falsely positive if there was an empty list of custom
  certificates.  This caused red herrings to be admitted into the debug logs.
  Thanks to Seth Shober (@sethshober) for the fix!

* Reworked promise instrumentation to be more reliable and reusable.

  Promise instrumentation has been rewritten to be applicable to any A+
  compliant promise library.  This change brings more consistent
  instrumentation of Bluebird promises.

  This change also allows users to see the execution order of chained promises
  in their Transaction Traces.  This is an opt-in process and can be achieved by
  setting `feature_flag.promise_segments` to true in the agent config.

* Promise error handling is now more consistent.

  Previously the agent would notice errors being emitted on 'unhandledRejection'
  regardless of other listeners.  Errors coming in on the 'unhandledRejection'
  event will not be recorded if there are handlers for the event - this is more
  in line with our error handling practices in other instrumentations.

* Logging has been reworked to reduce CPU overhead.

  The check to see if a logging call was valid happened fairly late in the
  logic, causing unnecessary work to be done regardless of logger state.  This
  has been rectified, netting a large decrease in CPU overhead.

### v1.26.2 (2016-04-07):

* Added ioredis instrumentation.

  Big thanks to Guilherme Souza (@guilhermef) for the contribution!

* Added a new shutdown call to the public API.

  Thanks to @echmykhun for the contribution!

  The new shutdown API call will gracefully stop the agent.  It can optionally
  harvest any pending data waiting to be sent to the New Relic servers before
  shutting down.

  To read more about this new API, please read our README, or visit our
  [docs page](https://docs.newrelic.com/docs/agents/nodejs-agent/supported-features/nodejs-agent-api#shutdown).

* Fixed an issue in the express instrumentation related to inactive/lost
  transaction state.

  Thanks to Jacob Page (@DullReferenceException) for submitting this fix.

  Previously, the agent would crash if there was no active transaction when
  an Express middleware would handle the request.

* Added support for truncated segment notifiers.

  Segments related to work that happens after a transaction has finished will
  now be labeled as Truncated in the UI.

* The agent now uses MongoDB's APM API for its instrumentation.

  Method discovery for instrumentation is now done through MongoDB's APM API in
  newer versions of the MongoDB driver.

### v1.26.1 (2016-03-30):

* Added capturing errors from the unhandledRejection global event.

  If a promise is rejected with an error, and the error is not handled, the error
  will now be reported to New Relic.

* Fixed issue with attaching an event handler every time Express was required.

* Fixed issue with chained promises losing context.

  Previously the transaction state was getting lost when an error was thrown early in
  a promise chain.

* Fixed issue with the agent crashing when an http Server did not have
  the address() getter.

* Fixed issue with Express instrumentation when a wrapped layer object was
  missing a method.

* Added more logging around the CAT feature.

### v1.26.0 (2016-03-23):

* Express instrumentation has been fundamentally reworked.

  This refactor includes a few bug fixes around error handling and transaction
  naming, as well as optional higher resolution traces.

  The agent will not report errors handled in an error handler it is monitoring - this
  is more in line with how the agent does error handling in other contexts.

  The agent will now name transactions correctly when an application responds
  from a middleware.

  Setting `feature_flag.express_segments` to true in the agent config will
  make the agent report the amount of time spent in each individual middleware per request

### v1.25.5 (2016-03-09):

* Added instrumentation of Bluebird promises.

  Previously, the transaction state could get lost when multiple promises resolved
  close to each other.

* Fixed issue with PostgreSQL native instrumentation.

  Previously, calling `require('pg').native` more than once was causing
  the agent to crash.

* Fixed issue with hapi instrumentation not returning value from Server.connection().

* Various improvements to tests to make them more stable.

### v1.25.4 (2016-02-24):

* Added more HTTP request/response parameters to transactions.

  The agent now collects additional request/response HTTP headers (e.g. contentType, HTTP method, response status code).  These can be used to filter and group errors in the Error analytics page, as well as events in Insights.

* Fixed an issue with collecting errors when an Express error handler removed message and stack properties from the error object.

### v1.25.3 (2016-02-18):
* Fixed crashing bug on unhandled rejections in Q.

  Previously, the agent would cause the process to crash in the event of an
  unhandled rejection.

  Thanks to @mdlavin for this fix!

### v1.25.2 (2016-02-17):
* Added Q instrumentation.

  The node agent now accurately records programs using Q for promises.

  Thanks to @mdlavin for the contribution!

* Added node-mysql2 support.

  Thanks to @jhollingworth for adding node-mysql2 support to the agent.

* Query streaming in node-mysql now works while using the agent.

  Previously, due to the way node-mysql was instrumented query streaming would
  be forced off when the agent was collecting data.  This is no longer the case
  and query streaming will work and be recorded as expected.

### v1.25.1 (2016-01-26):

* Corrected an issue where the agent would sometimes crash looking up the port
  of the HTTP server that a request came from.

  Previously, the agent assumed the HTTP server would always have an address,
  unfortunately this isn't the case if the HTTP server's `.close()` has been
  called.


### v1.25.0 (2016-01-20):

* Added support for the new [Response Time Line](https://docs.newrelic.com/docs/data-analysis/user-interface-functions/response-time) and better representation of asynchronous data.

  This has many implications in the UI. The first is the
  [Application Overview](https://docs.newrelic.com/docs/apm/applications-menu/monitoring/apm-overview-page),
  in the past we've always just shown "node" and maybe
  "[request queueing](https://docs.newrelic.com/docs/apm/applications-menu/features/request-queuing-tracking-front-end-time)"
  on the response time graph. We now show you an application breakdown like our
  other language agents! This means you'll be able to see how much time was in
  HTTP externals, your various datastores, or spent in node itself. Overlaid on
  this will be your response time as a blue line.

  Next page that has been affected is our
  [Transaction Overview](https://docs.newrelic.com/docs/apm/applications-menu/monitoring/transactions-page)
  page. Specifically when you click into a Transaction to see more detail.
  Previously we showed you a breakdown of the top time consumers in that
  transaction, both as a graph and as a table. Unfortunately that graph didn't
  show response time and the table would show percentages over 100%. Now, like
  the Application Overview, you will get a blue response time line and the
  breakdown table will have numbers that add up much more intuitively!

  Finally, our
  [Transaction Trace](https://docs.newrelic.com/docs/apm/transactions/transaction-traces/viewing-transaction-traces)
  view has also been updated. The change is very similar to the changes
  mentioned above for the breakdown table in the Transaction Overview page. You
  should no longer see percentages over 100% here either.

* Transaction trace serialization is now 4x faster than before.

  This speedup will primarily affect those with large, deeply nested
  transactions. Though small transactions have seen some improvement as well.

### v1.24.1 (2015-12-30):

* Error totals are now reported.

  The agent now reports metrics that reflect the total number of errors that
  have occurred in web and background transactions.

* Disabling SSL no longer requires the setting of a port.

  Previously, the agent required changing `port` in the config to `80` when
  disabling SSL. The agent will now default to port 80 if a port is not supplied and SSL
  is turned off.

* Logging functions have been improved.

  The agent will now properly log error stack traces and can rate limit logging
  messages. To aid in debugging we have provided more logging about the public API.

### v1.24.0 (2015-11-18):

* Advanced Analytics for APM Errors

  With this release, the agent reports [TransactionError events](https://docs.newrelic.com/docs/insights/new-relic-insights/decorating-events/error-event-default-attributes-insights). These new events power the beta feature [Advanced Analytics for APM Errors](https://docs.newrelic.com/docs/apm/applications-menu/events/view-apm-errors-error-traces) (apply [here](https://discuss.newrelic.com/t/join-the-apm-errors-beta-of-real-time-analytics/31123) to participate). The error events are also available today through [New Relic Insights](http://newrelic.com/insights).

  Advanced Analytics for APM Errors lets you see all of your errors with
  granular detail, filter and group by any attribute to analyze them, and take
  action to resolve issues through collaboration.

* `NEW_RELIC_LOG_ENABLED` environment variable is now treated as a boolean.

  Previously, this option was treated as a string, causing it to not work for
  some use cases. Thanks to @jakecraige for contributing this fix!

### v1.23.1 (2015-11-05):

* `newrelic.getBrowserTimingHeader()` API now includes the full transaction name.

  Previously, the agent would use a fragment of the transaction name, causing
  Browser Monitoring transactions and APM transactions to not be cross linked.
  This change makes the cross linking work correctly.

### v1.23.0 (2015-10-29):

* The New Relic Node Agent now officially supports Node v4!

  We are excited to announce that the New Relic Node Agent officially supports
  Node v4.x!  We've tested the agent across all major versions of Node used by New
  Relic customers to ensure a quality Node APM experience.  New Relic recommends
  upgrading to Node v4.x for best Node Agent performance.

* Corrected a parsing issue in the slow sql query parsing step.

  Previously, the agent would not be able to parse inputs to database libraries
  that specified sql as an option param. This was an issue with node-mysql,
  namely. The agent now correctly handles this case and registers the queries as
  expected.

### v1.22.2 (2015-10-14):

* Removed client support of the RC4 stream cipher for communicating with the New
  Relic servers.

  The RC4 cipher is considered unsafe and is generally being deprecated.

* Fix for logging version number in Express instrumentation.  Thanks @tregagnon.

  When an unsupported version of Express is detected, we log a message that
  contains the Express version number.  The version is a string and was being
  logged as a number, resulting in NaN in the log message.

* Agent is now more safe when recording memory stats.

  Previously, the agent would crash the process as it was gathering memory usage
  information (i.e. when process.memoryUsage threw an error). This defect is now
  guarded against with a try-catch.

### v1.22.1 (2015-08-20):

* Express and Connect instrumentation will no longer crash on Node 4

  As of ES6, the `Function.name` attribute will track if the function
  is a getter/a setter/is bound to (i.e. `fn.bind().name ->` `'bound ' +
  fn.name`).  This new behavior caused the agent to crash on start up due to the
  way connect and express are instrumented.  The agent is now more defensive of
  future implementations of ES6.

### v1.22.0 (2015-08-20):

* Errors will now respect its transaction's ignore state.

  When ignoring transactions, related errors will now also be ignored.

* The agent can now handle immutable and frozen error objects.

  In rare cases the agent gets passed an immutable error object. The
  agent would then crash when trying to tag the error object with the
  current transaction. We now handle these errors properly.

### v1.21.2 (2015-08-06):

* Corrected a defect in the handling of uncaught exceptions

  This defect was surfaced in versions of node that did not have
  `process._fatalException`, namely v0.8. When an uncaught exception
  occurs, the agent now records the error and passes it along to the other
  uncaught exception handlers that have been registered.  This was
  inverted before, passing along errors when there were no other error
  handlers present and rethrowing otherwise.

### v1.21.1 (2015-07-13):

* Moved `concat-stream` from dev dependencies to production dependencies.

  Last week we released v1.21.0 but forgot to move a dependency. We've
  removed v1.21.0 from npmjs.org and this release contains the changes
  from that version.

### v1.21.0 (2015-07-10):

* Added configurable host names.

  The agent now has configuration settings to allow configuration of
  custom host names. Set `process_host.display_name` to enable this.

  If this conifig is not set, the agent will continue to use the host
  name found through an `os.hostname()` call. Should this lookup fail
  somehow, `process_host.ipv_preference` can now be set to `4` or `6`
  to configure the type of ip address displayed in place of the host
  name.



### v1.20.2 (2015-06-23):

* Fixed a bug where custom events weren't being sent.

  In a refactor of our data collection cycle, we omitted the custom
  events from the list of commands, this is now fixed.

* Fixed a very rare bug where the custom event pool could be set to 10
  instead of the user config value. This patch was contributed by
  [shezarkhani](https://github.com/shezarkhani), thanks!

  This case would only be hit if you disabled custom events via server
  sent config while there were custom events ready to be sent. Then
  you later reenabled it via server sent config. It would only occur
  for one data collection cycle then reset back to the correct size.



### v1.20.1 (2015-06-11):

* Fixed a bug in custom event recording limits.

  Previously, the agent would use the config value for max events
  (default of 1000) for the first harvest of custom events, then would
  use an internal default for the reservoir with max of 10 events for
  each harvest after that, resulting in less than the expected number
  of events being sent.

* Exposed the `custom_insights_events` settings in the user config.

  You can now set `custom_insights_events.enabled` and
  `custom_insights_events.max_samples_stored` in your `newrelic.js`.

  Read more about these settings in our
  [documentation](https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration#custom_events).

### v1.20.0 (2015-06-05):

* Triaged a defect in native promise instrumentation

  Transactions used to be lost acrossed chained `.then` calls.  The way
  promises are wrapped has been changed to fix this issue.

* Added support for Slow Queries

  Slow Query information will now appear in the UI for Node agent users.
  This feature allows you to see a trace for slow datastore queries.
  Read more about this feature in our
  [documentation](https://docs.newrelic.com/docs/apm/applications-menu/monitoring/viewing-slow-query-details)

### v1.19.2 (2015-05-21):

* Fixed an issue with Error tracing

  Previously the agent could sometimes cause issues with user serialization
  of error objects after they passed through the error tracing code.

* MongoDB cursor count method is now instrumented

  The `count` method on MongoDB cursors is now instrumented. Previously, count
  would not be included in transaction traces.

* Fixed a typo in NEWS.md

  Previously the release notes for v1.19.1 were included as notes for 1.19.0.
  This has now fixed thanks to @bruun

### v1.19.1 (2015-05-14):

* Fixed a bug in native ES6 Promise instrumentation.

  Previously the Promise instrumentation would cause `instanceof Promise`
  to return false even if the object was a promise.  This also caused an
  incompatibility with async-listener. `instanceof` checks will now work on
  both the wrapped and unwrapped Promise object.

### v1.19.0 (2015-05-06):

* Fixed a bug with error handling.

    Previously the agent could crash applications in certain situations
    where `null` was thrown rather than an `Error` object.

* Filesystem interactions are now recorded in metrics

  The time spent in filesystem functions during a transaction will now
  be displayed in the transaction overview page per operation.

### v1.18.5 (2015-05-01):

* Fixed a bug in environment variable based configuration.

  Previously the agent would parse the `NEW_RELIC_APDEX` environment
  variable as a string rather than a float this could cause data to be
  sent to New Relic servers in an invalid format, preventing the data
  from being collected.

* Fixed a bug with the error collector's handling of ignored status codes.

  Previously the agent would not properly ignore status codes if the
  status code was set using a string rather than a number.

* Fixed a bug in mysql instrumentation.

  Previously the mysql instrumentation could cause errors when making
  mysql queries using an options object rather than a SQL string. The
  agent now handles arguments to the query method in a more robust
  way.

### v1.18.4 (2015-04-22):

* Fixed an inverted `if` in config loading.

  Previously, the config loader would log a warning on success, rather
  than failure.  Configuration loading works as expected now.

* Fixed a bug in `process.nextTick` instrumentation for io.js 1.8.1.

  Previously the agent would only pass the callback argument to
  `process.nextTick`. This did not cause issues in Node.js and older
  version of io.js, since additional arguments were ignored. In a
  recent change to io.js, `process.nextTick` was changed to pass any
  additional arguments to the callback, the same way `setImmediate`
  does. This change ensures all arguments are handled as expected.

### v1.18.3 (2015-04-16):

* Wrapped all our calls to `JSON.parse` in try/catch.

  Previously, only calls that were considered unsafe due to external
  data input were wrapped. We are taking a more defensive stance and
  wrapping them all now.

* Timers attached to `global` are now instrumented correctly in all version
  of io.js.

  As of v1.6.3 of io.js, timers are no longer lazily loaded from the timers
  module, and are placed directly on the global object. The agent now takes
  this change into account and accurately wraps the timer methods.

* Improved handling of cross-application tracing headers.

  Paths that include multibyte characters will now show up correctly in cross
  application maps

### v1.18.2 (2015-04-09):

* Wrapped all our calls to `JSON.stringify` in try/catch.

  Previously, only calls that were considered unsafe due to external
  data input were wrapped. We are taking a more defensive stance and
  wrapping them all now.

### v1.18.1 (2015-04-02):
* Names assigned to errors via `Error.name` now appear in the UI.

  Previously, the name of an error in the UI appeared as `Error.constructor.name`
  or with a default of `Error`. Now the common pattern of `Error.name`
  is respected and takes precedence.

* Child segments of external calls will now be nested correctly.

  This change causes segments that make up external calls to nest
  under the call correctly. Previously, the child segments appeared
  as siblings to external calls.

* The `request_uri` attribute on errors will now only include the path
  without any parameters.

  This behavior now matches the other New Relic agents.

### v1.18.0 (2015-03-26):
* Reduce agent CPU overhead by omitting `setImmediate` from traces.

  The change to `setImmediate` makes that function behave the same way
  as `nextTick` and other frequently-called functions that are already
  elided from Transaction Traces.

* Mitigate a Node.js memory leak that can occur during TLS connections.

  There is an outstanding Node.js Core memory leak involving TLS
  connections. Clients specifying certificates, such as the New Relic
  Agent, quickly reveal this leak. We now mitigate this issue by using
  the default client certificates where possible. A new log message
  will be printed when the TLS memory leak workaround can not be used,
  such as when using a custom certificate with an HTTPS proxy.

### v1.17.3 (2015-03-19):
* Fixed a bug where external requests report times longer than the
  transactions that initiated them.

  External request segments are now always ended when an error occurs.

* Fixed a bug that produced incorrect transaction names for some routes
  in express2 and express3.

### v1.17.2 (2015-03-12):
* Fixed a bug that interfered with listing the routes in Express apps.
* Fixed a bug that caused custom transaction names to appear as "unknown".
* Added more log detail when instrumentation fails to load.

### v1.17.1 (2015-03-05):
* Added instrumentation support for Postgres 4.x.
* Added instrumentation support for Datastax's Cassandra driver.
* Updated Oracle instrumentation to collect new datastore metrics.

### v1.17.0 (2015-02-25):

* Added instrumentation for modules in node core.
* Added support for native Promises in Node.js 0.12 and io.js 1.x.
* Traces will now contain separate segments for async waits and callbacks.
* Updated instrumentation for MongoDB to support previously un-instrumented
  methods for 1.x and 2.x versions of the node-mongodb-native driver.
* Fixed a bug in the recording of transaction metrics. Previously this would
  cause a duplicate of the transaction metric to be displayed in the
  transaction breakdown chart


### v1.16.4 (2015-02-20):

* Fixed a bug in the logger to respect the configured log level in all cases.

### v1.16.3 (2015-02-20):

* Fixed a bug in hapi 8 view segments. Previously, the segments weren't being
  ended when the view ended.

* Added a configuration option to completely disable logging. `logger.enabled`
  defaults to true, if set to false it won't try to create the log file.

### v1.16.2 (2015-02-13):

* Enable http/https proxy features on all supported Node versions.

  Supported versions: Node.js 0.8, 0.10, 0.12 and io.js 1.x.

* Fixed a bug in vhost detection in Hapi 8. This bug would result in a crash for
  users of vhosts.

### v1.16.1 (2015-02-06):

* Now New Relic Synthetics transaction tracing is on by default.

  The previous release had the Synthetics transaction tracing feature turned off
  by default.

### v1.16.0 (2015-02-06):

* Added support for New Relic Synthetics transaction tracing.

  New Relic Synthetics monitors your site from around the world. When you use
  Synthetics to monitor your Node application, up to 20 detailed transaction
  traces will now be captured every minute when the application is probed from
  Synthetics. To learn more about this feature, visit our
  [documentation](https://docs.newrelic.com/docs/synthetics/new-relic-synthetics/using-monitors/collecting-synthetic-transaction-traces).

### v1.15.1 (2015-01-30):

* Preliminary Node.js 0.12 support.

  HTTP proxies are not supported on 0.12 yet. We don't recommend running the
  Agent on Node.js 0.11.15+ in production, but if you are testing on it, please
  let us know of any issues you encounter.

### v1.15.0 (2015-01-23):

* Added an API for recording custom Insights events. Read more about this in our
  [documentation](https://docs.newrelic.com/docs/agents/nodejs-agent/supported-features/nodejs-agent-api#custom-events-api)

### v1.14.7 (2015-01-16):

* Fixed a crash in express instrumentation in the handling of sub-routers.

* Fixed a crash in http outbound connections when CAT is enabled and another
  library has frozen the http request headers.

* Updated version checking to allow versions of the runtime >= 1.0.0. Thanks to
  [Mark Stosberg](https://github.com/markstos) for this patch!

### v1.14.6 (2015-01-09):

* The agent now logs the actual error when log file parsing fails. Thanks to
  [knownasilya](https://github.com/knownasilya) for this patch!

* Fixed a crash where if domains were enabled config serialization would fail
  due to circular objects.

### v1.14.5 (2014-12-30):

* Errors that occur in background transactions now have custom parameters copied
  onto them in the same manner as web transactions.

* Memcached instrumentation updated to account for additional arguments that
  might be passed to the command function that the agent wraps.

### v1.14.4 (2014-12-22):

* Custom web transactions can have their names changed by `nr.setTransactionName()`.
  Thanks to [Matt Lavin](https://github.com/mdlavin) for this patch!

* Fixed a bug where Express instrumentation could crash if transaction state was
  lost in a sub-router.

### v1.14.3 (2014-12-18):

* Improved the Express instrumentation to be more defensive before doing
  property lookups, fixing a crash that could happen in an exceptional state.

* Improved logging when the New Relic agent cannot connect to New Relic servers.

* Make Cross Application Tracer header injection less aggressive fixing
  interaction with other libraries such as riak-js.

### v1.14.2 (2014-12-11):

* Added support for Hapi v8.

* [briandela](https://github.com/briandela) contributed a fix for an crash that
  would occur when using hapi with vhosts.

### v1.14.1 (2014-12-05):

* Fixed a bug that caused some outbound http requests to show up in the
  New Relic UI as requests to `localhost` rather than the specified domain.

* The agent no longer reports errors from outbound http requests if they were
  handled by the user's application

### v1.14.0 (2014-11-25):

* The node agent now instruments connections to Oracle Databases using the
  `oracle` driver. This patch was contributed by
  [ryanwilliamquinn](https://github.com/ryanwilliamquinn)

* Fixed an issue that would break kraken apps when the node agent was enabled.
  This patch was contributed by [Lenny Markus](https://github.com/lmarkus)

### v1.13.4 (2014-11-20):

* Added support for the the aggregate method on mongodb collections. This patch
  was contributed by [taxilian](https://github.com/taxilian)

### v1.13.3 (2014-11-13):

* Fixed a bug in Cross Application Tracing where the agent would sometimes
  attempt to set a header after headers had already been sent.

* Replaced the logger with one that is handles file writes properly lowering
  overall resource usage.

  This is a small change with a large impact. `fs.createWriteStream` returns
  whether data was queued or not. If it is queued it is recommended to wait on a
  `drain` event but this isn't manditory. Most loggers we've found ignore this
  event which leads to many writes getting buffered and a rapid increase in
  native heap size as well as lowering the process's ability to respond to
  requests.

### v1.13.2 (2014-11-06):

* Updated support for hapi 7.2 and higher.

  Hapi refactored how the server is instantiated and caused the agent to not be
  able to get transaction names. This release accounts for the update and
  enables full instrumentation.

### v1.13.1 (2014-11-06):

* This release was unpublished as it got packaged incorrectly.

### v1.13.0 (2014-10-31):

* Added support for Custom Metrics

  Custom metrics provides a way to send additional metrics up to New Relic APM,
  which can be viewed with Custom Dashboards. We have two APIs for this,
  recordMetric(name, value) and incrementMetric(name[, value]). Read more about
  this in our docs:
  https://docs.newrelic.com/docs/agents/nodejs-agent/supported-features/nodejs-custom-metrics

* Fixed a bug in deeply nested transactions.

  Previously we allowed transactions to be nested to any depth. We've found in
  some cases this causes stack depth problems and are now limiting to 900
  segments per transaction. We will still collect metrics on all segments, but
  transaction traces will only show the first 900.

* Fixed a bug where custom tracers would show 0 time if the transaction ended n
  them.

  This may change the times you see for other types of tracers by a small
  amount. The change will reflect slightly more accurate timing.

### v1.12.2 (2014-10-23):

* Fixed a bug that would cause the application to crash on outbound connections
  when using node 0.8.

* Fixed a bug that could sometimes cause the application to crash while parsing
  MySQL queries.

### v1.12.1 (2014-10-16):

* Added support for Label Categories

  The agent now supports setting Labels for your application on a per instance
  level, using either an environment variable, or a config file setting.
  https://docs.newrelic.com/docs/apm/new-relic-apm/maintenance/categories-rollups-organizing-your-apps-servers

* Improved transaction names for express 4

  express 4 added the ability to mount apps and routers at specific urls.  The
  node agent would previously use only the portion of the route that was the
  last router or app matched as the transaction name.  Transaction names will
  now include the entire matched route.

* Added detection for uninstrumented instances of modules that should be instrumented

  The agent will now detect if an application has required a module before
  `require('newrelic')` .If this occurs, the agent will add a warning in the
  log file and display a warning banner in the UI.

* Added more logging to custom instrumentation APIs at `debug` level.

  The logging was improved for the benefit of people using the following
  APIs: `createTracer`, `createWebTransaction`, `createBackgroundTransaction`,
  and `endTransaction`. It will log when transactions are created and when
  transactions are ended. It will also log when it can't create a tracer due
  to there being no active transaction.

* Fixed a bug in QL instrumentation where the event emitter from
  `query`   could not chain `.on` calls. This patch was contributed by
  [sebastianhoitz](https://github.com/sebastianhoitz).

* Fixed a bug in `createBackgroundTransaction` where if the agent was disabled
  it didn't take a `group` argument. This patch was contributed by [nullvariable](https://github.com/nullvariable).

* Fixed a bug in our URL parsing where in Node v0.11.14 `url.parse` returns a
  differently shaped object than expected. This patch was contributed by
  [atomantic](https://github.com/atomantic)

  **Note**: Node v0.11.x is not officially supported, but Node v0.12 will be and
  this patch helps us get ready for that.

### v1.12.0 (2014-10-10):

* Added support for Cross Application Tracing

  The agent now supports Cross Application Tracing, which allows the New Relic
  APM UI to display traces that span multiple applications.
  https://docs.newrelic.com/docs/apm/traces/cross-application-traces/cross-application-traces

* Fixed a bug that would cause application to crash on request when using the
  kraken framework.

* Loosened the restrictions on the `app_name` setting. Application names may now
  include any Unicode characters.

### v1.11.5 (2014-10-06):

* Fixed a type error while checking the payload size to be sent to the New Relic
  servers.

  When this happened the agent would fail to send the payload to New Relic. This
  was more likely to occur in higher throughput applications.

### v1.11.4 (2014-10-03):

* Fixed a bug where mutibyte characters would cause an error when sending data
  to the New Relic servers.

### v1.11.3 (2014-09-26):

* Updated hapi instrumentation to support the recently released v6.9.

* Fixed a bug where an invalid package.json could cause the agent to crash while
  it recursed through `node_modules` gathering version details.

* Properly name `other` SQL queries.

  Previously when the agent failed to parse SQL it would create a metric stating
  the database type, query type, and query table were all unknown. This has been
  changed to keep track of database type and create an appropriate `other`
  operation metric like other agents.

### v1.11.2 (2014-09-19):

* Custom Instrumentation functions now pass through the return value of their
  passed in callback.

* Multiple improvements to PostgreSQL instrumentation

  When no callback was detected in the query functions, we were inserting our
  own. The insertion itself caused a crash. Adding a callback also modified the
  behavior of the pg module. Instead, we now listen for `error` or `end` events
  to finish segments.

  We now generate metrics for statement type/table combinations. Look for these
  in the database tab your APM Account!

### v1.11.1 (2014-09-11):

* Improved MongoDB find instrumentation.

  The `mongo` driver provides many different ways to invoke its API and find
  documents. In previous releases, some API invocations would create transaction
  trace segments that would not end properly, leading to inaccurately large
  segment times. This release now covers all the ways to find and iterate
  through documents, ensuring segment times are accurate.

### v1.11.0 (2014-09-05):

* We now support PostgreSQL via the `pg` driver.

  The Node.js agent now records the amount of time spent in transactions with
  PostgreSQL databases. This timing can be viewed in the Transactions dashboard
  within individual transactions and their traces.

  The agent supports all of the following `pg` usage scenarios:
    * Using the pure javascript API exposed directly from `pg`
    * Using the "native" API exposed from `pg.native`
    * Using the "native" API exposed directly from `pg` when the
      `NODE_PG_FORCE_NATIVE` environment variable is set
    * Using the pure javascript API from the `pg.js` module

### v1.10.3 (2014-08-28):

* Removed a preemptive DNS lookup of the New Relic servers that could cause
  errors when behind a proxy.

### v1.10.2 (2014-08-25):

* Fix to prevent proxy credentials transmission

  This update prevents proxy credentials set in the agent config file from
  being transmitted to New Relic.

### v1.10.1 (2014-08-22):

* MySQL Pooling Support

  Better support for mysql pooling, including connections that use
  `createPoolCluster` and `createPool`. Previously connections obtained through
  a pool could potentially be uninstrumented.

### v1.10.0 (2014-08-15):

* Custom instrumentation

  The agent now supports the ability to annotate application code to provide
  customized instrumentation. This includes the ability to time both web and
  background transactions, and add tracers to measure activity within
  transactions like querying a database. Documentation available at
  https://docs.newrelic.com/docs/agents/nodejs-agent/supported-features/nodejs-custom-instrumentation

### v1.9.2 (2014-08-08):

* Fixed a bug in the express instrumentation where if you named an error handler
  function `handle` it would cause a recursion depth error.

### v1.9.1 (2014-07-30):

* Added a check for invalid characters in the `app_name` setting.

  The agent will now emit a warning and disable itself if any application name
  is invalid. Allowed characters are alphanumerics and certain punctuation
  characters ([](){}.?!')

* Router queue time now properly handles floating point values.

* Fixed a bug where a socket connection could throw a synchronous error and
  cause the application to crash.


### v1.9.0 (2014-07-24):

* We now support Cassandra via the `node-cassandra-cql` driver.

  New database instrumentation means that we can present you with the timing
  data for how long those queries take. Thanks to Aaron Silvas from GoDaddy for
  the initial implementation of the Cassandra instrumentation.

* Router queue time now supports `t=<number>` in the X-REQUEST-START and
  X-QUEUE-START headers.


### v1.8.1 (2014-07-18):

* Agent now tracks metrics for router queue time.
  In addition to X-REQUEST-START, the agent now supports X-QUEUE-START header times.
  This metric will show up as "Request Queueing" in the Overview tab.

### v1.8.0 (2014-07-11):

* General release of proxy support for the agent to connect to New Relic.
  * HTTP/HTTPS support from the `newrelic` module to the proxy
  * HTTP/HTTPS support from the `newrelic` module to New Relic.
  * Basic proxy authentication.
  * Allow custom certificates during TLS negotiation.
  * For more information, read our docs [here](https://docs.newrelic.com/docs/nodejs/customizing-your-nodejs-config-file#proxy)
* Fix for enabling High Security Mode via an environment variable
* Optimization to allow early garbage collection of TLS slab buffers.

### v1.7.5 (2014-07-02):

* Plain `http` routes (i.e. routes outside of a framework) now apply config
  naming rules early. See [rules for naming and ignoring requests](https://github.com/newrelic/node-newrelic#rules-for-naming-and-ignoring-requests).

  This fixes a bug where generating the *Browser Timing Header* would not work
  without a framework (i.e. express, restify, hapi).

* *Beta* support for connecting to newrelic via ssl through a proxy.
  See [issue 128](https://github.com/newrelic/node-newrelic/issues/128) for details.

### v1.7.4 (2014-06-26):

* The agent now reports the value of the `NODE_ENV` environment variable
  to New Relic.

### v1.7.3 (2014-06-20):

* Support for instrumenting a standalone express 4 router.
  See [issue 154](https://github.com/newrelic/node-newrelic/pull/154).
* Set the default log level to `info`.

### v1.7.2 (2014-06-13):

* Captured parameters for express, restify, and hapi have been normalized.

  When `capture_params` is enabled the agent will collect route and query
  parameters. Previously express and restify only captured route params, and
  hapi only captured query params. This normalizes the behavior across the
  frameworks.

* Fixed an issue with restify instrumentation that caused the agent to always
  collect route parameters.

  Users of restify who want to continue capturing route (and now query)
  parameters are advised to enable `capture_params`.

* Fixed an issue where circular configs caused the agent to crash.

### v1.7.1 (2014-06-05):

* Fixed an issue where collected errors did not include captured and custom
  parameters.

* Added the environment variable `NEW_RELIC_HIGH_SECURITY`. This correlates to
  the `high_security` setting in your `newrelic.js` for High Security Mode.


### v1.7.0 (2014-05-29):
* Client side setting of `high_security` is now supported.

  High Security Mode is a feature to prevent any sensitive data from being sent
  to New Relic. The local setting for the agent must match the server setting in
  the New Relic APM UI. If there is a mismatch, the agent will log a message and
  act as if it is disabled. A link to the docs for High Security Mode can be
  found [here](https://docs.newrelic.com/docs/subscriptions/security#high-security)

  Attributes of high security mode (when enabled):
    * requires ssl
    * does not allow capturing of parameters,
    * does not allow custom parameters

  The default setting for High Security Mode is ‘false’.

  Note: If you currently have high security mode enabled within the New Relic
  APM UI, you have to add `high_security: true` to your local newrelic.js.

* Fixed a bug in our instrumentation of restify, where if you were using the
  restify client with express as a web server, req.query would be overridden.

### v1.6.0 (2014-05-22):

* New Relic Insights support no longer requires a feature flag. If you are a
  paying customer, you'll begin to see data show up in Insights as soon as you
  upgrade to 1.6.0. The agent will send event data for every transaction up to
  10,000 per minute. After that events are statistically sampled. Event data
  includes transaction timing, transaction name, and any custom parameters. You
  can read what is sent in more detail
  [here](http://docs.newrelic.com/docs/insights/basic-attributes#transaction-defaults).

  You can read more about Insights [here](http://newrelic.com/insights).
  Documentation for configuring this feature can be found
  [here](https://docs.newrelic.com/docs/nodejs/customizing-your-nodejs-config-file#tx_events).

### v1.5.5 (2014-05-15):

* Fix a bug where if the user disabled the error collector, error count would
  be carried over harvest cycles instead of reset. This would result in an ever
  increasing error count until the app was restarted.

* New Relic Insights beta support. This is a feature for our paying customers.
  The support of Insights in the agent is beta, this means we don't recommend
  turning the feature on in production, but instead trying it out in development
  and staging environments.

  To enable Insights support add the following to your `newrelic.js`:

  ```
  feature_flag : {
    insights: true
  }
  ```

### v1.5.4 (2014-05-08):

* On connect, the full `newrelic` module configuration is pushed to
  New Relic APM. Full config will be visible under the
  *Agent initialization* tab, under the *Settings* button in
  the APM application page.

  The reported settings will reflect the *running* agent config,
  which may differ from the `newrelic.js` file depending on server-side,
  and environmental configuration.

### v1.5.3 (2014-05-01):

* Express 4 support.

  Closes [#132](https://github.com/newrelic/node-newrelic/issues/132).
  Express 4 apps now have their transactions named correctly.
  Errors in the middleware chain are properly recorded.

### v1.5.2 (2014-04-24):

* Fix [issue #118](https://github.com/newrelic/node-newrelic/issues/118)
  where dangling symbolic links in the `node_modules` folder
  would crash the environment scraper.

### v1.5.1 (2014-04-18):

* Upgrade continuation-local-storage dependency to 3.0.0.
  The `newrelic` node module uses `cls` to help join asynchronous transaction
  segments. The latest `cls` module includes a fix that prevents contexts from
  leaking across transactions.

### v1.5.0 (2014-04-11):

* Add high-security compliance for accounts with enterprise security enabled.
  By default, the agent now works with high-security accounts,
  whereas previously agents would receive an `Access Violation`.
* Add a `.addCustomParameter(name, value)` api call for adding custom parameters
  to transaction traces, and extend the `.noticeError(error, customParameters)`
  for adding additional parameters to error traces.
* Documentation fix in the `README.md` for ignoring `socket.io` routes.
* Better support for disabling browser timing headers server side. Previously
  the agent would not pick up the server change until restart. The agent will
  now disable browser timing headers as soon as the next harvest cycle.
* Fix a `socket hangup error` that was causing some agents to fail to
  handshake with the New Relic servers.

### v1.4.0 (2014-03-14):

* Browser monitoring! Real User Monitoring! Which is also known as RUM!
  Whatever it's called, it allows you to see how long your pages take to load,
  not just on the server side, but in the browser! Wow! It's super cool! We
  know a lot of you have been waiting for this, and it's here! It's manually
  set up with an API call! Check the README for details!
* By default, all communication between New Relic for Node and New Relic's
  servers is now protected with crisp, clean TLS encryption. To minimize the
  CPU overhead of running connections over SSL (and it can be configured, see
  the README and the online documentation for details on how to return to plain
  HTTP), New Relic for Node is now using a keep-alive connection that will
  properly pipeline connections, for both HTTP and HTTPS.
* Improved the timings for a large class of MongoDB / Mongoose use cases. If
  you've encountered the issue where MongoDB trace segments last for an
  absurdly long duration, this should help.

### v1.3.2 (2014-02-12):

* Includes a nearly total rewrite of the connection layer that the module uses
  to communicate with New Relic's servers:
    * More useful logs! All of the logging has been reviewed closely to
      maximize its value and usefulness at pretty much every level. In
      practice, this means that the messages logged at 'info' and higher should
      only be for things that are relevant to you as a customer, and at 'debug'
      and 'trace' should be much more useful for us when we help you isolate
      issues with New Relic in your applications.
    * See data faster! As part of the connection handshake with New Relic, the
      module will now send any performance metrics gathered during the startup
      cycle immediately, instead of waiting a minute for the first full harvest
      cycle.
    * Get data to New Relic more reliably! When the module has issues
      connecting to New Relic, it's more consistent and resilient about holding
      your performance data for later delivery.
    * Use less bandwidth! Performance data delivery to New Relic is now
      sequential instead of simultaneous.  This means that the bandwidth used
      by New Relic will be less bursty, especially on hosts running many
      instrumented applications (or cluster workers).
    * Better implementation! There were a number of architectural problems with
      the old version of the connection layer, which (among other things) made
      it difficult to test.  The new version is simpler, has a much cleaner
      API, and has many, many more tests.

### v1.3.1 (2014-01-31):

* Ignored status codes are now always casted to numbers so that people using
  environment-variable configuration or strings in config still get error
  status ignored properly.
* If you disabled server-side configuration, the server was still able to
  set the value of apdex_t for your app. This was an oversight, and has
  been corrected.
* Before, if you had request renaming rules, if the end result was the same
  as the match pattern (mapping `/path` to `/path`), they would be silently
  ignored. This has been fixed.
* MySQL instrumentation handles callback more consistently, so the transaction
  tracer doesn't get confused and stop tracking transactions with MySQL calls
  in it.

### v1.3.0 (2014-01-17):

* Support for Spumko's Hapi! This support works with both Hapi 1.x and 2.0.0,
  and like our Express and Restify instrumentation will automatically name
  transactions after Hapi paths (get it) and time how long it takes to render
  views.
* Before, transaction naming and ignoring rules didn't work with Express and
  Restify routes. This has been addressed and the documentation has been
  clarified. Much gratitude to everyone who helped us figure out how to get
  this right, and for dealing with the previous, unclear documentation.
* Parameters in the ignored params list weren't being ignored in all cases.
* A very annoyingly chatty log message had its priority level dropped several
  levels.

### v1.2.0 (2013-12-07):

* Before, there were certain circumstances under which an application
  would crash without New Relic installed, but wouldn't crash with it.
  This has been fixed, and applications with New Relic installed now
  crash consistently. The error tracer is now also considerably simpler.
* Added a security policy. See the new section in README.md or read
  SECURITY.md.
* Future-proofed the MongoDB instrumentation and prevented the module from
  breaking GridFS.
* Made a small tweak that should reduce the amount of blocking file I/O done by
  the module.
* The module's instrumentation and harvest cycle will now not hold the process
  open in Node 0.9+. This should make it easier for processes to shut
  themselves down cleanly with New Relic running.
* The environment information gatherer will no longer crash if it tries to read
  a directory where it's expecting a file.
* Errors thrown during the execution of Express routes or Connect middlewares
  that were attached to requests that ended in HTTP status codes configured to
  be ignored by default will now be ignored correctly.
* Made the module play nicer with Node's REPL. It no longer assumes that an
  application necessarily has a main module.
* A few tweaks were made to support the CoolBeans dependency injection
  framework.
* Several log messages were demoted to a less chatty level.

### v1.1.1 (2013-11-08):

* Added the infrastructure necessary to support key transactions and New
  Relic's new alerting policies.
* The agent no longer renames transactions for requests that end in error to
  the gnomic and unhelpful '400/\*' (or whatever the final HTTP status code
  ends up being). This should make the traced errors tab considerably more
  useful.
* Improved instrumentation for legacy `http.createClient` and `http.Client`
  client methods. A few modules still use these legacy API calls, and the old
  instrumentation was just plain wrong.
* Changed how the error tracer deals with certain kinds of errors to deal with
  differences between Node versions 0.8 and 0.10. It should now convert throws
  into fatal errors less frequently.
* Removed useless fs.readDir instrumentation, which generated a lot of metrics
  but which New Relic was unable to display in any useful form. Maybe it will
  come back someday in a more useful incarnation.

### v1.1.0 (2013-11-05):

* Added a new call to the API, `.noticeError`. See the docs for details, but
  unlike the other calls on the API, you can use this to pass off errors
  anywhere in your app, not just from within web requests.
* Ignoring slow (or polling) requests was only being applied to slow
  transaction traces. It now applies to metrics and transactions that end in
  errors.
* MongoDB, Redis and Memcached now honor the `capture_params` and
  `ignore_params` settings.
* New Relic for Node.js, like New Relic's other agents, has a sophisticated
  system for repeatedly trying to connect to New Relic's servers when the first
  attempt results in failure. This had been broken since (roughly) January. It
  works again now.
* The built-in debugging for the transaction tracer was out of date with
  respect to the production tracer. This is fixed, and you're welcome to
  satisfy your curiosity by enabling it, but it's really not going to be useful
  to you unless you feel like taking the time to understand what the tracer is
  doing at a low level. Do not ever enable it in production, as it slaughters
  the tracer's performance and generates a huge pile of objects per
  transaction.

### v1.0.1 (2013-10-30):

* Added a new setIgnoreTransaction call to the exported API to allow explicit
  control over whether transactions should be ignored or not. Mark those
  polling routes to be ignored! Pull your crazy custom favicon.ico renderer out
  of the ignore list!
* The module will no longer pollute MongoDB queries with New Relic-only
  parameters. Thanks to Alon Salant for identifying this issue, and all
  apologies to him for the trouble it caused him.
* The instrumentation for MongoDB, memcached, Redis, and Express will now
  honor the setting of the `capture_params` configuration flag. Before the
  module always captured query parameters.
* Fixed a problem that would cause New Relic for Node to fail on versions of
  Node between 0.8.0 and 0.8.3.
* Upgraded to the newest version of `continuation-local-storage`, which has
  many fixes for dealing with monkeypatched EventEmitters.

### v1.0.0 (2013-10-24):

* General release. No code changes from v0.12.1.

### v0.12.1 / beta-38 (2013-10-17):

* The transaction namer wasn't respecting error_collector.ignore_error_codes.
  We've unified the code paths there so that this no longer happens, so that
  if the status code of a request is in the list of codes to be ignored, it's
  no longer rolled up under that status code and gets its normal name.

### v0.12.0 / beta-37 (2013-10-16):

* Changed how MongoDB, MySQL, memcached, and Redis metrics are reported to New
  Relic. This is part of a larger effort to make the Monitoring > Database tab
  of the New Relic UI more useful for Node developers. There will be a brief
  period where your dashboards will have both the old and new metrics, which
  could lead to some temporary duplication or metric names. These "duplicates"
  will gradually stop showing up as the reporting windows containing the old
  metric names expire. Be sure to let us know if you have strong feelings one
  way or another about this change, as it's a work in progress.
* Updated the module's dependencies to fix another subtle bug in how
  error-handling works in Node 0.8.x. This should resolve the errors some users
  were seeing.

### v0.11.9 / beta-36 (2013-10-12):

* Fixed a crash in the tracer that could turn a recoverable application error
  into an unrecoverable process crash. Mea culpa, our apologies for the
  inconvenience if you ran into this. In our defence, the errors we're running
  into are getting ever more exotic as we get most of the common stuff nailed
  down.
* Added the ability to use the preconfigured Azure Web Server name as the
  application name for a Node app. Thanks to New Relic .NET engineer Nick Floyd
  for the suggestion.

### v0.11.8 / beta-35 (2013-10-11):

* Added a license entry to package.json.
* Due to an npm bug, the module package got huge. This one is much smaller.

### v0.11.7 / beta-34 (2013-10-11):

* The last build of the agent had a flaw in how it dealt with outbound requests
  that made it way too stringent about dealing with default ports. It is now
  more sane about defaults.
* The behavior of configuration precedence is slightly different now.
  Previously, if there were list values set in the defaults, configuration
  file, environment variables, or server-side configuration, they would be
  concatenated instead of being overwritten.  This made it impossible to
  override some of the defaults (most notably, it was impossible to not ignore
  HTTP status code 404 in the error tracer), so now the configuration file will
  overwrite the defaults, and environment variables will overwrite the
  configuration file.  Values sent by New Relic will still be concatenated
  instead of overwriting, though (again, this only affects configuration
  variables with list values). Thanks to GitHub user grovr for identifying
  the problem!
* The error tracer will collect errors off transactions after the first harvest
  cycle (thanks to GitHub user grovr for identifying this issue).
* `cluster` users will no longer see occasional crashes due to New Relic's
  instrumentation.
* Fixed a few minor documentation errors that made it tough to use the
  suggested ignoring rules for socket.io transactions.

### v0.11.6 / beta-33 (2013-10-08):

* Changed the module to not load the instrumentation *at all* if the agent is
  disabled via configuration. This will keep the module from leaking any
  resources when it's disabled.
* The agent used to include query parameters in the name for outbound requests,
  making for unwieldy-looking trace segments.  Those parameters are now
  stripped off, and if `capture_params` (and `ignored_params`) are enabled,
  parameters will be captured for (nicely-formatted) display.
* Added a stubbed API so that when the agent is disabled, calls to the New
  Relic API will not throw. Add naming calls to your code with impunity!
* The module now looks in many more places for `newrelic.js` before complaining
  that it can't be found. In order, it looks in the current working directory,
  the directory of the Node process's main module (normally whatever file you
  pass to node on the command line), the directory pointed to by the
  environment variable `NEW_RELIC_HOME`, the current process's `$HOME`, and the
  directory above the node_modules directory where `newrelic` is installed.

### v0.11.5 / beta-32 (2013-10-03):

* Fixed a major issue in the transaction tracer that affected users of certain
  Express middleware plugins. HUGE thanks to Nicolas Laplante for his
  assistance in isolating and reproducing the bug, and also to the denizens of
  #libuv for eyeballing my various unsuccessful attempts at a fix.
* Fixed another issue in the tracer where certain objects were being wrapped
  too many times. Thanks to José F. Romaniello for confirming the fix.
* Changed how requests handled by Express and Restify routes are named. This
  change is being rolled out both in this module and on the New Relic website,
  so there is a chance you will see the same route (or very similar routes)
  show up twice in aggregated metrics.
* Dropped the default apdex tolerating value from 500 milliseconds to 100
  milliseconds. This means that transactions slower than 400 milliseconds will
  generate slow transaction traces. Read the documentation in README.md on
  `apdex_t` and `apdex_f` for further details.

### v0.11.4 / beta-31 (2013-10-01):

* Fixed an error in the Connect and Express middleware instrumentation. Another
  tip of the hat to Jeff Howell at Kabam for identifying this problem and
  pointing to a solution!

### v0.11.3 / beta-30 (2013-10-01):

* Rewrote the MongoDB instrumentation. Big thanks to Jeff Howell at Kabam for
  demonstrating a much more reliable and simple approach than what we had
  before! Also expanded the number of MongoDB methods instrumented to include
  more of the common operations and indexing operations.
* Changed the default value of the `top_n` configuration parameter. Read the
  documentation in `lib/config.default.js` for the details (we've taken another
  run at making the docs for `top_n` easier to understand), but the upshot is
  that by default you should see a greater diversity of slow transaction traces
  now.
* Closed a hole in the transaction tracer related to Connect and Express-style
  middleware chains.
* Fixed issues identified by testing against various versions of 0.11 and
  master.
* Added guidelines for contributing to the module. Read CONTRIBUTING.md
  for details.

### v0.11.2 / beta-29 (2013-09-25):

* Fixed a bug with the Connect instrumentation that would cause it to
  crash when using Connect's static middleware in strict mode. Using
  ES5 future reserved keywords for function names is a bad idea, and
  this is why, but static's name is highly unlikely to change. For
  those of you who are examining the state of your middleware stack after
  configuring it, you probably shouldn't be doing that, but if you run into
  problems with the New Relic agent installed, try changing your test to use
  `name.indexOf('whatever') === 0` as the predicate instead of
  `name === 'whatever'`.

### v0.11.1 / beta-28 (2013-09-24):

* Prevent requests from being double-counted by changing the tracer to
  always reuse existing transactions rather than trying to nest them.
* Changed the Connect instrumentation to preserve the names of middleware
  functions after wrapping them. If you need this change, you should
  probably change your code so you don't need it anymore.
* Added a bunch of server-side configuration options that are known but
  unsupported to the agent.

### v0.11.0 / beta-27 (2013-09-20):

* IMPORTANT. There have been MAJOR CHANGES in how requests are named for
  display and aggregation in the New Relic user interface. Read the section in
  the README on transactions and request naming for details. For good measure,
  read it twice. If your requests are all still ending up named `/*`, read
  it a third time. This is **especially** true if you're not using Express
  or Restify, in which case you will almost certainly want to make changes
  in how you configure New Relic.
* IMPORTANT. New Relic for Node.js now supports the full range of server-side
  configuration options offered by the New Relic web interface. By default,
  server-side settings will override the settings in your configuration file
  (or environment variables). You can disable server-side configuration by
  setting `ignore_server_configuration` to `true` in your configuration file
  (or setting `NEW_RELIC_IGNORE_SERVER_CONFIGURATION` to 'true').
* BREAKING CHANGE: The New Relic module now exports an API to be used for
  naming transactions and for adding URL to transaction name mapping rules. If
  you were using `require('newrelic')` as an interface to the agent's
  configuration or its internals, you'll need to fix your code (also you
  probably shouldn't have been doing that).
* BREAKING CHANGE: The configuration parameter
  `transaction_tracer.trace_threshold` has been renamed
  `transaction_tracer.transaction_threshold` to make it consistent with New
  Relic's other agents.
* Applications using the Express or Restify routers will now have their
  requests named after the matching routes. These names can be overridden
  but the transaction-naming API.
* There are new configuration parameters for adding rules for naming or
  ignoring requests. The README has a good example for how to keep socket.io
  from blowing out your average response time. You should read it!
* Tweaked the calculation of exclusive time in transaction traces, which
  should make more of the transaction trace detail pages make sense.

### v0.10.3 / beta-26 (2013-08-25):

* Fixed a regression in `beta-25` that caused the agent to incorrectly
  calculate an important timestamp, thus leading to data not showing up
  in New Relic.
* Improved in-memory aggregation (when the connection between the agent
  and New Relic is unavailable or failing).

### v0.10.2 / beta-25 (2013-08-23):

* Fixed a serious error in how the agent handles communication errors
  when sending errors to New Relic. If you're running v0.10.0 or v0.10.1,
  upgrade sooner rather than later, as those versions are losing data.
* Substantially improved the quality of reporting on errors noticed by the
  Node agent. Stack traces, scopes, and messages should be much better.

### v0.10.1 / beta-24 (2013-08-19):

* The instrumentation for `http` no longer assumes that the hostname for
  external requests will be named `host` (`hostname` is also allowed, and
  `http.request()` defaults to `localhost`).
* The Node agent and New Relic's servers disagreed about what many metrics
  should be called. The agent was wrong and it regrets the error.
* Minor tweaks to database instrumentation (MongoDB and MySQL) that could have
  a small but visible impact on the overview display.

### v0.10.0 / beta-23 (2013-08-17):

* IMPORTANT. The transaction tracer in this build is COMPLETELY NEW. This means
  that the agent will probably work just fine under Node 0.8 and newer, but
  Node versions 0.6 and older are presently unsupported, and support for them
  may or may not come back. However, the quality of the metrics gathered by the
  agent is now vastly improved.
* There are over 100 commits included in this build. Every effort has been made
  to ensure that we will not crash your applications, but be aware there may be
  regressions.
* Substantially more information is displayed by New Relic for slow transaction
  traces. How this information is displayed is a work in progress, as New Relic
  works to create a consistent user experience for developers writing both
  synchronous and asynchronous applications.
* Most Redis and memcached operations will now provide details on which keys
  were involved in an operation.
* The error tracer has been given a new coat of paint as well, and takes better
  advantage of Node domains, when they're available. Fewer errors should be
  double-counted, as well.
* MongoDB instrumentation is substantially improved.
* Express instrumentation now deals with the removal of the (very helpful)
  version field from recent versions of Express.
* Exclusive durations are reported for metrics, improving transaction
  breakdowns.
* Several bugs in the communication between the New Relic agent and New Relic's
  servers have been fixed.
* Failed connection attempts between the agent and New Relic's servers no longer
  cause aggregated metrics to be lost, nor will this trigger an agent crash.

### v0.9.22 / beta-22 (2013-06-11):

* Capture request URL before Express can mess with it.

### v0.9.21 / beta-21 (2013-06-04):

* Don't try to connect without a license key.
* Clear out previous connection listeners on failed connection attempts.
* Don't crash when normalizing paths without a leading slash.

### v0.9.20 / beta-20 (2013-03-28):

* The implementation of domains changed in Node 0.10.x, which necessitated
  a fair amount of work on the error tracer to preserve the existing
  error tracer behavior.
* The error tracer no longer improperly swallows thrown errors.
* The agent no longer assumes that a home directory is set.
* The agent now works correctly with the `should` assertion helper
  library.

### v0.9.19 / beta-19 (2013-03-04):

* HTTPS instrumentation is both more complete and far better tested.
* Restify servers using HTTPS listeners should now be properly
  instrumented.

### v0.9.18-137 / beta-18 (2013-01-30):

* `;` is now treated as a query separator in URLs, just like `?`.
* When using `stdout` or `stderr` for logging and not using a configuration
  file, logging will now work as expected.
* The error-handling code for DNS lookup of New Relic's servers was itself
  erroneous.  It should no longer crash instrumented apps when DNS lookup
  fails.
* Simplified agent startup process.

### v0.9.17-132 / beta-17 (2013-01-24):

* Using fs.readdir will no longer crash the agent and your apps. Oops!
* Added error-tracing middleware for Connect 1 & 2 applications, which includes
  Express 2 and 3 applications. This middleware is inserted automatically and
  transparently. Because it's common for end-user error handlers to not
  propagate errors (by calling next(error) from within the handler), the
  instrumentation inserts the middleware before the first error handler added
  to the middleware chain.
* The node-redis driver now correctly traces Redis calls made without a
  callback.
* Connections to New Relic that partially succeeded will now correctly keep
  attempting to connect until the connection succeeds or the number of retries
  is exhausted.
* Added a handler for yet another kind of New Relic server error
  (RuntimeError).

### v0.9.16-121 / beta-16 (2013-01-16):

* For some of the modules instrumented by the agent (fs, http, Express 2
  and 3), the error tracer now adds error tracing to wrapped function calls.
  This means that more of the functions in those modules will send traced
  errors to New Relic, even if they're trapping errors themselves. Also
  improves error tracer in versions of Node without domains. The error
  tracer rethrows all caught errors, so as to not alter behavior of
  instrumented apps.
* The error count sent by the agent was frequently incorrect due to an
  off-by-one bug.
* Include the entire stacktrace in traced errors.
* When the agent fails to successfully connect to New Relic's servers, it
  will try 6 more times, progressively waiting longer between each failed
  attempt. If no connection can be made, the agent will shut itself down.
* The agent no longer crashes instrumented applications when DNS resolution
  fails during the initial handshake with New Relic's servers. It logs the
  failures instead and retries later.
* The agent no longer alters the behavior of the generic-pool module in a
  way that causes modules using it to break (including node-postgres).
* In some cases, the domains-based error tracer was not working correctly.
* The agent logs significantly more useful debugging information.

### v0.9.15-107 / beta-15 (2013-01-14):

* The agent's built-in compression for sending large payloads to New Relic
	wasn't correctly handling the Buffer returned by zlib, leading to a crash.

### v0.9.14-105 / beta-14 (2013-01-07):

* In some cases, the monkeypatching used by the instrumentation wasn't
  written sufficiently defensively, leading to applications crashing at
  startup when using the agent.
* Changed how packages and dependencies are serialized when sent to New
  Relic's servers.

### v0.9.13-101 / beta-13 (2013-01-07):

* When New Relic's servers (or an intermediate proxy) returned a response with
  a status code other than 20x, the entire instrumented application would
  crash.
* Some metric normalization rules were not being interpreted correctly, leading
  to malformed normalized metric names.
* Metric normalization rules that specified that matching metrics were to be
  ignored were not being enforced.

### v0.9.12-91 / beta-12 (2012-12-28):

* Fixed the agent's auto-restart support to cleanly shut down the
  connection (also fixed a bunch of bugs in restart).

### v0.9.11-88 / beta-11 (2012-12-20):

* When server-side configuration changes, the agent will now correctly
  restart when told to do so by New Relic's servers.
* Correctly wrap net.Server.prototype.listen -- wasn't returning the
  server object, which broke some apps.
* If you're on a SmartOS VM with a 64-bit base image and a 64-bit build of
  Node that's v0.8.5 or earlier, the agent will no longer cause Node to
  crash. Don't even ask.

### v0.9.10-85 / beta-10 (2012-12-13):

* Squared up the environment variable names with existing practice,
  especially with an eye towards conformity with Heroku documentation.
* Flushed out all configuration used anywhere in the agent and made sure
  it was documented in config.default.js.
* Using the new environment setting NEW_RELIC_NO_CONFIG_FILE, override the
  need to have a settings file at all.
* Add the ability to send log output to stdout or stderr.

### v0.9.9-82 / beta-09 (2012-12-12):

* Can now configure the agent via environment variables. See README.md for
  details.
* Can now configure the location of the agent log via either logging.filepath
  in the configuration file, or NR_LOGGING_FILEPATH in the app's environment.
* Turning off the error tracer via configuration now actually disables it.

### v0.9.7-75 / beta-08 (2012-12-06):

* Express view rendering was being instrumented improperly before, causing
  rendering to fail and Express to hang. Both Express 2 and 3 were affected,
  and both have been fixed.
* When NODE_PATH is set, resolve NODE_PATH elements properly so that package
  lookup for environmental information gathering doesn't crash the app.
* Now send the Node version along with the rest of the environment data.

### v0.9.6-70 / beta-07 (2012-11-30):

* Added first cut at support for error tracing via Node.js 0.8+ domains.
  Versions of Node.js that support it (v0.8.9 and above) will make a
  best-faith effort to clean up after errors.
* Improved non-domain error handling on outbound HTTP requests.
* Dramatically improved accuracy of HTTP request timing.

### v0.9.5-63 / beta-06 (2012-11-28):

* Be more careful in dealing with HTTP requests.

### v0.9.4-61 / beta-05 (2012-11-26):

* Further improvements to node-mongodb-native instrumentation.
* Package now available via npm as "newrelic".

### v0.9.3-57 / beta-04 (2012-11-06):

* Send a list of the packages and dependencies available to an app on
  connection to New Relic servers.
* Generally cleaned up submission of configuration information.
* Added trace-level logging of instrumentation to help diagnose issues
  with transaction tracing.
* Fixes to web error transaction reporting.

### v0.9.2-53 / beta-03 (2012-11-02):

* Added support for node-mysql 2.0.0a driver series.
* Added support for Express 3.
* Added rudimentary instrumentation for node-redis.
* Added rudimentary support for generic-pool (for use with MySQL).
* Fixed view instrumentation for Express.
* Improved coverage of MongoDB driver.
* Many small fixes to make logging more robust.
* Don't return a partially initialized agent -- shut agent down
  gracefully if startup fails.

### v0.9.1-46 / beta-02 (2012-10-01):

* Fixed an issue in how transaction traces were serialized that kept them from
  being displayed within RPM.
* Added request parameters to transaction traces, as well as URL normalization.
* Reconciled segment names in transaction traces with the corresponding
  metric names.
* Changed the logging module to bunyan. This means that logs are now stored
  as JSON. If you want pretty-printed logs, `npm install -g bunyan` and then
  use the bunyan CLI tool to format and filter the logs.
* The agent now sets the logging level to the configured level. Logs sent to
  New Relic should have been captured at the 'trace' level for the duration
  of the beta.
* Fixed metric -> ID renaming semantics.
* Verified that agent works with Node 0.8's cluster module.

### v0.9.0-39 / beta-01 (2012-09-28):

* Completely new transaction tracer. Faster, simpler and vastly more
  deterministic, but the reworking likely introduced a bunch of new bugs. This
  also means that the agent no longer directly affects the call stack or
  overrides any of the core event-handling methods, which means the overhead
  of the transaction tracer is vastly reduced. Which is good, because you
  still can't turn it off.
* Transaction traces should now report the correct caller-callee relationships.
* Transaction tracer is now internally instrumented, for better debugging.
* Added support for Restify.
* Using the Node.js agent in Restify app no longer causes them to crash
  (fixes NA-47).
* Improved support for Express (NA-8).
* Lots of fixes to the MongoDB, MySQL and memcached instrumentation.
* MongoDB instrumentation no longer crashes MongoDB apps that include
  the agent (NA-48).
* More testing in Node.js 0.6.x (hard to completely test, as node-tap isn't
  that friendly to Node < 0.6.21).

### v0.8.5-34 / alpha-06 (2012-09-24):

* Transaction trace durations are now reported properly (were seconds, now
  milliseconds).
* The agent no longer causes Restify applications to crash.
* The internal Node metrics sampler now shuts itself down properly.

### v0.8.4-30 / alpha-05 (2012-09-20):

* Improved timing of Express / Connect request handlers.

### v0.8.3-28 / alpha-04 (2012-09-19):

* Added support for internal supportability metrics (enabled via setting
  debug.internal_metrics to true in newrelic.js).

### v0.8.2-26 / alpha-03 (2012-09-14):

* By popular demand, support for Node 0.6.x. Tested against versions
  0.6.5 and 0.6.19.

### v0.8.1-25 / alpha-02 (2012-09-14):

* Transaction traces no longer crash the RPM transaction trace viewer.
* The Node.js agent now follows the rules for Top N slow trace gathering.
* Compress large requests before submitting them to the New Relic
  collector.
* trace_threshold can now be configured from the server, and is not
  hard coded to apdex_f.
* The agent definitely doesn't work (for now) in Node 0.6.x and earlier.
  The agent will now notify developers (on the console) that it's refusing
  to start up under old versions, but won't crash the app.
* Don't crash the instrumented app if config is missing.

### v0.8.0-21 / alpha-01 (2012-09-11);

* The agent faithfully records and reports basic metrics.
* The agent reports error metrics.
* The agent gathers basic slow transaction trace data.
* The agent reports transaction trace data.

[mdn-async-function]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function
