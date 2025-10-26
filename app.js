// Supabase Configuration
const SUPABASE_URL = 'https://mmcubamglborvoruwaaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tY3ViYW1nbGJvcnZvcnV3YWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MDQ5MjIsImV4cCI6MjA3Njk4MDkyMn0.VG-DuqkqstNkYtCgMj0TnwoSawmLGOx1qT218-Rz_SM';
const ADMIN_EMAIL = 'sushinofficial@gmail.com';

// Initialize Supabase client (v1.x compatible)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auth State (stored in memory)
let currentUser = null;
let isAuthorized = false;

// State
let opportunitiesData = [];
let filteredOpportunities = [];
let currentFilter = 'all';
let lastUpdatedTime = null;
let updateInterval = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
});

// ===== AUTHENTICATION =====

// Initialize authentication
async function initializeAuth() {
    showLoadingState();
    
    try {
        // Check current auth state
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session?.user) {
            // User is authenticated, check authorization
            await checkAuthorizationAndLoad(session.user);
        } else {
            // Not authenticated, show login screen
            hideLoadingState();
            showLoginScreen();
        }
        
        // Listen for auth changes
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event);
            
            if (event === 'SIGNED_IN' && session?.user) {
                await checkAuthorizationAndLoad(session.user);
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                isAuthorized = false;
                showLoginScreen();
            }
        });
    } catch (error) {
        console.error('Auth initialization error:', error);
        hideLoadingState();
        showLoginScreen();
    }
}

// Check if user is authorized
async function checkAuthorizationAndLoad(user) {
    currentUser = user;
    
    // Admin always has access
    if (user.email === ADMIN_EMAIL) {
        isAuthorized = true;
        await loadDashboard();
        return;
    }
    
    // Check authorized_users table
    try {
        const { data, error } = await supabaseClient
            .from('authorized_users')
            .select('email')
            .eq('email', user.email)
            .single();
        
        if (error || !data) {
            // User not authorized
            isAuthorized = false;
            showAccessDeniedScreen();
        } else {
            // User is authorized
            isAuthorized = true;
            await loadDashboard();
        }
    } catch (error) {
        console.error('Authorization check error:', error);
        isAuthorized = false;
        showAccessDeniedScreen();
    }
}

// Handle Login
async function handleLogin() {
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const btnText = loginBtn.querySelector('.btn-text');
    const btnSpinner = loginBtn.querySelector('.btn-spinner');
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    // Validation
    if (!email) {
        showAuthMessage('Please enter your email address', 'error');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAuthMessage('Please enter a valid email address', 'error');
        return;
    }
    
    if (!password) {
        showAuthMessage('Please enter your password', 'error');
        return;
    }
    
    // Show loading
    loginBtn.disabled = true;
    btnText.style.display = 'none';
    btnSpinner.style.display = 'inline-block';
    document.getElementById('authMessage').style.display = 'none';
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            showAuthMessage(error.message, 'error');
            loginBtn.disabled = false;
            btnText.style.display = 'inline';
            btnSpinner.style.display = 'none';
        } else {
            showAuthMessage('✓ Login successful! Loading dashboard...', 'success');
            // Auth state change will handle the rest
        }
    } catch (error) {
        console.error('Login error:', error);
        showAuthMessage('Login failed. Please try again.', 'error');
        loginBtn.disabled = false;
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
    }
}

