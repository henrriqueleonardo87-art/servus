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
let pendingUpdatesCount = 0;
let swRegistration = null;

function setPendingUpdates(count) {
  pendingUpdatesCount = Math.max(0, count);
  const badge = document.getElementById('refreshBadge');
  if (badge) {
    if (pendingUpdatesCount > 0) {
      badge.textContent = pendingUpdatesCount > 9 ? '9+' : String(pendingUpdatesCount);
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

function incrementPendingUpdates() {
  setPendingUpdates(pendingUpdatesCount + 1);
}

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

export function canManageScales() {
  if (!currentUser) return false;
  const role = (currentUser.role || '').toLowerCase();
  return role.includes('líder') || role.includes('lider') || role.includes('coordena');
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getActivityIconSvg(name = '') {
  const n = (name || '').toLowerCase();
  if (n.includes('áudio') || n.includes('audio') || n.includes('som') || n.includes('mesa')) {
    return `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  }
  if (n.includes('proje') || n.includes('slide') || n.includes('letra')) {
    return `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  }
  if (n.includes('transmiss') || n.includes('live') || n.includes('stream')) {
    return `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M4.93 19.07A10 10 0 0 1 2 12a10 10 0 0 1 2.93-7.07M19.07 4.93A10 10 0 0 1 22 12a10 10 0 0 1-2.93 7.07M7.76 16.24A6 6 0 0 1 6 12a6 6 0 0 1 1.76-4.24M16.24 7.76A6 6 0 0 1 18 12a6 6 0 0 1-1.76 4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>`;
  }
  if (n.includes('foto') || n.includes('fotografia') || n.includes('câmera') || n.includes('camera')) {
    return `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="2"/></svg>`;
  }
  if (n.includes('vídeo') || n.includes('video') || n.includes('grava')) {
    return `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><rect x="2" y="4" width="14" height="16" rx="2" stroke="currentColor" stroke-width="2"/><polygon points="22 7 16 12 22 17 22 7" fill="currentColor"/></svg>`;
  }
  if (n.includes('social') || n.includes('redes') || n.includes('instagram')) {
    return `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/></svg>`;
  }
  if (n.includes('design') || n.includes('arte') || n.includes('visual')) {
    return `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  }
  if (n.includes('direção') || n.includes('direcao') || n.includes('coord')) {
    return `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor"/></svg>`;
  }
  if (n.includes('recep') || n.includes('apoio') || n.includes('geral')) {
    return `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="7" r="4" stroke="currentColor" stroke-width="2"/><polyline points="17 11 19 13 23 9" stroke="currentColor" stroke-width="2"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
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

  const person = findPerson(currentUser.personId);
  const avatarUrl = person?.avatarUrl || '';

  if (sideAvatar) {
    if (avatarUrl) {
      sideAvatar.style.backgroundImage = `url('${avatarUrl}')`;
      sideAvatar.style.backgroundSize = 'cover';
      sideAvatar.style.backgroundPosition = 'center';
      sideAvatar.style.color = 'transparent';
      sideAvatar.textContent = '';
    } else {
      sideAvatar.style.backgroundImage = 'none';
      sideAvatar.style.color = '';
      sideAvatar.textContent = userInitials;
    }
  }
  if (sideName) sideName.textContent = currentUser.name;
  if (sideRole) sideRole.textContent = currentUser.role || 'Coordenação';

  if (topAvatar) {
    if (avatarUrl) {
      topAvatar.style.backgroundImage = `url('${avatarUrl}')`;
      topAvatar.style.backgroundSize = 'cover';
      topAvatar.style.backgroundPosition = 'center';
      topAvatar.style.color = 'transparent';
      topAvatar.textContent = '';
    } else {
      topAvatar.style.backgroundImage = 'none';
      topAvatar.style.color = '';
      topAvatar.textContent = userInitials;
    }
  }
  if (topName) topName.textContent = currentUser.name;
  if (topRole) topRole.textContent = currentUser.role || 'Coordenação';
}

function updateHomeGreeting() {
  const el = document.getElementById('homeGreeting');
  if (!el) return;
  const hour = new Date().getHours();
  let salutation = 'Boa noite';
  if (hour >= 5 && hour < 12) salutation = 'Bom dia';
  else if (hour >= 12 && hour < 18) salutation = 'Boa tarde';

  const firstName = currentUser?.name ? currentUser.name.trim().split(' ')[0] : '';
  el.textContent = firstName ? `${salutation}, ${firstName}! Vamos servir?` : `${salutation}! Vamos servir?`;
}

// ==========================================
// MODAL CONTROLLER
// ==========================================
function openModal(title, bodyHtml, saveText, onSave, isWide = false) {
  const modalBox = document.querySelector('#modalback .modal');
  if (modalBox) {
    if (isWide) modalBox.classList.add('wide');
    else modalBox.classList.remove('wide');
  }
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
  const modalBox = document.querySelector('#modalback .modal');
  if (modalBox) modalBox.classList.remove('wide');
}

// ==========================================
// NAVEGAÇÃO ENTRE PÁGINAS
// ==========================================
export function navigate(pageId) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const targetPage = document.getElementById('page-' + pageId);
  if (targetPage) targetPage.classList.add('active');

  // Atualizar navegação da Sidebar
  document.querySelectorAll('.nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageId);
  });

  // Atualizar navegação inferior mobile (Bottom Nav)
  document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
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

  // Fechar gaveta mobile e backdrop ao navegar
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarBackdrop')?.classList.remove('show');

  // Rolar suavemente ao topo no mobile ao trocar de aba
  window.scrollTo({ top: 0, behavior: 'instant' });

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
    checkScaleNotifications();
  } catch (err) {
    console.error('Erro ao buscar dados do Supabase:', err);
    notify('Erro ao sincronizar com Supabase: ' + err.message);
  }
}

// ==========================================
// RENDERIZAÇÃO: PÁGINA 1 - HOME
// ==========================================
function renderHome() {
  updateHomeGreeting();
  updateHomeNotificationBanner();
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

  // Permissão para criar escala (apenas Líder e Coordenação)
  const canManage = canManageScales();
  const btnHomeNewScale = document.getElementById('btnHomeNewScale');
  if (btnHomeNewScale) btnHomeNewScale.style.display = canManage ? '' : 'none';
  const btnAttentionNewScale = document.getElementById('btnAttentionNewScale');
  if (btnAttentionNewScale) btnAttentionNewScale.style.display = canManage ? '' : 'none';

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

function updateHomeNotificationBanner() {
  const banner = document.getElementById('homeNotifPrompt');
  if (!banner) return;

  const isSupported = 'Notification' in window;
  if (!isSupported) {
    banner.style.display = 'none';
    return;
  }

  // Se já tiver permissão concedida, não precisa exibir banner de prompt na home
  if (Notification.permission === 'granted') {
    banner.style.display = 'none';
    return;
  }

  // Se o usuário dispensou nesta sessão, não exibir
  if (sessionStorage.getItem('servus_dismiss_notif_banner')) {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = 'flex';
  banner.innerHTML = `
    <div class="notif-prompt-content">
      <div class="notif-prompt-icon">🔔</div>
      <div class="notif-prompt-text">
        <b>Ative as notificações no seu celular</b>
        <small>Receba lembretes automáticos 1 dia antes e no dia das suas escalas na AD Bethânia.</small>
      </div>
    </div>
    <div class="notif-prompt-actions">
      <button class="btn primary mini" id="btnPromptEnableNotif" style="padding:7px 12px;font-size:11px;font-weight:700">Ativar Notificações</button>
      <button class="btn secondary mini" id="btnPromptTestNotif" style="padding:7px 10px;font-size:11px">🧪 Testar</button>
      <button class="mini" id="btnPromptDismissNotif" style="background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;padding:4px" title="Dispensar por enquanto">✕</button>
    </div>
  `;

  document.getElementById('btnPromptEnableNotif').onclick = async () => {
    await enableAllNotifications();
    updateHomeNotificationBanner();
  };

  document.getElementById('btnPromptTestNotif').onclick = async () => {
    await sendTestNotification();
  };

  document.getElementById('btnPromptDismissNotif').onclick = () => {
    sessionStorage.setItem('servus_dismiss_notif_banner', 'true');
    banner.style.display = 'none';
  };
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

  const isNotifSupported = 'Notification' in window;
  const perm = isNotifSupported ? Notification.permission : 'unsupported';
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  let controlHtml = `
    <div class="notif-control-card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <b style="font-size:13px;color:var(--text)">Status das Notificações</b>
        ${perm === 'granted'
          ? '<span class="notif-status-badge granted">🟢 Ativadas no Aparelho</span>'
          : perm === 'denied'
          ? '<span class="notif-status-badge denied">🔴 Bloqueadas pelo Navegador</span>'
          : '<span class="notif-status-badge default">🟡 Pendentes de Ativação</span>'}
      </div>
      <p class="muted small" style="margin:6px 0 10px;line-height:1.4">
        ${perm === 'granted'
          ? 'Tudo pronto! Seu dispositivo receberá lembretes automáticos 1 dia antes e no dia de cada programação.'
          : perm === 'denied'
          ? 'As notificações foram bloqueadas nas configurações deste navegador. Toque no ícone de cadeado/configurações da URL para permitir.'
          : 'Ative as notificações para receber lembretes das suas escalas e avisos de substituições diretamente no seu telefone.'}
      </p>
      <div class="notif-btn-row">
        ${perm !== 'granted' ? '<button class="btn primary mini" id="btnModalEnableNotif">🔔 Ativar Notificações</button>' : ''}
        <button class="btn secondary mini" id="btnModalTestNotif">🧪 Enviar Notificação de Teste</button>
      </div>
      ${isIOS && !isStandalone ? `
        <div class="ios-notif-tip">
          <b>📱 Dica para iPhone (iOS):</b> Para receber notificações de escala no iOS, adicione o SERVUS à Tela de Início (toque em <b>Compartilhar 📤</b> no Safari > <b>"Adicionar à Tela de Início" ➕</b>) e abra o app instalado.
        </div>
      ` : ''}
    </div>
  `;

  let scalesHtml = '';
  if (myUpcoming.length > 0) {
    scalesHtml += `<h3 style="margin:16px 0 10px;font-size:13px;color:var(--text)">Suas Escalas Programadas</h3><div class="notif-list" style="display:flex;flex-direction:column;gap:10px">`;
    scalesHtml += myUpcoming.map(item => {
      const isCancelled = item.status === 'cancelled';
      const isConfirmed = item.status === 'confirmed' || (item.confirmed && !isCancelled);
      return `
        <div style="background:var(--surface2);border:1px solid var(--line);border-radius:10px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:10px">
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
    scalesHtml += `</div>`;
  } else {
    scalesHtml += `<p class="muted small" style="margin-top:12px">Você não possui escalas pendentes no momento. Quando a coordenação publicar uma escala com o seu nome, ela aparecerá aqui e você receberá uma notificação.</p>`;
  }

  openModal('Central de Notificações', controlHtml + scalesHtml, 'Ir para Minha Escala', () => {
    closeModal();
    if (currentUser?.personId) {
      selectedVolunteerId = currentUser.personId;
    }
    navigate('mine');
  });

  const btnEnable = document.getElementById('btnModalEnableNotif');
  if (btnEnable) {
    btnEnable.onclick = async () => {
      await enableAllNotifications();
      openNotificationsModal();
    };
  }

  const btnTest = document.getElementById('btnModalTestNotif');
  if (btnTest) {
    btnTest.onclick = async () => {
      await sendTestNotification();
      openNotificationsModal();
    };
  }
}

// ==========================================
// RENDERIZAÇÃO: PÁGINA 2 - ESCALAS
// ==========================================
function renderScales() {
  const btnNew = document.getElementById('btnNewScale');
  if (btnNew) btnNew.style.display = canManageScales() ? '' : 'none';
  const btnCalNew = document.getElementById('btnCalNewScale');
  if (btnCalNew) btnCalNew.style.display = canManageScales() ? '' : 'none';

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
        <b>${escapeHtml(s.title)}</b>
        <div class="muted small">${s.type} · ${s.place || 'Templo principal'}</div>
        ${s.notes ? `
          <div class="scale-notes-row">
            <span class="scale-notes-tag">Obs:</span>
            <span class="scale-notes-text">${escapeHtml(s.notes)}</span>
          </div>
        ` : ''}
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
          }).join('') || '<span class="muted small">Sem equipe</span>'}\
        </div>
      </td>
      <td>
        <span class="pill ${s.assignments.length ? '' : 'pending'}">
          ${s.assignments.length ? `${s.assignments.length} escalado(s)` : 'Sem equipe'}
        </span>
      </td>
      <td>
        ${canManageScales() ? `
          <div class="actions">
            <button class="mini btn-edit-scale" data-id="${s.id}">Editar</button>
            <button class="mini btn-delete-scale" data-id="${s.id}">Excluir</button>
          </div>
        ` : '<span class="muted small" style="font-size:11px;color:var(--muted)">Visualização</span>'}
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
    const gcalUrl = api.generateGoogleCalendarUrl(item.scale, item, currentPerson);

    const calActions = `
      <div style="display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap">
        <a href="${gcalUrl}" target="_blank" rel="noopener noreferrer" class="btn-gcal" title="Salvar no Google Agenda">
          📅 Salvar no Google Agenda
        </a>
        <button type="button" class="btn-ics btn-download-ics" data-scale-id="${item.scale.id}" data-assignment-id="${item.id}" title="Baixar arquivo .ICS para calendário do celular">
          📥 .ICS
        </button>
      </div>
    `;

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
      <div class="listrow" style="flex-wrap:wrap;gap:12px;padding:14px 12px;border-bottom:1px solid var(--line)">
        <div class="activity-icon-badge">${getActivityIconSvg(item.activity)}</div>
        <div class="grow" style="min-width:180px">
          <b style="font-size:14px">${item.activity}</b>
          <div class="muted small">${item.scale.title} · ${item.scale.place || 'Templo principal'}</div>
          ${(item.notes || item.scale.notes) ? `
            <div class="mine-scale-notes">
              <strong>Obs:</strong> ${escapeHtml(item.notes || item.scale.notes)}
            </div>
          ` : ''}
          ${item.cancellationReason ? `<div style="font-size:11px;color:#dc2626;margin-top:3px">Motivo do cancelamento: ${item.cancellationReason}</div>` : ''}
          ${calActions}
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

  // Listener para baixar arquivo .ICS
  container.querySelectorAll('.btn-download-ics').forEach(b => {
    b.onclick = () => {
      const sId = Number(b.dataset.scaleId);
      const aId = Number(b.dataset.assignmentId);
      const s = scales.find(x => x.id === sId);
      const a = s?.assignments?.find(x => x.id === aId);
      if (s) {
        api.downloadIcsFile(s, a, currentPerson);
        notify('Arquivo (.ics) de agenda baixado!');
      }
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
    const emailText = p.email || '';
    return (p.name + ' ' + (p.area || '') + ' ' + skillsText + ' ' + emailText).toLowerCase().includes(q);
  });

  const countEl = document.getElementById('peopleCount');
  if (countEl) {
    countEl.textContent = `${filtered.length} voluntário${filtered.length === 1 ? '' : 's'}`;
  }

  // 1. Renderizar tabela de desktop
  const tbody = document.getElementById('peopleRows');
  if (tbody) {
    tbody.innerHTML = filtered.map(p => `
      <tr>
        <td>
          <div class="person">
            <div class="avatar" style="${p.avatarUrl ? `background-image:url('${p.avatarUrl}');background-size:cover;background-position:center;color:transparent;` : ''}">
              ${p.avatarUrl ? '' : p.initials}
            </div>
            <div>
              <b>${p.name}</b>
              ${p.email ? `<small style="display:block;font-size:11px;color:var(--muted)">${p.email}</small>` : ''}
            </div>
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
  }

  // 2. Renderizar cards estruturados e elegantes para celular
  const mobileWrap = document.getElementById('peopleCardsMobile');
  if (mobileWrap) {
    if (!filtered.length) {
      mobileWrap.innerHTML = '<div class="empty" style="padding:24px 0;text-align:center">Nenhum voluntário encontrado.</div>';
    } else {
      mobileWrap.innerHTML = filtered.map(p => {
        const cleanPhone = (p.phone || '').replace(/\D/g, '');
        const waUrl = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent('Olá ' + p.name + '!')}` : '';
        const skillsList = p.skills || (p.area ? [p.area] : []);
        const isAvail = p.availability === 'Disponível';

        return `
          <div class="team-card">
            <div class="team-card-top">
              <div class="team-card-person">
                <div class="team-card-avatar" style="${p.avatarUrl ? `background-image:url('${p.avatarUrl}');background-size:cover;background-position:center;color:transparent;` : ''}">
                  ${p.avatarUrl ? '' : p.initials}
                </div>
                <div class="team-card-id">
                  <strong class="team-card-name">${p.name}</strong>
                  ${p.email ? `<span class="team-card-email">${p.email}</span>` : ''}
                </div>
              </div>
              <span class="team-avail-pill ${isAvail ? 'available' : 'absent'}">
                ${isAvail ? '🟢 Disponível' : '🔴 ' + p.availability}
              </span>
            </div>

            ${p.unavailableFrom ? `
              <div class="team-card-absent-notice">
                Ausente: ${fmt(p.unavailableFrom)}${p.unavailableTo && p.unavailableTo !== p.unavailableFrom ? ' a ' + fmt(p.unavailableTo) : ''}
                ${p.unavailableReason ? `· <i>${p.unavailableReason}</i>` : ''}
              </div>
            ` : ''}

            <div class="team-card-meta">
              ${p.phone ? `
                <div class="team-phone-group">
                  <a href="tel:${cleanPhone}" class="team-phone-link">
                    <svg viewBox="0 0 24 24" fill="none" width="13" height="13" style="color:var(--muted)">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>${p.phone}</span>
                  </a>
                  ${waUrl ? `
                    <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="team-meta-wa-icon" title="Conversar no WhatsApp" aria-label="Conversar no WhatsApp">
                      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.97.58 3.84 1.62 5.43L2 22l4.81-1.68c1.53.94 3.32 1.48 5.23 1.48 5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.89-9.91-9.89zm5.79 14.07c-.24.68-1.4 1.25-1.93 1.33-.51.08-1.16.12-3.75-.95-3.3-1.37-5.4-4.73-5.56-4.95-.16-.22-1.33-1.77-1.33-3.38 0-1.61.85-2.4 1.15-2.73.3-.33.66-.41.88-.41.22 0 .44 0 .63.01.21.01.49-.08.77.58.28.68.96 2.34 1.04 2.51.08.17.14.37.03.6-.11.22-.17.36-.33.56-.16.2-.34.45-.49.6-.16.16-.33.34-.14.67.19.33.84 1.38 1.8 2.24 1.24 1.1 2.29 1.45 2.62 1.61.33.16.52.14.71-.08.19-.22.82-.96 1.04-1.29.22-.33.44-.28.74-.16.3.11 1.92.9 2.25 1.07.33.16.55.25.63.38.08.14.08.82-.16 1.5z"/>
                      </svg>
                    </a>
                  ` : ''}
                </div>
              ` : ''}
              ${p.birthday ? `
                <span class="team-meta-bday">
                  🎂 ${fmt(p.birthday)}
                </span>
              ` : ''}
            </div>

            ${skillsList.length ? `
              <div class="team-card-roles-row">
                <div class="team-roles-tags">
                  ${skillsList.map(s => `<span class="team-skill-tag">${s}</span>`).join('')}
                </div>
              </div>
            ` : ''}

            <div class="team-card-actions">
              <button class="btn-edit btn-edit-person" data-id="${p.id}">
                ✏️ Editar dados
              </button>
              <button class="btn-delete btn-delete-person" data-id="${p.id}">
                🗑️ Excluir
              </button>
            </div>
          </div>
        `;
      }).join('');

      mobileWrap.querySelectorAll('.btn-edit-person').forEach(b => {
        b.onclick = () => openPersonModal(Number(b.dataset.id));
      });
      mobileWrap.querySelectorAll('.btn-delete-person').forEach(b => {
        b.onclick = () => deletePersonAction(Number(b.dataset.id));
      });
    }
  }

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
        <div class="stathead">Atividades disponíveis <span class="staticon"><svg viewBox="0 0 24 24" fill="none" width="16" height="16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" stroke-width="2"/></svg></span></div>
        <div class="statnum">${activities.length}</div>
        <div class="trend">Frentes de serviço</div>
      </div>
      <div class="stat">
        <div class="stathead">Pessoas na equipe <span class="staticon"><svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/></svg></span></div>
        <div class="statnum">${people.length}</div>
        <div class="trend">Equipe cadastrada</div>
      </div>
      <div class="stat">
        <div class="stathead">Atribuições futuras <span class="staticon"><svg viewBox="0 0 24 24" fill="none" width="16" height="16"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><polyline points="12 6 12 12 16 14" stroke="currentColor" stroke-width="2"/></svg></span></div>
        <div class="statnum">${futureAssignments}</div>
        <div class="trend">Em todas as escalas</div>
      </div>
      <div class="stat">
        <div class="stathead">Programações <span class="staticon"><svg viewBox="0 0 24 24" fill="none" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke="currentColor" stroke-width="2"/></svg></span></div>
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
        <div class="listrow" style="align-items:center;padding:12px 14px">
          <div class="activity-icon-badge">${getActivityIconSvg(a.name)}</div>
          <div class="grow" style="margin-left:12px">
            <b style="font-size:14px;display:block">${a.name}</b>
            <small style="color:var(--muted)">${a.desc || 'Atividade da equipe técnica'}</small>
          </div>
          <span class="pill purple" style="margin:0 10px">${count} atribuições</span>
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
async function openPersonModal(id = null) {
  const p = people.find(x => x.id === id) || {};
  const isEditing = Boolean(id);

  let userCreds = null;
  if (isEditing) {
    try {
      userCreds = await api.getPersonCredentials(id);
    } catch (e) {
      console.warn('Erro ao carregar credenciais do voluntário:', e);
    }
  }

  let currentAvatar = p.avatarUrl || '';
  const initialSkillsList = p.skills && p.skills.length ? p.skills : (p.area ? p.area.split(',').map(s => s.trim()) : []);
  const currentSkills = new Set(initialSkillsList);
  let currentAvail = p.availability || 'Disponível';

  const bodyHtml = `
    <div class="modal-tabs modal-tabs-compact" id="personModalTabs">
      <button type="button" class="modal-tab-btn active" data-tab="tabId">Perfil</button>
      <button type="button" class="modal-tab-btn" data-tab="tabSkills">Funções</button>
      <button type="button" class="modal-tab-btn" data-tab="tabAvail">Agenda</button>
    </div>

    <!-- ABA 1: PERFIL -->
    <div class="modal-tab-pane active" id="pane-tabId">
      <div class="avatar-compact-row">
        <div class="avatar-preview-mini" id="pavatarBox" style="${currentAvatar ? `background-image:url('${currentAvatar}');background-size:cover;background-position:center;color:transparent;` : ''}">
          ${currentAvatar ? '' : (p.initials || '👤')}
        </div>
        <div class="avatar-compact-info">
          <div style="font-size:12px;font-weight:700">Foto de identificação</div>
          <div class="avatar-compact-actions">
            <input type="file" id="pavatarFile" accept="image/*" style="display:none">
            <button type="button" class="btn secondary mini" id="btnPickAvatar" style="padding:4px 8px;font-size:11px">📷 Escolher foto</button>
            <button type="button" class="mini btn-danger-mini" id="btnRemoveAvatar" style="${currentAvatar ? '' : 'display:none'};padding:4px 8px;font-size:11px">Remover</button>
          </div>
        </div>
      </div>

      <div class="formgrid">
        <div class="field full">
          <label for="pname">Nome completo *</label>
          <input id="pname" value="${p.name || ''}" placeholder="Ex.: Maria Oliveira" required>
        </div>
        <div class="field">
          <label for="pemail">E-mail (Google Agenda) *</label>
          <input type="email" id="pemail" value="${p.email || userCreds?.email || ''}" placeholder="exemplo@gmail.com" required>
        </div>
        <div class="field">
          <label for="pphone">Telefone / WhatsApp *</label>
          <input id="pphone" value="${p.phone || userCreds?.phone || ''}" placeholder="(31) 99999-9999" required>
        </div>
        <div class="field">
          <label for="prole">Função / Perfil</label>
          <select id="prole">
            <option value="Voluntário" ${(userCreds?.role || p.area) === 'Voluntário' ? 'selected' : ''}>Voluntário</option>
            <option value="Líder" ${(userCreds?.role || p.area) === 'Líder' ? 'selected' : ''}>Líder</option>
            <option value="Coordenação" ${(userCreds?.role || p.area) === 'Coordenação' ? 'selected' : ''}>Coordenação</option>
          </select>
        </div>
        <div class="field">
          <label for="ppassword">Senha de Acesso</label>
          <div style="position:relative;display:flex;align-items:center">
            <input type="password" id="ppassword" value="${userCreds?.password || ''}" placeholder="${isEditing ? 'Digite para alterar' : 'Criar senha'}" style="padding-right:34px">
            <button type="button" id="btnTogglePassModal" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--muted);font-size:14px" title="Mostrar/ocultar senha">👁</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ABA 2: FUNÇÕES & ATIVIDADES -->
    <div class="modal-tab-pane" id="pane-tabSkills">
      <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <b style="font-size:13px;display:block">O que essa pessoa faz?</b>
          <div class="muted small">Selecione as funções que essa pessoa está apta a exercer:</div>
        </div>
        <button type="button" class="mini" id="btnToggleAllSkills">Selecionar todas</button>
      </div>
      <div class="skill-cards-grid" id="skillCardsGrid">
        ${activities.map(a => {
          const isSelected = currentSkills.has(a.name);
          return `
            <div class="skill-card-item ${isSelected ? 'selected' : ''}" data-skill="${a.name}">
              <span class="skill-card-icon" style="display:inline-flex;align-items:center;justify-content:center">${getActivityIconSvg(a.name)}</span>
              <span class="skill-card-text" title="${a.name}">${a.name}</span>
              <span class="skill-card-check">✓</span>
            </div>
          `;
        }).join('')}
      </div>
      <div class="muted small" style="margin-top:10px">Para cadastrar uma nova função, acesse o menu Atividades.</div>
    </div>

    <!-- ABA 3: AGENDA & DISPONIBILIDADE -->
    <div class="modal-tab-pane" id="pane-tabAvail">
      <div class="field full">
        <label>Status de disponibilidade geral</label>
        <div class="avail-pills">
          <button type="button" class="avail-pill-btn avail-green ${currentAvail === 'Disponível' ? 'active' : ''}" id="btnAvailDisp" data-avail="Disponível">🟢 Disponível para escalas</button>
          <button type="button" class="avail-pill-btn avail-red ${currentAvail === 'Indisponível' ? 'active' : ''}" id="btnAvailIndisp" data-avail="Indisponível">🔴 Indisponível</button>
        </div>
      </div>

      <div class="field full" style="margin-top:8px">
        <label for="pbirthday">🎂 Data de nascimento / Aniversário</label>
        <input type="date" id="pbirthday" value="${p.birthday || ''}">
      </div>

      <div style="margin-top:14px;padding:12px;background:var(--surface2);border-radius:12px;border:1px solid var(--line)">
        <b style="font-size:12px;display:block;margin-bottom:6px">Período de ausência ou férias (opcional)</b>
        <div class="formgrid">
          <div class="field" style="margin-bottom:6px">
            <label for="pfrom">Ausente a partir de</label>
            <input type="date" id="pfrom" value="${p.unavailableFrom || ''}">
          </div>
          <div class="field" style="margin-bottom:6px">
            <label for="pto">Ausente até</label>
            <input type="date" id="pto" value="${p.unavailableTo || ''}">
          </div>
          <div class="field full" style="margin-bottom:0">
            <label for="preason">Motivo da ausência</label>
            <input id="preason" value="${p.unavailableReason || ''}" placeholder="Ex.: Viagem, trabalho, compromisso...">
          </div>
        </div>
      </div>
      <div class="muted small" style="margin-top:6px">Para ausência de apenas um dia, informe a mesma data no início e no fim.</div>
    </div>
  `;

  openModal(
    isEditing ? 'Editar pessoa' : 'Adicionar pessoa',
    bodyHtml,
    isEditing ? 'Salvar alterações' : 'Cadastrar pessoa',
    async () => {
      const name = document.getElementById('pname').value.trim();
      if (!name) return notify('Informe o nome da pessoa.');

      const email = document.getElementById('pemail').value.trim();
      if (!email || !email.includes('@')) {
        return notify('Informe um e-mail válido (obrigatório para integração com Google Agenda).');
      }

      const phone = document.getElementById('pphone').value.trim();
      if (!phone) return notify('Informe o telefone / WhatsApp da pessoa.');

      const from = document.getElementById('pfrom').value;
      const to = document.getElementById('pto').value;
      if (from && to && to < from) return notify('A data final de ausência não pode ser anterior à data inicial.');

      const selectedSkills = [...document.querySelectorAll('.skill-card-item.selected')].map(x => x.dataset.skill);

      const password = document.getElementById('ppassword').value.trim();
      const role = document.getElementById('prole').value;

      const personData = {
        name,
        phone,
        email,
        avatarUrl: currentAvatar,
        skills: selectedSkills,
        area: selectedSkills.join(', ') || role,
        initials: initials(name),
        availability: currentAvail,
        birthday: document.getElementById('pbirthday').value || null,
        unavailableFrom: from || null,
        unavailableTo: to || null,
        unavailableReason: document.getElementById('preason').value.trim() || null,
        password,
        role
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
    },
    true // isWide modal
  );

  // 1. Configurar alternância de abas
  const tabBtns = document.querySelectorAll('.modal-tab-btn');
  const tabPanes = document.querySelectorAll('.modal-tab-pane');
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));
      btn.classList.add('active');
      const targetPane = document.getElementById(`pane-${btn.dataset.tab}`);
      if (targetPane) targetPane.classList.add('active');
    };
  });

  // 2. Configurar upload de foto / avatar
  const fileInput = document.getElementById('pavatarFile');
  const pavatarBox = document.getElementById('pavatarBox');
  const btnPickAvatar = document.getElementById('btnPickAvatar');
  const btnRemoveAvatar = document.getElementById('btnRemoveAvatar');

  if (btnPickAvatar && fileInput) {
    btnPickAvatar.onclick = () => fileInput.click();
    fileInput.onchange = () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 320;
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > maxDim) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            }
          } else {
            if (h > maxDim) {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          currentAvatar = canvas.toDataURL('image/jpeg', 0.85);

          pavatarBox.style.backgroundImage = `url('${currentAvatar}')`;
          pavatarBox.style.backgroundSize = 'cover';
          pavatarBox.style.backgroundPosition = 'center';
          pavatarBox.style.color = 'transparent';
          pavatarBox.textContent = '';
          btnRemoveAvatar.style.display = 'inline-block';
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };
  }

  if (btnRemoveAvatar) {
    btnRemoveAvatar.onclick = () => {
      currentAvatar = '';
      pavatarBox.style.backgroundImage = 'none';
      pavatarBox.style.color = '';
      pavatarBox.textContent = initials(document.getElementById('pname').value) || '👤';
      btnRemoveAvatar.style.display = 'none';
      if (fileInput) fileInput.value = '';
    };
  }

  // 3. Configurar seleção de cartões de habilidades
  const skillCards = document.querySelectorAll('.skill-card-item');
  const updateSkillBadge = () => {
    const selCount = document.querySelectorAll('.skill-card-item.selected').length;
    const badge = document.getElementById('skillBadgeCount');
    if (badge) badge.textContent = selCount;
  };

  skillCards.forEach(card => {
    card.onclick = () => {
      card.classList.toggle('selected');
      updateSkillBadge();
    };
  });

  const btnToggleAll = document.getElementById('btnToggleAllSkills');
  if (btnToggleAll) {
    btnToggleAll.onclick = () => {
      const allSelected = document.querySelectorAll('.skill-card-item:not(.selected)').length === 0;
      skillCards.forEach(card => {
        if (allSelected) card.classList.remove('selected');
        else card.classList.add('selected');
      });
      updateSkillBadge();
      btnToggleAll.textContent = allSelected ? 'Selecionar todas' : 'Desmarcar todas';
    };
  }

  // 4. Configurar pílulas de disponibilidade
  const btnDisp = document.getElementById('btnAvailDisp');
  const btnIndisp = document.getElementById('btnAvailIndisp');
  if (btnDisp && btnIndisp) {
    btnDisp.onclick = () => {
      currentAvail = 'Disponível';
      btnDisp.classList.add('active');
      btnIndisp.classList.remove('active');
    };
    btnIndisp.onclick = () => {
      currentAvail = 'Indisponível';
      btnIndisp.classList.add('active');
      btnDisp.classList.remove('active');
    };
  }

  // 5. Configurar toggle de visualização da senha
  const passInput = document.getElementById('ppassword');
  const btnTogglePass = document.getElementById('btnTogglePassModal');
  if (btnTogglePass && passInput) {
    btnTogglePass.onclick = () => {
      if (passInput.type === 'password') {
        passInput.type = 'text';
        btnTogglePass.textContent = '🔒';
      } else {
        passInput.type = 'password';
        btnTogglePass.textContent = '👁';
      }
    };
  }
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
const PRESET_ACTIVITY_ICONS = [
  '🎥', '🎬', '📺', '🎚️', '🎤', '🎵', '🎸', '🥁',
  '💡', '📷', '📱', '💻', '📋', '🤝', '👶', '✝️',
  '🛡️', '🚗', '☕', '📢', '🎧', '🕊️', '✨', '✳️'
];

