/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const BaseSubscriber = require('../base')
const { ARG_PREFIX, FIELD_PREFIX, FIELD_ARGS_ATTR, FIELD_NAME_ATTR, FIELD_PATH_ATTR, RESOLVE_PREFIX, RETURN_TYPE_ATTR, PARENT_TYPE_ATTR } = require('./constants')
const resolverRecorder = require('#agentlib/metrics/recorders/apollo-resolver.js')
const { apolloErrorHandled } = require('#agentlib/symbols.js')
const { DESTINATIONS } = require('#agentlib/config/attribute-filter.js')

module.exports = class ApolloResolveSubscriber extends BaseSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@apollo/server', channelName: 'nr_resolve' })
    this.events = ['end']
  }

  /**
   * We have to wrap the `field.resolve` method to properly recorder resolver segments
   * as well as bind them to the active async context
   * @param {object} data event passed to end hook
   */
  end(data) {
    const self = this
    const [field] = data.arguments
    if (field.resolve) {
      const origResolve = field.resolve
      field.resolve = function wrappedResolve(...args) {
        return self.wrapResolve(origResolve, this, args)
      }
    }
  }

  wrapResolve(origResolve, thisArg, args) {
    const ctx = this.agent.tracer.getContext()
    const operationSegment = ctx?.segment
    const transaction = ctx.transaction
    const [, resolverArgs, , info] = args
    const pathArray = this.flattenToArray(info.path)
    const formattedPath = pathArray.reverse().join('.')
    const flattenedArgs = this.flattenArgs({ obj: resolverArgs })

    this.maybeCaptureFieldMetrics({ transaction, info, args: flattenedArgs })

    if (!this.config.apollo_server.scalars && !this.isTopLevelField(info) && this.isScalar(info)) {
      return this.agent.tracer.bindFunction(origResolve, ctx).apply(thisArg, args)
    }

    const newCtx = this.createSegment({
      recorder: resolverRecorder,
      name: `${RESOLVE_PREFIX}/${formattedPath}`,
      ctx,
    })
    const resolverSegment = newCtx?.segment
    this.maybeAddAttributes({ resolverSegment, operationSegment, formattedPath, info, flattenedArgs })

    return this.runResolverInContext({ origResolve, args, thisArg, ctx: newCtx })
  }

  /**
   * Binds an inContext function that is used to possibly add custom attibutes to resolver
   * segment. It also binds the new context which has the resolver segment.
   * It also handles errors and marks the error with a symbol to tell the operation request
   * that the error has already been handled
   *
   * @param {object} params to function
   * @param {Function} params.origResolve original resolver function
   * @param {Array} params.args args to original resolver function
   * @param {*} params.thisArg the this binding to the original resolver function
   * @param {Context} params.ctx the new context with the resolver segment
   * @returns {*} result of original resolver function
   */
  runResolverInContext({ origResolve, args, thisArg, ctx }) {
    const { segment: resolverSegment, transaction } = ctx
    try {
      const subscriber = this
      function inContext(source, args, contextValue, info) {
        if (subscriber.agent.customCallbacks.apollo.resolverCallback) {
          subscriber.agent.customCallbacks.apollo.resolverCallback({ source, args, contextValue, info })
        }

        return origResolve.apply(thisArg, arguments)
      }
      // must bind a temporary function to get the resolver segment as the active segment
      // before possibly adding custom attributes
      return this.agent.tracer.bindFunction(inContext, ctx, true).apply(thisArg, args)
    } catch (err) {
      const error = err.originalError || err
      // must pass in resolverSegment as it is no longer in the context of the resolver
      this.agent.errors.add(transaction, error, error.extensions, resolverSegment)
      // tells the operation that the resolver handled the error
      error[apolloErrorHandled] = true
      throw err
    }
  }

  /**
   * Adds relevant apollo resolver attributes to resolver segment if created.
   * It will also add the field args to the operation segment
   *
   * @param {object} params to function
   * @param {TraceSegment} params.resolverSegment resolver segment
   * @param {TraceSegment} params.operationSegment operation segment
   * @param {string} params.formattedPath formatted path to resolver
   * @param {object} params.info info key from resolver context
   * @param {object} params.flattenedArgs a list of args flattened
   */
  maybeAddAttributes({ resolverSegment, operationSegment, formattedPath, info, flattenedArgs }) {
    if (resolverSegment?.name !== operationSegment?.name) {
      resolverSegment.addAttribute(FIELD_PATH_ATTR, formattedPath)
      resolverSegment.addAttribute(FIELD_NAME_ATTR, info.fieldName)
      resolverSegment.addAttribute(RETURN_TYPE_ATTR, info.returnType.toString())
      resolverSegment.addAttribute(PARENT_TYPE_ATTR, info.parentType.toString())
      // Like our http and framework instrumentation, we add
      // the attributes on the operation segment. We also add
      // the attributes to resolver segments as they help
      // inform performance impacts.
      for (const segment of [operationSegment, resolverSegment]) {
        for (const [key, value] of Object.entries(flattenedArgs)) {
          // Require adding to attribute 'include' configuration
          // so as not to accidentally send sensitive info to New Relic.
          segment.attributes.addAttribute(DESTINATIONS.NONE, `${FIELD_ARGS_ATTR}.${key}`, value)
        }
      }
    }
  }

  /**
   * Captures both field and args of resolvers as metrics.
   *
   * This is intended to be used to determine if a field within a graphql schema is still being requested.
   *
   * @param {object} params to function
   * @param {object} params.info info key from resolver context
   * @param {object} params.transaction active transaction
   * @param {object} params.args args key from resolver context
   *
   */
  maybeCaptureFieldMetrics({ info, transaction, args }) {
    const { config } = this
    if (config.apollo_server.field_metrics) {
      const fieldName = info.fieldName
      const fieldType = info.parentType.toString()
      this.captureFieldMetrics({ transaction, args, fieldName, fieldType })
    }
  }

  /**
   * Used to create metrics that just increment call count.  Intended to be
   * used to report on when we see args in a resolver
   *
   * @param {Transaction} transaction handle
   * @param {string} name metric name
   */
  createCallCountMetric(transaction, name) {
    const metric = transaction.metrics.getOrCreateMetric(name)
    metric.incrementCallCount()
  }

  /**
   * Captures both field and args of resolvers as metrics.
   *
   * This is intended to be used to determine if a field within a graphql schema is still being requested.
   *
   * @param {object} params to function
   * @param {object} params.transaction active transaction
   * @param {object} params.args args key from resolver context
   * @param {object} params.fieldType parent type of field
   * @param {object} params.fieldName name of field
   *
   */
  captureFieldMetrics({ transaction, args, fieldType, fieldName }) {
    const fieldMetric = `${FIELD_PREFIX}/${fieldType}.${fieldName}`
    this.createCallCountMetric(transaction, fieldMetric)
    Object.entries(args).forEach(([key]) => {
      const name = `${ARG_PREFIX}/${fieldType}.${fieldName}/${key}`
      this.createCallCountMetric(transaction, name)
    })
  }

  flattenToArray(fieldPath) {
    const pathArray = []

    let thisPath = fieldPath
    while (thisPath) {
      if (typeof thisPath.key !== 'number') {
        pathArray.push(thisPath?.key)
      }
      thisPath = thisPath?.prev
    }

    return pathArray
  }

  /**
   * Takes a nested object and flattens the key/values
   * { book: { author: { name: 'George Orwell' }, title: '1984' }}
   * would flatten to { book.author.name: 'George Orwell', book.title: '1984' }
   *
   * @param {object} params to function
   * @param {object} params.result resulting object
   * @param {string} [params.prefix] prefix of key
   * @param {object} params.obj object to flatten
   * @returns {object} flattens key/values
   */
  flattenArgs({ result = {}, prefix = '', obj }) {
    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        this.flattenArgs({ result, prefix: prefix + key + '.', obj: obj[key] })
      } else {
        result[prefix + key] = obj[key]
      }
    }

    return result
  }

  isScalar(fieldInfo) {
    return this.isScalarType(fieldInfo?.returnType) || this.isNonNullScalarType(fieldInfo?.returnType)
  }

  isScalarType(typeInstance) {
    const typeName = typeInstance?.constructor?.name
    return typeName === 'GraphQLScalarType'
  }

  isNonNullScalarType(returnType) {
    const returnTypeName = returnType?.constructor?.name
    if (returnTypeName !== 'GraphQLNonNull' || !returnType?.ofType) {
      return false
    }

    const nestedType = returnType?.ofType
    return this.isScalarType(nestedType)
  }

  isTopLevelField(fieldInfo) {
    const parentName = fieldInfo?.parentType?.name
    return parentName === 'Query' || parentName === 'Mutation'
  }
}
