'use strict'

var crypto = require('crypto')
var psemver = require('./process-version')

// TODO: Just use Buffer.from once Node <5.10.0 is deprecated.
var makeBuffer = Buffer.from

if (psemver.satisfies('<5.10.0') || !makeBuffer) {
  makeBuffer = bufferFactory
}

function bufferFactory(v, enc) {
  return new Buffer(v, enc)
}

function encode(bytes, keyBytes) {
  for (var i = 0; i < bytes.length; i++) {
    // This is really dense but happens commonly so I'm in-lining some of what
    // could be tossed into variables. It takes the current byte of bytes, then
    // XORs it with the current byte of the key (which uses modulo to make sure
    // to not overrun the end.)
    bytes.writeUInt8(bytes.readUInt8(i) ^ keyBytes.readUInt8(i % keyBytes.length), i)
  }
  return bytes
}

function obfuscateNameUsingKey(name, key) {
  var encodedBytes = makeBuffer(name, 'utf-8')
  var keyBytes = makeBuffer(key)
  return encode(encodedBytes, keyBytes).toString('base64')
}

function deobfuscateNameUsingKey(name, key) {
  var bytes = makeBuffer(name, 'base64')
  var keyBytes = makeBuffer(key)

  return encode(bytes, keyBytes).toString("utf-8")
}

function calculatePathHash(appName, pathName, referingPathHash) {
  if (typeof referingPathHash === 'string') {
    referingPathHash = parseInt(referingPathHash, 16)
  }
  var rotated = ((referingPathHash << 1) | (referingPathHash >>> 31)) >>> 0
  var hash = getHash(appName, pathName)

  var result = (rotated ^ hash) >>> 0

  // This is a trick to pad it out to 8 chars regardless of length.
  var retval = ('00000000' + result.toString(16)).substr(-8)

  return retval
}

function getHash(appName, txName) {
  var md5sum = crypto.createHash('md5')
  md5sum.update(appName + ';' + txName, 'utf8')
  var buf = md5sum.digest()
  if (!(buf instanceof Buffer)) {
    buf = new Buffer(buf)
  }
  // pull the low 4 bytes in network byte order
  return buf.slice(buf.length - 4, buf.length).readUInt32BE(0)
}

exports.obfuscateNameUsingKey = obfuscateNameUsingKey
exports.deobfuscateNameUsingKey = deobfuscateNameUsingKey
exports.calculatePathHash = calculatePathHash
exports.getHash = getHash
