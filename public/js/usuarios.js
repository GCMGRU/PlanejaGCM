document.addEventListener('DOMContentLoaded', async () => {
  try {
    await iniciarPagina('/usuarios.html');

    if (usuarioLogado.perfil !== 'ADMIN') {
      location.href = '/dashboard.html';
      return;
    }

    configurarEventosUsuarios();
    await carregarUsuarios();
  } catch (err) {
    mostrarMensagem('usuariosMensagem', err.message, 'error');
  }
});

async function carregarUsuarios() {
  try {
    const response = await apiFetch('/api/usuarios');
    renderizarUsuarios(response.data);
  } catch (err) {
    mostrarMensagem('usuariosMensagem', err.message, 'error');
  }
}

function configurarEventosUsuarios() {
  document.getElementById('novoUsuarioBtn').addEventListener('click', abrirFormUsuario);
  document.getElementById('fecharUsuarioForm').addEventListener('click', fecharFormUsuario);
  document.getElementById('cancelarUsuarioForm').addEventListener('click', fecharFormUsuario);
  document.getElementById('usuarioForm').addEventListener('submit', criarUsuario);

  document.getElementById('usuariosTabela').addEventListener('click', async (event) => {
    const botao = event.target.closest('[data-action]');
    if (!botao) return;

    const id = Number(botao.dataset.id);
    const nome = botao.dataset.nome;

    if (botao.dataset.action === 'desativar') await desativarUsuario(id, nome, botao);
    if (botao.dataset.action === 'ativar') await ativarUsuario(id, nome, botao);
    if (botao.dataset.action === 'redefinir-senha') await redefinirSenha(id, nome, botao);
  });
}

function abrirFormUsuario() {
  document.getElementById('usuarioFormPanel').classList.remove('hidden');
  document.getElementById('usuarioForm').reset();
  limparMensagem('usuarioFormMsg');
}

function fecharFormUsuario() {
  document.getElementById('usuarioFormPanel').classList.add('hidden');
  document.getElementById('usuarioForm').reset();
  limparMensagem('usuarioFormMsg');
}

async function criarUsuario(event) {
  event.preventDefault();
  limparMensagem('usuarioFormMsg');

  const btn = event.submitter ?? event.target.querySelector('[type="submit"]');
  setBtnLoading(btn, true);

  const dados = formParaObjeto(event.target);

  try {
    const response = await apiFetch('/api/usuarios', { method: 'POST', body: dados });
    fecharFormUsuario();
    await carregarUsuarios();
    await mostrarSenhaGerada(
      response.data.senha_temporaria,
      `Usuário "${response.data.usuario.nome}" criado`
    );
  } catch (err) {
    mostrarMensagem('usuarioFormMsg', err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

function renderizarUsuarios(usuarios) {
  const tbody = document.getElementById('usuariosTabela');

  if (!usuarios.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum usuário encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = usuarios.map((usuario) => `
    <tr>
      <td><strong>${escapeHtml(usuario.nome)}</strong></td>
      <td>${escapeHtml(usuario.usuario)}</td>
      <td>${escapeHtml(formatarPerfil(usuario.perfil))}</td>
      <td><span class="badge ${usuario.ativo ? 'badge-success' : 'badge-danger'}">${usuario.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>${formatarDataHora(usuario.criado_em)}</td>
      <td>
        <div class="actions">
          ${usuario.id !== usuarioLogado.id ? `
            ${usuario.ativo
              ? `<button class="btn btn-secondary btn-small" type="button"
                   data-action="desativar" data-id="${usuario.id}" data-nome="${escapeHtml(usuario.nome)}">Desativar</button>`
              : `<button class="btn btn-secondary btn-small" type="button"
                   data-action="ativar" data-id="${usuario.id}" data-nome="${escapeHtml(usuario.nome)}">Reativar</button>`
            }
            <button class="btn btn-secondary btn-small" type="button"
              data-action="redefinir-senha" data-id="${usuario.id}" data-nome="${escapeHtml(usuario.nome)}">Redefinir senha</button>
          ` : '<span class="muted">Sua conta</span>'}
        </div>
      </td>
    </tr>
  `).join('');
}

async function desativarUsuario(id, nome, btn) {
  const ok = await confirmar(`Desativar o usuário "${nome}"?`, {
    titulo: 'Confirmar desativação',
    descricao: 'O usuário não conseguirá mais fazer login.',
    confirmar: 'Desativar',
    perigo: true
  });
  if (!ok) return;

  setBtnLoading(btn, true);
  try {
    await apiFetch(`/api/usuarios/${id}/desativar`, { method: 'PATCH' });
    await carregarUsuarios();
  } catch (err) {
    await alertar(err.message, { titulo: 'Erro ao desativar' });
  } finally {
    setBtnLoading(btn, false);
  }
}

async function ativarUsuario(id, nome, btn) {
  const ok = await confirmar(`Reativar o usuário "${nome}"?`, {
    titulo: 'Confirmar reativação',
    confirmar: 'Reativar'
  });
  if (!ok) return;

  setBtnLoading(btn, true);
  try {
    await apiFetch(`/api/usuarios/${id}/ativar`, { method: 'PATCH' });
    await carregarUsuarios();
  } catch (err) {
    await alertar(err.message, { titulo: 'Erro ao reativar' });
  } finally {
    setBtnLoading(btn, false);
  }
}

async function redefinirSenha(id, nome, btn) {
  const ok = await confirmar(`Redefinir a senha de "${nome}"?`, {
    titulo: 'Redefinir senha',
    descricao: 'Uma nova senha aleatória será gerada e exibida uma única vez.',
    confirmar: 'Redefinir'
  });
  if (!ok) return;

  setBtnLoading(btn, true);
  try {
    const response = await apiFetch(`/api/usuarios/${id}/redefinir-senha`, { method: 'POST' });
    await carregarUsuarios();
    await mostrarSenhaGerada(response.data.senha_temporaria, `Nova senha de "${nome}"`);
  } catch (err) {
    await alertar(err.message, { titulo: 'Erro ao redefinir senha' });
  } finally {
    setBtnLoading(btn, false);
  }
}
