// HYU PREMIUM Supabase browser configuration.
// The project URL and publishable/anon key are safe to use in browser code when RLS is enabled.
// NEVER put the service_role or secret key here.
window.HYU_SUPABASE_CONFIG = {
  enabled: true,
  url: 'https://zkrhwqgmynbbmoktokdq.supabase.co',
  publishableKey: 'sb_publishable_Fqcxk9-U1qalClQZjKcrhA_U822LTIq'
};

// Admin-only enhancements are loaded after the dashboard document is ready so they can
// safely extend the existing inline admin logic without affecting the public gallery.
if (/\/admin\.html$/i.test(window.location.pathname)) {
  const loadAdminEnhancements = () => {
    if (document.querySelector('script[data-hyu-admin-enhancements]')) return;
    const script = document.createElement('script');
    script.src = './assets/js/admin-enhancements.js';
    script.dataset.hyuAdminEnhancements = 'true';
    document.body.appendChild(script);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAdminEnhancements, { once: true });
  } else {
    loadAdminEnhancements();
  }
}
