<?php
declare(strict_types=1);

// Idempotent upgrade for existing Timeweb installations. No existing users or
// leads are reassigned; administrators retain their current access.
function kd_manager_schema(): void
{
    static $ready = false;
    if ($ready) return;
    $columns = [
        'admin_auth' => ['role'=>"VARCHAR(20) NOT NULL DEFAULT 'admin'", 'disabled'=>'TINYINT(1) NOT NULL DEFAULT 0'],
        'lead_workflow' => ['revision'=>'INT UNSIGNED NOT NULL DEFAULT 0', 'action_type'=>"VARCHAR(20) NOT NULL DEFAULT 'measurement'", 'time_zone'=>"VARCHAR(80) NOT NULL DEFAULT 'Asia/Yekaterinburg'", 'address'=>"VARCHAR(500) NOT NULL DEFAULT ''", 'assigned_to'=>'INT UNSIGNED NULL', 'measurement_json'=>'LONGTEXT NULL'],
    ];
    foreach ($columns as $table=>$definitions) {
        $existing = array_column(kd_db()->query('SHOW COLUMNS FROM '.$table)->fetchAll(), 'Field');
        foreach ($definitions as $name=>$definition) {
            if (in_array($name, $existing, true)) continue;
            try { kd_db()->exec("ALTER TABLE $table ADD COLUMN $name $definition"); }
            catch (PDOException $e) { if ((int)($e->errorInfo[1] ?? 0) !== 1060) throw $e; }
        }
    }
    kd_db()->exec("CREATE TABLE IF NOT EXISTS lead_workflow_history (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,lead_id BIGINT UNSIGNED NOT NULL,admin_id INT UNSIGNED NOT NULL,revision INT UNSIGNED NOT NULL,value_json LONGTEXT NOT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY idx_workflow_history (lead_id,id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $ready = true;
}

function kd_manager_user(array $session): array
{
    return ['id'=>(int)$session['admin_id'],'username'=>(string)($session['username']??''),'role'=>(string)($session['role']??'admin')];
}

function kd_manager_lead_access(int $leadId, bool $lock = false): array
{
    $session = kd_require_admin();
    $stmt = kd_db()->prepare('SELECT l.id,l.category,w.assigned_to FROM site_leads l LEFT JOIN lead_workflow w ON w.lead_id=l.id WHERE l.id=?'.($lock?' FOR UPDATE':''));
    $stmt->execute([$leadId]); $lead=$stmt->fetch();
    if (!$lead || ($session['role']==='surveyor' && (int)($lead['assigned_to']??0)!==(int)$session['admin_id'])) kd_json(['error'=>'Заявка недоступна'],404);
    return $lead;
}

function kd_manager_workflow_value(array $r): array
{
    $stage=$r['stage']?:($r['status']==='done'?'completed':($r['status']==='archived'?'lost':($r['status']==='contacted'?'contacted':'new')));
    return ['stage'=>$stage,'note'=>(string)($r['admin_note']??''),'nextActionAt'=>(string)($r['next_action_at']??''),'lossReason'=>(string)($r['loss_reason']??''),'updatedAt'=>(string)($r['updated_at']??''),'revision'=>(int)($r['revision']??0),'actionType'=>(string)($r['action_type']??'measurement'),'timeZone'=>(string)($r['time_zone']??'Asia/Yekaterinburg'),'address'=>(string)($r['address']??''),'assignedTo'=>isset($r['assigned_to'])?(int)$r['assigned_to']:null,'measurement'=>json_decode((string)($r['measurement_json']??'null'),true),'color'=>(string)($r['color']??'')];
}

function kd_manager_workflow_validate(array $value): ?string
{
    $allowed=['new','contacted','measurement_scheduled','measurement_done','contract','production','installation','completed','lost'];
    if (!in_array($value['stage'],$allowed,true)) return 'Некорректный этап';
    if (!in_array($value['actionType'],['measurement','call','other'],true)) return 'Некорректное следующее действие';
    if (!in_array($value['timeZone'],DateTimeZone::listIdentifiers(),true)) return 'Некорректный часовой пояс';
    if ($value['nextActionAt']!=='') {
        $date=DateTimeImmutable::createFromFormat('!Y-m-d\TH:i',$value['nextActionAt'],new DateTimeZone($value['timeZone']));
        if (!$date || $date->format('Y-m-d\TH:i')!==$value['nextActionAt']) return 'Укажите корректную дату и время';
    }
    if ($value['stage']==='measurement_scheduled' && ($value['nextActionAt']===''||$value['actionType']!=='measurement')) return 'Для назначения замера нужны дата и действие «Замер»';
    if ($value['stage']==='lost' && $value['lossReason']==='') return 'Укажите причину отказа';
    return null;
}

function kd_manager_workflows(): never
{
    $session=kd_require_admin();
    $ids=array_slice(array_values(array_filter(array_map('intval',explode(',',(string)($_GET['ids']??''))),fn($v)=>$v>0)),0,200);
    if (!$ids) kd_json(['workflows'=>new stdClass()]);
    $marks=implode(',',array_fill(0,count($ids),'?'));
    $sql="SELECT l.id,l.status,l.color,w.* FROM site_leads l LEFT JOIN lead_workflow w ON w.lead_id=l.id WHERE l.id IN ($marks)";
    if ($session['role']==='surveyor') { $sql.=' AND w.assigned_to=?';$ids[]=(int)$session['admin_id']; }
    $stmt=kd_db()->prepare($sql);$stmt->execute($ids);$out=[];
    foreach($stmt->fetchAll() as $r)$out[(string)$r['id']]=kd_manager_workflow_value($r);
    kd_json(['workflows'=>(object)$out]);
}

function kd_manager_workflow_save(string $id): never
{
    $leadId=(int)$id;if($leadId<=0)kd_json(['error'=>'Заявка недоступна'],404);
    $body=kd_json_body(2*1024*1024);$session=kd_require_admin();$db=kd_db();
    $db->beginTransaction();
    try {
        kd_manager_lead_access($leadId,true);
        $stmt=$db->prepare('SELECT l.status,l.color,w.* FROM site_leads l LEFT JOIN lead_workflow w ON w.lead_id=l.id WHERE l.id=?');$stmt->execute([$leadId]);$value=kd_manager_workflow_value($stmt->fetch());$previous=$value;
        if (isset($body['expectedRevision']) && (int)$body['expectedRevision']!==$value['revision']) { $db->rollBack();kd_json(['error'=>'Заявка изменена другим сотрудником. Проверьте актуальные данные.','workflow'=>$value],409); }
        // Missing fields are preserved, rather than turned into empty strings.
        foreach(['stage'=>60,'note'=>1200,'nextActionAt'=>40,'lossReason'=>400,'actionType'=>20,'timeZone'=>80,'address'=>500] as $key=>$max)if(array_key_exists($key,$body))$value[$key]=mb_substr(trim((string)$body[$key]),0,$max);
        if (array_key_exists('assignedTo',$body)) {
            if ($session['role']==='surveyor') { $db->rollBack();kd_json(['error'=>'Назначать исполнителя может только менеджер'],403); }
            $assigned=(int)$body['assignedTo'];
            if($assigned>0){$stmt=$db->prepare("SELECT id FROM admin_auth WHERE id=? AND disabled=0 AND role IN ('surveyor','manager','admin')");$stmt->execute([$assigned]);if(!$stmt->fetchColumn()){$db->rollBack();kd_json(['error'=>'Исполнитель недоступен'],400);}}
            $value['assignedTo']=$assigned?:null;
        }
        if(array_key_exists('measurement',$body)){
            if(!is_array($body['measurement'])){$db->rollBack();kd_json(['error'=>'Некорректные данные замера'],400);}
            $m=$body['measurement'];$clean=[];
            foreach(['width','height','wicketWidth','wicketHeight','diagonal1','diagonal2','slope'] as $key){$v=trim((string)($m[$key]??''));if($v!==''&&(!is_numeric(str_replace(',','.',$v))||abs((float)str_replace(',','.',$v))>1000)){$db->rollBack();kd_json(['error'=>'Некорректный размер'],400);}$clean[$key]=$v;}
            foreach(['posts','opening','obstacles','notes','sketch'] as $key)$clean[$key]=mb_substr(trim((string)($m[$key]??'')),0,4000);
            $clean['photos']=[];
            foreach(array_slice(is_array($m['photos']??null)?$m['photos']:[],0,4) as $photo){if(!is_string($photo)||strlen($photo)>400000||!preg_match('#^data:image/jpeg;base64,[A-Za-z0-9+/=]+$#D',$photo)){$db->rollBack();kd_json(['error'=>'Некорректная фотография'],400);}$clean['photos'][]=$photo;}
            $value['measurement']=$clean;
        }
        if($error=kd_manager_workflow_validate($value)){$db->rollBack();kd_json(['error'=>$error],400);}
        if($value['stage']==='measurement_scheduled' && ($previous['stage']!=='measurement_scheduled'||$value['nextActionAt']!==$previous['nextActionAt']||$value['timeZone']!==$previous['timeZone'])){
            $appointment=new DateTimeImmutable($value['nextActionAt'],new DateTimeZone($value['timeZone']));
            if($appointment->getTimestamp()<time()){$db->rollBack();kd_json(['error'=>'Нельзя назначить новый замер в прошлом'],400);}
            if($value['assignedTo']){
                // Serialize schedules for a single employee to prevent concurrent
                // assignments bypassing the exact-time collision check.
                $stmt=$db->prepare('SELECT id FROM admin_auth WHERE id=? FOR UPDATE');$stmt->execute([$value['assignedTo']]);
                $stmt=$db->prepare("SELECT lead_id,next_action_at,time_zone FROM lead_workflow WHERE assigned_to=? AND lead_id<>? AND stage='measurement_scheduled' AND action_type='measurement'");$stmt->execute([$value['assignedTo'],$leadId]);
                foreach($stmt->fetchAll() as $other){try{$otherDate=new DateTimeImmutable($other['next_action_at'],new DateTimeZone($other['time_zone']));}catch(Throwable){continue;}if($otherDate->getTimestamp()===$appointment->getTimestamp()){$db->rollBack();kd_json(['error'=>'На это время у исполнителя уже назначен замер №'.$other['lead_id']],409);}}
            }
        }
        if($value['stage']==='measurement_done' && $previous['stage']!=='measurement_done'){
            $measurement=$value['measurement']??[];
            if($value['address']===''||empty($measurement['width'])||empty($measurement['height'])||trim((string)($measurement['posts']??''))===''){$db->rollBack();kd_json(['error'=>'Заполните адрес, фактические размеры и состояние столбов'],400);}
        }
        $revision=$value['revision']+1;
        $stmt=$db->prepare('INSERT INTO lead_workflow (lead_id,stage,admin_note,next_action_at,loss_reason,action_type,time_zone,address,assigned_to,measurement_json,revision,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE stage=VALUES(stage),admin_note=VALUES(admin_note),next_action_at=VALUES(next_action_at),loss_reason=VALUES(loss_reason),action_type=VALUES(action_type),time_zone=VALUES(time_zone),address=VALUES(address),assigned_to=VALUES(assigned_to),measurement_json=VALUES(measurement_json),revision=VALUES(revision),updated_at=UTC_TIMESTAMP()');
        $stmt->execute([$leadId,$value['stage'],$value['note'],$value['nextActionAt'],$value['lossReason'],$value['actionType'],$value['timeZone'],$value['address'],$value['assignedTo'],json_encode($value['measurement'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$revision]);
        $coarse=$value['stage']==='new'?'new':(in_array($value['stage'],['completed','lost'],true)?'done':'contacted');$db->prepare("UPDATE site_leads SET status=IF(status='archived',status,?),updated_at=UTC_TIMESTAMP() WHERE id=?")->execute([$coarse,$leadId]);
        $value['revision']=$revision;$value['updatedAt']=gmdate('Y-m-d H:i:s');
        $db->prepare('INSERT INTO lead_workflow_history (lead_id,admin_id,revision,value_json) VALUES (?,?,?,?)')->execute([$leadId,$session['admin_id'],$revision,json_encode($value,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
        $db->commit();kd_json(['ok'=>true,'id'=>$leadId]+$value);
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}

function kd_manager_team(): never
{
    $session=kd_require_admin();
    if($session['role']==='surveyor')kd_json(['users'=>[]]);
    if(kd_method()==='POST'){
        if($session['role']!=='admin')kd_json(['error'=>'Недостаточно прав'],403);
        $body=kd_json_body(4096);$username=trim((string)($body['username']??''));$password=(string)($body['password']??'');$role=(string)($body['role']??'surveyor');
        if(!preg_match('/^[A-Za-z0-9_.-]{3,120}$/D',$username)||strlen($password)<12||strlen($password)>200||!in_array($role,['manager','surveyor'],true))kd_json(['error'=>'Логин: 3–120 латинских символов. Пароль: не менее 12 символов.'],400);
        $stmt=kd_db()->prepare('INSERT INTO admin_auth (username,password_hash,role) VALUES (?,?,?)');
        try{$stmt->execute([$username,password_hash($password,PASSWORD_DEFAULT),$role]);}catch(PDOException $e){if((int)($e->errorInfo[1]??0)===1062)kd_json(['error'=>'Этот логин уже занят'],409);throw $e;}
        kd_json(['ok'=>true,'id'=>(int)kd_db()->lastInsertId()]);
    }
    if(kd_method()==='DELETE'){
        if($session['role']!=='admin')kd_json(['error'=>'Недостаточно прав'],403);
        $body=kd_json_body(4096);$id=(int)($body['id']??0);
        if($id<1||$id===(int)$session['admin_id'])kd_json(['error'=>'Нельзя отключить собственную учётную запись'],400);
        $stmt=kd_db()->prepare("UPDATE admin_auth SET disabled=1 WHERE id=? AND role IN ('manager','surveyor')");$stmt->execute([$id]);
        kd_db()->prepare('DELETE FROM admin_sessions WHERE admin_id=?')->execute([$id]);
        kd_db()->prepare('DELETE FROM manager_push_subscriptions WHERE admin_id=?')->execute([$id]);
        kd_json(['ok'=>true]);
    }
    $rows=kd_db()->query('SELECT id,username,role FROM admin_auth WHERE disabled=0 ORDER BY username')->fetchAll();
    kd_json(['users'=>array_map(fn($r)=>['id'=>(int)$r['id'],'username'=>$r['username'],'role'=>$r['role']],$rows)]);
}
