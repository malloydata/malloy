start = statement

statement = p:(comment / embedded_malloy / other)* {
  return {
    parts: p,
    range: location(),
    statementText: p.map((s) => { return s.text }).join('')
  }
}

other "query string" = s:$(!comment !embedded_malloy .)+ {
  return {
    type: "other",
    text: s,
    range:location()
  }
}

embedded_malloy
  = parenthesized_embedded_malloy / plain_embedded_malloy
parenthesized_embedded_malloy
  = '(' __ em:plain_embedded_malloy __ ')' {
  return {
    type: "malloy",
    text:text(),
    malloy:em.malloy,
    malloyRange: em.malloyRange,
    range:location(),
    parenthesized: true
  }
}
plain_embedded_malloy
  = '%{' m:malloy '}%' {
  return {
    type: "malloy",
    text:text(),
    malloy:m.text,
    malloyRange: m.malloyRange,
    range:location(),
    parenthesized: false
  }
}
malloy
  = (!'}%' .)* {
  return {
    malloyRange: location(),
    text:text()
  }
}

comment "comment"
  = c:(single_comment / multi_comment) {
  return {
    type: "comment",
    text:c,
    range:location()
  }
}
single_comment = $(('//' / '--') (!EOL .)* __ (EOL / EOF))
multi_comment = $("/*" (!"*/" .)* "*/")

__ = _*
_ = [ \t]
EOL "end of line" = [\n\r]
EOF = !.
