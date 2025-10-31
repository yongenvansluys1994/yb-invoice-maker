<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/util.php';

if (!is_logged_in()) {
  http_response_code(401);
  echo json_encode(['message' => 'Unauthorized']);
  exit;
}

header('Content-Type: application/json');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($_POST['action'] ?? 'list');

// PHPMailer manual include
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
require_once __DIR__ . '/phpmailer/src/PHPMailer.php';
require_once __DIR__ . '/phpmailer/src/SMTP.php';
require_once __DIR__ . '/phpmailer/src/Exception.php';

try {
  // ====================== LIST LICENSE ======================
  if ($method === 'GET' && $action === 'list') {
    $q = trim($_GET['q'] ?? '');
    $where = '';
    $params = [];
    if ($q !== '') {
      $where = "WHERE (l.license_key LIKE ? OR l.status LIKE ? OR l.plan LIKE ? OR EXISTS (SELECT 1 FROM activations a WHERE a.license_key = l.license_key AND a.device_id LIKE ?))";
      $like = '%' . $q . '%';
      $params = [$like, $like, $like, $like];
    }

   $sql = "SELECT l.license_key, l.plan, l.status, l.max_devices, l.level, l.target_penerima,
                   l.expires_at, l.bound_device_id, l.created_at, l.updated_at,
                   (
                     SELECT GROUP_CONCAT(a.device_id SEPARATOR ', ')
                     FROM activations a
                     WHERE a.license_key = l.license_key AND a.deactivated_at IS NULL
                   ) AS device_ids
            FROM licenses l
            $where
            ORDER BY l.created_at DESC";
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    echo json_encode(['data' => $rows]);
    exit;
  }

  // ====================== CREATE LICENSE ======================
  if ($method === 'POST' && $action === 'create') {
    $maxDevices = intval($_POST['max_devices'] ?? '1');
    $level = trim($_POST['level'] ?? 'pos');
    $expiresAtLocal = $_POST['expires_at'] ?? '';
    if ($maxDevices < 1) {
      http_response_code(400);
      echo json_encode(['message' => 'Maksimal Device harus >= 1']);
      exit;
    }
    if (!$expiresAtLocal) {
      http_response_code(400);
      echo json_encode(['message' => 'Tanggal aktif sampai wajib diisi']);
      exit;
    }
    $expiresAt = to_utc_datetime($expiresAtLocal);

    // generate unique key
    $tries = 0;
    do {
      $licenseKey = generate_license_key('YBKP', 3, 4);
      $tries++;
      $stmt = db()->prepare('SELECT 1 FROM licenses WHERE license_key = ?');
      $stmt->execute([$licenseKey]);
      $exists = (bool)$stmt->fetchColumn();
    } while ($exists && $tries < 5);

    if ($exists) {
      http_response_code(500);
      echo json_encode(['message' => 'Gagal menghasilkan license key unik, coba lagi']);
      exit;
    }

    $sql = 'INSERT INTO licenses (license_key, plan, expires_at, status, max_devices, level)
      VALUES (?, ?, ?, ?, ?, ?)';
    $stmt = db()->prepare($sql);
    $stmt->execute([$licenseKey, 'pro', $expiresAt, 'active', $maxDevices, $level]);

    echo json_encode(['ok' => true, 'license_key' => $licenseKey]);
    exit;
  }

  // ====================== SEND EMAIL ======================
  if ($method === 'POST' && $action === 'send_email') {
    $email = trim($_POST['email'] ?? '');
    $licenseKey = trim($_POST['license_key'] ?? '');

    if (!$email || !$licenseKey) {
      http_response_code(400);
      echo json_encode(['message' => 'Email dan License Key wajib diisi']);
      exit;
    }

    // ambil data license
    $stmt = db()->prepare('SELECT * FROM licenses WHERE license_key = ?');
    $stmt->execute([$licenseKey]);
    $license = $stmt->fetch();
    if (!$license) {
      http_response_code(404);
      echo json_encode(['message' => 'License tidak ditemukan']);
      exit;
    }

    // siapkan isi email
    $subject = "Lisensi YB Kasir Pro Untuk Anda";
    $body = "
      <p>Halo Teman, Terima kasih telah membeli <b>YB Kasir Pro</b>.</p>
      <p>Berikut informasi lisensi Anda:</p>
      <table style='border-collapse:collapse'>
        <tr><td><b>License Key</b></td><td>:</td><td>{$license['license_key']}</td></tr>
        <tr><td><b>Plan</b></td><td>:</td><td>{$license['plan']}</td></tr>
        <tr><td><b>Status</b></td><td>:</td><td>{$license['status']}</td></tr>
        <tr><td><b>Berlaku sampai</b></td><td>:</td><td>{$license['expires_at']}</td></tr>
      </table>
      <p>Gunakan license key di atas pada <b>Menu Lisensi</b> di Aplikasi untuk aktivasi aplikasi Anda.<br>
      Hubungi Kami jika mengalami kendala.</p>
      <hr>
      <small>Email ini dikirim otomatis oleh sistem <b>YB Kasir Pro</b>.</small>
    ";

    // konfig phpmailer
    $mail = new PHPMailer(true);
    try {
      // konfigurasi SMTP (ubah sesuai akun kamu)
      $mail->isSMTP();
      $mail->Host = 'smtp.gmail.com';     // ganti sesuai domain
      $mail->SMTPAuth = true;
      $mail->Username = 'vansluysyongen@gmail.com'; // ganti
      $mail->Password = 'kqxvwuqxoxlkjwnh';   // ganti
      $mail->SMTPSecure = 'tls';
      $mail->Port = 587;

      $mail->setFrom('vansluysyongen@gmail.com', 'YB Kasir Pro');
      $mail->addAddress($email);
      $mail->isHTML(true);
      $mail->Subject = $subject;
      $mail->Body = $body;

      $mail->send();

    // update kolom target_penerima
    $upd = db()->prepare('UPDATE licenses SET target_penerima = ?, updated_at = NOW() WHERE license_key = ?');
    $upd->execute([$email, $licenseKey]);
    
    echo json_encode(['ok' => true, 'message' => "Email berhasil dikirim ke {$email}"]);
    exit;

    } catch (Exception $e) {
      http_response_code(500);
      echo json_encode(['message' => 'Gagal mengirim email: ' . $mail->ErrorInfo]);
      exit;
    }
  }

  // ====================== SEND WHATSAPP ======================
if ($method === 'POST' && $action === 'send_wa') {
  $phone = trim($_POST['phone'] ?? '');
  $licenseKey = trim($_POST['license_key'] ?? '');

  if (!$phone || !$licenseKey) {
    http_response_code(400);
    echo json_encode(['message' => 'Nomor HP dan License Key wajib diisi']);
    exit;
  }

  // Normalisasi nomor WhatsApp agar formatnya sesuai API wa.me
  // Contoh input yang didukung:
  // +62 821-5503-1996  -> 6282155031996
  // 082195742400       -> 6282195742400
  // 6282195742400      -> 6282195742400
  $phone = preg_replace('/[^0-9+]/', '', $phone); // hapus spasi dan tanda '-'

  if (strpos($phone, '+62') === 0) {
    $phone = '62' . substr($phone, 3);
  } elseif (strpos($phone, '0') === 0) {
    $phone = '62' . substr($phone, 1);
  }
  // jika sudah 62 di depan, biarkan saja

  // Validasi hasil akhir (minimal panjang 10 digit)
  if (strlen($phone) < 10) {
    http_response_code(400);
    echo json_encode(['message' => 'Format nomor HP tidak valid']);
    exit;
  }

  // Ambil data license
  $stmt = db()->prepare('SELECT * FROM licenses WHERE license_key = ?');
  $stmt->execute([$licenseKey]);
  $license = $stmt->fetch();
  if (!$license) {
    http_response_code(404);
    echo json_encode(['message' => 'License tidak ditemukan']);
    exit;
  }

  // Format pesan WhatsApp
  $msg = "Halo Teman, Terima kasih telah membeli *YB Kasir Pro*.\n\n" .
         "Berikut informasi lisensi Anda:\n\n" .
         "License Key : {$license['license_key']}\n" .
         "Plan         : {$license['plan']}\n" .
         "Status       : {$license['status']}\n" .
         "Berlaku sampai  : Lifetime\n\n" .
         "Gunakan license key di atas pada *Menu Lisensi* di Aplikasi untuk aktivasi aplikasi Anda.\n" .
         "Hubungi Kami jika mengalami kendala.\n\n" .
         "_Pesan ini dikirim otomatis oleh sistem YB Kasir Pro._";

  $waUrl = "https://wa.me/{$phone}?text=" . urlencode($msg);
  // update kolom target_penerima
    $upd = db()->prepare('UPDATE licenses SET target_penerima = ?, updated_at = NOW() WHERE license_key = ?');
    $upd->execute([$phone, $licenseKey]);
    
    echo json_encode(['ok' => true, 'whatsapp_url' => $waUrl]);
    exit;
}

  // ====================== NOT FOUND ======================
  http_response_code(404);
  echo json_encode(['message' => 'Not Found']);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['message' => $e->getMessage()]);
}
