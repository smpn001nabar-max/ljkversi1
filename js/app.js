(function () {
  'use strict';
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const state = { user:null, page:'dashboard', selectedExamId:'', selectedScan:null, selectedResult:null, currentResults:[], scanQueue:[], cameraStream:null, lastReport:null, installPrompt:null };

  const MENU = {
    SUPER_ADMIN: [
      {section:'MENU UTAMA'}, {page:'dashboard',label:'Dashboard',icon:'⌂'},
      {section:'MASTER DATA'}, {page:'data-guru',label:'Data Guru',icon:'♙'}, {page:'data-siswa',label:'Data Siswa',icon:'♧'},
      {page:'data-kelas',label:'Data Kelas',icon:'▦'}, {page:'data-mapel',label:'Mata Pelajaran',icon:'▤'},
      {page:'data-penugasan',label:'Penugasan Guru',icon:'⇄'}, {page:'data-tahunajaran',label:'Tahun Ajaran',icon:'◷'}, {page:'data-users',label:'Manajemen Pengguna',icon:'♙'},
      {section:'PENILAIAN'}, {page:'exams',label:'Data Ujian',icon:'▣'}, {page:'verification',label:'Hasil Scan',icon:'▧'},
      {page:'results',label:'Rekap Nilai',icon:'▤'}, {page:'reports',label:'Laporan',icon:'▥'},
      {section:'SISTEM'}, {page:'activity',label:'Log Aktivitas',icon:'◴'}, {page:'settings',label:'Pengaturan',icon:'⚙'}
    ],
    GURU_MAPEL: [
      {section:'MENU UTAMA'}, {page:'dashboard',label:'Dashboard',icon:'⌂'}, {page:'exams',label:'Ujian Saya',icon:'▣'}, {page:'create-exam',label:'Buat Ujian',icon:'＋'},
      {page:'keys',label:'Kunci Jawaban',icon:'☷'}, {page:'generator',label:'Generator Lembar Jawaban',icon:'▤'},
      {page:'scan',label:'Scan OMR',icon:'▧'}, {page:'verification',label:'Verifikasi Scan',icon:'✓'},
      {page:'results',label:'Hasil Penilaian',icon:'▥'}, {page:'analysis',label:'Analisis Soal',icon:'▦'}, {page:'reports',label:'Laporan',icon:'▤'}
    ],
    WALI_KELAS: [
      {section:'MENU UTAMA'}, {page:'dashboard',label:'Dashboard Kelas',icon:'⌂'}, {page:'data-siswa',label:'Data Siswa',icon:'♧'},
      {page:'results',label:'Rekap Nilai',icon:'▤'}, {page:'class-stats',label:'Statistik Kelas',icon:'▦'},
      {page:'development',label:'Perkembangan Akademik',icon:'↗'}, {page:'reports',label:'Laporan',icon:'▥'}
    ],
    SISWA: [
      {section:'MENU SISWA'}, {page:'dashboard',label:'Dashboard',icon:'⌂'}, {page:'profile',label:'Profil Saya',icon:'♙'},
      {page:'history',label:'Riwayat Ujian',icon:'◷'}, {page:'results',label:'Hasil Ujian',icon:'▤'}, {page:'result-detail',label:'Detail Penilaian',icon:'▦'}
    ]
  };
  const TITLES = {
    dashboard:'Dashboard', 'data-guru':'Data Guru','data-siswa':'Data Siswa','data-kelas':'Data Kelas','data-mapel':'Mata Pelajaran',
    'data-penugasan':'Penugasan Guru','data-tahunajaran':'Tahun Ajaran','data-users':'Manajemen Pengguna',exams:'Data Ujian','create-exam':'Buat Ujian',keys:'Kunci Jawaban',
    generator:'Generator Lembar Jawaban',scan:'Scan OMR',verification:'Verifikasi Scan',results:'Hasil Penilaian',analysis:'Analisis Butir Soal',
    reports:'Laporan Akademik',activity:'Log Aktivitas',settings:'Pengaturan Aplikasi',profile:'Profil Saya',history:'Riwayat Ujian',
    'class-stats':'Statistik Kelas',development:'Perkembangan Akademik','result-detail':'Detail Penilaian'
  };
  const ENTITY_META = {
    guru:{entity:'guru',title:'Data Guru',fields:[['nip','NIP'],['nama','Nama Guru'],['email','Email'],['noHp','Nomor HP'],['status','Status','status']]},
    siswa:{entity:'siswa',title:'Data Siswa',fields:[['nis','NIS'],['nisn','NISN'],['nama','Nama Siswa'],['kelasId','ID Kelas'],['email','Email'],['status','Status','status']]},
    kelas:{entity:'kelas',title:'Data Kelas',fields:[['nama','Nama Kelas'],['tingkat','Tingkat'],['tahunAjaranId','ID Tahun Ajaran'],['waliKelasId','ID/Email Wali Kelas'],['status','Status','status']]},
    mapel:{entity:'mapel',title:'Mata Pelajaran',fields:[['kode','Kode Mapel'],['nama','Nama Mata Pelajaran'],['status','Status','status']]},
    penugasan:{entity:'penugasan',title:'Penugasan Guru',fields:[['guruId','ID Guru'],['kelasId','ID Kelas'],['mapelId','ID Mata Pelajaran'],['tahunAjaranId','ID Tahun Ajaran'],['status','Status','status']]},
    tahunajaran:{entity:'tahunajaran',title:'Tahun Ajaran',fields:[['nama','Tahun Ajaran'],['semester','Semester'],['tanggalMulai','Tanggal Mulai','date'],['tanggalSelesai','Tanggal Selesai','date'],['status','Status','status']]},
    users:{entity:'users',title:'Manajemen Pengguna',fields:[['email','Email Google'],['nama','Nama Pengguna'],['role','Peran','role'],['refId','ID Referensi (opsional)'],['status','Status','status']]}
  };

  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fmt(value) { if (value === null || value === undefined || value === '') return '-'; return esc(value); }
  function number(value) { return Number(value || 0).toLocaleString('id-ID'); }
  function date(value) { if (!value) return '-'; const d=new Date(value); return isNaN(d)?esc(value):d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }
  function toast(message,type) { const root=$('#toastRoot'); const el=document.createElement('div'); el.className='toast '+(type||''); el.textContent=message; root.appendChild(el); setTimeout(()=>el.remove(),3800); }
  function statusBadge(value) { const s=String(value||'').toUpperCase(); let c=''; if(['AKTIF','ACTIVE','FINAL','TERVERIFIKASI','TERBIT','SELESAI','SELESAI_DIPERIKSA','SIAP_DIGUNAKAN','HASIL_DITERBITKAN'].includes(s))c='success'; else if(['DRAFT','DRAF','MENUNGGU','BELUM_DIPINDAI','PERLU_VERIFIKASI','DIPINDAI','SEDANG_DIPINDAI'].includes(s))c='warning'; else if(['NONAKTIF','GAGAL','DITOLAK'].includes(s))c='danger'; else c='info'; return `<span class="status ${c}">${esc(String(value||'-').replace(/_/g,' '))}</span>`; }
  function loading() { $('#pageContent').innerHTML='<div class="loading-state"><div class="spinner"></div><span>Memuat data...</span></div>'; }
  function empty(text) { return `<div class="empty-state"><div class="empty-icon">⌁</div><b>${esc(text||'Belum ada data')}</b><span>Data akan tampil setelah tersedia.</span></div>`; }
  function roleLabel(role) { return ({SUPER_ADMIN:'Super Admin',GURU_MAPEL:'Guru Mata Pelajaran',WALI_KELAS:'Wali Kelas',SISWA:'Siswa'})[role]||role; }
  function pageHeader(title,description,actions) { return `<div class="page-heading"><div><h2>${esc(title)}</h2><p>${esc(description||'')}</p></div><div class="page-actions">${actions||''}</div></div>`; }
  function metricCard(item,index) { const icons={'users':'♧','graduation-cap':'♙','school':'⌂','book-open':'▤','clipboard-list':'▣','scan':'▧','scan-search':'⌕','chart-no-axes-column':'▥','trending-up':'↗','trending-down':'↘','file-check':'✓','clipboard-check':'☑','award':'✦'}; return `<div class="metric-card"><div class="metric-top"><span class="metric-icon">${icons[item.icon]||'◈'}</span><span class="muted" style="font-size:9px">${index+1<10?'0'+(index+1):index+1}</span></div><div class="metric-label">${esc(item.label)}</div><div class="metric-value">${esc(item.value)}</div><div class="metric-foot">Data aplikasi sekolah</div></div>`; }

  function showLogin(message) {
    $('#loginView').classList.remove('hidden'); $('#appShell').classList.add('hidden');
    if (message) $('#loginMessage').textContent=message;
  }
  function showApp() { $('#loginView').classList.add('hidden'); $('#appShell').classList.remove('hidden'); }
  function renderNavigation() {
    const menu=MENU[state.user.role]||[];
    $('#navMenu').innerHTML=menu.map(item=>item.section?`<div class="nav-section">${esc(item.section)}</div>`:`<button class="nav-item ${state.page===item.page?'active':''}" data-page="${item.page}"><span class="nav-icon">${item.icon}</span><span>${esc(item.label)}</span></button>`).join('');
    $('#sideName').textContent=state.user.nama||state.user.email; $('#topName').textContent=state.user.nama||state.user.email;
    $('#sideRole').textContent=roleLabel(state.user.role); $('#topRole').textContent=roleLabel(state.user.role);
    $('#sideAvatar').textContent=(state.user.nama||state.user.email||'U').charAt(0).toUpperCase(); $('#topAvatar').textContent=$('#sideAvatar').textContent;
    $('#pageTitle').textContent=TITLES[state.page]||'Dashboard';
  }
  async function navigate(page) {
    if (!TITLES[page]) page='dashboard';
    if(page!=='scan')stopCamera();
    state.page=page; renderNavigation(); $('#sidebar').classList.remove('open'); loading();
    try {
      switch(page) {
        case 'dashboard': return await renderDashboard();
        case 'data-guru': return await renderDataPage('guru');
        case 'data-siswa': return await renderDataPage('siswa');
        case 'data-kelas': return await renderDataPage('kelas');
        case 'data-mapel': return await renderDataPage('mapel');
        case 'data-penugasan': return await renderDataPage('penugasan');
        case 'data-tahunajaran': return await renderDataPage('tahunajaran');
        case 'data-users': return await renderDataPage('users');
        case 'exams': return await renderExams();
        case 'create-exam': await renderExams(); return await openExamModal();
        case 'keys': return await renderKeys();
        case 'generator': return await renderGenerator();
        case 'scan': return await renderScan();
        case 'verification': return await renderVerification();
        case 'results': return await renderResults();
        case 'analysis': return await renderAnalysis();
        case 'reports': return await renderReports();
        case 'activity': return await renderActivity();
        case 'settings': return await renderSettings();
        case 'profile': return renderProfile();
        case 'history': return await renderHistory();
        case 'class-stats': return await renderClassStats();
        case 'development': return await renderDevelopment();
        case 'result-detail': return await renderResults();
      }
    } catch(err) { $('#pageContent').innerHTML=`<div class="panel">${empty(err.message||'Data gagal dimuat')}</div>`; toast(err.message||'Terjadi kesalahan','error'); }
  }

  async function renderDashboard() {
    const data=await API.call('dashboard.get');
    const metrics=(data.metrics||[]).map(metricCard).join('');
    const exams=data.recentExams||[];
    const activity=data.activity||[];
    const chart=data.chartData||{labels:[],values:[]};
    const chartMax=Math.max(1,...(chart.values||[]).map(Number));
    const chartBars=(chart.values||[]).some(v=>Number(v)>0)?(chart.values||[]).map((v,i)=>`<div class="bar-group"><div class="bar" style="height:${Math.max(3,Number(v)/chartMax*88)}%"></div><span class="bar-label">${esc((chart.labels||[])[i]||'')}</span></div>`).join(''):'';
    const averageScore=Math.min(100,Math.max(0,Number(data.averageScore||0)));
    const chartTitle=state.user.role==='SUPER_ADMIN'?'Aktivitas Ujian':state.user.role==='GURU_MAPEL'?'Hasil Ujian':'Perkembangan Nilai';
    const summaryLabel=data.schoolStats?'Hasil Diterbitkan':(data.metrics[0]&&data.metrics[0].label||'Ringkasan');
    const summaryValue=data.schoolStats?data.schoolStats.published:(data.metrics[0]&&data.metrics[0].value||0);
    $('#pageContent').innerHTML=`${pageHeader('Selamat datang, '+(state.user.nama||'Pengguna').split(' ')[0],'Ringkasan aktivitas penilaian SMP Negeri 1 Nabire Barat.',`<button class="btn btn-light" data-action="refresh">↻ Perbarui</button>`)}
      ${state.user.role==='SISWA'&&data.student?`<section class="section-card"><div class="panel-head"><div><h3>Identitas Siswa</h3><p>Informasi akademik akun pribadi</p></div><span class="status success">Akun aktif</span></div><div class="stat-row"><div class="stat-chip"><small>Nama</small><b style="font-size:12px">${fmt(data.student.nama)}</b></div><div class="stat-chip"><small>NIS</small><b>${fmt(data.student.nis)}</b></div><div class="stat-chip"><small>Kelas</small><b>${fmt((await safeList('kelas')).find(c=>c.id===data.student.kelasId)?.nama||'-')}</b></div></div></section>`:''}
      <div class="metric-grid">${metrics||'<div class="metric-card">Belum ada data</div>'}</div>
      <div class="dashboard-grid">
        <section class="panel"><div class="panel-head"><div><h3>${chartTitle}</h3><p>Data berdasarkan aktivitas dan hasil yang tersimpan</p></div><span class="status info">Ringkasan</span></div>
          <div class="chart-placeholder">${chartBars||'<div class="empty-state" style="width:100%;min-height:100px">Belum ada data untuk ditampilkan.</div>'}</div>
        </section>
        <section class="panel"><div class="panel-head"><div><h3>Ikhtisar Penilaian</h3><p>Ringkasan kondisi data ujian</p></div></div>
          <div class="progress-ring" style="background:conic-gradient(var(--primary) 0 ${averageScore}%,#EEEAF5 ${averageScore}% 100%)"><span>${Math.round(averageScore)}%</span></div>
          <div class="progress-caption">Rata-rata nilai<br><b style="color:#4D3A75">${averageScore.toFixed(1)}</b></div>
          <div class="stat-row" style="justify-content:center;margin-top:14px"><div class="stat-chip"><small>${esc(summaryLabel)}</small><b>${number(summaryValue)}</b></div></div>
        </section>
      </div>
      <div class="dashboard-grid">
        <section class="table-panel"><div class="table-toolbar"><h3>Ujian Terbaru</h3><button class="btn btn-light btn-sm" data-page="exams">Lihat semua</button></div>${exams.length?`<div class="table-wrap"><table><thead><tr><th>Kode</th><th>Nama Ujian</th><th>Tanggal</th><th>Status</th></tr></thead><tbody>${exams.map(e=>`<tr><td><b>${fmt(e.kode)}</b></td><td>${fmt(e.nama)}</td><td>${date(e.tanggalUjian)}</td><td>${statusBadge(e.status)}</td></tr>`).join('')}</tbody></table></div>`:empty('Belum ada ujian')}</section>
        <section class="panel"><div class="panel-head"><h3>Aktivitas Terbaru</h3></div>${activity.length?`<div class="activity-list">${activity.slice(0,6).map(a=>`<div class="activity-item"><span class="activity-dot"></span><div><b>${fmt(a.aksi)} · ${fmt(a.modul)}</b><small>${fmt(a.email)} · ${date(a.waktu)}</small></div></div>`).join('')}</div>`:empty('Belum ada aktivitas')}</section>
      </div>`;
  }

  async function renderDataPage(entity) {
    const meta=ENTITY_META[entity]; const rows=await API.call('data.list',{entity:entity});
    const canEdit=state.user.role==='SUPER_ADMIN';
    const columns=meta.fields.map(f=>`<th>${esc(f[1])}</th>`).join('')+(canEdit?'<th>ID Data</th>':'');
    const body=rows.map(row=>`<tr>${meta.fields.map(f=>`<td>${f[0]==='status'?statusBadge(row[f[0]]):fmt(row[f[0]])}</td>`).join('')}${canEdit?`<td><span class="code-id">${esc(row.id)}</span><button class="icon-action" data-action="copy-id" data-id="${esc(row.id)}" title="Salin ID">⧉</button><button class="icon-action" data-action="edit-record" data-entity="${entity}" data-id="${esc(row.id)}">✎</button><button class="icon-action" data-action="deactivate-record" data-entity="${entity}" data-id="${esc(row.id)}">⊘</button></td>`:''}</tr>`).join('');
    $('#pageContent').innerHTML=`${pageHeader(meta.title,'Kelola data referensi sekolah dan pastikan setiap identitas tercatat dengan benar.',canEdit?`<button class="btn btn-primary" data-action="add-record" data-entity="${entity}">＋ Tambah Data</button>`:'')}
      <section class="table-panel"><div class="table-toolbar"><h3>Daftar ${esc(meta.title)}</h3><div class="toolbar-controls"><input class="search-input" id="tableSearch" placeholder="Cari data..."/><span class="status info">${rows.length} data</span></div></div>
      <div class="table-wrap"><table id="dataTable"><thead><tr>${columns}</tr></thead><tbody>${body||`<tr><td class="table-empty" colspan="${meta.fields.length+(canEdit?1:0)}">Belum ada data. Tambahkan data pertama untuk memulai.</td></tr>`}</tbody></table></div></section>`;
    const search=$('#tableSearch'); if(search)search.addEventListener('input',()=>{$$('#dataTable tbody tr').forEach(tr=>tr.style.display=tr.textContent.toLowerCase().includes(search.value.toLowerCase())?'':'none');});
  }

  async function renderExams() {
    const [exams,classes,subjects]=await Promise.all([API.call('exam.list'),safeList('kelas'),safeList('mapel')]); state.exams=exams;
    const canCreate=['SUPER_ADMIN','GURU_MAPEL'].includes(state.user.role);
    const body=exams.map(e=>{
      const cl=classes.find(x=>x.id===e.kelasId),mp=subjects.find(x=>x.id===e.mapelId);
      return `<tr><td><b>${fmt(e.kode)}</b></td><td>${fmt(e.nama)}</td><td>${fmt(mp&&mp.nama||e.mapelId)}</td><td>${fmt(cl&&cl.nama||e.kelasId)}</td><td>${number(e.jumlahSoal)}</td><td>${date(e.tanggalUjian)}</td><td>${statusBadge(e.status)}</td><td><button class="icon-action" data-action="choose-exam" data-id="${esc(e.id)}" title="Pilih ujian">⋯</button></td></tr>`;
    }).join('');
    $('#pageContent').innerHTML=`${pageHeader('Data Ujian','Kelola jadwal, peserta, kunci jawaban, dan status pemeriksaan ujian.',canCreate?`<button class="btn btn-primary" data-action="create-exam">＋ Buat Ujian</button>`:'')}
      <section class="table-panel"><div class="table-toolbar"><h3>Daftar Ujian</h3><div class="toolbar-controls"><input class="search-input" id="tableSearch" placeholder="Cari kode atau nama ujian..."/><span class="status info">${exams.length} ujian</span></div></div>
      <div class="table-wrap"><table id="examTable"><thead><tr><th>Kode</th><th>Nama Ujian</th><th>Mata Pelajaran</th><th>Kelas</th><th>Soal</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${body||`<tr><td class="table-empty" colspan="8">Belum ada ujian.</td></tr>`}</tbody></table></div></section>`;
    const search=$('#tableSearch');if(search)search.addEventListener('input',()=>$$('#examTable tbody tr').forEach(tr=>tr.style.display=tr.textContent.toLowerCase().includes(search.value.toLowerCase())?'':'none'));
  }
  async function safeList(entity) { try{return await API.call('data.list',{entity});}catch(e){return [];} }

  async function openExamModal() {
    const [classes,subjects,years,teachers]=await Promise.all([safeList('kelas'),safeList('mapel'),safeList('tahunajaran'),state.user.role==='SUPER_ADMIN'?safeList('guru'):Promise.resolve([])]);
    const select=(id,label,rows,placeholder)=>`<div class="form-field"><label>${label}</label><select class="form-control" name="${id}" required><option value="">${placeholder||'Pilih...'}</option>${rows.map(r=>`<option value="${esc(r.id)}">${esc(r.nama||r.nip||r.id)}</option>`).join('')}</select></div>`;
    openModal('Buat Ujian Baru','Isi informasi ujian sebelum memasukkan kunci jawaban.',`<form id="examForm" class="form-grid">
      <div class="form-field full"><label>Nama Ujian</label><input class="form-control" name="nama" required placeholder="Contoh: Penilaian Akhir Semester"></div>
      ${select('kelasId','Kelas',classes,'Pilih kelas')}${select('mapelId','Mata Pelajaran',subjects,'Pilih mata pelajaran')}
      ${select('tahunAjaranId','Tahun Ajaran',years,'Pilih tahun ajaran')}
      <div class="form-field"><label>Semester</label><select class="form-control" name="semester"><option value="Ganjil">Ganjil</option><option value="Genap">Genap</option></select></div>
      <div class="form-field"><label>Tanggal Ujian</label><input class="form-control" type="date" name="tanggalUjian" required></div>
      <div class="form-field"><label>Jumlah Soal</label><input class="form-control" type="number" min="1" max="200" name="jumlahSoal" value="40" required></div>
      <div class="form-field"><label>Jumlah Pilihan Jawaban</label><select class="form-control" name="jumlahPilihan"><option value="5">5 pilihan (A–E)</option><option value="4">4 pilihan (A–D)</option></select></div>
      <div class="form-field"><label>Rincian jawaban untuk siswa</label><select class="form-control" name="detailPublik"><option value="TIDAK">Tidak diizinkan</option><option value="YA">Diizinkan setelah hasil diterbitkan</option></select></div>
      ${state.user.role==='SUPER_ADMIN'?select('guruId','Guru Penanggung Jawab',teachers,'Pilih guru'):''}
      <div class="form-field full"><span class="form-help">Setelah ujian dibuat, lanjutkan ke menu Kunci Jawaban untuk memasukkan kunci dan bobot setiap soal.</span></div>
    </form>`,`<button class="btn btn-light" data-modal-close>Batal</button><button class="btn btn-primary" form="examForm" type="submit">Simpan Ujian</button>`);
  }

  async function renderKeys() {
    const exams=await API.call('exam.list'); state.exams=exams;
    const chosen=state.selectedExamId|| (exams[0]&&exams[0].id)||'';
    state.selectedExamId=chosen;
    $('#pageContent').innerHTML=`${pageHeader('Kunci Jawaban','Masukkan kunci dan bobot. Perubahan dikunci setelah nilai difinalisasi.')}
      <section class="section-card"><div class="filter-row"><div class="form-field" style="flex:1"><label>Pilih Ujian</label><select id="keyExamSelect" class="form-control">${exams.map(e=>`<option value="${esc(e.id)}" ${e.id===chosen?'selected':''}>${esc(e.kode+' · '+e.nama)}</option>`).join('')}</select></div><button class="btn btn-light" data-action="load-keys">Muat Kunci</button></div></section><div id="keyEditor">${empty('Pilih ujian untuk mengatur kunci jawaban')}</div>`;
    if(chosen)await loadKeyEditor(chosen);
  }
  async function loadKeyEditor(examId) {
    const exam=state.exams.find(e=>e.id===examId); if(!exam)return;
    const existing=await API.call('exam.keys.get',{examId});
    const options=['A','B','C','D','E'].slice(0,Number(exam.jumlahPilihan));
    $('#keyEditor').innerHTML=`<section class="section-card"><div class="panel-head"><div><h3>${esc(exam.nama)}</h3><p>${esc(exam.kode)} · ${number(exam.jumlahSoal)} soal · ${exam.jumlahPilihan} pilihan</p></div>${statusBadge(exam.status)}</div>
      <form id="keysForm"><input type="hidden" name="examId" value="${esc(examId)}"><div class="key-grid">${Array.from({length:Number(exam.jumlahSoal)},(_,i)=>{const old=existing.find(k=>Number(k.nomor)===i+1)||{};return `<div class="key-item"><label>Nomor ${i+1}</label><select name="answer_${i+1}" required><option value="">Pilih</option>${options.map(o=>`<option value="${o}" ${old.jawaban===o?'selected':''}>${o}</option>`).join('')}</select><input class="form-control" style="margin-top:6px;padding:6px;font-size:10px" type="number" min="0.01" step="0.01" name="weight_${i+1}" value="${old.bobot===undefined?1:old.bobot}" aria-label="Bobot soal ${i+1}"></div>`;}).join('')}</div><div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn btn-primary" type="submit">Simpan Kunci Jawaban</button></div></form></section>`;
  }

  async function renderGenerator() {
    const exams=await API.call('exam.list');state.exams=exams;
    $('#pageContent').innerHTML=`${pageHeader('Generator Lembar Jawaban','Buat lembar jawaban A4 dengan QR identitas dan penanda posisi untuk pemindaian OMR.')}
      <section class="section-card"><h3>Pengaturan Lembar Jawaban</h3><p>Pilih ujian yang sudah memiliki kunci jawaban. Sistem membuat satu lembar per siswa dan mendukung lebih dari satu halaman untuk ujian panjang.</p>
      <div class="form-grid"><div class="form-field full"><label>Ujian</label><select id="generatorExam" class="form-control"><option value="">Pilih ujian</option>${exams.map(e=>`<option value="${esc(e.id)}">${esc(e.kode+' · '+e.nama)}</option>`).join('')}</select></div></div>
      <div class="page-actions" style="margin-top:16px"><button class="btn btn-primary" data-action="generate-sheets">Buat dan Cetak Lembar Jawaban</button></div></section><div id="generatorResult"></div>`;
  }

  async function renderScan() {
    const exams=await API.call('exam.list');state.exams=exams;
    $('#pageContent').innerHTML=`${pageHeader('Scan OMR','Pindai lembar jawaban melalui kamera atau unggah foto. Pembacaan gambar berjalan di browser.')}
      <section class="section-card"><div class="form-grid"><div class="form-field full"><label>Pilih Ujian</label><select id="scanExam" class="form-control"><option value="">Pilih ujian</option>${exams.map(e=>`<option value="${esc(e.id)}">${esc(e.kode+' · '+e.nama)}</option>`).join('')}</select></div></div>
      <div class="scan-drop" style="margin-top:15px"><div style="font-size:28px;color:var(--primary)">▧</div><strong>Ambil foto atau pilih gambar lembar jawaban</strong><p>Gunakan foto tegak, seluruh tepi kertas terlihat, dan QR Code tidak tertutup.</p>
      <div class="page-actions" style="justify-content:center"><button class="btn btn-primary" data-action="start-camera">Buka Kamera</button><label class="btn btn-light" for="scanFiles">Pilih Foto</label><input id="scanFiles" type="file" accept="image/*" capture="environment" multiple hidden></div></div>
      <div id="cameraArea"></div><div id="scanQueueArea"></div></section>`;
  }

  async function renderVerification() {
    const rows=await API.call('scan.list',{});state.scanRows=rows;
    const body=rows.map(s=>`<tr><td>${fmt(s.ujian&&s.ujian.kode)}</td><td>${fmt(s.siswa&&s.siswa.nama)}</td><td>${fmt(s.siswa&&s.siswa.nis)}</td><td>${number(s.answerCount||0)}</td><td>${number(s.needsReview||0)}</td><td>${statusBadge(s.statusScan)}</td><td>${statusBadge(s.statusVerifikasi)}</td><td><button class="btn btn-light btn-sm" data-action="open-verification" data-id="${esc(s.id)}">Periksa</button></td></tr>`).join('');
    $('#pageContent').innerHTML=`${pageHeader('Verifikasi Hasil Scan','Periksa gambar dan jawaban hasil OMR. Jawaban ambigu atau ganda harus diperbaiki sebelum finalisasi.')}
      <section class="table-panel"><div class="table-toolbar"><h3>Antrean Verifikasi</h3><div class="toolbar-controls"><input class="search-input" id="tableSearch" placeholder="Cari siswa atau ujian..."/><span class="status info">${rows.length} lembar</span></div></div>
      <div class="table-wrap"><table id="scanTable"><thead><tr><th>Ujian</th><th>Nama Siswa</th><th>NIS</th><th>Jawaban Terbaca</th><th>Perlu Dicek</th><th>Status Scan</th><th>Verifikasi</th><th>Aksi</th></tr></thead><tbody>${body||'<tr><td colspan="8" class="table-empty">Belum ada lembar jawaban yang dipindai.</td></tr>'}</tbody></table></div></section>`;
    const search=$('#tableSearch');if(search)search.addEventListener('input',()=>$$('#scanTable tbody tr').forEach(tr=>tr.style.display=tr.textContent.toLowerCase().includes(search.value.toLowerCase())?'':'none'));
  }

  async function openVerification(id) {
    const summary=(state.scanRows||[]).find(s=>s.id===id);if(!summary)return;
    const detail=await API.call('scan.detail',{lembarId:id});
    const sheet=Object.assign({},summary,detail.sheet,{siswa:detail.student,ujian:detail.exam,answers:detail.answers});
    state.selectedScan=sheet;
    let pages=[];try{pages=JSON.parse(sheet.fileIds||'[]').map(x=>Number(x.page)).filter(Boolean);}catch(e){}
    if(!pages.length&&sheet.fileId)pages=[1];
    const firstPage=pages[0]||1;
    let imageData='';
    try { const image=await API.call('scan.image',{lembarId:id,page:firstPage});imageData=image.dataUrl||''; } catch(e) { toast(e.message,'error'); }
    const exam=sheet.ujian||{};const allowed=['A','B','C','D','E'].slice(0,Number(exam.jumlahPilihan||5));
    const answers=sheet.answers||[];
    const fields=answers.map(a=>`<div class="form-field"><label>Nomor ${a.nomor} · ${statusBadge(a.status)}</label><select class="form-control verify-answer" data-number="${a.nomor}"><option value="">Kosong</option>${allowed.map(o=>`<option value="${o}" ${a.jawaban===o?'selected':''}>${o}</option>`).join('')}</select></div>`).join('');
    const pageControl=pages.length>1?`<div class="filter-row" style="margin-bottom:10px"><div class="form-field" style="flex:1"><label>Halaman foto</label><select id="verifyPageSelect" class="form-control">${pages.map(p=>`<option value="${p}" ${p===firstPage?'selected':''}>Halaman ${p}</option>`).join('')}</select></div><button class="btn btn-light btn-sm" data-action="load-verify-image">Tampilkan</button></div>`:'';
    openModal('Verifikasi Lembar Jawaban',`${sheet.siswa&&sheet.siswa.nama||'Siswa'} · ${exam.kode||''}`,`${pageControl}<div class="scan-preview"><img id="verifyImage" src="${imageData}" alt="Foto lembar jawaban"><div><div class="stat-row"><div class="stat-chip"><small>Terbaca</small><b>${answers.length}</b></div><div class="stat-chip"><small>Perlu perhatian</small><b>${answers.filter(a=>['AMBIGU','GANDA','TIDAK_TERBACA'].includes(String(a.status).toUpperCase())).length}</b></div></div><p class="form-help" style="margin-top:10px">Pilih jawaban yang benar untuk setiap nomor. Pilihan kosong tetap dapat disimpan sebagai jawaban kosong. Untuk ujian beberapa halaman, pilih halaman foto yang sesuai di atas.</p></div></div><div class="form-grid" style="margin-top:16px">${fields||empty('Belum ada hasil jawaban')}</div><input type="hidden" id="verifySheetId" value="${esc(id)}">`,`<button class="btn btn-light" data-modal-close>Tutup</button><button class="btn btn-primary" data-action="save-verification">Simpan Verifikasi</button>`,true);
  }
  async function loadVerificationImage() {
    const page=Number($('#verifyPageSelect').value||1);
    const id=$('#verifySheetId').value;
    const image=await API.call('scan.image',{lembarId:id,page:page});
    $('#verifyImage').src=image.dataUrl||'';
  }

  async function renderResults() {
    const [results,exams]=await Promise.all([API.call('results.list',{}),API.call('exam.list')]);state.exams=exams;state.currentResults=results;state.lastReport={results:results,summary:{total:results.length}};
    const rows=results.map(r=>`<tr><td>${fmt(r.ujian&&r.ujian.kode)}</td><td>${fmt(r.siswa&&r.siswa.nama)}</td><td>${fmt(r.siswa&&r.siswa.nis)}</td><td>${number(r.benar)}</td><td>${number(r.salah)}</td><td>${number(r.kosong)}</td><td>${number(r.ganda)}</td><td><b>${Number(r.nilai||0).toFixed(2)}</b></td><td>${statusBadge(r.statusFinalisasi)}</td><td>${statusBadge(r.statusPublikasi)}</td><td>${r.detailJson?`<button class="btn btn-light btn-sm" data-action="show-result-detail" data-id="${esc(r.lembarId)}">Lihat</button>`:'-'}</td><td>${state.user.role==='GURU_MAPEL'||state.user.role==='SUPER_ADMIN'?`<button class="icon-action" data-action="finalize-result" data-id="${esc(r.lembarId)}" title="Finalisasi">✓</button>`:'-'}</td></tr>`).join('');
    const publish=state.user.role==='GURU_MAPEL'||state.user.role==='SUPER_ADMIN';
    const resultAction=publish?`<button class="btn btn-primary" data-action="publish-results">Terbitkan Hasil</button>`:state.user.role==='SISWA'?`<button class="btn btn-light" data-action="export-pdf">Unduh Hasil PDF</button>`:'';
    $('#pageContent').innerHTML=`${pageHeader('Hasil Penilaian','Nilai dihitung berdasarkan bobot jawaban benar. Hasil baru terlihat oleh siswa setelah diterbitkan.',resultAction)}
      ${state.user.role==='SISWA'?'<div class="section-card"><p>Rincian jawaban dan kunci penilaian hanya dapat ditampilkan apabila guru mengizinkannya.</p></div>':''}
      <section class="table-panel"><div class="table-toolbar"><h3>Rekapitulasi Nilai</h3><div class="toolbar-controls"><select id="resultExamFilter" class="form-control" style="width:220px"><option value="">Semua ujian</option>${exams.map(e=>`<option value="${esc(e.id)}">${esc(e.kode+' · '+e.nama)}</option>`).join('')}</select><input class="search-input" id="tableSearch" placeholder="Cari siswa..."/></div></div>
      <div class="table-wrap"><table id="resultTable"><thead><tr><th>Ujian</th><th>Nama Siswa</th><th>NIS</th><th>Benar</th><th>Salah</th><th>Kosong</th><th>Ganda</th><th>Nilai</th><th>Finalisasi</th><th>Publikasi</th><th>Detail</th><th>Aksi</th></tr></thead><tbody>${rows||'<tr><td colspan="12" class="table-empty">Belum ada nilai final.</td></tr>'}</tbody></table></div></section>`;
    const apply=()=>{$$('#resultTable tbody tr').forEach(tr=>{const q=$('#tableSearch').value.toLowerCase(),exam=$('#resultExamFilter').value;tr.style.display=(!q||tr.textContent.toLowerCase().includes(q))&&(!exam||tr.cells[0].textContent.includes((exams.find(e=>e.id===exam)||{}).kode||'---'))?'':'none';});};
    $('#tableSearch').addEventListener('input',apply);$('#resultExamFilter').addEventListener('change',apply);
  }

  function showResultDetail(lembarId) {
    const result=(state.currentResults||[]).find(r=>r.lembarId===lembarId);
    if(!result||!result.detailJson){toast('Rincian jawaban belum diizinkan atau tidak tersedia.','error');return;}
    let detail=[];try{detail=JSON.parse(result.detailJson);}catch(e){}
    state.selectedResult=result;
    openModal('Detail Penilaian',`${result.siswa&&result.siswa.nama||'Siswa'} · ${result.ujian&&result.ujian.kode||''}`,`<div class="report-summary"><div class="stat-chip"><small>Benar</small><b>${result.benar}</b></div><div class="stat-chip"><small>Salah</small><b>${result.salah}</b></div><div class="stat-chip"><small>Kosong</small><b>${result.kosong}</b></div><div class="stat-chip"><small>Nilai</small><b>${Number(result.nilai||0).toFixed(2)}</b></div></div><div class="table-wrap"><table><thead><tr><th>No.</th><th>Jawaban Siswa</th><th>Kunci</th><th>Status</th><th>Bobot</th></tr></thead><tbody>${detail.map(d=>`<tr><td>${d.nomor}</td><td>${d.jawaban||'Kosong'}</td><td>${d.kunci}</td><td>${statusBadge(d.status)}</td><td>${d.bobot}</td></tr>`).join('')}</tbody></table></div>`,`<button class="btn btn-light" data-modal-close>Tutup</button>`,true);
  }

  async function renderAnalysis() {
    const exams=await API.call('exam.list');state.exams=exams;
    $('#pageContent').innerHTML=`${pageHeader('Analisis Butir Soal','Analisis proporsi jawaban benar, salah, kosong, dan tingkat kesulitan setiap butir.')}
      <section class="section-card"><div class="form-field"><label>Pilih Ujian</label><select id="analysisExam" class="form-control"><option value="">Pilih ujian</option>${exams.map(e=>`<option value="${esc(e.id)}">${esc(e.kode+' · '+e.nama)}</option>`).join('')}</select></div></section><div id="analysisResult">${empty('Pilih ujian untuk melihat analisis')}</div>`;
  }
  async function loadAnalysis(examId) {
    const data=await API.call('analysis.get',{examId});
    $('#analysisResult').innerHTML=`<div class="report-summary"><div class="stat-chip"><small>Peserta dianalisis</small><b>${number(data.totalPeserta)}</b></div><div class="stat-chip"><small>Rata-rata nilai</small><b>${Number(data.rataRata||0).toFixed(1)}</b></div><div class="stat-chip"><small>Jumlah butir</small><b>${data.items.length}</b></div><div class="stat-chip"><small>Ujian</small><b style="font-size:11px">${fmt(data.exam.kode)}</b></div></div><section class="table-panel"><div class="table-toolbar"><h3>Statistik per Nomor Soal</h3></div><div class="table-wrap"><table><thead><tr><th>No.</th><th>Benar</th><th>Salah</th><th>Kosong</th><th>% Benar</th><th>Tingkat Kesulitan</th></tr></thead><tbody>${data.items.map(x=>`<tr><td>${x.nomor}</td><td>${x.benar}</td><td>${x.salah}</td><td>${x.kosong}</td><td><b>${x.persenBenar}%</b></td><td>${statusBadge(x.tingkatKesulitan)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  async function renderReports() {
    const [exams,classes,subjects,teachers]=await Promise.all([API.call('exam.list'),safeList('kelas'),safeList('mapel'),state.user.role==='SUPER_ADMIN'?safeList('guru'):Promise.resolve([])]);state.exams=exams;
    $('#pageContent').innerHTML=`${pageHeader('Laporan Akademik','Rekap nilai per siswa, ujian, kelas, mata pelajaran, dan guru. Laporan dapat diunduh dalam Excel atau PDF.')}
      <section class="section-card"><div class="form-grid">
        <div class="form-field"><label>Ujian</label><select id="reportExam" class="form-control"><option value="">Semua ujian</option>${exams.map(e=>`<option value="${esc(e.id)}">${esc(e.kode+' · '+e.nama)}</option>`).join('')}</select></div>
        <div class="form-field"><label>Kelas</label><select id="reportClass" class="form-control"><option value="">Semua kelas</option>${classes.map(x=>`<option value="${esc(x.id)}">${esc(x.nama)}</option>`).join('')}</select></div>
        <div class="form-field"><label>Mata Pelajaran</label><select id="reportSubject" class="form-control"><option value="">Semua mata pelajaran</option>${subjects.map(x=>`<option value="${esc(x.id)}">${esc(x.nama)}</option>`).join('')}</select></div>
        ${state.user.role==='SUPER_ADMIN'?`<div class="form-field"><label>Guru</label><select id="reportTeacher" class="form-control"><option value="">Semua guru</option>${teachers.map(x=>`<option value="${esc(x.id)}">${esc(x.nama)}</option>`).join('')}</select></div>`:''}
      </div><div class="page-actions" style="margin-top:14px"><button class="btn btn-primary" data-action="load-report">Tampilkan Laporan</button></div></section><div id="reportResult">${empty('Pilih filter untuk menampilkan laporan')}</div>`;
  }
  async function loadReport() {
    const examId=$('#reportExam').value;
    const filters={examId:examId,kelasId:$('#reportClass')&&$('#reportClass').value||'',mapelId:$('#reportSubject')&&$('#reportSubject').value||'',guruId:$('#reportTeacher')&&$('#reportTeacher').value||''};
    const report=await API.call('reports.get',filters);state.lastReport=report;
    const rows=report.results||[];
    $('#reportResult').innerHTML=`<div class="report-summary"><div class="stat-chip"><small>Jumlah data</small><b>${number(report.summary.total)}</b></div><div class="stat-chip"><small>Rata-rata</small><b>${Number(report.summary.average||0).toFixed(1)}</b></div><div class="stat-chip"><small>Nilai tertinggi</small><b>${Number(report.summary.tertinggi||0).toFixed(1)}</b></div><div class="stat-chip"><small>Nilai terendah</small><b>${Number(report.summary.terendah||0).toFixed(1)}</b></div><div class="stat-chip"><small>Tuntas (KKM ${report.summary.kkm})</small><b>${number(report.summary.tuntas)}</b></div><div class="stat-chip"><small>Belum tuntas</small><b>${number(report.summary.tidakTuntas)}</b></div></div>
      <section class="table-panel"><div class="table-toolbar"><h3>Rekap Hasil Ujian</h3><div class="page-actions"><input id="reportSearch" class="search-input" placeholder="Cari nama siswa..."><button class="btn btn-light btn-sm" data-action="export-xlsx">Unduh Excel</button><button class="btn btn-light btn-sm" data-action="export-pdf">Unduh PDF</button><button class="btn btn-light btn-sm" data-action="print-report">Cetak</button></div></div><div class="table-wrap"><table id="reportTable"><thead><tr><th>No.</th><th>Nama Siswa</th><th>NIS</th><th>Ujian</th><th>Benar</th><th>Salah</th><th>Kosong</th><th>Ganda</th><th>Nilai</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${fmt(r.siswa&&r.siswa.nama)}</td><td>${fmt(r.siswa&&r.siswa.nis)}</td><td>${fmt(r.ujian&&r.ujian.nama)}</td><td>${r.benar}</td><td>${r.salah}</td><td>${r.kosong}</td><td>${r.ganda||0}</td><td><b>${Number(r.nilai).toFixed(2)}</b></td></tr>`).join('')||'<tr><td colspan="9" class="table-empty">Belum ada data laporan.</td></tr>'}</tbody></table></div></section>`;
    const search=$('#reportSearch');if(search)search.addEventListener('input',()=>$$('#reportTable tbody tr').forEach(tr=>tr.style.display=tr.textContent.toLowerCase().includes(search.value.toLowerCase())?'':'none'));
  }

  async function renderActivity() {
    const rows=await API.call('activity.list',{limit:100});
    $('#pageContent').innerHTML=`${pageHeader('Log Aktivitas','Riwayat tindakan pengguna untuk membantu pengawasan dan audit perubahan.')}
      <section class="table-panel"><div class="table-toolbar"><h3>Aktivitas Sistem</h3><span class="status info">${rows.length} aktivitas</span></div><div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Pengguna</th><th>Peran</th><th>Aksi</th><th>Modul</th><th>Detail</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${date(r.waktu)}</td><td>${fmt(r.email)}</td><td>${fmt(r.role)}</td><td>${fmt(r.aksi)}</td><td>${fmt(r.modul)}</td><td>${fmt(r.detail)}</td></tr>`).join('')||'<tr><td colspan="6" class="table-empty">Belum ada aktivitas.</td></tr>'}</tbody></table></div></section>`;
  }
  async function renderSettings() {
    const settings=await API.call('settings.get');const dict={};settings.forEach(s=>dict[s.key]=s.value);
    $('#pageContent').innerHTML=`${pageHeader('Pengaturan Aplikasi','Kelola identitas sekolah dan pengaturan penilaian yang digunakan aplikasi.')}
      <section class="section-card"><h3>Konfigurasi Sekolah</h3><form id="settingsForm" class="form-grid">
      ${[['NAMA_SEKOLAH','Nama Sekolah',dict.NAMA_SEKOLAH||'SMP Negeri 1 Nabire Barat'],['TAHUN_AJARAN_AKTIF','Tahun Ajaran Aktif',dict.TAHUN_AJARAN_AKTIF||''],['SEMESTER_AKTIF','Semester Aktif',dict.SEMESTER_AKTIF||'Ganjil'],['KKM','KKM',dict.KKM||'75']].map(x=>`<div class="form-field"><label>${x[1]}</label><input class="form-control" name="${x[0]}" value="${esc(x[2])}"></div>`).join('')}
      <div class="form-field full"><button class="btn btn-primary" type="submit">Simpan Pengaturan</button></div></form></section><section class="section-card"><h3>Pencadangan Database</h3><p>Buat salinan spreadsheet database ke folder Backup Database di Google Drive. File backup tetap privat.</p><button class="btn btn-light" data-action="backup-database">Buat Backup Sekarang</button></section>`;
  }
  async function renderProfile() {
    let profileFields=`<div class="form-field"><label>Peran</label><div class="form-control">${roleLabel(state.user.role)}</div></div>`;
    if(state.user.role==='SISWA'){
      const students=await safeList('siswa'),student=students[0]||{};const classes=await safeList('kelas');
      profileFields+=`<div class="form-field"><label>NIS</label><div class="form-control">${fmt(student.nis)}</div></div><div class="form-field"><label>NISN</label><div class="form-control">${fmt(student.nisn)}</div></div><div class="form-field"><label>Kelas</label><div class="form-control">${fmt((classes.find(c=>c.id===student.kelasId)||{}).nama)}</div></div>`;
    } else if(state.user.role==='GURU_MAPEL'){
      const teachers=await safeList('guru'),teacher=teachers[0]||{};
      profileFields+=`<div class="form-field"><label>NIP</label><div class="form-control">${fmt(teacher.nip)}</div></div><div class="form-field"><label>Nomor HP</label><div class="form-control">${fmt(teacher.noHp)}</div></div>`;
    } else if(state.user.role==='WALI_KELAS'){
      const classes=await safeList('kelas');
      profileFields+=`<div class="form-field"><label>Kelas Tanggung Jawab</label><div class="form-control">${fmt(classes.map(c=>c.nama).join(', '))}</div></div>`;
    }
    $('#pageContent').innerHTML=`${pageHeader('Profil Saya','Informasi akun dan identitas akademik yang terhubung dengan aplikasi.')}
      <section class="section-card"><div style="display:flex;align-items:center;gap:15px"><div class="avatar" style="width:58px;height:58px;font-size:20px">${esc((state.user.nama||'U').charAt(0).toUpperCase())}</div><div><h3 style="margin:0 0 5px">${fmt(state.user.nama)}</h3><p class="muted" style="margin:0;font-size:10px">${fmt(state.user.email)}</p></div></div><div class="form-grid" style="margin-top:20px">${profileFields}</div></section>`;
  }
  async function renderHistory() { await renderResults(); }
  async function renderClassStats() {
    const report=await API.call('reports.get',{});const rows=report.results||[];const values=rows.map(r=>Number(r.nilai||0));
    const buckets=[{label:'< 60',min:0,max:59.99},{label:'60–69',min:60,max:69.99},{label:'70–79',min:70,max:79.99},{label:'80–89',min:80,max:89.99},{label:'90–100',min:90,max:100}].map(b=>({label:b.label,value:values.filter(v=>v>=b.min&&v<=b.max).length}));
    const max=Math.max(1,...buckets.map(b=>b.value));
    $('#pageContent').innerHTML=`${pageHeader('Statistik Kelas','Distribusi nilai siswa berdasarkan hasil ujian yang telah diterbitkan.')}
      <div class="report-summary"><div class="stat-chip"><small>Jumlah hasil</small><b>${rows.length}</b></div><div class="stat-chip"><small>Rata-rata</small><b>${Number(report.summary.average||0).toFixed(1)}</b></div><div class="stat-chip"><small>Tertinggi</small><b>${Number(report.summary.tertinggi||0).toFixed(1)}</b></div><div class="stat-chip"><small>Terendah</small><b>${Number(report.summary.terendah||0).toFixed(1)}</b></div><div class="stat-chip"><small>Tuntas (KKM ${report.summary.kkm})</small><b>${number(report.summary.tuntas)}</b></div><div class="stat-chip"><small>Belum tuntas</small><b>${number(report.summary.tidakTuntas)}</b></div></div>
      <section class="panel"><div class="panel-head"><div><h3>Distribusi Nilai</h3><p>Jumlah hasil pada setiap rentang nilai</p></div></div><div class="chart-placeholder">${buckets.some(b=>b.value)?buckets.map(b=>`<div class="bar-group"><div class="bar" style="height:${Math.max(4,b.value/max*88)}%"></div><span class="bar-label">${b.label}</span></div>`).join(''):empty('Belum ada hasil yang diterbitkan')}</div></section>`;
  }
  async function renderDevelopment() {
    const report=await API.call('reports.get',{});const rows=report.results||[];const groups={};
    rows.forEach(r=>{const key=r.ujian&&r.ujian.id||r.ujianId;const name=r.ujian&&r.ujian.nama||'Ujian';if(!groups[key])groups[key]={name:name,values:[]};groups[key].values.push(Number(r.nilai||0));});
    const data=Object.keys(groups).map(k=>({name:groups[k].name,average:groups[k].values.reduce((a,b)=>a+b,0)/groups[k].values.length,total:groups[k].values.length}));
    const max=Math.max(1,...data.map(x=>x.average));
    $('#pageContent').innerHTML=`${pageHeader('Perkembangan Akademik','Perbandingan rata-rata nilai kelas pada setiap ujian yang telah diterbitkan.')}
      <section class="panel"><div class="panel-head"><div><h3>Tren Rata-rata Nilai</h3><p>Setiap batang mewakili satu ujian</p></div></div><div class="chart-placeholder">${data.length?data.map(x=>`<div class="bar-group"><div class="bar" style="height:${Math.max(4,x.average/max*88)}%"></div><span class="bar-label">${esc(x.name.slice(0,10))}</span></div>`).join(''):empty('Belum ada data perkembangan')}</div></section>
      <section class="table-panel" style="margin-top:16px"><div class="table-toolbar"><h3>Ringkasan per Ujian</h3></div><div class="table-wrap"><table><thead><tr><th>Ujian</th><th>Jumlah Hasil</th><th>Rata-rata</th></tr></thead><tbody>${data.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.total}</td><td><b>${x.average.toFixed(2)}</b></td></tr>`).join('')||'<tr><td colspan="3" class="table-empty">Belum ada data.</td></tr>'}</tbody></table></div></section>`;
  }

  function openModal(title,subtitle,body,footer,wide) {
    $('#modalRoot').innerHTML=`<div class="modal-backdrop" data-modal-backdrop><div class="modal ${wide?'wide':''}"><div class="modal-head"><div><h3>${esc(title)}</h3><p>${esc(subtitle||'')}</p></div><button class="close-button" data-modal-close>×</button></div><div class="modal-body">${body}</div><div class="modal-foot">${footer||'<button class="btn btn-light" data-modal-close>Tutup</button>'}</div></div></div>`;
  }
  function closeModal() { $('#modalRoot').innerHTML=''; }
  async function openEntityForm(entity,record) {
    const meta=ENTITY_META[entity];const current=record||{};
    const [teachers,classes,subjects,years]=await Promise.all([safeList('guru'),safeList('kelas'),safeList('mapel'),safeList('tahunajaran')]);
    const relations={guruId:teachers,kelasId:classes,mapelId:subjects,tahunAjaranId:years};
    const requiredByEntity={guru:['nama','email'],siswa:['nis','nama','kelasId','email'],kelas:['nama','tingkat'],mapel:['kode','nama'],penugasan:['guruId','kelasId','mapelId'],tahunajaran:['nama','semester'],users:['email','nama','role']};
    const fields=meta.fields.map(f=>{
      const value=current[f[0]]||'';const required=(requiredByEntity[entity]||[]).includes(f[0]);let input='';
      if(f[2]==='status')input=`<select class="form-control" name="${f[0]}"><option value="AKTIF" ${value!=='NONAKTIF'?'selected':''}>Aktif</option><option value="NONAKTIF" ${value==='NONAKTIF'?'selected':''}>Nonaktif</option></select>`;
      else if(f[2]==='role')input=`<select class="form-control" name="role" required>${[['GURU_MAPEL','Guru Mata Pelajaran'],['WALI_KELAS','Wali Kelas'],['SISWA','Siswa'],['SUPER_ADMIN','Super Admin']].map(x=>`<option value="${x[0]}" ${value===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select>`;
      else if(f[2]==='date')input=`<input class="form-control" type="date" name="${f[0]}" value="${esc(String(value).slice(0,10))}" ${required?'required':''}>`;
      else if(relations[f[0]])input=`<select class="form-control" name="${f[0]}" ${required?'required':''}><option value="">Pilih ${esc(f[1].toLowerCase())}</option>${relations[f[0]].map(r=>`<option value="${esc(r.id)}" ${value===r.id?'selected':''}>${esc(r.nama||r.nip||r.id)}</option>`).join('')}</select>`;
      else if(f[0]==='email')input=`<input class="form-control" type="email" name="${f[0]}" value="${esc(value)}" ${required?'required':''}>`;
      else input=`<input class="form-control" name="${f[0]}" value="${esc(value)}" ${required?'required':''}>`;
      return `<div class="form-field"><label>${esc(f[1])}</label>${input}</div>`;
    }).join('');
    openModal((record?'Ubah ':'Tambah ')+meta.title,'Lengkapi kolom data berikut. Kolom relasi dipilih dari data yang sudah terdaftar.',`<form id="entityForm" class="form-grid"><input type="hidden" name="entity" value="${entity}"><input type="hidden" name="id" value="${esc(current.id||'')}">${fields}</form>`,`<button class="btn btn-light" data-modal-close>Batal</button><button class="btn btn-primary" type="submit" form="entityForm">Simpan Data</button>`);
  }


  async function handleClick(event) {
    const nav=event.target.closest('[data-page]');
    if(nav){const page=nav.dataset.page;closeModal();await navigate(page);return;}
    const close=event.target.closest('[data-modal-close]');if(close){closeModal();return;}
    const actionEl=event.target.closest('[data-action]');if(!actionEl)return;
    const action=actionEl.dataset.action;
    try {
      if(action==='logout')return await logout();
      if(action==='refresh')return await navigate(state.page);
      if(action==='install-app')return installApp();
      if(action==='add-record')return openEntityForm(actionEl.dataset.entity,null);
      if(action==='copy-id'){await navigator.clipboard.writeText(actionEl.dataset.id);toast('ID berhasil disalin.','success');return;}
      if(action==='edit-record'){
        const entity=actionEl.dataset.entity,meta=ENTITY_META[entity],rows=await API.call('data.list',{entity});
        return openEntityForm(entity,rows.find(r=>r.id===actionEl.dataset.id));
      }
      if(action==='deactivate-record'){
        if(!confirm('Nonaktifkan data ini?'))return;
        await API.call('data.delete',{entity:actionEl.dataset.entity,id:actionEl.dataset.id});toast('Data dinonaktifkan.','success');return navigate(state.page);
      }
      if(action==='create-exam')return openExamModal();
      if(action==='choose-exam'){
        state.selectedExamId=actionEl.dataset.id;
        const exam=state.exams.find(e=>e.id===state.selectedExamId);
        openModal('Aksi Ujian',exam&&exam.kode||'',`<div class="form-grid"><button class="btn btn-light" data-page="keys">Atur Kunci Jawaban</button><button class="btn btn-light" data-page="generator">Generator Lembar Jawaban</button><button class="btn btn-light" data-page="scan">Scan OMR</button><button class="btn btn-light" data-page="results">Lihat Hasil</button></div>`);
        return;
      }
      if(action==='load-keys')return loadKeyEditor($('#keyExamSelect').value);
      if(action==='generate-sheets')return generateSheets();
      if(action==='start-camera')return startCamera();
      if(action==='capture')return captureCamera();
      if(action==='stop-camera')return stopCamera();
      if(action==='process-scan-files')return processScanFiles();
      if(action==='save-scan-queue')return saveScanQueue();
      if(action==='open-verification')return openVerification(actionEl.dataset.id);
      if(action==='load-verify-image')return loadVerificationImage();
      if(action==='save-verification')return saveVerification();
      if(action==='show-result-detail')return showResultDetail(actionEl.dataset.id);
      if(action==='finalize-result'){
        if(!confirm('Finalisasi nilai untuk lembar ini?'))return;
        await API.call('results.finalize',{lembarId:actionEl.dataset.id});toast('Nilai berhasil difinalisasi.','success');return navigate('results');
      }
      if(action==='publish-results')return publishResults();
      if(action==='load-report')return loadReport();
      if(action==='export-xlsx')return exportXlsx();
      if(action==='print-report')return printReport();
      if(action==='export-pdf')return exportPdf();
      if(action==='backup-database'){const result=await API.call('backup.create',{});toast('Backup database berhasil: '+result.fileName,'success');return;}
    } catch(err) { toast(err.message||'Tindakan gagal.','error'); }
  }

  async function handleSubmit(event) {
    const form=event.target;
    if(form.id==='entityForm'){
      event.preventDefault();const fd=new FormData(form),entity=fd.get('entity'),record={};
      fd.forEach((v,k)=>{if(k!=='entity')record[k]=v;});
      if(!record.id)delete record.id;
      try{await API.call('data.save',{entity,record});closeModal();toast('Data berhasil disimpan.','success');await navigate(state.page);}catch(e){toast(e.message,'error');}return;
    }
    if(form.id==='examForm'){
      event.preventDefault();const record=Object.fromEntries(new FormData(form).entries());record.jumlahSoal=Number(record.jumlahSoal);record.jumlahPilihan=Number(record.jumlahPilihan);
      try{const exam=await API.call('exam.create',record);state.selectedExamId=exam.id;closeModal();toast('Ujian berhasil dibuat.','success');await navigate('keys');}catch(e){toast(e.message,'error');}return;
    }
    if(form.id==='keysForm'){
      event.preventDefault();const fd=new FormData(form),examId=fd.get('examId'),exam=state.exams.find(e=>e.id===examId),keys=[];
      for(let i=1;i<=Number(exam.jumlahSoal);i++)keys.push({nomor:i,jawaban:fd.get('answer_'+i),bobot:Number(fd.get('weight_'+i)||1)});
      try{await API.call('exam.keys.save',{examId,keys});toast('Kunci jawaban berhasil disimpan.','success');await navigate('keys');}catch(e){toast(e.message,'error');}return;
    }
    if(form.id==='settingsForm'){
      event.preventDefault();const fd=new FormData(form);const settings=Array.from(fd.entries()).map(([key,value])=>({key,value}));
      try{await API.call('settings.save',{settings});toast('Pengaturan berhasil disimpan.','success');}catch(e){toast(e.message,'error');}return;
    }
  }

  async function generateSheets() {
    const examId=$('#generatorExam').value;if(!examId)throw new Error('Pilih ujian terlebih dahulu.');
    const button=$('[data-action="generate-sheets"]');button.disabled=true;button.textContent='Menyiapkan lembar...';
    try{
      const data=await API.call('answer.generate',{examId});
      const classes=await safeList('kelas'),subjects=await safeList('mapel');
      data.exam.kelasNama=(classes.find(c=>c.id===data.exam.kelasId)||{}).nama||'';
      data.exam.mapelNama=(subjects.find(m=>m.id===data.exam.mapelId)||{}).nama||'';
      data.students.forEach(s=>s.kelasNama=data.exam.kelasNama);
      $('#generatorResult').innerHTML=`<section class="section-card"><div class="stat-row"><div class="stat-chip"><small>Jumlah siswa</small><b>${data.students.length}</b></div><div class="stat-chip"><small>Jumlah soal</small><b>${data.exam.jumlahSoal}</b></div><div class="stat-chip"><small>Halaman per siswa</small><b>${Math.ceil(Number(data.exam.jumlahSoal)/data.pageSize)}</b></div></div><p class="form-help" style="margin-top:12px">Lembar dibuat dengan QR unik untuk setiap siswa. Simpan hasil cetak sebagai PDF atau cetak langsung menggunakan kertas A4, skala 100%.</p><button class="btn btn-primary" id="printSheetsButton">Cetak ${data.students.length} Lembar</button></section>`;
      $('#printSheetsButton').addEventListener('click',async()=>{await Deps.load('qrcode');await AnswerSheet.printBatch(data.exam,data.students);});
    }finally{button.disabled=false;button.textContent='Buat dan Cetak Lembar Jawaban';}
  }

  async function startCamera() {
    if(!$('#scanExam').value)throw new Error('Pilih ujian terlebih dahulu.');
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error('Kamera tidak didukung. Gunakan tombol Pilih Foto.');
    stopCamera();
    const area=$('#cameraArea');area.innerHTML='<div class="camera-box"><video id="cameraVideo" autoplay playsinline></video><div class="camera-actions"><button class="btn btn-primary" data-action="capture">Ambil Foto</button><button class="btn btn-light" data-action="stop-camera">Tutup Kamera</button></div></div>';
    state.cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    $('#cameraVideo').srcObject=state.cameraStream;
  }
  function stopCamera() { if(state.cameraStream){state.cameraStream.getTracks().forEach(t=>t.stop());state.cameraStream=null;} const video=$('#cameraVideo');if(video)video.srcObject=null; }
  async function captureCamera() {
    const video=$('#cameraVideo');if(!video||!video.videoWidth)throw new Error('Kamera belum siap.');
    const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));
    const file=new File([blob],'kamera-'+Date.now()+'.jpg',{type:'image/jpeg'});
    await processFiles([file]);
  }
  async function processScanFiles() { const files=Array.from($('#scanFiles').files||[]);if(!files.length)throw new Error('Pilih foto lembar jawaban.');await processFiles(files); }
  async function processFiles(files) {
    const examId=$('#scanExam').value;if(!examId)throw new Error('Pilih ujian terlebih dahulu.');
    const exam=state.exams.find(e=>e.id===examId)|| (await API.call('exam.list')).find(e=>e.id===examId);
    if(!exam)throw new Error('Ujian tidak ditemukan.');
    const area=$('#scanQueueArea');state.scanQueue=[];area.innerHTML='<div class="loading-state"><div class="spinner"></div><span>Memproses gambar di perangkat...</span></div>';
    for(let i=0;i<files.length;i++){
      try{const result=await OMR.processFile(files[i],exam);result.examId=examId;state.scanQueue.push(result);}
      catch(e){toast(files[i].name+': '+e.message,'error');}
      area.innerHTML=`<div class="panel" style="margin-top:14px"><b style="font-size:11px">Memproses ${i+1} dari ${files.length}</b><div class="form-help">${esc(files[i].name)}</div><div class="spinner" style="margin-top:10px"></div></div>`;
    }
    renderScanQueue();
  }
  function renderScanQueue() {
    const area=$('#scanQueueArea');if(!state.scanQueue.length){area.innerHTML=empty('Tidak ada gambar yang berhasil dibaca');return;}
    area.innerHTML=`<section class="section-card" style="margin-top:14px"><div class="panel-head"><div><h3>Hasil Pembacaan Sementara</h3><p>${state.scanQueue.length} halaman berhasil diproses. Periksa identitas dan status jawaban sebelum menyimpan.</p></div><span class="status warning">Belum tersimpan</span></div>
      ${state.scanQueue.map((r,i)=>`<div class="scan-preview"><img src="${r.preview}" alt="Pratinjau hasil scan"><div><div class="stat-row"><div class="stat-chip"><small>Halaman</small><b>${r.page}/${r.pageCount}</b></div><div class="stat-chip"><small>Terbaca</small><b>${r.filled}</b></div><div class="stat-chip"><small>Perlu cek</small><b>${r.ambiguous}</b></div></div><p class="form-help">${esc(r.quality==='BAIK'?'Perspektif halaman terdeteksi.':'Posisi halaman perlu diperiksa manual.')}</p><div class="scan-answer-grid">${r.answers.slice(0,20).map(a=>`<div class="scan-answer ${a.status==='OK'?'ok':'flag'}"><span>${a.nomor}</span><b>${a.jawaban||a.status}</b></div>`).join('')}</div><p class="form-help">${r.answers.length>20?'Menampilkan 20 nomor pertama.':''}</p></div></div>`).join('<hr style="border:0;border-top:1px solid var(--line);margin:16px 0">')}
      <div class="page-actions" style="justify-content:flex-end;margin-top:16px"><button class="btn btn-light" data-action="clear-scan-queue">Bersihkan</button><button class="btn btn-primary" data-action="save-scan-queue">Simpan Hasil Scan</button></div></section>`;
  }
  async function saveScanQueue() {
    if(!state.scanQueue.length)throw new Error('Tidak ada hasil scan untuk disimpan.');
    const button=$('[data-action="save-scan-queue"]');if(button){button.disabled=true;button.textContent='Menyimpan...';}
    let saved=0;
    try {
      for(const item of state.scanQueue){await API.call('scan.save',{tokenQr:item.tokenQr,page:item.page,answers:item.answers,imageBase64:item.imageBase64,mimeType:item.mimeType,fileName:item.fileName});saved++;}
      state.scanQueue=[];toast(saved+' halaman scan berhasil disimpan.','success');await navigate('verification');
    } finally { if(button){button.disabled=false;button.textContent='Simpan Hasil Scan';} }
  }
  async function saveVerification() {
    const id=$('#verifySheetId').value;const answers=$$('.verify-answer').map(el=>({nomor:Number(el.dataset.number),jawaban:el.value}));
    const result=await API.call('scan.verify',{lembarId:id,answers});closeModal();toast('Verifikasi tersimpan. Status: '+result.statusVerifikasi,'success');await navigate('verification');
  }
  async function publishResults() {
    const exams=state.exams||await API.call('exam.list');
    openModal('Terbitkan Hasil Ujian','Pilih ujian yang seluruh nilainya telah difinalisasi.',`<div class="form-field"><label>Ujian</label><select id="publishExam" class="form-control"><option value="">Pilih ujian</option>${exams.map(e=>`<option value="${esc(e.id)}">${esc(e.kode+' · '+e.nama)}</option>`).join('')}</select></div>`,`<button class="btn btn-light" data-modal-close>Batal</button><button class="btn btn-primary" data-action="confirm-publish">Terbitkan</button>`);
  }

  async function exportXlsx() {
    if(!state.lastReport)throw new Error('Tampilkan laporan terlebih dahulu.');
    await Deps.load('xlsx');
    const rows=state.lastReport.results.map((r,i)=>({No:i+1,Nama:r.siswa&&r.siswa.nama||'',NIS:r.siswa&&r.siswa.nis||'',Ujian:r.ujian&&r.ujian.nama||'',Benar:r.benar,Salah:r.salah,Kosong:r.kosong,Ganda:r.ganda||0,Nilai:Number(r.nilai)}));
    const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Rekap Nilai');XLSX.writeFile(wb,'Rekap-Nilai-SLJS.xlsx');
  }
  function printReport() {
    const table=$('#reportTable');if(!table)throw new Error('Laporan belum ditampilkan.');
    const content=table.outerHTML;const win=window.open('','_blank','width=900,height=700');
    win.document.write(`<html><head><title>Laporan Hasil Ujian</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#222}h2{font-size:18px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f0edf7}</style></head><body><h2>App Scan Lembar Jawab Siswa</h2><p>SMP Negeri 1 Nabire Barat</p>${content}</body></html>`);win.document.close();win.focus();setTimeout(()=>win.print(),400);
  }
  async function exportPdf() {
    if(!state.lastReport)throw new Error('Tampilkan laporan terlebih dahulu.');
    await Deps.load('jspdf');await Deps.load('jspdfTable');
    const jsPDF=window.jspdf&&window.jspdf.jsPDF;if(!jsPDF)throw new Error('Pustaka PDF tidak siap.');
    const doc=new jsPDF('l','mm','a4');
    doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('App Scan Lembar Jawab Siswa',14,15);
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('SMP Negeri 1 Nabire Barat',14,21);
    doc.text('Tanggal cetak: '+new Date().toLocaleDateString('id-ID'),14,27);
    const body=state.lastReport.results.map((r,i)=>[i+1,r.siswa&&r.siswa.nama||'-',r.siswa&&r.siswa.nis||'-',r.ujian&&r.ujian.nama||'-',r.benar,r.salah,r.kosong,r.ganda||0,Number(r.nilai||0).toFixed(2)]);
    doc.autoTable({startY:33,head:[['No','Nama Siswa','NIS','Ujian','Benar','Salah','Kosong','Ganda','Nilai']],body:body,styles:{fontSize:8,cellPadding:2},headStyles:{fillColor:[109,40,217]},theme:'grid'});
    const fileName='Laporan-SLJS-'+new Date().toISOString().slice(0,10)+'.pdf';
    const dataUri=doc.output('datauristring');
    doc.save(fileName);
    try { const saved=await API.call('reports.savePdf',{fileName:fileName,pdfBase64:dataUri});toast('PDF diunduh dan diarsipkan di Drive: '+saved.fileName,'success'); }
    catch(e){toast('PDF berhasil diunduh, tetapi arsip Drive gagal: '+e.message,'error');}
  }

  async function installApp() {
    if(!state.installPrompt){const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent);toast(ios?'Pada iPhone/iPad, buka menu Bagikan lalu pilih Tambahkan ke Layar Utama.':'Opsi pemasangan belum tersedia pada browser ini. Buka menu browser dan pilih Install app atau Tambahkan ke layar utama.','');return;}
    state.installPrompt.prompt();
    const choice=await state.installPrompt.userChoice;
    if(choice&&choice.outcome==='accepted')toast('Aplikasi berhasil ditambahkan ke perangkat.','success');
    state.installPrompt=null;const button=$('#installApp');if(button)button.classList.add('hidden');
  }

  async function logout() {
    try { if(API.getToken())await API.call('auth.logout',{}); } catch(e){}
    API.clearToken();state.user=null;stopCamera();showLogin();
  }
  async function loginCredential(response) {
    $('#loginMessage').textContent='Memverifikasi akun...';
    try{const result=await API.call('auth.login',{credential:response.credential});API.setToken(result.token);state.user=result.user;showApp();renderNavigation();await navigate('dashboard');}
    catch(e){$('#loginMessage').textContent=e.message;}
  }
  async function initializeGoogle() {
    try {
      const publicConfig=await API.getPublicConfig();
      const clientId=publicConfig.clientId;
      if(!clientId){$('#loginMessage').textContent='Google Client ID belum diatur. Hubungi administrator aplikasi.';return;}
      const wait=()=>new Promise((resolve,reject)=>{let tries=0;const tick=()=>{if(window.google&&google.accounts&&google.accounts.id)return resolve();if(++tries>50)return reject(new Error('Layanan Google Sign-In tidak termuat.'));setTimeout(tick,100);};tick();});
      await wait();
      google.accounts.id.initialize({client_id:clientId,callback:loginCredential,auto_select:false,cancel_on_tap_outside:true});
      google.accounts.id.renderButton($('#googleSignIn'),{theme:'outline',size:'large',shape:'pill',width:320,text:'signin_with',locale:'id'});
    } catch(e){$('#loginMessage').textContent=e.message;}
  }
  async function boot() {
    $('#yearNow').textContent=new Date().getFullYear();
    window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();state.installPrompt=event;const button=$('#installApp');if(button)button.classList.remove('hidden');});
    if(/iPhone|iPad|iPod/i.test(navigator.userAgent)){const button=$('#installApp');if(button)button.classList.remove('hidden');}
    window.addEventListener('appinstalled',()=>{state.installPrompt=null;const button=$('#installApp');if(button)button.classList.add('hidden');toast('App Scan LJS terpasang di perangkat.','success');});
    const updateConnection=()=>{const el=$('#connectionStatus');if(!el)return;el.innerHTML=navigator.onLine?'<span></span> Terhubung':'<span style="background:#DC2626;box-shadow:0 0 0 3px #FDECEC"></span> Offline';};
    window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);updateConnection();
    document.addEventListener('click',handleClick);
    document.addEventListener('submit',handleSubmit);
    document.addEventListener('change',async event=>{
      if(event.target.id==='scanFiles'){
        const files=Array.from(event.target.files||[]);if(files.length){try{await processFiles(files);}catch(e){toast(e.message,'error');}}
      }
      if(event.target.id==='keyExamSelect') {state.selectedExamId=event.target.value;await loadKeyEditor(event.target.value);}
      if(event.target.id==='analysisExam'&&event.target.value)await loadAnalysis(event.target.value);
    });
    $('#mobileMenu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
    $('#modalRoot').addEventListener('click',async event=>{
      if(event.target.matches('[data-modal-backdrop]'))closeModal();
      const action=event.target.closest('[data-action]');if(action&&action.dataset.action==='confirm-publish'){
        const examId=$('#publishExam').value;if(!examId){toast('Pilih ujian.','error');return;}
        try{const result=await API.call('results.publish',{examId});closeModal();toast(result.published+' hasil berhasil diterbitkan.','success');await navigate('results');}catch(e){toast(e.message,'error');}
      }
    });
    $('#pageContent').addEventListener('click',async event=>{const el=event.target.closest('[data-action="clear-scan-queue"]');if(el){state.scanQueue=[];$('#scanQueueArea').innerHTML='';}});
    if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
    const token=API.getToken();
    if(token){try{const session=await API.call('auth.me');state.user=session.user;showApp();renderNavigation();await navigate('dashboard');}catch(e){API.clearToken();showLogin();}}
    else showLogin();
    initializeGoogle();
  }
  document.addEventListener('DOMContentLoaded',boot);
})();
