'use strict'

if (!global.Promise) {
  console.error('Promise tests cant run without native Promises')
  return
}

require('./promises')({await_support: false})
