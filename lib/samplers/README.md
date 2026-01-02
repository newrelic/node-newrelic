# Sampling at New Relic

The New Relic agent supports a robust sampling decision making interface. This is a work-in-progress feature.

## Config

Customers configure how they would like their transactions to be sampled under our `distributed_tracing` section in our config. Remember, sampling will only apply if a customer has `distributed_tracing.enabled` set to `true`, `distributed_tracing.sampler.full_granularity.enabled = true`, and if they want partial granularity traces, `distributed_tracing.sampler.partial_granularity.enabled = true`.

### Types

- A "sampler mode" refers to the following config sections: `distributed_tracing.sampler` and `distributed_tracing.sampler.partial_granularity`. They are defined by the three sections: `root`, `remote_parent_sampled`, and `remote_parent_not_sampled`.
- A "sampler section" refers to `root`, `remote_parent_sampled`, or `remote_parent_not_sampled` within a particular sampler mode. The config defined at this section, i.e. `SAMPLER_TYPE: SAMPLER_SUBOPTION?`, describes the sampling decision for that particular scenario within that mode.
  - `root`: This is the main sampler for traces originating from the current service.
  - `remote_parent_sampled`: The sampler for when the upstream service has sampled the trace.
  - `remote_parent_not_sampled`: The sampler for when the upstream service has not sampled the trace.
- `SAMPLER_TYPE` can be `adaptive`, `always_on`, `always_off`, and `trace_id_ratio_based`.
- `SAMPLER_SUBOPTION` is only valid for `adaptive` and `trace_id_ratio_based` and only required for `trace_id_ratio_based`. `adaptive` will fall back to a global `AdaptiveSampler` with a sampling target defined by `distributed_tracing.sampler.adaptive_sampling_target` if `adaptive.sampling_target` is not given.

NOTE: `distributed_tracing.sampler` will be used as the setting for the full granularity samplers.

### Full Config in Accordance to Spec
Full Config in Accordance to Pending Spec Changes (as of agent team discussions, 11/21/2025):

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
    adaptive_sampling_target (see note on Sampling Target above)
    root: (when the trace originates from the current service)
      ${SAMPLER_TYPE} (See `Sampler Options` above)
        ${SAMPLER_SUBOPTION}
    remote_parent_sampled: (when the upstream service has sampled the trace)
      ${SAMPLER_TYPE})
        ${SAMPLER_SUBOPTION}
    remote_parent_not_sampled: (when the upstream service has not sampled the trace)
      ${SAMPLER_TYPE}
        ${SAMPLER_SUBOPTION}
    full_granularity:
      enabled
    partial_granularity:
      enabled
      type   ("reduced", "essential", "compact")
      root: (when the trace originates from the current service)
        ${SAMPLER_TYPE}
          ${SAMPLER_SUBOPTION}
      remote_parent_sampled: (when the upstream service has sampled the trace)
        ${SAMPLER_TYPE}
          ${SAMPLER_SUBOPTION}
      remote_parent_not_sampled: (when the upstream service has not sampled the trace)
        ${SAMPLER_TYPE}
          ${SAMPLER_SUBOPTION}
...
```

## Solution

There are two sampler modes, each with three sampler sections, resulting in potentially six different sampling decisions that the agent would have to support. We create a new `Sampler` instance (`AdaptiveSampler`, `AlwaysOnSampler`, `AlwaysOffSampler`, or `TraceIdRatioBasedSampler`, defined in this folder) for each of these sampler modes' sections.

`agent.samplers` is defined as:

* `agent.samplers.root`
* `agent.samplers.remoteParentSampled`
* `agent.samplers.remoteParentNotSampled`
* `agent.samplers.partialRoot`
* `agent.samplers.partialRemoteParentSampled`
* `agent.samplers.partialRemoteParentNotSampled`
* `agent.samplers.adaptiveSampler` (if needed, see below)

These samplers have a `applySamplingDecision({transaction})` function, which `Transaction` calls (in `lib/transaction/index.js`) to update its `sampled` field and therefore its `priority`.

Unlike the other samplers, the `AdaptiveSampler` must share state with other `AdaptiveSampler`s if they do not have their suboption, `sampling_target,` defined. Thus, this introduces our seventh field on `agent.sampler.*`: `agent.sampler._globalAdaptiveSampler `. The intent of this field is to have one instance of an `AdaptiveSampler` for `adaptive` sampler sections that do not specify an `adaptive.sampling_target` to share.
