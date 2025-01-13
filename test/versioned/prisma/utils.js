/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const utils = module.exports
const assert = require('node:assert')
const { findSegment, getMetricHostName } = require('../../lib/metrics_helper')
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
const { assertSegments } = require('../../lib/custom-assertions')

/**
 * Asserts all the expected datastore metrics for a given query
 *
 * @param {Object} agent mocked NR agent
 */
function verifyMetrics(agent) {
  for (const [metricName, expectedCount] of Object.entries(expectedUpsertMetrics)) {
    const metric = agent.metrics.getMetric(metricName)
    assert.equal(
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
 * @param {Object} agent mocked NR agent
 * @param {Object} transaction active NR transaction
 */
function verifyTraces(agent, transaction) {
  const host = getMetricHostName(agent, params.postgres_host)
  const trace = transaction.trace
  assert.ok(trace, 'trace should exist')
  assert.ok(trace.root, 'root element should exist')

  assertSegments(trace.root, [findMany, update, update, findMany], { exact: true })
  const findManySegment = findSegment(trace.root, findMany)
  assert.ok(findManySegment.timer.hrDuration, 'findMany segment should have ended')
  const updateSegment = findSegment(trace.root, update)
  assert.ok(updateSegment.timer.hrDuration, 'update segment should have ended')
  for (const segment of [findManySegment, updateSegment]) {
    const attributes = segment.getAttributes()
    const name = segment.name
    assert.equal(attributes.host, host, `host of segment ${name} should equal ${host}`)
    assert.equal(
      attributes.database_name,
      params.postgres_db,
      `database name of segment ${name} should be ${params.postgres_db}`
    )
    assert.equal(
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
 * @param {Object} agent mocked NR agent
 * @param {Number} [count] number of queries it expects in aggregator
 * @param queries
 */
utils.verifySlowQueries = function verifySlowQueries(agent, queries = []) {
  const metricHostName = getMetricHostName(agent, params.postgres_host)

  assert.equal(agent.queries.samples.size, queries.length, `should have ${queries.length} queries`)
  let i = 0
  for (const sample of agent.queries.samples.values()) {
    assert.equal(sample.trace.query, queries[i], 'Query name should be expected')
    const queryParams = sample.getParams()

    assert.equal(
      queryParams.host,
      metricHostName,
      'instance data should show up in slow query params'
    )

    assert.equal(
      queryParams.port_path_or_id,
      String(params.postgres_prisma_port),
      'instance data should show up in slow query params'
    )

    assert.equal(
      queryParams.database_name,
      params.postgres_db,
      'database name should show up in slow query params'
    )

    assert.ok(queryParams.backtrace, 'params should contain a backtrace')
    i++
  }
}

/**
 * Helper that verifies both metrics and relevant segments on trace
 *
 * @param {Object} agent mocked NR agent
 * @param {Object} transaction active NR transaction
 */
utils.verify = function verify(agent, transaction) {
  verifyMetrics(agent)
  verifyTraces(agent, transaction)
}
