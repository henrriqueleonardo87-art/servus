import { isSupabaseConfigured } from './supabase.js';
import * as api from './api.js';

// Estado global em memória da sessão atual (sempre hidratado pelo Supabase)
let people = [];
let activities = [];
let scales = [];
let selectedVolunteerId = null;
let month = new Date();
month.setDate(1);
let scaleTab = 'all';
let currentUser = null;

// Configuração do WhatsApp do responsável (Welson)
const WELSON_PHONE = '5531975284359';

export function getWelsonWhatsappUrl(userName, activity, scaleTitle, scaleDate, scaleTime, reason = '') {
  let message = `Olá Welson! Aqui é *${userName}* da equipe SERVUS (AD Bethânia).\n\n` +
    `Preciso cancelar minha participação na seguinte escala:\n` +
    `• *Atividade:* ${activity}\n` +
    `• *Programação:* ${scaleTitle}\n` +
    `• *Data/Horário:* ${scaleDate} às ${scaleTime}\n`;

  if (reason) {
    message += `• *Motivo:* ${reason}\n`;
  }

  message += `\nEstou avisando para que possamos organizar a troca/substituição. Deus abençoe!`;

  return `https://wa.me/${WELSON_PHONE}?text=${encodeURIComponent(message)}`;
}

// ==========================================
// UTILITÁRIOS
// ==========================================
function initials(n) {
  if (!n) return '';
  return n.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase();
}

