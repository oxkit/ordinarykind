(function () {
  var form = document.querySelector('form[data-contact-site]');
  if (!form) return;
  var button = form.querySelector('button[type="submit"]');
  var status = form.querySelector('[data-contact-status]');
  var endpoint = 'https://delightful-meadow-0fa5c1200.8.azurestaticapps.net/api/contact?site=' + encodeURIComponent(form.dataset.contactSite);
  var token = null;
  var pending = false;

  function tell(message, error) {
    status.textContent = message;
    status.dataset.error = error ? 'true' : 'false';
  }

  async function prepare() {
    token = null;
    button.disabled = true;
    try {
      var response = await fetch(endpoint, { cache: 'no-store', credentials: 'omit' });
      var data = await response.json();
      if (!response.ok || !data.token) throw new Error('unavailable');
      token = data.token;
      button.disabled = false;
      return true;
    } catch (_) {
      tell('The form is temporarily unavailable. Please use the email or contact links on this page.', true);
      return false;
    }
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (pending || !token || !form.reportValidity()) return;
    pending = true;
    button.disabled = true;
    button.textContent = 'Sending...';
    tell('Sending your message. Please keep this page open.', false);
    var fields = new FormData(form);
    var retryAllowed = false;
    var sent = false;
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 35000);
    try {
      var response = await fetch(endpoint, {
        method: 'POST',
        // SWA intercepts OPTIONS; this safelisted type lets the JSON body reach our origin checks.
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        credentials: 'omit',
        signal: controller.signal,
        body: JSON.stringify({
          name: fields.get('name'), email: fields.get('email'), phone: fields.get('phone') || '',
          message: fields.get('message'), website: fields.get('website') || '', token: token
        })
      });
      var data = await response.json();
      if (!response.ok) {
        retryAllowed = [400, 403, 409, 413, 415, 429].includes(response.status);
        tell(data.message || 'We could not send your message. Please email us directly.', true);
      } else {
        sent = true;
        form.reset();
        tell('Thank you. Your message has been sent.', false);
      }
    } catch (_) {
      tell('We could not confirm sending your message. Please email us directly rather than sending it again.', true);
    } finally {
      clearTimeout(timeout);
      pending = false;
      token = null;
      button.textContent = sent ? 'Message sent' : 'Send message';
      if (retryAllowed) await prepare();
      status.focus();
    }
  });

  prepare().then(function (ready) {
    if (ready) tell('Fields marked required must be completed.', false);
  });
})();
