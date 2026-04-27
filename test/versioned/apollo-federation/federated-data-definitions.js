/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/* --- Example Query ---
query MyQuery {
  libraries {
    branch
    booksInStock {
      isbn,
      title,
      author
    }
    magazinesInStock {
      issue,
      title
    }
  }
}
*/

const libraries = [
  {
    id: '1',
    branch: 'downtown'
  },
  {
    id: '2',
    branch: 'riverside'
  },
  {
    id: '3',
    branch: 'northwest crossing'
  },
  {
    id: '4',
    branch: 'east'
  }
]

function _getLibraryTypeDef(gql) {
  return gql`
    type Library @key(fields: "id") {
      id: ID!
      branch: String
    }

    extend type Query {
      library(id: ID!): Library
      libraries: [Library]
    }
  `
}

// https://www.apollographql.com/docs/federation/api/apollo-subgraph/#__resolvereference
function _getLibraryResolvers() {
  return {
    Library: {
      __resolveReference(reference) {
        return libraries.find((library) => library.id === reference.id)
      }
    },
    Query: {
      library(_, { id }) {
        return libraries.find((library) => library.id === id)
      },
      libraries() {
        return libraries
      }
    }
  }
}

const books = [
  {
    title: 'Node Agent: The Book',
    isbn: 'a-fake-isbn',
    author: 'Sentient Bits',
    branch: '2'
  },
  {
    title: "Ollies for O11y: A Sk8er's Guide to Observability",
    isbn: 'a-second-fake-isbn',
    author: 'Faux Hawk',
    branch: '1'
  },
  {
    title: '[Redacted]',
    isbn: 'a-third-fake-isbn',
    author: 'Closed Telemetry',
    branch: '2'
  },
  {
    title: 'Be a hero: fixing the things you broke',
    isbn: 'a-fourth-fake-isbn',
    author: '10x Developer',
    branch: '1'
  }
]

function _getBookTypeDef(gql) {
  return gql`
    type Book {
      isbn: ID!
      title: String
      author: String
      branch: Library
    }

    extend type Library @key(fields: "id") {
      id: ID! @external
      booksInStock: [Book]
    }

    extend type Query {
      book(isbn: ID!): Book
      books: [Book]
    }
  `
}

function _getBookResolvers() {
  return {
    Book: {
      branch(parent) {
        return { __typename: 'Library', id: parent.branch }
      }
    },
    Library: {
      booksInStock(parent) {
        return books.filter((book) => book.branch === parent.id)
      }
    },
    Query: {
      book(_, { isbn }) {
        return books.find((book) => book.isbn === isbn)
      },
      books() {
        return books
      }
    }
  }
}

const magazines = [
  {
    title: 'Reli Updates Weekly',
    issue: 1,
    branch: '2'
  },
  {
    title: 'Reli Updates Weekly',
    issue: 2,
    branch: '1'
  }
]

function _getMagazineTypeDef(gql) {
  return gql`
    type Magazine {
      issue: ID!
      title: String
      branch: Library
    }

    extend type Library @key(fields: "id") {
      id: ID! @external
      magazinesInStock: [Magazine]
    }

    extend type Query {
      magazine(issue: ID!): Magazine
      magazines: [Magazine]
    }
  `
}

function _getMagazineResolvers() {
  return {
    Magazine: {
      branch(parent) {
        return { __typename: 'Library', id: parent.branch }
      }
    },
    Library: {
      magazinesInStock(parent) {
        return magazines.filter((magazine) => magazine.branch === parent.id)
      }
    },
    Query: {
      magazine(_, { issue }) {
        return magazines.find((magazine) => magazine.issue === issue)
      },
      magazines() {
        return magazines
      }
    }
  }
}

function getLibraryConfiguration(gql) {
  return {
    name: 'Library',
    typeDefs: _getLibraryTypeDef(gql),
    resolvers: _getLibraryResolvers()
  }
}

function getBookConfiguration(gql) {
  return {
    name: 'Book',
    typeDefs: _getBookTypeDef(gql),
    resolvers: _getBookResolvers()
  }
}

function getMagazineConfiguration(gql) {
  return {
    name: 'Magazine',
    typeDefs: _getMagazineTypeDef(gql),
    resolvers: _getMagazineResolvers()
  }
}

module.exports = {
  getLibraryConfiguration,
  getBookConfiguration,
  getMagazineConfiguration
}
