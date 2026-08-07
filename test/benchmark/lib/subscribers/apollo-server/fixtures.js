/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/*
 * Fixtures for the apollo-server resolve subscriber benchmark.
 *
 * The resolve subscriber's hot path (`wrapResolve` and its helpers) only reads
 * a small, duck-typed slice of a GraphQL resolver `info` object:
 *
 *   - info.path       a `{ key, prev }` linked list (built by graphql-js)
 *   - info.fieldName  the field's name
 *   - info.returnType a type instance; the code inspects `constructor.name`
 *                     (=== 'GraphQLScalarType' / 'GraphQLNonNull'), `.ofType`,
 *                     and `.toString()`
 *   - info.parentType a type instance; the code reads `.name` and `.toString()`
 *
 * Rather than pull in the (peer-only) `graphql` package, we build minimal
 * fakes whose `constructor.name` matches what `isScalarType` /
 * `isNonNullScalarType` check for. This keeps the benchmark a true unit-level
 * microbenchmark of the subscriber code, with no @apollo/server or graphql
 * runtime in the measured path.
 */

// A constructor whose `.name` is exactly the GraphQL class name the subscriber
// string-compares against.
function makeType(className, toStringValue, extra = {}) {
  function T() {}
  Object.defineProperty(T, 'name', { value: className })
  T.prototype.toString = () => toStringValue
  const instance = new T()
  return Object.assign(instance, extra)
}

const scalarString = () => makeType('GraphQLScalarType', 'String')
const objectPost = () => makeType('GraphQLObjectType', '[Post!]!', { name: 'Post' })
const objectUser = () => makeType('GraphQLObjectType', 'User', { name: 'User' })
const objectComment = () => makeType('GraphQLObjectType', 'Comment', { name: 'Comment' })

// NonNull(String) — exercises the isNonNullScalarType unwrap branch.
const nonNullScalar = () => makeType('GraphQLNonNull', 'String!', { ofType: scalarString() })

/**
 * Build a graphql-js style path linked list from a top-down array of keys.
 * ['users', 0, 'posts', 1, 'comments', 2, 'body'] => nested { key, prev } with
 * the deepest field (`body`) as the head, matching what graphql passes in.
 *
 * @param {Array<string|number>} keys ordered from root to leaf
 * @returns {object} the leaf-most path node
 */
function buildPath(keys) {
  let node
  for (const key of keys) {
    node = { key, prev: node }
  }
  return node
}

// A realistically deep path: users[0].posts[1].comments[2].<field>
const DEEP_PATH_KEYS = ['users', 0, 'posts', 1, 'comments', 2]

/**
 * A scalar leaf field with no arguments — the dominant case in real schemas
 * (id, name, title, body, ...). Under the default config this field creates NO
 * segment, so all the per-call pre-work the subscriber does before the scalar
 * short-circuit is pure overhead.
 *
 * @returns {object} a resolver `info` fake for a scalar leaf field
 */
function scalarFieldInfo() {
  return {
    fieldName: 'body',
    path: buildPath([...DEEP_PATH_KEYS, 'body']),
    returnType: scalarString(),
    parentType: objectComment()
  }
}

/**
 * A scalar leaf field that DOES carry resolver arguments. Still short-circuits
 * (no segment) under the default config, but has args present so we can measure
 * the cost of arg handling on the discarded path.
 *
 * @returns {object} a resolver `info` fake for a NonNull scalar leaf field
 */
function scalarFieldWithArgsInfo() {
  return {
    fieldName: 'body',
    path: buildPath([...DEEP_PATH_KEYS, 'body']),
    returnType: nonNullScalar(),
    parentType: objectComment()
  }
}

/**
 * A non-top-level object field (User.posts). This one DOES get a resolver
 * segment created plus attribute capture — the "kept" path.
 *
 * @returns {object} a resolver `info` fake for a non-top-level object field
 */
function objectFieldInfo() {
  return {
    fieldName: 'posts',
    path: buildPath(['users', 0, 'posts']),
    returnType: objectPost(),
    parentType: objectUser()
  }
}

// Representative resolver-argument shapes.
const NO_ARGS = Object.freeze({})
const SIMPLE_ARGS = Object.freeze({ limit: 10, offset: 0 })
const NESTED_ARGS = Object.freeze({
  filter: { status: 'PUBLISHED', author: { id: '42' } },
  page: { first: 10 }
})

/**
 * Assemble the positional `args` array that Apollo passes to a field resolver
 * and that the subscriber destructures as `[, resolverArgs, , info]`.
 *
 * @param {object} resolverArgs the resolver arguments object
 * @param {object} info the resolver info object
 * @returns {Array} [source, args, context, info]
 */
function resolverArgs(resolverArgs, info) {
  return [{ __source: true }, resolverArgs, { __context: true }, info]
}

// A trivial original resolver to stand in for the user's resolver.
const origResolve = () => 'value'

module.exports = {
  buildPath,
  scalarFieldInfo,
  scalarFieldWithArgsInfo,
  objectFieldInfo,
  NO_ARGS,
  SIMPLE_ARGS,
  NESTED_ARGS,
  resolverArgs,
  origResolve
}