function fmt(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function localISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function findPerson(id) {
  return people.find(p => String(p.id) === String(id));
}

function notify(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
}

function updateProfileUI() {
  if (!currentUser) return;
  const userInitials = initials(currentUser.name);

  const sideAvatar = document.getElementById('userAvatarSide');
  const sideName = document.getElementById('userNameSide');
  const sideRole = document.getElementById('userRoleSide');

  const topAvatar = document.getElementById('userAvatarTop');
  const topName = document.getElementById('userNameTop');
  const topRole = document.getElementById('userRoleTop');

  if (sideAvatar) sideAvatar.textContent = userInitials;
  if (sideName) sideName.textContent = currentUser.name;
  if (sideRole) sideRole.textContent = currentUser.role || 'Coordenação';

  if (topAvatar) topAvatar.textContent = userInitials;
  if (topName) topName.textContent = currentUser.name;
  if (topRole) topRole.textContent = currentUser.role || 'Coordenação';
}

// ==========================================
// MODAL CONTROLLER
// ==========================================
function openModal(title, bodyHtml, saveText, onSave) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalFoot').innerHTML = `
    <button class="btn secondary" type="button" id="modalBtnCancel">Cancelar</button>
    <button class="btn primary" type="button" id="modalSave">${saveText}</button>
  `;
  document.getElementById('modalBtnCancel').onclick = closeModal;
  document.getElementById('modalSave').onclick = onSave;
  document.getElementById('modalback').classList.add('show');
}

function closeModal() {
  document.getElementById('modalback').classList.remove('show');
}

// ==========================================
// NAVEGAÇÃO ENTRE PÁGINAS
// ==========================================
export function navigate(pageId) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const targetPage = document.getElementById('page-' + pageId);
  if (targetPage) targetPage.classList.add('active');

  document.querySelectorAll('.nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageId);
  });

  const titles = {
    home: 'Visão geral',
    scales: 'Escalas',
    calendar: 'Agenda',
    mine: 'Minha escala',
    people: 'Equipe',
    activities: 'Atividades'
  };
  document.getElementById('crumb').textContent = titles[pageId] || 'Workspace';
  document.getElementById('sidebar').classList.remove('open');

  renderCurrentPage(pageId);
}

function renderCurrentPage(pageId) {
  if (pageId === 'home') renderHome();
  else if (pageId === 'scales') renderScales();
  else if (pageId === 'calendar') renderCalendar();
  else if (pageId === 'mine') renderMine();
  else if (pageId === 'people') renderPeople();
  else if (pageId === 'activities') renderActivities();
}

function renderAll() {
  renderHome();
  renderScales();
  renderPeople();
  renderActivities();
  renderCalendar();
  renderMine();
}

// ==========================================
// CARGA DE DADOS DO SUPABASE (Zero Cache / Zero LocalStorage)
// ==========================================
async function loadDataFromSupabase() {
  if (!isSupabaseConfigured) {
    return;
  }

  try {
    const [fetchedPeople, fetchedActivities, fetchedScales] = await Promise.all([
      api.getPeople(),
      api.getActivities(),
      api.getScales()
    ]);

    people = fetchedPeople;
    activities = fetchedActivities;
    scales = fetchedScales;

    // Se o usuário logado tiver uma pessoa vinculada, seleciona ela por padrão
    if (currentUser) {
      const match = people.find(p => {
        if (currentUser.personId && String(p.id) === String(currentUser.personId)) return true;
        if (currentUser.name && p.name.toLowerCase() === currentUser.name.toLowerCase()) return true;
        return false;
      });
      if (match) {
        selectedVolunteerId = match.id;
        currentUser.personId = match.id;
      }
    }

    if (!selectedVolunteerId && people.length > 0) {
      selectedVolunteerId = people[0].id;
    }

    renderAll();
    checkBirthdayNotifications();
    checkUserScaleAlerts();
  } catch (err) {
    console.error('Erro ao buscar dados do Supabase:', err);
    notify('Erro ao sincronizar com Supabase: ' + err.message);
  }
}

// ==========================================
// RENDERIZAÇÃO: PÁGINA 1 - HOME
// ==========================================
function renderHome() {
  const now = new Date();
  const today = localISO(now);
  const todayScales = scales
    .filter(s => s.date === today)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const todayLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const homeDateEl = document.getElementById('homeDate');
  if (homeDateEl) {
    homeDateEl.textContent = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1);
  }

  // Roster do Dia
  const rosterEl = document.getElementById('todayRoster');
  if (rosterEl) {
    rosterEl.innerHTML = `
      <div class="today-roster">
        <div class="today-roster-head">
          <b>Hoje na equipe</b>
          <span class="muted small">${todayLabel}</span>
        </div>
        ${todayScales.length ? todayScales.map(s => `
          <div class="today-roster-event">
            <div class="today-roster-title">
              <strong>${s.title}</strong>
              <small>${s.time || 'Horário não definido'} · ${s.place || 'Local a definir'}</small>
            </div>
            <div class="today-roster-people">
              ${s.assignments.map(a => {
                const p = findPerson(a.person);
                return p ? `<span class="today-person"><b>${p.name}</b> · ${a.activity}</span>` : `<span class="today-person">${a.activity}</span>`;
              }).join('') || '<span class="muted small">Equipe ainda não definida</span>'}
            </div>
          </div>
        `).join('') : '<div class="today-roster-empty">Nenhuma programação para hoje. Sua equipe está sem escala neste dia.</div>'}
      </div>
    `;
  }

  // Próximas programações
  const upcomingEl = document.getElementById('upcoming');
  if (upcomingEl) {
    const upcomingList = [...scales]
      .filter(s => s.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
      .slice(0, 4);

    upcomingEl.innerHTML = upcomingList.length ? upcomingList.map(s => `
      <div class="service">
        <div class="serviceicon">▣</div>
        <div class="serviceinfo">
          <b>${s.title}</b>
          <small>${fmt(s.date)} · ${s.time} · ${s.assignments.length} pessoas</small>
        </div>
        <span class="pill purple">${s.type}</span>
      </div>
    `).join('') : '<div class="empty">Nenhuma programação futura cadastrada.</div>';
  }

  // Semana atual
  const weekEl = document.getElementById('week');
  if (weekEl) {
    const daysName = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

    weekEl.innerHTML = daysName.map((name, i) => {
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + i);
      const iso = localISO(dt);
      const hasScale = scales.some(s => s.date === iso);
      return `
        <div class="day ${iso === today ? 'today' : ''}">
          <b>${name}</b>
          <strong>${dt.getDate()}</strong>
          ${hasScale ? '<i class="eventdot"></i>' : ''}
        </div>
      `;
    }).join('');
  }

  // Estatísticas
  document.getElementById('statPeople').textContent = people.length;
  document.getElementById('statScales').textContent = scales.length;
  document.getElementById('statActivities').textContent = activities.length;
  document.getElementById('navScales').textContent = scales.length;

  // Confirmações
  const totalAssignments = scales.reduce((acc, s) => acc + s.assignments.length, 0);
  const confirmedAssignments = scales.reduce((acc, s) => acc + s.assignments.filter(a => a.confirmed).length, 0);
  const percent = totalAssignments > 0 ? Math.round((confirmedAssignments / totalAssignments) * 100) : 0;
  document.getElementById('statConfirmations').textContent = totalAssignments > 0 ? percent + '%' : '—';
  document.getElementById('pendingCount').textContent = Math.max(0, totalAssignments - confirmedAssignments);

  // Alerta de escalas para o usuário logado
  checkUserScaleAlerts();
}

function checkUserScaleAlerts() {
  const banner = document.getElementById('homeScaleAlert');
  const bellDot = document.getElementById('bellDot');
  if (!banner && !bellDot) return;

  const today = localISO(new Date());
  const userPersonId = currentUser?.personId;

  const myPending = [];
  scales.forEach(s => {
    if (s.date >= today) {
      s.assignments.forEach(a => {
        const isUser = (userPersonId && String(a.person) === String(userPersonId)) ||
                       (currentUser?.name && findPerson(a.person)?.name.toLowerCase() === currentUser.name.toLowerCase());
        if (isUser && (a.status === 'pending' || (!a.confirmed && a.status !== 'cancelled'))) {
          myPending.push({ ...a, scale: s });
        }
      });
    }
  });

  if (bellDot) {
    bellDot.style.display = myPending.length > 0 ? 'inline-block' : 'none';
  }

  if (banner) {
    if (myPending.length > 0) {
      banner.style.display = 'flex';
      banner.innerHTML = `
        <div class="scale-alert-content">
          <span class="scale-alert-icon">🔔</span>
          <div class="scale-alert-text">
            <b>Você possui ${myPending.length} escala(s) aguardando sua confirmação!</b>
            <small>Confirme sua presença ou solicite cancelamento/troca com antecedência.</small>
          </div>
        </div>
        <button class="btn primary" id="btnAlertGoMine" style="padding:8px 16px;font-size:12px;white-space:nowrap">Minha Escala →</button>
      `;
      const btnGo = document.getElementById('btnAlertGoMine');
      if (btnGo) {
        btnGo.onclick = () => {
          if (currentUser?.personId) {
            selectedVolunteerId = currentUser.personId;
          }
          navigate('mine');
        };
      }
    } else {
      banner.style.display = 'none';
    }
  }
}

function openNotificationsModal() {
  const today = localISO(new Date());
  const userPersonId = currentUser?.personId;

  const myUpcoming = [];
  scales.forEach(s => {
    if (s.date >= today) {
      s.assignments.forEach(a => {
        const isUser = (userPersonId && String(a.person) === String(userPersonId)) ||
                       (currentUser?.name && findPerson(a.person)?.name.toLowerCase() === currentUser.name.toLowerCase());
        if (isUser) {
          myUpcoming.push({ ...a, scale: s });
        }
      });
    }
  });

  let html = '';
  if (myUpcoming.length > 0) {
    html += `<h3 style="margin:0 0 12px;font-size:14px;color:var(--text)">Suas Escalas Programadas</h3><div class="notif-list" style="display:flex;flex-direction:column;gap:10px">`;
    html += myUpcoming.map(item => {
      const isCancelled = item.status === 'cancelled';
      const isConfirmed = item.status === 'confirmed' || (item.confirmed && !isCancelled);
      return `
        <div style="background:#f9f9fb;border:1px solid #e9ebef;border-radius:10px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div>
            <b>${item.activity}</b> · ${item.scale.title}
            <div class="muted small">${fmt(item.scale.date)} às ${item.scale.time}</div>
          </div>
          <div>
            ${isConfirmed ? '<span class="pill confirmed">✓ Confirmada</span>' : isCancelled ? '<span class="pill cancelled">✕ Cancelada</span>' : '<span class="pill pending">◷ Pendente</span>'}
          </div>
        </div>
      `;
    }).join('');
    html += `</div>`;
  } else {
    html += `<p class="muted">Você não possui escalas pendentes no momento.</p>`;
  }

  openModal('Notificações e Escalas', html, 'Ir para Minha Escala', () => {
    closeModal();
    if (currentUser?.personId) {
      selectedVolunteerId = currentUser.personId;
    }
    navigate('mine');
  });
}

// ==========================================
// RENDERIZAÇÃO: PÁGINA 2 - ESCALAS
// ==========================================
function renderScales() {
  const q = (document.getElementById('scaleSearch')?.value || '').toLowerCase();
  const f = document.getElementById('scaleFilter')?.value || '';
  const today = localISO(new Date());

  const filtered = scales
    .filter(s => {
      const matchQuery = (s.title + ' ' + (s.place || '')).toLowerCase().includes(q);
      const matchType = !f || s.type === f;
      const matchTab = scaleTab === 'all' || s.date >= today;
      return matchQuery && matchType && matchTab;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));

  const tbody = document.getElementById('scaleRows');
  if (!tbody) return;

  tbody.innerHTML = filtered.length ? filtered.map(s => `
    <tr>
      <td>
        <b>${s.title}</b>
        <div class="muted small">${s.type} · ${s.place || 'Templo principal'}</div>
      </td>
      <td>
        ${fmt(s.date)}
        <div class="muted small">${s.time}</div>
      </td>
      <td>
        <div style="display:flex;flex-wrap:wrap;gap:4px;max-width:280px">
          ${s.assignments.map(a => {
            const p = findPerson(a.person);
            const pName = p ? p.name.split(' ')[0] : 'Voluntário';
            let pillClass = 'pending';
            let icon = '◷';
            if (a.status === 'confirmed' || (a.confirmed && a.status !== 'cancelled')) {
              pillClass = 'confirmed';
              icon = '✓';
            } else if (a.status === 'cancelled') {
              pillClass = 'cancelled';
              icon = '✕';
            }
            return `<span class="pill ${pillClass}" style="font-size:10px;padding:2px 6px" title="${p ? p.name : ''} - ${a.activity} (${a.status || 'pendente'})">${icon} ${pName} (${a.activity})</span>`;
          }).join('') || '<span class="muted small">Sem equipe</span>'}
        </div>
      </td>
      <td>
        <span class="pill ${s.assignments.length ? '' : 'pending'}">
          ${s.assignments.length ? `${s.assignments.length} escalado(s)` : 'Sem equipe'}
        </span>
      </td>
      <td>
        <div class="actions">
          <button class="mini btn-edit-scale" data-id="${s.id}">Editar</button>
          <button class="mini btn-delete-scale" data-id="${s.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="5"><div class="empty">Nenhuma programação encontrada.</div></td></tr>';

  tbody.querySelectorAll('.btn-edit-scale').forEach(b => {
    b.onclick = () => openScaleModal(Number(b.dataset.id));
  });
  tbody.querySelectorAll('.btn-delete-scale').forEach(b => {
    b.onclick = () => deleteScaleAction(Number(b.dataset.id));
  });
}

