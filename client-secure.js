(function () {
  const noop = function () {};

  if (typeof console !== 'undefined') {
    console.log = noop;
    console.info = noop;
    console.warn = noop;
    console.error = noop;
    console.debug = noop;
  }

  const SAFE_MESSAGES = {
    default: 'Something went wrong. Please try again.',
    network: 'Unable to reach the service right now. Please try again shortly.',
    auth: 'Invalid username or password. Please try again.',
    session: 'Your session has expired. Please sign in again.',
    save: 'Unable to save changes right now. Please try again.',
    load: 'Unable to load your account right now. Please try again.'
  };

  const ALLOWED_PREFIXES = [
    'Invalid username or password',
    'Invalid admin credentials',
    'Invalid login request',
    'Too many attempts',
    'Your plan has exceeded',
    'At least one user must remain',
    'At least one account is required',
    'All changes saved successfully',
    'User deleted successfully',
    'Defaults restored',
    'New user created'
  ];

  function isAllowedUserMessage(message) {
    if (typeof message !== 'string' || !message.trim()) {
      return false;
    }

    return ALLOWED_PREFIXES.some(function (prefix) {
      return message.indexOf(prefix) === 0;
    });
  }

  window.BoASecure = {
    message: function (key) {
      return SAFE_MESSAGES[key] || SAFE_MESSAGES.default;
    },
    toUserMessage: function (error, fallbackKey) {
      const fallback = SAFE_MESSAGES[fallbackKey] || SAFE_MESSAGES.default;
      const raw = error && error.message ? String(error.message) : '';

      if (isAllowedUserMessage(raw)) {
        return raw;
      }

      return fallback;
    }
  };

  window.addEventListener('error', function (event) {
    event.preventDefault();
    return true;
  });

  window.addEventListener('unhandledrejection', function (event) {
    event.preventDefault();
  });
})();
