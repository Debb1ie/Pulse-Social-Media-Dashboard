/* ── CONFIG ───────────────────────────────── */
const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : 'https://pulse-api.onrender.com/api'; // 🔁 Replace with your deployed backend URL
const PLATFORM_COLORS = {
  twitter:   '#1DA1F2',
  instagram: '#E1306C',
  facebook:  '#4267B2',
  linkedin:  '#0A66C2',
  youtube:   '#FF0000',
  tiktok:    '#69C9D0',
};
const PLATFORM_ICONS = {
  twitter:'𝕏', instagram:'📸', facebook:'👤', linkedin:'💼', youtube:'▶', tiktok:'♪',
};

/* ── STATE ────────────────────────────────── */
let dashData = null;
let growthChart = null, donutChart = null, engagementChart = null, barChart = null;

/* ── INIT ─────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  setupNav();
  setupSidebar();
  setupTopbar();
  loadDashboard();
});

/* ── NAVIGATION ───────────────────────────── */
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
    });
  });
}

function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  document.getElementById('pageTitle').textContent = capitalize(view);
  if (view === 'analytics')  loadAnalytics();
  if (view === 'posts')      loadPosts();
  if (view === 'schedule')   loadScheduleView();
  if (view === 'platforms')  loadPlatformsView();
  // close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
}

/* ── SIDEBAR TOGGLE (mobile) ──────────────── */
function setupSidebar() {
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

/* ── TOPBAR ───────────────────────────────── */
function setupTopbar() {
  // Notifications
  const notifBtn   = document.getElementById('notifBtn');
  const notifPanel = document.getElementById('notifPanel');
  notifBtn.addEventListener('click', e => {
    e.stopPropagation();
    notifPanel.classList.toggle('open');
    if (notifPanel.classList.contains('open')) markNotifsRead();
  });
  document.addEventListener('click', () => notifPanel.classList.remove('open'));

  // Refresh
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    const btn = document.getElementById('refreshBtn');
    btn.style.opacity = '.5';
    btn.style.pointerEvents = 'none';
    await fetch(`${API}/refresh`, { method: 'POST' });
    await loadDashboard();
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
    showToast('Stats refreshed!', 'success');
  });

  // New post button
  document.getElementById('newPostBtn').addEventListener('click', () => openComposeModal());

  // Platform filter (overview growth chart)
  document.getElementById('growthPlatform').addEventListener('change', async e => {
    const res = await fetch(`${API}/analytics?platform=${e.target.value}`);
    const d   = await res.json();
    updateGrowthChart(d.follower_growth);
  });
}

/* ── LOAD DASHBOARD ───────────────────────── */
async function loadDashboard() {
  const res = await fetch(`${API}/dashboard`);
  dashData  = await res.json();

  renderUser(dashData.user);
  renderSummaryStats(dashData.summary);
  renderRecentPosts(dashData.recent_posts);
  renderScheduledWidget(dashData.scheduled);
  renderNotifications(dashData.notifications);
  populatePlatformSelects(Object.keys(dashData.platforms));
  await loadOverviewCharts();
}

/* ── USER ─────────────────────────────────── */
function renderUser(user) {
  document.getElementById('avatarEl').textContent  = user.avatar;
  document.getElementById('userName').textContent  = user.name;
  document.getElementById('userHandle').textContent = user.handle;
}

/* ── SUMMARY STATS ────────────────────────── */
function renderSummaryStats(s) {
  const grid = document.getElementById('statsGrid');
  const cards = [
    { label: 'Total Followers', value: fmtNum(s.total_followers), change: '+2.4%', up: true, color: '#7c5cfc', sub: 'across all platforms' },
    { label: 'Engagement Rate', value: s.total_engagement + '%', change: '+0.3%', up: true, color: '#e040fb', sub: 'avg across platforms' },
    { label: 'Total Reach',     value: fmtNum(s.total_reach),     change: '+5.1%', up: true, color: '#00e5a0', sub: 'this month' },
    { label: 'Published Posts', value: s.total_posts,             change: '',      up: true, color: '#ffd60a', sub: `${s.platforms_connected} platforms` },
  ];
  grid.innerHTML = cards.map(c => `
    <div class="stat-card" style="--c:${c.color}">
      <style>.stat-card[style*="${c.color}"]::before { background: ${c.color}; }</style>
      <div class="stat-label">${c.label}</div>
      <div class="stat-value">${c.value}</div>
      ${c.change ? `<div class="stat-change up">▲ ${c.change}</div>` : ''}
      <div class="stat-sub">${c.sub}</div>
    </div>
  `).join('');
}