// ==========================================
// RENDERIZAÇÃO: PÁGINA 3 - AGENDA (CALENDÁRIO)
// ==========================================
function renderCalendar() {
  const y = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(y, m, 1);
  const start = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();

  document.getElementById('monthLabel').textContent = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const headers = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(x => `<div class="calhead">${x}</div>`).join('');
  let cells = '';

  for (let i = 0; i < 42; i++) {
    const n = i - start + 1;
    const isDim = n < 1 || n > daysInMonth;
    const dayNum = n < 1 ? prevDays + n : n > daysInMonth ? n - daysInMonth : n;
    const cellMonth = m + 1 + (n > daysInMonth ? 1 : n < 1 ? -1 : 0);
    const dateStr = `${y}-${String(cellMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const dayScales = scales.filter(s => s.date === dateStr);
    const isToday = dateStr === localISO(new Date());

    cells += `
      <div class="calcell ${isDim ? 'dim' : ''} ${isToday ? 'today' : ''}">
        <span class="date">${dayNum}</span>
        ${dayScales.map((s, j) => {
          const names = s.assignments.map(a => findPerson(a.person)?.name).filter(Boolean);
          const roles = s.assignments.map(a => {
            const who = findPerson(a.person);
            return who ? `${a.activity}: ${who.name}` : a.activity;
          }).filter(Boolean);
          const preview = roles.slice(0, 3).map(x => `<span>${x}</span>`).join('<br>');
          const extra = roles.length > 3 ? `<span class="cal-more">+${roles.length - 3} pessoa(s)</span>` : '';
          const colorClass = j % 3 === 1 ? 'green' : j % 3 === 2 ? 'gold' : '';

          return `
            <div class="cal-event ${colorClass}" title="${s.title} — ${names.join(', ')}" data-scale-id="${s.id}">
              <b>${s.time} · ${s.title}</b>
              <span class="cal-assignees">${preview || 'Sem pessoas escaladas'}</span>
              ${extra}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  const gridEl = document.getElementById('calendarGrid');
  gridEl.innerHTML = headers + cells;

  gridEl.querySelectorAll('.cal-event').forEach(el => {
    el.onclick = () => openScaleModal(Number(el.dataset.scaleId));
  });
}

function changeMonth(delta) {
  month = new Date(month.getFullYear(), month.getMonth() + delta, 1);
  renderCalendar();
}

// ==========================================
// RENDERIZAÇÃO: PÁGINA 4 - MINHA ESCALA
// ==========================================
function renderMine() {
  const selectEl = document.getElementById('mineVolunteerSelect');
  if (selectEl) {
    selectEl.innerHTML = people.map(p => `
      <option value="${p.id}" ${String(p.id) === String(selectedVolunteerId) ? 'selected' : ''}>
        ${p.name}
      </option>
    `).join('');
    selectEl.onchange = (e) => {
      selectedVolunteerId = Number(e.target.value);
      renderMine();
    };
  }

  const currentPerson = findPerson(selectedVolunteerId);
  const heroNameEl = document.getElementById('mineVolunteerName');
  if (heroNameEl) {
    heroNameEl.textContent = currentPerson ? currentPerson.name : 'voluntário(a)';
  }

  const container = document.getElementById('myAssignments');
  if (!container) return;

  const myAssignments = [];
  scales.forEach(s => {
    s.assignments.forEach(a => {
      if (String(a.person) === String(selectedVolunteerId)) {
        myAssignments.push({ ...a, scale: s });
      }
    });
  });

  myAssignments.sort((a, b) => a.scale.date.localeCompare(b.scale.date) || (a.scale.time || '').localeCompare(b.scale.time || ''));

  container.innerHTML = myAssignments.length ? myAssignments.map(item => {
    const act = activities.find(x => x.name === item.activity);
    const icon = act?.icon || '✳';
    const isCancelled = item.status === 'cancelled';
    const isConfirmed = item.status === 'confirmed' || (item.confirmed && !isCancelled);

    const personName = currentPerson ? currentPerson.name : (currentUser ? currentUser.name : 'Voluntário');
    const waUrl = getWelsonWhatsappUrl(personName, item.activity, item.scale.title, fmt(item.scale.date), item.scale.time, item.cancellationReason);

    let actionsHtml = '';
    if (isConfirmed) {
      actionsHtml = `
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          <span class="pill confirmed">✓ Confirmado</span>
          <button class="btn-danger-mini btn-cancel-mine" data-assignment-id="${item.id}" data-activity="${item.activity}" data-scale-title="${item.scale.title}" data-scale-date="${fmt(item.scale.date)}" data-scale-time="${item.scale.time}">Cancelar Escala</button>
        </div>
      `;
    } else if (isCancelled) {
      actionsHtml = `
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          <span class="pill cancelled">✕ Cancelado</span>
          <button class="mini btn-reopen-mine" data-assignment-id="${item.id}">Reverter Presença</button>
          <a href="${waUrl}" target="_blank" class="btn-whatsapp">WhatsApp Welson ↗</a>
        </div>
      `;
    } else {
      actionsHtml = `
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          <span class="pill pending">◷ Pendente</span>
          <button class="mini btn-confirm-mine" data-assignment-id="${item.id}" style="background:#249b72;color:#fff;font-weight:600">✓ Confirmar</button>
          <button class="btn-danger-mini btn-cancel-mine" data-assignment-id="${item.id}" data-activity="${item.activity}" data-scale-title="${item.scale.title}" data-scale-date="${fmt(item.scale.date)}" data-scale-time="${item.scale.time}">✕ Cancelar</button>
        </div>
      `;
    }

    return `
      <div class="listrow" style="flex-wrap:wrap;gap:12px;padding:14px 12px;border-bottom:1px solid #f0f1f5">
        <div class="serviceicon">${icon}</div>
        <div class="grow" style="min-width:180px">
          <b style="font-size:14px">${item.activity}</b>
          <div class="muted small">${item.scale.title} · ${item.scale.place || 'Templo principal'}</div>
          ${item.cancellationReason ? `<div style="font-size:11px;color:#dc2626;margin-top:3px">Motivo do cancelamento: ${item.cancellationReason}</div>` : ''}
        </div>
        <div style="text-align:right;min-width:110px">
          <b>${fmt(item.scale.date)}</b>
          <div class="muted small">${item.scale.time}</div>
        </div>
        <div style="margin-left:auto">
          ${actionsHtml}
        </div>
      </div>
    `;
  }).join('') : `
    <div class="empty">
      Você ainda não possui atividades atribuídas.
      <b>Quando a coordenação publicar sua escala, ela aparecerá aqui.</b>
    </div>
  `;

  // Listener para confirmar presença
  container.querySelectorAll('.btn-confirm-mine').forEach(b => {
    b.onclick = async () => {
      const aId = Number(b.dataset.assignmentId);
      try {
        await api.confirmAssignment(aId);
        notify('Presença confirmada com sucesso!');
        await loadDataFromSupabase();
      } catch (err) {
        notify('Erro ao confirmar: ' + err.message);
      }
    };
  });

  // Listener para reverter presença
  container.querySelectorAll('.btn-reopen-mine').forEach(b => {
    b.onclick = async () => {
      const aId = Number(b.dataset.assignmentId);
      try {
        await api.reopenAssignment(aId);
        notify('Presença reativada com sucesso!');
        await loadDataFromSupabase();
      } catch (err) {
        notify('Erro ao reativar: ' + err.message);
      }
    };
  });

  // Listener para cancelar escala e abrir WhatsApp do Welson
  container.querySelectorAll('.btn-cancel-mine').forEach(b => {
    b.onclick = () => {
      const aId = Number(b.dataset.assignmentId);
      const activity = b.dataset.activity;
      const title = b.dataset.scaleTitle;
      const date = b.dataset.scaleDate;
      const time = b.dataset.scaleTime;
      const personName = currentPerson ? currentPerson.name : (currentUser ? currentUser.name : 'Voluntário');

      openModal(
        'Cancelar Escala',
        `
        <p>Você tem certeza que deseja cancelar sua presença em <b>${activity}</b> no <b>${title}</b> (${date} às ${time})?</p>
        <p style="margin-top:12px;color:var(--muted);font-size:13px">
          Ao confirmar o cancelamento, seu status será atualizado e você será encaminhado diretamente para o <b>WhatsApp do Welson</b> para comunicar a coordenação e solicitar a troca.
        </p>
        <div class="field" style="margin-top:16px">
          <label for="modalCancelReason">Motivo da ausência (opcional):</label>
          <input type="text" id="modalCancelReason" class="search" placeholder="Ex: Imprevisto de trabalho, viagem..." style="width:100%">
        </div>
        `,
        'Confirmar Cancelamento e Abrir WhatsApp',
        async () => {
          const reason = document.getElementById('modalCancelReason')?.value.trim() || '';
          try {
            await api.cancelAssignment(aId, reason);
            closeModal();
            const waUrl = getWelsonWhatsappUrl(personName, activity, title, date, time, reason);
            window.open(waUrl, '_blank');
            notify('Escala cancelada. Encaminhando para o WhatsApp do Welson...');
            await loadDataFromSupabase();
          } catch (err) {
            notify('Erro ao cancelar: ' + err.message);
          }
        }
      );
    };
  });
}

// ==========================================
// RENDERIZAÇÃO: PÁGINA 5 - EQUIPE
// ==========================================
function renderPeople() {
  const q = (document.getElementById('peopleSearch')?.value || '').toLowerCase();
  const filtered = people.filter(p => {
    const skillsText = (p.skills || []).join(' ');
    return (p.name + ' ' + (p.area || '') + ' ' + skillsText).toLowerCase().includes(q);
  });

  document.getElementById('peopleCount').textContent = filtered.length + ' pessoas';

  const tbody = document.getElementById('peopleRows');
  if (!tbody) return;

  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td>
        <div class="person">
          <div class="avatar">${p.initials}</div>
          <b>${p.name}</b>
        </div>
      </td>
      <td>${p.phone || '—'}</td>
      <td>
        ${(p.skills || (p.area ? [p.area] : [])).map(s => `
          <span class="pill purple" style="display:inline-block;margin:2px">${s}</span>
        `).join('') || '<span class="muted">Não informado</span>'}
      </td>
      <td>
        <span class="pill ${p.availability === 'Disponível' ? '' : 'pending'}">${p.availability}</span>
        ${p.unavailableFrom ? `
          <div class="muted small">Ausente: ${fmt(p.unavailableFrom)}${p.unavailableTo && p.unavailableTo !== p.unavailableFrom ? ' a ' + fmt(p.unavailableTo) : ''}</div>
        ` : ''}
      </td>
      <td>${p.birthday ? fmt(p.birthday) : '—'}</td>
      <td>
        <div class="actions">
          <button class="mini btn-edit-person" data-id="${p.id}">Editar</button>
          <button class="mini btn-delete-person" data-id="${p.id}">✕</button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-edit-person').forEach(b => {
    b.onclick = () => openPersonModal(Number(b.dataset.id));
  });
  tbody.querySelectorAll('.btn-delete-person').forEach(b => {
    b.onclick = () => deletePersonAction(Number(b.dataset.id));
  });

  // Lista de Próximos Aniversários
  renderBirthdays();
}

function renderBirthdays() {
  const box = document.getElementById('birthdayList');
  if (!box) return;

  const now = new Date();
  const todayVal = now.getMonth() * 100 + now.getDate();

  const births = people
    .filter(p => p.birthday)
    .map(p => {
      const d = new Date(p.birthday + 'T12:00:00');
      const key = d.getMonth() * 100 + d.getDate();
      let delta = key - todayVal;
      if (delta < 0) delta += 1232;
      return { p, delta, date: d };
    })
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 6);

  box.innerHTML = births.length ? births.map(({ p, delta, date }) => `
    <div class="listrow">
      <div class="serviceicon">🎂</div>
      <div class="grow">
        <b>${p.name}</b>
        <small>${date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} · ${p.area || 'Voluntário'}</small>
      </div>
      <span class="pill ${delta === 0 ? '' : 'purple'}">
        ${delta === 0 ? 'É hoje!' : delta === 1 ? 'Amanhã' : `Em ${delta} dias`}
      </span>
      ${delta <= 7 ? `
        <button class="mini btn-warn-bday" data-name="${p.name}" data-delta="${delta}">Avisar</button>
      ` : ''}
    </div>
  `).join('') : '<div class="empty">Cadastre a data de aniversário nos perfis para ver os próximos lembretes.</div>';

  box.querySelectorAll('.btn-warn-bday').forEach(b => {
    b.onclick = () => {
      const d = Number(b.dataset.delta);
      const text = `Lembrete: aniversário de ${b.dataset.name} ${d === 0 ? 'hoje' : d === 1 ? 'amanhã' : 'em ' + d + ' dias'}!`;
      notify(text);
    };
  });
}

// ==========================================
// RENDERIZAÇÃO: PÁGINA 6 - ATIVIDADES
// ==========================================
function renderActivities() {
  const cardsEl = document.getElementById('activityCards');
  if (cardsEl) {
    const futureAssignments = scales.reduce((n, s) => n + s.assignments.length, 0);
    cardsEl.innerHTML = `
      <div class="stat">
        <div class="stathead">Atividades cadastradas</div>
        <div class="statnum">${activities.length}</div>
        <div class="trend">Frentes de serviço</div>
      </div>
      <div class="stat">
        <div class="stathead">Pessoas na equipe</div>
        <div class="statnum">${people.length}</div>
        <div class="trend">Voluntários cadastrados</div>
      </div>
      <div class="stat">
        <div class="stathead">Atribuições futuras</div>
        <div class="statnum">${futureAssignments}</div>
        <div class="trend">Em todas as escalas</div>
      </div>
      <div class="stat">
        <div class="stathead">Programações</div>
        <div class="statnum">${scales.length}</div>
        <div class="trend">Criadas no sistema</div>
      </div>
    `;
  }

  const listEl = document.getElementById('activityList');
  if (listEl) {
    listEl.innerHTML = activities.map(a => {
      const count = scales.reduce((acc, s) => acc + s.assignments.filter(x => x.activity === a.name).length, 0);
      return `
        <div class="listrow">
          <div class="serviceicon">${a.icon}</div>
          <div class="grow">
            <b>${a.name}</b>
            <small>${a.desc || 'Atividade da equipe de mídia'}</small>
          </div>
          <span class="pill purple">${count} atribuições</span>
          <button class="mini btn-edit-activity" data-id="${a.id}">Editar</button>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.btn-edit-activity').forEach(b => {
      b.onclick = () => openActivityModal(Number(b.dataset.id));
    });
  }
}

// ==========================================
// MODAL: PESSOA (CRIAR / EDITAR)
// ==========================================
function openPersonModal(id = null) {
  const p = people.find(x => x.id === id) || {};
  const isEditing = Boolean(id);

  const skillsHtml = activities.map(a => `
    <label style="display:flex;align-items:center;gap:8px;background:var(--surface2);padding:10px;border-radius:9px;font-size:12px;font-weight:500;color:var(--text)">
      <input type="checkbox" class="skillcheck" value="${a.name}" ${(p.skills || (p.area ? [p.area] : [])).includes(a.name) ? 'checked' : ''} style="accent-color:var(--accent)">
      ${a.icon} ${a.name}
    </label>
  `).join('');

  const bodyHtml = `
    <div class="formgrid">
      <div class="field full">
        <label>Nome completo</label>
        <input id="pname" value="${p.name || ''}" placeholder="Ex.: Maria Oliveira">
      </div>
      <div class="field">
        <label>Telefone</label>
        <input id="pphone" value="${p.phone || ''}" placeholder="(00) 00000-0000">
      </div>
      <div class="field full">
        <label>O que essa pessoa faz?</label>
        <div class="muted small">Selecione todas as atividades que ela sabe realizar.</div>
        <div id="personSkills" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:4px">
          ${skillsHtml}
        </div>
        <div class="muted small" style="margin-top:4px">Para adicionar outra função, cadastre-a primeiro em Atividades.</div>
      </div>
      <div class="field">
        <label>Aniversário</label>
        <input type="date" id="pbirthday" value="${p.birthday || ''}">
      </div>
      <div class="field">
        <label>Disponibilidade geral</label>
        <select id="pavail">
          <option ${p.availability === 'Disponível' || !p.availability ? 'selected' : ''}>Disponível</option>
          <option ${p.availability === 'Indisponível' ? 'selected' : ''}>Indisponível</option>
        </select>
      </div>
      <div class="field full">
        <label>Indisponibilidade — início</label>
        <input type="date" id="pfrom" value="${p.unavailableFrom || ''}">
      </div>
      <div class="field full">
        <label>Indisponibilidade — fim</label>
        <input type="date" id="pto" value="${p.unavailableTo || ''}">
      </div>
      <div class="field full">
        <label>Motivo / observação (opcional)</label>
        <input id="preason" value="${p.unavailableReason || ''}" placeholder="Ex.: viagem, compromisso pessoal...">
      </div>
    </div>
    <div class="muted small" style="margin-top:4px">Para indisponibilidade de apenas um dia, informe a mesma data no início e no fim.</div>
  `;

  openModal(
    isEditing ? 'Editar pessoa' : 'Adicionar pessoa',
    bodyHtml,
    isEditing ? 'Salvar alterações' : 'Cadastrar pessoa',
    async () => {
      const name = document.getElementById('pname').value.trim();
      if (!name) return notify('Informe o nome da pessoa.');

      const from = document.getElementById('pfrom').value;
      const to = document.getElementById('pto').value;
      if (from && to && to < from) return notify('A data final não pode ser anterior à inicial.');

      const selectedSkills = [...document.querySelectorAll('.skillcheck:checked')].map(x => x.value);

      const personData = {
        name,
        phone: document.getElementById('pphone').value.trim(),
        skills: selectedSkills,
        area: selectedSkills.join(', '),
        initials: initials(name),
        availability: document.getElementById('pavail').value,
        birthday: document.getElementById('pbirthday').value || null,
        unavailableFrom: from || null,
        unavailableTo: to || null,
        unavailableReason: document.getElementById('preason').value.trim() || null
      };

      try {
        if (isEditing) {
          await api.updatePerson(id, personData);
        } else {
          await api.createPerson(personData);
        }
        closeModal();
        notify('Pessoa salva com sucesso no Supabase!');
        await loadDataFromSupabase();
      } catch (err) {
        notify('Erro ao salvar no Supabase: ' + err.message);
      }
    }
  );
}

async function deletePersonAction(id) {
  if (!confirm('Remover esta pessoa da equipe?')) return;
  try {
    await api.deletePerson(id);
    notify('Pessoa removida do Supabase.');
    await loadDataFromSupabase();
  } catch (err) {
    notify('Erro ao remover: ' + err.message);
  }
}

// ==========================================
// MODAL: ATIVIDADE (CRIAR / EDITAR)
// ==========================================
function openActivityModal(id = null) {
  const a = activities.find(x => x.id === id) || {};
  const isEditing = Boolean(id);

  const bodyHtml = `
    <div class="field">
      <label>Nome da atividade</label>
      <input id="aname" value="${a.name || ''}" placeholder="Ex.: Operação de câmera">
    </div>
    <div class="field">
      <label>Descrição</label>
      <textarea id="adesc" placeholder="Descreva brevemente essa responsabilidade">${a.desc || ''}</textarea>
    </div>
    <div class="field">
      <label>Ícone (emoji ou símbolo)</label>
      <input id="aicon" value="${a.icon || '✳'}">
    </div>
  `;

  openModal(
    isEditing ? 'Editar atividade' : 'Nova atividade',
    bodyHtml,
    isEditing ? 'Salvar alterações' : 'Adicionar atividade',
    async () => {
      const name = document.getElementById('aname').value.trim();
      if (!name) return notify('Informe o nome da atividade.');

      const actData = {
        name,
        desc: document.getElementById('adesc').value.trim(),
        icon: document.getElementById('aicon').value.trim() || '✳'
      };

      try {
        if (isEditing) {
          await api.updateActivity(id, actData);
        } else {
          await api.createActivity(actData);
        }
        closeModal();
        notify('Atividade salva com sucesso no Supabase!');
        await loadDataFromSupabase();
      } catch (err) {
        notify('Erro ao salvar atividade: ' + err.message);
      }
    }
  );
}

// ==========================================
// MODAL: ESCALA (CRIAR / EDITAR)
// ==========================================
function assignmentRow(pid = '', act = '') {
  return `
    <div class="formgrid assignment" style="padding:10px;background:var(--surface2);border-radius:10px;margin:8px 0">
      <div class="field" style="margin:0">
        <label>Voluntário</label>
        <select class="assperson">
          <option value="">Selecione</option>
          ${people.map(p => `<option value="${p.id}" ${String(p.id) === String(pid) ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
      </div>
      <div class="field" style="margin:0">
        <label>Atividade</label>
        <div style="display:flex;gap:5px">
          <select class="assactivity" style="flex:1">
            <option value="">Selecione</option>
            ${activities.map(a => `<option value="${a.name}" ${a.name === act ? 'selected' : ''}>${a.name}</option>`).join('')}
          </select>
          <button class="mini btn-remove-assign" type="button">✕</button>
        </div>
      </div>
    </div>
  `;
}

function openScaleModal(id = null) {
  const s = scales.find(x => x.id === id) || {};
  const isEditing = Boolean(id);

  const initialRows = (s.assignments || []).map(a => assignmentRow(a.person, a.activity)).join('');

  const bodyHtml = `
    <div class="formgrid">
      <div class="field full">
        <label>Nome da programação</label>
        <input id="stitle" value="${s.title || ''}" placeholder="Ex.: Culto de celebração">
      </div>
      <div class="field">
        <label>Tipo</label>
        <select id="stype">
          ${['Culto', 'Evento', 'Ensaio', 'Reunião', 'Outro'].map(t => `
            <option ${s.type === t ? 'selected' : ''}>${t}</option>
          `).join('')}
        </select>
      </div>
      <div class="field">
        <label>Local</label>
        <input id="splace" value="${s.place || 'Templo principal'}">
      </div>
      <div class="field">
        <label>Data</label>
        <input type="date" id="sdate" value="${s.date || ''}">
      </div>
      <div class="field">
        <label>Horário</label>
        <input type="time" id="stime" value="${s.time || '18:30'}">
      </div>
    </div>
    <div style="margin:18px 0 9px;display:flex;justify-content:space-between;align-items:center">
      <b>Distribuição de atividades</b>
      <span class="muted small">Atribua uma função a cada pessoa</span>
    </div>
    <div id="assignments">${initialRows}</div>
    <button class="btn secondary" type="button" id="btnAddAssignment" style="margin-top:6px">＋ Adicionar pessoa à escala</button>
  `;

  openModal(
    isEditing ? 'Editar programação' : 'Criar nova escala',
    bodyHtml,
    isEditing ? 'Salvar escala' : 'Publicar escala',
    async () => {
      const title = document.getElementById('stitle').value.trim();
      const date = document.getElementById('sdate').value;
      if (!title || !date) return notify('Preencha o nome e a data.');

      const assignments = [...document.querySelectorAll('.assignment')].map(x => ({
        person: x.querySelector('.assperson').value,
        activity: x.querySelector('.assactivity').value
      })).filter(x => x.person && x.activity);

      // Validação de indisponibilidade
      const unavailable = assignments
        .map(a => ({ a, p: findPerson(a.person) }))
        .filter(x => x.p?.unavailableFrom && date >= x.p.unavailableFrom && date <= (x.p.unavailableTo || x.p.unavailableFrom));

      if (unavailable.length) {
        return notify('Indisponibilidade cadastrada: ' + unavailable.map(x => x.p.name).join(', ') + '. Ajuste a equipe ou as datas.');
      }

      const scaleData = {
        title,
        type: document.getElementById('stype').value,
        place: document.getElementById('splace').value.trim() || 'Templo principal',
        date,
        time: document.getElementById('stime').value || '18:30'
      };

      try {
        if (isEditing) {
          await api.updateScale(id, scaleData, assignments);
        } else {
          await api.createScale(scaleData, assignments);
        }
        closeModal();
        notify('Escala gravada no Supabase com sucesso!');
        await loadDataFromSupabase();
      } catch (err) {
        notify('Erro ao salvar escala: ' + err.message);
      }
    }
  );

  // Botão para adicionar mais atribuições
  document.getElementById('btnAddAssignment').onclick = () => {
    const list = document.getElementById('assignments');
    list.insertAdjacentHTML('beforeend', assignmentRow());
    attachRemoveAssignListeners();
  };

  attachRemoveAssignListeners();
}

function attachRemoveAssignListeners() {
  document.querySelectorAll('.btn-remove-assign').forEach(btn => {
    btn.onclick = () => btn.closest('.assignment').remove();
  });
}

async function deleteScaleAction(id) {
  if (!confirm('Excluir esta programação?')) return;
  try {
    await api.deleteScale(id);
    notify('Programação excluída do Supabase.');
    await loadDataFromSupabase();
  } catch (err) {
    notify('Erro ao excluir: ' + err.message);
  }
}

// ==========================================
// NOTIFICAÇÕES DE ANIVERSÁRIO
// ==========================================
async function enableBirthdayNotifications() {
  if (!('Notification' in window)) {
    notify('Este navegador não suporta notificações.');
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    notify('Notificações de aniversário ativadas!');
    checkBirthdayNotifications();
  } else {
    notify('Permissão de notificação não concedida.');
  }
}

async function checkBirthdayNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  const currentYear = now.getFullYear();
  const notifiedKeys = await api.getNotifiedKeys();

  people.filter(p => p.birthday).forEach(async p => {
    const d = new Date(p.birthday + 'T12:00:00');
    if (d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) {
      const key = `${p.id}-${currentYear}`;
      if (!notifiedKeys.includes(key)) {
        new Notification('Aniversário na equipe 🎂', {
          body: 'Hoje é aniversário de ' + p.name + '!'
        });
        await api.saveNotifiedKey(key);
      }
    }
  });
}

// ==========================================
// INICIALIZAÇÃO E EVENT LISTENERS
// ==========================================
function initAuth() {
  const loginScreen = document.getElementById('loginScreen');
  const appRoot = document.getElementById('appRoot');
  const loginForm = document.getElementById('loginForm');
  const numberInput = document.getElementById('numero');
  const passwordInput = document.getElementById('senha');
  const togglePassword = document.getElementById('togglePassword');
  const rememberCheckbox = document.getElementById('remember');
  const feedbackEl = document.getElementById('feedback');
  const helpLink = document.getElementById('helpLink');

  // Toggle visibilidade da senha
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', () => {
      const showing = passwordInput.type === 'text';
      passwordInput.type = showing ? 'password' : 'text';
      togglePassword.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
      togglePassword.title = showing ? 'Mostrar senha' : 'Ocultar senha';
    });
  }

  // Preencher número salvo se houver
  try {
    const savedNum = localStorage.getItem('servus_login_numero') || '';
    if (savedNum && numberInput) {
      numberInput.value = savedNum;
      if (rememberCheckbox) rememberCheckbox.checked = true;
    }
  } catch (e) {}

  // Ajuda
  if (helpLink) {
    helpLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (feedbackEl) {
        feedbackEl.textContent = 'Para recuperar ou solicitar seu acesso, procure a coordenação da AD Bethânia (Welson ou Leonardo).';
        feedbackEl.classList.remove('error');
        feedbackEl.classList.add('show');
      }
    });
  }

  function validateField(input, messageId) {
    const field = input.closest('.field');
    const valid = input.value.trim().length > 0;
    if (field) field.classList.toggle('invalid', !valid);
    input.setAttribute('aria-invalid', String(!valid));
    return valid;
  }

  if (numberInput) {
    numberInput.addEventListener('input', () => validateField(numberInput, 'numeroErro'));
  }
  if (passwordInput) {
    passwordInput.addEventListener('input', () => validateField(passwordInput, 'senhaErro'));
  }

  // Formulário de Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const numOk = validateField(numberInput, 'numeroErro');
      const passOk = validateField(passwordInput, 'senhaErro');
      if (!numOk || !passOk) {
        if (feedbackEl) {
          feedbackEl.textContent = 'Preencha seu número e sua senha para continuar.';
          feedbackEl.classList.add('show', 'error');
        }
        return;
      }

      const submitBtn = loginForm.querySelector('.submit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `Entrando...`;
      }

      try {
        const user = await api.loginUser(numberInput.value, passwordInput.value);
        currentUser = user;

        if (rememberCheckbox && rememberCheckbox.checked) {
          localStorage.setItem('servus_login_numero', numberInput.value.trim());
        } else {
          localStorage.removeItem('servus_login_numero');
        }

        localStorage.setItem('servus_session', JSON.stringify(user));

        if (user.personId) {
          selectedVolunteerId = user.personId;
        }

        updateProfileUI();

        loginScreen.classList.add('hidden');
        appRoot.classList.remove('hidden');

        notify(`Bem-vindo(a), ${user.name}!`);
        await loadDataFromSupabase();
        checkUserScaleAlerts();
      } catch (err) {
        if (feedbackEl) {
          feedbackEl.textContent = err.message || 'Número ou senha incorretos.';
          feedbackEl.classList.add('show', 'error');
        }
        numberInput.closest('.field')?.classList.add('invalid');
        passwordInput.closest('.field')?.classList.add('invalid');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `Entrar <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        }
      }
    });
  }

  // Logout
  const doLogout = () => {
    currentUser = null;
    localStorage.removeItem('servus_session');
    loginScreen.classList.remove('hidden');
    appRoot.classList.add('hidden');
    if (passwordInput) passwordInput.value = '';
    if (feedbackEl) feedbackEl.classList.remove('show', 'error');
    notify('Você saiu do sistema.');
  };

  const btnLogoutSide = document.getElementById('btnLogoutSide');
  const btnLogoutTop = document.getElementById('btnLogoutTop');
  if (btnLogoutSide) btnLogoutSide.onclick = doLogout;
  if (btnLogoutTop) btnLogoutTop.onclick = doLogout;

  // Restaurar sessão se já existir
  try {
    const sessionStr = localStorage.getItem('servus_session');
    if (sessionStr) {
      const savedUser = JSON.parse(sessionStr);
      if (savedUser && savedUser.name) {
        currentUser = savedUser;
        if (savedUser.personId) {
          selectedVolunteerId = savedUser.personId;
        }
        updateProfileUI();
        loginScreen.classList.add('hidden');
        appRoot.classList.remove('hidden');
        return true;
      }
    }
  } catch (e) {}

  loginScreen.classList.remove('hidden');
  appRoot.classList.add('hidden');
  return false;
}

