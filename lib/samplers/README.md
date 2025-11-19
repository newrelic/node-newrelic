# Sampling at New Relic

The New Relic agent supports a robust sampling decision making interface. This is a work-in-progress feature.

## Config

Customers configure how they would like their transactions to be sampled under our `distributed_tracing` section in our config. Remember, sampling will only apply if a customer has `distributed_tracing.enabled` set to `true`.

### Types

- A "sampler mode" refers to the following config sections: `distributed_tracing.sampler`, `distributed_tracing.sampler.full_granularity`, and `distributed_tracing.sampler.partial_granularity`. They are defined by the three sections: `root`, `remote_parent_sampled`, and `remote_parent_not_sampled`.
- A "sampler section" refers to `root`, `remote_parent_sampled`, or `remote_parent_not_sampled` within a particular sampler mode. The config defined at this section, i.e. `SAMPLER_TYPE: SAMPLER_SUBOPTION?`, describes the sampling decision for that particular scenario within that mode.
  - `root`: This is the main sampler for traces originating from the current service.
  - `remote_parent_sampled`: The sampler for when the upstream service has sampled the trace.
  - `remote_parent_not_sampled`: The sampler for when the upstream service has not sampled the trace.

NOTE: `distributed_tracing.sampler` only exists for backward compatiability and will be deprecated in favor of `distributed_tracing.sampler.full_granularity`. For now, `full_granularity` will take precedence over the old path.

### Full Config in Accordance to Spec

```yaml
...
(Serverless DT attributes; they may be defined under distributed_tracing instead)
account_id: string (unset by default, only set when using Serverless Mode)
trusted_account_key: string (unset by default, only set when using Serverless Mode)
primary_application_id: string (unset by default, only set when using Serverless Mode)
...
distributed_tracing:
  enabled: boolean (default true)
  exclude_newrelic_header: boolean (default false)
  enable_success_metrics (OPTIONAL): boolean (default true, set to false to disable supportability metrics)
  sampler: (section for sampling config options for different scenarios)
    adaptive_sampling_target (see note on Sampling Target below)
    root: (when the trace originates from the current service)
      ${SAMPLER_TYPE} (See `Sampler Options` below)
        ${SAMPLER_SUBOPTION}
    remote_parent_sampled: (when the upstream service has sampled the trace)
      ${SAMPLER_TYPE} (See `Sampler Options` below)
        ${SAMPLER_SUBOPTION}
    remote_parent_not_sampled: (when the upstream service has not sampled the trace)
      ${SAMPLER_TYPE}
        ${SAMPLER_SUBOPTION}
    full_granularity:
      enabled
      root: (when the trace originates from the current service)
        ${SAMPLER_TYPE} (See `Sampler Options` below)
          ${SAMPLER_SUBOPTION}
      remote_parent_sampled: (when the upstream service has sampled the trace)
        ${SAMPLER_TYPE} (See `Sampler Options` below)
          ${SAMPLER_SUBOPTION}
      remote_parent_not_sampled: (when the upstream service has not sampled the trace)
        ${SAMPLER_TYPE}
          ${SAMPLER_SUBOPTION}
    partial_granularity:
      enabled
      type   ("reduced", "essential", "compact")
      root: (when the trace originates from the current service)
        ${SAMPLER_TYPE} (See `Sampler Options` below)
          ${SAMPLER_SUBOPTION}
      remote_parent_sampled: (when the upstream service has sampled the trace)
        ${SAMPLER_TYPE} (See `Sampler Options` below)
          ${SAMPLER_SUBOPTION}
      remote_parent_not_sampled: (when the upstream service has not sampled the trace)
        ${SAMPLER_TYPE}
          ${SAMPLER_SUBOPTION}
...
```

## Solution

There are three sampler modes, each with three sampler sections, resulting in potentially nine different sampling decisions that the agent would have to support.

### Seperate Sampler Instances

We create a new `Sampler` instance for each sampler modes' section, resulting in 9 samplers. It would be something like (left-hand side represents the current instance's name if it exists):

`agent.sampler` would be defined as:

* `agent.sampler.full_granularity.root`
* `agent.sampler.full_granularity.remote_parent_sampled`
* `agent.sampler.full_granularity.remote_parent_not_sampled`
* `agent.sampler.partial_granularity.root`
* `agent.sampler.partial_granularity.remote_parent_sampled`
* `agent.sampler.partial_granularity.remote_parent_not_sampled`

Will be deprecated, `full_granularity` takes precedence:

* `agent.sampler.root`
* `agent.sampler.remote_parent_sampled`
* `agent.sampler.remote_parent_not_sampled`

`Transaction.prototype._calculatePriority` would be modified like:

```javascript
...
 // Decide sampling from w3c data
  let full_sampler = null
  let partial_sampler = null
  if (traceparent.isSampled === true) {
   full_sampler = this.agent.sampler.full_granularity.remote_parent_sampled
   partial_sampler = this.agent.sampler.partial_granularity.remote_parent_sampled
  } else if (traceparent.isSampled === false) {
   full_sampler = this.agent.sampler.full_granularity.remote_parent_not_sampled
   partial_sampler = this.agent.sampler.partial_granularity.remote_parent_not_sampled
  }
  this._calculatePriority(full_sampler, partial_sampler, tracestate)
...


Transaction.prototype._calculatePriority = function _calculatePriority(full_sampler = null, partial_sampler = null, tracestate = null) {
	// full_sampler would be `agent.sampler.full_granularity`
	// partial_sampler would be `agent.sampler.partial_granularity`
	// root is default because there's only one place (see above) where 
	// `remote_parent_sampled` and `remote_parent_not_sampled` is supplied instead
	if (!full_sampler){
		full_sampler = agent.sampler.full_granularity.root
	}
	if (!parital_sampler){
		partial_sampler=agent.sampler.partial_sampler.root
	}

  if (this.priority === null) {
    full_sampler.applySamplingDecision({ transaction: this, tracestate })

    // If full_granularity does not sample, it goes to parital_granularity's sampling decision
    if(this.sampled = false){
         partial_sampler.applySamplingDecision({ transaction: this, tracestate })
     }
  }
}
```
