/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const promiseResolvers = require('../../lib/promise-resolvers')
const helper = require('../../lib/agent_helper')
const { executeQuery, executeQueryBatch } = require('../../lib/apollo/test-client')
const { afterEach, setupCoreTest } = require('../../lib/apollo/test-tools')
const { makeDbClient } = require('../../lib/apollo/data-definitions')
const {
  checkResult,
  baseSegment,
  constructSegments,
  constructOperationSegments
} = require('../../lib/apollo/common')
const assert = require('node:assert')
const semver = require('semver')
const { assertSegments, assertMetrics, assertPackageMetrics } = require('../../lib/custom-assertions')

const ANON_PLACEHOLDER = '<anonymous>'
const UNKNOWN_OPERATION = '<unknown>'
const OPERATION_PREFIX = 'GraphQL/operation/ApolloServer'
const RESOLVE_PREFIX = 'GraphQL/resolve/ApolloServer'

test.afterEach(async (ctx) => {
  await afterEach({ t: ctx, testDir: __dirname })
})

const segmentsTests = []

segmentsTests.push({
  name: 'anonymous query, single level',
  async fn(t) {
    const { agent, serverUrl, TRANSACTION_PREFIX, apolloServerPkg } = t.nr
    const { promise, resolve } = promiseResolvers()

    const query = `query {
      hello
    }`

    agent.once('transactionFinished', (transaction) => {
      const operationPart = `query/${ANON_PLACEHOLDER}/hello`
      const firstSegmentName = baseSegment(operationPart, TRANSACTION_PREFIX)
      const operationSegments = constructOperationSegments(t.nr, [
        `${OPERATION_PREFIX}/${operationPart}`,
        [`${RESOLVE_PREFIX}/hello`]
      ])
      const expectedSegments = constructSegments(firstSegmentName, operationSegments)

      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
    })

    executeQuery(serverUrl, query, (err, result) => {
      assertPackageMetrics({ agent, pkg: '@apollo/server', version: apolloServerPkg.apolloVersion, subscriberType: true })
      assert.ifError(err)
      checkResult(assert, result, () => {
        resolve()
      })
    })

    await promise
  }
})

