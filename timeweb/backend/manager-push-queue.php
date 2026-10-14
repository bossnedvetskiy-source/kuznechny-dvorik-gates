<?php
declare(strict_types=1);

function kd_manager_push_queue_schema(): void
{
    static $ready=false;if($ready)return;
    kd_db()->exec("CREATE TABLE IF NOT EXISTS manager_push_jobs (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,event_key VARCHAR(180) NOT NULL,lead_id BIGINT UNSIGNED NOT NULL,endpoint_hash CHAR(64) NOT NULL,payload_json TEXT NOT NULL,attempts INT UNSIGNED NOT NULL DEFAULT 0,available_at DATETIME NOT NULL,locked_at DATETIME NULL,completed_at DATETIME NULL,last_error VARCHAR(200) NOT NULL DEFAULT '',UNIQUE KEY uq_push_event(event_key),KEY idx_push_due(completed_at,available_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $ready=true;
}

function kd_manager_push_queue_event(int $leadId,string $event,array $payload): void
{
    kd_manager_schema();kd_manager_push_ensure_table();kd_manager_push_queue_schema();
    $stmt=kd_db()->prepare("SELECT s.endpoint_hash FROM manager_push_subscriptions s JOIN admin_auth a ON a.id=s.admin_id LEFT JOIN lead_workflow w ON w.lead_id=? WHERE a.disabled=0 AND (a.role IN ('admin','manager') OR (a.role='surveyor' AND w.assigned_to=a.id))");$stmt->execute([$leadId]);
    $insert=kd_db()->prepare('INSERT IGNORE INTO manager_push_jobs (event_key,lead_id,endpoint_hash,payload_json,available_at) VALUES (?,?,?,?,UTC_TIMESTAMP())');
    foreach($stmt->fetchAll() as $row)$insert->execute([$event.':'.$row['endpoint_hash'],$leadId,$row['endpoint_hash'],json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
    static $fallbackRegistered=false;
    $seen=(int)kd_setting_get('manager_push_worker_seen',0);
    if(PHP_SAPI!=='cli'&&!$fallbackRegistered&&$seen<time()-180){$fallbackRegistered=true;register_shutdown_function(static function():void{try{kd_manager_push_process(20,80);}catch(Throwable $e){error_log('Kuzdvor push fallback: '.$e->getMessage());}});}

}

function kd_manager_push_queue_lead(int $leadId): void
{
    kd_manager_push_queue_event($leadId,'lead:'.$leadId,['type'=>'lead','leadId'=>$leadId,'title'=>'Новая заявка с сайта','body'=>'Откройте заявку №'.$leadId.' в КД Менеджер.','url'=>'/manager?lead='.$leadId,'tag'=>'kuzdvor-lead-'.$leadId]);

}

function kd_manager_push_reminders(): void
{
    kd_manager_schema();
    $rows=kd_db()->query("SELECT lead_id,next_action_at,time_zone,assigned_to,revision FROM lead_workflow WHERE stage='measurement_scheduled' AND action_type='measurement' AND next_action_at<>''")->fetchAll();
    foreach($rows as $row){
        try{$when=new DateTimeImmutable($row['next_action_at'],new DateTimeZone($row['time_zone']));}catch(Throwable){continue;}
        $seconds=$when->getTimestamp()-time();if($seconds<0||$seconds>3600)continue;
        $id=(int)$row['lead_id'];$revision=(int)$row['revision'];
        kd_manager_push_queue_event($id,'reminder:'.$id.':'.hash('sha256',$row['next_action_at'].'|'.$row['time_zone'].'|'.($row['assigned_to']??'')),['type'=>'reminder','leadId'=>$id,'revision'=>$revision,'timeZone'=>$row['time_zone'],'nextActionAt'=>$row['next_action_at'],'title'=>'Скоро замер','body'=>'Заявка №'.$id.' · '.$when->format('d.m H:i').' ('.$row['time_zone'].')','url'=>'/manager?lead='.$id,'tag'=>'kuzdvor-reminder-'.$id]);
    }
}

function kd_manager_push_process(int $limit=20,int $budgetSeconds=50): array
{
    kd_manager_schema();kd_manager_push_ensure_table();kd_manager_push_queue_schema();
    $db=kd_db();$sent=0;$failed=0;$start=time();
    for($i=0;$i<$limit && time()-$start<$budgetSeconds;$i++){
        $db->beginTransaction();
        try{$job=$db->query('SELECT * FROM manager_push_jobs WHERE completed_at IS NULL AND attempts<6 AND available_at<=UTC_TIMESTAMP() AND (locked_at IS NULL OR locked_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 2 MINUTE)) ORDER BY id LIMIT 1 FOR UPDATE')->fetch();
            if(!$job){$db->commit();break;}
            $db->prepare('UPDATE manager_push_jobs SET locked_at=UTC_TIMESTAMP(),attempts=attempts+1 WHERE id=?')->execute([$job['id']]);$db->commit();
        }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
        $stmt=$db->prepare("SELECT s.*,a.disabled,a.role,w.assigned_to,w.stage,w.revision,w.next_action_at,w.time_zone FROM manager_push_subscriptions s JOIN admin_auth a ON a.id=s.admin_id LEFT JOIN lead_workflow w ON w.lead_id=? WHERE s.endpoint_hash=?");$stmt->execute([$job['lead_id'],$job['endpoint_hash']]);$subscription=$stmt->fetch();
        $payload=json_decode($job['payload_json'],true);$cancelled=!$subscription||$subscription['disabled']||($subscription['role']==='surveyor'&&(int)($subscription['assigned_to']??0)!==(int)$subscription['admin_id']);
        if(($payload['type']??'')==='reminder' && (!$subscription||$subscription['stage']!=='measurement_scheduled'||$subscription['next_action_at']!==$payload['nextActionAt']||$subscription['time_zone']!==$payload['timeZone']))$cancelled=true;
        if($cancelled){$db->prepare('UPDATE manager_push_jobs SET completed_at=UTC_TIMESTAMP(),locked_at=NULL WHERE id=?')->execute([$job['id']]);continue;}
        try{$status=kd_manager_push_http($subscription['endpoint'],kd_manager_vapid_keys(),$subscription,$payload);kd_manager_push_record_result($job['endpoint_hash'],$status);
            if($status>=200&&$status<300){$db->prepare('UPDATE manager_push_jobs SET completed_at=UTC_TIMESTAMP(),locked_at=NULL,last_error=\'\' WHERE id=?')->execute([$job['id']]);$sent++;continue;}
            if($status===404||$status===410){$db->prepare('DELETE FROM manager_push_subscriptions WHERE endpoint_hash=?')->execute([$job['endpoint_hash']]);$db->prepare('UPDATE manager_push_jobs SET completed_at=UTC_TIMESTAMP(),locked_at=NULL,last_error=? WHERE id=?')->execute(['Subscription expired',$job['id']]);continue;}
            throw new RuntimeException('Push HTTP '.$status);
        }catch(Throwable $e){$failed++;$delay=min(3600,30*(2**(int)$job['attempts']));$db->prepare('UPDATE manager_push_jobs SET locked_at=NULL,available_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? SECOND),last_error=? WHERE id=?')->execute([$delay,mb_substr($e->getMessage(),0,200),$job['id']]);}
    }
    $db->exec("DELETE FROM manager_push_jobs WHERE (completed_at IS NOT NULL AND completed_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 7 DAY)) OR (attempts>=6 AND available_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 7 DAY))");
    return ['sent'=>$sent,'failed'=>$failed];
}