// ==========================================
// TEMA ESCURO / CLARO
// ==========================================
function getInitialTheme() {
  const saved = localStorage.getItem('servus_theme');
  if (saved === 'dark' || saved === 'light') return saved;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('servus_theme', theme);

  const iconText = theme === 'dark' ? '☀️' : '🌙';
  const labelText = theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro';

  const btnApp = document.getElementById('btnThemeToggle');
  const btnLogin = document.getElementById('btnLoginThemeToggle');

  [btnApp, btnLogin].forEach(btn => {
    if (!btn) return;
    const iconSpan = btn.querySelector('.theme-icon');
    if (iconSpan) iconSpan.textContent = iconText;
    else btn.textContent = iconText;
    btn.title = labelText;
    btn.setAttribute('aria-label', labelText);
  });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

function initTheme() {
  const initial = getInitialTheme();
  applyTheme(initial);

  const btnApp = document.getElementById('btnThemeToggle');
  const btnLogin = document.getElementById('btnLoginThemeToggle');

  if (btnApp) btnApp.onclick = toggleTheme;
  if (btnLogin) btnLogin.onclick = toggleTheme;

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('servus_theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}

function initEvents() {
  // Inicializar Tema Escuro / Claro
  initTheme();

  // Navegação da Sidebar
  document.querySelectorAll('.nav button').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // Mobile menu toggle
  document.getElementById('btnToggleMenu').onclick = () => {
    document.getElementById('sidebar').classList.toggle('open');
  };

  // Botões do Topo (Notificações e Avisos)
  document.getElementById('btnTopBell').onclick = openNotificationsModal;

  // Atalhos na Home
  document.getElementById('btnHomeNewScale').onclick = () => openScaleModal();
  document.getElementById('btnGoToCalendar').onclick = () => navigate('calendar');
  document.getElementById('btnGoToCalendarWeek').onclick = () => navigate('calendar');
  document.getElementById('btnAttentionNewScale').onclick = () => openScaleModal();
  document.getElementById('btnAttentionPeople').onclick = () => navigate('people');

  // Filtros de Escalas
  document.getElementById('btnNewScale').onclick = () => openScaleModal();
  document.getElementById('scaleSearch').oninput = renderScales;
  document.getElementById('scaleFilter').onchange = renderScales;
  document.getElementById('tabScaleAll').onclick = function () {
    scaleTab = 'all';
    this.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    renderScales();
  };
  document.getElementById('tabScaleUpcoming').onclick = function () {
    scaleTab = 'upcoming';
    this.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    renderScales();
  };

  // Agenda
  document.getElementById('btnCalNewScale').onclick = () => openScaleModal();
  document.getElementById('btnPrevMonth').onclick = () => changeMonth(-1);
  document.getElementById('btnNextMonth').onclick = () => changeMonth(1);
  document.getElementById('btnCalMySchedule').onclick = () => navigate('mine');

  // Minha Escala
  document.getElementById('btnShareMine').onclick = () => {
    navigator.clipboard?.writeText(window.location.href);
    notify('Link pessoal copiado para a área de transferência!');
  };

  // Equipe
  document.getElementById('btnNewPerson').onclick = () => openPersonModal();
  document.getElementById('peopleSearch').oninput = renderPeople;
  document.getElementById('btnEnableBirthdayNotif').onclick = enableBirthdayNotifications;

  // Atividades
  document.getElementById('btnNewActivity').onclick = () => openActivityModal();

  // Fechar Modal
  document.getElementById('btnCloseModal').onclick = closeModal;
  document.getElementById('modalback').onclick = (e) => {
    if (e.target === document.getElementById('modalback')) closeModal();
  };

  // Iniciar Realtime Listener
  api.subscribeToRealtime(() => {
    console.log('Realtime change detectado no Supabase. Atualizando tela...');
    loadDataFromSupabase();
  });
}

// Iniciar Aplicação
initEvents();
const hasSession = initAuth();
loadDataFromSupabase();
