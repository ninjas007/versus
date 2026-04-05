import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { Gracket } from "https://unpkg.com/gracket@2.1.1/dist/index.js";
import {
  buildDefaultAvatarUrl,
  buildRuntimeState,
  cloneData,
  FREE_VOTES_PER_MATCH,
  getAvatarUrl,
  getMatchId,
  getMatchStatus,
  hasResolvedTeams,
  teamKey
} from "../lib/tournament-data.js";

const STORAGE_CATEGORY_KEY = "tournamentActiveCategory:v3";
const STORAGE_PENDING_INTENT_KEY = "tournamentPendingIntent:v3";
const STORAGE_PENDING_PAYMENT_KEY = "tournamentPendingPayment:v3";

const modalBackdrop = document.getElementById("modal-backdrop");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");
const statusEl = document.getElementById("status");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const loginMetaEl = document.getElementById("login-meta");
const bracketTitleEl = document.getElementById("bracket-title");
const categoryStrip = document.getElementById("category-strip");
const scheduleStrip = document.getElementById("schedule-strip");
const categorySummary = document.getElementById("category-summary");
const refreshBtn = document.getElementById("reset-bracket");
const bracketContainer = document.getElementById("bracket");
const loginBox = loginBtn?.closest(".login-box") || null;
const logoutWrap = logoutBtn?.closest(".panel-footer") || null;
const refreshWrap = refreshBtn?.closest(".panel-footer") || null;

