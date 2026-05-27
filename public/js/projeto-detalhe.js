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
    if (botao.dataset.action === 'excluir') await excluirModulo(modulo, botao);
    if (botao.dataset.action === 'concluir') await concluirModulo(modulo, botao);
  });

  document.getElementById('novoCommitBtn')?.addEventListener('click', () => abrirFormCommit());
  document.getElementById('cancelarCommitForm').addEventListener('click', fecharFormCommit);
  document.getElementById('commitForm').addEventListener('submit', registrarCommit);
  document.getElementById('commitModuloSelect').addEventListener('change', () => {
    const moduloId = document.getElementById('commitModuloSelect').value;
    if (moduloId) carregarCommits(Number(moduloId));
  });

  document.getElementById('commitLista').addEventListener('click', async (event) => {
    const botao = event.target.closest('[data-action="excluir-commit"]');
    if (!botao) return;
    const id = Number(botao.dataset.id);
    const moduloId = Number(document.getElementById('commitModuloSelect').value);
    await excluirCommit(id, moduloId, botao);
  });

  document.getElementById('novoRelatorioBtn')?.addEventListener('click', () => abrirFormRelatorio());
  document.getElementById('cancelarRelatorioForm').addEventListener('click', fecharFormRelatorio);
  document.getElementById('relatorioForm').addEventListener('submit', salvarRelatorio);

  document.getElementById('relatorioLista').addEventListener('click', async (event) => {
    const botao = event.target.closest('[data-action]');
    if (!botao) return;
    const id = Number(botao.dataset.id);
    if (botao.dataset.action === 'editar-relatorio') editarRelatorio(id);
    if (botao.dataset.action === 'excluir-relatorio') await excluirRelatorio(id, botao);
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
  preencherSelectCommitModulo();
  await carregarRelatorios();

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

  const btn = event.submitter ?? event.target.querySelector('[type="submit"]');
  setBtnLoading(btn, true);

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
  } finally {
    setBtnLoading(btn, false);
  }
}

async function excluirModulo(modulo, btn) {
  const ok = await confirmar(`Excluir o módulo "${modulo.nome}"?`, {
    titulo: 'Confirmar exclusão',
    descricao: 'Esta ação não pode ser desfeita.',
    confirmar: 'Excluir',
    perigo: true
  });
  if (!ok) return;

  setBtnLoading(btn, true);
  try {
    await apiFetch(`/api/modulos/${modulo.id}`, { method: 'DELETE' });
    await carregarTudo();
  } catch (err) {
    await alertar(err.message, { titulo: 'Erro ao excluir módulo' });
  } finally {
    setBtnLoading(btn, false);
  }
}

async function concluirModulo(modulo, btn) {
  setBtnLoading(btn, true);
  try {
    await apiFetch(`/api/modulos/${modulo.id}`, {
      method: 'PUT',
      body: { status: 'CONCLUIDO' }
    });
    await carregarTudo();
  } catch (err) {
    await alertar(err.message, { titulo: 'Erro ao concluir módulo' });
  } finally {
    setBtnLoading(btn, false);
  }
}

function preencherSelectCommitModulo() {
  const select = document.getElementById('commitModuloSelect');
  const btn = document.getElementById('novoCommitBtn');

  if (!modulos.length) {
    select.innerHTML = '<option value="">Nenhum módulo cadastrado</option>';
    btn?.classList.add('hidden');
    document.getElementById('commitLista').innerHTML = '<div class="empty">Nenhum módulo cadastrado neste projeto.</div>';
    return;
  }

  const valorAtual = select.value;
  select.innerHTML = modulos
    .map((m) => `<option value="${m.id}" ${String(valorAtual) === String(m.id) ? 'selected' : ''}>${escapeHtml(m.nome)}</option>`)
    .join('');

  if (usuarioLogado.perfil === 'DESENVOLVEDOR') {
    btn?.classList.remove('hidden');
  }

  const moduloSelecionado = valorAtual && modulos.find((m) => String(m.id) === valorAtual)
    ? Number(valorAtual)
    : modulos[0].id;

  select.value = moduloSelecionado;
  carregarCommits(moduloSelecionado);
}

async function carregarCommits(moduloId) {
  try {
    const response = await apiFetch(`/api/modulos/${moduloId}/commits`);
    renderizarCommits(response.data);
  } catch (err) {
    document.getElementById('commitLista').innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
  }
}

function renderizarCommits(commits) {
  const alvo = document.getElementById('commitLista');

  if (!commits.length) {
    alvo.innerHTML = '<div class="empty">Nenhum commit registrado para este módulo.</div>';
    return;
  }

  alvo.innerHTML = commits.map((c) => `
    <article class="list-item">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div>
          <h3>${escapeHtml(c.mensagem)}</h3>
          <p class="muted">
            ${c.hash ? `<code>${escapeHtml(c.hash)}</code> · ` : ''}
            ${c.branch ? `branch <strong>${escapeHtml(c.branch)}</strong> · ` : ''}
            ${c.data_commit ? formatarData(c.data_commit) : formatarDataHora(c.criado_em)}
            ${c.registrado_por_nome ? ` · ${escapeHtml(c.registrado_por_nome)}` : ''}
          </p>
        </div>
        ${usuarioLogado.perfil === 'DESENVOLVEDOR' ? `
          <button class="btn btn-danger" type="button" data-action="excluir-commit" data-id="${c.id}">Remover</button>
        ` : ''}
      </div>
    </article>
  `).join('');
}

