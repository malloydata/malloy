start
  = initial_comments delimiter_and_statement |.., EOL|

delimiter_and_statement
  = c:delimiter s:statement {
  s["statementType"] = c.type;
  s["config"] = c.config
  s["delimiterRange"] = c.range
  return s
}

statement
  = p:(comment / cell)* {
  return {
    parts: p,
    range: location(),
    statementText: p.map((s) => { return s.text }).join('')
  }
}

cell "cell" = s:$(!(EOL delimiter_start) !comment .)+ {
  return {
    type: "other",
    text: s,
    range:location()
  }
}

delimiter =
  delimiter_start t:statement_type c:(_ oc:optional_config {return oc})? __ (single_comment / EOL / EOF) {
    return {
      type: t,
      config: c ? c.trim() : '',
      range:location()
  }
}

delimiter_start = '>>>'

statement_type = 'sql' / 'malloy' / 'markdown'

optional_config = $(!comment !EOL .)*

initial_comments "initial comments" = $(_ / EOL / comment)*

comment "comment" = c:(single_comment / multi_comment) {
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
