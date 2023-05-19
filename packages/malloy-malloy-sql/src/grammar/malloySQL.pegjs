start = initial_comments control_and_statement*

control_and_statement = c:control s:statement {
  s["statementType"] = c.type;
  s["config"] = c.config
  s["controlLineLocation"] = c.location
  return s
}

statement = p:(comment / embedded_malloy / other)* {
  return {parts: p, location: location(), statementText: p.map((s) => { return s.text }).join('')}
}

other "query string" = s:$(!delimiter !comment !embedded_malloy .)+ {
  return {type: "other", text: s, location:location()}
}

embedded_malloy = parenthized_embedded_malloy / plain_embedded_malloy
parenthized_embedded_malloy = t:$('(' __ '%{' (!'}%' .)* '}%' __ ')') {
  return {type: "malloy", text:t, malloy:t.slice(3, -3), location:location(), parenthized: true}
}
plain_embedded_malloy = t:$('%{' (!'}%' .)* '}%') {
  return {type: "malloy", text:t, malloy:t.slice(2, -2), location:location(), parenthized: false}
}

control =
  delimiter t:statement_type c:(_ oc:optional_config {return oc})? __ (single_comment / EOL / EOF) {
    return {type: t, config: c ? c.trim() : '{}', location:location()}
  }
delimiter = '>>>'
statement_type = 'sql' / 'malloy'
optional_config = $(!comment !EOL .)*

initial_comments "initial comments" = $(_ / EOL / comment)*
comment "comment" = c:(single_comment / multi_comment) {
  return {type: "comment", text:c, location:location()}
}
single_comment = $(('//' / '--') (!EOL .)* __ (EOL / EOF))
multi_comment = $("/*" (!"*/" .)* "*/")

__ = _*
_ = [ \t]
EOL "end of line" = [\n\r]
EOF = !.