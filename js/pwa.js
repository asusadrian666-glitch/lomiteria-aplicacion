// js/pwa.js - Registro de Service Worker e Instalación PWA
let deferredPrompt = null;

export function initPWA() {
  // Registrar Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('✅ Service Worker registrado con éxito:', reg.scope);
        })
        .catch((err) => {
          console.warn('⚠️ No se pudo registrar Service Worker:', err);
        });
    });
  }

  // Capturar evento para banner de instalación (Android / Chrome)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Mostrar botón o banner de instalación si no se ha instalado
    const installBanner = document.getElementById('pwa-install-banner');
    if (installBanner) {
      installBanner.style.display = 'flex';
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const installBanner = document.getElementById('pwa-install-banner');
    if (installBanner) {
      installBanner.style.display = 'none';
    }
    console.log('📱 App PWA instalada exitosamente');
  });

  // Detectar estado de conexión online/offline
  window.addEventListener('online', () => {
    updateOnlineBadge(true);
  });
  window.addEventListener('offline', () => {
    updateOnlineBadge(false);
  });
  updateOnlineBadge(navigator.onLine);
}

export function promptPWAInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('Usuario aceptó instalar PWA');
      }
      deferredPrompt = null;
      const installBanner = document.getElementById('pwa-install-banner');
      if (installBanner) installBanner.style.display = 'none';
    });
  } else {
    // Si es iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      alert('📱 Para instalar en tu iPhone:\n1. Toca el botón de Compartir en Safari (icono de cuadrado con flecha hacia arriba).\n2. Selecciona "Añadir a pantalla de inicio".\n3. ¡Listo! Ya tendrás la app en tu celular.');
    } else {
      alert('📱 Para agregar a tu pantalla de inicio:\nToca el menú de tres puntos (⋮) en tu navegador y selecciona "Instalar aplicación" o "Agregar a la pantalla principal".');
    }
  }
}

function updateOnlineBadge(isOnline) {
  const badge = document.getElementById('network-status-badge');
  if (badge) {
    if (isOnline) {
      badge.textContent = 'En línea';
      badge.className = 'live-dot';
      badge.title = 'Conectado a Internet';
    } else {
      badge.textContent = 'Modo Offline';
      badge.className = 'live-dot offline';
      badge.title = 'Modo sin conexión activo (Datos guardados localmente)';
    }
  }
}
