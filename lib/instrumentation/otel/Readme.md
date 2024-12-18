## Notes

+ OTEL refers to observability concerns as "signals". Traces, Metrics, and Logs are all examples of different signals.
+ It is worthwhile to read through https://opentelemetry.io/docs/concepts/signals/traces/
+ Traces, or transactions, are collections of "spans": https://opentelemetry.io/docs/specs/otel/overview/#traces
+ Contexts are used to store the state of traces: https://opentelemetry.io/docs/specs/otel/overview/#context-propagation
+ Propagators are used to serialize spans (and other signals): https://opentelemetry.io/docs/specs/otel/overview/#propagators
+ Resources are descriptors of entities being instrumented, e.g a Docker container and its associated metadata: https://opentelemetry.io/docs/specs/otel/resource/sdk/

## Concept Map

+ NR_Transaction => OTEL_Trace
+ NR_Segment => OTEL_Span
+ NR_Span => OTEL_Span

## References

OTEL:
+ Span spec: https://opentelemetry.io/docs/specs/otel/trace/api/#span
+ SpanContext spec: https://opentelemetry.io/docs/specs/otel/trace/api/#spancontext

NR:
+ Trace spec: https://source.datanerd.us/agents/agent-specs/blob/main/Transaction-Trace-LEGACY.md
+ Span events: https://source.datanerd.us/agents/agent-specs/blob/main/Span-Events.md

## Identifiers

Top level names in the list are the OTEL `SpanContext` attributes.

+ `TraceId`:
  + OTEL: 16-byte array of random bytes. Represented by 32 character ascii string
  + NR: 128-bit GUID represented by 32 ascii characters
    + Named: `traceId`
    + https://source.datanerd.us/agents/agent-specs/blob/45afe900bd7a88d26a6ec590a19b8f6c33d2fea6/distributed_tracing/Trace-Context-Payload.md#traceId
    + https://source.datanerd.us/agents/agent-specs/blob/main/Span-Events.md#span-attributes
+ `SpanId`:
  + OTEL: 8-byte array of random bytes. Represented by 16 character ascii string
  + NR: same as `traceId`, named `guid`
  
## Plans?

+ We need to map OTEL's `SpanContext`, and overall `Span`, to a NR segment.
+ We need to map [`startSpan`](https://open-telemetry.github.io/opentelemetry-js/classes/_opentelemetry_sdk_trace_base.Tracer.html#startSpan) to creating a new NR Transaction if one does not exist.
+ We need to map OTEL span attributes to NR segment/transaction attributes
