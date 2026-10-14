<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/bootstrap.php';
require __DIR__.'/manager-push.php';
try{
    kd_setting_set('manager_push_worker_seen',time(),'push-worker');
    kd_manager_push_reminders();
    echo json_encode(kd_manager_push_process(),JSON_UNESCAPED_UNICODE).PHP_EOL;
}catch(Throwable $e){fwrite(STDERR,'Manager push worker failed: '.$e->getMessage().PHP_EOL);exit(1);}
