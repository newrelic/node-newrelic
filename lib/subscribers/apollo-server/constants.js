/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const ANON_PLACEHOLDER = '<anonymous>'
const ARG_PREFIX = 'GraphQL/arg/ApolloServer'
const BATCH_PREFIX = 'batch'
const FIELD_ARGS_ATTR = 'graphql.field.args'
const FIELD_NAME_ATTR = 'graphql.field.name'
const FIELD_PATH_ATTR = 'graphql.field.path'
const FIELD_PREFIX = 'GraphQL/field/ApolloServer'
const HEALTH_CHECK_QUERY_NAME = '__ApolloServiceHealthCheck__'
const IGNORED_PATH_FIELDS = ['id', '__typename']
const INTROSPECTION_TYPES = ['__schema', '__type']
const OBFUSCATION_STR = '***'
const OPERATION_NAME_ATTR = 'graphql.operation.name'
const OPERATION_PREFIX = 'GraphQL/operation/ApolloServer'
const OPERATION_QUERY_ATTR = 'graphql.operation.query'
const OPERATION_TYPE_ATTR = 'graphql.operation.type'
const SERVICE_DEFINITION_QUERY_NAME = '__ApolloGetServiceDefinition__'
const PARENT_TYPE_ATTR = 'graphql.field.parentType'
const RESOLVE_PREFIX = 'GraphQL/resolve/ApolloServer'
const RETURN_TYPE_ATTR = 'graphql.field.returnType'
const DEFAULT_OPERATION_NAME = `${OPERATION_PREFIX}/<unknown>`

module.exports = {
  ANON_PLACEHOLDER,
  ARG_PREFIX,
  BATCH_PREFIX,
  DEFAULT_OPERATION_NAME,
  FIELD_ARGS_ATTR,
  FIELD_NAME_ATTR,
  FIELD_PATH_ATTR,
  FIELD_PREFIX,
  HEALTH_CHECK_QUERY_NAME,
  IGNORED_PATH_FIELDS,
  INTROSPECTION_TYPES,
  OBFUSCATION_STR,
  OPERATION_NAME_ATTR,
  OPERATION_PREFIX,
  OPERATION_QUERY_ATTR,
  OPERATION_TYPE_ATTR,
  PARENT_TYPE_ATTR,
  RESOLVE_PREFIX,
  RETURN_TYPE_ATTR,
  SERVICE_DEFINITION_QUERY_NAME
}
