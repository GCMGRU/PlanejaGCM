document.addEventListener('DOMContentLoaded', async () => {
  try {
    const usuario = await iniciarPagina('/dashboard.html');
    const response = await apiFetch('/api/dashboard');
    const dados = response.data;

    if (usuario.perfil === 'SUPERVISOR') {
      document.getElementById('dashboardSubtitulo').textContent = 'Acompanhamento dos projetos e das suas ideias enviadas.';
    }

    renderizarCards(dados);
    renderizarLista('proximosPrazos', dados.proximosPrazos, renderizarModuloResumo);
    renderizarLista('modulosAtrasados', dados.modulosAtrasadosLista, renderizarModuloResumo);
    renderizarLista('ultimosProjetos', dados.ultimosProjetos, renderizarProjetoResumo);
    renderizarLista('ultimasIdeias', dados.ultimasIdeias, renderizarIdeiaResumo);
  } catch (err) {
    document.querySelector('.content').insertAdjacentHTML(
      'afterbegin',
      `<div class="message show error">${escapeHtml(err.message)}</div>`
    );
  }
});

function renderizarCards(dados) {
  const cards = [
    ['Total de projetos', dados.totalProjetos],
    ['Projetos em andamento', dados.projetosEmAndamento],
    ['Projetos concluídos', dados.projetosConcluidos],
    ['Total de módulos', dados.totalModulos],
    ['Módulos pendentes', dados.modulosPendentes],
    ['Módulos concluídos', dados.modulosConcluidos],
    ['Módulos atrasados', dados.modulosAtrasados],
    ['Ideias novas', dados.ideiasNovas],
    ['Ideias em análise', dados.ideiasEmAnalise]
  ];

  document.getElementById('cardsResumo').innerHTML = cards
    .map(([label, valor]) => `
      <article class="card summary-card">
        <strong>${valor}</strong>
        <span>${escapeHtml(label)}</span>
      </article>
    `)
    .join('');
}

function renderizarLista(id, itens, renderizador) {
  const alvo = document.getElementById(id);

  if (!itens.length) {
    alvo.innerHTML = '<div class="empty">Nenhum registro encontrado.</div>';
    return;
  }

  alvo.innerHTML = itens.map(renderizador).join('');
}

function renderizarModuloResumo(modulo) {
  const prazo = valorDataInput(modulo.data_fim_prevista);
  const atrasado = prazo && new Date(`${prazo}T00:00:00`) < new Date(new Date().toDateString());

  return `
    <article class="list-item">
      <h3>${escapeHtml(modulo.nome)}</h3>
      <p class="muted">${escapeHtml(modulo.projeto_nome || '-')} · ${escapeHtml(modulo.responsavel_nome || 'Sem responsável')}</p>
      <div class="actions">
        ${badgeStatus(modulo.status, atrasado)}
        ${badgePrioridade(modulo.prioridade)}
        <span class="badge badge-neutral">${formatarData(modulo.data_fim_prevista)}</span>
        <a class="btn btn-link" href="/projeto-detalhe.html?id=${modulo.projeto_id}">Abrir projeto</a>
      </div>
    </article>
  `;
}

function renderizarProjetoResumo(projeto) {
  return `
    <article class="list-item">
      <h3>${escapeHtml(projeto.nome)}</h3>
      <p class="muted">${escapeHtml(projeto.responsavel_nome || 'Sem responsável')} · criado em ${formatarDataHora(projeto.criado_em)}</p>
      <div class="actions">
        ${badgeStatus(projeto.status)}
        ${badgePrioridade(projeto.prioridade)}
        <a class="btn btn-link" href="/projeto-detalhe.html?id=${projeto.id}">Detalhes</a>
      </div>
    </article>
  `;
}

function renderizarIdeiaResumo(ideia) {
  return `
    <article class="list-item">
      <h3>${escapeHtml(ideia.titulo)}</h3>
      <p class="muted">${escapeHtml(ideia.criado_por_nome || '-')} · ${formatarDataHora(ideia.criado_em)}</p>
      <div class="actions">
        ${badgeStatus(ideia.status)}
        ${badgePrioridade(ideia.prioridade)}
        ${ideia.projeto_nome ? `<span class="badge badge-neutral">${escapeHtml(ideia.projeto_nome)}</span>` : ''}
      </div>
    </article>
  `;
}