// Handle Signup
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
    
    // Validation
    if (!email) {
        showAuthMessage('Please enter your email address', 'error');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAuthMessage('Please enter a valid email address', 'error');
        return;
    }
    
    if (!password) {
        showAuthMessage('Please create a password', 'error');
        return;
    }
    
    if (password.length < 6) {
        showAuthMessage('Password must be at least 6 characters', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showAuthMessage('Passwords do not match', 'error');
        return;
    }
    
    // Show loading
    signupBtn.disabled = true;
    btnText.style.display = 'none';
    btnSpinner.style.display = 'inline-block';
    document.getElementById('authMessage').style.display = 'none';
    
    try {
        // Check if email is authorized (unless it's admin)
        if (email !== ADMIN_EMAIL) {
            const { data: authData, error: authError } = await supabaseClient
                .from('authorized_users')
                .select('email')
                .eq('email', email)
                .single();
            
            if (authError || !authData) {
                showAuthMessage('❌ Email not authorized. Please use your Gumroad purchase email or contact support.', 'error');
                signupBtn.disabled = false;
                btnText.style.display = 'inline';
                btnSpinner.style.display = 'none';
                return;
            }
        }
        
        // Create account
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                emailRedirectTo: window.location.origin
            }
        });
        
        if (error) {
            showAuthMessage(error.message, 'error');
            signupBtn.disabled = false;
            btnText.style.display = 'inline';
            btnSpinner.style.display = 'none';
        } else {
            showAuthMessage('✓ Account created successfully! Logging you in...', 'success');
            // Auth state change will handle the rest
            // Clear form
            emailInput.value = '';
            passwordInput.value = '';
            confirmPasswordInput.value = '';
        }
    } catch (error) {
        console.error('Signup error:', error);
        showAuthMessage('Signup failed. Please try again.', 'error');
        signupBtn.disabled = false;
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
    }
}

// Show auth message
function showAuthMessage(message, type) {
    const authMessage = document.getElementById('authMessage');
    authMessage.textContent = message;
    authMessage.className = `auth-message ${type}`;
    authMessage.style.display = 'block';
}

// Logout
async function logout() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    isAuthorized = false;
    showLoginScreen();
}

// Show login screen
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('accessDeniedScreen').style.display = 'none';
    document.querySelector('header').style.display = 'none';
    document.querySelector('main').style.display = 'none';
    document.querySelector('footer').style.display = 'none';
    
    // Show login form by default
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('authFormTitle').textContent = 'Digital Product Finder';
    document.getElementById('authFormSubtitle').textContent = 'Sign in to access exclusive opportunities';
    
    // Attach event listeners
    attachAuthEventListeners();
}

// Attach auth event listeners
function attachAuthEventListeners() {
    // Login form
    const loginBtn = document.getElementById('loginBtn');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    
    loginBtn.onclick = handleLogin;
    loginEmail.onkeypress = (e) => {
        if (e.key === 'Enter') handleLogin();
    };
    loginPassword.onkeypress = (e) => {
        if (e.key === 'Enter') handleLogin();
    };
    
    // Signup form
    const signupBtn = document.getElementById('signupBtn');
    const signupEmail = document.getElementById('signupEmail');
    const signupPassword = document.getElementById('signupPassword');
    const signupConfirm = document.getElementById('signupConfirmPassword');
    
    signupBtn.onclick = handleSignup;
    signupEmail.onkeypress = (e) => {
        if (e.key === 'Enter') document.getElementById('signupPassword').focus();
    };
    signupPassword.onkeypress = (e) => {
        if (e.key === 'Enter') document.getElementById('signupConfirmPassword').focus();
    };
    signupConfirm.onkeypress = (e) => {
        if (e.key === 'Enter') handleSignup();
    };
    
    // Toggle links
    const showSignupLink = document.getElementById('showSignupLink');
    const showLoginLink = document.getElementById('showLoginLink');
    
    showSignupLink.onclick = (e) => {
        e.preventDefault();
        showSignupForm();
    };
    
    showLoginLink.onclick = (e) => {
        e.preventDefault();
        showLoginForm();
    };
}

// Show signup form
function showSignupForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
    document.getElementById('authFormTitle').textContent = 'Create Account';
    document.getElementById('authFormSubtitle').textContent = 'Use your Gumroad purchase email to get started';
    document.getElementById('authMessage').style.display = 'none';
}

// Show login form
function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('authFormTitle').textContent = 'Digital Product Finder';
    document.getElementById('authFormSubtitle').textContent = 'Sign in to access exclusive opportunities';
    document.getElementById('authMessage').style.display = 'none';
}

// Show access denied screen
function showAccessDeniedScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('accessDeniedScreen').style.display = 'flex';
    document.querySelector('header').style.display = 'none';
    document.querySelector('main').style.display = 'none';
    document.querySelector('footer').style.display = 'none';
    
    document.getElementById('deniedEmail').textContent = currentUser?.email || '';
    document.getElementById('logoutBtn').onclick = logout;
}

