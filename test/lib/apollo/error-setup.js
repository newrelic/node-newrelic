/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 *
 * @param {object} serverPkgExport apollo export
 * @returns {object} of custom errors
 */
function createErrorClasses(serverPkgExport) {
  const { GraphQLError } = serverPkgExport.graphql

  class CustomError extends GraphQLError {
    constructor(message) {
      super(message)
      this.extensions.code = 'CUSTOM_ERROR'
      this.name = 'CustomError'
    }
  }

  class ForbiddenError extends GraphQLError {
    constructor(message) {
      super(message)
      this.extensions.code = 'FORBIDDEN'
      this.name = 'ForbiddenError'
    }
  }

  class SyntaxError extends GraphQLError {
    constructor(message) {
      super(message)
      this.extensions.code = 'GRAPHQL_PARSE_FAILED'
      this.name = 'SyntaxError'
    }
  }

  class UserInputError extends GraphQLError {
    constructor(message) {
      super(message)
      this.extensions.code = 'BAD_USER_INPUT'
      this.name = 'UserInputError'
    }
  }

  class ValidationError extends GraphQLError {
    constructor(message) {
      super(message, { extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } })
      this.extensions.code = 'GRAPHQL_VALIDATION_FAILED'
      this.name = 'ValidationError'
    }
  }

  class AuthenticationError extends GraphQLError {
    constructor(message) {
      super(message)
      this.extensions.code = 'UNAUTHENTICATED'
      this.name = 'AuthenticationError'
    }
  }

  return {
    CustomError,
    ForbiddenError,
    SyntaxError,
    UserInputError,
    ValidationError,
    AuthenticationError
  }
}

/**
 * Defines a few resolves that throw different types of errors
 *
 * @param {object} serverPkgExport an apollo server pkg export
 * @param {object} resolvers gql resolver definition
 * @returns {object} graphql schema
 */
module.exports = function setupErrorResolvers(serverPkgExport, resolvers) {
  const {
    CustomError,
    ForbiddenError,
    SyntaxError, // eslint-disable-line sonarjs/no-globals-shadowing
    UserInputError,
    ValidationError,
    AuthenticationError
  } = createErrorClasses(serverPkgExport)

  resolvers.Query.boom = () => {
    throw new Error('Boom goes the dynamite!')
  }

  resolvers.Query.userInputError = () => {
    throw new UserInputError('user input error')
  }

  resolvers.Query.validationError = () => {
    throw new ValidationError('validation error')
  }

  resolvers.Query.forbiddenError = () => {
    throw new ForbiddenError('forbidden error')
  }

  resolvers.Query.customError = () => {
    throw new CustomError('custom error')
  }

  resolvers.Query.syntaxError = () => {
    throw new SyntaxError('syntax error')
  }

  resolvers.Query.authError = () => {
    throw new AuthenticationError('auth error')
  }

  const { gql } = serverPkgExport
  return gql`
    extend type Query {
      boom: String
      userInputError: String
      validationError: String
      forbiddenError: String
      customError: String
      syntaxError: String
      authError: String
    }
  `
}
