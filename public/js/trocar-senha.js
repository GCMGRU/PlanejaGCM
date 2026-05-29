document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Verifica autenticação sem redirecionar (já estamos na página de troca)
    const response = await apiFetch('/api/auth/me');
    usuarioLogado = response.data;

    // Se o usuário não precisa trocar a senha, manda pro dashboard
    if (!usuarioLogado.deve_redefinir_senha) {
      location.href = '/dashboard.html';
      return;
    }

    document.getElementById('trocaSenhaForm').addEventListener('submit', trocarSenha);
  } catch (err) {
    // Sessão inválida — redireciona para login
    location.href = '/login.html';
  }
});

async function trocarSenha(event) {
  event.preventDefault();
  limparMensagem('trocaSenhaMensagem');

  const nova = document.getElementById('novaSenha').value;
  const confirma = document.getElementById('confirmarSenha').value;

  if (nova.length < 6) {
    mostrarMensagem('trocaSenhaMensagem', 'A senha deve ter pelo menos 6 caracteres.', 'error');
    return;
  }

  if (nova !== confirma) {
    mostrarMensagem('trocaSenhaMensagem', 'As senhas não coincidem.', 'error');
    return;
  }

  const btn = event.submitter ?? event.target.querySelector('[type="submit"]');
  setBtnLoading(btn, true);

  try {
    await apiFetch('/api/auth/trocar-senha', {
      method: 'POST',
      body: { nova_senha: nova, confirmar_senha: confirma }
    });
    location.href = '/dashboard.html';
  } catch (err) {
    mostrarMensagem('trocaSenhaMensagem', err.message, 'error');
    setBtnLoading(btn, false);
  }
}
