document.addEventListener('DOMContentLoaded', async () => {
  try {
    await iniciarPagina('/usuarios.html');

    if (usuarioLogado.perfil !== 'DESENVOLVEDOR') {
      mostrarMensagem('usuariosMensagem', 'Acesso permitido apenas para desenvolvedores.', 'error');
      return;
    }

    const response = await apiFetch('/api/usuarios');
    renderizarUsuarios(response.data);
  } catch (err) {
    mostrarMensagem('usuariosMensagem', err.message, 'error');
  }
});

function renderizarUsuarios(usuarios) {
  const tbody = document.getElementById('usuariosTabela');

  if (!usuarios.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Nenhum usuário encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = usuarios.map((usuario) => `
    <tr>
      <td>${escapeHtml(usuario.nome)}</td>
      <td>${escapeHtml(usuario.usuario)}</td>
      <td>${escapeHtml(formatarPerfil(usuario.perfil))}</td>
      <td><span class="badge ${usuario.ativo ? 'badge-success' : 'badge-danger'}">${usuario.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>${formatarDataHora(usuario.criado_em)}</td>
    </tr>
  `).join('');
}
