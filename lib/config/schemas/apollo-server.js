/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'apollo-server.js',
  type: 'object',
  properties: {
    scalars: {
      type: 'boolean',
      default: false,
      description: 'Enable capture of timing of fields resolved with the GraphQLScalarType return type. This may be desired when performing time intensive calculations to return a scalar value. This is not recommended for queries that return a large number of pre-calculated scalar fields. NOTE: query/mutation resolvers will always be captured even if returning a scalar type.'
    },
    introspection_queries: {
      type: 'boolean',
      default: false,
      description: 'Enable capture of timings for an [IntrospectionQuery](https://www.graphql-js.org/api-v16/utilities/#introspectionquery)'
    },
    service_definition_queries: {
      type: 'boolean',
      default: false,
      description: 'Enable capture of timings for a [Service Definition query](https://www.apollographql.com/docs/federation/federation-spec/#fetch-service-capabilities) received from an Apollo Federated Gateway Server.'
    },
    health_check_queries: {
      type: 'boolean',
      default: false,
      description: 'Enable capture of timings for a [Health Check query](https://www.apollographql.com/docs/federation/api/apollo-gateway/#servicehealthcheck) received from an Apollo Federated Gateway Server.'
    },
    field_metrics: {
      type: 'boolean',
      default: false,
      description: 'Enable capture of metrics for every field and resolver argument seen for an Apollo query. This is intended to be used to check for any unused fields in your graphql schema.'
    }
  },
  additionalProperties: true,
  description: 'Stanza for customizing behavior for apollo server instrumentation'
}
