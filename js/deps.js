(function () {
  'use strict';
  const loaded = {};
  const urls = {
    qrcode: 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
    jsqr: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
    opencv: 'https://docs.opencv.org/4.x/opencv.js',
    xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    chart: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
    jspdfTable: 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js'
  };
  function script(url, id) {
    return new Promise((resolve, reject) => {
      if (id && loaded[id]) return resolve();
      const found = Array.from(document.scripts).find(s => s.src === url);
      if (found && found.dataset.ready === '1') { if (id) loaded[id] = true; return resolve(); }
      const tag = found || document.createElement('script');
      tag.src = url; tag.async = true;
      tag.onload = () => { tag.dataset.ready = '1'; if (id) loaded[id] = true; resolve(); };
      tag.onerror = () => reject(new Error('Tidak dapat memuat pustaka ' + (id || url)));
      if (!found) document.head.appendChild(tag);
    });
  }
  async function load(name) {
    if (loaded[name]) return true;
    if (!urls[name]) throw new Error('Pustaka tidak dikenal.');
    await script(urls[name], name);
    if (name === 'opencv') {
      await new Promise((resolve, reject) => {
        if (window.cv && window.cv.Mat) return resolve();
        const timer = setInterval(() => { if (window.cv && window.cv.Mat) { clearInterval(timer); resolve(); } }, 120);
        setTimeout(() => { clearInterval(timer); reject(new Error('OpenCV belum siap. Periksa koneksi internet.')); }, 25000);
      });
    }
    return true;
  }
  window.Deps = { load: load };
})();
