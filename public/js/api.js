const STATUS_LABELS = {
  PLANEJADO: 'Planejado',
  EM_DESENVOLVIMENTO: 'Em desenvolvimento',
  EM_TESTE: 'Em teste',
  PAUSADO: 'Pausado',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
  NAO_INICIADO: 'Não iniciado',
  AGUARDANDO_VALIDACAO: 'Aguardando validação',
  EM_AJUSTE: 'Em ajuste',
  NOVA: 'Nova',
  EM_ANALISE: 'Em análise',
  ACEITA: 'Aceita',
  RECUSADA: 'Recusada',
  TRANSFORMADA_EM_MODULO: 'Transformada em módulo',
  IMPLEMENTADA: 'Implementada',
  AGENDADA: 'Agendada',
  REAGENDADA: 'Reagendada',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada'
};

const PRIORIDADE_LABELS = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
  URGENTE: 'Urgente'
};

let usuarioLogado = null;

async function apiFetch(url, options = {}) {
  const config = {
    credentials: 'same-origin',
    headers: {
      ...(options.headers || {})
    },
    ...options
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const json = await response.json().catch(() => ({
    success: false,
    message: 'Resposta inválida do servidor.'
  }));

  if (response.status === 401 && !location.pathname.endsWith('/login.html')) {
    location.href = '/login.html';
    return Promise.reject(new Error('Sessão expirada.'));
  }

  if (!response.ok || json.success === false) {
    throw new Error(json.message || 'Erro ao processar requisição.');
  }

  return json;
}

async function carregarUsuario() {
  const response = await apiFetch('/api/auth/me');
  usuarioLogado = response.data;

  document.body.classList.add(`perfil-${usuarioLogado.perfil.toLowerCase()}`);

  document.querySelectorAll('[data-user-name]').forEach((el) => {
    el.textContent = usuarioLogado.nome;
  });

  document.querySelectorAll('[data-user-profile]').forEach((el) => {
    el.textContent = formatarPerfil(usuarioLogado.perfil);
  });

  document.querySelectorAll('[data-role="DESENVOLVEDOR"]').forEach((el) => {
    el.classList.toggle('hidden', usuarioLogado.perfil !== 'DESENVOLVEDOR');
  });

  return usuarioLogado;
}

function configurarLogout() {
  document.querySelectorAll('[data-logout]').forEach((botao) => {
    botao.addEventListener('click', async () => {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      } finally {
        location.href = '/login.html';
      }
    });
  });
}

async function iniciarPagina(linkAtivo) {
  await carregarUsuario();
  configurarLogout();

  if (linkAtivo) {
    document.querySelectorAll('.nav-link').forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === linkAtivo);
    });
  }

  return usuarioLogado;
}

function escapeHtml(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatarData(valor) {
  if (!valor) return '-';
  const data = new Date(`${String(valor).slice(0, 10)}T00:00:00`);
  return data.toLocaleDateString('pt-BR');
}

function valorDataInput(valor) {
  return valor ? String(valor).slice(0, 10) : '';
}

function formatarDataHora(valor) {
  if (!valor) return '-';
  return new Date(valor).toLocaleString('pt-BR');
}

function formatarStatus(valor) {
  return STATUS_LABELS[valor] || valor || '-';
}

function formatarPrioridade(valor) {
  return PRIORIDADE_LABELS[valor] || valor || '-';
}

function formatarPerfil(valor) {
  if (valor === 'DESENVOLVEDOR') return 'Desenvolvedor';
  if (valor === 'SUPERVISOR') return 'Supervisor';
  if (valor === 'ADMIN') return 'Admin';
  return valor || '-';
}

function classeStatus(status, atrasado = false) {
  if (atrasado) return 'badge-danger';
  if (status === 'CONCLUIDO' || status === 'CONCLUIDA' || status === 'IMPLEMENTADA' || status === 'ACEITA') return 'badge-success';
  if (status === 'CANCELADO' || status === 'CANCELADA' || status === 'RECUSADA') return 'badge-danger';
  if (status === 'REAGENDADA') return 'badge-warning';
  if (status === 'PAUSADO' || status === 'EM_TESTE' || status === 'EM_ANALISE' || status === 'AGUARDANDO_VALIDACAO' || status === 'EM_AJUSTE') return 'badge-warning';
  return 'badge-status';
}

function classePrioridade(prioridade) {
  if (prioridade === 'URGENTE') return 'badge-danger';
  if (prioridade === 'ALTA') return 'badge-warning';
  if (prioridade === 'BAIXA') return 'badge-neutral';
  return 'badge-status';
}

function badgeStatus(status, atrasado = false) {
  return `<span class="badge ${classeStatus(status, atrasado)}">${atrasado ? 'Atrasado' : escapeHtml(formatarStatus(status))}</span>`;
}

function badgePrioridade(prioridade) {
  return `<span class="badge ${classePrioridade(prioridade)}">${escapeHtml(formatarPrioridade(prioridade))}</span>`;
}

function mostrarMensagem(id, texto, tipo = 'success') {
  const el = document.getElementById(id);
  if (!el) return;

  el.textContent = texto;
  el.className = `message show ${tipo}`;
}

function limparMensagem(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.textContent = '';
  el.className = 'message';
}

function formParaObjeto(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function preencherSelectUsuarios(select, usuarios, valorAtual = '') {
  select.innerHTML = '<option value="">Sem responsável</option>' + usuarios
    .map((usuario) => `<option value="${usuario.id}" ${String(valorAtual) === String(usuario.id) ? 'selected' : ''}>${escapeHtml(usuario.nome)}</option>`)
    .join('');
}

function preencherSelectProjetos(select, projetos, valorAtual = '') {
  select.innerHTML = '<option value="">Sem projeto</option>' + projetos
    .map((projeto) => `<option value="${projeto.id}" ${String(valorAtual) === String(projeto.id) ? 'selected' : ''}>${escapeHtml(projeto.nome)}</option>`)
    .join('');
}

function setBtnLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.textoOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span>${btn.textContent.trim()}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.textoOriginal ?? btn.innerHTML;
    delete btn.dataset.textoOriginal;
  }
}

