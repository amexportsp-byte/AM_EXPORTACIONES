/**
 * auth-guard.js — A&M Importaciones
 *
 * Protección universal de páginas:
 *   1. Bloquea el acceso inmediatamente si no hay sesión activa.
 *   2. Cuando CUALQUIER pestaña cierra sesión, TODAS las demás
 *      pestañas del sistema son redirigidas al login al instante.
 *
 * Cómo funciona el logout multi-pestaña:
 *   - BroadcastChannel: canal instantáneo entre pestañas del mismo origen.
 *   - localStorage 'storage' event: fallback para navegadores sin BroadcastChannel.
 *   - El API.request() ya llama a logoutAndRedirect() cuando recibe 401.
 *
 * Incluir este script como PRIMER <script> en cada página protegida.
 * NO incluir en login.html ni en inicio.html (tienda pública).
 */

(function () {
  'use strict';

  const LOGIN_URL  = 'login.html';
  const TOKEN_KEY  = 'am_token';
  const WORKER_KEY = 'am_worker';
  const BC_NAME    = 'am_auth_channel';    // nombre del canal de broadcast
  const BC_LOGOUT  = 'AM_LOGOUT';          // mensaje de logout global

  /* ── 1. Verificación instantánea ──────────────────────────────────── */
  function getToken() { return localStorage.getItem(TOKEN_KEY); }

  function redirectToLogin(motivo) {
    // Guardar motivo para mostrarlo en el login (opcional)
    try { sessionStorage.setItem('am_logout_reason', motivo || ''); } catch {}
    // Reemplazamos la historia para que el botón Atrás no vuelva a la página
    window.location.replace(LOGIN_URL);
  }

  // Verificación síncrona antes de que el DOM se pinte
  if (!getToken()) {
    // Ocultar el body inmediatamente para evitar el flash de contenido
    document.documentElement.style.visibility = 'hidden';
    // DOMContentLoaded garantiza que la URL sea correcta antes de redirigir
    document.addEventListener('DOMContentLoaded', function () {
      redirectToLogin('no_session');
    }, { once: true });
    // Bloqueo adicional: si DOMContentLoaded ya disparó, redirigir ahora
    if (document.readyState !== 'loading') redirectToLogin('no_session');
    return; // No continuar con el resto del guard
  }

  /* ── 2. Función global de cierre de sesión ────────────────────────── */
  function logoutAndRedirect(motivo) {
    // Difundir a todas las pestañas ANTES de limpiar el token
    try {
      const bc = new BroadcastChannel(BC_NAME);
      bc.postMessage({ type: BC_LOGOUT, reason: motivo || 'logout' });
      bc.close();
    } catch {}

    // También via localStorage para compatibilidad
    try {
      localStorage.setItem('am_logout_broadcast', Date.now().toString());
      localStorage.removeItem('am_logout_broadcast');
    } catch {}

    // Limpiar sesión local
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(WORKER_KEY);

    redirectToLogin(motivo);
  }

  // Exponer globalmente para que otros scripts puedan llamarla
  window.AM_logoutAndRedirect = logoutAndRedirect;

  /* ── 3. Escuchar señal de logout desde otras pestañas ─────────────── */

  // Via BroadcastChannel (instantáneo, sin tocar el servidor)
  try {
    const bc = new BroadcastChannel(BC_NAME);
    bc.addEventListener('message', function (evt) {
      if (evt.data && evt.data.type === BC_LOGOUT) {
        // Limpiar localmente y redirigir
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(WORKER_KEY);
        redirectToLogin(evt.data.reason || 'remote_logout');
      }
    });
    // Guardar referencia para no cerrarla accidentalmente
    window._AM_BC = bc;
  } catch {}

  // Via localStorage storage event (fallback para Safari y otros)
  window.addEventListener('storage', function (evt) {
    if (evt.key === TOKEN_KEY && !evt.newValue) {
      // El token fue eliminado en otra pestaña
      redirectToLogin('remote_logout');
    }
  });

  /* ── 4. Verificación periódica del token contra el servidor ───────── */
  // Cada 2 minutos verifica que el token siga siendo válido en el servidor.
  // Si el admin revoca la sesión desde control.html, esta pestaña lo detecta.
  let _verifyTimer = null;

  async function verificarTokenEnServidor() {
    const token = getToken();
    if (!token) { logoutAndRedirect('token_missing'); return; }
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token }
      });
      if (res.status === 401) {
        logoutAndRedirect('token_invalid');
      }
    } catch {
      // Si la red falla, no cerramos sesión (podría ser pérdida momentánea)
    }
  }

  // Verificar 5 segundos después de cargar (da tiempo al DOMContentLoaded)
  // y luego cada 2 minutos
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(verificarTokenEnServidor, 5000);
    _verifyTimer = setInterval(verificarTokenEnServidor, 120000);
  }, { once: true });

  // Verificar cuando la pestaña vuelve a estar visible
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      if (!getToken()) { redirectToLogin('no_session'); return; }
      verificarTokenEnServidor();
    }
  });

})();
