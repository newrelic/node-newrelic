/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseSubscriber = require('../base')
const genericRecorder = require('#agentlib/metrics/recorders/generic.js')
const { apolloErrorHandled } = require('#agentlib/symbols.js')
const {
  ANON_PLACEHOLDER,
  BATCH_PREFIX,
  DEFAULT_OPERATION_NAME,
  HEALTH_CHECK_QUERY_NAME,
  IGNORED_PATH_FIELDS,
  INTROSPECTION_TYPES,
  OBFUSCATION_STR,
  OPERATION_NAME_ATTR,
  OPERATION_PREFIX,
  OPERATION_QUERY_ATTR,
  OPERATION_TYPE_ATTR,
  SERVICE_DEFINITION_QUERY_NAME
} = require('./constants')

module.exports = class ApolloSubscriber extends BaseSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@apollo/server', channelName: 'nr_processRequest' })
    this.events = ['asyncEnd']
  }

  /**
   * Creates a placeholder segment for the apollo server operation. It will be updated when the call ends.
   *
   * @param {object} data event data
   * @param {Context} ctx the current context
   * @returns {Context} with new segment bound
   */
  handler(data, ctx) {
    return this.createSegment({
      name: DEFAULT_OPERATION_NAME,
      recorder: genericRecorder,
      ctx
    })
  }

  asyncEnd(data) {
    const [, , , requestContext] = data.arguments
    const ctx = this.agent.tracer.getContext()
    const operationSegment = ctx.segment
    const transaction = ctx.transaction
    this.updateOperationSegmentName({ requestContext, ctx })

    if (this.shouldIgnoreTransaction(requestContext.operation)) {
      transaction.setForceIgnore(true)
    }

    this.handleErrors({ requestContext, transaction })

    if (this.agent.customCallbacks.apollo.operationCallback) {
      this.agent.customCallbacks.apollo.operationCallback(requestContext)
    }

    operationSegment.touch()
  }

  handleErrors({ requestContext, transaction }) {
    if (Array.isArray(requestContext.errors)) {
      for (let error of requestContext.errors) {
        error = error.originalError || error
        if (!error[apolloErrorHandled]) {
          this.agent.errors.add(transaction, error, error.extensions)
        }
      }
    }
  }

  /**
   * Attempts to extract the document from the request context and
   * add attributes for the query, operation type, operation name and
   * update the transaction name based on operation name as well
   *
   * @param {object} params to function
   * @param {object} params.requestContext apollo request context
   * @param {object} params.ctx active agent context
   */
  updateOperationSegmentName({ requestContext, ctx }) {
    const { transaction, segment } = ctx
    const operationDetails = this.getOperationDetails(requestContext)
    if (operationDetails) {
      const { operationName, operationType, deepestUniquePath, cleanedQuery } = operationDetails

      segment.addAttribute(OPERATION_QUERY_ATTR, cleanedQuery)

      segment.addAttribute(OPERATION_TYPE_ATTR, operationType)

      if (operationName) {
        segment.addAttribute(OPERATION_NAME_ATTR, operationName)
      }

      const formattedName = operationName || ANON_PLACEHOLDER
      let formattedOperation = `${operationType}/${formattedName}`

      // Certain requests, such as introspection, won't hit any resolvers
      if (deepestUniquePath) {
        formattedOperation += `/${deepestUniquePath}`
      }

      const segmentName = formattedOperation
      const transactionName = formattedOperation
      this.setTransactionName(transaction, transactionName)
      segment.name = `${OPERATION_PREFIX}/${segmentName}`
    } else {
      this.setTransactionName(transaction, '*')
    }
  }

  setTransactionName(transaction, name) {
    const nameState = transaction.nameState
    if (!nameState.graphql) {
      // Override previously set path stack set thus far by web framework.
      nameState.setName(nameState.prefix, nameState.verb, nameState.delimiter, name)

      // Indicate we've set a name via graphql and future attempts to name
      // are a part of a batch query request to apollo.
      nameState.graphql = true
    } else {
      // If this is a batch query, add 'batch' indicator to the first part of the
      // name unless we've already done so processing a prior query in the batch.
      const firstPart = nameState.pathStack[0]
      if (firstPart.path !== BATCH_PREFIX) {
        nameState.pathStack.unshift({ path: BATCH_PREFIX, params: null })
      }

      nameState.appendPath(name)
    }
  }

  shouldIgnoreTransaction(operation) {
    const { config, logger } = this
    if (!operation) {
      logger.trace('`operation` is undefined. Skipping query type check.')
      return false
    }

    if (!config.apollo_server.introspection_queries && this.isIntrospectionQuery(operation)) {
      logger.trace(
        'Request is an introspection query and ' +
          '`config.apollo_server.introspection_queries` is set to `false`. Force ignoring the transaction.'
      )

      return true
    }

    if (!config.apollo_server.service_definition_queries && this.isServiceDefinitionQuery(operation)) {
      logger.trace(
        'Request is an Apollo Federated Gateway service definition query and ' +
          '`config.apollo_server.service_definition_queries` is set to `false`. Force ignoring the transaction.'
      )

      return true
    }

    if (!config.apollo_server.health_check_queries && this.isHealthCheckQuery(operation)) {
      logger.trace(
        'Request is an Apollo Federated Gateway health check query and ' +
          '`config.apollo_server.health_check_queries` is set to `false`. ' +
          'Force ignoring the transaction.'
      )

      return true
    }

    return false
  }

  isIntrospectionQuery(operation) {
    return operation?.selectionSet?.selections?.every((selection) => {
      const fieldName = selection?.name?.value
      return INTROSPECTION_TYPES.includes(fieldName)
    })
  }

  isServiceDefinitionQuery(operation) {
    return operation?.name?.value === SERVICE_DEFINITION_QUERY_NAME
  }

  isHealthCheckQuery(operation) {
    return operation?.name?.value === HEALTH_CHECK_QUERY_NAME
  }

  getOperationDetails(responseContext) {
    if (!responseContext.document) {
      return null
    }

    return this.getDetailsFromDocument(responseContext)
  }

  /**
   * fragments could be defined for a given operation.  This iterates over the definitions
   * to find the operation definition to avoid issues with naming
   * see: https://github.com/newrelic/newrelic-node-apollo-server-plugin/issues/175
   *
   * @param {Array} definitions to look for operation
   * @returns {object} found definition
   */
  findOperationDefinition(definitions) {
    return definitions?.find((definition) => definition?.kind === 'OperationDefinition')
  }

  getDetailsFromDocument(responseContext) {
    const definition = this.findOperationDefinition(responseContext?.document?.definitions)

    const pathAndArgs = this.getDeepestPathAndQueryArguments(definition)

    // always use context.source so we can get both queries and persisted queries
    // see: https://github.com/apollographql/apollo-server/blob/2bccec2c5f5adaaf785f13ab98b6e52e22d5b22e/packages/apollo-server-core/src/requestPipeline.ts#L232
    const query = this.cleanQuery(responseContext?.source, pathAndArgs?.argLocations)

    const deepestUniquePath = pathAndArgs?.deepestPath

    const definitionName = definition?.name?.value

    return {
      operationType: definition.operation,
      operationName: definitionName,
      deepestUniquePath: deepestUniquePath.join('.'),
      cleanedQuery: query
    }
  }

  /**
   * Returns an object with the deepest path in the document definition selectionSet
   * along with query argument locations in raw query string.
   * Deepest path is built from field names where only one field is in selectionSet.
   *
   * 'id' and '__typename' fields are filtered out of consideration to improve
   * naming in sub graph scenarios.
   * @param {object} definition of graphql field
   * @returns {object} { deepestPath, argLocations }
   */
  getDeepestPathAndQueryArguments(definition) {
    const self = this
    let deepestPath = []
    let foundDeepestPath = false
    const argLocations = []

    definition?.selectionSet?.selections?.forEach((selection) => {
      searchSelection(selection)
    })

    return {
      deepestPath,
      argLocations
    }

    /**
     * Search each selection path until no-more sub-selections
     * exist. If the current path is deeper than deepestPath,
     * deepestPath is replaced.
     * @param {object} selection path
     * @param {Array} currentParts current deepest path
     */
    function searchSelection(selection, currentParts) {
      const parts = currentParts ? [...currentParts] : []

      // capture the arguments for a selection
      if (selection?.arguments?.length > 0) {
        selection.arguments.forEach((arg) => {
          argLocations.push(arg?.loc)
        })
      }

      if (!foundDeepestPath) {
        // Build up deepest path
        if (self.isNamedType(selection)) {
          const lastItemIdx = parts.length - 1
          // add type to the last item in parts array
          // (i.e - `_entities<Human>`)
          parts[lastItemIdx] = `${parts[lastItemIdx]}<${selection?.typeCondition?.name?.value}>`
        } else {
          // Add selection name to deepest path
          selection?.name &&
            IGNORED_PATH_FIELDS.indexOf(selection?.name?.value) < 0 &&
            parts.push(selection?.name?.value)
        }
      }

      // end if no more selections
      if (selection.selectionSet) {
        // Filter selections used for naming
        const filtered = self.filterSelectionsForDeepestPath(selection.selectionSet.selections)

        // When no selections returned from filtering, deepest path is found
        if (filtered.length === 0 || filtered.length > 1) {
          foundDeepestPath = true
          deepestPath = parts
        }

        // Recurse through inner selections
        filtered.forEach((innerSelection) => {
          searchSelection(innerSelection, parts)
        })
      } else if (!deepestPath.length || parts.length > deepestPath.length) {
        // Add selection parts to deepest path if we're not done
        deepestPath = parts
      }
    }
  }

  filterSelectionsForDeepestPath(selections) {
    return selections?.filter((currentSelection) => {
      // Inline fragments describe the prior element (_entities or unions) but contain
      // selections for further naming.
      if (currentSelection?.kind === 'InlineFragment') {
        return true
      }

      return IGNORED_PATH_FIELDS.indexOf(currentSelection?.name?.value) < 0
    })
  }

  /**
   * Checks if selection is an InlineFragment that is a
   * NamedType
   * see: https://graphql.org/learn/queries/#inline-fragments
   *
   * @param {object} selection node in grapql document AST
   * @returns {boolean} if selection is a named type
   */
  isNamedType(selection) {
    return (
      selection?.kind === 'InlineFragment' &&
      selection?.typeCondition?.kind === 'NamedType' &&
      selection?.typeCondition?.name
    )
  }

  cleanQuery(query, argLocations) {
    let cleanedQuery = query
    let offset = 0

    argLocations.forEach((loc) => {
      cleanedQuery =
        cleanedQuery.slice(0, loc.start - offset) +
        OBFUSCATION_STR +
        cleanedQuery.slice(loc.end - offset)

      offset = loc.end - loc.start - OBFUSCATION_STR.length
    })

    return cleanedQuery
  }
}
