'use strict'

module.exports = obfuscate

var singleQuote = /'(?:[^']|'')*?(?:\\'.*|'(?!'))/
var doubleQuote = /"(?:[^"]|"")*?(?:\\".*|"(?!"))/
var dollarQuote = /(\$(?!\d)[^$]*?\$).*?(?:\1|$)/
var oracleQuote = /q'\[.*?(?:\]'|$)|q'\{.*?(?:\}'|$)|q'\<.*?(?:\>'|$)|q'\(.*?(?:\)'|$)/
var comment = /(?:#|--).*?(?=\r|\n|$)/
var multilineComment = /\/\*(?:[^/]|\/[^*])*?(?:\*\/|\/\*.*)/
var uuid = /\{?(?:[0-9a-f]\-*){32}\}?/
var hex = /0x[0-9a-f]+/
var boolean = /true|false|null/
var number = /\b-?(?:[0-9]+\.)?[0-9]+([eE][+-]?[0-9]+)?/

var dialects = obfuscate.dialects = {}

dialects.mysql = [
  replacer(join(
    [doubleQuote, singleQuote, comment, multilineComment, hex, boolean, number],
    'gi'
  )),
  unmatchedPairs(/'|"|\/\*|\*\//)
]

dialects.postgres = [
  replacer(join(
    [dollarQuote, singleQuote, comment, multilineComment, uuid, boolean, number],
    'gi'
  )),
  unmatchedPairs(/'|\/\*|\*\/|(?:\$(?!\?))/)
]

dialects.cassandra = [
  replacer(join(
    [singleQuote, comment, multilineComment, uuid, hex, boolean, number],
    'gi'
  )),
  unmatchedPairs(/'|\/\*|\*\//)
]

dialects.oracle = [
  replacer(join(
    [oracleQuote, singleQuote, comment, multilineComment, number],
    'gi'
  )),
  unmatchedPairs(/'|\/\*|\*\//)
]

dialects.default = dialects.mysql

function obfuscate(raw, dialect) {
  var replacers = dialects[dialect]
  if (!replacers) {
    replacers = dialects.default
  }

  var obfuscated = raw
  for (var i = 0, l = replacers.length; i < l; ++i) {
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
