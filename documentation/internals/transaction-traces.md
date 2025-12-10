## Transaction Traces

Transaction traces are the primary data structure used to store TraceSegments within a transaction. 
TraceSegments are stored on the trace as a trie structure, with each segment having a parent segment (except for the root segment), and children. 
When a transaction ends, the trace is ended, which iterates over the segment trie and calls finalize on every segment.  Finalizing a segment involves calculating its exclusive time (the time spent in the segment excluding time spent in child segments) and preparing the segment for serialization. It will also synthesize Span events from TraceSegment events if distributed tracing and span events capture are enabled.


## Synthesizing Spans from TraceSegments
Spans are only created if distributed tracing and span events capture are enabled. It iterates over every segment in the trace, and calls [spanAggregator.addSegment](https://github.com/newrelic/node-newrelic/blob/103044d25a968649bdb0e39df054757163cd986f/lib/transaction/trace/index.js#L121).  
If infinite tracing is configured, it creates a [StreamingSpanEvent](https://github.com/newrelic/node-newrelic/blob/103044d25a968649bdb0e39df054757163cd986f/lib/spans/streaming-span-event.js#L111) and adds to the [StreamingSpanEventAggregator stream](https://github.com/newrelic/node-newrelic/blob/103044d25a968649bdb0e39df054757163cd986f/lib/spans/streaming-span-event-aggregator.js#L118).  
If it is a full granularity trace, it creates a [SpanEvent](https://github.com/newrelic/node-newrelic/blob/103044d25a968649bdb0e39df054757163cd986f/lib/spans/span-event.js#L237) and adds to the [SpanEventAggregator](https://github.com/newrelic/node-newrelic/blob/103044d25a968649bdb0e39df054757163cd986f/lib/spans/span-event-aggregator.js#L98).  
If it is a partial granularity trace, it runs the given logic based on the partial granularity type, and enqueues the span back to the trace on a `trace.spans` Array.  If the partial granularity type logic drops the span, it will track the span id that was dropped with its parent on the `trace.droppedSpans` map. This will be used to reparent spans whose parent was dropped. Below describes the logic for a given partial granularity type:

 * `reduced`:  it will create a [SpanEvent](https://github.com/newrelic/node-newrelic/blob/103044d25a968649bdb0e39df054757163cd986f/lib/spans/span-event.js#L237), and then decide whether or not the span should be kept.  If it is an entry point or LLM span, it will be kept.  If it is an exit span(e.g. `span.kind` of client), it will be kept if if has one attribute that is used to make an [entity relationship](https://github.com/newrelic/node-newrelic/blob/103044d25a968649bdb0e39df054757163cd986f/lib/spans/span-event.js#L21).
 * `essential`:  the same logic will applied as `reduced`, but in addition, it will keep all intrinsic attributes, only keep agent attributes that are used to make entity relationships, and drop all user attributes.
 * `compact`: the same logic will be applied as `reduced` and `essential`, but in addition, it will only keep one exit span per entity.  

In a partial granularity trace, when all spans are generated, it will finalize span events.  
This process does not apply to infinite tracing nor full granularity traces.  
The finalization process will re-parent spans when type is `reduced` or `essential`.  
If the type is `compact`, it will re-parent all exit spans to the entry point span.  
It will also add two attributes to every exit span that is kept: `nr.ids` and `nr.durations`.
 * `nr.ids`:  an array of exit span ids that were dropped for the same entity
 * `nr.durations`: a float that represents the total unique duration of all exit spans for the same entity