const state = {
  config: null,
  supabase: null,
  session: null,
  categories: [],
  activeCategoryId: localStorage.getItem(STORAGE_CATEGORY_KEY) || "one-piece",
  totals: {},
  runtime: null,
  user: null,
  bracket: null,
  modalCountdownInterval: null,
  flashHtml: "",
  isLoading: false,
  isResumingPayment: false
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(dateLike) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatCountdown(ms) {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getFallbackAvatarUrl(team) {
  return buildDefaultAvatarUrl(team?.name || "Team");
}

function setFlashStatus(message, isHtml = false) {
  state.flashHtml = isHtml ? String(message || "") : escapeHtml(message);
  renderStatus();
}

function clearFlashStatus() {
  state.flashHtml = "";
  renderStatus();
}

function savePendingIntent(intent) {
  if (!intent) {
    sessionStorage.removeItem(STORAGE_PENDING_INTENT_KEY);
    return;
  }

  sessionStorage.setItem(STORAGE_PENDING_INTENT_KEY, JSON.stringify(intent));
}

function loadPendingIntent() {
  try {
    const raw = sessionStorage.getItem(STORAGE_PENDING_INTENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePendingPayment(payload) {
  if (!payload) {
    sessionStorage.removeItem(STORAGE_PENDING_PAYMENT_KEY);
    return;
  }

  sessionStorage.setItem(STORAGE_PENDING_PAYMENT_KEY, JSON.stringify(payload));
}

function loadPendingPayment() {
  try {
    const raw = sessionStorage.getItem(STORAGE_PENDING_PAYMENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearPendingPayment() {
  sessionStorage.removeItem(STORAGE_PENDING_PAYMENT_KEY);
}

function getCurrentRoundIndex(data) {
  for (let roundIndex = 0; roundIndex < data.length; roundIndex += 1) {
    const round = data[roundIndex] || [];
    const hasPlayableMatch = round.some((game) => {
      if (!game || game.length !== 2) return false;
      const a = game[0]?.score;
      const b = game[1]?.score;
      return a == null || b == null;
    });

    if (hasPlayableMatch) {
      return roundIndex;
    }
  }

  return -1;
}

function getSchedule(roundIndex, gameIndex) {
  return state.runtime?.scheduleMap?.[`${roundIndex}:${gameIndex}`] || null;
}

function getLiveMatch() {
  const matches = state.runtime?.matches || [];
  return (
    matches.find(
      (match) =>
        getMatchStatus(state.runtime.scheduleMap, match.roundIndex, match.gameIndex).key ===
        "live"
    ) || null
  );
}

function getScheduleItems() {
  const matches = state.runtime?.matches || [];

  return matches
    .map((match) => ({
      ...match,
      status: getMatchStatus(state.runtime.scheduleMap, match.roundIndex, match.gameIndex),
      schedule: getSchedule(match.roundIndex, match.gameIndex)
    }))
    .filter((match) => match.status.key !== "closed" && match.schedule)
    .sort((a, b) => a.schedule.start.getTime() - b.schedule.start.getTime());
}

function getRuntimeMatch(roundIndex, gameIndex) {
  return (
    state.runtime?.matches?.find(
      (match) => match.roundIndex === roundIndex && match.gameIndex === gameIndex
    ) || null
  );
}

function getUsageForMatch(matchId) {
  return (
    state.user?.usageByMatch?.[matchId] || {
      freeVotesUsed: 0,
      freeVotesRemaining: state.config?.freeVotesPerMatch || FREE_VOTES_PER_MATCH
    }
  );
}

function rebuildRuntime() {
  if (!state.activeCategoryId) return;
  const category =
    state.categories.find((item) => item.id === state.activeCategoryId) || null;

  if (!category) {
    state.runtime = null;
    return;
  }

  state.runtime = buildRuntimeState(category, state.totals || {}, new Date());
}

function getCurrentCategory() {
  return state.runtime?.category || null;
}

function getRoundLabels() {
  return state.runtime?.roundLabels || [];
}

function renderCategoryBadges() {
  categoryStrip.innerHTML = "";

  state.categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-badge ${
      category.id === state.activeCategoryId ? "active" : ""
    }`;
    button.textContent = category.label;
    button.addEventListener("click", () => switchCategory(category.id));
    categoryStrip.appendChild(button);
  });
}

function renderBracketTitle() {
  const category = getCurrentCategory();
  if (!category) return;

  bracketTitleEl.innerHTML = `
    <strong>${escapeHtml(category.label)}</strong>
    <span>${escapeHtml(category.subtitle)}</span>
  `;
}

function renderCategorySummary() {
  const category = getCurrentCategory();
  if (!category) return;

  const currentRound = getCurrentRoundIndex(state.runtime?.data || []);
  const roundLabels = getRoundLabels();
  const label =
    currentRound === -1 ? "Selesai" : roundLabels[currentRound] || `Round ${currentRound + 1}`;
  const liveMatch = getLiveMatch();
  const nextCount = getScheduleItems().filter((item) => item.status.key === "upcoming").length;

  categorySummary.innerHTML = `
    <strong>${escapeHtml(category.label)}</strong>
    <div class="note" style="margin-bottom:8px">${escapeHtml(category.subtitle)}</div>
    <div class="summary-row">
      <span class="summary-pill">Round aktif: ${escapeHtml(label)}</span>
      <span class="summary-pill">${
        liveMatch
          ? `Live: ${escapeHtml(liveMatch.game[0].name)} vs ${escapeHtml(liveMatch.game[1].name)}`
          : "Belum ada match live"
      }</span>
      <span class="summary-pill">Akan datang: ${nextCount}</span>
    </div>
  `;
}

function renderLoginMeta() {
  if (!state.session?.user) {
    loginMetaEl.textContent =
      "Belum login. Masuk dengan Google dulu agar bisa vote dan beli credit.";
    return;
  }

  const email = state.user?.email || state.session.user.email || "-";
  const credits = Number(state.user?.creditBalance || 0);
  loginMetaEl.innerHTML = `
    Login Google: <span class="mono">${escapeHtml(email)}</span><br>
    Credit vote berbayar: <span class="mono">${credits}</span>
  `;
}

function renderAuthControls() {
  const isLoggedIn = Boolean(state.session?.user);

  if (loginBox) {
    loginBox.hidden = isLoggedIn;
  }

  if (logoutWrap) {
    logoutWrap.hidden = !isLoggedIn;
  }

  if (logoutBtn) {
    logoutBtn.hidden = !isLoggedIn;
  }

  if (refreshWrap) {
    refreshWrap.hidden = true;
  }

  if (refreshBtn) {
    refreshBtn.hidden = true;
  }
}

function renderStatus() {
  const blocks = [];

  if (state.flashHtml) {
    blocks.push(`<div class="note" style="margin-bottom:8px">${state.flashHtml}</div>`);
  }

  if (!state.session?.user) {
    blocks.push(
      "Login Google dulu untuk vote. Setiap match memberi <span class=\"mono\">1 vote gratis</span> per akun, lalu sisanya memakai credit berbayar."
    );
    statusEl.innerHTML = blocks.join("");
    return;
  }

  const creditBalance = Number(state.user?.creditBalance || 0);
  const email = state.user?.email || state.session.user.email || "-";

  blocks.push(`
    Akun aktif: <span class="mono">${escapeHtml(email)}</span>.<br>
    Jatah gratis: <span class="mono">1x per match</span>.<br>
    Credit berbayar tersedia: <span class="mono">${creditBalance}</span>.
  `);

  statusEl.innerHTML = blocks.join("");
}

function createBracket() {
  if (!state.runtime) return;

  if (state.bracket) {
    state.bracket.destroy();
  }

  state.bracket = new Gracket("#bracket", {
    src: cloneData(state.runtime.data),
    byeLabel: "BYE",
    roundLabels: getRoundLabels(),
    cornerRadius: 8,
    canvasLineColor: "rgba(200, 210, 230, 0.55)",
    canvasLineWidth: 2
  });

  setTimeout(decorateBracketTeams, 0);
}

function decorateBracketTeams() {
  const category = getCurrentCategory();
  if (!category) return;

  bracketContainer.querySelectorAll(".g_team-name").forEach((element) => {
    const rawName =
      element.getAttribute("data-team-name") || String(element.textContent || "").trim();
    const team = category.teams.find((item) => item.name === rawName);

    if (!team) return;

    element.setAttribute("data-team-name", team.name);
    element.innerHTML = `
      <span class="bracket-team-decor">
        <img
          class="bracket-avatar"
          src="${escapeHtml(getAvatarUrl(team))}"
          data-fallback-src="${escapeHtml(getFallbackAvatarUrl(team))}"
          alt="${escapeHtml(team.name)}"
        />
        <span>${escapeHtml(team.name)}</span>
      </span>
    `;
  });

  attachImageFallbacks(bracketContainer);
}

function renderScheduleStrip() {
  const items = getScheduleItems();
  const roundLabels = getRoundLabels();

  if (!items.length) {
    scheduleStrip.innerHTML =
      '<div class="schedule-card"><div class="schedule-time">Belum ada pertandingan live atau upcoming.</div></div>';
    return;
  }

  scheduleStrip.innerHTML = "";

  items.forEach((item) => {
    const countdownLabel =
      item.status.key === "live"
        ? `Sisa waktu ${formatCountdown(item.schedule.end.getTime() - Date.now())}`
        : `Mulai ${formatDateTime(item.schedule.start)}`;
    const card = document.createElement("div");
    card.className = `schedule-card ${item.status.key === "live" ? "live" : ""}`;
    card.dataset.round = String(item.roundIndex);
    card.dataset.game = String(item.gameIndex);
    card.innerHTML = `
      <div class="schedule-top">
        <div class="schedule-title">${escapeHtml(
          roundLabels[item.roundIndex] || `Round ${item.roundIndex + 1}`
        )}</div>
        <div class="match-state ${item.status.key}">${
          item.status.key === "live" ? "Live" : "Soon"
        }</div>
      </div>
      <div class="schedule-match">${escapeHtml(item.game[0].name)} vs ${escapeHtml(
        item.game[1].name
      )}</div>
      <div class="schedule-time">${formatDateTime(item.schedule.start)}</div>
      <div class="schedule-time">${escapeHtml(countdownLabel)}</div>
    `;
    scheduleStrip.appendChild(card);
  });
}

function openModal() {
  modalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  if (state.modalCountdownInterval) {
    clearInterval(state.modalCountdownInterval);
    state.modalCountdownInterval = null;
  }

  modalBackdrop.hidden = true;
  document.body.style.overflow = "";
  modalBody.innerHTML = "";
}

function getTeamNameFromClick(target) {
  const category = getCurrentCategory();
  if (!category) return "";

  const allNames = category.teams.map((team) => team.name);
  let current = target;

  for (let hop = 0; hop < 6 && current; hop += 1) {
    const text = String(current.textContent || "").toUpperCase();
    const matchedName = allNames.find((name) => text.includes(name.toUpperCase()));

    if (matchedName) {
      return matchedName;
    }

    current = current.parentElement;
  }

  return "";
}

function getBracketLabelFromClick(target) {
  let current = target;

  for (let hop = 0; hop < 6 && current; hop += 1) {
    const text = String(current.textContent || "").trim();
    if (text) return text.toUpperCase();
    current = current.parentElement;
  }

  return "";
}

function findMatchByTeamName(round, teamName) {
  if (!teamName) return null;

  for (let gameIndex = 0; gameIndex < round.length; gameIndex += 1) {
    const game = round[gameIndex];
    if (!game || game.length !== 2) continue;

    const teamIndex = game.findIndex(
      (team) => String(team?.name || "").toUpperCase() === teamName.toUpperCase()
    );

    if (teamIndex !== -1) {
      return { gameIndex, teamIndex };
    }
  }

  return null;
}

async function fetchPublicConfig() {
  const response = await fetch("/api/public-config", {
    headers: {
      Accept: "application/json"
    }
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message || "Gagal memuat config publik.");
  }

  return payload;
}

async function getAccessToken() {
  if (!state.supabase) return "";
  const {
    data: { session }
  } = await state.supabase.auth.getSession();
  state.session = session;
  return session?.access_token || "";
}

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  let body = options.body;
  if (body && typeof body === "object" && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  const accessToken = await getAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    body
  });

  const payload = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    data: payload
  };
}

async function loadState(categoryId = state.activeCategoryId) {
  state.isLoading = true;

  try {
    const result = await apiFetch(`/api/state?category=${encodeURIComponent(categoryId)}`);

    if (!result.ok) {
      throw new Error(result.data?.message || "Gagal memuat state.");
    }

    state.categories = Array.isArray(result.data.categories) ? result.data.categories : [];
    state.activeCategoryId = result.data.activeCategoryId || categoryId;
    localStorage.setItem(STORAGE_CATEGORY_KEY, state.activeCategoryId);
    state.totals = result.data.totals || {};
    state.user = result.data.user || null;
    rebuildRuntime();
    renderAll();
  } finally {
    state.isLoading = false;
  }
}

function renderAll() {
  renderCategoryBadges();
  renderBracketTitle();
  createBracket();
  renderCategorySummary();
  renderScheduleStrip();
  renderAuthControls();
  renderLoginMeta();
  renderStatus();
}

function attachImageFallbacks(container = document) {
  container.querySelectorAll("img[data-fallback-src]").forEach((image) => {
    if (image.dataset.fallbackBound === "true") return;

    image.dataset.fallbackBound = "true";
    image.addEventListener("error", () => {
      const fallbackSrc = image.getAttribute("data-fallback-src") || "";
      if (!fallbackSrc || image.getAttribute("src") === fallbackSrc) return;
      image.setAttribute("src", fallbackSrc);
    });
  });
}

async function signInWithGoogle() {
  if (!state.supabase) return;

  await state.supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}${window.location.pathname}`
    }
  });
}

function renderLoginModal(intent) {
  if (intent) {
    savePendingIntent(intent);
  }

  modalTitle.textContent = "Login Google";
  modalBody.innerHTML = `
    <p class="modal-sub">Untuk vote, setiap user wajib login melalui Google redirect dulu.</p>
    <div class="vs-card">
      <div class="vs-team">Google Account</div>
      <div class="note">Setelah login sukses, Anda akan kembali ke halaman ini.</div>
    </div>
    <div class="modal-actions">
      <button id="modal-google-login" class="primary-btn" type="button">Masuk dengan Google</button>
      <button id="modal-login-cancel" class="primary-btn danger-btn" type="button">Batal</button>
    </div>
  `;
  openModal();

  document.getElementById("modal-google-login").addEventListener("click", async () => {
    await signInWithGoogle();
  });
  document.getElementById("modal-login-cancel").addEventListener("click", closeModal);
}

function renderPaymentModal({ voteIntent, paymentRequired }) {
  modalTitle.textContent = "Beli Credit Vote";

  const missingCredits = Number(paymentRequired.missingCredits || 0);
  const priceIdr = Number(state.config?.pricePerCreditIdr || 2000) * missingCredits;

  modalBody.innerHTML = `
    <p class="modal-sub">
      Vote gratis untuk match ini sudah habis. Anda butuh
      <span class="mono">${missingCredits}</span> credit tambahan.
    </p>
    <div class="pay-grid">
      <button class="pay-card" data-pay="qris" type="button">
        <strong>QRIS</strong>
        <span>Via Midtrans redirect</span>
        <span class="note">Perkiraan Rp ${priceIdr.toLocaleString("id-ID")}</span>
      </button>
      <button class="pay-card" data-pay="paypal" type="button">
        <strong>PayPal</strong>
        <span>Redirect ke checkout PayPal</span>
        <span class="note">Nominal final mengikuti kurs/paypal quote</span>
      </button>
    </div>
    <p class="note">
      Free vote tersisa untuk match ini:
      <span class="mono">${Number(paymentRequired.freeVotesRemaining || 0)}</span>.<br>
      Credit saat ini: <span class="mono">${Number(paymentRequired.creditBalance || 0)}</span>.
    </p>
  `;
  openModal();

  modalBody.querySelectorAll("[data-pay]").forEach((button) => {
    button.addEventListener("click", async () => {
      const provider = button.getAttribute("data-pay");
      await startPayment(provider, missingCredits, voteIntent);
    });
  });
}

async function startPayment(provider, credits, voteIntent) {
  try {
    setFlashStatus("Membuat order pembayaran...");
    const result = await apiFetch("/api/payments/create", {
      method: "POST",
      body: {
        provider,
        credits,
        pendingVote: voteIntent
      }
    });

    if (!result.ok) {
      throw new Error(result.data?.message || "Gagal membuat pembayaran.");
    }

    savePendingPayment({
      voteIntent,
      paymentOrderId: result.data.paymentOrderId,
      provider
    });

    closeModal();

    const destination = result.data.approvalUrl || result.data.redirectUrl;
    if (!destination) {
      throw new Error("URL pembayaran tidak tersedia.");
    }

    window.location.href = destination;
  } catch (error) {
    setFlashStatus(error.message || "Gagal memulai pembayaran.");
  }
}

async function submitVote(voteIntent, { silent = false } = {}) {
  try {
    const result = await apiFetch("/api/vote", {
      method: "POST",
      body: {
        categoryId: voteIntent.categoryId,
        matchId: voteIntent.matchId,
        teamId: voteIntent.teamId,
        quantity: voteIntent.quantity
      }
    });

    if (result.ok) {
      state.totals = result.data.totals || state.totals;
      state.user = {
        ...(state.user || {}),
        ...(result.data.user || {}),
        usageByMatch: {
          ...(state.user?.usageByMatch || {}),
          ...(result.data.user?.usageByMatch || {})
        }
      };
      rebuildRuntime();
      renderAll();
      savePendingIntent(null);
      clearPendingPayment();
      if (!silent) {
        setFlashStatus(
          `Vote berhasil masuk untuk ${escapeHtml(voteIntent.teamName)} x${voteIntent.quantity}.`,
          true
        );
      }
      return;
    }

    if (result.status === 401) {
      renderLoginModal({
        type: "open-vote",
        roundIndex: voteIntent.roundIndex,
        gameIndex: voteIntent.gameIndex,
        preselectTeamIndex: voteIntent.teamIndex
      });
      return;
    }

    if (result.status === 402) {
      renderPaymentModal({
        voteIntent,
        paymentRequired: result.data
      });
      return;
    }

    throw new Error(result.data?.message || "Vote gagal diproses.");
  } catch (error) {
    setFlashStatus(error.message || "Gagal menyimpan vote.");
  }
}

function renderVoteResultState(match, matchStatus, matchId) {
  const usage = getUsageForMatch(matchId);
  const totalA = Number(match.rawTotals[teamKey(match.game[0])] || 0);
  const totalB = Number(match.rawTotals[teamKey(match.game[1])] || 0);

  modalBody.innerHTML = `
    <p class="modal-sub">Voting untuk pertandingan ini sudah ditutup.</p>
    <div class="vs">
      <div class="vs-card">
        <div class="vs-head">
          <img
            class="modal-avatar"
            src="${escapeHtml(getAvatarUrl(match.game[0]))}"
            data-fallback-src="${escapeHtml(getFallbackAvatarUrl(match.game[0]))}"
            alt="${escapeHtml(match.game[0].name)}"
          />
          <div class="vs-team">${escapeHtml(match.game[0].name)}</div>
        </div>
        <div class="vs-meta"><span>Total Vote</span><span>${totalA}</span></div>
      </div>
      <div class="vs-pill">VS</div>
      <div class="vs-card">
        <div class="vs-head">
          <img
            class="modal-avatar"
            src="${escapeHtml(getAvatarUrl(match.game[1]))}"
            data-fallback-src="${escapeHtml(getFallbackAvatarUrl(match.game[1]))}"
            alt="${escapeHtml(match.game[1].name)}"
          />
          <div class="vs-team">${escapeHtml(match.game[1].name)}</div>
        </div>
        <div class="vs-meta"><span>Total Vote</span><span>${totalB}</span></div>
      </div>
    </div>
    <div class="note">Jadwal: ${formatDateTime(match.schedule.start)} - ${formatDateTime(
      match.schedule.end
    )}</div>
    <div class="note" style="margin-top:4px">Status: ${escapeHtml(matchStatus.label)}</div>
    <div class="note" style="margin-top:8px">
      Free vote kamu di match ini:
      <span class="mono">${usage.freeVotesRemaining}</span> tersisa.
    </div>
  `;

  attachImageFallbacks(modalBody);
}

function renderVoteModal({ roundIndex, gameIndex, preselectTeamIndex = null }) {
  if (!state.session?.user) {
    renderLoginModal({
      type: "open-vote",
      roundIndex,
      gameIndex,
      preselectTeamIndex
    });
    return;
  }

  const match = getRuntimeMatch(roundIndex, gameIndex);
  if (!match || !hasResolvedTeams(getCurrentCategory(), match.game)) {
    setFlashStatus("Match ini belum punya dua tim pasti.");
    return;
  }

  const matchId = getMatchId(state.activeCategoryId, roundIndex, gameIndex, match.game);
  const matchStatus = getMatchStatus(state.runtime.scheduleMap, roundIndex, gameIndex);
  const totalA = Number(match.rawTotals[teamKey(match.game[0])] || 0);
  const totalB = Number(match.rawTotals[teamKey(match.game[1])] || 0);
  const usage = getUsageForMatch(matchId);
  const creditBalance = Number(state.user?.creditBalance || 0);

  modalTitle.textContent = "Vote Match";

  if (matchStatus.key === "closed") {
    renderVoteResultState(match, matchStatus, matchId);
    openModal();
    return;
  }

  modalBody.innerHTML = `
    <p class="modal-sub">${
      matchStatus.key === "live"
        ? "Voting sedang dibuka untuk pertandingan ini."
        : "Match ini akan segera dimulai. Anda sudah bisa kirim vote dari sekarang."
    }</p>
    <div class="vs">
      <div class="vs-card">
        <div class="vs-head">
          <img
            class="modal-avatar"
            src="${escapeHtml(getAvatarUrl(match.game[0]))}"
            data-fallback-src="${escapeHtml(getFallbackAvatarUrl(match.game[0]))}"
            alt="${escapeHtml(match.game[0].name)}"
          />
          <div class="vs-team">${escapeHtml(match.game[0].name)}</div>
        </div>
        <div class="vs-meta"><span>Total Vote</span><span>${totalA}</span></div>
      </div>
      <div class="vs-pill">VS</div>
      <div class="vs-card">
        <div class="vs-head">
          <img
            class="modal-avatar"
            src="${escapeHtml(getAvatarUrl(match.game[1]))}"
            data-fallback-src="${escapeHtml(getFallbackAvatarUrl(match.game[1]))}"
            alt="${escapeHtml(match.game[1].name)}"
          />
          <div class="vs-team">${escapeHtml(match.game[1].name)}</div>
        </div>
        <div class="vs-meta"><span>Total Vote</span><span>${totalB}</span></div>
      </div>
    </div>
    <div class="note">Jadwal: ${formatDateTime(match.schedule.start)} - ${formatDateTime(
      match.schedule.end
    )}</div>
    <div id="modal-countdown" class="note" style="margin-top:4px"></div>
    <div id="modal-vote-actions" class="modal-actions">
      <div class="vs-card">
        <div class="vs-head">
          <img
            class="modal-avatar"
            src="${escapeHtml(getAvatarUrl(match.game[0]))}"
            data-fallback-src="${escapeHtml(getFallbackAvatarUrl(match.game[0]))}"
            alt="${escapeHtml(match.game[0].name)}"
          />
          <div class="vs-team">${escapeHtml(match.game[0].name)}</div>
        </div>
        <input
          id="vote-amount-0"
          class="modal-input mono"
          type="number"
          min="1"
          step="1"
          value="${preselectTeamIndex === 0 ? 1 : 1}"
          placeholder="jumlah vote"
        />
        <div class="note" style="margin-top:8px">Setiap match punya 1 vote gratis per akun. Sisanya pakai credit.</div>
        <button class="primary-btn" data-vote-team="0" type="button" style="margin-top:10px">Vote ${
          escapeHtml(match.game[0].name)
        }</button>
      </div>
      <div class="vs-card">
        <div class="vs-head">
          <img
            class="modal-avatar"
            src="${escapeHtml(getAvatarUrl(match.game[1]))}"
            data-fallback-src="${escapeHtml(getFallbackAvatarUrl(match.game[1]))}"
            alt="${escapeHtml(match.game[1].name)}"
          />
          <div class="vs-team">${escapeHtml(match.game[1].name)}</div>
        </div>
        <input
          id="vote-amount-1"
          class="modal-input mono"
          type="number"
          min="1"
          step="1"
          value="${preselectTeamIndex === 1 ? 1 : 1}"
          placeholder="jumlah vote"
        />
        <div class="note" style="margin-top:8px">Input hanya angka positif.</div>
        <button class="primary-btn danger-btn" data-vote-team="1" type="button" style="margin-top:10px">Vote ${
          escapeHtml(match.game[1].name)
        }</button>
      </div>
    </div>
    <p class="note" id="modal-premium-note">
      Free vote match ini tersisa: <span class="mono">${usage.freeVotesRemaining}</span>.
      Credit tersedia: <span class="mono">${creditBalance}</span>.
    </p>
  `;
  openModal();
  attachImageFallbacks(modalBody);

  const countdownEl = document.getElementById("modal-countdown");
  const updateCountdown = () => {
    const latestStatus = getMatchStatus(state.runtime.scheduleMap, roundIndex, gameIndex);
    if (!countdownEl) return;

    if (latestStatus.key === "live") {
      countdownEl.textContent = `Sisa waktu ${formatCountdown(
        match.schedule.end.getTime() - Date.now()
      )}`;
      return;
    }

    countdownEl.textContent = `Mulai ${formatDateTime(match.schedule.start)}`;
  };

  updateCountdown();
  state.modalCountdownInterval = setInterval(updateCountdown, 1000);

  const sanitizeInput = (input) => {
    const clean = String(input.value || "").replace(/[^\d]/g, "");
    input.value = clean ? String(Math.max(1, Number(clean))) : "1";
  };

  [0, 1].forEach((teamIndex) => {
    const input = document.getElementById(`vote-amount-${teamIndex}`);
    input.addEventListener("input", () => sanitizeInput(input));
    input.addEventListener("keydown", (event) => {
      if (["e", "E", "+", "-", "."].includes(event.key)) {
        event.preventDefault();
      }
    });
  });

  modalBody.querySelectorAll("[data-vote-team]").forEach((button) => {
    button.addEventListener("click", async () => {
      const teamIndex = Number(button.getAttribute("data-vote-team"));
      const input = document.getElementById(`vote-amount-${teamIndex}`);
      sanitizeInput(input);
      const quantity = Math.max(1, Math.floor(Number(input.value || 0) || 0));

      closeModal();
      await submitVote({
        categoryId: state.activeCategoryId,
        matchId,
        roundIndex,
        gameIndex,
        teamIndex,
        teamId: teamKey(match.game[teamIndex]),
        teamName: match.game[teamIndex].name,
        quantity
      });
    });
  });
}

async function switchCategory(categoryId) {
  if (!categoryId || (categoryId === state.activeCategoryId && state.isLoading)) return;
  try {
    state.activeCategoryId = categoryId;
    localStorage.setItem(STORAGE_CATEGORY_KEY, categoryId);
    await loadState(categoryId);
  } catch (error) {
    setFlashStatus(error.message || "Gagal pindah kategori.");
  }
}

async function refreshState() {
  try {
    await loadState(state.activeCategoryId);
    setFlashStatus("Data berhasil disinkronkan ulang.");
  } catch (error) {
    setFlashStatus(error.message || "Gagal menyinkronkan data.");
  }
}

function clearUrlPaymentState() {
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

async function resumePendingIntentIfAny() {
  const intent = loadPendingIntent();

  if (!intent || !state.session?.user) {
    return;
  }

  if (intent.type === "open-vote") {
    savePendingIntent(null);
    renderVoteModal({
      roundIndex: intent.roundIndex,
      gameIndex: intent.gameIndex,
      preselectTeamIndex: intent.preselectTeamIndex ?? null
    });
  }
}

async function resumePaymentIfNeeded() {
  if (state.isResumingPayment || !state.session?.user) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const pendingPayment = loadPendingPayment();
  const paymentOrderId =
    params.get("payment_order_id") || pendingPayment?.paymentOrderId || "";

  if (!paymentOrderId) {
    return;
  }

  state.isResumingPayment = true;

  try {
    const result = await apiFetch(`/api/payments/status?id=${encodeURIComponent(paymentOrderId)}`);

    if (!result.ok) {
      throw new Error(result.data?.message || "Gagal memeriksa pembayaran.");
    }

    if (result.data.status === "paid") {
      await loadState(state.activeCategoryId);

      if (pendingPayment?.voteIntent) {
        await submitVote(pendingPayment.voteIntent, { silent: true });
      }

      clearPendingPayment();
      clearUrlPaymentState();
      setFlashStatus("Pembayaran sukses. Credit sudah masuk dan vote sudah diproses.");
      return;
    }

    if (result.data.status === "pending") {
      setFlashStatus(
        "Pembayaran masih menunggu konfirmasi. Kalau sudah selesai bayar, refresh halaman ini."
      );
      return;
    }

    if (params.get("payment")?.includes("cancel")) {
      clearPendingPayment();
      clearUrlPaymentState();
      setFlashStatus("Pembayaran dibatalkan.");
      return;
    }

    if (params.get("payment")?.includes("error")) {
      clearPendingPayment();
      clearUrlPaymentState();
      setFlashStatus(
        params.get("message") || "Pembayaran gagal diproses. Silakan coba lagi."
      );
    }
  } catch (error) {
    setFlashStatus(error.message || "Gagal melanjutkan pembayaran.");
  } finally {
    state.isResumingPayment = false;
  }
}

async function init() {
  try {
    state.config = await fetchPublicConfig();
    state.supabase = createClient(state.config.supabaseUrl, state.config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    const {
      data: { session }
    } = await state.supabase.auth.getSession();
    state.session = session;

    state.supabase.auth.onAuthStateChange(async (_event, sessionValue) => {
      try {
        state.session = sessionValue;
        await loadState(state.activeCategoryId);
        await resumePendingIntentIfAny();
        await resumePaymentIfNeeded();
      } catch (error) {
        setFlashStatus(error.message || "Gagal memperbarui sesi login.");
      }
    });

    await loadState(state.activeCategoryId);
    await resumePendingIntentIfAny();
    await resumePaymentIfNeeded();

    setInterval(() => {
      renderScheduleStrip();
    }, 1000);
  } catch (error) {
    setFlashStatus(error.message || "Aplikasi gagal diinisialisasi.");
  }
}

scheduleStrip.addEventListener("click", (event) => {
  const card = event.target.closest(".schedule-card");
  if (!card) return;

  const roundIndex = Number(card.dataset.round);
  const gameIndex = Number(card.dataset.game);

  if (!Number.isFinite(roundIndex) || !Number.isFinite(gameIndex)) return;

  renderVoteModal({
    roundIndex,
    gameIndex
  });
});

bracketContainer.addEventListener("click", (event) => {
  if (!state.runtime) return;

  const teamCard = event.target.closest(".g_team");
  if (!teamCard) return;

  const nameEl = teamCard.querySelector(".g_team-name");
  const teamName = String(
    nameEl?.getAttribute("data-team-name") ||
      nameEl?.textContent ||
      getTeamNameFromClick(event.target)
  ).trim();

  if (!teamName) {
    const label = getBracketLabelFromClick(event.target);
    if (/WINNER|CHAMPION|BYE/.test(label)) {
      setFlashStatus("Bagian bracket itu belum bisa diklik karena timnya belum masuk.");
    }
    return;
  }

  const currentRound = getCurrentRoundIndex(state.runtime.data || []);
  if (currentRound === -1) return;

  const round = state.runtime.data[currentRound] || [];
  const match = findMatchByTeamName(round, teamName);
  if (!match) return;

  renderVoteModal({
    roundIndex: currentRound,
    gameIndex: match.gameIndex,
    preselectTeamIndex: match.teamIndex
  });
});

loginBtn.addEventListener("click", async () => {
  await signInWithGoogle();
});

logoutBtn.addEventListener("click", async () => {
  if (!state.supabase) return;
  await state.supabase.auth.signOut();
  savePendingIntent(null);
  clearPendingPayment();
  clearFlashStatus();
  await loadState(state.activeCategoryId);
});

refreshBtn?.addEventListener("click", async () => {
  await refreshState();
});

document.getElementById("modal-close").addEventListener("click", closeModal);

modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) {
    closeModal();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modalBackdrop.hidden) {
    closeModal();
  }
});

init();
