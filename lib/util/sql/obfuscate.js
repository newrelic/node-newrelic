/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = obfuscate

const singleQuote = /'(?:''|[^'])*?(?:\\'.*|'(?!'))/
const doubleQuote = /"(?:[^"]|"")*?(?:\\".*|"(?!"))/
const dollarQuote = /(\$(?!\d)[^$]*?\$).*?(?:\1|$)/
const oracleQuote = /q'\[.*?(?:\]'|$)|q'\{.*?(?:\}'|$)|q'\<.*?(?:\>'|$)|q'\(.*?(?:\)'|$)/
const comment = /(?:#|--).*?(?=\r|\n|$)/
const multilineComment = /\/\*(?:[^/]|\/[^*])*?(?:\*\/|\/\*.*)/
const uuid = /\{?(?:[0-9a-f]\-*){32}\}?/
const hex = /0x[0-9a-f]+/
const boolean = /true|false|null/
const number = /\b-?(?:[0-9]+\.)?[0-9]+([eE][+-]?[0-9]+)?/

const dialects = (obfuscate.dialects = Object.create(null))

dialects.mysql = [
  replacer(join([doubleQuote, singleQuote, comment, multilineComment, hex, boolean, number], 'gi')),
  unmatchedPairs(/'|"|\/\*|\*\//)
]

dialects.postgres = [
  replacer(
    join([dollarQuote, singleQuote, comment, multilineComment, uuid, boolean, number], 'gi')
  ),
  unmatchedPairs(/'|\/\*|\*\/|(?:\$(?!\?))/)
]

dialects.cassandra = [
  replacer(join([singleQuote, comment, multilineComment, uuid, hex, boolean, number], 'gi')),
  unmatchedPairs(/'|\/\*|\*\//)
]

dialects.oracle = [
  replacer(join([oracleQuote, singleQuote, comment, multilineComment, number], 'gi')),
  unmatchedPairs(/'|\/\*|\*\//)
]

dialects.default = dialects.mysql

function obfuscate(raw, dialect) {
  let replacers = dialects[dialect]
  if (!replacers) {
    replacers = dialects.default
  }

  let obfuscated = raw
  for (let i = 0, l = replacers.length; i < l; ++i) {
    obfuscated = replacers[i](obfuscated)
  }

  return obfuscated
}

function join(expressions, flags) {
  return new RegExp(expressions.map(toPart).join('|'), flags)
}

function toPart(expressions) {
  return expressions.toString().slice(1, -1)
}

function replacer(regex) {
  function replace(sql) {
    return sql.replace(regex, '?')
  }
  replace.regex = regex

  return replace
}

function unmatchedPairs(regex) {
  function check(sql) {
    return regex.test(sql) ? '?' : sql
  }
  check.regex = regex

  return check
}
