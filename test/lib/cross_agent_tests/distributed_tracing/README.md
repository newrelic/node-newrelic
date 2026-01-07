### Trace Context test details

The Trace Context test cases in `trace_context.json` are meant to be used to verify the
creation and forwarding of W3C Trace Context headers within the agent and the attributes
and metrics that get created during that process.

Each test case should correspond to a simulated inbound header or creation of a header in
the agent under test. Here's what the various fields in each test case mean:

| Name | Meaning |
| ---- | ------- |
| `test_name` | A human-meaningful name for the test case. |
| `trusted_account_key` | The account ids the agent can trust. |
| `account_id` | The account id the agent would receive on connect. |
| `web_transaction` | Whether the transaction that's tested is a web transaction or not. |
| `raises_exception` | Whether to simulate an exception happening within the transaction or not, resulting in a transaction error event. |
| `distributed_tracing_enabled` | If `false`, then distributed tracing is disabled. If `true` or absent, then distributed tracing is enabled (default behavior). |
| `full_granularity_enabled` | If `false`, then full granularity tracing is disabled. If `true` or absent, then full granularity is enabled (default behavior). |
| `root` | The full granularity sampler to use for transactions at the root of a trace. |
| `remote_parent_sampled` | The full granularity sampler to use for transactions with a remote parent that was sampled. |
| `remote_parent_not_sampled` | The full granularity sampler to use for transactions with a remote parent that is not sampled. |
| `force_adaptive_sampled` | The sampling decision to force on a transaction whenever the adaptive sampler is used. This applies to all adaptive samplers used in the test, whether they are the global sampler or an individual sampler instance. |
| `full_granularity_ratio` | The ratio to use for all of the full granularity trace ID ratio samplers defined in the test. For testing purposes we are not defining different ratios for each trace ID ratio sampler instance. If that is necessary, we will need a different way to configure the ratios. |
| `partial_granularity_enabled` | If `true`, then partial granularity is enabled. If `false` or absent, then partial granularity is disabled (default behavior). |
| `partial_granularity_root` | The partial granularity sampler to use for root transactions. |
| `partial_granularity_remote_parent_sampled` | The partial granularity sampler to use for transactions with a remote parent that was sampled. |
| `partial_granularity_remote_parent_not_sampled` | The partial granularity sampler to use for transaction with a remote parent that was not sampled. |
| `partial_granularity_ratio` | The partial granularity ratio to use for all the partial granularity ratio samplers defined in the test. As with `full_granularity_ratio` we're limiting these tests to have one ratio configured for all partial granularity samplers.| 
| `expected_priority_between` | The inclusive range of the expected priority value on the generated transaction event. |
| `transport_type` | The transport type for the inbound request. |
| `inbound_headers` | The headers you should mock coming into the agent. |
| `outbound_payloads` | The exact/expected/unexpected values for outbound `w3c` headers. |
| `intrinsics` | The exact/expected/unexpected attributes for events. |
| `expected_metrics` | The expected metrics and associated counts as a result of the test. |
| `span_events_enabled` | Whether span events are enabled in the agent or not. |
| `transaction_events_enabled` | Whether transaction events are enabled in the agent or not. |

The samplers that can referenced in the `root`, `remote_parent_sampled`, and `remote_parent_not_sampled` fields are:

- `default`: Use the adaptive sampler.
- `adaptive`: Use the adaptive sampler.
- `trace_id_ratio_based`: Use the trace ID ratio sampler.
- `always_on`: Use the always on sampler.
- `always_off`: Use the always off sampler.

The `outbound_payloads` and `intrinsics` field can have nested values, for example:
```javascript
...
    "intrinsics": {
       "target_events": ["Transaction", "Span"],
       "common":{
         "exact": {
           "traceId": "da8bc8cc6d062849b0efcf3c169afb5a"
         },
         "expected": ["guid"],
         "unexpected": ["grandparentId"]
       },
       "Transaction": {
         "exact": {
           "parent.type": "App",
           "parent.app": "2827902",
           "parent.account": "33",
           "parent.transportType": "HTTP",
           "parentId": "e8b91a159289ff74",
           "parentSpanId": "7d3efb1b173fecfa"
         },
         "expected": ["parent.transportDuration"]
       },
       "Span": {
         "exact": {
           "parentId": "7d3efb1b173fecfa",
           "trustedParentId": "7d3efb1b173fecfa",
           "tracingVendors": ""
         },
         "expected": ["transactionId"],
         "unexpected": ["parent.transportDuration", "parent.type", "parent.app", "parent.account", "parent.transportType"]
       }
     },
    ...
```

`target_events` is paired with the `common` block. So anything in the common block should be checked for any event type in the
`target_events` list. So for instance, this test should check that both the Transaction and Span events
have a `guid`, both have `da8bc8cc6d062849b0efcf3c169afb5a` as the `traceId`, and both don't have a `grandparentId` attribute.
The `Transaction` block means anything in there should only apply to the transaction object. Same for the `Span` block.

The same idea goes for the `outbound_payloads` block but will apply specifically for the outbound `traceparent` header and `tracestate` header.

`outbound_payloads` may also target `newrelic` headers and follow same basic structure inline with trace context headers, for example:
```javascript
  ...
  "outbound_payloads": [
    {
      "exact": {
        "traceparent.version": "00",
        "traceparent.trace_id": "00000000000000006e2fea0b173fdad0",
        "traceparent.trace_flags": "01",
        "tracestate.tenant_id": "33",
        "tracestate.version": 0,
        "tracestate.parent_type": 0,
        "tracestate.parent_account_id": "33",
        "tracestate.sampled": true,
        "tracestate.priority": 1.123432,
        "newrelic.v": [0, 1],
        "newrelic.d.ty": "App",
        "newrelic.d.ac": "33",
        "newrelic.d.ap": "2827902",
        "newrelic.d.tr": "6E2fEA0B173FDAD0",
        "newrelic.d.sa": true,
        "newrelic.d.pr": 1.1234321
      },
      "expected": [
        "traceparent.parent_id",
        "tracestate.timestamp",
        "tracestate.parent_application_id",
        "tracestate.span_id",
        "tracestate.transaction_id",
        "newrelic.d.ap", 
        "newrelic.d.tx", 
        "newrelic.d.ti", 
        "newrelic.d.id"
      ],
      "unexpected": ["newrelic.d.tk"]
    }
  ],
  ...
```