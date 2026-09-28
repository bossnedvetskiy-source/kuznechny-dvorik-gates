<?php
declare(strict_types=1);

function kd_send_lead_email(array $lead): bool
{
    try {
        $cfg = kd_config();
        if (empty($cfg['mail_enabled'])) return false;

        $host = (string)($cfg['mail_host'] ?? 'smtp.mail.ru');
        $port = (int)($cfg['mail_port'] ?? 465);
        $user = (string)($cfg['mail_user'] ?? '');
        $password = (string)($cfg['mail_password'] ?? '');
        $to = (string)($cfg['mail_to'] ?? '');

        if ($user === '' || $password === '' || $to === '') return false;

        $subject = 'Новая заявка с сайта Кузнечный Дворик';
        $body = "Новая заявка с сайта\n\n";
        foreach ($lead as $key => $value) {
            if ($value !== '' && $value !== null) {
                $body .= $key . ': ' . (string)$value . "\n";
            }
        }

        $socket = stream_socket_client('ssl://' . $host . ':' . $port, $errno, $errstr, 10);
        if (!$socket) return false;

        $read = static function() use ($socket): string { return (string)fgets($socket, 512); };
        $send = static function(string $line) use ($socket): void { fwrite($socket, $line . "\r\n"); };

        $read();
        $send('EHLO kuzdvor.tw1.ru');
        $read();
        $send('AUTH LOGIN');
        $read();
        $send(base64_encode($user));
        $read();
        $send(base64_encode($password));
        $read();
        $send('MAIL FROM:<' . $user . '>');
        $read();
        $send('RCPT TO:<' . $to . '>');
        $read();
        $send('DATA');
        $read();

        $message = 'From: ' . $user . "\r\n";
        $message .= 'To: ' . $to . "\r\n";
        $message .= 'Subject: =?UTF-8?B?' . base64_encode($subject) . "?=\r\n";
        $message .= "Content-Type: text/plain; charset=UTF-8\r\n\r\n";
        $message .= $body;
        fwrite($socket, $message . "\r\n.\r\n");
        $read();
        $send('QUIT');
        fclose($socket);

        return true;
    } catch (Throwable $e) {
        error_log('Kuzdvor mail notification: ' . $e->getMessage());
        return false;
    }
}
