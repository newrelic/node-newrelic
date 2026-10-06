/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { executeQuery, executeQueryBatch } = require('../../lib/apollo/test-client')
const { afterEach, setupCoreTest } = require('../../lib/apollo/test-tools')
const { makeDbClient } = require('../../lib/apollo/data-definitions')
const {
  checkResult,
  baseSegment,
  constructSegments,
  constructOperationSegments,
  collectSegments
} = require('../../lib/apollo/common')
const assert = require('node:assert')
const semver = require('semver')
const { assertSegments, assertMetrics, assertPackageMetrics } = require('../../lib/custom-assertions')

const ANON_PLACEHOLDER = '<anonymous>'
const UNKNOWN_OPERATION = '<unknown>'
const OPERATION_PREFIX = 'GraphQL/operation/ApolloServer'
const RESOLVE_PREFIX = 'GraphQL/resolve/ApolloServer'
const FIELD_PREFIX = 'GraphQL/field/ApolloServer'
const SPAN_DESTINATION = 0x10

test.afterEach(async (ctx) => {
  await afterEach({ t: ctx, testDir: __dirname })
})

const segmentsTests = []

segmentsTests.push({
  name: 'anonymous query, single level',
  async fn(t) {
    const { agent, serverUrl, TRANSACTION_PREFIX, apolloServerPkg } = t.nr
    const { promise, resolve } = Promise.withResolvers()

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
    const { promise, resolve } = Promise.withResolvers()

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
    const { promise, resolve } = Promise.withResolvers()

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
    const { promise, resolve } = Promise.withResolvers()

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
    const { promise, resolve } = Promise.withResolvers()

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
    const { promise, resolve } = Promise.withResolvers()

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
    const { promise, resolve } = Promise.withResolvers()

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
    const { promise, resolve } = Promise.withResolvers()

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
    const { promise, resolve } = Promise.withResolvers()

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
    const { promise, resolve } = Promise.withResolvers()

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
    const { promise, resolve } = Promise.withResolvers()

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
    const { promise, resolve } = Promise.withResolvers()

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
    const { promise, resolve } = Promise.withResolvers()

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
    const { promise, resolve } = Promise.withResolvers()

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
    const { promise, resolve } = Promise.withResolvers()

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
    const { promise, resolve } = Promise.withResolvers()

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
    const { promise, resolve } = Promise.withResolvers()

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
    const { promise, resolve } = Promise.withResolvers()

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
  const { promise, resolve } = Promise.withResolvers()

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
    const segments = collectSegments(transaction.trace)
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

test('resolver filter callback: overrides default scalar-only skip logic', async (t) => {
  // Regression guard for https://github.com/newrelic/node-newrelic/issues/4309 --
  // a filter callback must be able to fully replace the built-in skip logic so
  // that only top-level (Query/Mutation) fields get a resolve segment, even
  // though `libraries`/`books`/`author` are non-scalar object fields that the
  // built-in logic would otherwise always keep.
  await setupCoreTest({ t, testDir: __dirname })
  const prefix = semver.gte(t.nr.apolloServerPkg.apolloVersion, '5.0.0')
    ? 'WebTransaction/Nodejs/POST'
    : 'WebTransaction/Expressjs/POST'
  t.nr.TRANSACTION_PREFIX = prefix
  const { agent, serverUrl, TRANSACTION_PREFIX } = t.nr

  helper.getAgentApi().setApolloResolverFilterCallback(
    ({ info }) => info.parentType.name === 'Query' || info.parentType.name === 'Mutation'
  )

  const { promise, resolve } = Promise.withResolvers()

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
    const operationSegments = constructOperationSegments(t.nr, [
      `${OPERATION_PREFIX}/${operationPart}`,
      [`${RESOLVE_PREFIX}/libraries`]
    ])
    const expectedSegments = constructSegments(firstSegmentName, operationSegments)

    assertSegments(transaction.trace, transaction.trace.root, expectedSegments, { exact: false })

    const segments = collectSegments(transaction.trace)
    for (const name of [
      `${RESOLVE_PREFIX}/libraries.books`,
      `${RESOLVE_PREFIX}/libraries.books.title`,
      `${RESOLVE_PREFIX}/libraries.books.author`,
      `${RESOLVE_PREFIX}/libraries.books.author.name`
    ]) {
      assert.equal(
        segments.find((segment) => segment.name === name),
        undefined,
        `${name} should not create a resolve segment when filtered out`
      )
    }
  })

  executeQuery(serverUrl, query, (err, result) => {
    assert.ifError(err)
    checkResult(assert, result, () => {
      resolve()
    })
  })

  await promise
})

/**
 * @param {string} apolloVersion the resolved `@apollo/server` version under test
 * @returns {string} the expected transaction name prefix for that version
 */
function transactionPrefix(apolloVersion) {
  return semver.gte(apolloVersion, '5.0.0')
    ? 'WebTransaction/Nodejs/POST'
    : 'WebTransaction/Expressjs/POST'
}

test('resolver filter callback: a throwing callback fails safe by keeping the segment', async (t) => {
  // If the user's filter callback throws, that's a bug in their code, not ours --
  // it must not break the actual GraphQL resolution, and the safe default is to
  // keep instrumenting (rather than silently going dark for that field).
  await setupCoreTest({ t, testDir: __dirname })
  t.nr.TRANSACTION_PREFIX = transactionPrefix(t.nr.apolloServerPkg.apolloVersion)
  const { agent, serverUrl } = t.nr

  helper.getAgentApi().setApolloResolverFilterCallback(() => {
    throw new Error('boom')
  })

  const { promise, resolve } = Promise.withResolvers()

  const query = `query {
    libraries {
      books {
        author {
          name
        }
      }
    }
  }`

  agent.once('transactionFinished', (transaction) => {
    const segments = collectSegments(transaction.trace)
    for (const name of [
      `${RESOLVE_PREFIX}/libraries`,
      `${RESOLVE_PREFIX}/libraries.books`,
      `${RESOLVE_PREFIX}/libraries.books.author`,
      `${RESOLVE_PREFIX}/libraries.books.author.name`
    ]) {
      assert.ok(
        segments.some((segment) => segment.name === name),
        `${name} should still be created when the filter callback throws (fail safe)`
      )
    }
  })

  executeQuery(serverUrl, query, (err, result) => {
    assert.ifError(err)
    checkResult(assert, result, () => {
      resolve()
    })
  })

  await promise
})

test('resolver filter callback: receives source, args, and contextValue', async (t) => {
  await setupCoreTest({ t, testDir: __dirname, contextValue: { marker: 'filter-test' } })
  t.nr.TRANSACTION_PREFIX = transactionPrefix(t.nr.apolloServerPkg.apolloVersion)
  const { agent, serverUrl } = t.nr

  helper.getAgentApi().setApolloResolverFilterCallback(({ source, args, contextValue, info }) => {
    const { fieldName, parentType } = info

    if (parentType.name === 'Query' && fieldName === 'library') {
      return args.branch === 'downtown'
    }
    if (parentType.name === 'Library' && fieldName === 'books') {
      return contextValue?.marker === 'filter-test'
    }
    if (parentType.name === 'Book' && fieldName === 'author') {
      return source?.branch === 'downtown'
    }
    // Everything else, e.g. `Author.name`, is filtered out.
    return false
  })

  const { promise, resolve } = Promise.withResolvers()

  const query = `query {
    library(branch: "downtown") {
      books {
        author {
          name
        }
      }
    }
  }`

  agent.once('transactionFinished', (transaction) => {
    const segments = collectSegments(transaction.trace)
    for (const name of [
      `${RESOLVE_PREFIX}/library`,
      `${RESOLVE_PREFIX}/library.books`,
      `${RESOLVE_PREFIX}/library.books.author`
    ]) {
      assert.ok(
        segments.some((segment) => segment.name === name),
        `${name} should be kept -- proves args/contextValue/source reached the callback`
      )
    }
    assert.equal(
      segments.find((segment) => segment.name === `${RESOLVE_PREFIX}/library.books.author.name`),
      undefined,
      'Author.name should be filtered out by the fallthrough `return false`'
    )
  })

  executeQuery(serverUrl, query, (err, result) => {
    assert.ifError(err)
    checkResult(assert, result, () => {
      resolve()
    })
  })

  await promise
})

test('resolver filter callback: can keep a segment the default scalar logic would otherwise skip', async (t) => {
  // The default config (apollo_server.scalars: false) never creates a segment for
  // a non-top-level scalar field. A registered filter callback is the sole
  // authority on the decision, so returning `true` must override that default.
  await setupCoreTest({ t, testDir: __dirname })
  t.nr.TRANSACTION_PREFIX = transactionPrefix(t.nr.apolloServerPkg.apolloVersion)
  const { agent, serverUrl } = t.nr

  helper.getAgentApi().setApolloResolverFilterCallback(() => true)

  const { promise, resolve } = Promise.withResolvers()

  const query = `query {
    libraries {
      books {
        author {
          name
        }
      }
    }
  }`

  agent.once('transactionFinished', (transaction) => {
    const segments = collectSegments(transaction.trace)
    assert.ok(
      segments.some((segment) => segment.name === `${RESOLVE_PREFIX}/libraries.books.author.name`),
      'a filter callback returning true should create a segment for a scalar field even though apollo_server.scalars defaults to false'
    )
  })

  executeQuery(serverUrl, query, (err, result) => {
    assert.ifError(err)
    checkResult(assert, result, () => {
      resolve()
    })
  })

  await promise
})

test('resolver filter callback: field metrics are captured independently of the filter decision', async (t) => {
  await setupCoreTest({ t, testDir: __dirname, agentConfig: { apollo_server: { field_metrics: true } } })
  t.nr.TRANSACTION_PREFIX = transactionPrefix(t.nr.apolloServerPkg.apolloVersion)
  const { agent, serverUrl } = t.nr

  helper.getAgentApi().setApolloResolverFilterCallback(
    ({ info }) => info.parentType.name === 'Query' || info.parentType.name === 'Mutation'
  )

  const { promise, resolve } = Promise.withResolvers()

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
    const filteredResolveNames = [
      `${RESOLVE_PREFIX}/Library.books`,
      `${RESOLVE_PREFIX}/Book.title`,
      `${RESOLVE_PREFIX}/Book.author`,
      `${RESOLVE_PREFIX}/Author.name`
    ]
    const segments = collectSegments(transaction.trace)
    for (const name of filteredResolveNames) {
      assert.equal(
        segments.find((segment) => segment.name === name),
        undefined,
        `${name} should not create a resolve segment when filtered out`
      )
      assert.equal(
        transaction.metrics.getMetric(name),
        undefined,
        `${name} resolve metric should not exist when the segment is filtered out`
      )
    }

    const expectedMetrics = [
      [{ name: `${OPERATION_PREFIX}/query/${ANON_PLACEHOLDER}/${path}` }],
      [{ name: `${RESOLVE_PREFIX}/Query.libraries` }],
      [{ name: `${FIELD_PREFIX}/Query.libraries` }],
      [{ name: `${FIELD_PREFIX}/Library.books` }],
      [{ name: `${FIELD_PREFIX}/Book.title` }],
      [{ name: `${FIELD_PREFIX}/Book.author` }],
      [{ name: `${FIELD_PREFIX}/Author.name` }]
    ]
    assertMetrics(transaction.metrics, expectedMetrics, false, false)
  })

  executeQuery(serverUrl, query, (err, result) => {
    assert.ifError(err)
    checkResult(assert, result, () => {
      resolve()
    })
  })

  await promise
})

