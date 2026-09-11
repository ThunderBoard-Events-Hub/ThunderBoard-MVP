// main.js — everything the frontend needs: API calls, view routing, and rendering.
// Previously split into api.js / router.js / app.js — combined here into one file.

// ============================================================
// SECTION 0: AUTH — Auth0 SPA SDK wrapper
// ============================================================
// Organizations have no password of their own — Auth0 is the only way to
// authenticate as one (see backend/API_CONTRACT.md#auth). Domain/audience
// match the backend's AUTH0_DOMAIN / AUTH0_AUDIENCE app settings; the client
// ID is the same one used by auth0-poc/ against this tenant.
// NOTE: if that POC client isn't meant to back production, swap in a
// dedicated Auth0 application's client ID here, and make sure this site's
// origin is added to that application's Allowed Callback/Logout/Web Origin URLs.

const AUTH0_DOMAIN = 'annhasna.ca.auth0.com';
const AUTH0_CLIENT_ID = 'Q4GaBMfYcHlcE3zOpn4LzkKdpKlKHPDE';
const AUTH0_AUDIENCE = 'https://thunderboard-api';

const Auth = (() => {
  let client = null;

  async function init() {
    client = await auth0.createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT_ID,
      authorizationParams: {
        redirect_uri: `${location.origin}${location.pathname}`,
        audience: AUTH0_AUDIENCE,
      },
    });

    if (location.search.includes('code=') && location.search.includes('state=')) {
      try {
        await client.handleRedirectCallback();
      } catch (err) {
        console.error('Auth0 redirect callback failed:', err);
      }
      history.replaceState({}, '', location.pathname);
    }

    return client.isAuthenticated();
  }

  function login(screenHint) {
    return client.loginWithRedirect(
      screenHint ? { authorizationParams: { screen_hint: screenHint } } : undefined
    );
  }

  function logout() {
    return client.logout({ logoutParams: { returnTo: `${location.origin}${location.pathname}` } });
  }

  const getUser = () => client.getUser();
  const isLoggedIn = () => client.isAuthenticated();

  async function getToken() {
    try {
      return await client.getTokenSilently();
    } catch (err) {
      console.error('Failed to get Auth0 access token:', err);
      return null;
    }
  }

  return { init, login, logout, getUser, getToken, isLoggedIn };
})();


// ============================================================
// SECTION 1: API — thin fetch wrapper around the backend
// ============================================================
// NOTE: the backend's CORS only allows requests from whatever FRONTEND_URL
// is set to on the App Service (or http://localhost:5173 in dev) — make sure
// that matches wherever this frontend is actually served from.

const API_BASE = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  ? 'http://localhost:8000/api'
  : 'https://thunderboard-api.azurewebsites.net/api';

async function request(path, options = {}) {
  const { auth, headers, ...rest } = options;
  const finalHeaders = { 'Content-Type': 'application/json', ...(headers || {}) };
  if (auth) {
    const token = await Auth.getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers: finalHeaders });

  // The contract guarantees every non-2xx response is { error: "..." }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      /* ignore non-JSON error bodies */
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

const Api = {
  // Events
  getEvents: () => request('/events'),
  getEvent: (id) => request(`/events/${id}`),
  searchEvents: (title) => request(`/events/search?title=${encodeURIComponent(title)}`),
  getEventsByTags: (tagIds) => request(`/events/tags?tag_ids=${tagIds.join(',')}`),
  getEventsByOrganizer: (organizerId) => request(`/events/organizer/${organizerId}`),
  getEventTags: (eventId) => request(`/events/${eventId}/tags`),

  // Organizations
  getOrganizations: () => request('/organizations'),
  getOrganization: (id) => request(`/organizations/${id}`),
  searchOrganizations: (name) => request(`/organizations/search?name=${encodeURIComponent(name)}`),
  followOrganization: (id) => request(`/organizations/${id}/follow`, { method: 'POST' }),
  unfollowOrganization: (id) => request(`/organizations/${id}/unfollow`, { method: 'POST' }),
  getMyOrganization: () => request('/organizations/me', { auth: true }),
  createOrganization: (data) => request('/organizations', { method: 'POST', body: JSON.stringify(data), auth: true }),

  // Tags
  getTags: () => request('/tags'),

  // Admin
  isAdmin: () => request('/admin/me', { auth: true }),
};