function abrirFormCommit() {
  document.getElementById('commitFormPanel').classList.remove('hidden');
  document.getElementById('commitForm').reset();
  limparMensagem('commitFormMsg');
}

function fecharFormCommit() {
  document.getElementById('commitFormPanel').classList.add('hidden');
  document.getElementById('commitForm').reset();
  limparMensagem('commitFormMsg');
}

async function registrarCommit(event) {
  event.preventDefault();
  limparMensagem('commitFormMsg');

  const btn = event.submitter ?? event.target.querySelector('[type="submit"]');
  setBtnLoading(btn, true);

  const moduloId = document.getElementById('commitModuloSelect').value;
  const dados = formParaObjeto(event.target);

  try {
    await apiFetch(`/api/modulos/${moduloId}/commits`, { method: 'POST', body: dados });
    mostrarMensagem('commitFormMsg', 'Commit registrado com sucesso.');
    await carregarCommits(Number(moduloId));
    setTimeout(fecharFormCommit, 700);
  } catch (err) {
    mostrarMensagem('commitFormMsg', err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

async function excluirCommit(id, moduloId, btn) {
  const ok = await confirmar('Remover este commit?', {
    titulo: 'Confirmar remoção',
    confirmar: 'Remover',
    perigo: true
  });
  if (!ok) return;

  setBtnLoading(btn, true);
  try {
    await apiFetch(`/api/modulos/${moduloId}/commits/${id}`, { method: 'DELETE' });
    await carregarCommits(moduloId);
  } catch (err) {
    await alertar(err.message, { titulo: 'Erro ao remover commit' });
  } finally {
    setBtnLoading(btn, false);
  }
}

// === Pré-Análise ===

let relatorios = [];

async function carregarRelatorios() {
  try {
    const response = await apiFetch(`/api/projetos/${projetoId}/pre-analise`);
    relatorios = response.data;
    renderizarRelatorios();
  } catch (err) {
    document.getElementById('relatorioLista').innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
  }
}

function renderizarRelatorios() {
  const alvo = document.getElementById('relatorioLista');

  if (!relatorios.length) {
    alvo.innerHTML = '<div class="empty">Nenhum relatório de pré-análise cadastrado.</div>';
    return;
  }

  alvo.innerHTML = relatorios.map((r) => `
    <article class="list-item">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div style="flex:1;min-width:0;">
          <h3>${escapeHtml(r.titulo)}</h3>
          <p style="white-space:pre-wrap;">${escapeHtml(r.conteudo)}</p>
          <p class="muted" style="font-size:0.82rem;">${escapeHtml(r.criado_por_nome || '-')} · ${formatarDataHora(r.criado_em)}</p>
        </div>
        ${usuarioLogado.perfil === 'DESENVOLVEDOR' ? `
          <div class="actions" style="flex-shrink:0;">
            <button class="btn btn-secondary btn-small" type="button" data-action="editar-relatorio" data-id="${r.id}">Editar</button>
            <button class="btn btn-danger btn-small" type="button" data-action="excluir-relatorio" data-id="${r.id}">Excluir</button>
          </div>
        ` : ''}
      </div>
    </article>
  `).join('');
}

function abrirFormRelatorio() {
  document.getElementById('relatorioFormPanel').classList.remove('hidden');
  document.getElementById('relatorioForm').reset();
  document.getElementById('relatorioId').value = '';
  limparMensagem('relatorioFormMsg');
}

function editarRelatorio(id) {
  const r = relatorios.find((item) => item.id === id);
  if (!r) return;
  document.getElementById('relatorioFormPanel').classList.remove('hidden');
  document.getElementById('relatorioId').value = r.id;
  document.getElementById('relatorioTitulo').value = r.titulo;
  document.getElementById('relatorioConteudo').value = r.conteudo;
  limparMensagem('relatorioFormMsg');
  document.getElementById('relatorioFormPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function fecharFormRelatorio() {
  document.getElementById('relatorioFormPanel').classList.add('hidden');
  document.getElementById('relatorioForm').reset();
  limparMensagem('relatorioFormMsg');
}

async function salvarRelatorio(event) {
  event.preventDefault();
  limparMensagem('relatorioFormMsg');

  const btn = event.submitter ?? event.target.querySelector('[type="submit"]');
  setBtnLoading(btn, true);

  const dados = formParaObjeto(event.target);
  const id = dados.id;
  delete dados.id;

  try {
    if (id) {
      await apiFetch(`/api/pre-analise/${id}`, { method: 'PUT', body: dados });
      mostrarMensagem('relatorioFormMsg', 'Relatório atualizado com sucesso.');
    } else {
      await apiFetch(`/api/projetos/${projetoId}/pre-analise`, { method: 'POST', body: dados });
      mostrarMensagem('relatorioFormMsg', 'Relatório criado com sucesso.');
    }
    await carregarRelatorios();
    setTimeout(fecharFormRelatorio, 700);
  } catch (err) {
    mostrarMensagem('relatorioFormMsg', err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

async function excluirRelatorio(id, btn) {
  const ok = await confirmar('Excluir este relatório de pré-análise?', {
    titulo: 'Confirmar exclusão',
    descricao: 'Esta ação não pode ser desfeita.',
    confirmar: 'Excluir',
    perigo: true
  });
  if (!ok) return;

  setBtnLoading(btn, true);
  try {
    await apiFetch(`/api/pre-analise/${id}`, { method: 'DELETE' });
    await carregarRelatorios();
  } catch (err) {
    await alertar(err.message, { titulo: 'Erro ao excluir relatório' });
  } finally {
    setBtnLoading(btn, false);
  }
}
