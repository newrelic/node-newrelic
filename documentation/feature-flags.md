# Node Agent Feature Flags

As New Relic develops new instrumentation features, we may release some of them under feature flags--disabling them unless the agent is started with an optional flag to enable them. We do this to avoid side-effects on instrumented code when these still-experimental features are in development.  

Within the agent, feature flags are exposed as properties of the `featureFlags` object, with flagged features defined as properties of the `featureFlags.prerelease` dictionary, and released features defined as elements of the `featureFlags.released` array. 

Any prerelease flags can be enabled or disabled in your agent config by adding a `feature_flags` property. For example, if a hypothetical `example_new_instrumentation` behavior was behind a feature flag, adding `{ feature_flag: { example_new_instrumentation: true } }` to your `newrelic.js` would enable it.

## Current prerelease feature flags

#### express5 
Enabled by default: `false`

Experimental instrumentation of Express.js 5. Enable by setting `{feature_flag: { express5: true }}` in your agent config, or pass in the env var of `NEW_RELIC_FEATURE_FLAG_EXPRESS5=true` when starting application with agent.

#### promise_segments
Enabled by default: `false`

Shows the execution order of chained promises in Transaction Traces.  Enable by setting `{ feature_flag: {promise_segments: true }}` in the agent config.

#### reverse_naming_rules
Enabled by default: `false`

Naming rules are in forward order by default. If your application requires reversed naming rules, you can enable this by setting `{ feature_flag: { reverse_naming_rules: true }}` in agent config. 

#### undici_instrumentation
Enabled by default: `false`

Enable experimental instrumentation for the [undici](https://github.com/nodejs/undici) http client by setting `{feature_flag: { undici_instrumentation: true }}` in agent config.

Note that support for undici client is Node.js 16.x minimum, and requires at minimum [v4.7.0+](https://github.com/nodejs/undici/releases/tag/v4.7.0) of the undici client.

#### undici_async_tracking
Enabled by default: `true`

If you have multiple undici requests being made in parallel, you may find some state issues if requests to an app are made with keep-alive. If so, adding `{ feature_flag: { undici_async_tracking: false }}` to your agent config will avoid these state issues, though at the cost of some broken segment nesting.

#### unresolved_promise_cleanup
Enabled by default: `true`

Now that `new_promise_tracking` is the default async context tracking behavior in the agent, `unresolved_promise_cleanup` is enabled by default. Disabling it can help with performance of agent when an application creates many promises. To disable, set `{ feature_flag: { unresolved_promise_cleanup: false }}` in your agent config, or pass in the env var of `NEW_RELIC_FEATURE_FLAG_UNRESOLVED_PROMISE_CLEANUP=false` when starting your application with the NR agent.

**WARNING**: If you set `unresolved_promise_cleanup` to `false`, failure to resolve all promises in your application will result in memory leaks even if those promises are garbage collected.

#### async_local_context
Enabled by default: `false`

Async context tracking using AsyncLocalStorage can be enabled by adding `{ feature_flag: { async_local_context: true }}` to your agent config. 



