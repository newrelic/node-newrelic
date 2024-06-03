# Node Agent Feature Flags

As New Relic develops new instrumentation features, we may release some of them under feature flags--disabling them unless the agent is started with an optional flag to enable them. We do this to avoid side-effects on instrumented code when these still-experimental features are in development.  

Within the agent, feature flags are exposed as properties of the `featureFlags` object, with flagged features defined as properties of the `featureFlags.prerelease` dictionary, and released features defined as elements of the `featureFlags.released` array. 

Any prerelease flags can be enabled or disabled in your agent config by adding a `feature_flags` property. For example, if a hypothetical `example_new_instrumentation` behavior was behind a feature flag, adding `{ feature_flag: { example_new_instrumentation: true } }` to your `newrelic.js` would enable it. Multiple feature flags can be enabled or disabled by adding them individually as properties of the `feature_flag` object.

## Current prerelease feature flags

#### promise_segments
* Enabled by default: `false`  
* Configuration: `{ feature_flag: { promise_segments: true|false }}`
* Environment Variable: `NEW_RELIC_FEATURE_FLAG_PROMISE_SEGMENTS`
* Description: Creates a segment for every handler in a Promise chain. This is used only by `when.js`. 

#### reverse_naming_rules
* Enabled by default: `false`
* Configuration: `{ feature_flag: { reverse_naming_rules: true|false }}`
* Environment Variable: `NEW_RELIC_FEATURE_FLAG_REVERSE_NAMING_RULES`
* Description: Naming rules are in forward order by default.  

#### undici_async_tracking
* Enabled by default: `true`
* Configuration: `{ feature_flag: { undici_async_tracking: true|false }}`
* Environment Variable: `NEW_RELIC_FEATURE_FLAG_UNDICI_ASYNC_TRACKING`
* Description: If you have multiple undici requests being made in parallel, you may find some state issues if requests to an app are made with keep-alive. If so, *disabling* this flag will avoid these state issues, though at the cost of some broken segment nesting.

#### unresolved_promise_cleanup
* Enabled by default: `true`
* Configuration: `{ feature_flag: { unresolved_promise_cleanup: true|false }}`
* Environment Variable: `NEW_RELIC_FEATURE_FLAG_UNRESOLVED_PROMISE_CLEANUP`
* Description: Now that `new_promise_tracking` is the default async context tracking behavior in the agent, `unresolved_promise_cleanup` is enabled by default. Disabling it can help with performance of agent when an application creates many promises. 
* **WARNING**: If you set `unresolved_promise_cleanup` to `false`, failure to resolve all promises in your application will result in memory leaks even if those promises are garbage collected.

#### legacy_context_manager
* Enabled by default: `false`
* Configuration: `{ feature_flag: { legacy_context_manager: true|false }}`
* Environment Variable: `NEW_RELIC_FEATURE_FLAG_LEGACY_CONTEXT_MANAGER`
* Description: The legacy context manager was replaced by AsyncLocalContextManager for async context propagation. If your application is not recording certain spans or creating orphaned data, you may want to enable this older context manager. Enabling this feature flag may increase the agent's use of memory and CPU.

#### kakfajs_instrumentation
* Enabled by default: `false`
* Configuration: `{ feature_flag: { kafkajs_instrumentation: true|false }}`
* Environment Variable: `NEW_RELIC_FEATURE_FLAG_KAFKAJS_INSTRUMENTATION`
* Description: Enables instrumentation of `kafkajs`. 
