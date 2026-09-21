/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

function encode(bytes, keyBytes) {
  for (let i = 0; i < bytes.length; i++) {
    // This is really dense but happens commonly so I'm in-lining some of what
    // could be tossed into variables. It takes the current byte of bytes, then
    // XORs it with the current byte of the key (which uses modulo to make sure
    // to not overrun the end.)
    bytes.writeUInt8(bytes.readUInt8(i) ^ keyBytes.readUInt8(i % keyBytes.length), i)
  }
  return bytes
}

function obfuscateNameUsingKey(name, key) {
  const encodedBytes = Buffer.from(name, 'utf-8')
  const keyBytes = Buffer.from(key)
  return encode(encodedBytes, keyBytes).toString('base64')
}

function deobfuscateNameUsingKey(name, key) {
  const bytes = Buffer.from(name, 'base64')
  const keyBytes = Buffer.from(key)

  return encode(bytes, keyBytes).toString('utf-8')
}

// Big enough to cover every caller in this codebase (max is a 32-char trace
// id, i.e. 16 bytes) with headroom. Reused across calls to avoid an
// allocation per id; safe because the hex string we return is copied out of
// it (via Buffer#toString) before the next call can overwrite it.
const ID_BUFFER_BYTES = 32
const idBuffer = Buffer.allocUnsafe(ID_BUFFER_BYTES)

function makeId(length = 16) {
  // length is number of hex characters, which multiplied by 4 is the number of
  // bits, then divided by 8 is number of bytes. Or just divide by 2
  const numBytes = Math.ceil(length / 2)
  // Round up to a whole number of 32-bit words so every writeUInt32BE below
  // lands fully in bounds.
  const allocBytes = Math.ceil(numBytes / 4) * 4
  const buffer = allocBytes <= ID_BUFFER_BYTES ? idBuffer : Buffer.allocUnsafe(allocBytes)

  // Generate random bytes one 32-bit integer at a time
  for (let i = 0; i < allocBytes; i += 4) {
    // eslint-disable-next-line sonarjs/pseudo-random
    buffer.writeUInt32BE((Math.random() * 2 ** 32) >>> 0, i)
  }

  // Convert the byte array to a hex string, then trim to the desired length
  // (odd lengths get one extra hex character from the last byte).
  return buffer.toString('hex', 0, numBytes).substring(0, length)
}

exports.obfuscateNameUsingKey = obfuscateNameUsingKey
exports.deobfuscateNameUsingKey = deobfuscateNameUsingKey
exports.makeId = makeId
