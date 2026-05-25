document.addEventListener('DOMContentLoaded', async () => {
  try {
    await iniciarPagina('/historico.html');

    if (usuarioLogado.perfil !== 'DESENVOLVEDOR') {
      mostrarMensagem('historicoMensagem', 'Acesso permitido apenas para desenvolvedores.', 'error');
      return;
    }

    document.getElementById('filtrosHistorico').addEventListener('submit', async (event) => {
      event.preventDefault();
      await carregarHistorico();
    });

    await carregarHistorico();
  } catch (err) {
    mostrarMensagem('historicoMensagem', err.message, 'error');
  }
});

async function carregarHistorico() {
  limparMensagem('historicoMensagem');
  const filtros = new URLSearchParams(new FormData(document.getElementById('filtrosHistorico')));

  for (const [chave, valor] of [...filtros.entries()]) {
    if (!valor) filtros.delete(chave);
  }

  const response = await apiFetch(`/api/historico?${filtros.toString()}`);
  renderizarHistoricoTabela(response.data);
}

function renderizarHistoricoTabela(registros) {
  const tbody = document.getElementById('historicoTabela');

  if (!registros.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum histórico encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = registros.map((item) => `
    <tr>
      <td>${formatarDataHora(item.criado_em)}</td>
      <td>${escapeHtml(item.usuario_nome || '-')}</td>
      <td>${escapeHtml(item.entidade)} #${item.entidade_id || '-'}</td>
      <td>${escapeHtml(item.acao)}</td>
      <td>
        ${escapeHtml(item.campo_alterado || '-')}
        ${item.campo_alterado ? `<div class="muted">${escapeHtml(item.valor_antigo || '-')} → ${escapeHtml(item.valor_novo || '-')}</div>` : ''}
      </td>
      <td>${escapeHtml(item.descricao || '')}</td>
    </tr>
  `).join('');
}
