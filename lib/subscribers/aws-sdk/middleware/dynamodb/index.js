/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { setDynamoParameters } = require('#agentlib/instrumentation/aws-sdk/util.js')
const recordOperationMetrics = require('#agentlib/metrics/recorders/database-operation.js')
const { ALL, DB } = require('#agentlib/metrics/names.js')
const urltils = require('#agentlib/util/urltils.js')

const DYNAMO_METRICS = {
  _metrics: {
    PREFIX: 'DynamoDB',
    ALL: `${DB.PREFIX}DynamoDB/${ALL}`
  }
}

module.exports = [
  {
    fn: dynamoMiddleware,
    config: {
      name: 'NewRelicDynamoMiddleware',
      step: 'initialize',
      priority: 'high',
      override: true
    }
  },
  {
    fn: resourceIdMiddleware,
    config: {
      name: 'NewRelicCloudResource',
      step: 'deserialize',
      priority: 'low',
      override: true
    }
  }
]

/**
 * Middleware hook that records the middleware chain
 * when command is in a list of monitored commands.
 *
 * @type {AwsSdkBoundMiddlewareFunction}
 */
function dynamoMiddleware(subscriber, config, next, context) {
  const { commandName } = context
  const { agent } = subscriber

  subscriber.opaque = true
  return async function nrDynamoMiddleware(...args) {
    const ctx = agent.tracer.getContext()
    if (!ctx.transaction || ctx.transaction.isActive() === false) {
      return next.apply(this, args)
    }

    let endpoint = null
    try {
      endpoint = await getEndpoint(config)
    } catch (err) {
      subscriber.logger.debug(err, 'Failed to get the endpoint.')
    }

    const [command] = args
    const params = setDynamoParameters(endpoint, command.input)

    const name = `${DB.OPERATION}/DynamoDB/${commandName}`
    const newCtx = subscriber.createSegment({
      name,
      recorder: recordOperationMetrics.bind(DYNAMO_METRICS),
      ctx
    })

    const { segment } = newCtx
    if (segment) {
      segment.addAttribute('product', 'DynamoDB')
      addDatastoreAttributes(segment, params, agent.config)
    }

    return agent.tracer.runInContext({ handler: next, context: newCtx, full: true, thisArg: this, args })
  }
}

/**
 * Wraps the deserialize middleware step to add the
 * cloud.resource_id segment attributes for the AWS command
 *
 * @type {AwsSdkBoundMiddlewareFunction}
 */
function resourceIdMiddleware(subscriber, config, next) {
  return async function nrResourceIdMiddleware(...args) {
    let region
    try {
      region = await config.region()
      const { agent } = subscriber
      const segment = agent.tracer.getContext()?.segment
      const accountId = agent.config.cloud.aws.account_id

      if (accountId && segment) {
        const attributes = segment.getAttributes()
        segment.addAttribute(
          'cloud.resource_id',
          `arn:aws:dynamodb:${region}:${accountId}:table/${attributes.collection}`
        )
      }
    } catch (err) {
      subscriber.logger.debug(err, 'Failed to add AWS cloud resource id to segment')
    }

    return next(...args)
  }
}

const INSTANCE_KEYS = ['host', 'port_path_or_id']
const DB_NAME_KEY = 'database_name'
const HOST_KEY = 'host'

// TODO: this is the same function as in lib/subscribers/db.js which we will reconcile in a future refactor
function addDatastoreAttributes(segment, params, agentConfig) {
  const instanceReporting = agentConfig.datastore_tracer.instance_reporting.enabled
  const dbNameReporting = agentConfig.datastore_tracer.database_name_reporting.enabled

  for (let [key, value] of Object.entries(params)) {
    if (INSTANCE_KEYS.includes(key) && !instanceReporting) {
      continue
    }

    if (key === DB_NAME_KEY && !dbNameReporting) {
      continue
    }

    if (key === HOST_KEY && urltils.isLocalhost(value)) {
      value = agentConfig.getHostnameSafe()
    }

    if (key === DB_NAME_KEY && typeof value === 'number') {
      value = String(value)
    }

    segment.addAttribute(key, value)
  }
}

async function getEndpoint(config) {
  if (typeof config.endpoint === 'function') {
    return await config.endpoint()
  }

  const region = await config.region()
  return new URL(`https://dynamodb.${region}.amazonaws.com`)
}
