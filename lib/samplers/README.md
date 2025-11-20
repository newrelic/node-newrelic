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

NOTE: `distributed_tracing.sampler` only exists for backward compatiability and may be deprecated in favor of `distributed_tracing.sampler.full_granularity`. For now, `full_granularity` will take precedence over the old path.

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

There are three sampler modes, each with three sampler sections, resulting in potentially nine different sampling decisions that the agent would have to support. We create a new `Sampler` instance (`AdaptiveSampler`, `AlwaysOnSampler`, `AlwaysOffSampler`, or `TraceIdRatioBasedSampler`, defined in this folder) for each of these sampler modes' sections.

`agent.sampler` would be defined as:

* `agent.sampler.fullGranularity.root`
* `agent.sampler.fullGranularity.remoteParentSampled`
* `agent.sampler.fullGranularity.remoteParentNotSampled`
* `agent.sampler.partialGranularity.root`
* `agent.sampler.partialGranularity.remoteParentSampled`
* `agent.sampler.partialGranularity.remoteParentNotSampled`

These fields currently exist (before core tracing was implemented); `agent.sampler.fullGranularity.*` will take precedence over these fields:

* `agent.sampler.root`
* `agent.sampler.remoteParentSampled`
* `agent.sampler.remoteParentNotSampled`

These samplers have a `applySamplingDecision({transaction})` function, which `Transaction` calls (in `lib/transaction/index.js`) to update its `sampled` field and therefore its `priority`.

Unlike the other samplers, the `AdaptiveSampler` must share state with other `AdaptiveSamplers` with the same `sampling_target`, which complicates our seperate sampler instances approach. This will be fixed shortly, and this document will be updated to describe that solution.