// ============================================================
// SECTION 2: ROUTER — view switching + navigation wiring
// ============================================================
// Every <section class="view" data-view="..."> is `display:none` until it gets
// the `.active` class (see style.css line ~386). Nothing was ever adding that
// class, so the whole page rendered blank. This file fixes that.

const Router = (() => {
  let currentView = 'welcome';

  function showView(name) {
    document.querySelectorAll('.view').forEach((el) => {
      el.classList.toggle('active', el.dataset.view === name);
    });
    currentView = name;
    closeNav();
    // Let app.js know a view became visible, in case it needs to (re)fetch data.
    document.dispatchEvent(new CustomEvent('view:show', { detail: { name } }));
  }

  function getCurrentView() {
    return currentView;
  }

  // ---- Nav drawer (hamburger menu) ----
  function openNav() {
    document.getElementById('navBackdrop')?.classList.add('active');
    document.getElementById('navDrawer')?.classList.add('active');
  }

  function closeNav() {
    document.getElementById('navBackdrop')?.classList.remove('active');
    document.getElementById('navDrawer')?.classList.remove('active');
  }

  // ---- Create-account variant (only "club" exists — guests never register) ----
  function showAccountVariant(variant) {
    document.querySelectorAll('[data-account-variant]').forEach((el) => {
      el.classList.toggle('active', el.dataset.accountVariant === variant);
    });
  }

  function init() {
    // Any element with data-go-to="viewName" navigates there.
    document.body.addEventListener('click', (e) => {
      // "Continue as guest" — no registration, straight into the app.
      if (e.target.closest('#continueAsGuestBtn')) {
        document.body.dataset.role = 'guest';
        document.querySelectorAll('[data-role-only]').forEach((el) => {
          el.style.display = el.dataset.roleOnly === 'guest' ? '' : 'none';
        });
        showView('guest-profile');
        return;
      }

      if (e.target.closest('#loginBtn')) {
        Auth.login();
        return;
      }

      if (e.target.closest('#signupStartBtn')) {
        Auth.login('signup');
        return;
      }

      if (e.target.closest('#logoutBtn')) {
        Auth.isLoggedIn().then((loggedIn) => (loggedIn ? Auth.logout() : showView('welcome')));
        return;
      }

      const goTo = e.target.closest('[data-go-to]');
      if (goTo) {
        showView(goTo.dataset.goTo);
        return;
      }

      const chooseType = e.target.closest('[data-choose-type]');
      if (chooseType) {
        showAccountVariant(chooseType.dataset.chooseType);
        showView('create-account');
        return;
      }

      if (e.target.closest('[data-open-nav]')) {
        openNav();
        return;
      }

      if (e.target.closest('#navBackdrop')) {
        closeNav();
        return;
      }

      if (e.target.closest('[data-go-to-login]')) {
        showView('login');
        return;
      }

      if (e.target.closest('#goToSignup')) {
        showView('create-account');
        return;
      }

      // Password show/hide toggles
      const pwToggle = e.target.closest('.toggle-password');
      if (pwToggle) {
        const input = document.getElementById(pwToggle.dataset.target);
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
          pwToggle.classList.toggle('revealed');
        }
        return;
      }

      // Tab pills: club-profile (current/past events), guest-profile (saved/following)
      const eventsTab = e.target.closest('[data-events-tab]');
      if (eventsTab) {
        document.querySelectorAll('[data-events-tab]').forEach((btn) =>
          btn.classList.toggle('active', btn === eventsTab)
        );
        document.dispatchEvent(
          new CustomEvent('tab:events', { detail: { tab: eventsTab.dataset.eventsTab } })
        );
        return;
      }

      const guestTab = e.target.closest('[data-guest-tab]');
      if (guestTab) {
        document.querySelectorAll('[data-guest-tab]').forEach((btn) =>
          btn.classList.toggle('active', btn === guestTab)
        );
        const showSaved = guestTab.dataset.guestTab === 'saved';
        const savedPanel = document.getElementById('savedEventsPanel');
        const followingPanel = document.getElementById('followingPanel');
        if (savedPanel) savedPanel.style.display = showSaved ? '' : 'none';
        if (followingPanel) followingPanel.style.display = showSaved ? 'none' : '';
        return;
      }

      const searchTab = e.target.closest('[data-search-tab]');
      if (searchTab) {
        document.querySelectorAll('[data-search-tab]').forEach((btn) =>
          btn.classList.toggle('active', btn === searchTab)
        );
        document.dispatchEvent(
          new CustomEvent('tab:search', { detail: { tab: searchTab.dataset.searchTab } })
        );
        return;
      }

      // Demo-only admin/guest role toggle on club-profile
      if (e.target.closest('#roleDemoToggle')) {
        const isAdmin = document.body.dataset.role !== 'admin';
        document.body.dataset.role = isAdmin ? 'admin' : 'guest';
        document.querySelectorAll('[data-role-only]').forEach((el) => {
          el.style.display = el.dataset.roleOnly === document.body.dataset.role ? '' : 'none';
        });
        return;
      }

      // Opening an event card -> event-detail view
      const eventCard = e.target.closest('[data-open-event]');
      if (eventCard) {
        document.dispatchEvent(new CustomEvent('event:open', { detail: { el: eventCard } }));
        showView('event-detail');
        return;
      }

      // Carousel arrows
      const arrow = e.target.closest('[data-scroll]');
      if (arrow) {
        const trackId = arrow.dataset.scrollTarget;
        const track = trackId ? document.getElementById(trackId) : arrow.closest('.event-carousel')?.querySelector('.carousel-track');
        if (track) track.scrollBy({ left: Number(arrow.dataset.scroll) * 240, behavior: 'smooth' });
        return;
      }
    });

    // Default role for demo
    document.body.dataset.role = 'admin';
    document.querySelectorAll('[data-role-only]').forEach((el) => {
      el.style.display = el.dataset.roleOnly === 'admin' ? '' : 'none';
    });

    showView('welcome');
  }

  return { init, showView, getCurrentView, showAccountVariant };
})();


