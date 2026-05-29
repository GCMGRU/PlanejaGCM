let ideias = [];
let projetosIdeias = [];
let usuariosIdeias = [];

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await iniciarPagina('/ideias.html');

    if (usuarioLogado.perfil === 'SUPERVISOR') {
      document.getElementById('ideiasSubtitulo').textContent = 'Suas sugestões e respostas dos desenvolvedores.';
    }

    await carregarProjetosEUsuarios();
    configurarEventosIdeias();
    await carregarIdeias();
  } catch (err) {
    mostrarMensagem('ideiaMensagem', err.message, 'error');
  } finally {
    finalizarCarregamento();
  }
});

async function carregarProjetosEUsuarios() {
  const projetosResponse = await apiFetch('/api/projetos');
  projetosIdeias = projetosResponse.data;

  preencherSelectProjetos(document.getElementById('projetoFiltro'), projetosIdeias);
  preencherSelectProjetos(document.getElementById('projeto_id'), projetosIdeias);
  preencherSelectProjetos(document.getElementById('transformarProjeto'), projetosIdeias);

  if (usuarioLogado.perfil === 'DESENVOLVEDOR') {
    const usuariosResponse = await apiFetch('/api/usuarios');
    usuariosIdeias = usuariosResponse.data;
    preencherSelectUsuarios(document.getElementById('transformarResponsavel'), usuariosIdeias);
  }
}

function configurarEventosIdeias() {
  document.getElementById('novaIdeiaBtn').addEventListener('click', () => abrirFormIdeia());
  document.getElementById('fecharIdeiaForm').addEventListener('click', fecharFormIdeia);
  document.getElementById('cancelarIdeiaForm').addEventListener('click', fecharFormIdeia);
  document.getElementById('ideiaForm').addEventListener('submit', salvarIdeia);

  document.getElementById('filtrosIdeias').addEventListener('submit', async (event) => {
    event.preventDefault();
    await carregarIdeias();
  });

  document.getElementById('projeto_id').addEventListener('change', async (event) => {
    await preencherSelectModulos(document.getElementById('modulo_id'), event.target.value);
  });

  document.getElementById('ideiasTabela').addEventListener('click', async (event) => {
    const botao = event.target.closest('[data-action]');
    if (!botao) return;

    const id = Number(botao.dataset.id);
    const ideia = ideias.find((item) => item.id === id);
    if (!ideia) return;

    if (botao.dataset.action === 'editar') abrirFormIdeia(ideia);
    if (botao.dataset.action === 'responder') abrirResposta(ideia);
    if (botao.dataset.action === 'status') await alterarStatus(ideia, botao);
    if (botao.dataset.action === 'transformar') abrirTransformar(ideia);
  });

  document.getElementById('fecharRespostaPanel').addEventListener('click', fecharResposta);
  document.getElementById('respostaForm').addEventListener('submit', salvarResposta);

  document.getElementById('fecharTransformarPanel').addEventListener('click', fecharTransformar);
  document.getElementById('transformarForm').addEventListener('submit', transformarIdeia);
}

async function carregarIdeias() {
  const filtros = new URLSearchParams(new FormData(document.getElementById('filtrosIdeias')));

  for (const [chave, valor] of [...filtros.entries()]) {
    if (!valor) filtros.delete(chave);
  }

  const response = await apiFetch(`/api/ideias?${filtros.toString()}`);
  ideias = response.data;
  renderizarIdeiasTabela();
}

function renderizarIdeiasTabela() {
  const tbody = document.getElementById('ideiasTabela');

  if (!ideias.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhuma ideia encontrada.</td></tr>';
    return;
  }

  tbody.innerHTML = ideias.map((ideia) => `
    <tr>
      <td>
        <strong>${escapeHtml(ideia.titulo)}</strong>
        <div class="muted">${escapeHtml(ideia.descricao)}</div>
        <div class="muted">Criada por ${escapeHtml(ideia.criado_por_nome || '-')} em ${formatarDataHora(ideia.criado_em)}</div>
      </td>
      <td>${badgeStatus(ideia.status)}</td>
      <td>${badgePrioridade(ideia.prioridade)}</td>
      <td>${escapeHtml(ideia.projeto_nome || 'Sem projeto')}</td>
      <td>
        ${ideia.resposta_dev ? escapeHtml(ideia.resposta_dev) : '<span class="muted">Sem resposta</span>'}
        ${ideia.respondido_por_nome ? `<div class="muted">${escapeHtml(ideia.respondido_por_nome)} · ${formatarDataHora(ideia.respondido_em)}</div>` : ''}
      </td>
      <td>${renderizarAcoesIdeia(ideia)}</td>
    </tr>
  `).join('');
}

function renderizarAcoesIdeia(ideia) {
  if (usuarioLogado.perfil === 'SUPERVISOR') {
    if (ideia.status === 'NOVA') {
      return `<button class="btn btn-secondary" type="button" data-action="editar" data-id="${ideia.id}">Editar</button>`;
    }

    return '<span class="muted">Acompanhamento</span>';
  }

  return `
    <div class="actions">
      <button class="btn btn-secondary" type="button" data-action="editar" data-id="${ideia.id}">Editar</button>
      <button class="btn btn-secondary" type="button" data-action="responder" data-id="${ideia.id}">Responder</button>
      ${ideia.status !== 'TRANSFORMADA_EM_MODULO' ? `<button class="btn btn-primary" type="button" data-action="transformar" data-id="${ideia.id}">Virar módulo</button>` : ''}
      <select data-status-select="${ideia.id}">
        ${['NOVA', 'EM_ANALISE', 'ACEITA', 'RECUSADA', 'TRANSFORMADA_EM_MODULO', 'IMPLEMENTADA']
          .map((status) => `<option value="${status}" ${status === ideia.status ? 'selected' : ''}>${formatarStatus(status)}</option>`)
          .join('')}
      </select>
      <button class="btn btn-secondary" type="button" data-action="status" data-id="${ideia.id}">Salvar status</button>
    </div>
  `;
}

