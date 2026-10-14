<?php
declare(strict_types=1);

function kd_push_decode(string $value): string
{
    $decoded=base64_decode(strtr($value,'-_','+/'),true);
    if($decoded===false)throw new RuntimeException('Некорректный ключ push');
    return $decoded;
}

function kd_push_expand(string $prk,string $info,int $length): string
{
    return substr(hash_hmac('sha256',$info."\x01",$prk,true),0,$length);
}

// RFC 8291, aes128gcm single-record Web Push message. The receiver public key
// is converted to SubjectPublicKeyInfo; the private ephemeral key never leaves PHP.
function kd_push_encrypt(array $subscription,array $payload): string
{
    $receiver=kd_push_decode((string)$subscription['p256dh']);$auth=kd_push_decode((string)$subscription['auth_token']);
    if(strlen($receiver)!==65||$receiver[0]!=="\x04"||strlen($auth)!==16)throw new RuntimeException('Некорректные ключи подписки');
    $der=hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200').$receiver;
    $pem="-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode($der),64,"\n")."-----END PUBLIC KEY-----\n";
    $ephemeral=openssl_pkey_new(['private_key_type'=>OPENSSL_KEYTYPE_EC,'curve_name'=>'prime256v1']);
    if($ephemeral===false)throw new RuntimeException('Не удалось создать ключ push');
    $details=openssl_pkey_get_details($ephemeral);$sender="\x04".str_pad($details['ec']['x'],32,"\0",STR_PAD_LEFT).str_pad($details['ec']['y'],32,"\0",STR_PAD_LEFT);
    $secret=openssl_pkey_derive($pem,$ephemeral,32);if($secret===false)throw new RuntimeException('Не удалось согласовать ключ push');
    $prk=hash_hmac('sha256',$secret,$auth,true);
    $ikm=kd_push_expand($prk,"WebPush: info\0".$receiver.$sender,32);
    $salt=random_bytes(16);$prk=hash_hmac('sha256',$ikm,$salt,true);
    $key=kd_push_expand($prk,"Content-Encoding: aes128gcm\0",16);$nonce=kd_push_expand($prk,"Content-Encoding: nonce\0",12);
    $plain=json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)."\x02";
    if(strlen($plain)>3993)throw new RuntimeException('Слишком большой push payload');
    $tag='';$encrypted=openssl_encrypt($plain,'aes-128-gcm',$key,OPENSSL_RAW_DATA,$nonce,$tag,'',16);
    if($encrypted===false)throw new RuntimeException('Не удалось зашифровать push');
    return $salt.pack('N',4096).chr(65).$sender.$encrypted.$tag;
}

function kd_push_endpoint_valid(string $endpoint): bool
{
    $url=parse_url($endpoint);if(!$url||($url['scheme']??'')!=='https'||isset($url['user'])||isset($url['pass'])||isset($url['fragment'])||(isset($url['port'])&&(int)$url['port']!==443))return false;
    $host=strtolower((string)($url['host']??''));
    return in_array($host,['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'],true)||str_ends_with($host,'.notify.windows.com');
}
