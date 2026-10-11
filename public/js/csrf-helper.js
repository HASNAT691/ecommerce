(function() {
  const tokenMeta = document.querySelector('meta[name="csrf-token"]');
  if (!tokenMeta) return;
  const token = tokenMeta.getAttribute('content');
  if (!token) return;

  function injectFormTokens() {
    document.querySelectorAll('form').forEach(form => {
      const method = (form.getAttribute('method') || 'GET').toUpperCase();
      if (method !== 'GET' && !form.querySelector('input[name="_csrf"]')) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = '_csrf';
        input.value = token;
        form.appendChild(input);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFormTokens);
  } else {
    injectFormTokens();
  }

  if (window.fetch) {
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
      options = options || {};
      const method = (options.method || 'GET').toUpperCase();
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        options.headers = options.headers || {};
        if (options.headers instanceof Headers) {
          if (!options.headers.has('x-csrf-token')) {
            options.headers.set('x-csrf-token', token);
          }
        } else if (Array.isArray(options.headers)) {
          if (!options.headers.some(([k]) => k.toLowerCase() === 'x-csrf-token')) {
            options.headers.push(['x-csrf-token', token]);
          }
        } else {
          if (!options.headers['x-csrf-token']) {
            options.headers['x-csrf-token'] = token;
          }
        }
      }
      return originalFetch.call(this, url, options);
    };
  }

  if (window.jQuery && window.jQuery.ajaxSetup) {
    window.jQuery.ajaxSetup({
      beforeSend: function(xhr, settings) {
        if (!/^(GET|HEAD|OPTIONS)$/i.test(settings.type)) {
          xhr.setRequestHeader('x-csrf-token', token);
        }
      }
    });
  }
})();