/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Simulate a database round-trip: async work that settles on a later tick of
 * the event loop, without depending on any instrumented API (no timers, no
 * datastore module). `setImmediate` is a plain event-loop hop -- the resolver
 * genuinely suspends and resumes, which is what a real query does.
 *
 * @returns {Promise<void>} resolves once the simulated query "returns"
 */
function simulateDbQuery() {
  return new Promise((resolve) => {
    setImmediate(resolve)
  })
}

// The default database client used when a test does not inject its own. It just
// performs the async round-trip; it does not create a segment.
const DEFAULT_DB_CLIENT = {
  querySummary: simulateDbQuery
}

/**
 * Build a database client whose query is wrapped in a New Relic segment created
 * through the public `startSegment` API. Because `startSegment` nests the new
 * segment under whatever segment is active when it is called, the resulting
 * segment's position in the trace reveals which async context the resolver ran
 * in -- and it does so without relying on timer (or any other) instrumentation
 * being enabled. If the resolver runs outside a transaction/context,
 * `startSegment` records nothing, so an absent segment signals lost context.
 *
 * @param {object} api the agent's public API (from `helper.getAgentApi()`)
 * @param {string} segmentName name to give the simulated query's segment
 * @returns {object} a db client (with a `querySummary` method) for the Apollo
 * contextValue
 */
function makeDbClient(api, segmentName) {
  return {
    querySummary() {
      return api.startSegment(segmentName, false, simulateDbQuery)
    }
  }
}

const libraries = [
  {
    branch: 'downtown'
  },
  {
    branch: 'riverside'
  }
]

const books = [
  {
    title: 'Node Agent: The Book',
    isbn: 'a-fake-isbn',
    author: 'Sentient Bits',
    branch: 'riverside',
    category: 'NOVEL'
  },
  {
    title: "Ollies for O11y: A Sk8er's Guide to Observability",
    isbn: 'a-second-fake-isbn',
    author: 'Faux Hawk',
    branch: 'downtown',
    category: 'COOKBOOK'
  },
  {
    title: '[Redacted]',
    isbn: 'a-third-fake-isbn',
    author: 'Closed Telemetry',
    branch: 'riverside',
    category: 'NOVEL'
  },
  {
    title: 'Be a hero: fixing the things you broke',
    isbn: 'a-fourth-fake-isbn',
    author: '10x Developer',
    branch: 'downtown',
    category: 'COOKBOOK'
  },
  {
    title: 'Breaking production for dummies',
    isbn: 'a-fifth-fake-isbn',
    author: '10x Developer',
    branch: 'uptown',
    category: 'TECH'
  }
]

const magazines = [
  {
    title: 'Reli Updates Weekly',
    issue: 1,
    branch: 'riverside'
  },
  {
    title: 'Reli Updates Weekly',
    issue: 2,
    branch: 'downtown'
  },
  {
    title: 'Node Weekly',
    issue: 1,
    branch: 'riverside'
  }
]

const collection = [
  {
    id: Date.now(),
    title: 'True life, I am an o11y fan boy'
  }
]

function getTypeDefs(gql) {
  return gql`
    scalar JSON

    union SearchResult = Book | Magazine

    type Library {
      branch: String!
      books(category: BookCategory): [Book!]
      magazines: [Magazine]
    }

    type Book {
      title: String!
      isbn: String
      author: Author!
      category: BookCategory
      # A scalar field whose resolver must query a database to produce its
      # value. Because it is a non-top-level scalar, under the default config
      # (scalars: false) the resolve subscriber creates NO segment for it, yet
      # still runs this resolver -- see the skipped-segment regression test in
      # the apollo-server segments suite.
      summary: String
    }

    enum BookCategory {
      NOVEL
      COOKBOOK
      TECH
    }

    type Author {
      name: String!
    }

    type Magazine {
      title: String!
      issue: Int
    }

    type Query {
      search(contains: String): [SearchResult!]
      searchByBook(book: BookInput): [Book!]
      books(category: BookCategory): [Book]!
      hello: String
      paramQuery(blah: String!, blee: String): String!
      libraries: [Library]
      library(branch: String!): Library
      searchCollection(title: String): Item!
      # A real GraphQL list argument, for field-metrics tests that exercise
      # collapse_field_metrics against a genuine list.
      booksByIds(ids: [Int!]!): [Book!]!
      # A JSON scalar argument -- not a GraphQL list -- whose keys may look
      # like list indexes (e.g. "2024"). Field-metrics tests use this to show
      # that such a key is a map key, not a list index, even though both end
      # up as numeric-looking segments once the args are flattened.
      booksByCriteria(criteria: JSON!): [Book!]!
    }

    type Item {
      id: String!
      title: String!
    }

    type Mutation {
      addThing(name: String!): String!
      addToCollection(title: String!): Item!
    }

    input BookInput {
      author: AuthorInput
      title: String
    }

    input AuthorInput {
      name: String
    }
  `
}

