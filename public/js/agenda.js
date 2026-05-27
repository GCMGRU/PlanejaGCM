let reunioes = [];
let projetosLista = [];
let modoEdicao = false;

document.addEventListener('DOMContentLoaded', async () => {
  await iniciarPagina('/agenda.html');
  await carregarAuxiliares();
  await carregarReunioes();
  configurarEventos();
});

async function carregarAuxiliares() {
  try {
    const [projRes, ideiaRes] = await Promise.all([
      apiFetch('/api/projetos'),
      apiFetch('/api/ideias')
    ]);

    projetosLista = projRes.data || [];

    const filtroSelect = document.getElementById('projetoFiltroAgenda');
    filtroSelect.innerHTML = '<option value="">Todos</option>' +
      projetosLista.map((p) => `<option value="${p.id}">${escapeHtml(p.nome)}</option>`).join('');

    preencherSelectProjetos(document.getElementById('reuniaoProjeto'), projetosLista);

    const ideias = ideiaRes.data || [];
    document.getElementById('reuniaoIdeia').innerHTML =
      '<option value="">Sem ideia</option>' +
      ideias.map((i) => `<option value="${i.id}">${escapeHtml(i.titulo)}</option>`).join('');
  } catch (_) {
    // auxiliares são opcionais
  }
}

async function carregarModulosDoProjeto(projetoId, valorAtual = '') {
  const select = document.getElementById('reuniaoModulo');
  select.innerHTML = '<option value="">Sem módulo</option>';

  if (!projetoId) return;

  try {
    const res = await apiFetch(`/api/projetos/${projetoId}/modulos`);
    const modulos = res.data || [];
    modulos.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.nome;
      if (String(m.id) === String(valorAtual)) opt.selected = true;
      select.appendChild(opt);
    });
  } catch (_) {
    // sem módulos
  }
}

async function carregarReunioes() {
  const params = new URLSearchParams();
  const mes = document.getElementById('mesFiltro').value;
  const status = document.getElementById('statusFiltro').value;
  const projetoId = document.getElementById('projetoFiltroAgenda').value;

  if (mes) params.set('mes', mes);
  if (status) params.set('status', status);
  if (projetoId) params.set('projeto_id', projetoId);

  try {
    const res = await apiFetch('/api/reunioes?' + params.toString());
    reunioes = res.data || [];
    renderizarReunioes();
  } catch (e) {
    mostrarMensagem('agendaMensagem', e.message, 'error');
  }
}

function renderizarReunioes() {
  const tbody = document.getElementById('agendaTabela');
  limparMensagem('agendaMensagem');

  if (reunioes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhuma reunião encontrada.</td></tr>';
    return;
  }

  const podeDeletar = usuarioLogado &&
    (usuarioLogado.perfil === 'DESENVOLVEDOR' || usuarioLogado.perfil === 'ADMIN');
  const podeGerenciar = usuarioLogado &&
    (usuarioLogado.perfil === 'DESENVOLVEDOR' || usuarioLogado.perfil === 'SUPERVISOR' || usuarioLogado.perfil === 'ADMIN');

  tbody.innerHTML = reunioes.map((r) => {
    const horario = r.horario ? String(r.horario).slice(0, 5) : '';
    const dataHora = `${formatarData(r.data_reuniao)}${horario ? ' ' + horario : ''}`;
    const terminal = r.status === 'CONCLUIDA' || r.status === 'CANCELADA';
    const podeEditar = podeGerenciar && !terminal;

    let vinculo = '-';
    if (r.projeto_nome) {
      vinculo = `<span class="badge badge-status">${escapeHtml(r.projeto_nome)}</span>`;
      if (r.modulo_nome) vinculo += ` <small class="muted">/ ${escapeHtml(r.modulo_nome)}</small>`;
    } else if (r.ideia_titulo) {
      vinculo = `<span class="badge badge-neutral">${escapeHtml(r.ideia_titulo)}</span>`;
    }

    const acoes = [];
    acoes.push(`<button class="btn btn-secondary btn-small" onclick="verDetalhe(${r.id})">Ver</button>`);

    if (podeEditar) {
      acoes.push(`<button class="btn btn-secondary btn-small" onclick="editarReuniao(${r.id})">Editar</button>`);
    }

    if (podeGerenciar && !terminal) {
      if (r.status === 'AGENDADA') {
        acoes.push(`<button class="btn btn-secondary btn-small" onclick="alterarStatus(${r.id},'REAGENDADA',this)">Reagendar</button>`);
      }
      acoes.push(`<button class="btn btn-secondary btn-small" onclick="alterarStatus(${r.id},'CANCELADA',this)">Cancelar</button>`);
      acoes.push(`<button class="btn btn-primary btn-small" onclick="abrirRelato(${r.id})">Concluir</button>`);
    }

    if (podeDeletar) {
      acoes.push(`<button class="btn btn-danger btn-small" onclick="excluirReuniao(${r.id},this)">Excluir</button>`);
    }

    return `
      <tr>
        <td style="white-space:nowrap">${escapeHtml(dataHora)}</td>
        <td>
          <strong>${escapeHtml(r.titulo)}</strong>
          <br><small class="muted">${escapeHtml(r.assunto.length > 70 ? r.assunto.slice(0, 70) + '…' : r.assunto)}</small>
        </td>
        <td>${escapeHtml(r.setor)}</td>
        <td>${badgeStatus(r.status)}</td>
        <td>${vinculo}</td>
        <td><div class="actions">${acoes.join('')}</div></td>
      </tr>`;
  }).join('');
}