segmentsTests.push({
  name: 'named query, single level',
  async fn(t) {
    const { agent, serverUrl, TRANSACTION_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'HeyThere'
    const query = `query ${expectedName} {
      hello
    }`

    agent.once('transactionFinished', (transaction) => {
      const operationPart = `query/${expectedName}/hello`
      const firstSegmentName = baseSegment(operationPart, TRANSACTION_PREFIX)
      const operationSegments = constructOperationSegments(t.nr, [
        `${OPERATION_PREFIX}/${operationPart}`,
        [`${RESOLVE_PREFIX}/hello`]
      ])
      const expectedSegments = constructSegments(firstSegmentName, operationSegments)
      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.ifError(err)
      checkResult(assert, result, () => {
        resolve()
      })
    })

    await promise
  }
})

segmentsTests.push({
  name: 'named query, @include directive',
  async fn(t) {
    const { agent, serverUrl, TRANSACTION_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'HeyThere'
    const query = `query ${expectedName} {
      ... @include(if: true) {
        hello
      }
    }`

    agent.once('transactionFinished', (transaction) => {
      const operationPart = `query/${expectedName}/hello`
      const firstSegmentName = baseSegment(operationPart, TRANSACTION_PREFIX)
      const operationSegments = constructOperationSegments(t.nr, [
        `${OPERATION_PREFIX}/${operationPart}`,
        [`${RESOLVE_PREFIX}/hello`]
      ])
      const expectedSegments = constructSegments(firstSegmentName, operationSegments)
      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.ifError(err)
      checkResult(assert, result, () => {
        resolve()
      })
    })

    await promise
  }
})

segmentsTests.push({
  name: 'anonymous query, multi-level',
  async fn(t) {
    const {
      agent,
      serverUrl,
      config,
      TRANSACTION_PREFIX
    } = t.nr
    const { promise, resolve } = promiseResolvers()

    const query = `query {
      libraries {
        books {
          title
          author {
            name
          }
        }
      }
    }`

    const path = 'libraries.books'

    agent.once('transactionFinished', (transaction) => {
      const operationPart = `query/${ANON_PLACEHOLDER}/${path}`
      const firstSegmentName = baseSegment(operationPart, TRANSACTION_PREFIX)

      const resolveSegments = [
        `${RESOLVE_PREFIX}/libraries`,
        `${RESOLVE_PREFIX}/libraries.books`,
        `${RESOLVE_PREFIX}/libraries.books.author`
      ]

      if (config.apollo_server.scalars) {
        resolveSegments.push(`${RESOLVE_PREFIX}/libraries.books.author.name`)
      }
      const operationSegments = constructOperationSegments(t.nr, [
        `${OPERATION_PREFIX}/${operationPart}`,
        resolveSegments
      ])

      const expectedSegments = constructSegments(firstSegmentName, operationSegments)

      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.ifError(err)
      checkResult(assert, result, () => {
        resolve()
      })
    })

    await promise
  }
})

segmentsTests.push({
  name: 'named query, multi-level should return deepest unique path',
  async fn(t) {
    const {
      agent,
      config,
      serverUrl,
      TRANSACTION_PREFIX
    } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'GetBooksByLibrary'
    const query = `query ${expectedName} {
      libraries {
        books {
          title
          author {
            name
          }
        }
      }
    }`

    const path = 'libraries.books'

    agent.once('transactionFinished', (transaction) => {
      const operationPart = `query/${expectedName}/${path}`
      const firstSegmentName = baseSegment(operationPart, TRANSACTION_PREFIX)
      let resolveSegments
      if (config.apollo_server.scalars) {
        resolveSegments = [
          `${RESOLVE_PREFIX}/libraries`,
          `${RESOLVE_PREFIX}/libraries.books`,
          `${RESOLVE_PREFIX}/libraries.books.title`,
          `${RESOLVE_PREFIX}/libraries.books.author`,
          `${RESOLVE_PREFIX}/libraries.books.author.name`
        ]
      } else {
        resolveSegments = [
          `${RESOLVE_PREFIX}/libraries`,
          `${RESOLVE_PREFIX}/libraries.books`,
          `${RESOLVE_PREFIX}/libraries.books.author`
        ]
      }
      const operationSegments = constructOperationSegments(t.nr, [
        `${OPERATION_PREFIX}/${operationPart}`,
        resolveSegments
      ])
      const expectedSegments = constructSegments(firstSegmentName, operationSegments)

      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.ifError(err)
      checkResult(assert, result, () => {
        resolve()
      })
    })

    await promise
  }
})

segmentsTests.push({
  name: 'named query with aliases should use alias in segment naming',
  async fn(t) {
    const { agent, serverUrl, TRANSACTION_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'GetBooksByLibrary'
    const query = `query ${expectedName} {
      alias: libraries {
        books {
          title
          author {
            name
          }
        }
      }
    }`

    const path = 'libraries.books'

    agent.once('transactionFinished', (transaction) => {
      const operationPart = `query/${expectedName}/${path}`
      const firstSegmentName = baseSegment(operationPart, TRANSACTION_PREFIX)
      const operationSegments = constructOperationSegments(t.nr, [
        `${OPERATION_PREFIX}/${operationPart}`,
        [
          `${RESOLVE_PREFIX}/alias`,
          `${RESOLVE_PREFIX}/alias.books`,
          `${RESOLVE_PREFIX}/alias.books.author`
        ]
      ])
      const expectedSegments = constructSegments(firstSegmentName, operationSegments)

      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.ifError(err)
      checkResult(assert, result, () => {
        resolve()
      })
    })

    await promise
  }
})

segmentsTests.push({
  name: 'anonymous mutation, single level',
  async fn(t) {
    const { agent, serverUrl, TRANSACTION_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const query = `mutation {
      addThing(name: "added thing!")
    }`

    agent.once('transactionFinished', (transaction) => {
      const operationPart = `mutation/${ANON_PLACEHOLDER}/addThing`
      const firstSegmentName = baseSegment(operationPart, TRANSACTION_PREFIX)
      const operationSegments = constructOperationSegments(t.nr, [
        `${OPERATION_PREFIX}/${operationPart}`,
        [`${RESOLVE_PREFIX}/addThing`, ['timers.setTimeout', ['Callback: namedCallback']]]
      ])
      const expectedSegments = constructSegments(firstSegmentName, operationSegments)

      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.ifError(err)
      checkResult(assert, result, () => {
        resolve()
      })
    })

    await promise
  }
})

segmentsTests.push({
  name: 'named mutation, single level, should use mutation name',
  async fn(t) {
    const { agent, serverUrl, TRANSACTION_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'AddThing'
    const query = `mutation ${expectedName} {
      addThing(name: "added thing!")
    }`

    agent.once('transactionFinished', (transaction) => {
      const operationPart = `mutation/${expectedName}/addThing`
      const firstSegmentName = baseSegment(operationPart, TRANSACTION_PREFIX)
      const operationSegments = constructOperationSegments(t.nr, [
        `${OPERATION_PREFIX}/${operationPart}`,
        [`${RESOLVE_PREFIX}/addThing`, ['timers.setTimeout', ['Callback: namedCallback']]]
      ])
      const expectedSegments = constructSegments(firstSegmentName, operationSegments)

      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.ifError(err)
      checkResult(assert, result, () => {
        resolve()
      })
    })

    await promise
  }
})

segmentsTests.push({
  name: 'anonymous query, with params',
  async fn(t) {
    const { agent, serverUrl, TRANSACTION_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const query = `query {
      paramQuery(blah: "blah", blee: "blee")
    }`

    agent.once('transactionFinished', (transaction) => {
      const operationPart = `query/${ANON_PLACEHOLDER}/paramQuery`
      const firstSegmentName = baseSegment(operationPart, TRANSACTION_PREFIX)
      const operationSegments = constructOperationSegments(t.nr, [
        `${OPERATION_PREFIX}/${operationPart}`,
        [`${RESOLVE_PREFIX}/paramQuery`]
      ])
      const expectedSegments = constructSegments(firstSegmentName, operationSegments)

      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.ifError(err)
      checkResult(assert, result, () => {
        resolve()
      })
    })

    await promise
  }
})

segmentsTests.push({
  name: 'named query, with params',
  async fn(t) {
    const { agent, serverUrl, TRANSACTION_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'BlahQuery'
    const query = `query ${expectedName} {
      paramQuery(blah: "blah")
    }`

    agent.once('transactionFinished', (transaction) => {
      const operationPart = `query/${expectedName}/paramQuery`
      const firstSegmentName = baseSegment(operationPart, TRANSACTION_PREFIX)
      const operationSegments = constructOperationSegments(t.nr, [
        `${OPERATION_PREFIX}/${operationPart}`,
        [`${RESOLVE_PREFIX}/paramQuery`]
      ])
      const expectedSegments = constructSegments(firstSegmentName, operationSegments)

      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.ifError(err)
      checkResult(assert, result, () => {
        resolve()
      })
    })

    await promise
  }
})

segmentsTests.push({
  name: 'named query, with params, multi-level',
  async fn(t) {
    const {
      agent,
      config,
      serverUrl,
      TRANSACTION_PREFIX
    } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'GetBookForLibrary'
    const query = `query ${expectedName} {
      library(branch: "downtown") {
        books {
          title
          author {
            name
          }
        }
      }
    }`

    const path = 'library.books'

    agent.once('transactionFinished', (transaction) => {
      const operationPart = `query/${expectedName}/${path}`
      const firstSegmentName = baseSegment(operationPart, TRANSACTION_PREFIX)
      let resolveSegments
      if (config.apollo_server.scalars) {
        resolveSegments = [
          [`${RESOLVE_PREFIX}/library`, ['timers.setTimeout', ['Callback: <anonymous>']]],
          `${RESOLVE_PREFIX}/library.books`,
          `${RESOLVE_PREFIX}/library.books.title`,
          `${RESOLVE_PREFIX}/library.books.author`,
          `${RESOLVE_PREFIX}/library.books.author.name`
        ]
      } else {
        resolveSegments = [
          [`${RESOLVE_PREFIX}/library`, ['timers.setTimeout', ['Callback: <anonymous>']]],
          `${RESOLVE_PREFIX}/library.books`,
          `${RESOLVE_PREFIX}/library.books.author`
        ]
      }

      const operationSegments = constructOperationSegments(t.nr, [
        `${OPERATION_PREFIX}/${operationPart}`,
        resolveSegments
      ])
      const expectedSegments = constructSegments(firstSegmentName, operationSegments)

      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.ifError(err)
      checkResult(assert, result, () => {
        resolve()
      })
    })

    await promise
  }
})

segmentsTests.push({
  name: 'named query with fragment, query first',
  async fn(t) {
    const {
      agent,
      config,
      serverUrl,
      TRANSACTION_PREFIX
    } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'GetBookForLibrary'
    const query = `query ${expectedName} {
      library(branch: "downtown") {
        books {
          ... LibraryBook
        }
      }
    }
    fragment LibraryBook on Book {
      title
      author {
        name
      }
    }`

    const path = 'library.books.LibraryBook'

    agent.once('transactionFinished', (transaction) => {
      const operationPart = `query/${expectedName}/${path}`
      const firstSegmentName = baseSegment(operationPart, TRANSACTION_PREFIX)
      let resolveSegments
      if (config.apollo_server.scalars) {
        resolveSegments = [
          [`${RESOLVE_PREFIX}/library`, ['timers.setTimeout', ['Callback: <anonymous>']]],
          `${RESOLVE_PREFIX}/library.books`,
          `${RESOLVE_PREFIX}/library.books.title`,
          `${RESOLVE_PREFIX}/library.books.author`,
          `${RESOLVE_PREFIX}/library.books.author.name`
        ]
      } else {
        resolveSegments = [
          [`${RESOLVE_PREFIX}/library`, ['timers.setTimeout', ['Callback: <anonymous>']]],
          `${RESOLVE_PREFIX}/library.books`,
          `${RESOLVE_PREFIX}/library.books.author`
        ]
      }

      const operationSegments = constructOperationSegments(t.nr, [
        `${OPERATION_PREFIX}/${operationPart}`,
        resolveSegments
      ])
      const expectedSegments = constructSegments(firstSegmentName, operationSegments)

      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
    })

    executeQuery(serverUrl, query, (err) => {
      assert.ifError(err)
      resolve()
    })

    await promise
  }
})

segmentsTests.push({
  name: 'named query with fragment, fragment first',
  async fn(t) {
    const {
      agent,
      config,
      serverUrl,
      TRANSACTION_PREFIX
    } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'GetBookForLibrary'
    const query = `fragment LibraryBook on Book {
      title
      author {
        name
      }
    }
    query ${expectedName} {
      library(branch: "downtown") {
        books {
          ... LibraryBook
        }
      }
    }`

    const path = 'library.books.LibraryBook'

    agent.once('transactionFinished', (transaction) => {
      const operationPart = `query/${expectedName}/${path}`
      const firstSegmentName = baseSegment(operationPart, TRANSACTION_PREFIX)
      let resolveSegments
      if (config.apollo_server.scalars) {
        resolveSegments = [
          [`${RESOLVE_PREFIX}/library`, ['timers.setTimeout', ['Callback: <anonymous>']]],
          `${RESOLVE_PREFIX}/library.books`,
          `${RESOLVE_PREFIX}/library.books.title`,
          `${RESOLVE_PREFIX}/library.books.author`,
          `${RESOLVE_PREFIX}/library.books.author.name`
        ]
      } else {
        resolveSegments = [
          [`${RESOLVE_PREFIX}/library`, ['timers.setTimeout', ['Callback: <anonymous>']]],
          `${RESOLVE_PREFIX}/library.books`,
          `${RESOLVE_PREFIX}/library.books.author`
        ]
      }
      const operationSegments = constructOperationSegments(t.nr, [
        `${OPERATION_PREFIX}/${operationPart}`,
        resolveSegments
      ])
      const expectedSegments = constructSegments(firstSegmentName, operationSegments)

      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
    })

    executeQuery(serverUrl, query, (err) => {
      assert.ifError(err)
      resolve()
    })

    await promise
  }
})

segmentsTests.push({
  name: 'batch query should include segments for nested queries',
  async fn(t) {
    const { agent, serverUrl, TRANSACTION_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName1 = 'GetBookForLibrary'
    const query1 = `query ${expectedName1} {
      library(branch: "downtown") {
        books {
          title
          author {
            name
          }
        }
      }
    }`

    const query2 = `mutation {
      addThing(name: "added thing!")
    }`

    const path1 = 'library.books'

    const queries = [query1, query2]

    agent.once('transactionFinished', (transaction) => {
      const operationPart1 = `query/${expectedName1}/${path1}`
      const expectedQuery1Name = `${operationPart1}`
      const operationPart2 = `mutation/${ANON_PLACEHOLDER}/addThing`
      const expectedQuery2Name = `${operationPart2}`

      const batchTransactionPrefix = `${TRANSACTION_PREFIX}//batch`
      const operationPart = `${expectedQuery1Name}/${expectedQuery2Name}`
      const firstSegmentName = baseSegment(operationPart, batchTransactionPrefix).replace(
        'batch//',
        'batch/'
      )
      const operationSegments = constructOperationSegments(t.nr, [
        [
          `${OPERATION_PREFIX}/${operationPart1}`,
          [
            [`${RESOLVE_PREFIX}/library`, ['timers.setTimeout', ['Callback: <anonymous>']]],
            `${RESOLVE_PREFIX}/library.books`,
            `${RESOLVE_PREFIX}/library.books.title`,
            `${RESOLVE_PREFIX}/library.books.author`,
            `${RESOLVE_PREFIX}/library.books.author.name`
          ]
        ],
        [
          `${OPERATION_PREFIX}/${operationPart2}`,
          [`${RESOLVE_PREFIX}/addThing`, ['timers.setTimeout', ['Callback: namedCallback']]]
        ]
      ])
      const expectedSegments = constructSegments(firstSegmentName, operationSegments)

      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
    })

    executeQueryBatch(serverUrl, queries, (err, result) => {
      assert.ifError(err)
      checkResult(assert, result, () => {
        assert.equal(result.length, 2)

        resolve()
      })
    })

    await promise
  }
})

segmentsTests.push({
  name: 'union, single level',
  async fn(t) {
    const { agent, serverUrl, TRANSACTION_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'GetSearchResult'
    const query = `query ${expectedName} {
      search(contains: "Ollies") {
        __typename
        ... on Book {
          title
        }
      }
    }`

    const deepestPath = 'search<Book>.title'

    agent.once('transactionFinished', (transaction) => {
      const operationPart = `query/${expectedName}/${deepestPath}`
      const firstSegmentName = baseSegment(operationPart, TRANSACTION_PREFIX)
      const operationSegments = constructOperationSegments(t.nr, [
        `${OPERATION_PREFIX}/${operationPart}`,
        [`${RESOLVE_PREFIX}/search`]
      ])
      const expectedSegments = constructSegments(firstSegmentName, operationSegments)
      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.ifError(err)
      checkResult(assert, result, () => {
        resolve()
      })
    })

    await promise
  }
})

segmentsTests.push({
  name: 'union, multiple inline fragments, single level',
  async fn(t) {
    const { agent, serverUrl, TRANSACTION_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'GetSearchResult'
    const query = `query ${expectedName} {
      search(contains: "Node") {
        __typename
        ... on Magazine {
          title
        }
        ... on Book {
          title
        }
      }
    }`

    const deepestPath = 'search'

    agent.once('transactionFinished', (transaction) => {
      const operationPart = `query/${expectedName}/${deepestPath}`
      const firstSegmentName = baseSegment(operationPart, TRANSACTION_PREFIX)
      const operationSegments = constructOperationSegments(t.nr, [
        `${OPERATION_PREFIX}/${operationPart}`,
        [`${RESOLVE_PREFIX}/search`]
      ])
      const expectedSegments = constructSegments(firstSegmentName, operationSegments)
      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.ifError(err)
      checkResult(assert, result, () => {
        resolve()
      })
    })

    await promise
  }
})

segmentsTests.push({
  name: 'when the query cannot be parsed, should have operation placeholder',
  async fn(t) {
    // there will be no document/AST nor resolved operation
    const { agent, serverUrl, TRANSACTION_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

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
      const firstSegmentName = baseSegment('*', TRANSACTION_PREFIX)
      const operationSegments = constructOperationSegments(t.nr, [
        `${OPERATION_PREFIX}/${UNKNOWN_OPERATION}`
      ])
      const expectedSegments = constructSegments(firstSegmentName, operationSegments)

      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
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

segmentsTests.push({
  name: 'when cannot validate, should include operation segment',
  async fn(t) {
    // if parse succeeds but validation fails, there will not be a resolved operation
    // but the document/AST can still be leveraged for what was intended.
    const { agent, serverUrl, TRANSACTION_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const invalidQuery = `query {
      libraries {
        books {
          doesnotexist {
            name
          }
        }
      }
    }`

    const path = 'libraries.books.doesnotexist.name'

    agent.once('transactionFinished', (transaction) => {
      const operationPart = `query/${ANON_PLACEHOLDER}/${path}`
      const firstSegmentName = baseSegment(operationPart, TRANSACTION_PREFIX)
      const operationSegments = constructOperationSegments(t.nr, [
        `${OPERATION_PREFIX}/${operationPart}`
      ])
      const expectedSegments = constructSegments(firstSegmentName, operationSegments)

      assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })
    })

    executeQuery(serverUrl, invalidQuery, (err, result) => {
      assert.ifError(err)

      assert.ok(result)
      assert.ok(result.errors)
      assert.equal(result.errors.length, 1) // should have one parsing error

      const [parseError] = result.errors
      assert.equal(parseError.extensions.code, 'GRAPHQL_VALIDATION_FAILED')

      resolve()
    })

    await promise
  }
})

for (const defTest of segmentsTests) {
  test(`non-scalar: ${defTest.name}`, async (t) => {
    await setupCoreTest({ t, testDir: __dirname })
    const prefix = semver.gte(t.nr.apolloServerPkg.apolloVersion, '5.0.0')
      ? 'WebTransaction/Nodejs/POST'
      : 'WebTransaction/Expressjs/POST'
    t.nr.TRANSACTION_PREFIX = prefix
    await defTest.fn(t)
  })
}

const agentConfig = { apollo_server: { scalars: true } }
for (const scalarTest of segmentsTests) {
  test(`scalar: ${scalarTest.name}`, async (t) => {
    await setupCoreTest({ t, testDir: __dirname, agentConfig })
    const prefix = semver.gte(t.nr.apolloServerPkg.apolloVersion, '5.0.0')
      ? 'WebTransaction/Nodejs/POST'
      : 'WebTransaction/Expressjs/POST'
    t.nr.TRANSACTION_PREFIX = prefix
    await scalarTest.fn(t)
  })
}

test('skipped scalar segment: async (db-querying) resolver still runs in the operation context', async (t) => {
  // Regression guard for the resolve subscriber's skipped-segment optimization.
  //
  // Under the default config (apollo_server.scalars = false) a non-top-level
  // scalar field creates NO resolve segment, but the subscriber still runs the
  // field's resolver. Most real resolvers query a database (async I/O) before
  // returning, so this must happen inside the operation's async context. The
  // subscriber invokes the skipped resolver directly rather than through
  // tracer.runInContext; this asserts that shortcut preserves the context.
  //
  // To prove context is preserved WITHOUT depending on any auto-instrumentation
  // (timers, datastore, etc. -- which may be removed), the `Book.summary`
  // resolver wraps its simulated database query in a segment created through
  // the public `startSegment` API. `startSegment` nests the segment under
  // whatever segment is active when it runs, so the segment appears under the
  // operation segment only if the resolver ran in the operation context. If the
  // context were lost, `startSegment` would find no active segment and record
  // nothing -- so the segment's presence and position is the proof.
  const DB_SEGMENT_NAME = 'Datastore/statement/Custom/summary/select'
  await setupCoreTest({
    t,
    testDir: __dirname,
    // Provide the resolver a db client that records the query via startSegment.
    // Passed as a factory because the public API only exists once the agent is
    // loaded inside setupCoreTest.
    contextValue() {
      return { dbClient: makeDbClient(helper.getAgentApi(), DB_SEGMENT_NAME) }
    }
  })
  const prefix = semver.gte(t.nr.apolloServerPkg.apolloVersion, '5.0.0')
    ? 'WebTransaction/Nodejs/POST'
    : 'WebTransaction/Expressjs/POST'
  t.nr.TRANSACTION_PREFIX = prefix

  const { agent, serverUrl } = t.nr
  const { promise, resolve } = promiseResolvers()

  const expectedName = 'GetBookSummaries'
  // `libraries` (top-level) and `Library.books` (object field) both keep their
  // segments; `Book.summary` is a non-top-level scalar whose segment is skipped.
  // Only the `summary` resolver does async work, so every db-query segment is
  // unambiguously attributable to the skipped scalar.
  const query = `query ${expectedName} {
    libraries {
      books {
        summary
      }
    }
  }`

  const operationPart = `query/${expectedName}/libraries.books.summary`

  agent.once('transactionFinished', (transaction) => {
    const firstSegmentName = baseSegment(operationPart, prefix)
    const operationSegments = constructOperationSegments(t.nr, [
      `${OPERATION_PREFIX}/${operationPart}`,
      [
        // Kept segments for the object fields.
        `${RESOLVE_PREFIX}/libraries`,
        `${RESOLVE_PREFIX}/libraries.books`,
        // The skipped scalar's resolver runs in the operation context, so the
        // segment it creates for the simulated database query nests directly
        // under the operation segment rather than orphaning. There is no
        // `.../libraries.books.summary` resolve segment (the scalar is skipped),
        // which is why the db-query segment is a direct child of the operation.
        DB_SEGMENT_NAME
      ]
    ])
    const expectedSegments = constructSegments(firstSegmentName, operationSegments)

    assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })

    // Belt-and-suspenders: confirm the skipped scalar produced no resolve
    // segment anywhere in the trace, and that the db-query segment really did
    // run inside a context (i.e. it was recorded at all).
    const segments = []
    const collect = (segment) => {
      segments.push(segment)
      for (const child of transaction.trace.getChildren(segment.id)) {
        collect(child)
      }
    }
    collect(transaction.trace.root)
    const scalarResolveSegment = segments.find(
      (segment) => segment.name === `${RESOLVE_PREFIX}/libraries.books.summary`
    )
    assert.equal(scalarResolveSegment, undefined, 'skipped scalar should not create a resolve segment')
    const dbSegment = segments.find((segment) => segment.name === DB_SEGMENT_NAME)
    assert.ok(dbSegment, 'db-query segment should be recorded (resolver ran inside a context)')
  })

  executeQuery(serverUrl, query, (err, result) => {
    assert.ifError(err)
    checkResult(assert, result, () => {
      resolve()
    })
  })

  await promise
})

test('fragmented trace does not add segments to trace but still records metrics for operation/resolver actions', async (t) => {
  // set the max_trace_segments to 7 to exclude capturing the operation and resolver segments as part of tx trace
  // see: https://github.com/newrelic/newrelic-node-apollo-server-plugin/issues/344
  await setupCoreTest({ t, testDir: __dirname, agentConfig: { max_trace_segments: 7 } })
  const { agent, serverUrl } = t.nr
  const { promise, resolve } = promiseResolvers()
  const expectedName = 'testQuery'
  const query = `query ${expectedName} {
    libraries {
      books {
        title
        author {
          name
        }
      }
    }
  }`

  const path = 'libraries.books'

  agent.once('transactionFinished', (transaction) => {
    const operationPart = `query/${expectedName}/${path}`
    const prefix = semver.gte(t.nr.apolloServerPkg.apolloVersion, '5.0.0')
      ? 'WebTransaction/Nodejs/POST'
      : 'WebTransaction/Expressjs/POST'
    const firstSegmentName = baseSegment(operationPart, prefix)
    const expectedSegments = [firstSegmentName]
    // apollo 4.x includes a handler for the express middleware
    if (prefix.includes('Express')) {
      expectedSegments.push(['Nodejs/Middleware/Expressjs/<anonymous>'])
    }
    // for apollo 5+ there are no express related segments because it doesn't use express
    assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })

    const expectedMetrics = [
      [{ name: `${OPERATION_PREFIX}/${operationPart}` }],
      [{ name: `${RESOLVE_PREFIX}/Query.libraries` }],
      [{ name: `${RESOLVE_PREFIX}/Library.books` }],
      [{ name: `${RESOLVE_PREFIX}/Book.author` }]
    ]

    assertMetrics(transaction.metrics, expectedMetrics, false, false)
  })

  executeQuery(serverUrl, query, (err, result) => {
    assert.ifError(err)
    checkResult(assert, result, resolve)
  })

  await promise
})
