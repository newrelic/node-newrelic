# Segments and Spans

Segments and spans (when Distributed Tracing enabled) are captured for GraphQL operations, field resolution and additional work (when instrumented) that occurs as a part of field resolution such as making a query to a database.

## Operation Segments/Spans

`/GraphQL/operation/ApolloServer/[operation-type]/[operation-name]/[deepest-unique-path]`

Operation segments/spans include the operation type, operation name and deepest unique path. These represent the individual duration and attributes of a specific invocation within a transaction or trace.

For more details on the parts, see the [transactions](./transactions.md#details) page.

**Attributes**

| Name                   | Description      | Default  |
| ---------------------- | ---------------- | -------- |
| graphql.operation.type | query or mutation| included |
| graphql.operation.name | Name given to the operation or anonymous | included |
| graphql.operation.query | The original GraphQL query with arguments obfuscated | included |

To exclude capture of the query attribute (or any attribute), the attribute name will need to be added to the 'attributes' exclude list or segment/span attributes exclude lists individually.

For more information on including/excluding attributes, please see the [attributes documentation](https://docs.newrelic.com/docs/agents/nodejs-agent/attributes/nodejs-agent-attributes#configure-attributes).

## Field Resolve Segments/Spans

`/GraphQL/resolve/ApolloServer/[path]`

Resolve segments/spans leverage the resolution path of the individual field to best differentiate within a given trace or transaction. For example, `libraries.books` might be used instead of just `books`. These represent the individual duration and attributes of a specific field being resolved as a part of the GraphQL operation.

**Attributes**
| Name                     | Description                | Default  |
| ------------------------ | -------------------------- | -------- |
| graphql.field.name       | Name of the resolved field | included |
| graphql.field.returnType | Return type (`Book!`, `[String]`, etc. ) of the resolved field | included |
| graphql.field.parentType | Type of the parent of this field (`[Book]`) | included |
| graphql.field.path | Full resolve path of the field (`libraries.books`) | included |
| graphql.field.args | Arg passed to the GraphQL query or mutation for this resolver captured as key/value pairs | excluded |

To include capture of args attributes, `graphql.field.args.*` (to capture all) will need to be added to the 'attributes' include list or segment/span attributes include lists individually.

For more information on including/excluding attributes, please see the [attributes documentation](https://docs.newrelic.com/docs/agents/nodejs-agent/attributes/nodejs-agent-attributes#configure-attributes).
