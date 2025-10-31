<?php require_once __DIR__ . '/auth.php'; require_login(); ?>
<?php /* Minimal PHP Native Admin for License Keys */ ?>
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kelola License Key - Kasir Pro</title>
  <style>
    :root{
      --primary:#4F46E5; --danger:#DC2626; --success:#16A34A; --border:#E5E7EB; --bg:#F8FAFC; --text:#111827;
    }
    body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, sans-serif; background:var(--bg); color:var(--text); margin:0}
    header{background:linear-gradient(90deg,#6366F1,#22C55E); color:white; padding:16px 20px}
    h1{margin:0; font-size:20px}
    .container{max-width:1100px; margin:20px auto; padding:0 16px}
    .card{background:white; border:1px solid var(--border); border-radius:10px; box-shadow:0 1px 2px rgba(0,0,0,.03)}
    .card-header{display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--border)}
    .btn{display:inline-flex; align-items:center; gap:8px; background:var(--primary); color:#fff; padding:8px 12px; border:none; border-radius:8px; cursor:pointer; transition:0.2s}
    .btn:disabled{opacity:.6; cursor:not-allowed}
    .btn-danger{background:var(--danger)}
    table{width:100%; border-collapse: collapse}
    th,td{padding:10px; border-top:1px solid var(--border); font-size:14px}
    th{background:#F3F4F6; text-align:left}
    .badge{padding:2px 8px; border-radius:999px; font-size:12px; display:inline-block}
    .badge-active{background:#DCFCE7; color:#166534}
    .badge-inactive{background:#FEE2E2; color:#991B1B}
    .modal{position:fixed; inset:0; background:rgba(0,0,0,.45); display:none; align-items:center; justify-content:center; z-index:1000}
    .modal.show{display:flex}
    .modal-content{background:white; border-radius:10px; width:100%; max-width:460px; border:1px solid var(--border); animation:fadeIn .25s ease}
    .modal-header{padding:12px 16px; border-bottom:1px solid var(--border); font-weight:600}
    .modal-body{padding:16px}
    .modal-footer{padding:12px 16px; border-top:1px solid var(--border); display:flex; gap:8px; justify-content:flex-end}
    .form-group{margin-bottom:12px}
    label{display:block; margin-bottom:6px; font-size:13px}
    input[type="number"],input[type="datetime-local"],input[type="text"],input[type="email"],input[type="tel"]{width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:8px}
    .muted{color:#6B7280; font-size:12px}
    .dropdown{position:relative; display:inline-block}
    .dropdown-menu{display:none; position:absolute; right:0; background:white; border:1px solid var(--border); border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,.1); z-index:10}
    .dropdown-menu.show{display:block}
    .dropdown-item{padding:8px 14px; cursor:pointer; font-size:14px}
    .dropdown-item:hover{background:#F3F4F6}
    .spinner {
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,.6);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    /* ===== Responsif untuk Mobile Portrait ===== */
@media (max-width: 768px) {
  table thead th:nth-child(2), /* Plan */
  table thead th:nth-child(4), /* Max Devices */
  table thead th:nth-child(5), /* Level */
  table thead th:nth-child(7), /* Expires At */
  table thead th:nth-child(8), /* Created */
  table tbody td:nth-child(2),
  table tbody td:nth-child(4),
  table tbody td:nth-child(5),
  table tbody td:nth-child(7),
  table tbody td:nth-child(8) {
    display: none;
  }

  table {
    font-size: 13px;
  }

  th, td {
    padding: 8px 6px;
  }

  .card-header strong {
    font-size: 15px;
  }

  .btn {
    padding: 6px 10px;
    font-size: 13px;
  }
}

.dropdown-menu {
  display: none;
  position: absolute;
  right: 0;
  background: white;
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0,0,0,.1);
  z-index: 10;
  min-width: 160px; /* 🔹 Tambahan penting: lebar minimum */
  overflow: hidden;
}

.dropdown-item {
  padding: 10px 14px; /* 🔹 Sedikit lebih lega */
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap; /* 🔹 Biar teks tidak terpotong */
}
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from{opacity:0; transform:scale(.95);} to{opacity:1; transform:scale(1);} }
  </style>
</head>
<body>
  <header>
    <div style="display:flex; align-items:center; justify-content:space-between">
      <h1>Kelola License Key - Kasir Pro</h1>
      <div>
        <span style="margin-right:12px; opacity:.9; font-size:14px;">Hi, <?php echo htmlspecialchars(current_username()); ?></span>
        <a href="logout.php" style="color:#fff; text-decoration:underline">Logout</a>
      </div>
    </div>
  </header>

  <div class="container">
    <div class="card">
      <div class="card-header">
        <div>
          <strong>Daftar License</strong>
          <div class="muted">Menampilkan semua license dan status aktivasi</div>
        </div>
        <button class="btn" id="btnNew">Generate License Key Baru</button>
      </div>
      <div class="card-header" style="border-top:1px solid var(--border);">
        <input id="search" type="text" placeholder="Cari license/status/plan/device_id..." style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:8px" />
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>License Key</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Max Devices</th>
              <th>Level</th>
              <th>Device IDs</th>
              <th>Expires At (UTC)</th>
              <th>Penerima</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Modal Create License -->
  <div class="modal" id="modal">
    <div class="modal-content">
      <div class="modal-header">Generate License Key Baru</div>
      <div class="modal-body">
         
        <div class="form-group">
          <label>Level Akun</label>
          <select id="level">
            <option value="pos">POS (default)</option>
            <option value="owner">Owner</option>
          </select>
          <div class="muted">Pilih level akun: <code>pos</code> atau <code>owner</code></div>
        </div>
        <div class="form-group">
          <label>Aktif sampai</label>
          <input type="datetime-local" id="expiresAt" />
          <div class="muted">Simpan sebagai UTC di database</div>
        </div>
        <div id="err" class="muted" style="color:var(--danger);"></div>
      </div>
      <div class="modal-footer">
        <button class="btn" id="btnSave">Simpan</button>
        <button class="btn btn-danger" id="btnClose">Tutup</button>
      </div>
    </div>
  </div>

  <!-- Modal Kirim Email -->
  <div class="modal" id="modalEmail">
    <div class="modal-content">
      <div class="modal-header">Kirim Lisensi ke Email Pembeli</div>
      <div class="modal-body">
        <div class="form-group">
          <label>Alamat Email Pembeli</label>
          <input type="email" id="emailPembeli" placeholder="contoh@email.com">
          <div id="emailErr" class="muted" style="color:var(--danger);"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" id="btnSendEmail">Kirim ke Email Pembeli</button>
        <button class="btn btn-danger" onclick="modalEmail.classList.remove('show')">Tutup</button>
      </div>
    </div>
  </div>

  <!-- Modal Kirim WA -->
  <div class="modal" id="modalWA">
    <div class="modal-content">
      <div class="modal-header">Kirim Lisensi ke WhatsApp Pembeli</div>
      <div class="modal-body">
        <div class="form-group">
          <label>Nomor WA Pembeli</label>
          <input type="tel" id="waPembeli" placeholder="628xxxxxxx">
          <div id="waErr" class="muted" style="color:var(--danger);"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" id="btnSendWA">Kirim ke WA Pembeli</button>
        <button class="btn btn-danger" onclick="modalWA.classList.remove('show')">Tutup</button>
      </div>
    </div>
  </div>

  <script>
    const apiBase = 'api.php';
    const rowsEl = document.getElementById('rows');
    const searchEl = document.getElementById('search');
    const modal = document.getElementById('modal');
    const btnNew = document.getElementById('btnNew');
    const btnClose = document.getElementById('btnClose');
    const btnSave = document.getElementById('btnSave');
  const level = document.getElementById('level');
  const expiresAt = document.getElementById('expiresAt');
    const errEl = document.getElementById('err');
    const modalEmail = document.getElementById('modalEmail');
    const modalWA = document.getElementById('modalWA');
    const btnSendEmail = document.getElementById('btnSendEmail');
    const btnSendWA = document.getElementById('btnSendWA');
    const emailPembeli = document.getElementById('emailPembeli');
    const waPembeli = document.getElementById('waPembeli');
    const emailErr = document.getElementById('emailErr');
    const waErr = document.getElementById('waErr');
    let currentLicenseKey = '';

    function fmtBadge(status){
      const cls = status === 'active' ? 'badge badge-active' : 'badge badge-inactive';
      return `<span class="${cls}">${status}</span>`;
    }

    let searchTimeout;
    async function load(){
      rowsEl.innerHTML = '<tr><td colspan="9">Loading...</td></tr>';
      const q = encodeURIComponent(searchEl.value || '');
      const res = await fetch(`${apiBase}?action=list&q=${q}`);
      const json = await res.json();
      const data = json.data || [];
      if (!data.length){
        rowsEl.innerHTML = '<tr><td colspan="9">Belum ada data</td></tr>';
        return;
      }
      rowsEl.innerHTML = data.map(r => `
        <tr>
          <td><code>${r.license_key}</code></td>
          <td>${r.plan}</td>
          <td>${fmtBadge(r.status)}</td>
          <td>${r.max_devices}</td>
          <td>${r.level || ''}</td>
          <td>${r.device_ids || ''}</td>
          <td>${r.expires_at}</td>
          <td>${r.target_penerima || '-'}</td>
          <td>${r.created_at}</td>
          <td>
            <div class="dropdown">
              <button class="btn" onclick="toggleMenu(this)">⋮</button>
              <div class="dropdown-menu">
                <div class="dropdown-item" onclick="openWAModal('${r.license_key}')">Send WA</div>
                <div class="dropdown-item" onclick="openEmailModal('${r.license_key}')">Send Email</div>
                <div class="dropdown-item" onclick="copyLicenseKey('${r.license_key}')">Copy License Key</div>
              </div>
            </div>
          </td>
        </tr>
      `).join('');
    }

    function toggleMenu(btn){
      document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
      btn.nextElementSibling.classList.toggle('show');
    }

    window.onclick = function(e){
      if (!e.target.matches('.btn') && !e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
      }
    }

    function openEmailModal(license){
      currentLicenseKey = license;
      emailPembeli.value = '';
      emailErr.textContent = '';
      modalEmail.classList.add('show');
    }

    function openWAModal(license){
      currentLicenseKey = license;
      waPembeli.value = '';
      waErr.textContent = '';
      modalWA.classList.add('show');
    }
    
    function copyLicenseKey(key) {
  navigator.clipboard.writeText(key)
    .then(() => {
      // tampilkan notifikasi elegan
      showToast('✅ License key disalin: ' + key);
    })
    .catch(() => {
      alert('❌ Gagal menyalin license key');
    })
    .finally(() => {
      // Tutup semua dropdown setelah klik
      document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
    });;
}

    btnSendEmail.addEventListener('click', async ()=>{
      emailErr.textContent='';
      const email = emailPembeli.value.trim();
      if (!email){ emailErr.textContent='Alamat email wajib diisi.'; return; }

      btnSendEmail.disabled = true;
      btnSendEmail.innerHTML = '<span class="spinner"></span> Mengirim...';

      try{
        const fd = new FormData();
        fd.append('action','send_email');
        fd.append('email', email);
        fd.append('license_key', currentLicenseKey);
        const res = await fetch(apiBase, {method:'POST', body:fd});
        const json = await res.json();
        if (json.ok){
          alert('✅ Email berhasil dikirim ke pembeli.');
          modalEmail.classList.remove('show');
        } else emailErr.textContent = json.message || 'Gagal mengirim email.';
      }catch(e){
        emailErr.textContent = 'Terjadi kesalahan jaringan.';
      }finally{
        btnSendEmail.disabled = false;
        btnSendEmail.innerHTML = 'Kirim ke Email Pembeli';
      }
    });

    btnSendWA.addEventListener('click', async ()=>{
      waErr.textContent='';
      const no = waPembeli.value.trim();
      if (!no){ waErr.textContent='Nomor WA wajib diisi.'; return; }
    
      btnSendWA.disabled = true;
      btnSendWA.innerHTML = '<span class="spinner"></span> Mengirim...';
    
      try{
        const fd = new FormData();
        fd.append('action', 'send_wa');
        fd.append('license_key', currentLicenseKey);
        fd.append('phone', no);
    
        const res = await fetch('api.php', { method: 'POST', body: fd });
        const json = await res.json();
    
        if (json.ok && json.whatsapp_url){
          window.open(json.whatsapp_url, '_blank');
          modalWA.classList.remove('show');
        } else {
          waErr.textContent = json.message || 'Gagal menyiapkan pesan WA.';
        }
      }catch(e){
        waErr.textContent = 'Terjadi kesalahan.';
      }finally{
        btnSendWA.disabled = false;
        btnSendWA.innerHTML = 'Kirim ke WA Pembeli';
      }
    });

    searchEl.addEventListener('input', ()=>{
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(load, 300);
    });

    btnNew.addEventListener('click', ()=>{
      errEl.textContent='';
  level.value = 'pos';
      const now = new Date();
      now.setFullYear(now.getFullYear() + 20);
      expiresAt.value = now.toISOString().slice(0,16);
      modal.classList.add('show');
    });

    btnClose.addEventListener('click', ()=> modal.classList.remove('show'));

    btnSave.addEventListener('click', async ()=>{
      errEl.textContent='';
      const fd = new FormData();
  fd.append('action','create');
  fd.append('level', level.value);
  fd.append('expires_at', expiresAt.value);
      const res = await fetch(apiBase, { method:'POST', body: fd });
      const json = await res.json();
      if (!res.ok){
        errEl.textContent = json.message || 'Gagal menyimpan';
        return;
      }
      alert(`License Key baru: ${json.license_key}`);
      modal.classList.remove('show');
      load();
    });

    load();
    
    function showToast(msg) {
  const toast = document.createElement('div');
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    background: '#333',
    color: 'white',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    opacity: '0',
    transition: 'opacity .3s ease',
    zIndex: '9999'
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.style.opacity = '1');
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 500);
  }, 2000);
}
  </script>
</body>
</html>
