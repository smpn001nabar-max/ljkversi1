(function () {
  'use strict';
  const W = 794, H = 1123, PAGE_SIZE = 60, COL_SIZE = 30, TEMPLATE_VERSION = 'SLJS-OMR-A4-1.0';
  const OPTIONS = ['A','B','C','D','E'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function pageQuestions(total, page) {
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(total, page * PAGE_SIZE);
    const result = [];
    for (let number = start; number <= end; number++) {
      const local = number - start;
      const column = local < COL_SIZE ? 0 : 1;
      const row = local % COL_SIZE;
      const baseX = column === 0 ? 38 : 418;
      const y = 324 + row * 24.35;
      const bubbleXs = OPTIONS.map((_, i) => baseX + 125 + i * 34);
      result.push({ nomor:number, column:column, row:row, x:baseX + 7, y:y, bubbleXs:bubbleXs });
    }
    return result;
  }
  function getBubbleCoordinates(total, page) {
    return pageQuestions(total, page).map(q => ({ nomor:q.nomor, options:OPTIONS.slice(0,5).map((o,i)=>({option:o,x:q.bubbleXs[i],y:q.y})) }));
  }
  function qrData(text) {
    return new Promise((resolve, reject) => {
      if (!window.QRCode) return reject(new Error('Pustaka QR Code belum dimuat.'));
      const holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:120px;height:120px';
      document.body.appendChild(holder);
      new QRCode(holder, { text:text, width:120, height:120, correctLevel:QRCode.CorrectLevel.M });
      setTimeout(() => {
        const canvas = holder.querySelector('canvas');
        const img = holder.querySelector('img');
        const result = canvas ? canvas.toDataURL('image/png') : img ? img.src : '';
        holder.remove();
        result ? resolve(result) : reject(new Error('QR Code tidak dapat dibuat.'));
      }, 80);
    });
  }
  async function buildPage(exam, student, sheet, page) {
    const pageCount = Math.ceil(Number(exam.jumlahSoal) / PAGE_SIZE);
    const qr = await qrData('SLJS|' + sheet.tokenQr + '|' + page);
    const questions = pageQuestions(Number(exam.jumlahSoal), page);
    const marks = [[25,25],[744,25],[25,1074],[744,1074]].map(([x,y])=>`<rect x="${x}" y="${y}" width="25" height="25" fill="#000"/>`).join('');
    const rows = questions.map(q => {
      const bubbles = OPTIONS.slice(0,Number(exam.jumlahPilihan)).map((o,i)=>`
        <circle cx="${q.bubbleXs[i]}" cy="${q.y}" r="8.2" fill="#fff" stroke="#111" stroke-width="1.6"/>
        <text x="${q.bubbleXs[i]}" y="${q.y+3.1}" text-anchor="middle" font-size="8.5" fill="#555">${o}</text>`).join('');
      return `<text x="${q.x}" y="${q.y+3.5}" font-size="11" font-weight="700" fill="#111">${q.nomor}.</text>${bubbles}`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="210mm" height="297mm" viewBox="0 0 ${W} ${H}">
      <rect x="15" y="15" width="764" height="1093" fill="#fff" stroke="#111" stroke-width="1.6"/>
      ${marks}
      <text x="397" y="70" text-anchor="middle" font-size="20" font-weight="800" fill="#111">SMP NEGERI 1 NABIRE BARAT</text>
      <text x="397" y="96" text-anchor="middle" font-size="12" font-weight="700" letter-spacing="1.1" fill="#333">LEMBAR JAWABAN PILIHAN GANDA</text>
      <line x1="48" y1="111" x2="746" y2="111" stroke="#333" stroke-width="1"/>
      <text x="52" y="143" font-size="10" font-weight="700" fill="#333">NAMA SISWA</text><text x="155" y="143" font-size="12" fill="#111">: ${esc(student.nama)}</text>
      <text x="52" y="174" font-size="10" font-weight="700" fill="#333">NIS / NISN</text><text x="155" y="174" font-size="12" fill="#111">: ${esc(student.nis || student.nisn || '-')}</text>
      <text x="52" y="205" font-size="10" font-weight="700" fill="#333">KELAS</text><text x="155" y="205" font-size="12" fill="#111">: ${esc(student.kelasNama || '')}</text>
      <text x="390" y="143" font-size="10" font-weight="700" fill="#333">MATA PELAJARAN</text><text x="510" y="143" font-size="11" fill="#111">: ${esc(exam.mapelNama || '')}</text>
      <text x="390" y="174" font-size="10" font-weight="700" fill="#333">KODE UJIAN</text><text x="510" y="174" font-size="11" fill="#111">: ${esc(exam.kode)}</text>
      <text x="390" y="205" font-size="10" font-weight="700" fill="#333">HALAMAN</text><text x="510" y="205" font-size="11" fill="#111">: ${page} / ${pageCount}</text>
      <image x="665" y="115" width="85" height="85" xlink:href="${qr}"/>
      <rect x="48" y="229" width="698" height="65" rx="4" fill="#F8F8F8" stroke="#999" stroke-width=".8"/>
      <text x="62" y="250" font-size="10" font-weight="700" fill="#222">PETUNJUK PENGISIAN</text>
      <text x="62" y="268" font-size="9" fill="#333">1. Hitamkan satu bulatan jawaban dengan pensil 2B.  2. Jangan melipat atau merusak lembar jawaban.</text>
      <text x="62" y="283" font-size="9" fill="#333">3. Jika salah, hapus hingga bersih.  4. Pastikan identitas dan kode ujian sesuai.</text>
      <line x1="397" y1="310" x2="397" y2="1065" stroke="#DDD" stroke-width="1" stroke-dasharray="3 4"/>
      ${rows}
      <line x1="48" y1="1060" x2="746" y2="1060" stroke="#777" stroke-width=".7"/>
      <text x="397" y="1084" text-anchor="middle" font-size="8" fill="#555">${esc(exam.nama)} · ${esc(exam.kode)} · Halaman ${page} · ${TEMPLATE_VERSION}</text>
    </svg>`;
    return `<section class="answer-page">${svg}</section>`;
  }

  async function printBatch(exam, students) {
    const printRoot = document.getElementById('printRoot');
    if (!printRoot) throw new Error('Area cetak tidak tersedia.');
    const pages = [];
    const pageCount = Math.ceil(Number(exam.jumlahSoal) / PAGE_SIZE);
    for (const student of students) {
      for (let page = 1; page <= pageCount; page++) pages.push(await buildPage(exam, student, student, page));
    }
    printRoot.innerHTML = `<style>
      @page{size:A4 portrait;margin:0}*{box-sizing:border-box}.answer-page{width:210mm;height:297mm;page-break-after:always;break-after:page;display:flex;align-items:center;justify-content:center}.answer-page:last-child{page-break-after:auto;break-after:auto}.answer-page svg{width:210mm;height:297mm;display:block}
    </style>${pages.join('')}`;
    document.body.classList.add('printing-answer-sheets');
    window.print();
    setTimeout(()=>{printRoot.innerHTML='';document.body.classList.remove('printing-answer-sheets');},1200);
  }

  window.AnswerSheet = { PAGE_SIZE:PAGE_SIZE, TEMPLATE_VERSION:TEMPLATE_VERSION, pageQuestions:pageQuestions, getBubbleCoordinates:getBubbleCoordinates, buildPage:buildPage, printBatch:printBatch };
})();
