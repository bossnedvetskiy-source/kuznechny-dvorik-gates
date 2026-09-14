<?php
declare(strict_types=1);

function kd_send_lead_email(array $lead): bool
{
    try {
        $cfg = kd_config();
        if (empty($cfg['mail_enabled'])) return false;

        $to = (string)($cfg['mail_to'] ?? '');
        $from = (string)($cfg['mail_user'] ?? '');
        if ($to === '' || $from === '') return false;

        $subject = 'Новая заявка с сайта Кузнечный Дворик';
        $body = "Новая заявка с сайта\n\n";
        foreach ($lead as $key => $value) {
            if ($value !== '' && $value !== null) {
                $body .= $key . ': ' . (string)$value . "\n";
            }
        }

        return mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, "From: {$from}\r\nContent-Type: text/plain; charset=UTF-8");
    } catch (Throwable $e) {
        error_log('Kuzdvor mail notification: ' . $e->getMessage());
        return false;
    }
}
