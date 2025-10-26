// Supabase Configuration
const SUPABASE_URL = 'https://mmcubamglborvoruwaaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tY3ViYW1nbGJvcnZvcnV3YWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MDQ5MjIsImV4cCI6MjA3Njk4MDkyMn0.VG-DuqkqstNkYtCgMj0TnwoSawmLGOx1qT218-Rz_SM';
const ADMIN_EMAIL = 'sushinofficial@gmail.com';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
});

// Auth setup
async function initializeAuth() {
    showLoadingState();
    try {
        // v1: get session
        const session = supabaseClient.auth.session();
        if (session?.user) {
            await checkAuthorizationAndLoad(session.user);
        } else {
            hideLoadingState();
            showLoginScreen();
        }
        // Listen for auth changes
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
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

// When user signs up
async function handleSignup() {
    const emailInput = document.getElementById('signupEmail');
    const passwordInput = document.getElementById('signupPassword');
    const confirmPasswordInput = document.getElementById('signupConfirmPassword');
    const signupBtn = document.getElementById('signupBtn');
    const btnText = signupBtn.querySelector('.btn-text');
    const btnSpinner = signupBtn.querySelector('.btn-spinner');

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    if (!email || !password || password !== confirmPassword) {
        showAuthMessage('Please enter valid and matching email/passwords.', 'error');
        return;
    }
    signupBtn.disabled = true;
    btnText.style.display = 'none';
    btnSpinner.style.display = 'inline-block';

    // Always allow sign-up, let the dashboard check determine authorization!
    const { user, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password
    });
    if (error) {
        showAuthMessage(error.message, 'error');
        signupBtn.disabled = false;
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
        return;
    }
    showAuthMessage('✓ Account created! Check your email to verify & then log in.', 'success');
    emailInput.value = '';
    passwordInput.value = '';
    confirmPasswordInput.value = '';
    signupBtn.disabled = false;
    btnText.style.display = 'inline';
    btnSpinner.style.display = 'none';
}

// Login
async function handleLogin() {
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const btnText = loginBtn.querySelector('.btn-text');
    const btnSpinner = loginBtn.querySelector('.btn-spinner');

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showAuthMessage('Please enter your email and password.', 'error');
        return;
    }

    loginBtn.disabled = true;
    btnText.style.display = 'none';
    btnSpinner.style.display = 'inline-block';

    const { user, error } = await supabaseClient.auth.signIn({
        email: email,
        password: password
    });
    if (error) {
        showAuthMessage(error.message, 'error');
        loginBtn.disabled = false;
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
        return;
    }
    // Auth state will transition and load will continue
}

// After login/signup: whitelist check
async function checkAuthorizationAndLoad(user) {
    currentUser = user;
    // Admin always has access
    if (user.email === ADMIN_EMAIL) {
        await loadDashboard();
        return;
    }
    // Whitelist (authorized_users) table check
    const normalizedEmail = user.email.toLowerCase().trim();
    const { data: whitelist, error } = await supabaseClient
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

// Show login, signup, dashboard
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
async function loadDashboard() {
    // hide auth, show dashboard
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('accessDeniedScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
}
function showAuthMessage(msg, type) {
    const m = document.getElementById('authMessage');
    m.textContent = msg;
    m.className = 'auth-message ' + type;
    m.style.display = 'block';
}
window.handleSignup = handleSignup;
window.handleLogin = handleLogin;
