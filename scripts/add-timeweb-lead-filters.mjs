import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'timeweb-dist');
const apiPath = path.join(output, 'local-api.php');
const adminPath = path.join(output, 'admin.html');

function replaceExactlyOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first === -1) throw new Error(`Lead filters: ${label} source block was not found`);
  if (source.indexOf(from, first + from.length) !== -1) {
    throw new Error(`Lead filters: ${label} source block is ambiguous`);
  }
  return source.slice(0, first) + to + source.slice(first + from.length);
}

let api = await readFile(apiPath, 'utf8');

const oldLeadParams = `$limit=max(1,min(200,(int)($_GET['limit']??50)));$before=(int)($_GET['before_id']??0);$status=trim((string)($_GET['status']??''));$q=trim((string)($_GET['q']??''));$source=trim((string)($_GET['source']??''));$from=(string)($_GET['from']??'');$to=(string)($_GET['to']??'');`;
const newLeadParams = `$limit=max(1,min(200,(int)($_GET['limit']??50)));$before=(int)($_GET['before_id']??0);$status=trim((string)($_GET['status']??''));$q=trim((string)($_GET['q']??''));$source=trim((string)($_GET['source']??''));$from=(string)($_GET['from']??'');$to=(string)($_GET['to']??'');$trust=trim((string)($_GET['trust']??''));`;
api = replaceExactlyOnce(api, oldLeadParams, newLeadParams, 'admin lead query parameters');

const oldLeadWhere = `$where=[];$args=[];if($before>0){$where[]='id < ?';$args[]=$before;}if(in_array($status,['new','contacted','done','archived'],true)){$where[]='status=?';$args[]=$status;}if($source!==''){$where[]='source=?';$args[]=$source;}if(preg_match('/^\\d{4}-\\d{2}-\\d{2}$/',$from)){$where[]='created_at>=?';$args[]=$from.' 00:00:00';}if(preg_match('/^\\d{4}-\\d{2}-\\d{2}$/',$to)){$where[]='created_at<DATE_ADD(?,INTERVAL 1 DAY)';$args[]=$to.' 00:00:00';}
    if($q!==''){$where[]='(name LIKE ? OR city LIKE ? OR article LIKE ? OR source LIKE ? OR product_title LIKE ? OR phone LIKE ?)';$like='%'.$q.'%';array_push($args,$like,$like,$like,$like,$like,$like);}
    $sqlWhere=$where?' WHERE '.implode(' AND ',$where):'';`;
const newLeadWhere = `$where=[];$args=[];if(in_array($status,['new','contacted','done','archived'],true)){$where[]='status=?';$args[]=$status;}if($source!==''){$where[]='source=?';$args[]=$source;}if(preg_match('/^\\d{4}-\\d{2}-\\d{2}$/',$from)){$where[]='created_at>=?';$args[]=$from.' 00:00:00';}if(preg_match('/^\\d{4}-\\d{2}-\\d{2}$/',$to)){$where[]='created_at<DATE_ADD(?,INTERVAL 1 DAY)';$args[]=$to.' 00:00:00';}if($trust==='verified'){$where[]='quote_verified=1';}elseif($trust==='review'){$where[]='quote_verified=0';}elseif($trust==='delivery'){$where[]='delivery_pending=1';}
    if($q!==''){$where[]='(name LIKE ? OR city LIKE ? OR article LIKE ? OR source LIKE ? OR product_title LIKE ? OR phone LIKE ?)';$like='%'.$q.'%';array_push($args,$like,$like,$like,$like,$like,$like);}
    $countWhere=$where?' WHERE '.implode(' AND ',$where):'';$countStmt=kd_db()->prepare('SELECT COUNT(*) FROM site_leads'.$countWhere);$countStmt->execute($args);$filteredTotal=(int)$countStmt->fetchColumn();
    if($before>0){$where[]='id < ?';$args[]=$before;}$sqlWhere=$where?' WHERE '.implode(' AND ',$where):'';`;
api = replaceExactlyOnce(api, oldLeadWhere, newLeadWhere, 'server-side trust filtering and total count');

api = replaceExactlyOnce(
  api,
  `'hasMore'=>$hasMore,'status'=>$status?:'all','q'=>$q,'source'=>$source,'from'=>$from,'to'=>$to],'totalCount'=>array_sum($counts),'filteredTotal'=>count($leads)`,
  `'hasMore'=>$hasMore,'status'=>$status?:'all','q'=>$q,'source'=>$source,'from'=>$from,'to'=>$to,'trust'=>$trust],'totalCount'=>array_sum($counts),'filteredTotal'=>$filteredTotal`,
  'lead response filter metadata'
);

await writeFile(apiPath, api, 'utf8');

let admin = await readFile(adminPath, 'utf8');

const oldTrustCss = `.lead-stat.is-good{border-color:#cfe2cc;background:#edf6ec;color:#42623d}.lead-stat.is-warning{border-color:#ead3a1;background:#fff5df;color:#76591f}`;
const newTrustCss = `${oldTrustCss}.lead-stat[data-lead-trust]{cursor:pointer;font:inherit}.lead-stat[data-lead-trust]:hover{border-color:#c6933f}.lead-stat[data-lead-trust].active{outline:2px solid rgba(198,147,63,.26);outline-offset:1px}`;
admin = replaceExactlyOnce(admin, oldTrustCss, newTrustCss, 'trust filter styles');