// Load dashboard
async function loadDashboard() {
    // Show loading state
    showLoadingState();
    
    // Hide auth screens
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('accessDeniedScreen').style.display = 'none';
    
    // Show main app
    document.querySelector('header').style.display = 'block';
    document.querySelector('main').style.display = 'block';
    document.querySelector('footer').style.display = 'block';
    
    // Update user info in header
    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('logoutBtnHeader').onclick = logout;
    
    // Load opportunities
    await initializeApp();
}

// Update last updated display
function updateLastUpdatedDisplay() {
    if (!lastUpdatedTime) return;
    
    const now = new Date();
    const diff = Math.floor((now - lastUpdatedTime) / 1000); // seconds
    
    let timeText;
    if (diff < 60) {
        timeText = 'just now';
    } else if (diff < 3600) {
        const mins = Math.floor(diff / 60);
        timeText = `${mins} min${mins > 1 ? 's' : ''} ago`;
    } else if (diff < 7200) {
        timeText = '1 hour ago';
    } else if (diff < 86400) {
        const hours = Math.floor(diff / 3600);
        timeText = `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diff < 172800) {
        timeText = 'Yesterday';
    } else {
        const options = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
        timeText = lastUpdatedTime.toLocaleDateString('en-US', options);
    }
    
    const element = document.getElementById('last-updated');
    if (element) {
        element.textContent = `⏰ Data last updated: ${timeText}`;
    }
}

// Fetch data from Supabase
async function fetchOpportunitiesFromSupabase() {
    try {
        // Fetch from opportunities table (can be renamed to protected_opportunities in production)
        const { data, error } = await supabaseClient
            .from('opportunities')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            throw error;
        }
        
        if (!data || data.length === 0) {
            showEmptyState();
            return [];
        }
        
        // Find the most recent updated_at or created_at timestamp from the data
        if (data && data.length > 0) {
            const timestamps = data.map(item => {
                const updatedAt = item.updated_at ? new Date(item.updated_at) : null;
                const createdAt = item.created_at ? new Date(item.created_at) : null;
                // Use updated_at if available, otherwise created_at
                return updatedAt || createdAt;
            }).filter(t => t !== null);
            
            // Get the most recent timestamp
            if (timestamps.length > 0) {
                lastUpdatedTime = new Date(Math.max(...timestamps));
            }
        }
        
        updateLastUpdatedDisplay();
        // Update display every minute
        if (updateInterval) clearInterval(updateInterval);
        updateInterval = setInterval(updateLastUpdatedDisplay, 60000);
        
        // Map database fields to camelCase for consistency with existing code
        return data.map((item) => ({
            id: item.id,
            question: item.question,
            platform: item.platform,
            category: item.category,
            engagement: item.engagement,
            isNew: item.is_new,
            productOpportunity: item.product_opportunity,
            solutionType: item.solution_type,
            competitors: item.competitors || [],
            seasonal: item.seasonal,
            tags: item.tags || [],
            conversionPotential: item.conversion_potential,
            conversionNote: item.conversion_note
        }));
    } catch (error) {
        console.error('Error fetching from Supabase:', error);
        showErrorState(error.message);
        return [];
    }
}

// Show loading state
function showLoadingState() {
    const loadingElement = document.getElementById('loadingState');
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }
    const errorElement = document.getElementById('errorState');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
    const gridElement = document.getElementById('opportunitiesGrid');
    if (gridElement) {
        gridElement.style.display = 'none';
    }
    const noResultsElement = document.getElementById('noResults');
    if (noResultsElement) {
        noResultsElement.style.display = 'none';
    }
}

// Hide loading state
function hideLoadingState() {
    const loadingElement = document.getElementById('loadingState');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
    const gridElement = document.getElementById('opportunitiesGrid');
    if (gridElement) {
        gridElement.style.display = 'grid';
    }
}

// Show error state
function showErrorState(errorMessage) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
    document.getElementById('opportunitiesGrid').style.display = 'none';
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('errorMessage').textContent = `Error: ${errorMessage}`;
}

// Show empty state
function showEmptyState() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('opportunitiesGrid').style.display = 'none';
    document.getElementById('noResults').style.display = 'block';
    document.querySelector('.no-results h3').textContent = 'No Opportunities in Database';
    document.querySelector('.no-results p').textContent = 'The database is currently empty. Please add some opportunities.';
}

async function initializeApp() {
    showLoadingState();
    
    // Fetch data from Supabase
    opportunitiesData = await fetchOpportunitiesFromSupabase();
    
    if (opportunitiesData.length > 0) {
        hideLoadingState();
        filteredOpportunities = [...opportunitiesData];
        
        populateFilters();
        updateStats();
        renderOpportunities();
        attachEventListeners();
    }
}

// Populate category filter
function populateFilters() {
    const categoryFilter = document.getElementById('categoryFilter');
    const categories = [...new Set(opportunitiesData.map(o => o.category))].sort();
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
}

// Update statistics
function updateStats() {
    document.getElementById('totalOpportunities').textContent = opportunitiesData.length;
    document.getElementById('extremelyHighCount').textContent = opportunitiesData.filter(o => o.conversionPotential === 'Extremely High').length;
    document.getElementById('seasonalCount').textContent = opportunitiesData.filter(o => o.seasonal).length;
    document.getElementById('newThisWeek').textContent = opportunitiesData.filter(o => o.isNew).length;
}

// Attach event listeners
function attachEventListeners() {
    // Search
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    
    // Quick filters
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', handleQuickFilter);
    });
    
    // Advanced filters
    document.getElementById('platformFilter').addEventListener('change', applyFilters);
    document.getElementById('categoryFilter').addEventListener('change', applyFilters);
    document.getElementById('conversionFilter').addEventListener('change', applyFilters);
    document.getElementById('sortBy').addEventListener('change', applyFilters);
    
    // Modal
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', closeModal);
}

// Handle quick filter
function handleQuickFilter(e) {
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter = e.target.dataset.filter;
    applyFilters();
}

// Apply all filters
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const platform = document.getElementById('platformFilter').value;
    const category = document.getElementById('categoryFilter').value;
    const conversion = document.getElementById('conversionFilter').value;
    const sortBy = document.getElementById('sortBy').value;
    
    filteredOpportunities = opportunitiesData.filter(opp => {
        // Search filter
        const matchesSearch = !searchTerm || 
            opp.question.toLowerCase().includes(searchTerm) ||
            opp.productOpportunity.toLowerCase().includes(searchTerm) ||
            opp.category.toLowerCase().includes(searchTerm) ||
            opp.tags.some(tag => tag.toLowerCase().includes(searchTerm));
        
        // Platform filter
        const matchesPlatform = platform === 'all' || opp.platform === platform;
        
        // Category filter
        const matchesCategory = category === 'all' || opp.category === category;
        
        // Conversion filter
        const matchesConversion = conversion === 'all' || opp.conversionPotential === conversion;
        
        // Quick filter
        let matchesQuickFilter = true;
        if (currentFilter === 'extremely-high') {
            matchesQuickFilter = opp.conversionPotential === 'Extremely High';
        } else if (currentFilter === 'very-high') {
            matchesQuickFilter = opp.conversionPotential === 'Very High';
        } else if (currentFilter === 'new') {
            matchesQuickFilter = opp.isNew;
        } else if (currentFilter === 'seasonal') {
            matchesQuickFilter = opp.seasonal;
        }
        
        return matchesSearch && matchesPlatform && matchesCategory && matchesConversion && matchesQuickFilter;
    });
    
    // Sort
    if (sortBy === 'conversion') {
        const order = { 'Extremely High': 5, 'Very High': 4, 'High': 3, 'Medium-High': 2, 'Medium': 1 };
        filteredOpportunities.sort((a, b) => order[b.conversionPotential] - order[a.conversionPotential]);
    } else if (sortBy === 'newest') {
        filteredOpportunities.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    } else if (sortBy === 'platform') {
        filteredOpportunities.sort((a, b) => a.platform.localeCompare(b.platform));
    } else if (sortBy === 'az') {
        filteredOpportunities.sort((a, b) => a.question.localeCompare(b.question));
    }
    
    renderOpportunities();
}

// Render opportunities
function renderOpportunities() {
    const grid = document.getElementById('opportunitiesGrid');
    const noResults = document.getElementById('noResults');
    const resultsCount = document.getElementById('resultsCount');
    
    grid.innerHTML = '';
    
    if (filteredOpportunities.length === 0) {
        noResults.style.display = 'block';
        resultsCount.textContent = 'No opportunities found';
        return;
    }
    
    noResults.style.display = 'none';
    resultsCount.textContent = `Showing ${filteredOpportunities.length} of ${opportunitiesData.length} opportunities`;
    
    filteredOpportunities.forEach(opp => {
        const card = createOpportunityCard(opp);
        grid.appendChild(card);
    });
}

// Helper function to generate competitor link
function generateCompetitorLink(competitorText) {
    // Parse competitor name and platform
    const match = competitorText.match(/^(.+?)\s*\((.+?)\)$/);
    if (!match) return competitorText;
    
    const name = match[1].trim();
    const platform = match[2].toLowerCase();
    
    let url = '';
    if (platform.includes('etsy')) {
        url = `https://www.etsy.com/search?q=${encodeURIComponent(name)}`;
    } else if (platform.includes('gumroad')) {
        url = `https://gumroad.com/discover?query=${encodeURIComponent(name)}`;
    } else if (platform.includes('facebook')) {
        url = `https://www.facebook.com/search/top?q=${encodeURIComponent(name)}`;
    }
    
    if (url) {
        return `<a href="${url}" target="_blank" class="competitor-link" rel="noopener noreferrer">${competitorText} <span class="external-icon">↗</span></a>`;
    }
    return competitorText;
}

