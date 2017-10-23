'use strict'

var hasOwnProperty = require('./properties').hasOwn
var psemver = require('./process-version')


// Starting in what we believe to be Node v4 you can set the name and length of
// a function as properties. This is more ideal than wrapping a function.
// TODO: Remove _fixArity_newFunc once Node v0.12 has been deprecated.
exports.fixArity = psemver.satisfies('>=4') ? _fixArity_prop : _fixArity_newFunc

function _fixArity_prop(original, wrapper) {
  var toDefine = {
    name: { value: original.name },
    length: { value: original.length }
  }

  if (!hasOwnProperty(wrapper, '__NR_name')) {
    toDefine.__NR_name = {
      configurable: false,
      enumerable: false,
      writable: false,
      value: wrapper.name
    }
  }

  Object.defineProperties(wrapper, toDefine)

  return wrapper
}

function _fixArity_newFunc(original, wrapper) {
  // If the arity is already fixed, don't mess with it.
  if (original.name === wrapper.name && original.length === wrapper.length) {
    return wrapper
  }

  var name = String(original.name).replace(/[^\w_]/g, '_')
  var args = ''
  if (original.length > 0) {
    args = 'v0'
    for (var i = 1; i < original.length; ++i) {
      args += ', v' + i
    }
  }

  /* eslint-disable no-new-func */
  var arityWrapper = (new Function('wrapper', [
    'var arityWrapper = function ' + name + '(' + args + ') {',
    '  if (this && arityWrapper.prototype && this instanceof arityWrapper) {',
    '    var len = arguments.length',
    '    var fnArgs = new Array(len)',
    '    for (var i = 0; i < len; ++i) {',
    '      fnArgs[i] = arguments[i]',
    '    }',
    '    fnArgs.unshift(wrapper) // `unshift` === `push_front`',
    '    return new (wrapper.bind.apply(wrapper, fnArgs))()',
    '  }',
    '  return wrapper.apply(this, arguments)',
    '}',
    'return arityWrapper'
  ].join('\n')))(wrapper)
  /* eslint-enable no-new-func */

  Object.defineProperty(arityWrapper, '__NR_name', {
    enumerable: false,
    writable: true,
    value: wrapper.name
  })

  arityWrapper.__proto__ = original
  return arityWrapper
}
