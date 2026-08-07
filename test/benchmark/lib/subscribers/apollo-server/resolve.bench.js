/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/*
 * Benchmark for the apollo-server resolve subscriber hot path.
 *
 * `wrapResolve` runs once per resolved GraphQL field, so its per-call cost is
 * multiplied by every field in every query. This suite isolates that cost by
 * field-type case, plus the individual helpers it calls, so the effect of
 * future optimizations to `wrapResolve` can be measured directly.
 *
 * The most important cases are the SCALAR ones: under the default config
 * (`apollo_server.scalars = false`), a scalar field creates no segment, yet the
 * current `wrapResolve` still flattens the field path and the resolver args
 * before it reaches the scalar short-circuit — work that is then discarded.
 * Scalar leaf fields dominate real responses, so this is the hot case to watch.
 *
 * Even when the segment is skipped, `wrapResolve` does NOT skip the resolver: it
 * still runs the original resolver through `tracer.runInContext` (resolve.js:69)
 * so the resolver executes inside the correct async context. Most real resolvers
 * do asynchronous work — querying a database — before returning, so the resolver
 * is a promise that resolves on a later tick and the context must be restored
 * across that `await`. The `*-db-query` cases below exercise exactly that path:
 * the resolver simulates a database round-trip (via `fixtures.dbQueryResolve`),
 * so we measure the subscriber's cost of wrapping an awaiting resolver in a
 * context, not just its synchronous pre-work. The scalar `*-db-query` case is
 * the skipped-segment-plus-database path called out for optimization.
 */

const benchmark = require('#testlib/benchmark.js')
const logger = require('#agentlib/logger.js')
const ApolloResolveSubscriber = require('#agentlib/subscribers/apollo-server/resolve.js')
const fixtures = require('./fixtures.js')

// Default config: scalars off, field_metrics off. This is the shipped default
// and the config the optimization targets.
const suite = benchmark.createBenchmark({
  name: 'apollo-server resolve subscriber',
  runs: 100_000,
  agent: {
    config: {
      apollo_server: {
        scalars: false,
        field_metrics: false
      }
    }
  }
})

// Build the subscriber once per test via `before`; construction (which sets up
// a diagnostics channel) is not what we're measuring. `before` runs after the
// agent is instrumented, so `agent` is available.
function makeSubscriber(agent) {
  const subLogger = logger.child({ component: 'apollo-resolve-bench' })
  return new ApolloResolveSubscriber({ agent, logger: subLogger })
}

const tests = [
  // ---- Full wrapResolve, by field-type case (run in a transaction so the
  //      tracer context, segment creation and attribute capture are real) ----
  {
    name: 'wrapResolve/scalar-no-args',
    runInTransaction: true,
    before: (agent) => {
      return {
        sub: makeSubscriber(agent),
        args: fixtures.resolverArgs(fixtures.NO_ARGS, fixtures.scalarFieldInfo())
      }
    },
    fn: wrapResolve
  },
  {
    name: 'wrapResolve/scalar-with-args',
    runInTransaction: true,
    before: (agent) => {
      return {
        sub: makeSubscriber(agent),
        args: fixtures.resolverArgs(fixtures.NESTED_ARGS, fixtures.scalarFieldWithArgsInfo())
      }
    },
    fn: wrapResolve
  },
  {
    name: 'wrapResolve/object-no-args',
    runInTransaction: true,
    before: (agent) => {
      return {
        sub: makeSubscriber(agent),
        args: fixtures.resolverArgs(fixtures.NO_ARGS, fixtures.objectFieldInfo())
      }
    },
    fn: wrapResolve
  },
  {
    name: 'wrapResolve/object-with-args',
    runInTransaction: true,
    before: (agent) => {
      return {
        sub: makeSubscriber(agent),
        args: fixtures.resolverArgs(fixtures.SIMPLE_ARGS, fixtures.objectFieldInfo())
      }
    },
    fn: wrapResolve
  },

  // ---- Resolvers that query a database (async): the resolver awaits I/O
  //      before returning, so `wrapResolve` must invoke it through
  //      `runInContext` and the context is restored across the await. ----
  {
    // Skipped-segment path (scalar leaf, default config) + a database query.
    // This is the path called out for optimization: no segment is created, yet
    // the resolver is still run inside a context while it awaits the "query".
    name: 'wrapResolve/scalar-db-query (segment skipped)',
    runInTransaction: true,
    before: (agent) => {
      return {
        sub: makeSubscriber(agent),
        args: fixtures.resolverArgs(fixtures.NO_ARGS, fixtures.scalarFieldInfo())
      }
    },
    fn: wrapResolveDbQuery
  },
  {
    // Kept-segment path (non-top-level object field) + a database query, for
    // direct comparison against the skipped case above.
    name: 'wrapResolve/object-db-query (segment kept)',
    runInTransaction: true,
    before: (agent) => {
      return {
        sub: makeSubscriber(agent),
        args: fixtures.resolverArgs(fixtures.SIMPLE_ARGS, fixtures.objectFieldInfo())
      }
    },
    fn: wrapResolveDbQuery
  },

  // ---- Individual helpers, isolated (no transaction needed) ----
  {
    name: 'flattenToArray (deep path)',
    before: (agent) => { return { sub: makeSubscriber(agent), path: fixtures.scalarFieldInfo().path } },
    fn: (agent, { sub, path }) => {
      sub.flattenToArray(path)
    }
  },
  {
    name: 'flattenArgs (nested)',
    before: (agent) => { return { sub: makeSubscriber(agent) } },
    fn: (agent, { sub }) => {
      sub.flattenArgs({ obj: fixtures.NESTED_ARGS })
    }
  },
  {
    name: 'isScalar (scalar type)',
    before: (agent) => { return { sub: makeSubscriber(agent), info: fixtures.scalarFieldInfo() } },
    fn: (agent, { sub, info }) => {
      sub.isScalar(info)
    }
  },
  {
    name: 'isScalar (object type)',
    before: (agent) => { return { sub: makeSubscriber(agent), info: fixtures.objectFieldInfo() } },
    fn: (agent, { sub, info }) => {
      sub.isScalar(info)
    }
  }
]

for (const test of tests) {
  suite.add(test)
}

suite.run()

/**
 * Drives the subscriber's per-field entry point. `thisArg` is the resolver's
 * `this` (unused by the subscriber's own logic); the original resolver is a
 * trivial stub so the measurement reflects subscriber overhead, not user code.
 *
 * @param {object} agent the mocked agent (unused; context comes from the tracer)
 * @param {object} ctx the per-run context produced by `before`
 * @param {object} ctx.sub the resolve subscriber under test
 * @param {Array} ctx.args positional resolver args `[source, args, context, info]`
 */
function wrapResolve(agent, { sub, args }) {
  sub.wrapResolve(fixtures.origResolve, {}, args)
}

/**
 * Drives `wrapResolve` with a resolver that queries a database. The resolver
 * awaits simulated I/O, so `wrapResolve` returns the resolver's promise; we
 * await it here so the benchmark's per-run timing includes the context
 * enter/restore around the async resolver -- the work the subscriber does even
 * when it skips creating a segment.
 *
 * @param {object} agent the mocked agent (unused; context comes from the tracer)
 * @param {object} ctx the per-run context produced by `before`
 * @param {object} ctx.sub the resolve subscriber under test
 * @param {Array} ctx.args positional resolver args `[source, args, context, info]`
 * @returns {Promise<Array>} resolves with the simulated database rows
 */
function wrapResolveDbQuery(agent, { sub, args }) {
  return sub.wrapResolve(fixtures.dbQueryResolve, {}, args)
}