function _abrirModal({ titulo, mensagem, descricao = '', confirmarTexto = 'Confirmar', cancelarTexto = 'Cancelar', perigo = false, somenteOk = false }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    backdrop.innerHTML = `
      <div class="modal${perigo ? ' modal-perigo' : ''}" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3>${escapeHtml(titulo)}</h3>
        </div>
        <div class="modal-body">
          <p>${escapeHtml(mensagem)}</p>
          ${descricao ? `<p class="muted" style="font-size:0.88rem;margin-top:4px;">${escapeHtml(descricao)}</p>` : ''}
        </div>
        <div class="modal-footer">
          ${somenteOk ? '' : `<button class="btn btn-secondary modal-btn-cancelar">${escapeHtml(cancelarTexto)}</button>`}
          <button class="btn ${perigo ? 'btn-danger' : 'btn-primary'} modal-btn-confirmar">${escapeHtml(somenteOk ? 'OK' : confirmarTexto)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    function fechar(valor) {
      backdrop.style.animation = 'modal-fade-out 120ms ease forwards';
      setTimeout(() => { backdrop.remove(); resolve(valor); }, 120);
    }

    backdrop.querySelector('.modal-btn-confirmar').addEventListener('click', () => fechar(true));
    backdrop.querySelector('.modal-btn-cancelar')?.addEventListener('click', () => fechar(false));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) fechar(false); });

    function onKeydown(e) {
      if (e.key === 'Escape') { fechar(false); document.removeEventListener('keydown', onKeydown); }
      if (somenteOk && e.key === 'Enter') { fechar(true); document.removeEventListener('keydown', onKeydown); }
    }
    document.addEventListener('keydown', onKeydown);
  });
}

function confirmar(mensagem, opcoes = {}) {
  return _abrirModal({
    titulo: opcoes.titulo || 'Confirmar',
    mensagem,
    descricao: opcoes.descricao || '',
    confirmarTexto: opcoes.confirmar || 'Confirmar',
    perigo: opcoes.perigo || false
  });
}

function alertar(mensagem, opcoes = {}) {
  return _abrirModal({
    titulo: opcoes.titulo || 'Atenção',
    mensagem,
    somenteOk: true,
    perigo: opcoes.perigo || false
  });
}

function mostrarSenhaGerada(senha, titulo = 'Senha gerada') {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3>${escapeHtml(titulo)}</h3>
        </div>
        <div class="modal-body">
          <p>Anote a senha abaixo. <strong>Ela não será exibida novamente.</strong></p>
          <div class="senha-reveal">
            <code>${escapeHtml(senha)}</code>
            <button class="btn btn-secondary btn-small senha-copiar-btn" type="button">Copiar</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary modal-btn-ok">Entendido</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    function fechar() {
      backdrop.style.animation = 'modal-fade-out 120ms ease forwards';
      setTimeout(() => { backdrop.remove(); resolve(); }, 120);
    }

    backdrop.querySelector('.modal-btn-ok').addEventListener('click', fechar);

    backdrop.querySelector('.senha-copiar-btn').addEventListener('click', async (e) => {
      try {
        await navigator.clipboard.writeText(senha);
        e.target.textContent = 'Copiado!';
        setTimeout(() => { e.target.textContent = 'Copiar'; }, 2000);
      } catch {
        // sem permissão de clipboard
      }
    });
  });
}
