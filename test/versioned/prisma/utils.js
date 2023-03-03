/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const utils = module.exports
const { assertSegments, findSegment, getMetricHostName } = require('../../lib/metrics_helper')
const { DB, PRISMA } = require('../../../lib/metrics/names')
const params = require('../../lib/params')
const expectedUpsertMetrics = {
  [`${DB.ALL}`]: 4,
  [`${DB.PREFIX}${DB.WEB}`]: 4,
  [`${PRISMA.OPERATION}findMany`]: 2,
  [`${PRISMA.STATEMENT}user/findMany`]: 2,
  [`${PRISMA.OPERATION}update`]: 2,
  [`${PRISMA.STATEMENT}user/update`]: 2,
  [`${DB.PREFIX}${PRISMA.PREFIX}/${DB.WEB}`]: 4,
  [`${DB.PREFIX}${PRISMA.PREFIX}/all`]: 4
}
const findMany = `${PRISMA.STATEMENT}user/findMany`
utils.findMany = findMany
const update = `${PRISMA.STATEMENT}user/update`
// Note that in a raw query we get the raw table name, which in this
// case is capitalized.
const raw = `${PRISMA.STATEMENT}User/select`
utils.raw = raw
const rawUpdate = `${PRISMA.STATEMENT}User/update`
utils.rawUpdate = rawUpdate

/**
 * Asserts all the expected datastore metrics for a given query
 *
 * @param {Object} t tap test instance
 * @param {Object} agent mocked NR agent
 */
function verifyMetrics(t, agent) {
  for (const [metricName, expectedCount] of Object.entries(expectedUpsertMetrics)) {
    const metric = agent.metrics.getMetric(metricName)
    t.equal(
      metric.callCount,
      expectedCount,
      `should have counted ${metricName} ${expectedCount} times`
    )
  }
}

/**
 * Asserts all relevant prisma segments and their associative datastore attributes.
 * It also asserts that every segment has a hrDuration which means it has ended
 *
 * @param {Object} t tap test instance
 * @param {Object} agent mocked NR agent
 * @param {Object} transaction active NR transaction
 */
function verifyTraces(t, agent, transaction) {
  const host = getMetricHostName(agent, params.postgres_host)
  const trace = transaction.trace
  t.ok(trace, 'trace should exist')
  t.ok(trace.root, 'root element should exist')

  assertSegments(trace.root, [findMany, update, update, findMany], { exact: true })
  const findManySegment = findSegment(trace.root, findMany)
  t.ok(findManySegment.timer.hrDuration, 'findMany segment should have ended')
  const updateSegment = findSegment(trace.root, update)
  t.ok(updateSegment.timer.hrDuration, 'update segment should have ended')
  for (const segment of [findManySegment, updateSegment]) {
    const attributes = segment.getAttributes()
    const name = segment.name
    t.equal(attributes.host, host, `host of segment ${name} should equal ${host}`)
    t.equal(
      attributes.database_name,
      params.postgres_db,
      `database name of segment ${name} should be ${params.postgres_db}`
    )
    t.equal(
      attributes.port_path_or_id,
      params.postgres_prisma_port.toString(),
      `port of segment ${name} should be ${params.postgres_prisma_port}`
    )
  }
}

/**
 * Gets the sql traces from the agent query trace aggregator.  It then asserts all their
 * associative datastore attributes + backtrace.
 *
 * @param {Object} t tap test instance
 * @param {Object} agent mocked NR agent
 * @param {Number} [count=3] number of queries it expects in aggregator
 */
utils.verifySlowQueries = function verifySlowQueries(t, agent, queries = []) {
  const metricHostName = getMetricHostName(agent, params.postgres_host)

  t.equal(agent.queries.samples.size, queries.length, `should have ${queries.length} queries`)
  let i = 0
  for (const sample of agent.queries.samples.values()) {
    t.equal(sample.trace.query, queries[i], 'Query name should be expected')
    const queryParams = sample.getParams()
    console.log(queryParams)

    t.equal(queryParams.host, metricHostName, 'instance data should show up in slow query params')

    t.equal(
      queryParams.port_path_or_id,
      String(params.postgres_prisma_port),
      'instance data should show up in slow query params'
    )

    t.equal(
      queryParams.database_name,
      params.postgres_db,
      'database name should show up in slow query params'
    )

    t.ok(queryParams.backtrace, 'params should contain a backtrace')
    i++
  }
}

/**
 * Helper that verifies both metrics and relevant segments on trace
 *
 * @param {Object} t tap test instance
 * @param {Object} agent mocked NR agent
 * @param {Object} transaction active NR transaction
 */
utils.verify = function verify(t, agent, transaction) {
  verifyMetrics(t, agent)
  verifyTraces(t, agent, transaction)
}