/* ── OVERVIEW CHARTS ──────────────────────── */
async function loadOverviewCharts() {
  const res = await fetch(`${API}/analytics`);
  const d   = await res.json();

  // Growth chart
  const ctx1 = document.getElementById('growthChart').getContext('2d');
  if (growthChart) growthChart.destroy();
  growthChart = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: d.follower_growth.labels,
      datasets: [{
        label: 'New Followers',
        data: d.follower_growth.data,
        borderColor: '#7c5cfc',
        backgroundColor: 'rgba(124,92,252,.12)',
        borderWidth: 2,
        fill: true,
        tension: .4,
        pointRadius: 0,
        pointHoverRadius: 5,
      }],
    },
    options: chartOptions('Followers'),
  });

  // Donut chart
  const platforms = dashData.platforms;
  const ctx2 = document.getElementById('donutChart').getContext('2d');
  if (donutChart) donutChart.destroy();
  donutChart = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: Object.keys(platforms).map(capitalize),
      datasets: [{
        data: Object.values(platforms).map(p => p.followers),
        backgroundColor: Object.keys(platforms).map(k => PLATFORM_COLORS[k]),
        borderWidth: 2,
        borderColor: '#111118',
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'right', labels: { color: '#6b6b80', font: { family: 'DM Sans', size: 11 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${fmtNum(ctx.parsed)} followers` } },
      },
      cutout: '68%',
    },
  });
}

function updateGrowthChart(data) {
  if (!growthChart) return;
  growthChart.data.labels   = data.labels;
  growthChart.data.datasets[0].data = data.data;
  growthChart.update();
}

/* ── RECENT POSTS ─────────────────────────── */
function renderRecentPosts(posts) {
  const el = document.getElementById('recentPostsList');
  if (!posts.length) { el.innerHTML = '<div class="empty-state">No posts yet.</div>'; return; }
  el.innerHTML = posts.slice(0, 5).map(p => `
    <div class="post-row">
      <div class="platform-badge" style="background:${PLATFORM_COLORS[p.platform]}22">
        ${PLATFORM_ICONS[p.platform]}
      </div>
      <div class="post-caption">${escHtml(p.caption)}</div>
      <div class="post-stats">
        <span>♥ ${fmtNum(p.likes)}</span>
        <span>💬 ${fmtNum(p.comments)}</span>
      </div>
    </div>
  `).join('');
}

/* ── SCHEDULED WIDGET ─────────────────────── */
function renderScheduledWidget(scheduled) {
  const el = document.getElementById('scheduledList');
  if (!scheduled.length) { el.innerHTML = '<div class="empty-state">Nothing scheduled.</div>'; return; }
  el.innerHTML = scheduled.slice(0, 5).map(s => `
    <div class="sched-row">
      <div class="platform-badge" style="background:${PLATFORM_COLORS[s.platform]}22;width:32px;height:32px;border-radius:8px;display:grid;place-items:center">
        ${PLATFORM_ICONS[s.platform]}
      </div>
      <div class="sched-info">
        <div class="sched-caption">${escHtml(s.caption)}</div>
        <div class="sched-time">${fmtDate(s.scheduled_time)}</div>
      </div>
    </div>
  `).join('');
}

/* ── NOTIFICATIONS ────────────────────────── */
function renderNotifications(notifs) {
  const panel = document.getElementById('notifPanel');
  const badge = document.getElementById('notifBadge');
  const unread = notifs.filter(n => !n.read).length;
  badge.textContent = unread;
  badge.dataset.count = unread;

  panel.innerHTML = notifs.length ? notifs.map(n => `
    <div class="notif-item">
      <div class="notif-dot ${n.type}"></div>
      <div>
        <div>${escHtml(n.message)}</div>
        <div class="notif-time">${relTime(n.timestamp)}</div>
      </div>
    </div>
  `).join('') : '<div class="empty-state">No notifications.</div>';
}

async function markNotifsRead() {
  await fetch(`${API}/notifications/read`, { method: 'POST' });
  document.getElementById('notifBadge').textContent = '0';
  document.getElementById('notifBadge').dataset.count = '0';
}

/* ── ANALYTICS VIEW ───────────────────────── */
async function loadAnalytics() {
  const platform = document.getElementById('analyticsFilter').value || 'all';
  const period   = document.getElementById('periodFilter').value   || 30;
  const res = await fetch(`${API}/analytics?platform=${platform}&period=${period}`);
  const d   = await res.json();

  // Summary cards
  const grid = document.getElementById('analyticsGrid');
  const platforms = dashData ? dashData.platforms : {};
  const allPlatforms = Object.values(platforms);
  grid.innerHTML = [
    { label: 'Avg Engagement', value: (allPlatforms.reduce((a,b) => a + b.engagement_rate, 0) / (allPlatforms.length||1)).toFixed(2) + '%' },
    { label: 'Total Reach',    value: fmtNum(allPlatforms.reduce((a,b) => a + b.reach, 0)) },
    { label: 'Total Likes',    value: fmtNum(allPlatforms.reduce((a,b) => a + b.likes_total, 0)) },
    { label: 'Total Comments', value: fmtNum(allPlatforms.reduce((a,b) => a + b.comments_total, 0)) },
    { label: 'Total Shares',   value: fmtNum(allPlatforms.reduce((a,b) => a + b.shares_total, 0)) },
    { label: 'Total Posts',    value: allPlatforms.reduce((a,b) => a + b.posts_count, 0) },
  ].map(c => `
    <div class="stat-card">
      <div class="stat-label">${c.label}</div>
      <div class="stat-value" style="font-size:1.8rem">${c.value}</div>
    </div>
  `).join('');

  // Engagement chart
  const ctx3 = document.getElementById('engagementChart').getContext('2d');
  if (engagementChart) engagementChart.destroy();
  engagementChart = new Chart(ctx3, {
    type: 'line',
    data: {
      labels: d.engagement_trend.labels,
      datasets: [{
        label: 'Engagement %',
        data: d.engagement_trend.data,
        borderColor: '#e040fb',
        backgroundColor: 'rgba(224,64,251,.1)',
        borderWidth: 2,
        fill: true,
        tension: .4,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: '#e040fb',
      }],
    },
    options: chartOptions('%'),
  });

  // Bar chart
  const ctx4 = document.getElementById('barChart').getContext('2d');
  if (barChart) barChart.destroy();
  const pd = d.platform_breakdown;
  barChart = new Chart(ctx4, {
    type: 'bar',
    data: {
      labels: Object.keys(pd).map(capitalize),
      datasets: [{
        label: 'Followers',
        data: Object.values(pd).map(x => x.followers),
        backgroundColor: Object.keys(pd).map(k => PLATFORM_COLORS[k] + 'cc'),
        borderColor:     Object.keys(pd).map(k => PLATFORM_COLORS[k]),
        borderWidth: 1,
        borderRadius: 6,
      }],
    },
    options: {
      ...chartOptions('Followers'),
      plugins: { ...chartOptions().plugins, legend: { display: false } },
    },
  });

  // Listen for filter changes
  ['analyticsFilter','periodFilter'].forEach(id => {
    document.getElementById(id).onchange = loadAnalytics;
  });
}

/* ── POSTS VIEW ───────────────────────────── */
async function loadPosts() {
  const platform = document.getElementById('postPlatformFilter').value || 'all';
  const res  = await fetch(`${API}/posts?platform=${platform}`);
  const posts = await res.json();
  const grid = document.getElementById('postsGrid');

  if (!posts.length) { grid.innerHTML = '<div class="empty-state">No posts found.</div>'; return; }

  grid.innerHTML = posts.map(p => `
    <div class="post-card" id="post-${p.id}">
      <img class="post-card-img" src="${p.image || 'https://picsum.photos/seed/' + p.id + '/400/300'}" alt="" loading="lazy" />
      <div class="post-card-body">
        <div class="post-card-head">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="platform-badge" style="background:${PLATFORM_COLORS[p.platform]}22;width:30px;height:30px;border-radius:7px;display:grid;place-items:center;font-size:.9rem">
              ${PLATFORM_ICONS[p.platform]}
            </div>
            <span style="font-size:.78rem;color:var(--muted)">${capitalize(p.platform)}</span>
          </div>
          <button class="delete-btn" onclick="deletePost(${p.id})" title="Delete post">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
        <p class="post-card-caption">${escHtml(p.caption)}</p>
        <div class="post-metrics">
          <span class="post-metric">♥ ${fmtNum(p.likes)}</span>
          <span class="post-metric">💬 ${fmtNum(p.comments)}</span>
          <span class="post-metric">↗ ${fmtNum(p.shares)}</span>
          <span class="post-metric">👁 ${fmtNum(p.reach)}</span>
        </div>
        <div class="post-time">${fmtDate(p.timestamp)}</div>
      </div>
    </div>
  `).join('');

  document.getElementById('postPlatformFilter').onchange = loadPosts;
  document.getElementById('composeBtn').onclick = () => openComposeModal();
}

async function deletePost(id) {
  if (!confirm('Delete this post?')) return;
  await fetch(`${API}/posts/${id}`, { method: 'DELETE' });
  document.getElementById(`post-${id}`)?.remove();
  showToast('Post deleted', 'success');
}

/* ── SCHEDULE VIEW ────────────────────────── */
async function loadScheduleView() {
  const res = await fetch(`${API}/dashboard`);
  const d   = await res.json();
  const tbody = document.getElementById('scheduleBody');

  tbody.innerHTML = d.scheduled.map(s => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:28px;height:28px;border-radius:7px;background:${PLATFORM_COLORS[s.platform]}22;display:grid;place-items:center;font-size:.9rem">${PLATFORM_ICONS[s.platform]}</div>
          ${capitalize(s.platform)}
        </div>
      </td>
      <td style="max-width:260px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${escHtml(s.caption)}</td>
      <td style="font-family:var(--font-mono);font-size:.78rem;color:var(--muted)">${fmtDate(s.scheduled_time)}</td>
      <td><span class="status-pill ${s.status}">${s.status}</span></td>
      <td></td>
    </tr>
  `).join('') || `<tr><td colspan="5"><div class="empty-state">No scheduled posts.</div></td></tr>`;

  document.getElementById('scheduleNewBtn').onclick = () => openScheduleModal();
}

/* ── PLATFORMS VIEW ───────────────────────── */
function loadPlatformsView() {
  const grid = document.getElementById('platformsGrid');
  const platforms = dashData?.platforms || {};
  grid.innerHTML = Object.entries(platforms).map(([key, p]) => `
    <div class="platform-card" style="border-top: 3px solid ${p.color}">
      <div class="platform-card-head">
        <div class="platform-icon" style="background:${p.color}22;color:${p.color}">
          ${PLATFORM_ICONS[key]}
        </div>
        <div>
          <div class="platform-name">${p.name}</div>
          <div class="platform-connected">● Connected</div>
        </div>
      </div>
      <div class="platform-stats">
        <div class="pstat">
          <div class="pstat-label">Followers</div>
          <div class="pstat-value">${fmtNum(p.followers)}</div>
        </div>
        <div class="pstat">
          <div class="pstat-label">Engagement</div>
          <div class="pstat-value">${p.engagement_rate}%</div>
        </div>
        <div class="pstat">
          <div class="pstat-label">Reach</div>
          <div class="pstat-value">${fmtNum(p.reach)}</div>
        </div>
        <div class="pstat">
          <div class="pstat-label">Posts</div>
          <div class="pstat-value">${fmtNum(p.posts_count)}</div>
        </div>
      </div>
    </div>
  `).join('');
}

/* ── MODAL HELPERS ────────────────────────── */
function openModal(html) {
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('modalOverlay').onclick = e => { if (e.target.id === 'modalOverlay') closeModal(); };
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

function openComposeModal() {
  const platforms = Object.keys(dashData?.platforms || PLATFORM_COLORS);
  openModal(`
    <h2>New Post</h2>
    <div class="form-group">
      <label>Platform</label>
      <select id="mPlatform">${platforms.map(p => `<option value="${p}">${capitalize(p)}</option>`).join('')}</select>
    </div>
    <div class="form-group">
      <label>Caption</label>
      <textarea id="mCaption" placeholder="What's on your mind?"></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="submitPost()">Publish</button>
    </div>
  `);
}

async function submitPost() {
  const platform = document.getElementById('mPlatform').value;
  const caption  = document.getElementById('mCaption').value.trim();
  if (!caption) { showToast('Caption is required', 'error'); return; }
  await fetch(`${API}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, caption }),
  });
  closeModal();
  showToast('Post published!', 'success');
  await loadDashboard();
}

function openScheduleModal() {
  const platforms = Object.keys(dashData?.platforms || PLATFORM_COLORS);
  const minDate = new Date(); minDate.setMinutes(minDate.getMinutes() + 30);
  const minISO  = minDate.toISOString().slice(0, 16);
  openModal(`
    <h2>Schedule Post</h2>
    <div class="form-group">
      <label>Platform</label>
      <select id="sPlatform">${platforms.map(p => `<option value="${p}">${capitalize(p)}</option>`).join('')}</select>
    </div>
    <div class="form-group">
      <label>Caption</label>
      <textarea id="sCaption" placeholder="Your post content…"></textarea>
    </div>
    <div class="form-group">
      <label>Schedule For</label>
      <input type="datetime-local" id="sTime" min="${minISO}" />
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="submitSchedule()">Schedule</button>
    </div>
  `);
}

async function submitSchedule() {
  const platform       = document.getElementById('sPlatform').value;
  const caption        = document.getElementById('sCaption').value.trim();
  const scheduled_time = document.getElementById('sTime').value;
  if (!caption || !scheduled_time) { showToast('All fields required', 'error'); return; }
  await fetch(`${API}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, caption, scheduled_time: new Date(scheduled_time).toISOString() }),
  });
  closeModal();
  showToast('Post scheduled!', 'success');
  loadScheduleView();
}