function configurarEventos() {
  document.getElementById('novaReuniaoBtn').addEventListener('click', abrirFormReuniao);
  document.getElementById('fecharReuniaoForm').addEventListener('click', fecharFormReuniao);
  document.getElementById('cancelarReuniaoForm').addEventListener('click', fecharFormReuniao);
  document.getElementById('reuniaoForm').addEventListener('submit', salvarReuniao);

  document.getElementById('fecharRelatoPanel').addEventListener('click', fecharRelatoPanel);
  document.getElementById('cancelarRelatoForm').addEventListener('click', fecharRelatoPanel);
  document.getElementById('relatoForm').addEventListener('submit', salvarRelato);

  document.getElementById('fecharDetalhe').addEventListener('click', () => {
    document.getElementById('reuniaoDetalhe').classList.add('hidden');
  });

  document.getElementById('filtrosAgenda').addEventListener('submit', async (e) => {
    e.preventDefault();
    await carregarReunioes();
  });

  document.getElementById('reuniaoProjeto').addEventListener('change', (e) => {
    carregarModulosDoProjeto(e.target.value);
  });
}

function abrirFormReuniao() {
  modoEdicao = false;
  document.getElementById('reuniaoFormTitulo').textContent = 'Nova reunião';
  document.getElementById('reuniaoId').value = '';
  document.getElementById('reuniaoForm').reset();
  document.getElementById('reuniaoModulo').innerHTML = '<option value="">Sem módulo</option>';
  limparMensagem('reuniaoFormMsg');
  document.getElementById('reuniaoFormPanel').classList.remove('hidden');
  document.getElementById('reuniaoFormPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function fecharFormReuniao() {
  document.getElementById('reuniaoFormPanel').classList.add('hidden');
  document.getElementById('reuniaoForm').reset();
  document.getElementById('reuniaoModulo').innerHTML = '<option value="">Sem módulo</option>';
  limparMensagem('reuniaoFormMsg');
}

async function editarReuniao(id) {
  const reuniao = reunioes.find((r) => r.id === id);
  if (!reuniao) return;

  modoEdicao = true;
  document.getElementById('reuniaoFormTitulo').textContent = 'Editar reunião';
  document.getElementById('reuniaoId').value = reuniao.id;
  document.getElementById('reuniaoTituloInput').value = reuniao.titulo;
  document.getElementById('reuniaoSetor').value = reuniao.setor;
  document.getElementById('reuniaoAssunto').value = reuniao.assunto;
  document.getElementById('reuniaoData').value = valorDataInput(reuniao.data_reuniao);
  document.getElementById('reuniaoHorario').value = reuniao.horario ? String(reuniao.horario).slice(0, 5) : '';

  document.getElementById('reuniaoProjeto').value = reuniao.projeto_id || '';
  if (reuniao.projeto_id) {
    await carregarModulosDoProjeto(reuniao.projeto_id, reuniao.modulo_id);
  }
  document.getElementById('reuniaoIdeia').value = reuniao.ideia_id || '';

  limparMensagem('reuniaoFormMsg');
  document.getElementById('reuniaoFormPanel').classList.remove('hidden');
  document.getElementById('reuniaoFormPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function salvarReuniao(e) {
  e.preventDefault();
  const btn = document.getElementById('salvarReuniaoBtn');
  const id = document.getElementById('reuniaoId').value;

  const dados = {
    titulo: document.getElementById('reuniaoTituloInput').value.trim(),
    setor: document.getElementById('reuniaoSetor').value.trim(),
    assunto: document.getElementById('reuniaoAssunto').value.trim(),
    data_reuniao: document.getElementById('reuniaoData').value,
    horario: document.getElementById('reuniaoHorario').value,
    projeto_id: document.getElementById('reuniaoProjeto').value || null,
    modulo_id: document.getElementById('reuniaoModulo').value || null,
    ideia_id: document.getElementById('reuniaoIdeia').value || null
  };

  setBtnLoading(btn, true);
  limparMensagem('reuniaoFormMsg');

  try {
    if (modoEdicao && id) {
      await apiFetch(`/api/reunioes/${id}`, { method: 'PUT', body: dados });
    } else {
      await apiFetch('/api/reunioes', { method: 'POST', body: dados });
    }
    fecharFormReuniao();
    await carregarReunioes();
  } catch (err) {
    mostrarMensagem('reuniaoFormMsg', err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

async function alterarStatus(id, novoStatus, btn) {
  const label = formatarStatus(novoStatus);

  const ok = await confirmar(
    `Alterar status para "${label}"?`,
    { titulo: 'Alterar status', confirmar: label, perigo: novoStatus === 'CANCELADA' }
  );
  if (!ok) return;

  setBtnLoading(btn, true);
  try {
    await apiFetch(`/api/reunioes/${id}/status`, {
      method: 'PATCH',
      body: { status: novoStatus }
    });
    await carregarReunioes();
  } catch (err) {
    await alertar(err.message, { titulo: 'Erro', perigo: true });
  } finally {
    setBtnLoading(btn, false);
  }
}

function abrirRelato(id) {
  const reuniao = reunioes.find((r) => r.id === id);
  if (!reuniao) return;

  document.getElementById('relatoReuniaoId').value = id;
  document.getElementById('relatoReuniaoDesc').textContent =
    `${reuniao.titulo} — ${formatarData(reuniao.data_reuniao)} ${reuniao.horario ? String(reuniao.horario).slice(0, 5) : ''}`;
  document.getElementById('relatoTexto').value = '';
  limparMensagem('relatoFormMsg');
  document.getElementById('relatoPanel').classList.remove('hidden');
  document.getElementById('relatoPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function fecharRelatoPanel() {
  document.getElementById('relatoPanel').classList.add('hidden');
  document.getElementById('relatoForm').reset();
  limparMensagem('relatoFormMsg');
}

async function salvarRelato(e) {
  e.preventDefault();
  const btn = document.getElementById('salvarRelatoBtn');
  const id = document.getElementById('relatoReuniaoId').value;
  const relato = document.getElementById('relatoTexto').value.trim();

  if (!relato) {
    mostrarMensagem('relatoFormMsg', 'O relato é obrigatório para concluir a reunião.', 'error');
    return;
  }

  setBtnLoading(btn, true);
  limparMensagem('relatoFormMsg');

  try {
    await apiFetch(`/api/reunioes/${id}/status`, {
      method: 'PATCH',
      body: { status: 'CONCLUIDA', relato }
    });
    fecharRelatoPanel();
    await carregarReunioes();
  } catch (err) {
    mostrarMensagem('relatoFormMsg', err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

async function excluirReuniao(id, btn) {
  const reuniao = reunioes.find((r) => r.id === id);
  const ok = await confirmar(
    `Excluir a reunião "${reuniao?.titulo}"?`,
    { titulo: 'Excluir reunião', confirmar: 'Excluir', perigo: true }
  );
  if (!ok) return;

  setBtnLoading(btn, true);
  try {
    await apiFetch(`/api/reunioes/${id}`, { method: 'DELETE' });
    await carregarReunioes();
    const detalhe = document.getElementById('reuniaoDetalhe');
    if (!detalhe.classList.contains('hidden')) detalhe.classList.add('hidden');
  } catch (err) {
    await alertar(err.message, { titulo: 'Erro', perigo: true });
    setBtnLoading(btn, false);
  }
}

function verDetalhe(id) {
  const r = reunioes.find((reuniao) => reuniao.id === id);
  if (!r) return;

  document.getElementById('detalheTitulo').textContent = r.titulo;

  const linhas = [
    ['Setor', escapeHtml(r.setor)],
    ['Data', escapeHtml(formatarData(r.data_reuniao))],
    ['Horário', escapeHtml(r.horario ? String(r.horario).slice(0, 5) : '-')],
    ['Status', badgeStatus(r.status)],
    ['Projeto', r.projeto_nome ? escapeHtml(r.projeto_nome) : '-'],
    ['Módulo', r.modulo_nome ? escapeHtml(r.modulo_nome) : '-'],
    ['Ideia', r.ideia_titulo ? escapeHtml(r.ideia_titulo) : '-'],
    ['Criado por', escapeHtml(r.criado_por_nome || '-')],
    ['Assunto', `<span style="white-space:pre-wrap">${escapeHtml(r.assunto)}</span>`]
  ];

  if (r.relato) {
    linhas.push(['Relato', `<span style="white-space:pre-wrap">${escapeHtml(r.relato)}</span>`]);
  }

  document.getElementById('detalheConteudo').innerHTML = linhas
    .map(([label, valor]) => `
      <div class="meta-item">
        <span>${escapeHtml(label)}</span>
        <strong>${valor}</strong>
      </div>`)
    .join('');

  const painel = document.getElementById('reuniaoDetalhe');
  painel.classList.remove('hidden');
  painel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
