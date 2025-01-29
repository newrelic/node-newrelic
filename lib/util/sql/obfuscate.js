/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = obfuscate

// All eslint rules in this file that have a comment description of
// "¶¶¶" have been determined safe enough for our use cases. These lint rules
// are complaining about catastrophic backtracking being possible. While this
// may be true, our only other alternative is to write a character by character
// analyzer, like the .NET Agent uses, in order to obfuscate SQL statements.
// We have opted against that for the follow reasons:
//
// 1. We have not encountered a case where these expressions have led to
// the possible backtracking failure.
// 2. Any character-by-character parser is very likely going to be much slower.
// 3. If we did use a character-by-character parser, we would need to be sure
// to handle multibyte characters, e.g.
// `insert into foo (col1) values('sensitive 🍍')`
// That statement has ASCII that would be well-supported in a naive
// implementation, along with a UTF-8 character that could be mishandled if
// not accounted for.

// eslint-disable-next-line sonarjs/slow-regex -- ¶¶¶
const singleQuote = /'(?:''|[^'])*?(?:\\'.*|'(?!'))/
// eslint-disable-next-line sonarjs/slow-regex -- ¶¶¶
const doubleQuote = /"(?:[^"]|"")*?(?:\\".*|"(?!"))/
const dollarQuote = /(\$(?!\d)[^$]*?\$).*?(?:\1|$)/
const oracleQuote = /q'\[.*?(?:\]'|$)|q'\{.*?(?:\}'|$)|q'<.*?(?:>'|$)|q'\(.*?(?:\)'|$)/
// eslint-disable-next-line sonarjs/slow-regex -- ¶¶¶
const comment = /(?:#|--).*?(?=\r|\n|$)/
const multilineComment = /\/\*(?:[^/]|\/[^*])*?(?:\*\/|\/\*.*)/
const uuid = /\{?(?:[0-9a-f]-*){32}\}?/
const hex = /0x[0-9a-f]+/
const boolean = /\b(?:true|false|null)\b/
const number = /-?\b(?:\d+\.)?\d+(e[+-]?\d+)?/

const dialects = (obfuscate.dialects = Object.create(null))

dialects.mysql = [
  replacer(join([doubleQuote, singleQuote, comment, multilineComment, hex, boolean, number], 'gi')),
  unmatchedPairs(/'|"|\/\*|\*\//)
]

dialects.postgres = [
  replacer(
    join([dollarQuote, singleQuote, comment, multilineComment, uuid, boolean, number], 'gi')
  ),
  unmatchedPairs(/'|\/\*|\*\/|\$(?!\?)/)
]

dialects.cassandra = [
  replacer(join([singleQuote, comment, multilineComment, uuid, hex, boolean, number], 'gi')),
  unmatchedPairs(/'|\/\*|\*\//)
]

dialects.oracle = [
  replacer(join([oracleQuote, singleQuote, comment, multilineComment, number], 'gi')),
  unmatchedPairs(/'|\/\*|\*\//)
]

dialects.sqlite = [
  replacer(join([singleQuote, comment, multilineComment, hex, boolean, number], 'gi')),
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