// ============================================================
// SECTION 3: APP — fetches real data and renders it into the DOM
// ============================================================
// Loads Api (api.js) and Router (router.js), which must be included first.

const state = {
  organizations: [],
  events: [],
  demoOrgId: null, // which org's profile we're showing on the club-profile view
};

const FOLLOWED_KEY = 'thunderboard:followed'; // backend doesn't track "who" follows, see API_CONTRACT

function getFollowedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FOLLOWED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function setFollowed(id, isFollowed) {
  const ids = getFollowedIds();
  isFollowed ? ids.add(id) : ids.delete(id);
  localStorage.setItem(FOLLOWED_KEY, JSON.stringify([...ids]));
}

function fmtDate(dateStr, startTime, endTime) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  const dateLabel = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  if (!startTime) return dateLabel;
  const time = startTime.slice(0, 5) + (endTime ? `\u2013${endTime.slice(0, 5)}` : '');
  return `${dateLabel}, ${time}`;
}

function renderEventThumb(ev) {
  const btn = document.createElement('button');
  btn.className = 'event-thumb';
  btn.type = 'button';
  btn.setAttribute('data-open-event', '');
  btn.dataset.eventId = ev.id;
  btn.innerHTML = `
    <div class="event-thumb-image" style="${ev.image_url ? `background-image:url('${ev.image_url}')` : ''}"></div>
    <div class="event-thumb-info">
      <p class="ev-title"></p>
      <p class="ev-meta"></p>
    </div>`;
  btn.querySelector('.ev-title').textContent = ev.title;
  btn.querySelector('.ev-meta').textContent = `${fmtDate(ev.start_date, ev.start_time, ev.end_time)} \u2022 ${ev.location || 'TBA'}`;
  return btn;
}

