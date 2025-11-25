
// ==== ANIMA FETCH SHIM v3 (file://) ======================================
(function(){
  const __DEV_HOST = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01]))/;
  const __IS_DEV = (location.protocol === 'file:' || __DEV_HOST.test(location.hostname));
  if (!__IS_DEV) return;

  if (window.__ANIMA_FETCH_SHIM__) return;
  window.__ANIMA_FETCH_SHIM__ = true;
  console.log('ANIMA FETCH SHIM attivo (dev)', location.protocol, location.hostname);

  const lsGet=(k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const lsSet=(k,v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} };

  // seed utente admin se non esiste nulla
  (function seed(){
    const haveAppUsers = Array.isArray(lsGet('appUsers', [])) && lsGet('appUsers', []).length>0;
    const haveUsersRows = Array.isArray(lsGet('usersRows', [])) && lsGet('usersRows', []).length>0;
    const appCfg = lsGet('appSettings', {}) || {};
    const haveAppCfgUsers = Array.isArray(appCfg.users) && appCfg.users.length>0;
    if (!(haveAppUsers || haveUsersRows || haveAppCfgUsers)) {
      const admin = { id:'u-admin', username:'admin', password:'admin123', role:'admin' };
      lsSet('appUsers', [admin]);
      appCfg.users = [admin]; lsSet('appSettings', appCfg);
    }
  })();

  const origFetch = window.fetch.bind(window);
  window.fetch = async function(url, opts={}) {
    const u = (typeof url==='string') ? url : (url && url.url);
    if (!u || !u.startsWith('/api/')) return origFetch(url, opts);

    const path = u.replace(/^\/api\//,'');
    const json = (obj, status=200)=> new Response(JSON.stringify(obj), {status, headers:{'Content-Type':'application/json'}});

    // --- AUTH -------------------------------------------------------------
    if (path === 'auth/me') {
      const me = lsGet('sessionUser', null);
      return json({ user: me || null });
    }
    if (path === 'auth/login') {
      try{
        const body = opts.body ? JSON.parse(opts.body) : {};
        const users = []
          .concat(lsGet('appUsers', []))
          .concat(lsGet('usersRows', []))
          .concat((lsGet('appSettings', {}) || {}).users || []);
        const urec = users.find(x =>
          String(x.username) === String(body.username) &&
          String(x.password||'') === String(body.password||'')
        );
        if (!urec) return json({ error:'Credenziali non valide' }, 401);
        const sess = { id: urec.id || urec.username, username: urec.username, role: urec.role || 'admin' };
        lsSet('sessionUser', sess);
        return json({ user: sess });
      }catch(e){ return json({ error: String(e && e.message || e) }, 400); }
    }
    if (path === 'auth/logout') {
      try{ localStorage.removeItem('sessionUser'); }catch{}
      return json({ ok:true });
    }

    // --- KV STORE ---------------------------------------------------------
    if (path.startsWith('kv/')) {
      const key = decodeURIComponent(path.slice(3));
      if (!opts.method || opts.method === 'GET') return json(lsGet(key, null));
      if (opts.method === 'PUT' || opts.method === 'POST') {
        const body = opts.body ? JSON.parse(opts.body) : null;
        const value = (body && body.value !== undefined) ? body.value : body;
        lsSet(key, value);
        return json({ ok:true });
      }
    }

    return json({ error:'NOT_FOUND_IN_DESKTOP_SHIM', path: u }, 404);
  };
})();


