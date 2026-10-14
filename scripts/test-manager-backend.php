<?php
declare(strict_types=1);

// Uses an isolated CI MySQL database, never the site's configured database.
final class HttpResult extends RuntimeException {
    public function __construct(public array $body,public int $status){parent::__construct('HTTP '.$status);}
}
$dsn=getenv('KD_TEST_DB_DSN');if(!$dsn){fwrite(STDERR,"Set KD_TEST_DB_DSN to an isolated test database\n");exit(1);}
$pdo=new PDO($dsn,(string)getenv('KD_TEST_DB_USER'),(string)getenv('KD_TEST_DB_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
$pdo->exec("SET time_zone='+00:00'");
function kd_db(): PDO{return $GLOBALS['pdo'];}
function kd_json(array $body,int $status=200): never{throw new HttpResult($body,$status);}
function kd_json_body(int $limit): array{return $GLOBALS['body'];}
function kd_require_admin(): array{return $GLOBALS['session'];}
function kd_method(): string{return 'GET';}
require __DIR__.'/../timeweb/backend/manager-workflow.php';
require __DIR__.'/../timeweb/backend/web-push-payload.php';
foreach(preg_split('/;\s*(?:\r?\n|$)/',(string)file_get_contents(__DIR__.'/../timeweb/backend/schema.mysql.sql')) as $statement)if(trim($statement)!=='')$pdo->exec($statement);
kd_manager_schema();kd_manager_schema();
$pdo->exec("INSERT INTO admin_auth (id,username,password_hash,role) VALUES (1,'admin','fixture','admin'),(2,'surveyor','fixture','surveyor'),(3,'other','fixture','surveyor')");
$pdo->exec("INSERT INTO site_leads (id,phone,city,configuration_json,comment,message) VALUES (1,'79370000001','Объект 1','{}','',''),(2,'79370000002','Объект 2','{}','','')");
$session=['admin_id'=>1,'username'=>'admin','role'=>'admin'];$body=[];
function check(bool $ok,string $message): void{if(!$ok)throw new RuntimeException($message);echo "PASS $message\n";}
function save(array $payload,int $expectedStatus=200,string $id='1'): array{
    $GLOBALS['body']=$payload;try{kd_manager_workflow_save($id);}catch(HttpResult $r){check($r->status===$expectedStatus,'workflow HTTP '.$expectedStatus);return $r->body;}throw new RuntimeException('Missing response');
}
$first=save(['stage'=>'contacted','note'=>'Сохранить заметку','lossReason'=>'Причина','expectedRevision'=>0]);check($first['revision']===1,'first revision');
$second=save(['stage'=>'production','expectedRevision'=>1]);check($second['note']==='Сохранить заметку'&&$second['lossReason']==='Причина','missing fields preserve notes');
save(['stage'=>'new','note'=>'Устаревшая версия','expectedRevision'=>1],409);check($pdo->query('SELECT stage FROM lead_workflow WHERE lead_id=1')->fetchColumn()==='production','conflict does not overwrite stage');
save(['stage'=>'measurement_scheduled','nextActionAt'=>'','expectedRevision'=>2],400);
save(['stage'=>'measurement_scheduled','nextActionAt'=>'2030-02-31T10:00','expectedRevision'=>2],400);
save(['stage'=>'measurement_scheduled','nextActionAt'=>'2020-01-01T10:00','expectedRevision'=>2],400);
save(['stage'=>'lost','lossReason'=>'','expectedRevision'=>2],400);
save(['stage'=>'contacted','assignedTo'=>2,'expectedRevision'=>2]);
$session=['admin_id'=>3,'username'=>'other','role'=>'surveyor'];save(['stage'=>'new','expectedRevision'=>3],404);
$session=['admin_id'=>2,'username'=>'surveyor','role'=>'surveyor'];save(['stage'=>'contacted','assignedTo'=>3,'expectedRevision'=>3],403);
save(['stage'=>'contacted','note'=>'Замерщик видит свой объект','expectedRevision'=>3]);
$_GET=['ids'=>'1,2'];try{kd_manager_workflows();}catch(HttpResult $r){$values=(array)$r->body['workflows'];check(array_keys($values)===[1],'surveyor sees only assigned workflows');}
$session=['admin_id'=>1,'username'=>'admin','role'=>'admin'];
$pdo->exec("CREATE TRIGGER fail_status BEFORE UPDATE ON site_leads FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected failure'");
try{save(['stage'=>'contract','note'=>'Не должна сохраниться','expectedRevision'=>4]);throw new RuntimeException('Expected injected error');}catch(PDOException){}
check($pdo->query('SELECT admin_note FROM lead_workflow WHERE lead_id=1')->fetchColumn()==='Замерщик видит свой объект','transaction rolls back both records');
$pdo->exec('DROP TRIGGER fail_status');
$when='2030-01-01T10:00';save(['stage'=>'measurement_scheduled','nextActionAt'=>$when,'assignedTo'=>2,'expectedRevision'=>4]);
save(['stage'=>'measurement_scheduled','nextActionAt'=>$when,'assignedTo'=>2,'expectedRevision'=>0],409,'2');
check((int)$pdo->query('SELECT COUNT(*) FROM lead_workflow_history')->fetchColumn()===5,'only committed changes enter history');

// Exercise queue targeting and retry transitions without making any network
// request or contacting a real push provider.
function kd_manager_push_ensure_table(): void{}
function kd_setting_get(string $key,mixed $default=null): mixed{return time();}
function kd_manager_vapid_keys(): array{return [];}
function kd_manager_push_record_result(string $hash,int $status): void{}
$transportStatus=201;$delivered=[];
function kd_manager_push_http(string $endpoint,array $keys,array $subscription,array $payload): int{$GLOBALS['delivered'][]=['adminId'=>(int)$subscription['admin_id'],'payload'=>$payload];return $GLOBALS['transportStatus'];}
require __DIR__.'/../timeweb/backend/manager-push-queue.php';
$stmt=$pdo->prepare("INSERT INTO manager_push_subscriptions (endpoint_hash,admin_id,endpoint,p256dh,auth_token) VALUES (?,?,?,'','')");
for($i=1;$i<=3;$i++){$endpoint='https://fcm.googleapis.com/fcm/send/fixture-'.$i;$stmt->execute([hash('sha256',$endpoint),$i,$endpoint]);}
kd_manager_push_queue_event(1,'fixture-lead',['type'=>'lead','leadId'=>1]);
kd_manager_push_queue_event(1,'fixture-lead',['type'=>'lead','leadId'=>1]);
check((int)$pdo->query('SELECT COUNT(*) FROM manager_push_jobs')->fetchColumn()===2,'queue targets administrator and assigned surveyor without duplicates');
$result=kd_manager_push_process();check($result['sent']===2,'queue sends all eligible subscriptions');
$transportStatus=503;kd_manager_push_queue_event(1,'fixture-retry',['type'=>'lead','leadId'=>1]);kd_manager_push_process();
check((int)$pdo->query("SELECT COUNT(*) FROM manager_push_jobs WHERE completed_at IS NULL AND attempts=1 AND available_at>UTC_TIMESTAMP() AND locked_at IS NULL")->fetchColumn()===2,'temporary failure schedules retry and releases lock');
$transportStatus=201;$delivered=[];kd_manager_push_queue_event(1,'fixture-revoked',['type'=>'lead','leadId'=>1]);$pdo->exec('UPDATE lead_workflow SET assigned_to=3 WHERE lead_id=1');kd_manager_push_process();
check(count($delivered)===1&&$delivered[0]['adminId']===1,'revoked surveyor is excluded at delivery time');
$stmt=$pdo->prepare("UPDATE lead_workflow SET next_action_at=?,time_zone='UTC',stage='measurement_scheduled' WHERE lead_id=1");$stmt->execute([gmdate('Y-m-d\TH:i',time()+1800)]);kd_manager_push_reminders();
$reminders=(int)$pdo->query("SELECT COUNT(*) FROM manager_push_jobs WHERE event_key LIKE 'reminder:%'")->fetchColumn();kd_manager_push_reminders();check($reminders===2&&(int)$pdo->query("SELECT COUNT(*) FROM manager_push_jobs WHERE event_key LIKE 'reminder:%'")->fetchColumn()===2,'reminder scheduling is idempotent');
$pdo->exec("UPDATE lead_workflow SET stage='completed' WHERE lead_id=1");$delivered=[];kd_manager_push_process();check(count($delivered)===0,'cancelled appointment reminder is not delivered');

check(kd_push_endpoint_valid('https://fcm.googleapis.com/fcm/send/fixture'),'trusted push host accepted');
foreach(['https://127.0.0.1/','https://fcm.googleapis.com.attacker.test/','https://user@fcm.googleapis.com/','https://fcm.googleapis.com:8443/','http://fcm.googleapis.com/'] as $url)check(!kd_push_endpoint_valid($url),'untrusted push address rejected');

// Decrypt an encrypted push with the independent receiver private key. This
// verifies ECDH, HKDF context, record header, delimiter and authenticated payload.
$receiver=openssl_pkey_new(['private_key_type'=>OPENSSL_KEYTYPE_EC,'curve_name'=>'prime256v1']);$details=openssl_pkey_get_details($receiver);$public="\x04".str_pad($details['ec']['x'],32,"\0",STR_PAD_LEFT).str_pad($details['ec']['y'],32,"\0",STR_PAD_LEFT);$auth=random_bytes(16);
$encode=fn(string $value)=>rtrim(strtr(base64_encode($value),'+/','-_'),'=');$payload=['type'=>'test','testId'=>'fixture-123456789','title'=>'Проверка'];
$encrypted=kd_push_encrypt(['p256dh'=>$encode($public),'auth_token'=>$encode($auth)],$payload);
$salt=substr($encrypted,0,16);check(unpack('N',substr($encrypted,16,4))[1]===4096&&ord($encrypted[20])===65,'push record header');$sender=substr($encrypted,21,65);
$der=hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200').$sender;$pem="-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode($der),64,"\n")."-----END PUBLIC KEY-----\n";
$secret=openssl_pkey_derive($pem,$receiver,32);$ikm=hash_hkdf('sha256',$secret,32,"WebPush: info\0".$public.$sender,$auth);$key=hash_hkdf('sha256',$ikm,16,"Content-Encoding: aes128gcm\0",$salt);$nonce=hash_hkdf('sha256',$ikm,12,"Content-Encoding: nonce\0",$salt);
$plain=openssl_decrypt(substr($encrypted,86,-16),'aes-128-gcm',$key,OPENSSL_RAW_DATA,$nonce,substr($encrypted,-16));check(is_string($plain)&&str_ends_with($plain,"\x02"),'push authenticates and decrypts');check(json_decode(substr($plain,0,-1),true)===$payload,'push payload survives encryption');
echo "Manager backend and encryption checks passed\n";
