let projetoAtual = null;
let modulos = [];
let usuariosProjeto = [];
let projetoId = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await iniciarPagina('/projetos.html');

    projetoId = new URLSearchParams(location.search).get('id');

    if (!projetoId) {
      location.href = '/projetos.html';
      return;
    }

    if (usuarioLogado.perfil === 'DESENVOLVEDOR') {
      const usuariosResponse = await apiFetch('/api/usuarios');
      usuariosProjeto = usuariosResponse.data;
      preencherSelectUsuarios(document.getElementById('moduloResponsavel'), usuariosProjeto);
    }

    configurarEventosDetalhe();
    await carregarTudo();
  } catch (err) {
    document.querySelector('.content').insertAdjacentHTML(
      'afterbegin',
      `<div class="message show error">${escapeHtml(err.message)}</div>`
    );
  }
});

function configurarEventosDetalhe() {
  document.getElementById('novoModuloBtn')?.addEventListener('click', () => abrirFormModulo());
  document.getElementById('fecharModuloForm').addEventListener('click', fecharFormModulo);
  document.getElementById('cancelarModuloForm').addEventListener('click', fecharFormModulo);
  document.getElementById('moduloForm').addEventListener('submit', salvarModulo);

  document.getElementById('modulosTabela').addEventListener('click', async (event) => {
    const botao = event.target.closest('[data-action]');
    if (!botao) return;

    const id = Number(botao.dataset.id);
    const modulo = modulos.find((item) => item.id === id);
    if (!modulo) return;

    if (botao.dataset.action === 'editar') abrirFormModulo(modulo);
    if (botao.dataset.action === 'excluir') await excluirModulo(modulo);
    if (botao.dataset.action === 'concluir') await concluirModulo(modulo);
  });
}

async function carregarTudo() {
  const [projetoResponse, modulosResponse, ideiasResponse] = await Promise.all([
    apiFetch(`/api/projetos/${projetoId}`),
    apiFetch(`/api/projetos/${projetoId}/modulos`),
    apiFetch(`/api/ideias?projeto_id=${projetoId}`)
  ]);

  projetoAtual = projetoResponse.data;
  modulos = modulosResponse.data;

  renderizarProjeto();
  renderizarModulos();
  renderizarIdeias(ideiasResponse.data);

  if (usuarioLogado.perfil === 'DESENVOLVEDOR') {
    const historicoResponse = await apiFetch(`/api/projetos/${projetoId}/historico`);
    renderizarHistorico(historicoResponse.data);
  }
}

function renderizarProjeto() {
  document.getElementById('projetoTitulo').textContent = projetoAtual.nome;
  document.getElementById('projetoDescricao').textContent = projetoAtual.descricao || 'Sem descrição cadastrada.';

  document.getElementById('projetoDados').innerHTML = `
    ${metaItem('Status', badgeStatus(projetoAtual.status))}
    ${metaItem('Prioridade', badgePrioridade(projetoAtual.prioridade))}
    ${metaItem('Responsável principal', escapeHtml(projetoAtual.responsavel_nome || 'Sem responsável'))}
    ${metaItem('Data de início', formatarData(projetoAtual.data_inicio))}
    ${metaItem('Data fim prevista', formatarData(projetoAtual.data_fim_prevista))}
    ${metaItem('Data de conclusão', formatarData(projetoAtual.data_conclusao))}
    ${metaItem('Módulos concluídos', `${projetoAtual.modulos_concluidos || 0} de ${projetoAtual.total_modulos || 0}`)}
    ${metaItem('Criado por', escapeHtml(projetoAtual.criado_por_nome || '-'))}
  `;

  const progresso = projetoAtual.progresso || 0;
  document.getElementById('progressoTexto').textContent = `${progresso}%`;
  document.getElementById('progressoBarra').style.width = `${progresso}%`;
}

function metaItem(label, valorHtml) {
  return `
    <div class="meta-item">
      <span>${escapeHtml(label)}</span>
      <strong>${valorHtml}</strong>
    </div>
  `;
}

