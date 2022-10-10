/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const crypto = require('crypto')

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

function calculatePathHash(appName, pathName, referingPathHash) {
  if (typeof referingPathHash === 'string') {
    referingPathHash = parseInt(referingPathHash, 16)
  }
  const rotated = ((referingPathHash << 1) | (referingPathHash >>> 31)) >>> 0
  const hash = getHash(appName, pathName)

  const result = (rotated ^ hash) >>> 0

  // This is a trick to pad it out to 8 chars regardless of length.
  return ('00000000' + result.toString(16)).substr(-8)
}

function getHash(appName, txName) {
  const md5sum = crypto.createHash('md5')
  md5sum.update(appName + ';' + txName, 'utf8')
  let buf = md5sum.digest()
  if (!(buf instanceof Buffer)) {
    buf = Buffer.from(buf)
  }
  // pull the low 4 bytes in network byte order
  return buf.slice(buf.length - 4, buf.length).readUInt32BE(0)
}

const rand = Math.random

const max32 = Math.pow(2, 32) - 1
function randInt32() {
  return Math.floor(rand() * max32)
}

function int32ToByteArray(int32) {
  // we want to represent the input as a 4-bytes array
  const byteArray = new Uint8Array(4)

  for (let i = 0; i < byteArray.length; i++) {
    const byte = int32 & 0xff
    byteArray[i] = byte
    int32 = (int32 - byte) / 256
  }

  return byteArray
}

// Lookup table for converting byte values to hex
const byteToHex = []
for (let i = 0; i < 256; ++i) {
  byteToHex[i] = (i + 0x100).toString(16).substr(1)
}

function makeId(length = 16) {
  // length is number of hex characters, which multiplied by 4 is the number of
  // bits, then divided by 8 is number of bytes. Or just divide by 2
  const numBytes = Math.ceil(length / 2)
  const randBytes = new Uint8Array(numBytes)

  // Generate random bytes one 32-bit integer at a time
  const numInts = Math.ceil(numBytes / 4) // 32 bit integers are 4 bytes
  for (let i = 0; i < numInts; i++) {
    const int = randInt32()
    const bytes = int32ToByteArray(int)
    for (let j = 0; j < 4; j++) {
      // This could "overflow" since we're iterating over the number of ints, which could
      // be more data than needed. But out-of-bound index assignment on typed arrays are
      // discarded
      randBytes[i * 4 + j] = bytes[j]
    }
  }

  // Convert the byte array to a hex string
  let id = ''
  for (let i = 0; i < randBytes.length; i++) {
    id += byteToHex[randBytes[i]]
  }

  // For odd number lengths, we may get an extra character since byteToHex returns two
  // characters, so trim to the desired length.
  return id.substring(0, length)
}

exports.obfuscateNameUsingKey = obfuscateNameUsingKey
exports.deobfuscateNameUsingKey = deobfuscateNameUsingKey
exports.calculatePathHash = calculatePathHash
exports.getHash = getHash
exports.makeId = makeId
