/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')

const { afterEach, setupCoreTest } = require('../../lib/apollo/test-tools')
const assert = require('node:assert')
const { executeQuery, makeRequest } = require('../../lib/apollo/test-client')
const promiseResolvers = require('../../lib/promise-resolvers')

const ANON_PLACEHOLDER = '<anonymous>'
const UNKNOWN_OPERATION = '<unknown>'
const OPERATION_PREFIX = 'GraphQL/operation/ApolloServer'
const RESOLVE_PREFIX = 'GraphQL/resolve/ApolloServer'

const agentConfig = {
  distributed_tracing: { enabled: true } // enable span testing
}

/**
 *
 * @param {Agent} agent Agent instance
 */
function getErrorTraces(agent) {
  return agent.errors.traceAggregator.errors
}

/**
 *
 * @param {Agent} agent Agent instance
 */
function getSpanEvents(agent) {
  return agent.spanEventAggregator.getEvents()
}

/**
 *
 * @param {Agent} agent Agent instance
 * @param {string} spanId span id
 */
function findSpanById(agent, spanId) {
  const spans = getSpanEvents(agent)

  return spans.find((value) => {
    const { intrinsics } = value
    return intrinsics.guid === spanId
  })
}

const errorsTests = []

errorsTests.push({
  name: 'parsing error should be noticed and assigned to operation span',
  async fn(t) {
    const { agent, serverUrl } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedErrorMessage = 'Syntax Error: Expected Name, found <EOF>.'
    const expectedErrorType = 'GraphQLError'

    const invalidQuery = `query {
      libraries {
        books {
          title
          author {
            name
          }
        }
      }
    ` // missing closing }

    agent.once('transactionFinished', (transaction) => {
      const errorTraces = getErrorTraces(agent)
      assert.equal(errorTraces.length, 1)

      const errorTrace = errorTraces[0]

      const [, transactionName, errorMessage, errorType, params] = errorTrace
      assert.equal(transactionName, transaction.name)
      assert.equal(errorMessage, expectedErrorMessage)
      assert.equal(errorType, expectedErrorType)

      const { agentAttributes } = params

      assert.ok(agentAttributes.spanId)

      const matchingSpan = findSpanById(agent, agentAttributes.spanId)

      const { attributes, intrinsics } = matchingSpan
      assert.equal(intrinsics.name, `${OPERATION_PREFIX}/${UNKNOWN_OPERATION}`)
      assert.equal(attributes['error.message'], expectedErrorMessage)
      assert.equal(attributes['error.class'], expectedErrorType)
    })

    executeQuery(serverUrl, invalidQuery, (err, result) => {
      assert.ifError(err)

      assert.ok(result)
      assert.ok(result.errors)
      assert.equal(result.errors.length, 1) // should have one parsing error

      const [parseError] = result.errors
      assert.equal(parseError.extensions.code, 'GRAPHQL_PARSE_FAILED')

      resolve()
    })

    await promise
  }
})

errorsTests.push({
  name: 'validation error should be noticed and assigned to operation span',
  async fn(t) {
    const { agent, serverUrl } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedErrorMessage = 'Cannot query field "doesnotexist" on type "Book".'
    const expectedErrorType = 'GraphQLError'

    const invalidQuery = `query {
      libraries {
        books {
          doesnotexist {
            name
          }
        }
      }
    }`

    const deepestPath = 'libraries.books.doesnotexist.name'
    const expectedOperationName = `${OPERATION_PREFIX}/query/${ANON_PLACEHOLDER}/${deepestPath}`

    agent.once('transactionFinished', (transaction) => {
      const errorTraces = getErrorTraces(agent)
      assert.equal(errorTraces.length, 1)

      const errorTrace = errorTraces[0]

      const [, transactionName, errorMessage, errorType, params] = errorTrace
      assert.equal(transactionName, transaction.name)
      assert.equal(errorMessage, expectedErrorMessage)
      assert.equal(errorType, expectedErrorType)

      const { agentAttributes } = params

      assert.ok(agentAttributes.spanId)

      const matchingSpan = findSpanById(agent, agentAttributes.spanId)

      const { attributes, intrinsics } = matchingSpan
      assert.equal(intrinsics.name, expectedOperationName)
      assert.equal(attributes['error.message'], expectedErrorMessage)
      assert.equal(attributes['error.class'], expectedErrorType)
    })

    executeQuery(serverUrl, invalidQuery, (err, result) => {
      assert.ifError(err)

      assert.ok(result)
      assert.ok(result.errors)
      assert.equal(result.errors.length, 1) // should have one parsing error

      const [validationError] = result.errors
      assert.equal(validationError.extensions.code, 'GRAPHQL_VALIDATION_FAILED')

      resolve()
    })

    await promise
  }
})