function renderizarModulos() {
  const concluidos = modulos.filter((modulo) => modulo.status === 'CONCLUIDO').length;
  const atrasados = modulos.filter((modulo) => modulo.atrasado).length;

  document.getElementById('resumoModulos').innerHTML = `
    <div class="list-item"><h3>${modulos.length}</h3><p>Total de módulos</p></div>
    <div class="list-item"><h3>${concluidos}</h3><p>Módulos concluídos</p></div>
    <div class="list-item"><h3>${atrasados}</h3><p>Módulos atrasados</p></div>
  `;

  const tbody = document.getElementById('modulosTabela');

  if (!modulos.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum módulo cadastrado.</td></tr>';
    return;
  }

  tbody.innerHTML = modulos.map((modulo) => `
    <tr>
      <td>
        <strong>${escapeHtml(modulo.nome)}</strong>
        <div class="muted">${escapeHtml(modulo.descricao || '')}</div>
      </td>
      <td>${badgeStatus(modulo.status, modulo.atrasado)}</td>
      <td>${badgePrioridade(modulo.prioridade)}</td>
      <td>${escapeHtml(modulo.responsavel_nome || 'Sem responsável')}</td>
      <td>${formatarData(modulo.data_fim_prevista)}</td>
      <td>
        <div class="actions">
          ${usuarioLogado.perfil === 'DESENVOLVEDOR' ? `
            ${modulo.status !== 'CONCLUIDO' ? `<button class="btn btn-secondary" type="button" data-action="concluir" data-id="${modulo.id}">Concluir</button>` : ''}
            <button class="btn btn-secondary" type="button" data-action="editar" data-id="${modulo.id}">Editar</button>
            <button class="btn btn-danger" type="button" data-action="excluir" data-id="${modulo.id}">Excluir</button>
          ` : '<span class="muted">Visualização</span>'}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderizarIdeias(ideias) {
  const alvo = document.getElementById('ideiasRelacionadas');

  if (!ideias.length) {
    alvo.innerHTML = '<div class="empty">Nenhuma ideia relacionada.</div>';
    return;
  }

  alvo.innerHTML = ideias.map((ideia) => `
    <article class="list-item">
      <h3>${escapeHtml(ideia.titulo)}</h3>
      <p>${escapeHtml(ideia.descricao)}</p>
      <div class="actions">
        ${badgeStatus(ideia.status)}
        ${badgePrioridade(ideia.prioridade)}
      </div>
      ${ideia.resposta_dev ? `<p class="muted">Resposta: ${escapeHtml(ideia.resposta_dev)}</p>` : ''}
    </article>
  `).join('');
}

function renderizarHistorico(registros) {
  const alvo = document.getElementById('historicoProjeto');

  if (!registros.length) {
    alvo.innerHTML = '<div class="empty">Nenhum histórico registrado.</div>';
    return;
  }

  alvo.innerHTML = registros.map((item) => `
    <article class="list-item">
      <h3>${escapeHtml(item.acao)}</h3>
      <p>${escapeHtml(item.descricao || '')}</p>
      <p class="muted">${formatarDataHora(item.criado_em)} · ${escapeHtml(item.usuario_nome || '-')}</p>
    </article>
  `).join('');
}

function abrirFormModulo(modulo = null) {
  limparMensagem('moduloMensagem');
  const form = document.getElementById('moduloForm');
  form.reset();
  document.getElementById('moduloFormPanel').classList.remove('hidden');
  document.getElementById('moduloFormTitulo').textContent = modulo ? 'Editar módulo' : 'Novo módulo';
  preencherSelectUsuarios(document.getElementById('moduloResponsavel'), usuariosProjeto, modulo?.responsavel_id);

  if (!modulo) {
    document.getElementById('moduloStatus').value = 'NAO_INICIADO';
    document.getElementById('moduloPrioridade').value = 'MEDIA';
    return;
  }

  document.getElementById('moduloId').value = modulo.id;
  document.getElementById('moduloNome').value = modulo.nome || '';
  document.getElementById('moduloDescricao').value = modulo.descricao || '';
  document.getElementById('moduloDataInicio').value = valorDataInput(modulo.data_inicio);
  document.getElementById('moduloDataFim').value = valorDataInput(modulo.data_fim_prevista);
  document.getElementById('moduloDataConclusao').value = valorDataInput(modulo.data_conclusao);
  document.getElementById('moduloStatus').value = modulo.status;
  document.getElementById('moduloPrioridade').value = modulo.prioridade;
  document.getElementById('moduloObservacoes').value = modulo.observacoes || '';
}

function fecharFormModulo() {
  document.getElementById('moduloFormPanel').classList.add('hidden');
  document.getElementById('moduloForm').reset();
  limparMensagem('moduloMensagem');
}

async function salvarModulo(event) {
  event.preventDefault();
  limparMensagem('moduloMensagem');

  const dados = formParaObjeto(event.target);
  const id = dados.id;
  delete dados.id;

  try {
    if (id) {
      await apiFetch(`/api/modulos/${id}`, { method: 'PUT', body: dados });
      mostrarMensagem('moduloMensagem', 'Módulo atualizado com sucesso.');
    } else {
      await apiFetch(`/api/projetos/${projetoId}/modulos`, { method: 'POST', body: dados });
      mostrarMensagem('moduloMensagem', 'Módulo criado com sucesso.');
    }

    await carregarTudo();
    setTimeout(fecharFormModulo, 700);
  } catch (err) {
    mostrarMensagem('moduloMensagem', err.message, 'error');
  }
}

async function excluirModulo(modulo) {
  if (!confirm(`Excluir o módulo "${modulo.nome}"?`)) return;

  try {
    await apiFetch(`/api/modulos/${modulo.id}`, { method: 'DELETE' });
    await carregarTudo();
  } catch (err) {
    alert(err.message);
  }
}

async function concluirModulo(modulo) {
  try {
    await apiFetch(`/api/modulos/${modulo.id}`, {
      method: 'PUT',
      body: { status: 'CONCLUIDO' }
    });
    await carregarTudo();
  } catch (err) {
    alert(err.message);
  }
}
