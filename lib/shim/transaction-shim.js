'use strict'

var logger = require('../logger.js').child({component: 'TransactionShim'})
var Shim = require('./shim')
var util = require('util')


/**
 * Constructs a transaction managing shim.
 *
 * @constructor
 * @extends Shim
 * @classdesc
 *  A helper class for working with transactions.
 *
 * @param {Agent}   agent         - The agent the shim will use.
 * @param {string}  moduleName    - The name of the module being instrumented.
 * @param {string}  resolvedName  - The full path to the loaded module.
 *
 * @see Shim
 * @see WebFrameworkShim
 */
function TransactionShim(agent, moduleName, resolvedName) {
  Shim.call(this, agent, moduleName, resolvedName)
  this._logger = logger.child({module: moduleName})
}
module.exports = TransactionShim
util.inherits(TransactionShim, Shim)

TransactionShim.prototype.pushTransactionName = pushTransactionName
TransactionShim.prototype.popTransactionName = popTransactionName
TransactionShim.prototype.setTransactionName = setTransactionName

// -------------------------------------------------------------------------- //

/**
 * Pushes a new path segment onto the transaction naming stack.
 *
 * Transactions are named for the middlware that sends the reponse. Some web
 * frameworks are capable of mounting middlware in complex routing stacks. In
 * order to maintain the correct name, transactions keep a stack of mount points
 * for each middlware/router/app/whatever. The instrumentation should push on
 * the mount path for wrapped things when route resolution enters and pop it
 * back off when resolution exits the item.
 *
 * @memberof TransactionShim.prototype
 *
 * @param {string} pathSegment - The path segment to add to the naming stack.
 */
function pushTransactionName(pathSegment) {
  var tx = this.tracer.getTransaction()
  if (tx && tx.nameState) {
    tx.nameState.appendPath(pathSegment)
  }
}

/**
 * Pops one or more elements off the transaction naming stack.
 *
 * Ideally it is not necessary to ever provide the `pathSegment` parameter for
 * this function, but we do not live in an ideal world.
 *
 * @memberof TransactionShim.prototype
 *
 * @param {string} [pathSegment]
 *  Optional. Path segment to pop the stack repeatedly until a segment matching
 *  `pathSegment` is removed.
 */
function popTransactionName(pathSegment) {
  var tx = this.tracer.getTransaction()
  if (tx && tx.nameState) {
    tx.nameState.popPath(pathSegment)
  }
}

/**
 * Sets the name to be used for this transaction.
 *
 * Either this _or_ the naming stack should be used. Do not use them together.
 *
 * @memberof TransactionShim.prototype
 *
 * @param {string} name - The name to use for the transaction.
 */
function setTransactionName(name) {
  var tx = this.tracer.getTransaction()
  if (tx) {
    tx.setPartialName(name)
  }
}