errorsTests.push({
  name: 'resolver error should be noticed and assigned to resolve span',
  async fn(t) {
    const { agent, serverUrl } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedErrorMessage = 'Boom goes the dynamite!'
    const expectedErrorType = 'Error'

    const expectedName = 'BOOM'
    const invalidQuery = `query ${expectedName} {
      boom
    }`

    const expectedResolveName = `${RESOLVE_PREFIX}/boom`

    agent.once('transactionFinished', (transaction) => {
      const errorTraces = getErrorTraces(agent)
      assert.equal(errorTraces.length, 1)

      const errorTrace = errorTraces[0]

      const [, transactionName, errorMessage, errorType, params] = errorTrace
      assert.equal(transactionName, transaction.name)
      assert.equal(errorMessage, expectedErrorMessage)
      assert.equal(errorType, expectedErrorType)

      const { agentAttributes } = params

      assert.ok(agentAttributes.spanId)

      const matchingSpan = findSpanById(agent, agentAttributes.spanId)

      const { attributes, intrinsics } = matchingSpan
      assert.equal(intrinsics.name, expectedResolveName)
      assert.equal(attributes['error.message'], expectedErrorMessage)
      assert.equal(attributes['error.class'], expectedErrorType)
    })

    executeQuery(serverUrl, invalidQuery, (err, result) => {
      assert.ifError(err)

      assert.ok(result)
      assert.ok(result.errors)
      assert.equal(result.errors.length, 1) // should have one parsing error

      const [resolverError] = result.errors
      assert.equal(resolverError.extensions.code, 'INTERNAL_SERVER_ERROR')

      resolve()
    })

    await promise
  }
})

const errorTests = [
  {
    type: 'UserInputError',
    code: 'BAD_USER_INPUT',
    name: 'userInputError',
    msg: 'user input error'
  },
  {
    type: 'ValidationError',
    code: 'GRAPHQL_VALIDATION_FAILED',
    name: 'validationError',
    msg: 'validation error'
  },
  { type: 'ForbiddenError', code: 'FORBIDDEN', name: 'forbiddenError', msg: 'forbidden error' },
  { type: 'SyntaxError', code: 'GRAPHQL_PARSE_FAILED', name: 'syntaxError', msg: 'syntax error' },
  { type: 'AuthenticationError', code: 'UNAUTHENTICATED', name: 'authError', msg: 'auth error' },
  { type: 'CustomError', code: 'CUSTOM_ERROR', name: 'customError', msg: 'custom error' }
]
for (const errorTest of errorTests) {
  const { type, code, name, msg } = errorTest
  errorsTests.push({
    name: type,
    async fn(t) {
      const { agent, serverUrl } = t.nr
      const { promise, resolve } = promiseResolvers()

      const expectedErrorMessage = msg
      const expectedErrorType = type

      const invalidQuery = `query ${name} {
        ${name}
      }`

      agent.once('transactionFinished', (transaction) => {
        const errorTraces = getErrorTraces(agent)
        assert.equal(errorTraces.length, 1)

        const errorTrace = errorTraces[0]

        const [, transactionName, errorMessage, errorType, params] = errorTrace
        assert.equal(transactionName, transaction.name)
        assert.equal(errorMessage, expectedErrorMessage)
        assert.equal(errorType, expectedErrorType)

        const { agentAttributes, userAttributes } = params

        assert.ok(agentAttributes.spanId)
        assert.equal(userAttributes.code, code)

        const matchingSpan = findSpanById(agent, agentAttributes.spanId)

        const { attributes } = matchingSpan
        assert.equal(attributes['error.message'], expectedErrorMessage)
        assert.equal(attributes['error.class'], expectedErrorType)
      })

      executeQuery(serverUrl, invalidQuery, (err, result) => {
        assert.ifError(err)
        assert.ok(result)
        assert.ok(result.errors)
        assert.equal(result.errors.length, 1) // should have one parsing error

        const [resolverError] = result.errors
        assert.equal(resolverError.extensions.code, code)
        resolve()
      })

      await promise
    }
  })
}

errorsTests.push({
  name: 'Invalid operation name should not crash server',
  async fn(t) {
    const { agent, serverUrl } = t.nr
    const { promise, resolve } = promiseResolvers()
    const query = 'query Hello { hello }'
    const expectedErrorMessage = 'Unknown operation named "testMe".'
    const expectedErrorType = 'GraphQLError'

    agent.once('transactionFinished', (transaction) => {
      const errorTraces = getErrorTraces(agent)
      assert.equal(errorTraces.length, 1)

      const errorTrace = errorTraces[0]

      const [, transactionName, errorMessage, errorType, params] = errorTrace
      assert.equal(transactionName, transaction.name)
      assert.equal(errorMessage, expectedErrorMessage)
      assert.equal(errorType, expectedErrorType)

      const { agentAttributes } = params

      assert.ok(agentAttributes.spanId)

      const matchingSpan = findSpanById(agent, agentAttributes.spanId)

      const { attributes } = matchingSpan
      assert.equal(attributes['error.message'], expectedErrorMessage)
      assert.equal(attributes['error.class'], expectedErrorType)
    })
    const data = JSON.stringify({ query, operationName: 'testMe' })
    makeRequest(serverUrl, data, (err, result) => {
      assert.ifError(err)
      assert.ok(result)
      assert.ok(result.errors)
      assert.equal(result.errors.length, 1) // should have one parsing error
      const [resolverError] = result.errors
      // in apollo 4 they added a first class code for invalid operation names
      const expectedCode = 'OPERATION_RESOLUTION_FAILURE'
      assert.equal(resolverError.extensions.code, expectedCode)
      assert.equal(resolverError.message, expectedErrorMessage)
      resolve()
    })

    await promise
  }
})

test.afterEach(async (ctx) => {
  await afterEach({ t: ctx, testDir: __dirname })
})

for (const errorTest of errorsTests) {
  test(errorTest.name, async (t) => {
    await setupCoreTest({ t, agentConfig, testDir: __dirname })
    await errorTest.fn(t)
  })
}