// Create opportunity card
function createOpportunityCard(opp) {
    const card = document.createElement('div');
    card.className = 'opportunity-card';
    
    // Get conversion badge class and emoji
    let conversionClass = '';
    let conversionEmoji = '';
    switch(opp.conversionPotential) {
        case 'Extremely High':
            conversionClass = 'conversion-extremely-high';
            conversionEmoji = '🔥';
            break;
        case 'Very High':
            conversionClass = 'conversion-very-high';
            conversionEmoji = '⚡';
            break;
        case 'High':
            conversionClass = 'conversion-high';
            conversionEmoji = '✨';
            break;
        case 'Medium-High':
            conversionClass = 'conversion-medium-high';
            conversionEmoji = '💡';
            break;
        default:
            conversionClass = 'conversion-medium';
            conversionEmoji = '';
    }
    
    // Badges
    const badges = [];
    badges.push(`<span class="badge badge-platform">${opp.platform}</span>`);
    if (opp.isNew) {
        badges.push(`<span class="badge badge-new">NEW</span>`);
    }
    if (opp.seasonal) {
        badges.push(`<span class="seasonal-badge">🎄 Q4 2025 Rush</span>`);
    }
    
    // Competitors (show first 3)
    const competitorChips = opp.competitors.slice(0, 3).map(comp => 
        `<span class="competitor-chip">${generateCompetitorLink(comp)}</span>`
    ).join('');
    
    const viewAllBtn = opp.competitors.length > 3 ? 
        `<button class="view-all-competitors" onclick="showDetailsModal(${opp.id})">+${opp.competitors.length - 3} more</button>` : '';
    
    // Tags (show first 3)
    const tags = opp.tags.slice(0, 3).map(tag => 
        `<span class="tag">${tag}</span>`
    ).join('');
    
    // Engagement indicator
    let engagementText = '';
    if (opp.engagement === 'Very High') {
        engagementText = '🔥 Very High Engagement - 450+ interactions';
    } else if (opp.engagement === 'High') {
        engagementText = '⚡ High Engagement - 200+ interactions';
    } else {
        engagementText = `${opp.engagement} Engagement`;
    }
    
    card.innerHTML = `
        <div class="card-header">
            <h3 class="card-question">${opp.question}</h3>
            <div class="card-badges">
                ${badges.join('')}
            </div>
        </div>
        
        <div class="conversion-badge ${conversionClass}">
            ${conversionEmoji} ${opp.conversionPotential} Conversion Potential
        </div>
        
        <div class="product-section">
            <div class="product-label">Product Idea:</div>
            <div class="product-name">${opp.productOpportunity}</div>
            <div class="solution-type">${opp.solutionType}</div>
        </div>
        
        <div class="competitor-section">
            <div class="competitor-label">Competing Sellers:</div>
            <div class="competitor-list">
                ${competitorChips}
                ${viewAllBtn}
            </div>
        </div>
        
        <div class="engagement-indicator">
            <div class="engagement-text">${engagementText}</div>
        </div>
        
        <div class="card-tags">
            ${tags}
        </div>
        
        <div class="card-actions">
            <button class="btn-secondary btn-full-width" onclick="showDetailsModal(${opp.id})">👁️ View Details</button>
        </div>
    `;
    
    return card;
}

