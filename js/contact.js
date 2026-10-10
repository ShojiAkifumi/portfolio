// お問い合わせフォーム: 入力チェックと送信（送信先は js/config.js の formEndpoint）
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contact-form');
    if (!form) return;
    const status = form.querySelector('.form__status');
    const submit = form.querySelector('[type="submit"]');
    const endpoint = (window.SITE_CONFIG || {}).formEndpoint;

    const rules = {
      name: (v) => (v.trim() ? '' : 'お名前を入力してください。'),
      email: (v) => (!v.trim() ? 'メールアドレスを入力してください。'
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'メールアドレスの形式をご確認ください（例：name@example.com）。'),
      message: (v) => (v.trim() ? '' : 'ご相談内容を入力してください。')
    };

    function check(input) {
      const rule = rules[input.name];
      if (!rule) return true;
      const msg = rule(input.value);
      const err = document.getElementById(`${input.id}-err`);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (err) err.textContent = msg;
      if (err && msg) input.setAttribute('aria-describedby', err.id);
      return !msg;
    }

    Object.keys(rules).forEach((name) => {
      const input = form.elements[name];
      input.addEventListener('blur', () => check(input));
      input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true') check(input); });
    });

    function show(text, state) {
      status.hidden = false;
      status.textContent = text;
      status.dataset.state = state;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const invalid = Object.keys(rules).map((n) => form.elements[n]).filter((i) => !check(i));
      if (invalid.length) { invalid[0].focus(); return; }

      if (!endpoint) {
        show('フォームは現在準備中です。公開までもうしばらくお待ちください。', 'error');
        return;
      }

      submit.disabled = true;
      const label = submit.firstChild.textContent;
      submit.firstChild.textContent = '送信中…';
      try {
        const res = await fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        show('送信しました。内容を確認して、ご入力のメールアドレスにお返事します。', 'ok');
      } catch (err) {
        show('送信できませんでした。通信環境をご確認のうえ、もう一度お試しください。', 'error');
      } finally {
        submit.disabled = false;
        submit.firstChild.textContent = label;
      }
    });
  });
})();