async function preencherSelectModulos(select, projetoId, valorAtual = '') {
  if (!projetoId) {
    select.innerHTML = '<option value="">Sem módulo</option>';
    return;
  }

  const response = await apiFetch(`/api/projetos/${projetoId}/modulos`);
  select.innerHTML = '<option value="">Sem módulo</option>' + response.data
    .map((modulo) => `<option value="${modulo.id}" ${String(valorAtual) === String(modulo.id) ? 'selected' : ''}>${escapeHtml(modulo.nome)}</option>`)
    .join('');
}

async function abrirFormIdeia(ideia = null) {
  limparMensagem('ideiaMensagem');
  const form = document.getElementById('ideiaForm');
  form.reset();
  document.getElementById('ideiaFormPanel').classList.remove('hidden');
  document.getElementById('ideiaFormTitulo').textContent = ideia ? 'Editar ideia' : 'Nova ideia';
  document.getElementById('ideiaId').value = ideia?.id || '';
  document.getElementById('titulo').value = ideia?.titulo || '';
  document.getElementById('descricao').value = ideia?.descricao || '';
  document.getElementById('prioridade').value = ideia?.prioridade || 'MEDIA';
  document.getElementById('projeto_id').value = ideia?.projeto_id || '';
  await preencherSelectModulos(document.getElementById('modulo_id'), ideia?.projeto_id || '', ideia?.modulo_id || '');
}

function fecharFormIdeia() {
  document.getElementById('ideiaFormPanel').classList.add('hidden');
  document.getElementById('ideiaForm').reset();
  limparMensagem('ideiaMensagem');
}

async function salvarIdeia(event) {
  event.preventDefault();
  limparMensagem('ideiaMensagem');

  const btn = event.submitter ?? event.target.querySelector('[type="submit"]');
  setBtnLoading(btn, true);

  const dados = formParaObjeto(event.target);
  const id = dados.id;
  delete dados.id;

  try {
    if (id) {
      await apiFetch(`/api/ideias/${id}`, { method: 'PUT', body: dados });
      mostrarMensagem('ideiaMensagem', 'Ideia atualizada com sucesso.');
    } else {
      await apiFetch('/api/ideias', { method: 'POST', body: dados });
      mostrarMensagem('ideiaMensagem', 'Ideia criada com sucesso.');
    }

    await carregarIdeias();
    setTimeout(fecharFormIdeia, 700);
  } catch (err) {
    mostrarMensagem('ideiaMensagem', err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

function abrirResposta(ideia) {
  limparMensagem('respostaMensagem');
  document.getElementById('respostaPanel').classList.remove('hidden');
  document.getElementById('respostaIdeiaId').value = ideia.id;
  document.getElementById('resposta_dev').value = ideia.resposta_dev || '';
}

function fecharResposta() {
  document.getElementById('respostaPanel').classList.add('hidden');
  document.getElementById('respostaForm').reset();
}

async function salvarResposta(event) {
  event.preventDefault();
  limparMensagem('respostaMensagem');

  const btn = event.submitter ?? event.target.querySelector('[type="submit"]');
  setBtnLoading(btn, true);

  const id = document.getElementById('respostaIdeiaId').value;
  const dados = formParaObjeto(event.target);

  try {
    await apiFetch(`/api/ideias/${id}/responder`, { method: 'PUT', body: dados });
    mostrarMensagem('respostaMensagem', 'Resposta salva com sucesso.');
    await carregarIdeias();
    setTimeout(fecharResposta, 700);
  } catch (err) {
    mostrarMensagem('respostaMensagem', err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

async function alterarStatus(ideia, btn) {
  const select = document.querySelector(`[data-status-select="${ideia.id}"]`);
  setBtnLoading(btn, true);
  try {
    await apiFetch(`/api/ideias/${ideia.id}/status`, {
      method: 'PUT',
      body: { status: select.value }
    });
    await carregarIdeias();
  } catch (err) {
    await alertar(err.message, { titulo: 'Erro ao atualizar status' });
  } finally {
    setBtnLoading(btn, false);
  }
}

function abrirTransformar(ideia) {
  limparMensagem('transformarMensagem');
  document.getElementById('transformarPanel').classList.remove('hidden');
  document.getElementById('transformarIdeiaId').value = ideia.id;
  document.getElementById('transformarNome').value = ideia.titulo || '';
  document.getElementById('transformarDescricao').value = ideia.descricao || '';
  document.getElementById('transformarProjeto').value = ideia.projeto_id || '';
  document.getElementById('transformarPrioridade').value = ideia.prioridade || 'MEDIA';
  preencherSelectUsuarios(document.getElementById('transformarResponsavel'), usuariosIdeias);
}

function fecharTransformar() {
  document.getElementById('transformarPanel').classList.add('hidden');
  document.getElementById('transformarForm').reset();
}

async function transformarIdeia(event) {
  event.preventDefault();
  limparMensagem('transformarMensagem');

  const btn = event.submitter ?? event.target.querySelector('[type="submit"]');
  setBtnLoading(btn, true);

  const id = document.getElementById('transformarIdeiaId').value;
  const dados = formParaObjeto(event.target);

  try {
    await apiFetch(`/api/ideias/${id}/transformar-em-modulo`, {
      method: 'POST',
      body: dados
    });
    mostrarMensagem('transformarMensagem', 'Módulo criado a partir da ideia.');
    await carregarIdeias();
    setTimeout(fecharTransformar, 700);
  } catch (err) {
    mostrarMensagem('transformarMensagem', err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}