test('resolver filter callback: composes with the resolver attributes callback', async (t) => {
  await setupCoreTest({ t, testDir: __dirname })
  t.nr.TRANSACTION_PREFIX = transactionPrefix(t.nr.apolloServerPkg.apolloVersion)
  const { agent, serverUrl } = t.nr

  const api = helper.getAgentApi()
  api.setApolloResolverFilterCallback(
    ({ info }) => info.parentType.name === 'Query' || info.parentType.name === 'Library'
  )
  api.setApolloResolverAttributesCallback(({ source, args, info }) => {
    return {
      args: Object.keys(args).join(','),
      returnType: info.returnType.name,
      sourceBranch: source?.branch
    }
  })

  const { promise, resolve } = Promise.withResolvers()

  const query = `query {
    library(branch: "downtown") {
      books {
        author {
          name
        }
      }
    }
  }`

  agent.once('transactionFinished', (transaction) => {
    const segments = collectSegments(transaction.trace)

    const booksSegment = segments.find((segment) => segment.name === `${RESOLVE_PREFIX}/library.books`)
    assert.ok(booksSegment, 'kept segment should still exist')
    const customAttrs = booksSegment.getSpanContext().customAttributes.get(SPAN_DESTINATION)
    assert.deepEqual(
      customAttrs,
      { args: '', sourceBranch: 'downtown' },
      'the resolver attributes callback should still run normally on a segment the filter callback kept'
    )

    assert.equal(
      segments.find((segment) => segment.name === `${RESOLVE_PREFIX}/library.books.author`),
      undefined,
      'Book.author should be filtered out'
    )
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
  const { promise, resolve } = Promise.withResolvers()
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
