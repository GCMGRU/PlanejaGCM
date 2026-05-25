document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const mensagem = document.getElementById('loginMensagem');

  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then((res) => {
      if (res.ok) {
        location.href = '/dashboard.html';
      }
    })
    .catch(() => {});

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    mensagem.className = 'message';
    mensagem.textContent = '';

    const dados = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });

      const json = await response.json();

      if (!response.ok || json.success === false) {
        throw new Error(json.message || 'Não foi possível entrar.');
      }

      location.href = '/dashboard.html';
    } catch (err) {
      mensagem.textContent = err.message;
      mensagem.className = 'message show error';
    }
  });
});
