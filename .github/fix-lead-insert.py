from pathlib import Path

p=Path('worker/leads-d1.js')
s=p.read_text(encoding='utf-8')
old="  ) VALUES ('new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)`)"
new="  ) VALUES ('new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)`)"
if old not in s:
    raise SystemExit('lead INSERT placeholder anchor not found')
p.write_text(s.replace(old,new,1),encoding='utf-8')

p=Path('scripts/test-gate-page.mjs')
s=p.read_text(encoding='utf-8')
anchor="assert(workerLeads.includes('consent_at') && workerLeads.includes('policy_version'), 'Server must store consent evidence');"
addition=anchor+"\nconst leadInsertSql = workerLeads.match(/INSERT INTO site_leads \\([\\s\\S]*?\\)\\s*VALUES \\([\\s\\S]*?\\)`\\)/)?.[0] || '';\nassert.equal((leadInsertSql.match(/\\?/g)||[]).length, 21, 'Lead INSERT must have exactly 21 bound placeholders');"
if anchor not in s:
    raise SystemExit('gate page worker assertion anchor not found')
p.write_text(s.replace(anchor,addition,1),encoding='utf-8')
print('Lead INSERT fixed and guarded')