/* ── POPULATE SELECTS ─────────────────────── */
function populatePlatformSelects(keys) {
  ['growthPlatform','analyticsFilter','postPlatformFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    // Keep existing default option, add platform options
    const existing = el.querySelectorAll('option:not([value="all"])');
    existing.forEach(o => o.remove());
    keys.forEach(k => {
      const o = document.createElement('option');
      o.value = k; o.textContent = capitalize(k);
      el.appendChild(o);
    });
  });
}

/* ── CHART DEFAULTS ───────────────────────── */
function chartOptions(yLabel = '') {
  return {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#18181f',
        borderColor: '#2a2a38',
        borderWidth: 1,
        titleColor: '#e8e8f0',
        bodyColor: '#6b6b80',
        padding: 10,
      },
    },
    scales: {
      x: {
        grid: { color: '#2a2a38', drawBorder: false },
        ticks: { color: '#6b6b80', maxTicksLimit: 8, font: { family: 'JetBrains Mono', size: 10 } },
      },
      y: {
        grid: { color: '#2a2a38', drawBorder: false },
        ticks: { color: '#6b6b80', font: { family: 'JetBrains Mono', size: 10 }, callback: v => fmtNum(v) },
      },
    },
  };
}

/* ── TOAST ────────────────────────────────── */
function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<div class="toast-dot"></div>${escHtml(msg)}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ── UTILS ────────────────────────────────── */
function fmtNum(n) {
  if (n == null) return '0';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' });
  } catch { return iso; }
}
function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}
