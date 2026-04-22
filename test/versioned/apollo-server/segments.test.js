/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const promiseResolvers = require('../../lib/promise-resolvers')
const { executeQuery, executeQueryBatch } = require('../../lib/apollo/test-client')
const { afterEach, setupCoreTest } = require('../../lib/apollo/test-tools')
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
