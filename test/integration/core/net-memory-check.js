#!/usr/bin/env node
/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Whether an ended transaction is actually reclaimed can only be observed by
// forcing a real GC cycle, which needs `--expose-gc` on the node invocation
// itself -- not something a test running through the normal `node:test`
// runner can request for its own process. Run as a child process instead
// (see `net-memory.test.js`), so only this one small script needs the flag.
//
// Exits 0 on success, 1 (with a message on stderr) on failure.

const net = require('net')
const helper = require('../../lib/agent_helper')

// Mirrors `http.Agent`'s own `ReusedHandle`/`asyncResetHandle` (see
// `lib/_http_agent.js`), the pattern `pg-pool`'s real fix for #4408 follows
// when handing a pooled, already-connected socket to a new caller.
class ReusedHandle {
  constructor(type, handle) {
    this.type = type
    this.handle = handle
  }
}

/**
 * Resets a socket's native handle so it stops propagating whatever
 * context was active the last time it was used, the same way a fixed
 * `pg-pool` does on every handoff of a reused, already-connected client.
 *
 * `handle.asyncReset()` alone is not quite enough on every supported Node
 * version. Confirmed via heap snapshot, on Node 22/23 the legacy
 * `AsyncLocalStorage` implementation also stamps a resource with an
 * internal `kResourceStore` symbol at creation time, used to drive
 * `executionAsyncResource()`-style APIs -- and `asyncReset()` does not
 * itself refresh that symbol, even though it correctly fixes which
 * context later events dispatch into (confirmed separately: a `data`
 * event after `asyncReset()` sees the new, correct context on every
 * version). The stale snapshot just sits there, unrelated to dispatch,
 * forever. Node 24+'s newer context-tracking does not have this property
 * at all. There is no public API for clearing it, so this reaches for the
 * symbol directly -- undesirable in general, but the only way to avoid
 * this specific, version-dependent retention until Node exposes one.
 *
 * @param {net.Socket} socket The socket being handed to a new caller.
 * @returns {void}
 */
function resetSocketAsyncContext(socket) {
  const handle = socket._handle
  if (!handle || typeof handle.asyncReset !== 'function') {
    return
  }

  handle.asyncReset(new ReusedHandle(handle.getProviderType(), handle))

  const resourceStoreSymbol = Object.getOwnPropertySymbols(handle).find((symbol) => symbol.toString().includes('kResourceStore'))
  if (resourceStoreSymbol) {
    handle[resourceStoreSymbol] = undefined
  }
}

async function main() {
  if (typeof global.gc !== 'function') {
    throw new Error('must be run with `node --expose-gc`')
  }

  const agent = helper.instrumentMockedAgent()
  const server = net.createServer((socket) => {
    socket.on('data', () => socket.write('pong'))
  })

  try {
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port

    const freed = new Set()
    const registry = new FinalizationRegistry((id) => freed.add(id))

    // Simulates a pooled database client: ONE socket, connected inside a
    // transaction that later ends, then kept open and reused later by code
    // that runs with no transaction active -- exactly what a connection
    // pool does when it hands an idle, already-connected client back out.
    const socket = new net.Socket()
    let transactionId

    await new Promise((resolve) => {
      helper.runInTransaction(agent, (transaction) => {
        transactionId = transaction.id
        registry.register(transaction, transactionId)
        socket.connect(port, '127.0.0.1', () => {
          transaction.end()
          resolve()
        })
      })
    })

    // Reuse the still-open socket for a second, unrelated transaction, the
    // same way a pool hands an idle, already-connected client to the next
    // caller.
    //
    // A real connection pool (once fixed per #4408's companion change in
    // `pg-pool`) resets the socket's native handle on every such handoff
    // -- see `resetSocketAsyncContext` -- so the handle itself stops
    // pointing at the previous caller's context. That's a *separate* fix,
    // in a separate package, from the one under test here -- this agent
    // has no hook into "an idle connection was just checked out again" at
    // all, so it can't do this part itself. Simulate it so this test
    // isolates what this agent's own fix is actually responsible for:
    // once the native path is no longer the thing keeping the transaction
    // alive, does this agent's own bound `socket.emit` closure still pin
    // it?
    //
    // The reset has to run with some AsyncLocalStorage store actually
    // active, not bare: on every supported version, a resource's stored
    // async-context association is only refreshed when the current store
    // is non-empty at the moment the handle is reset. This is also what
    // the real fix actually does: it calls the reset from inside the
    // AsyncResource-restored scope of whichever caller is receiving the
    // connection, which does have its own active context when, as here,
    // that caller is itself running inside a transaction.
    await new Promise((resolve) => {
      helper.runInTransaction(agent, (secondTransaction) => {
        resetSocketAsyncContext(socket)
        secondTransaction.end()
        resolve()
      })
    })

    await new Promise((resolve) => {
      socket.once('data', resolve)
      socket.write('ping')
    })

    for (let i = 0; i < 10 && !freed.has(transactionId); i++) {
      global.gc()

      await new Promise((resolve) => setTimeout(resolve, 20))
    }

    socket.destroy()

    if (!freed.has(transactionId)) {
      throw new Error(
        'ended transaction should be collectible once the socket is reused with no transaction active'
      )
    }
  } finally {
    server.close()
    helper.unloadAgent(agent)
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err.message)
    process.exit(1)
  }
)
