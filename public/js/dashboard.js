/**
 * Dashboard interactions and 2FA management
 */

let currentUser = null;

async function loadUser() {
  try {
    const res = await fetch('/api/user');
    if (!res.ok) { window.location.href = '/login'; return; }
    const data = await res.json();
    if (!data.success) { window.location.href = '/login'; return; }

    currentUser = data.user;

    // Set names
    const name = currentUser.username;
    document.getElementById('sidebarName').textContent = name;
    document.getElementById('sidebarAvatar').textContent = name.charAt(0).toUpperCase();
    document.getElementById('welcomeText').textContent = `Welcome back, ${name}!`;

    // Last login
    const lastLoginEl = document.getElementById('lastLoginStat');
    if (currentUser.last_login) {
      const d = new Date(currentUser.last_login);
      lastLoginEl.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else {
      lastLoginEl.textContent = 'First login';
    }

    // 2FA status
    update2FAStatus(currentUser.two_factor_enabled);
  } catch (err) {
    console.error('Error loading user:', err);
  }
}

function update2FAStatus(enabled) {
  const statValue = document.getElementById('twoFAStatValue');
  const statIcon = document.getElementById('twoFAStatIcon');
  const featureCheck = document.getElementById('twoFACheck');
  const featureText = document.getElementById('twoFAFeatureText');
  const setupFlow = document.getElementById('tfaSetupFlow');
  const disableSection = document.getElementById('tfaDisableSection');

  if (enabled) {
    statValue.textContent = 'Enabled';
    statIcon.className = 'stat-icon green';
    featureCheck.textContent = '✓';
    featureText.textContent = 'TOTP 2FA — enabled ✓';
    setupFlow && (setupFlow.style.display = 'none');
    disableSection && disableSection.classList.remove('hidden');
  } else {
    statValue.textContent = 'Disabled';
    statIcon.className = 'stat-icon';
    featureCheck.textContent = '○';
    featureText.textContent = 'TOTP 2FA (optional — not enabled)';
    setupFlow && (setupFlow.style.display = '');
    disableSection && disableSection.classList.add('hidden');
  }
}

function showSection(section) {
  document.querySelectorAll('.dash-section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  if (section === 'security') {
    document.getElementById('securitySection').classList.remove('hidden');
    document.querySelectorAll('.nav-item')[1].classList.add('active');
  } else {
    document.getElementById('overviewSection').classList.remove('hidden');
    document.querySelectorAll('.nav-item')[0].classList.add('active');
  }
}

async function handleLogout() {
  try {
    const res = await fetch('/api/logout', { method: 'POST' });
    const data = await res.json();
    if (data.success) window.location.href = data.redirect;
  } catch {
    window.location.href = '/login';
  }
}

async function setup2FA() {
  try {
    const res = await fetch('/api/2fa/setup', { method: 'POST' });
    const data = await res.json();
    if (!data.success) {
      showAlert('tfa-alertBox', 'Failed to start 2FA setup.', 'error');
      return;
    }

    document.getElementById('qrCodeImg').src = data.qrCode;
    document.getElementById('secretDisplay').textContent = 'Manual key: ' + data.secret;
    document.getElementById('tfaSetupFlow').style.display = 'none';
    document.getElementById('tfaQRSection').classList.remove('hidden');
  } catch {
    showAlert('tfa-alertBox', 'Network error. Try again.', 'error');
  }
}

async function confirm2FA() {
  const token = document.getElementById('tfaSetupToken').value.trim();
  if (!/^\d{6}$/.test(token)) {
    showAlert('tfa-alertBox', 'Please enter a valid 6-digit code.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();

    if (data.success) {
      showAlert('tfa-alertBox', '2FA enabled successfully!', 'success');
      document.getElementById('tfaQRSection').classList.add('hidden');
      update2FAStatus(true);
    } else {
      showAlert('tfa-alertBox', data.errors.join('<br>'), 'error');
    }
  } catch {
    showAlert('tfa-alertBox', 'Network error. Try again.', 'error');
  }
}

function cancelSetup() {
  document.getElementById('tfaQRSection').classList.add('hidden');
  document.getElementById('tfaSetupFlow').style.display = '';
  document.getElementById('tfaSetupToken').value = '';
  clearAlert('tfa-alertBox');
}

async function disable2FA() {
  if (!confirm('Are you sure you want to disable 2FA? This will reduce your account security.')) return;
  try {
    const res = await fetch('/api/2fa/disable', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showAlert('tfa-alertBox', '2FA disabled.', 'success');
      update2FAStatus(false);
    } else {
      showAlert('tfa-alertBox', data.errors.join('<br>'), 'error');
    }
  } catch {
    showAlert('tfa-alertBox', 'Network error. Try again.', 'error');
  }
}

// Sidebar nav links
document.querySelectorAll('.nav-item').forEach((item, i) => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    showSection(i === 0 ? 'overview' : 'security');
  });
});

// Initialize
loadUser();