// Show details modal
function showDetailsModal(id) {
    const opp = opportunitiesData.find(o => o.id === id);
    if (!opp) return;
    
    const modal = document.getElementById('detailsModal');
    const modalBody = document.getElementById('modalBody');
    
    const allCompetitors = opp.competitors.map(comp => 
        `<div class="competitor-detail"><strong>${generateCompetitorLink(comp)}</strong></div>`
    ).join('');
    
    const allTags = opp.tags.map(tag => `<span class="tag">${tag}</span>`).join('');
    
    modalBody.innerHTML = `
        <div class="modal-header">
            <h2 class="modal-title">${opp.question}</h2>
            <div class="card-badges">
                <span class="badge badge-platform">${opp.platform}</span>
                ${opp.isNew ? '<span class="badge badge-new">NEW</span>' : ''}
            </div>
        </div>
        
        <div class="modal-section">
            <h3>💡 Product Opportunity</h3>
            <p><strong>${opp.productOpportunity}</strong></p>
            <p>Solution Type: ${opp.solutionType}</p>
        </div>
        
        <div class="modal-section">
            <h3>🔥 Conversion Potential</h3>
            <div class="conversion-badge conversion-${opp.conversionPotential.toLowerCase().replace(' ', '-')}">
                ${opp.conversionPotential}
            </div>
            <p><strong>Why this converts:</strong> ${opp.conversionNote}</p>
        </div>
        
        <div class="modal-section">
            <h3>🏪 All Competing Sellers</h3>
            ${allCompetitors}
        </div>
        
        <div class="modal-section">
            <h3>📊 Market Details</h3>
            <p><strong>Category:</strong> ${opp.category}</p>
            <p><strong>Engagement Level:</strong> ${opp.engagement}</p>
            <p><strong>Platform:</strong> ${opp.platform}</p>
            ${opp.seasonal ? '<p><strong>⏰ Seasonal:</strong> Limited Time - Oct-Dec (Q4 Rush!)</p>' : ''}
        </div>
        
        <div class="modal-section">
            <h3>💰 Pricing Suggestions</h3>
            <p>Based on competitor analysis and product type, consider pricing between <strong>$15-$50</strong></p>
            <p>Start at $19-$25 for single products, $35-$50 for bundles</p>
        </div>
        
        <div class="modal-section">
            <h3>🎯 Target Audience</h3>
            <p>People searching on ${opp.platform} for ${opp.category.toLowerCase()} solutions</p>
        </div>
        
        <div class="modal-section">
            <h3>🏷️ Tags</h3>
            <div class="card-tags">${allTags}</div>
        </div>
        
        <div class="card-actions" style="margin-top: 24px;">
            <button class="btn-secondary btn-full-width" onclick="closeModal();">Close</button>
        </div>
    `;
    
    modal.classList.add('active');
}

// Close modal
function closeModal() {
    document.getElementById('detailsModal').classList.remove('active');
}

// Create product action
function createProduct(id) {
    const opp = opportunitiesData.find(o => o.id === id);
    if (!opp) return;
    
    alert(`🎉 Great choice!\n\nProduct to create: ${opp.productOpportunity}\n\nNext steps:\n✓ Research top sellers: ${opp.competitors[0]}\n✓ Create unique value proposition\n✓ Price competitively ($15-$50)\n✓ Launch on Etsy or Gumroad\n\nConversion potential: ${opp.conversionPotential}\n${opp.conversionNote}`);
}

// Make functions global
window.showDetailsModal = showDetailsModal;
window.closeModal = closeModal;
window.createProduct = createProduct;
window.logout = logout;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.showSignupForm = showSignupForm;
window.showLoginForm = showLoginForm;