start = initial_comments delimiter_and_statement*

delimiter_and_statement = c:delimiter s:statement {
  s["statementType"] = c.type;
  s["config"] = c.config
  s["delimiterRange"] = c.range
  return s
}

statement = p:(comment / embedded_malloy / other)* {
  return {parts: p, range: location(), statementText: p.map((s) => { return s.text }).join('')}
}

other "query string" = s:$(!delimiter_start !comment !embedded_malloy .)+ {
  return {type: "other", text: s, range:location()}
}

embedded_malloy = parenthized_embedded_malloy / plain_embedded_malloy
parenthized_embedded_malloy = '(' __ '%{' m:$((!'}%' .)*) '}%' __ ')' {
  return {type: "malloy", text:text(), malloy:m, range:location(), parenthized: true}
}
plain_embedded_malloy = '%{' m:$((!'}%' .)*) '}%' {
  return {type: "malloy", text:text(), malloy:m, range:location(), parenthized: false}
}

delimiter =
  delimiter_start t:statement_type c:(_ oc:optional_config {return oc})? __ (single_comment / EOL / EOF) {
    return {type: t, config: c ? c.trim() : '', range:location()}
  }
delimiter_start = '>>>'
statement_type = 'sql' / 'malloy'
optional_config = $(!comment !EOL .)*

initial_comments "initial comments" = $(_ / EOL / comment)*
comment "comment" = c:(single_comment / multi_comment) {
  return {type: "comment", text:c, range:location()}
}
single_comment = $(('//' / '--') (!EOL .)* __ (EOL / EOF))
multi_comment = $("/*" (!"*/" .)* "*/")

__ = _*
_ = [ \t]
EOL "end of line" = [\n\r]
EOF = !.