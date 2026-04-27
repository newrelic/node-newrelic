# Transactions

```
query {
  libraries {
    books {
      title
      author {
        name
      }
    }
  }
}
```

`post /query/<anonymous>/libraries.books`

---

Transactions are captured as web transactions, associated with the underlying framework (Express, Koa, etc.), and named based on the GraphQL operations executed.

We leverage several details in a transaction name to attempt to mostly group unique query representations: http method, operation type, operation name and the deepest path resolved (the first, if multiple).

The raw representation of a transaction looks like the following: `/WebTransaction/{framework-name}/POST//{operation-type}/{operation-name}/{deepest-unique-path}`

For an Express usage of Apollo Server, that may look like: `/WebTransaction/Expressjs/POST//query/<anonymous>/libraries.books`

The transaction on New Relic One will ultimately display similar to: `post /query/<anonymous>/libraries.books`.

## Details

### Http Method

Http method/verb for the web request. Data may be requested via GET or POST and is surfaced to differentiate similar to other web transactions.

### Operation Type

Indicates if the operation was a query or a mutation.

### Operation Name

The operation name when provided or `<anonymous>`.

`query { libraries }` would use the operation name '<anonymous>' because a name was not provided.

A named query such as `query GetLibraries { libraries }` would use the operation name `GetLibraries'.

### Deepest Unique Path

The deepest path included in the selection set of a query where only one field was selected at each level. Since operation names may be reused, this helps further determine uniqueness of a given operation.

We use the deepest unique path (instead of deepest path like prior) to avoid making arbitrary decision in naming, which may imply/hide details of what could cause slowness for an application.

For the query:

```
query {
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
```

We will select a deepest unique path of 'libraries' as we select multiple fields beyond that point. Any resolver executed beyond that point may contribute to the performance characteristics of the transaction.

If the query were to only select one field per resolver, we select the full path as each selection set is unique.

The query:

```
query {
  libraries {
    booksInStock {
      title
    }
  }
}
```

Will result in the deepest unique path: 'libraries.booksInStock.title'.

`id` and `__typename` fields are automatically excluded from the naming decision.

For example, a federated sub graph query:

```
query {
  libraries {
    branch
    __typename
    id
  }
}
```

Would result in the deepest unique path of: 'libraries.branch'.

## Union Types and Inline Fragments

For Union types which utilize Inline Fragments, the transaction name will use `< ... >` brackets to indicate the underlying selected field for the Union query if only one result is specified in the query.

For the following schema:
```
union SearchResult = Book | Author

type Book {
  title: String!
}

type Author {
  name: String!
}

type Query {
  search(contains: String): [SearchResult!]
}
```

and the following query:

```
query example {
  search(contains: "author") {
    __typename
    ... on Author {
      name
    }
  }
}
```

Would result in the following transaction name:

`post /query/example/search<Author>.name`

However, if the query is returning both Book and Author:

```
query example {
  search(contains: "author") {
    __typename
    ... on Author {
      name
    }
    ... on Book {
      title
    }
  }
}
```

The resulting transaction name would be:

`post /query/example/search`

## Naming on Error

Errors parsing or validating a GraphQL request can impact transaction naming.

### Validation Errors

If a request was able to parse, but was not able to validate, we will name the transaction off what was attempted to be queried. For example: when a field in the incoming GraphQL query does not exist.

In this situation, we'll leverage the parsed document to indicate each of the intended pieces including calculating the deepest path intended.

Below is an example of querying for a field that does not exist (`doesnotexist`) and what that may look like in NR One.

```
query GetBooksByLibrary {
  libraries {
    books {
      doesnotexist {
        name
      }
    }
  }
}
```

`post /query/GetBooksByLibrary/libraries.books.doesnotexist.name`

### Parsing Errors

If a requested operation cannot be parsed, we will name the transaction using a wildcard (*) in place of the usual operation pieces. In this situation, the query is invalid and we do not know if we have any tangible pieces to safely go off of.

Below is an example missing a closing `}` that cannot parse and what that may look like in NR One.

```
query GetBooksByLibrary {
  libraries {
    books {
      title
      author {
        name
      }
    }
  }
// missing closing }
```

`post /*`

In these situations, the `query` attribute on the operation span associated with the error is the best way to identify the particular offender.

### Batch Queries

Apollo Server allows the sending of batch queries. In these situations, there are multiple operation/queries in play to impact naming.

To continue to best uniquely identify transaction groupings, we aggregate the operation names after an additional `/batch` indicator. These names are likely to be quite long. We are considering dropping the deepest unique path from these names but are currently maintaining consistency.

Below is an example of a batch query and what that may look like in NR One.

```
[
  {
    query: query GetBookForLibrary {
      library(branch: "downtown") {
        books {
          title
          author {
            name
          }
        }
      }
    }
  },
  {
    query: mutation {
      addThing(name: "added thing!")
    }
  }
]
```

`post /batch/query/GetBookForLibrary/library.books/mutation/<anonymous>/addThing`

Here you see `batch/` followed by `query/GetBookForLibrary/library.books` and `mutation/<anonymous>/addThing`.
