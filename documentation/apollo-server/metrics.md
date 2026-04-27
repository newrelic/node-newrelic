# Metrics

Two new metrics have been introduced to understand the behavior of your GraphQL operations within and across transactions. Read more on those below or jump down to the [Visualizations](#visualizations) section to see some recommended ways to use this data.

For more information on querying metrics and creating charts, see the [Resources](#resources) section.

## Operation Metrics

`/GraphQL/operation/ApolloServer/[operation-type]/[operation-name]/[deepest-unique-path]`

Operation metrics include the operation type, operation name and deepest-path. These metrics represent the durations of the individual queries or mutations and can be used to compare outside of the context of individual transactions which may have multiple queries.

**Operation Type:** Indicates if the operation was a query or a mutation.

**Operation Name:** The operation name when provided or `<anonymous>`.

**Deepest Unique Path:** The deepest path included in the selection set of a query where only one field was selected at each level. Since operation names may be reused, this helps further determine uniqueness of a given operation. See the description on the [transactions](./transactions.md#deepest-unique-path) page for more details.

## Field Resolve Metrics

`/GraphQL/resolve/ApolloServer/[parent-type].[field-name]`

Resolve metrics capture the duration spent resolving a particular piece of requested GraphQL data. These can be useful to find specific resolvers that may contribute to slowing down incoming queries. It can be helpful for distinguishing field resolvers that happen to have the same name but are on different types. It can also be can be helpful in case of the same resolver being used across different types. 

These differ slightly in naming from their segment/span counterparts. To better visualize relationships, the full path to a field is represented in segments/spans (e.g. libraries.books.title). To understand the duration aggregated across all usages and transactions, these metrics use the field name without the full path.

## Field and Argument Metrics

`/GraphQL/field/ApolloServer/[parent-type].[field-name]`
`/GraphQL/arg/ApolloServer/[parent-type].[field-name]/[arg-name]`

Field metrics are only captured when `config.apollo_server.field_metrics` is `true`.  Unlike the Field Resolve Metrics, this will capture every time a field or resolver argument is seen.
The intent of these metrics is to determine if a field in a GraphQL schema is still in use and is safe to remove.


### All fields and args that have been requested within the last day

```
FROM Metric SELECT count(newrelic.timeslice.value) where appName = '[YOUR APP NAME]' WITH METRIC_FORMAT 'GraphQL/{kind}/ApolloServer/{field}' where kind = 'arg' or kind = 'field' FACET kind, field limit max since 1 day ago 
```

## Visualizations

Here is a collection of useful queries that leverage these new metrics to better understand the behaviors of your Apollo GraphQL applications.

### Top 10 Operations

If you would like to have a list of the top 10 slowest operations, the following query can be used to pull the data on demand or as a part of a dashboard.

```
FROM Metric SELECT average(newrelic.timeslice.value) * 1000 WHERE appName = '[YOUR APP NAME]' WITH METRIC_FORMAT 'GraphQL/operation/ApolloServer/{operation}' FACET operation LIMIT 10
```

The 'Bar' chart type makes a nice visualization similar to the transaction overview you may be used to.

A 'Table' chart type may also be useful showing a breakdown of operations. For this scenario, we recommend leveraging the METRIC_FORMAT to give further sorting and visualization flexibility. The following query will generate columns of operation type, operation name, deepest-path and 'AVG Duration (MS)' to sort and examine as you wish.

```
FROM Metric SELECT average(newrelic.timeslice.value) * 1000 as 'AVG Duration (MS)' WHERE appName = '[YOUR APP NAME]' WITH METRIC_FORMAT 'GraphQL/operation/ApolloServer/{type}/{name}/{deepest-path}' FACET type, name, `deepest-path` LIMIT 20
```

### Average Operation Time

You may also wish to track the average duration over time for operations. To do this, a very similar query may be used leveraging `TIMESERIES`.

```
FROM Metric SELECT average(newrelic.timeslice.value) WHERE appName = '[YOUR APP NAME]' WITH METRIC_FORMAT 'GraphQL/operation/ApolloServer/{operation}' TIMESERIES FACET operation
```

This is best viewed with the 'Line' chart type which allows for viewing all operations or toggling visualization of individual operations.

### Top 10 Resolvers

If you would like to have a list of the top 10 slowest resolves, the following query can be used to pull the data on demand or as a part of a dashboard.

```
FROM Metric
SELECT average(newrelic.timeslice.value) * 1000 as 'Average Duration (MS)' WHERE appName = '[YOUR APP NAME]' WITH METRIC_FORMAT 'GraphQL/resolve/ApolloServer/{type}.{field}' FACET field LIMIT 20
```

If you would like to include the parent type.

```
FROM Metric
SELECT average(newrelic.timeslice.value) * 1000 as 'Average Duration (MS)' WHERE appName = '[YOUR APP NAME]' WITH METRIC_FORMAT 'GraphQL/resolve/ApolloServer/{field}' FACET field LIMIT 20
```

The 'Bar' chart type makes a nice visualization similar to the transaction overview you may be used to. The 'Table' chart type may also be useful showing a breakdown of field and 'Average Duration (MS)' in a table.

### Average Resolver Time

You may also wish to track the average duration over time for resolvers. To do this, a very similar query may be used leveraging `TIMESERIES`.

```
FROM Metric
SELECT average(newrelic.timeslice.value) * 1000 as 'Average Duration (MS)' TIMESERIES WHERE appName = '[YOUR APP NAME]' WITH METRIC_FORMAT 'GraphQL/resolve/ApolloServer/{field}' FACET field
```

This is best viewed with the 'Line' chart type which allows for viewing all operations or toggling visualization of individual operations.

## Resources

* [Query APM metric timeslice data with NRQL](https://docs.newrelic.com/docs/query-your-data/nrql-new-relic-query-language/nrql-query-tutorials/query-apm-metric-timeslice-data-nrql)

* [Add and customize metric charts](https://docs.newrelic.com/docs/insights/use-insights-ui/manage-dashboards/add-customize-metric-charts)
