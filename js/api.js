(function () {
  'use strict';
  const TOKEN_KEY = 'sljs_session_v1';
  const inflight = new Map();
  const memoryCache = new Map();
  let writeEpoch = 0;
  let batchQueue = [];
  let batchScheduled = false;

  function gasUrl() {
    const value = String(window.GAS_URL || '').trim();
    if (!value || value.indexOf('/exec') < 0) throw new Error('URL backend belum diatur pada frontend/js/config.js.');
    return value;
  }
  function token() { return sessionStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(value) { if (value) sessionStorage.setItem(TOKEN_KEY, value); else sessionStorage.removeItem(TOKEN_KEY); }
  function cacheKey(action, data) { return writeEpoch + '|' + action + '|' + JSON.stringify(data || {}); }

  async function run(action, data, options) {
    const opts = options || {};
    const payload = { action: action, data: data || {} };
    if (token() && action !== 'auth.login') payload.token = token();
    const response = await fetch(gasUrl(), {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: opts.signal
    });
    const result = await response.json();
    if (!result || result.success !== true) throw new Error(result && result.message || 'Permintaan tidak berhasil.');
    return result.data;
  }

  function queueRead(action,data) {
    return new Promise((resolve,reject)=>{
      batchQueue.push({action:action,data:data||{},resolve:resolve,reject:reject});
      if(!batchScheduled){
        batchScheduled=true;
        Promise.resolve().then(flushBatch);
      }
    });
  }
  async function flushBatch() {
    batchScheduled=false;
    const pending=batchQueue.splice(0);
    if(!pending.length)return;
    try {
      const payload={calls:pending.map((item,index)=>({id:String(index),action:item.action,data:item.data}))};
      const result=await run('api.batch',payload);
      const byId=new Map((result.results||[]).map(item=>[String(item.id),item]));
      pending.forEach((item,index)=>{
        const response=byId.get(String(index));
        if(response&&response.success)item.resolve(response.data);
        else item.reject(new Error(response&&response.message||'Permintaan baca dalam batch gagal.'));
      });
    } catch(error) { pending.forEach(item=>item.reject(error)); }
    if(batchQueue.length&&!batchScheduled){batchScheduled=true;Promise.resolve().then(flushBatch);}
  }
  async function api(action, data, options) {
    const isRead = /^(dashboard\.get|data\.list|exam\.list|exam\.keys\.get|scan\.list|scan\.detail|results\.list|analysis\.get|reports\.get|activity\.list|settings\.get)$/.test(action);
    const opts = options || {};
    if (!isRead) {
      writeEpoch++;
      memoryCache.clear();
      return run(action, data, opts);
    }
    const key = cacheKey(action, data);
    const cached = memoryCache.get(key);
    if (cached && Date.now() - cached.time < (opts.ttl || 15000)) return cached.value;
    if (inflight.has(key)) return inflight.get(key);
    const promise = queueRead(action,data).then(value => {
      memoryCache.set(key, { value: value, time: Date.now() });
      return value;
    }).finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }

  async function getPublicConfig() {
    const url = gasUrl() + '?action=auth.config';
    const response = await fetch(url, { cache: 'no-store' });
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Konfigurasi backend tidak tersedia.');
    return result.data;
  }

  window.API = { call: api, setToken: setToken, getToken: token, clearToken: () => setToken(''), getPublicConfig: getPublicConfig };
})();
