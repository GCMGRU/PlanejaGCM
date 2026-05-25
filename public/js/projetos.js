let projetos = [];
let usuarios = [];

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await iniciarPagina('/projetos.html');

    if (usuarioLogado.perfil === 'DESENVOLVEDOR') {
      await carregarUsuarios();
    }

    configurarEventos();
    await carregarProjetos();
  } catch (err) {
    mostrarMensagem('projetoMensagem', err.message, 'error');
  }
});

function configurarEventos() {
  document.getElementById('filtrosProjetos').addEventListener('submit', async (event) => {
    event.preventDefault();
    await carregarProjetos();
  });

  document.getElementById('novoProjetoBtn')?.addEventListener('click', () => abrirFormProjeto());
  document.getElementById('fecharProjetoForm').addEventListener('click', fecharFormProjeto);
  document.getElementById('cancelarProjetoForm').addEventListener('click', fecharFormProjeto);

  document.getElementById('projetoForm').addEventListener('submit', salvarProjeto);

  document.getElementById('projetosTabela').addEventListener('click', async (event) => {
    const botao = event.target.closest('[data-action]');
    if (!botao) return;

    const id = Number(botao.dataset.id);
    const projeto = projetos.find((item) => item.id === id);

    if (botao.dataset.action === 'editar' && projeto) {
      abrirFormProjeto(projeto);
    }

    if (botao.dataset.action === 'excluir' && projeto) {
      await excluirProjeto(projeto);
    }
  });
}

async function carregarUsuarios() {
  const response = await apiFetch('/api/usuarios');
  usuarios = response.data;
  preencherSelectUsuarios(document.getElementById('responsavel_id'), usuarios);
}

async function carregarProjetos() {
  const filtros = new URLSearchParams(new FormData(document.getElementById('filtrosProjetos')));

  for (const [chave, valor] of [...filtros.entries()]) {
    if (!valor) filtros.delete(chave);
  }

  const response = await apiFetch(`/api/projetos?${filtros.toString()}`);
  projetos = response.data;
  renderizarTabelaProjetos();
}

function renderizarTabelaProjetos() {
  const tbody = document.getElementById('projetosTabela');

  if (!projetos.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Nenhum projeto encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = projetos.map((projeto) => `
    <tr>
      <td>
        <strong>${escapeHtml(projeto.nome)}</strong>
        <div class="muted">${escapeHtml(projeto.descricao || '')}</div>
      </td>
      <td>${badgeStatus(projeto.status)}</td>
      <td>${badgePrioridade(projeto.prioridade)}</td>
      <td>${escapeHtml(projeto.responsavel_nome || 'Sem responsável')}</td>
      <td>${formatarData(projeto.data_fim_prevista)}</td>
      <td>
        <strong>${projeto.progresso || 0}%</strong>
        <div class="progress"><div class="progress-bar" style="width: ${projeto.progresso || 0}%"></div></div>
      </td>
      <td>
        <div class="actions">
          <a class="btn btn-secondary" href="/projeto-detalhe.html?id=${projeto.id}">Detalhes</a>
          ${usuarioLogado.perfil === 'DESENVOLVEDOR' ? `
            <button class="btn btn-secondary" type="button" data-action="editar" data-id="${projeto.id}">Editar</button>
            <button class="btn btn-danger" type="button" data-action="excluir" data-id="${projeto.id}">Excluir</button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function abrirFormProjeto(projeto = null) {
  limparMensagem('projetoMensagem');
  const form = document.getElementById('projetoForm');
  form.reset();
  document.getElementById('projetoFormPanel').classList.remove('hidden');
  document.getElementById('projetoFormTitulo').textContent = projeto ? 'Editar projeto' : 'Novo projeto';
  preencherSelectUsuarios(document.getElementById('responsavel_id'), usuarios, projeto?.responsavel_id);

  if (!projeto) {
    document.getElementById('prioridade').value = 'MEDIA';
    document.getElementById('status').value = 'PLANEJADO';
    return;
  }

  document.getElementById('projetoId').value = projeto.id;
  document.getElementById('nome').value = projeto.nome || '';
  document.getElementById('descricao').value = projeto.descricao || '';
  document.getElementById('data_inicio').value = valorDataInput(projeto.data_inicio);
  document.getElementById('data_fim_prevista').value = valorDataInput(projeto.data_fim_prevista);
  document.getElementById('data_conclusao').value = valorDataInput(projeto.data_conclusao);
  document.getElementById('status').value = projeto.status;
  document.getElementById('prioridade').value = projeto.prioridade;
}

function fecharFormProjeto() {
  document.getElementById('projetoFormPanel').classList.add('hidden');
  document.getElementById('projetoForm').reset();
  limparMensagem('projetoMensagem');
}

async function salvarProjeto(event) {
  event.preventDefault();
  limparMensagem('projetoMensagem');

  const form = event.target;
  const dados = formParaObjeto(form);
  const id = dados.id;
  delete dados.id;

  try {
    if (id) {
      await apiFetch(`/api/projetos/${id}`, { method: 'PUT', body: dados });
      mostrarMensagem('projetoMensagem', 'Projeto atualizado com sucesso.');
    } else {
      await apiFetch('/api/projetos', { method: 'POST', body: dados });
      mostrarMensagem('projetoMensagem', 'Projeto criado com sucesso.');
    }

    await carregarProjetos();
    setTimeout(fecharFormProjeto, 700);
  } catch (err) {
    mostrarMensagem('projetoMensagem', err.message, 'error');
  }
}

async function excluirProjeto(projeto) {
  if (!confirm(`Excluir o projeto "${projeto.nome}"?`)) return;

  try {
    await apiFetch(`/api/projetos/${projeto.id}`, { method: 'DELETE' });
    await carregarProjetos();
  } catch (err) {
    alert(err.message);
  }
}
