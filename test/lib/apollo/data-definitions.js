/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

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

const resolvers = {
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

module.exports = {
  getTypeDefs,
  resolvers
}
