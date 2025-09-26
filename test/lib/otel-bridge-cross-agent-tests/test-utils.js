/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const camelCase = require('#agentlib/util/camel-case.js')
const cmds = require('./commands')
const testAssertions = require('./assertions')
const DEBUG = process.env.NR_DEBUG

/**
 * Iterates over operations and runs them and subsequently executes all child operations and assertions.
 * It will end segments/spans/transactions if they are emitted
 *
 * @param {object} params to function
 * @param {Agent} params.agent agent instance
 * @param {object} params.api agent api
 * @param {Tracer} params.tracer otel tracer
 * @param {object} params.data data passed from previous callback
 * @param {object} params.operation operation object that defines childOperations and assertions
 */
function performOperation({ agent, api, tracer, data, operation }) {
  const childActions = []
  const childOps = operation?.childOperations ?? []
  childOps.forEach((childOp) => {
    childActions.push((cbData) => performOperation({ agent, api, tracer, data: cbData, operation: childOp }))
  })

  const childAssertions = operation?.assertions ?? []
  childAssertions.forEach((assertion) => {
    childActions.push(getActionForAssertion({ agent, assertion }))
  })

  const action = getActionForOperation({ agent, api, tracer, data, operation })
  action((cbData) => {
    childActions.forEach((childAction) => {
      childAction(cbData)
    })
    if (cbData?.end) {
      logger(`ENDING ${operation.command}: ${cbData?.name}`)
      cbData.end()
    }
  })
}

/**
 * Adds an assertion to the queue to be run after operations
 *
 * @param {object} params to function
 * @param {Agent} params.agent agent instance
 * @param {object} params.assertion assertion object that defines the assertion to run
 * @returns {function} deferred function to run
 */
function getActionForAssertion({ agent, assertion }) {
  const childActions = []
  const method = camelCase(assertion.rule.operator)
  childActions.push(() => {
    logger('RUNNING ASSERTION', method, assertion.description)
    testAssertions[method](agent, assertion.rule.parameters, assertion.description)
  })

  return () => {
    childActions.forEach((action) => action())
  }
}

/**
 * Adds an operation to the queue to be run
 *
 * @param {object} params to function
 * @param {Agent} params.agent agent instance
 * @param {object} params.api agent api
 * @param {Tracer} params.tracer otel tracer
 * @param {object} params.data data passed from previous callback
 * @param {object} params.operation operation object that defines childOperations and assertions
 * @returns {function} deferred function to run
 */
function getActionForOperation({ agent, api, tracer, data, operation }) {
  const { command, parameters } = operation
  return (work) => {
    const cmd = camelCase(command)
    logger('RUNING CMD', cmd)
    cmds[cmd]({ agent, api, tracer, data, ...parameters }, work)
  }
}

/**
 * logs a console.log if `NR_DEBUG` is true
 * Used for debugging tests
 */
function logger() {
  if (DEBUG) {
    console.log(...arguments)
  }
}

/**
 * Runs the agentOutput assertion
 * @param {Agent} agent instance
 * @param {Object} output collection that asserts all transactions/spans created during test run
 */
function assertAgentOutput(agent, output) {
  logger('ASSERTING AGENT OUTPUT')
  testAssertions.agentOutput(agent, output)
}

module.exports = {
  assertAgentOutput,
  logger,
  performOperation
}