function openActivityModal(id = null) {
  const a = activities.find(x => x.id === id) || {};
  const isEditing = Boolean(id);
  let selectedIcon = a.icon || '🎥';

  const bodyHtml = `
    <div class="field">
      <label for="aname">Nome da atividade *</label>
      <input id="aname" value="${a.name || ''}" placeholder="Ex.: Operação de câmera" required>
    </div>
    <div class="field">
      <label for="adesc">Descrição da função</label>
      <textarea id="adesc" placeholder="Descreva brevemente essa responsabilidade">${a.desc || ''}</textarea>
    </div>
    <div class="field">
      <label>Escolha o ícone representativo:</label>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <div id="iconPreview" style="width:48px;height:48px;border-radius:12px;background:var(--surface2);border:2px solid var(--accent);display:grid;place-items:center;font-size:24px">
          ${selectedIcon}
        </div>
        <span class="muted small">Clique em um dos ícones abaixo para selecionar:</span>
      </div>
      <div class="icon-picker-grid" id="iconPickerGrid">
        ${PRESET_ACTIVITY_ICONS.map(ic => `
          <button type="button" class="icon-picker-btn ${ic === selectedIcon ? 'active' : ''}" data-icon="${ic}">${ic}</button>
        `).join('')}
      </div>
      <input type="hidden" id="aicon" value="${selectedIcon}">
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
        icon: document.getElementById('aicon').value.trim() || '✳️'
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

  // Configurar clique nos ícones predefinidos
  const iconBtns = document.querySelectorAll('.icon-picker-btn');
  const preview = document.getElementById('iconPreview');
  const hiddenInput = document.getElementById('aicon');

  iconBtns.forEach(btn => {
    btn.onclick = () => {
      iconBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedIcon = btn.dataset.icon;
      if (preview) preview.textContent = selectedIcon;
      if (hiddenInput) hiddenInput.value = selectedIcon;
    };
  });
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
  if (!canManageScales()) {
    notify('Apenas líderes e coordenação podem criar ou editar escalas.');
    return;
  }

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
      <div class="field full">
        <label for="scnotes">Observações da programação (opcional)</label>
        <textarea id="scnotes" rows="2" placeholder="Ex.: Traje preto, ensaio 30 min antes, atenção especial à transmissão...">${s.notes || ''}</textarea>
        <div class="muted small" style="font-size:10px">Essa observação será exibida na escala e enviada no lembrete aos voluntários.</div>
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

      const notes = document.getElementById('scnotes')?.value.trim() || '';

      const scaleData = {
        title,
        type: document.getElementById('stype').value,
        place: document.getElementById('splace').value.trim() || 'Templo principal',
        date,
        time: document.getElementById('stime').value || '18:30',
        notes
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

        // Notificar voluntários atribuídos no celular
        assignments.forEach(a => {
          const p = findPerson(a.person);
          if (p) {
            triggerBrowserNotification(
              `🔔 Nova escala: ${a.activity}`,
              `Você foi escalado(a) para ${a.activity} no ${title} (${fmt(date)} às ${scaleData.time}).${notes ? ' Obs: ' + notes : ''}`,
              `assign-${date}-${a.person}`
            );
          }
        });
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
// NOTIFICAÇÕES (LEMBRETES DE ESCALA & ANIVERSÁRIOS)
// ==========================================
export async function sendTestNotification() {
  if (!('Notification' in window)) {
    notify('Este dispositivo não suporta notificações de sistema.');
    return false;
  }

  if (Notification.permission !== 'granted') {
    const res = await Notification.requestPermission();
    if (res !== 'granted') {
      notify('Permissão de notificação não concedida.');
      updateHomeNotificationBanner();
      return false;
    }
  }

  try {
    const ok = await triggerBrowserNotification(
      '🔔 Teste SERVUS: Notificações Ativas!',
      'Parabéns! Seu celular está configurado para receber os lembretes de escalas da AD Bethânia.',
      'test-notif-' + Date.now()
    );

    if ('vibrate' in navigator) {
      try { navigator.vibrate([200, 100, 200]); } catch (e) {}
    }

    notify('Notificação de teste enviada! Confira a barra do seu celular.');
    updateHomeNotificationBanner();
    return ok;
  } catch (err) {
    console.error('Erro ao enviar teste de notificação:', err);
    notify('Erro ao enviar notificação: ' + err.message);
    return false;
  }
}

export async function triggerBrowserNotification(title, body, tag = 'servus-notif', extra = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag,
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: '/', timestamp: Date.now() },
    ...extra
  };

  // 1. Tentar via Service Worker Registration (padrão obrigatório no Android Chrome e iOS PWA)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, options);
        return true;
      }
    } catch (e) {
      console.warn('Erro ao disparar via navigator.serviceWorker.ready:', e);
    }
  }

  // 2. Tentar via postMessage ao controller do Service Worker
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        options
      });
      return true;
    } catch (e) {
      console.warn('Erro ao enviar postMessage para controller:', e);
    }
  }

  // 3. Fallback para Notification construtor (Desktop Chrome/Firefox/Safari)
  try {
    const notif = new Notification(title, options);
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
    return true;
  } catch (e) {
    console.warn('Erro no fallback new Notification:', e);
  }

  return false;
}

async function enableAllNotifications() {
  if (!('Notification' in window)) {
    notify('Este dispositivo não suporta notificações de sistema.');
    return;
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      notify('Notificações ativadas com sucesso!');
      await sendTestNotification();
      checkScaleNotifications();
      checkBirthdayNotifications();
    } else if (perm === 'denied') {
      notify('Notificações bloqueadas nas configurações do navegador.');
    } else {
      notify('Permissão não concedida.');
    }
    updateHomeNotificationBanner();
  } catch (e) {
    console.error('Erro ao pedir permissão de notificação:', e);
    notify('Erro ao ativar notificações: ' + e.message);
  }
}

async function enableBirthdayNotifications() {
  await enableAllNotifications();
}

async function checkScaleNotifications() {
  if (!currentUser) return;
  const targetPersonId = currentUser.personId;
  const targetName = currentUser.name ? currentUser.name.toLowerCase() : '';

  const now = new Date();
  const todayStr = localISO(now);
  const tom = new Date(now);
  tom.setDate(tom.getDate() + 1);
  const tomorrowStr = localISO(tom);

  scales.forEach(s => {
    (s.assignments || []).forEach(a => {
      const isMine = (targetPersonId && String(a.person) === String(targetPersonId)) ||
                     (targetName && findPerson(a.person)?.name.toLowerCase() === targetName);
      if (!isMine) return;
      if (a.status === 'cancelled') return;

      const scaleTime = s.time || '18:30';
      const noteText = (a.notes || s.notes) ? ` · Obs: ${a.notes || s.notes}` : '';

      // 1. Notificação no dia da escala (HOJE)
      if (s.date === todayStr) {
        const key = `servus_notif_today_${a.id}_${todayStr}`;
        if (!localStorage.getItem(key)) {
          triggerBrowserNotification(
            '🔔 É hoje! Escala na AD Bethânia',
            `Você está escalado(a) hoje para ${a.activity} às ${scaleTime} no ${s.title}.${noteText} Que Deus abençoe seu serviço!`,
            `scale-today-${a.id}`
          );
          localStorage.setItem(key, 'true');
        }
      }

      // 2. Notificação 1 dia antes da escala (AMANHÃ)
      if (s.date === tomorrowStr) {
        const key = `servus_notif_1day_${a.id}_${tomorrowStr}`;
        if (!localStorage.getItem(key)) {
          triggerBrowserNotification(
            '📅 Lembrete: Escala amanhã!',
            `Você está escalado(a) amanhã para ${a.activity} às ${scaleTime} no ${s.title}.${noteText} Chegue com antecedência!`,
            `scale-1day-${a.id}`
          );
          localStorage.setItem(key, 'true');
        }
      }
    });
  });
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
        triggerBrowserNotification('Aniversário na equipe 🎂', 'Hoje é aniversário de ' + p.name + '!', `bday-${p.id}`);
        await api.saveNotifiedKey(key);
      }
    }
  });
}

// ==========================================
// PWA & INSTALAÇÃO NO CELULAR
// ==========================================
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.innerWidth <= 768);
  const btn = document.getElementById('btnInstallPwa');
  if (btn && isMobileDevice) btn.style.display = 'flex';
});

function initPwa() {
  if ('serviceWorker' in navigator) {
    const registerSw = () => {
      navigator.serviceWorker.register('/sw.js').then(async reg => {
        console.log('SERVUS Service Worker registrado com sucesso:', reg.scope);
        swRegistration = reg;

        // Detectar novas atualizações do código / assets
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                incrementPendingUpdates();
                notify('Nova versão disponível! Toque em Atualizar.');
              }
            };
          }
        };

        if (reg.waiting) {
          incrementPendingUpdates();
        }

        if ('periodicSync' in reg) {
          try {
            await reg.periodicSync.register('check-scales-sync', {
              minInterval: 12 * 60 * 60 * 1000 // 12h
            });
          } catch (e) {}
        }
      }).catch(err => {
        console.warn('SW registration note:', err);
      });
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      registerSw();
    } else {
      window.addEventListener('DOMContentLoaded', registerSw);
    }
  }

  const btn = document.getElementById('btnInstallPwa');
  if (btn) {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.innerWidth <= 768);

    if (!isStandalone && isMobileDevice) {
      btn.style.display = 'flex';
    } else {
      btn.style.display = 'none';
    }

    btn.onclick = async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          btn.style.display = 'none';
        }
        deferredInstallPrompt = null;
      } else {
        openModal(
          'Salvar SERVUS no Celular',
          `
            <div style="text-align:center;padding:12px 6px">
              <img src="/icon-192.png" alt="SERVUS" style="width:64px;height:64px;border-radius:18px;margin-bottom:12px;box-shadow:0 8px 24px rgba(99,85,216,0.35);display:inline-block">
              <h3 style="font-size:16px;margin-bottom:8px">Adicione à tela inicial</h3>
              <p class="muted" style="font-size:13px;line-height:1.5;margin-bottom:16px">
                Instale o SERVUS como aplicativo no seu telefone para acesso rápido em tela cheia e receber notificações de escalas!
              </p>
              <div style="background:var(--surface2);padding:14px;border-radius:12px;text-align:left;font-size:12px;line-height:1.6">
                <b>No iPhone (Safari):</b><br>
                1. Toque no botão de <b>Compartilhar</b> (quadrado com seta 📤) na barra inferior.<br>
                2. Role a lista e toque em <b>"Adicionar à Tela de Início" ➕</b>.<br>
                3. Toque em <b>Adicionar</b> no canto superior direito.<br><br>
                <b>No Android (Chrome):</b><br>
                1. Toque nos <b>3 pontinhos (⋮)</b> no topo direito.<br>
                2. Selecione <b>"Instalar aplicativo"</b> ou <b>"Adicionar à tela inicial"</b>.
              </div>
            </div>
          `,
          'Entendi',
          () => closeModal()
        );
      }
    };
  }
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
  // Inicializar PWA
  initPwa();

  // Inicializar Tema Escuro / Claro
  initTheme();

  // Navegação da Sidebar
  document.querySelectorAll('.nav button').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // Navegação Inferior Mobile (Bottom Nav)
  document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // Mobile menu toggle e Backdrop
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');

  const closeSidebarMobile = () => {
    sidebar?.classList.remove('open');
    backdrop?.classList.remove('show');
  };

  const btnToggle = document.getElementById('btnToggleMenu');
  if (btnToggle) {
    btnToggle.onclick = () => {
      const isOpen = sidebar.classList.toggle('open');
      backdrop?.classList.toggle('show', isOpen);
    };
  }

  if (backdrop) {
    backdrop.onclick = closeSidebarMobile;
  }

  // Botões de Atualizar Página e Dados (Topo)
  let lastRefreshClickTime = 0;
  const triggerPageRefresh = async () => {
    const now = Date.now();
    const overlay = document.getElementById('updatingOverlay');
    const msgEl = document.getElementById('updatingMsg');
    const allIcons = document.querySelectorAll('.btn-refresh-screen svg');

    allIcons.forEach(svg => svg.classList.add('spin-refresh'));
    if (overlay) overlay.style.display = 'grid';
    if (msgEl) msgEl.textContent = 'Sincronizando todas as informações com o sistema...';

    // Se der dois toques rápidos (menos de 1.2s), faz recarregamento completo do navegador
    if (now - lastRefreshClickTime < 1200) {
      if (msgEl) msgEl.textContent = 'Recarregando aplicação completa...';
      setTimeout(() => window.location.reload(), 250);
      return;
    }
    lastRefreshClickTime = now;

    const startTime = Date.now();

    try {
      // 1. Se houver nova versão de Service Worker esperando, ativar e recarregar
      if (swRegistration && swRegistration.waiting) {
        if (msgEl) msgEl.textContent = 'Instalando nova versão do aplicativo...';
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        setTimeout(() => {
          window.location.reload();
        }, 700);
        return;
      }

      // 2. Se o navegador suporta service worker, checar se há atualização
      if (swRegistration && swRegistration.update) {
        try {
          await swRegistration.update();
        } catch (e) {}
      }

      // 3. Forçar recarregamento completo dos dados do Supabase
      await loadDataFromSupabase();

      // 4. Limpar contador de atualizações pendentes
      setPendingUpdates(0);

      // Tempo mínimo para a animação da tela de atualização ser visível (700ms)
      const elapsed = Date.now() - startTime;
      if (elapsed < 700) {
        await new Promise(r => setTimeout(r, 700 - elapsed));
      }

      notify('SERVUS atualizado com sucesso!');
    } catch (err) {
      console.warn('Erro ao sincronizar, recarregando navegador:', err);
      window.location.reload();
      return;
    } finally {
      if (overlay) overlay.style.display = 'none';
      setTimeout(() => {
        allIcons.forEach(svg => svg.classList.remove('spin-refresh'));
      }, 500);
    }
  };

  document.querySelectorAll('.btn-refresh-screen').forEach(btn => {
    btn.onclick = triggerPageRefresh;
  });

  // Botões do Topo (Notificações e Avisos)
  document.getElementById('btnTopBell').onclick = () => {
    openNotificationsModal();
  };

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
  document.getElementById('btnShareMine').onclick = async () => {
    const currentPerson = findPerson(selectedVolunteerId);
    const personName = currentPerson ? currentPerson.name : 'Voluntário';
    const shareText = `Olá! Confira as escalas de ${personName} no SERVUS (AD Regional Bethânia):\n${window.location.origin}/`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Escala de ${personName} | SERVUS`,
          text: shareText,
          url: window.location.href
        });
        return;
      } catch (e) {}
    }
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

  // Monitorar foco da janela para checar notificações
  window.addEventListener('focus', () => {
    checkScaleNotifications();
    checkBirthdayNotifications();
    updateHomeNotificationBanner();
  });

  // Checagem periódica a cada 20 minutos
  setInterval(() => {
    checkScaleNotifications();
    checkBirthdayNotifications();
  }, 20 * 60 * 1000);

  // Iniciar Realtime Listener
  api.subscribeToRealtime((payload) => {
    console.log('Realtime change detectado no Supabase:', payload);
    incrementPendingUpdates();
    loadDataFromSupabase();
  });
}

// Iniciar Aplicação
initEvents();
const hasSession = initAuth();
loadDataFromSupabase();
