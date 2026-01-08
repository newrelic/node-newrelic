# Samplers

With the introduction of Otel-style sampling algorithms and core tracing, we now have many configurable samplers
that may be working simultaneously within one application. These tests describe how the samplers should be set up
based on local config, and how they are expected to behave under traffic. 

## sampler_configuration.json

This is a small test describing the samplers that should be created based on local config. 

### Full Test Parameters

| Parameter | Description |
| --- | --- |
| `test_name` | The name of this test |
|`comment`| A longer description of the test |
|`config`| The local sampler config, provided as a nested JSON Object |
|`expected_samplers`|The samplers that should have been created based on the local config, provided as a nested JSON object whose keys are one or more of `full_root`, `full_remote_parent_sampled`, `full_remote_parent_not_sampled`, `partial_root`, `partial_remote_parent_sampled`, `partial_remote_parent_not_sampled`. If a sampler is not specified in `expected_samplers`, this is because the sampler is expected to have been disabled by the local config. |

Additionally, each expected sampler will have one or more of the properties below:

| Expected sampler property | Description |
| --- | --- |
| `type` | The type of the sampler that was created. Options are `always_on`, `always_off`, `trace_id_ratio_based`, and `adaptive`. |
| `is_global_adaptive_sampler` | Whether this sampler is the shared global instance of the adaptive sampler. If `false`, then this sampler MUST be a unique adaptive sampler instance. |
| `ratio` | The expected ratio this sampler should use, if this is a `trace_id_ratio_based` sampler. |
| `target` | The sampling target the sampler should use, if this is an `adaptive` sampler. If a test with an adaptive sampler is missing this, it is because the global adaptive sampler is in use and no global `adaptive_sampling_target` has been configured (so the target will vary depending on each team's default).|


## harvest_sampling_rates.json

This test describes expected sampling rates during **one (the first), slow (60-sec) harvest** based on local config and specified traffic. 

### Test setup

Every test case in this suite must be able to simulate a single slow harvest and the following types of transactions. Example headers are provided to help clarify the situation (you can use but you must generate random trace ids within the traceparent, otherwise ratio sampling will not work as expected).

| Transaction type | Description | Example headers creating this scenario |
| --- | --- | --- |
| `root` | This is a root trace originating from this service | none |
| `parent_sampled_no_matching_acct_id` | The remote parent was sampled, and there was not a matching trusted account id in the headers. | trusted_account_key: 33, <br/> {<br/> traceparent: 00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-01,<br/> tracestate: 44@nr=0-0-44-2827902-0af7651916cd43dd--1--1518469636035 <br/> } |
| `parent_sampled_matching_acct_id_sampled_true` | The remote parent was sampled, there was a matching trusted acct id in the headers, and the tracestate sampled flag was set to true. | trusted_account_key: 33,<br/> { <br/> traceparent: 00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-01,<br/> tracestate: 33@nr=0-0-33-2827902-0af7651916cd43dd--1--1518469636035 <br/> } |
| `parent_not_sampled_no_matching_acct_id` | The remote parent was not sampled, and there was not a matching trusted acct id in the headers. |trusted_account_key: 33,<br/> {<br/> traceparent: 00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-00,<br/> tracestate: 44@nr=0-0-44-2827902-0af7651916cd43dd--1-1.2-1518469636035 <br/>}|
| `parent_not_sampled_matching_acct_id_sampled_true` | The remote parent not sampled, there was a matching trusted acct id in the headers, and the tracestate sampled flag was set to true.| trusted_account_key: 33,<br/> {<br/> traceparent: 00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-00,<br/> tracestate: 33@nr=0-0-33-2827902-0af7651916cd43dd--1--1518469636035 <br/>} |

### Full Test Parameters

| Parameter | Description |
| --- | --- | 
| `test_name` | The name of this test |
|`comment` | A longer description of the test |
|`config` | The local sampler config, provided as a nested JSON Object |
|`root`| The number of transactions of this type to simulate during this harvest |
|`parent_sampled_no_matching_acct_id`|(as above)|
|`parent_sampled_matching_acct_id_sampled_true`|(as above)|
|`parent_not_sampled_no_matching_acct_id`|(as above)|
|`parent_not_sampled_matching_acct_id_sampled_true`|(as above)|
|`expected_sampled`| The total number of transactions that should have been sampled. |
|`expected_sampled_full`| The total number of transactions that should have been sampled at full granularity. |
|`expected_sampled_partial`| The total number of transactions that should have been sampled at partial granularity. |
|`expected_adaptive_sampler_decisions`| The number of new sampling decisions that the adaptive sampler had to compute. **Note**: This is an optional assertion, and would require mocking, spying or instrumentating the AdaptiveSampler to indicate it's being used to compute a sampling decision.|
|`variance`|The acceptable variance in the expected values for this test, expressed as a decimal.  Eg: if `variance = 0.1` and `expected_sampled = 100`, the test passes if `90 <= actual total sampled <= 110`. This is provided for tests that include a trace id ratio based sampler (see Nondeterministic Sampler Behavior below).|

### Explanation of traffic types

The list of cases above might seem odd. The cases are intentionally specific to hone in on important details of how our samplers should work. 
We need to verify the behavior for `root`, `remote_parent_sampled`, and `remote_parent_not_sampled` transactions for all of our samplers. 

We also need to verify additional `remote_parent` behavior for our adaptive sampler. For brevity, the explanation below is in WC3-speak (though proprietary newrelic headers also apply). 
- After `remote_parent_sampled` or `remote_parent_not_sampled` has been determined from the traceparent header,
the adaptive sampler looks for a matching trusted account id off the tracestate header. The id it finds may or may not match. 
  - => We need to vary our cases based on whether or not a matching account id was found (eg, `parent_sampled_no_matching_acct_id` vs `parent_sampled_matching_acct_id_sampled_true`).
- Next, if a matching id was found, the adaptive sampler should not run, and instead reuse the `sampled` flag on the tracestate header. This `sampled` flag may or may not
match the `remote_parent_sampled/not_sampled` flag we pulled earlier from the traceparent. (It is also possible for the tracestate `sampled` flag to be missing, but that is out of scope for these tests).
  - => We need to vary our test cases to cover scenarios where the two sampling flags match (`parent_sampled_matching_acct_id_sampled_true`) or
  do not match (`parent_not_sampled_matching_acct_id_sampled_true`).

By including this breadth of cases, we hope to ensure these tests cover common mistakes and gotchas. 

### Nondeterministic Sampler Behavior

The always_on and always_off samplers behave deterministically. Their expected sampling totals are always exact.

The adaptive and trace_id_ratio_based samplers are probabilistic in the wild, so their expected sampling totals not usually exact. 
To account for this non-deterministic behavior in these tests, we make the following simplifications:

- Adaptive Sampler: this sampler **does** behave deterministically in the first harvest, when it samples exactly its target. So, we use this
to our advantage, by running each test as though it is the first harvest. Please be aware, that testing harvests after the first is still important,
and **SHOULD** be done by each team in team-specific unit tests. 
- Trace Id Ratio Based Sampler: this sampler is not deterministic, but it is highly faithful to its configured ratio, especially as the number of 
samples increases. Any test with a trace_id_ratio_based sampler will include a **variance** parameter (described in the test parameters table above) to account for this small margin of error.

