// Supabase Configuration
const SUPABASE_URL = 'https://mmcubamglborvoruwaaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tY3ViYW1nbGJvcnZvcnV3YWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MDQ5MjIsImV4cCI6MjA3Njk4MDkyMn0.VG-DuqkqstNkYtCgMj0TnwoSawmLGOx1qT218-Rz_SM';
const ADMIN_EMAIL = 'sushinofficial@gmail.com';

// ESM import for Supabase JS v2+
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

// --- UI state helpers ---
function showLoadingState() {
  document.getElementById('loadingScreen')?.classList.add('active');
}
function hideLoadingState() {
  document.getElementById('loadingScreen')?.classList.remove('active');
}
function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('accessDeniedScreen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'none';
}
function showAccessDeniedScreen() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('accessDeniedScreen').style.display = 'flex';
}
function showAuthMessage(msg, type) {
  const m = document.getElementById('authMessage');
  m.textContent = msg;
  m.className = 'auth-message ' + type;
  m.style.display = 'block';
}
async function loadDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('accessDeniedScreen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
}

// --- Auth core setup ---
document.addEventListener('DOMContentLoaded', () => {
  initializeAuth();
});

async function initializeAuth() {
  showLoadingState();
  try {
    // Get current session, returns promise
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await checkAuthorizationAndLoad(session.user);
    } else {
      hideLoadingState();
      showLoginScreen();
    }
    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await checkAuthorizationAndLoad(session.user);
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        showLoginScreen();
      }
    });
  } catch (err) {
    hideLoadingState();
    showLoginScreen();
  }
}

// --- Signup Handler ---
async function handleSignup() {
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('signupConfirmPassword').value;
  const signupBtn = document.getElementById('signupBtn');
  const btnText = signupBtn.querySelector('.btn-text');
  const btnSpinner = signupBtn.querySelector('.btn-spinner');

  if (!email || !password || password !== confirmPassword) {
    showAuthMessage('Please enter valid and matching email/passwords.', 'error');
    return;
  }
  signupBtn.disabled = true;
  btnText.style.display = 'none';
  btnSpinner.style.display = 'inline-block';

  // Supabase sign up
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    showAuthMessage(error.message, 'error');
    signupBtn.disabled = false;
    btnText.style.display = 'inline';
    btnSpinner.style.display = 'none';
    return;
  }
  showAuthMessage('✓ Account created! Check your email to verify & then log in.', 'success');
  document.getElementById('signupEmail').value = '';
  document.getElementById('signupPassword').value = '';
  document.getElementById('signupConfirmPassword').value = '';
  signupBtn.disabled = false;
  btnText.style.display = 'inline';
  btnSpinner.style.display = 'none';
}

// --- Login Handler ---
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const loginBtn = document.getElementById('loginBtn');
  const btnText = loginBtn.querySelector('.btn-text');
  const btnSpinner = loginBtn.querySelector('.btn-spinner');

  if (!email || !password) {
    showAuthMessage('Please enter your email and password.', 'error');
    return;
  }
  loginBtn.disabled = true;
  btnText.style.display = 'none';
  btnSpinner.style.display = 'inline-block';

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showAuthMessage(error.message, 'error');
    loginBtn.disabled = false;
    btnText.style.display = 'inline';
    btnSpinner.style.display = 'none';
    return;
  }
  // Supabase will trigger auth state change so no further action needed
}

// --- Whitelist Authorization Check ---
async function checkAuthorizationAndLoad(user) {
  currentUser = user;
  if (user.email === ADMIN_EMAIL) {
    await loadDashboard();
    return;
  }
  const normalizedEmail = user.email.toLowerCase().trim();
  const { data: whitelist, error } = await supabase
    .from('authorized_users')
    .select('email');
  const isAuthorized = whitelist &&
    whitelist.map(u => u.email && u.email.toLowerCase().trim()).includes(normalizedEmail);

  if (!isAuthorized) {
    showAccessDeniedScreen();
    return;
  }
  await loadDashboard();
}

// Expose for HTML buttons
window.handleSignup = handleSignup;
window.handleLogin = handleLogin;
