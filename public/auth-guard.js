/**
 * auth-guard.js — A&M Importaciones
 *
 * Reglas de seguridad en cliente:
 *  1. Bloquea el acceso INMEDIATAMENTE si no hay sesión activa.
 *  2. Verifica el token contra el servidor cada 15 segundos.
 *     Si el servidor devuelve 401 (sesión revocada, nuevo login, logout),
 *     redirige al login al instante.
 *  3. Cuando CUALQUIER pestaña hace logout, TODAS las demás pestañas
 *     del mismo origen se cierran en menos de 1 segundo (BroadcastChannel).
 *  4. Cuando la pestaña vuelve a ser visible se reverifica el token.
 *  5. Si la red falla 3 veces seguidas → logout preventivo.
 *  6. Previene el botón Atrás después de logout (history.replaceState).
 *
 * Incluir como PRIMER <script> en cada página protegida.
 * NO incluir en login.html ni en inicio.html.
 */

(function () {
  'use strict';

  const LOGIN_URL   = '/login.html';
  const TOKEN_KEY   = 'am_token';
  const WORKER_KEY  = 'am_worker';
  const BC_NAME     = 'am_auth_channel';
  const BC_LOGOUT   = 'AM_LOGOUT';
  const POLL_MS     = 15000;   // verificar contra servidor cada 15 segundos
  const MAX_FAILS   = 3;       // fallos de red consecutivos antes de logout

  let networkFails = 0;
  let _verifyTimer = null;

  /* ── Helpers ─────────────────────────────────────────────────── */
  function getToken()  { return localStorage.getItem(TOKEN_KEY); }

  function redirectToLogin(motivo) {
    try { sessionStorage.setItem('am_logout_reason', motivo || ''); } catch {}
    // Reemplazar entrada del historial para que "Atrás" no vuelva a la página
    history.replaceState(null, '', LOGIN_URL);
    window.location.replace(LOGIN_URL);
  }

  /* ── 1. Verificación síncrona antes de pintar el DOM ─────────── */
  if (!getToken()) {
    document.documentElement.style.visibility = 'hidden';
    const doRedirect = () => redirectToLogin('no_session');
    document.addEventListener('DOMContentLoaded', doRedirect, { once: true });
    if (document.readyState !== 'loading') doRedirect();
    return;
  }

  /* ── 2. Cierre global de sesión ───────────────────────────────── */
  function logoutAndRedirect(motivo) {
    clearInterval(_verifyTimer);

    // Notificar a TODAS las pestañas del mismo origen
    try {
      const bc = new BroadcastChannel(BC_NAME);
      bc.postMessage({ type: BC_LOGOUT, reason: motivo || 'logout' });
      bc.close();
    } catch {}

    // Fallback localStorage para navegadores sin BroadcastChannel
    try {
      localStorage.setItem('am_logout_broadcast', Date.now().toString());
      localStorage.removeItem('am_logout_broadcast');
    } catch {}

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(WORKER_KEY);
    redirectToLogin(motivo);
  }

  window.AM_logoutAndRedirect = logoutAndRedirect;

  /* ── 3. Escuchar señal de logout desde otras pestañas ─────────── */
  try {
    const bc = new BroadcastChannel(BC_NAME);
    bc.addEventListener('message', function (evt) {
      if (evt.data && evt.data.type === BC_LOGOUT) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(WORKER_KEY);
        redirectToLogin(evt.data.reason || 'remote_logout');
      }
    });
    window._AM_BC = bc;
  } catch {}

  // Fallback: evento storage (Safari, navegadores sin BroadcastChannel)
  window.addEventListener('storage', function (evt) {
    if (evt.key === TOKEN_KEY && !evt.newValue) {
      redirectToLogin('remote_logout');
    }
  });

  /* ── 4. Verificación periódica contra el servidor (cada 15 s) ─── */
  async function verificarTokenEnServidor() {
    const token = getToken();
    if (!token) { logoutAndRedirect('token_missing'); return; }

    try {
      const res = await fetch('/api/auth/verify', {
        method:  'GET',
        headers: { Authorization: 'Bearer ' + token },
        // Evitar que el navegador cachee la respuesta
        cache:   'no-store',
      });

      if (res.status === 401) {
        // Sesión revocada en servidor (logout, nuevo login, expiró)
        logoutAndRedirect('session_revoked');
        return;
      }

      networkFails = 0; // reset en respuesta exitosa
    } catch {
      networkFails++;
      // 3 fallos de red seguidos → logout preventivo
      if (networkFails >= MAX_FAILS) {
        logoutAndRedirect('network_error');
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Primera verificación 3 segundos después de cargar
    setTimeout(verificarTokenEnServidor, 3000);
    // Luego cada 15 segundos
    _verifyTimer = setInterval(verificarTokenEnServidor, POLL_MS);
  }, { once: true });

  /* ── 5. Verificar al volver a la pestaña ─────────────────────── */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      if (!getToken()) { redirectToLogin('no_session'); return; }
      verificarTokenEnServidor();
    }
  });

  /* ── 6. Bloquear botón Atrás después de logout ───────────────── */
  // Añadir entrada al historial para que al presionar Atrás se revise la sesión
  window.addEventListener('pageshow', function (evt) {
    // pageshow con persisted=true significa que viene de la caché del navegador
    if (evt.persisted && !getToken()) {
      redirectToLogin('back_button');
    }
  });

})();