function renderEventList(trackEl, events) {
  if (!trackEl) return;
  trackEl.innerHTML = '';
  if (events.length === 0) {
    trackEl.innerHTML = '<p style="opacity:.6;padding:8px;">No events yet.</p>';
    return;
  }
  events.forEach((ev) => trackEl.appendChild(renderEventThumb(ev)));
}

async function loadClubProfile() {
  try {
    state.organizations = await Api.getOrganizations();
    if (state.organizations.length === 0) {
      document.querySelector('[data-view="club-profile"] .profile-bio').textContent =
        'No approved organizations yet — nothing to show here.';
      return;
    }

    const org = state.organizations[0];
    state.demoOrgId = org.id;

    document.querySelector('[data-view="club-profile"] h1').textContent = org.name;
    document.querySelector('[data-view="club-profile"] .profile-bio').textContent =
      org.description || 'No description yet.';

    const followers = getFollowedIds();
    const label = document.getElementById('followBtnLabel');
    if (label) label.textContent = followers.has(org.id) ? 'Following' : 'Follow';

    state.events = await Api.getEventsByOrganizer(org.id);
    renderEventList(document.getElementById('eventsTrack'), state.events.filter((e) => e.status === 'published'));
  } catch (err) {
    console.error('Failed to load club profile from backend:', err);
    const track = document.getElementById('eventsTrack');
    if (track) track.innerHTML = `<p style="opacity:.6;padding:8px;">Couldn't reach the backend: ${err.message}</p>`;
  }
}

// Renders the signed-in org's own profile (from GET /organizations/me,
// which — unlike the public listing — also returns pending/rejected orgs).
function renderOwnOrgProfile(org) {
  document.body.dataset.role = 'admin';
  document.querySelectorAll('[data-role-only]').forEach((el) => {
    el.style.display = el.dataset.roleOnly === 'admin' ? '' : 'none';
  });

  state.demoOrgId = org.id;

  document.querySelector('[data-view="club-profile"] h1').textContent = org.name;

  const statusNote = {
    pending: ' — pending admin approval, not visible publicly yet.',
    rejected: ' — application was declined. Contact us for details.',
  }[org.approval_status] || '';
  document.querySelector('[data-view="club-profile"] .profile-bio').textContent =
    (org.description || 'No description yet.') + statusNote;

  // Posting events requires an approved org profile (see API_CONTRACT.md).
  const postBtn = document.getElementById('profileActionBtn');
  if (postBtn) postBtn.style.display = org.approval_status === 'approved' ? '' : 'none';

  Api.getEventsByOrganizer(org.id)
    .then((events) => {
      state.events = events;
      renderEventList(document.getElementById('eventsTrack'), events.filter((e) => e.status === 'published'));
    })
    .catch((err) => console.error('Failed to load events for own org:', err));
}

// Auth0 signup only creates the login identity — step 2 collects the actual
// org profile (name/description) needed for POST /api/organizations.
function showOrgSignupStep() {
  Router.showView('create-account');
  Router.showAccountVariant('club');
  document.querySelector('[data-signup-step="start"]').hidden = true;
  document.getElementById('signupFormClub').hidden = false;
}

function wireSignupForm() {
  const form = document.getElementById('signupFormClub');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const banner = form.parentElement.querySelector('.form-banner');
    if (banner) banner.textContent = '';
    try {
      const user = await Auth.getUser();
      const org = await Api.createOrganization({
        name: form.elements.name.value.trim(),
        email: user?.email,
        description: form.elements.description.value.trim() || undefined,
      });
      renderOwnOrgProfile(org);
      Router.showView('club-profile');
    } catch (err) {
      if (banner) banner.textContent = err.message;
    }
  });
}