admin = replaceExactlyOnce(
  admin,
  `  let activeFilter = 'all';`,
  `  let activeFilter = 'all';\n  let activeTrustFilter = '';`,
  'trust filter state'
);

admin = replaceExactlyOnce(
  admin,
  `      to: dateTo.value\n    };`,
  `      to: dateTo.value,\n      trust: activeTrustFilter\n    };`,
  'current trust filter state'
);

admin = replaceExactlyOnce(
  admin,
  `    const {q, source, from, to} = currentFilters();\n    return Boolean(q || source || from || to);`,
  `    const {q, source, from, to, trust} = currentFilters();\n    return Boolean(q || source || from || to || trust);`,
  'extra filter detection'
);

const oldTrustStats = `    stats.innerHTML = \`<span class="lead-stat">Новые <b>\${newCount}</b></span><span class="lead-stat">Связались <b>\${Number(counts.contacted)||0}</b></span><span class="lead-stat">Закрытые <b>\${Number(counts.done)||0}</b></span><span class="lead-stat">Архив <b>\${Number(counts.archived)||0}</b></span><span class="lead-stat is-good">✓ Проверено <b>\${verified}</b></span><span class="lead-stat is-warning">⚠ Проверить цену <b>\${review}</b></span><span class="lead-stat is-warning">Доставка уточнить <b>\${deliveryPending}</b></span>\`;`;
const newTrustStats = `    stats.innerHTML = \`<span class="lead-stat">Новые <b>\${newCount}</b></span><span class="lead-stat">Связались <b>\${Number(counts.contacted)||0}</b></span><span class="lead-stat">Закрытые <b>\${Number(counts.done)||0}</b></span><span class="lead-stat">Архив <b>\${Number(counts.archived)||0}</b></span><button type="button" class="lead-stat is-good \${activeTrustFilter==='verified'?'active':''}" data-lead-trust="verified" aria-pressed="\${activeTrustFilter==='verified'}">✓ Проверено <b>\${verified}</b></button><button type="button" class="lead-stat is-warning \${activeTrustFilter==='review'?'active':''}" data-lead-trust="review" aria-pressed="\${activeTrustFilter==='review'}">⚠ Проверить цену <b>\${review}</b></button><button type="button" class="lead-stat is-warning \${activeTrustFilter==='delivery'?'active':''}" data-lead-trust="delivery" aria-pressed="\${activeTrustFilter==='delivery'}">Доставка уточнить <b>\${deliveryPending}</b></button>\`;`;
admin = replaceExactlyOnce(admin, oldTrustStats, newTrustStats, 'clickable trust counters');

admin = replaceExactlyOnce(
  admin,
  `      const {q, source, from, to} = currentFilters();\n      if (q) params.set('q', q);\n      if (source) params.set('source', source);\n      if (from) params.set('from', from);\n      if (to) params.set('to', to);`,
  `      const {q, source, from, to, trust} = currentFilters();\n      if (q) params.set('q', q);\n      if (source) params.set('source', source);\n      if (from) params.set('from', from);\n      if (to) params.set('to', to);\n      if (trust) params.set('trust', trust);`,
  'trust query parameter'
);

const filtersListenerMarker = `  filters.forEach(button => button.addEventListener('click', async () => {`;
const trustListener = `  stats.addEventListener('click', async event => {\n    const button = event.target.closest('[data-lead-trust]');\n    if (!button) return;\n    const trust = String(button.dataset.leadTrust || '');\n    activeTrustFilter = activeTrustFilter === trust ? '' : trust;\n    await applyLeadFilters();\n  });\n\n${filtersListenerMarker}`;
admin = replaceExactlyOnce(admin, filtersListenerMarker, trustListener, 'trust counter click handler');

admin = replaceExactlyOnce(
  admin,
  `    dateTo.value = '';\n    await applyLeadFilters();`,
  `    dateTo.value = '';\n    activeTrustFilter = '';\n    await applyLeadFilters();`,
  'trust filter reset'
);

await writeFile(adminPath, admin, 'utf8');

const assertions = [
  [api.includes("$trust=trim((string)($_GET['trust']??''))"), 'server trust parameter missing'],
  [api.includes("$trust==='verified'") && api.includes("$trust==='review'") && api.includes("$trust==='delivery'"), 'server trust conditions missing'],
  [api.includes("SELECT COUNT(*) FROM site_leads") && api.includes("'filteredTotal'=>$filteredTotal"), 'accurate filtered total missing'],
  [admin.includes('data-lead-trust="verified"') && admin.includes('data-lead-trust="review"') && admin.includes('data-lead-trust="delivery"'), 'clickable trust filters missing'],
  [admin.includes("params.set('trust', trust)") && admin.includes("activeTrustFilter = activeTrustFilter === trust ? '' : trust"), 'trust filter binding missing']
];
for (const [ok, message] of assertions) {
  if (!ok) throw new Error(`Lead filters: ${message}`);
}

execFileSync('php', ['-l', apiPath], { stdio: 'inherit' });
console.log('Timeweb lead trust filters added successfully');
