# Attributes

New Relic's transaction protocol has a core concept of "transaction attributes."
Attributes are metadata that are attached to various components of a
transaction:

1. The transaction itself.
1. Segments within the transaction.

Some data, e.g. span events or analytic events, are simply collections of
attributes.

An attribute is merely a key and value pairing. The key may be a dot (0x2e)
separated path, but is always a string. Values may be one of the types string
or number.

In the most typical case, attributes are classified into one of three buckets:

1. Agent attributes: metadata added by the agent that is useful to have, but
may be culled under certain conditions.
1. User attributes: metadata that the user of the agent has added to their
traces through the agent's public API.
1. Intrinsics: metadata required by the protocol that must be included with
each delivery of the data to the collector. The required attributes in an
intrinsics object are defined by the type of event it represents.

All together, metadata is collected and categorized into the appropriate
bucket such that attributes are typically sent as:

```js
[
  { /* userAttributes */ },
  { /* agentAttributes */ },
  { /* intrinsics */ }
]
```

## Filtering

Attributes can be filtered according to rules specified by either New Relic
or the customer. For example, a customer might define a rule that will drop
a transaction attribute with the key `foo.bar`. As attributes are collected
from the transaction, any that will a) target the transaction as the storage
medium and b) have the key `foo.bar` will not be included in the data sent
to the collector.

The configuration for filtering can come from the local agent's configuration
file (or environment) and/or from the server via the configuration returned
during the `connect` event.

## Agent Specifics

Within the Node.js agent's source code, we represent individual attributes
internally as a plain object like:

```js
{
  value: 'the value of the keypair',
  destinations: 0, // integer bitfield representing the transaction components
  // the attribute will be attached to.
  truncateExempt: boolean // `true` if the attribute cannot be filtered out
}
```

This internal representation is managed through the interface exported by
[`lib/attributes.js`](../../lib/attributes.js). The destinations bitfield is
exported by [`lib/config/attribute-filter.js`](../../lib/config/attribute-filter.js).

A transaction is comprised of a "trace" and "segments." Each entity is capable
of having attributes attached.

A trace contains "custom" attributes, that map
to `userAttributes`, "attributes" that map to `agentAttributes`, and
"intrinsics" that map to `instrinsics`. For example:

```js
const attrFilter = require('./lib/config/attribute-filter.js')
const tx = new Transaction()
// Add a user attribute value:
tx.trace.custom.addAttribute(
  addrFilter.TRANS_SCOPE,
  'key-name',
  'value',
  true // do not filter away
)
// NOTE: intrinsics on the trace are not managed through the attributes
// interface.
```

A segment only has a set of attributes. So to add a new attribute to a segment:

```js
const tx = new Transaction()
const segment = tx.trace.add('segment-name')
segment.addAttribute('key', 'value', true)
// NOTE: there are other methods on the segment for adding attributes to
// specific destinations. Review the `TraceSegment` object methods for details.
```
