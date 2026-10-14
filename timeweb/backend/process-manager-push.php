<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/bootstrap.php';
require __DIR__.'/manager-push.php';
try{
    kd_manager_push_reminders();
    $result=kd_manager_push_process();
    kd_setting_set('manager_push_worker_seen',time(),'push-worker');
    echo json_encode($result,JSON_UNESCAPED_UNICODE).PHP_EOL;
}catch(Throwable $e){fwrite(STDERR,'Manager push worker failed: '.$e->getMessage().PHP_EOL);exit(1);}
