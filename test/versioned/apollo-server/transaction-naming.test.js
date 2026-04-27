/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const semver = require('semver')
const { afterEach, setupCoreTest } = require('../../lib/apollo/test-tools')
const assert = require('node:assert')
const { executeQuery, executeQueryBatch } = require('../../lib/apollo/test-client')
const { checkResult } = require('../../lib/apollo/common')
const promiseResolvers = require('../../lib/promise-resolvers')

const ANON_PLACEHOLDER = '<anonymous>'
const transactionNamingTests = []
const introspectionQueries = [
  `{
    __schema {
      queryType {
        fields {
          name
        }
      }
    }
  }`,
  `query introspectionType {
    __type(name: "Library") {
      fields {
        name
      }
    }
  }`
]

transactionNamingTests.push({
  name: 'anonymous query, single level, should use anonymous placeholder',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const query = `query {
      hello
    }`

    agent.once('transactionFinished', (transaction) => {
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//query/${ANON_PLACEHOLDER}/hello`)
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

transactionNamingTests.push({
  name: 'named query, single level, should use query name',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'HeyThere'
    const query = `query ${expectedName} {
      hello
    }`

    agent.once('transactionFinished', (transaction) => {
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//query/${expectedName}/hello`)
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

transactionNamingTests.push({
  name: 'Federated Server health check query with only __typename in selection set should omit deepest unique path',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = '__ApolloServiceHealthCheck__'
    const query = `query ${expectedName} { __typename }`

    agent.once('transactionFinished', (transaction) => {
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//query/${expectedName}`)
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

transactionNamingTests.push({
  name: 'Nested queries with arguments',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const query = `query {
      library(branch: "riverside") {
        magazines {
          title
        },
        books(category: NOVEL) {
          title
        }
      }
    }`

    const path = 'library'

    agent.once('transactionFinished', (transaction) => {
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//query/${ANON_PLACEHOLDER}/${path}`)
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

transactionNamingTests.push({
  name: 'anonymous query, multi-level should return deepest unique path',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
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
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//query/${ANON_PLACEHOLDER}/${path}`)
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

transactionNamingTests.push({
  name: 'anonymous query, only returns reserved field(id) should return deepest unique path',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const query = `query {
        searchCollection(title: "True life") {
          id
        }
      }`

    agent.once('transactionFinished', (transaction) => {
      assert.equal(
        transaction.name,
        `${EXPECTED_PREFIX}//query/${ANON_PLACEHOLDER}/searchCollection`
      )
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

transactionNamingTests.push({
  name: 'named query, multi-level should return deepest unique path',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
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
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//query/${expectedName}/${path}`)
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

transactionNamingTests.push({
  name: 'named query, multi-level with aliases should ignore aliases in naming',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'GetBooksByLibrary'
    const query = `query ${expectedName} {
      libAlias: libraries {
        bookAlias: books {
          title
          author {
            name
          }
        }
      }
    }`

    const path = 'libraries.books'

    agent.once('transactionFinished', (transaction) => {
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//query/${expectedName}/${path}`)
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

transactionNamingTests.push({
  name: 'anonymous mutation, single level, reserved field, should use anonymous placeholder',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const query = `mutation {
        addToCollection(title: "Don Quixote") {
          id
        }
      }`

    agent.once('transactionFinished', (transaction) => {
      assert.equal(
        transaction.name,
        `${EXPECTED_PREFIX}//mutation/${ANON_PLACEHOLDER}/addToCollection`
      )
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

transactionNamingTests.push({
  name: 'anonymous mutation, single level, should use anonymous placeholder',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const query = `mutation {
      addThing(name: "added thing!")
    }`

    agent.once('transactionFinished', (transaction) => {
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//mutation/${ANON_PLACEHOLDER}/addThing`)
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

transactionNamingTests.push({
  name: 'named mutation, single level, reserved field, should use mutation name',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'addIt'
    const query = `mutation ${expectedName} {
      addToCollection(title: "Don Quixote") {
        id
      }
    }`

    agent.once('transactionFinished', (transaction) => {
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//mutation/${expectedName}/addToCollection`)
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

transactionNamingTests.push({
  name: 'named mutation, single level, should use mutation name',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'AddThing'
    const query = `mutation ${expectedName} {
      addThing(name: "added thing!")
    }`

    agent.once('transactionFinished', (transaction) => {
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//mutation/${expectedName}/addThing`)
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

transactionNamingTests.push({
  name: 'anonymous query, with params, should use anonymous placeholder',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const query = `query {
      paramQuery(blah: "blah", blee: "blee")
    }`

    agent.once('transactionFinished', (transaction) => {
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//query/${ANON_PLACEHOLDER}/paramQuery`)
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

transactionNamingTests.push({
  name: 'named query, with params, should use query name',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'BlahQuery'
    const query = `query ${expectedName} {
      paramQuery(blah: "blah")
    }`

    agent.once('transactionFinished', (transaction) => {
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//query/${expectedName}/paramQuery`)
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

transactionNamingTests.push({
  name: 'named query, with params, should return deepest unique path',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
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
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//query/${expectedName}/${path}`)
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

transactionNamingTests.push({
  name: 'batch query should include "batch" all queries separated by delimeter',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
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
      const expectedQuery1Name = `query/${expectedName1}/${path1}`
      const expectedQuery2Name = `mutation/${ANON_PLACEHOLDER}/addThing`
      assert.equal(
        transaction.name,
        `${EXPECTED_PREFIX}//batch/${expectedQuery1Name}/${expectedQuery2Name}`
      )
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

transactionNamingTests.push({
  name: 'union, should return deepest unique path',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
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
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//query/${expectedName}/${deepestPath}`)
    })

    const expectedResult = [
      {
        __typename: 'Book',
        title: "Ollies for O11y: A Sk8er's Guide to Observability"
      }
    ]
    executeQuery(serverUrl, query, (err, result) => {
      assert.ifError(err)
      assert.deepStrictEqual(
        result.data.search,
        expectedResult,
        'should return expected results with union search query'
      )
      checkResult(assert, result, () => {
        resolve()
      })
    })

    await promise
  }
})

transactionNamingTests.push({
  name: 'union, multiple inline fragments, should return deepest unique path',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
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
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//query/${expectedName}/${deepestPath}`)
    })

    const expectedResult = [
      { __typename: 'Book', title: 'Node Agent: The Book' },
      { __typename: 'Magazine', title: 'Node Weekly' }
    ]
    executeQuery(serverUrl, query, (err, result) => {
      assert.deepStrictEqual(
        result.data.search,
        expectedResult,
        'should return expected results with union search query'
      )
      assert.ifError(err)
      checkResult(assert, result, () => {
        resolve()
      })
    })

    await promise
  }
})

transactionNamingTests.push({
  name: 'named query with fragment, query first',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
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
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//query/${expectedName}/${path}`)
    })

    executeQuery(serverUrl, query, (err) => {
      assert.ifError(err)
      resolve()
    })

    await promise
  }
})

transactionNamingTests.push({
  name: 'named query with fragment, fragment first',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
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
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//query/${expectedName}/${path}`)
    })

    executeQuery(serverUrl, query, (err) => {
      assert.ifError(err)
      resolve()
    })

    await promise
  }
})

transactionNamingTests.push({
  name: 'if the query cannot be parsed, should be named /*',
  async fn(t) {
    // there will be no document/AST nor resolved operation
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
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
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//*`)
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

transactionNamingTests.push({
  name: 'anonymous query, when cant validate, should use document/AST',
  async fn(t) {
    // if parse succeeds but validation fails, there will not be a resolved operation
    // but the document/AST can still be leveraged for what was intended.
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
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
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//query/${ANON_PLACEHOLDER}/${path}`)
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

transactionNamingTests.push({
  name: 'named query, when cant validate, should use document/AST',
  async fn(t) {
    // if parse succeeds but validation fails, there will not be a resolved operation
    // but the document/AST can still be leveraged for what was intended.
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'FailsToValidate'
    const invalidQuery = `query ${expectedName} {
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
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//query/${expectedName}/${path}`)
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

transactionNamingTests.push({
  name: 'multiple queries do not affect transaction naming',
  async fn(t) {
    const { agent, serverUrl, EXPECTED_PREFIX } = t.nr
    const { promise, resolve } = promiseResolvers()

    const expectedName = 'HeyThere'
    const query = `query ${expectedName} {
      hello
    }`
    let count = 0

    const transactionHandler = (transaction) => {
      assert.equal(transaction.name, `${EXPECTED_PREFIX}//query/${expectedName}/hello`)
      count++
    }

    agent.on('transactionFinished', transactionHandler)
    t.after(() => {
      agent.removeListener('transactionFinished', transactionHandler)
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.ifError(err)
      checkResult(assert, result, () => {
        executeQuery(serverUrl, query, (err2, result2) => {
          assert.ifError(err2)
          checkResult(assert, result2, () => {
            assert.equal(count, 2, 'should have checked 2 transactions')
            resolve()
          })
        })
      })
    })

    await promise
  }
})

generateIntrospectionTests({ captureIntrospection: true, ignore: false })
generateIntrospectionTests({ captureIntrospection: false, ignore: true })

function generateIntrospectionTests({ ignore, captureIntrospection }) {
  for (const query of introspectionQueries) {
    transactionNamingTests.push({
      name: `should ${
        ignore ? '' : 'not '
      }ignore transaction when captureIntrospectionQuery is ${captureIntrospection} and query contains introspection types`,
      async fn(t) {
        const { agent, serverUrl } = t.nr
        agent.config.apollo_server.introspection_queries = captureIntrospection
        const { promise, resolve } = promiseResolvers()

        agent.once('transactionFinished', (transaction) => {
          assert.equal(transaction.ignore, ignore, `should set transaction.ignore to ${ignore}`)
        })

        executeQuery(serverUrl, query, (err) => {
          assert.ifError(err)
          resolve()
        })

        await promise
      }
    })

    transactionNamingTests.push({
      name: `should not ignore transaction when captureIntrospectionQuery is ${captureIntrospection} and query does not contain an introspection type`,
      async fn(t) {
        const { agent, serverUrl } = t.nr
        const { promise, resolve } = promiseResolvers()
        agent.config.apollo_server.introspection_queries = captureIntrospection

        agent.once('transactionFinished', (transaction) => {
          assert.equal(
            transaction.ignore,
            false,
            'should set transaction.ignore to false when not an introspection type'
          )
        })

        const query = `query GetAllForLibrary {
        library(branch: "downtown") {
          books {
            title
          }
        }
      }`
        executeQuery(serverUrl, query, (err) => {
          assert.ifError(err)
          resolve()
        })

        await promise
      }
    })
  }
}

test.afterEach(async (ctx) => {
  await afterEach({ t: ctx, testDir: __dirname })
})

for (const txTest of transactionNamingTests) {
  test(txTest.name, async (t) => {
    await setupCoreTest({ t, testDir: __dirname })
    const prefix = semver.gte(t.nr.apolloServerPkg.apolloVersion, '5.0.0')
      ? 'WebTransaction/Nodejs/POST'
      : 'WebTransaction/Expressjs/POST'
    t.nr.EXPECTED_PREFIX = prefix
    await txTest.fn(t)
  })
}
