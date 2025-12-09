# Span Links

Span links are supported in our agent primarily to support the propagation of
span link metadata from Open Telemetry instrumentations. A span link describes
how to link an entity to the transaction that produced it. This is most common
in distributed messaging systems:

1. A system will generate a message and post it to something like RabbitMQ.
1. The posting happens in a unique transaction.
1. Another part of the system will monitor the queue for messages.
1. Retrieving messages from the queue happens in a unique transaction.
1. Retrieved messages could be from multiple different transactions.
1. The span link data associated with each retrieved message relates the
message back to the unique transaction that originally posted it.

## Implementation

1. [`lib/otel/traces/segment-synthesis`](../../lib/otel/traces/segment-synthesis.js):
The final step of the `synthesize` method attaches links to the current
trace segment.
1. [`lib/spans/span-event`](../../lib/spans/span-event.js):
The `createSpan` method propagates links from the trace segment to the span.
1. [`lib/spans/span-event-aggregator`](../../lib/spans/span-event-aggregator.js):
The `_toPayloadSync` method injects span links into the events data subsequent
to the span they are attached to.

The `_toPayloadSync` method is what is invoked at harvest time. The result
is the data structure that is sent to the collector.
