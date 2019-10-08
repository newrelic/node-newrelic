'use strict'

// to avoid parsing the esprima code base we require it here
// TODO: excise this with better internal file filtering
const esprima = require('esprima')
const ecg = require('escodegen')
const fileNameToken = {
  type: 'Literal',
  value: null
}
const lineNumberTokenTemplate = {
  type: 'Literal',
  value: null
}

class Mutator {
  constructor(appliesTo, mutate) {
    this.appliesTo = appliesTo
    this.mutate = mutate
    this.tokens = []
  }

  add(token) {
    this.tokens.push(token)
  }

  apply() {
    this.tokens.forEach(this.mutate)
  }
}

const functionTypes = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'AsyncFunction'
])

const equalityCheckOps = new Set([
  '==',
  '===',
  '!=',
  '!==',
  'instanceof'
])

const variableTypes = new Set([
  'MemberExpression',
  'Identifier'
])

const callTypes = new Set([
  'CallExpression',
  'NewExpression'
])

const wrapTemplate = esprima.parse('__NR_wrap()').body[0].expression
const unwrapTemplate = esprima.parse('__NR_unwrap()').body[0].expression

const mutators = [
  new Mutator(function wrapAssignmentPredicate(token) {
    return token.type === 'AssignmentExpression' &&
      token.operator === '=' &&
      functionTypes.has(token.right.type)
  }, function injectWrapAssignment(token) {
    token.right = wrapToken(token.right)
  }),
  new Mutator(function wrapArgPredicate(token) {
    return callTypes.has(token.type)
  }, function injectWrapArg(token) {
    token.arguments = token.arguments.map(wrapToken)
  }),
  new Mutator(function unwrapPredicate(token) {
    return token.type === 'BinaryExpression' && equalityCheckOps.has(token.operator)
  }, function injectUnwrap(token) {
    token.left = unwrapToken(token.left)
    token.right = unwrapToken(token.right)
  })
]

function wrapToken(argToken) {
  const type = argToken.type
  if (
    !functionTypes.has(type) &&
    !callTypes.has(type) &&
    !variableTypes.has(type) ||
    !argToken.loc
  ) {
    return argToken
  }

  const wrapped = Object.assign({}, wrapTemplate)
  const lineNumberToken = Object.assign({}, lineNumberTokenTemplate)
  lineNumberToken.value = argToken.loc.start.line
  wrapped.arguments = [argToken, lineNumberToken, Object.assign({}, fileNameToken)]
  return wrapped
}

function unwrapToken(argToken) {
  if (!variableTypes.has(argToken.type)) {
    return argToken
  }

  const wrapped = Object.assign({}, unwrapTemplate)
  wrapped.arguments = [argToken]
  return wrapped
}

function inject(sourceCode, file) {
  // wrap the incoming file code to make it more palatable for esprima.
  // node likewise wraps the contents of the file in a function, so this
  // replicates the behavior (e.g. allows for global returns)
  sourceCode = 'function main() {' + sourceCode + '}'
  const sourceRootBody = esprima.parse(sourceCode, {loc: true}).body[0].body.body

  const toRelax = [].concat(sourceRootBody)

  while (toRelax.length) {
    const currentToken = toRelax.pop()

    mutators.forEach(m => {
      if (m.appliesTo(currentToken)) {
        m.add(currentToken)
      }
    })

    for (let key of Object.keys(currentToken)) {
      if (key === 'loc') continue
      const value = currentToken[key]
      if (value && value instanceof Object) {
        if (Array.isArray(value)) {
          for (let t of value) {
            if (t) {
              toRelax.push(t)
            }
          }
        } else {
          toRelax.push(value)
        }
      }
    }
  }

  // TODO: make this less janky
  fileNameToken.value = file
  mutators.forEach(m => m.apply())
  fileNameToken.value = null
  // create a new base level token that contains all the statements we
  // want to pass back to node
  const printed = ecg.generate({
    type: 'Program',
    body: sourceRootBody,
    sourceType: 'script'
  }, {
    format: {
      semicolons: false
    }
  })
  return printed
}

module.exports = { inject }