/**
 * Builds the resolver map. This is a function, rather than a plain object,
 * because the `JSON` scalar needs a `GraphQLScalarType` instance built from
 * the same `graphql` module instance Apollo Server uses to build the schema
 * -- versioned tests run against several major versions of `graphql`, so
 * this must be the version resolved for the test under execution, not
 * whatever one happens to be hoisted at a higher `node_modules`.
 *
 * @param {object} graphql the `graphql` module instance the schema is built with
 * @returns {object} the resolver map
 */
function getResolvers(graphql) {
  const { GraphQLScalarType } = graphql

  // A JSON scalar only needs to round-trip through GraphQL variables for
  // these tests, so `parseLiteral` (inline query literals) is left to its
  // default -- GraphQL's object-literal syntax can't express a numeric key
  // like `2024` anyway, which is exactly why these tests send it as a
  // variable.
  const jsonScalar = new GraphQLScalarType({
    name: 'JSON',
    description: 'An arbitrary JSON value.',
    serialize: (value) => value,
    parseValue: (value) => value
  })

  return {
    JSON: jsonScalar,
    Query: {
      search: (_, { contains }) => {
        const filteredBooks = books.filter((book) => book.title.includes(contains))
        const filteredMagazines = magazines.filter((magazine) => magazine.title.includes(contains))
        return [...filteredBooks, ...filteredMagazines]
      },
      hello: () => 'hello world',
      paramQuery: (_, { blah, blee }) => blah + blee,
      libraries: () => libraries,
      library: (_, { branch }) => new Promise((resolve) => {
        setTimeout(() => {
          const filtered = libraries.find((library) => library.branch === branch)
          resolve(filtered)
        }, 0)
      }),
      searchCollection: (_, { title }) => {
        const item = collection.filter((coll) => coll.title.includes(title))
        return item[0]
      },
      searchByBook: (_, { book: searchBook }) => {
        const filteredBooks = books.filter((book) => book.author === searchBook.author.name)
        if (searchBook.title) {
          return filteredBooks.filter((book) => book.title === searchBook.title)
        }

        return filteredBooks
      },
      booksByIds: (_, { ids }) => ids.map((id) => books[id]).filter(Boolean),
      booksByCriteria: (_, { criteria }) => {
        const wantedCategories = Object.values(criteria)
        return books.filter((book) => wantedCategories.includes(book.category))
      }
    },
    Mutation: {
      addThing: async (_, { name }) => {
        const promise = new Promise((resolve) => {
          setTimeout(function namedCallback() {
            resolve(name)
          }, 1)
        })
        return await promise
      },
      addToCollection: async (_, { title }) => await new Promise((resolve) => {
        const id = Date.now()
        collection.push({ id, title })
        resolve({ id })
      })
    },
    Library: {
      books(parent) {
        return books.filter((book) => book.branch === parent.branch)
      },
      magazines(parent) {
        return magazines.filter((magazine) => magazine.branch === parent.branch)
      }
    },
    Book: {
      author(parent) {
        return {
          name: parent.author
        }
      },
      // Simulates a resolver that queries a database (async I/O) before returning
      // its scalar value, the way most real resolvers do. The database client is
      // provided via the Apollo `contextValue` (the resolver's third argument),
      // as it would be in a real application. Tests that care about where the
      // query runs inject a client that records a segment through the agent's
      // public API (see `makeDbClient`); everything else gets a plain async
      // client. The value is returned regardless.
      async summary(parent, _args, context) {
        const dbClient = context?.dbClient ?? DEFAULT_DB_CLIENT
        await dbClient.querySummary()
        return `${parent.title} by ${parent.author}`
      }
    },
    SearchResult: {
      __resolveType(obj) {
        if (obj.issue) {
          return 'Magazine'
        }
        if (obj.isbn) {
          return 'Book'
        }
        return null // GraphQLError is thrown
      }
    }
  }
}

module.exports = {
  getTypeDefs,
  getResolvers,
  makeDbClient
}