async function initAuth() {
  let isAuthenticated = false;
  try {
    isAuthenticated = await Auth.init();
  } catch (err) {
    console.error('Auth0 init failed:', err);
    return;
  }
  if (!isAuthenticated) return;

  try {
    const org = await Api.getMyOrganization();
    renderOwnOrgProfile(org);
    Router.showView('club-profile');
  } catch (err) {
    if (err.status === 404) {
      showOrgSignupStep();
    } else {
      console.error('Failed to load own organization:', err);
    }
  }
}

async function loadFilterTags() {
  try {
    const tags = await Api.getTags();
    const chipGrid = document.getElementById('eventTypeChips');
    if (!chipGrid) return;
    chipGrid.innerHTML = '';
    tags.forEach((tag) => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.type = 'button';
      chip.setAttribute('data-chip', '');
      chip.dataset.tagId = tag.id;
      chip.textContent = tag.name;
      chipGrid.appendChild(chip);
    });
  } catch (err) {
    console.error('Failed to load tags from backend:', err);
  }
}

async function openEventDetail(eventId) {
  try {
    const [ev, tags] = await Promise.all([Api.getEvent(eventId), Api.getEventTags(eventId)]);
    document.getElementById('eventDetailTitle').textContent = ev.title;
    document.getElementById('eventDetailDate').textContent = fmtDate(ev.start_date);
    document.getElementById('eventDetailTime').textContent = ev.start_time
      ? `${ev.start_time.slice(0, 5)}${ev.end_time ? ` \u2013 ${ev.end_time.slice(0, 5)}` : ''}`
      : 'TBA';
    document.getElementById('eventDetailLocation').textContent = ev.location || 'TBA';
    document.getElementById('eventDetailDescription').textContent = ev.description || 'No description provided.';

    const tagsEl = document.getElementById('eventDetailTags');
    tagsEl.innerHTML = '';
    tags.forEach((t) => {
      const span = document.createElement('span');
      span.className = 'tag-pill';
      span.textContent = `#${t.name}`;
      tagsEl.appendChild(span);
    });
  } catch (err) {
    console.error('Failed to load event detail from backend:', err);
  }
}

function wireFollowButton() {
  const followBtn = document.getElementById('followBtn');
  if (!followBtn) return;
  followBtn.addEventListener('click', async () => {
    if (!state.demoOrgId) return;
    const label = document.getElementById('followBtnLabel');
    const alreadyFollowing = getFollowedIds().has(state.demoOrgId);
    try {
      if (alreadyFollowing) {
        await Api.unfollowOrganization(state.demoOrgId);
        setFollowed(state.demoOrgId, false);
        if (label) label.textContent = 'Follow';
      } else {
        await Api.followOrganization(state.demoOrgId);
        setFollowed(state.demoOrgId, true);
        if (label) label.textContent = 'Following';
      }
    } catch (err) {
      console.error('Follow/unfollow request failed:', err);
    }
  });
}

document.addEventListener('event:open', (e) => {
  const id = e.detail.el?.dataset?.eventId;
  if (id) openEventDetail(id);
});

// "Current events" / "Past events" tabs on the club profile
document.addEventListener('tab:events', (e) => {
  const today = new Date().toISOString().slice(0, 10);
  const filtered = state.events.filter((ev) =>
    e.detail.tab === 'past' ? ev.start_date < today : ev.start_date >= today
  );
  const label = document.getElementById('eventsSectionLabel');
  if (label) label.textContent = e.detail.tab === 'past' ? 'Past events' : 'Scheduled events';
  renderEventList(document.getElementById('eventsTrack'), filtered);
});

document.addEventListener('DOMContentLoaded', () => {
  Router.init();
  wireFollowButton();
  wireSignupForm();
  loadClubProfile();
  loadFilterTags();
  initAuth(); // runs last so a signed-in org's own profile overrides the public demo one above
});
