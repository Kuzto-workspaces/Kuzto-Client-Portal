// Configuration
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz3I4t6MVwQ-R9z-IhzppyVTKrqrDgDI2cN1qLn7lcCko768yeWOv14QtmYsUGHwyQH/exec';

// DOM Elements
const container = document.querySelector('.container');
const loginView = document.getElementById('login-view');
const profileSetupView = document.getElementById('profile-setup-view');
const dashboardView = document.getElementById('dashboard-view');
const dashboardContent = document.getElementById('dashboard-content');
const profileContent = document.getElementById('profile-content');

// Forms & Inputs
const emailForm = document.getElementById('email-login-form');
const profileSetupForm = document.getElementById('profile-setup-form');
const loginError = document.getElementById('login-error');
const setupError = document.getElementById('setup-error');
const usernameStatus = document.getElementById('username-status');

// Auth Tabs
const tabSignin = document.getElementById('tab-signin');
const tabSignup = document.getElementById('tab-signup');
const signinSection = document.getElementById('signin-section');
const signupSection = document.getElementById('signup-section');

// Setup Inputs
const setupEmail = document.getElementById('setup-email');
const setupName = document.getElementById('setup-name');
const setupUsername = document.getElementById('setup-username');
const setupPassword = document.getElementById('setup-password');
const setupConfirm = document.getElementById('setup-confirm');
const checkUsernameBtn = document.getElementById('check-username-btn');
const setupSubmitBtn = document.getElementById('setup-submit-btn');
const setupCancelBtn = document.getElementById('setup-cancel-btn');

// Profile View Inputs
const profileUsername = document.getElementById('profile-username');
const profileName = document.getElementById('profile-name');
const editNameBtn = document.getElementById('edit-name-btn');
const profileEmail = document.getElementById('profile-email');
const profileContact = document.getElementById('profile-contact');
const editContactBtn = document.getElementById('edit-contact-btn');
const profilePassword = document.getElementById('profile-password');
const editPasswordBtn = document.getElementById('edit-password-btn');

// Modal Elements
const addItemFab = document.getElementById('add-item-fab');
const addItemModal = document.getElementById('add-item-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const addItemForm = document.getElementById('add-item-form');

// Buttons
const profileBtn = document.getElementById('profile-fab');
const logoutBtn = document.getElementById('logout-btn');
const clientNameEl = document.getElementById('client-name');

// New Modals
const claimModal = document.getElementById('claim-modal');
const closeClaimModalBtn = document.getElementById('close-claim-modal-btn');
const cancelClaimBtn = document.getElementById('cancel-claim-btn');
const claimForm = document.getElementById('claim-form');
const claimItemNameLabel = document.getElementById('claim-item-name');
const claimDisplayName = document.getElementById('claim-display-name');
const claimIssue = document.getElementById('claim-issue');
const claimStatus = document.getElementById('claim-status');
const claimOutputSection = document.getElementById('claim-output-section');
const claimTemplateOutput = document.getElementById('claim-template-output');
const copyTemplateBtn = document.getElementById('copy-template-btn');
const downloadInvoiceBtn = document.getElementById('download-invoice-btn');
const copyStatus = document.getElementById('copy-status');

const forgotPasswordLink = document.getElementById('forgot-password-link');
const forgotPasswordModal = document.getElementById('forgot-password-modal');
const closeForgotModalBtn = document.getElementById('close-forgot-modal-btn');
const forgotPasswordForm = document.getElementById('forgot-password-form');
const forgotUsername = document.getElementById('forgot-username');
const forgotStatus = document.getElementById('forgot-status');

// State
let isUsernameAvailable = false;
let heldUsername = "";
let currentUser = null;
let currentClaimItem = "";
let inactivityTimer;

// --- Security: HTML Escape Utility ---
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// --- Utility Functions ---
function showView(viewElement) {
    [loginView, profileSetupView, dashboardView].forEach(v => {
        if (v) v.classList.remove('active');
    });
    if (viewElement) viewElement.classList.add('active');
    
    // Toggle wide mode for dashboard
    if (container) {
        if (viewElement === dashboardView) {
            container.classList.add('wide');
        } else {
            container.classList.remove('wide');
        }
    }
}

// BYPASS LOGIN FOR TESTING - REMOVED
// window.addEventListener('DOMContentLoaded', () => {
//     transitionToDashboard({
//         name: "Test Admin",
//         username: "admin",
//         email: "admin@kuzto.com",
//         hardware: []
//     });
// });

// --- API Communication ---
async function fetchBackend(action, dataPayload) {
    if (APPS_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL') {
        return mockBackend(action, dataPayload);
    }
    
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: action, data: dataPayload }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        return await response.json();
    } catch (err) {
        console.error("Network Error:", err);
        return { success: false, message: "Network error. Please try again." };
    }
}

// --- Authentication Logic ---

// 1. Google OAuth Callback
async function handleGoogleLogin(response) {
    const token = response.credential;
    const result = await fetchBackend('login', { type: 'google', token: token });
    
    if (result.success) {
        if (result.requiresProfileSetup) {
            // First time user via Google
            setupEmail.value = result.email;
            // Pre-fill name from Google profile if available
            if (result.name) {
                setupName.value = result.name;
            }
            showView(profileSetupView);
        } else {
            // Returning user
            transitionToDashboard(result.clientData);
        }
    } else {
        loginError.textContent = result.message || "Google Authentication failed.";
    }
}

// --- Auth Tab Switching ---
if (tabSignin && tabSignup) {
    tabSignin.addEventListener('click', () => {
        tabSignin.classList.add('active');
        tabSignup.classList.remove('active');
        signinSection.classList.add('active');
        signinSection.style.display = 'block';
        signupSection.classList.remove('active');
        signupSection.style.display = 'none';
    });
    
    tabSignup.addEventListener('click', () => {
        tabSignup.classList.add('active');
        tabSignin.classList.remove('active');
        signupSection.classList.add('active');
        signupSection.style.display = 'block';
        signinSection.classList.remove('active');
        signinSection.style.display = 'none';
    });
}

// 2. Email or Username / Password Login
emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = ""; // clear previous errors
    
    const submitBtn = emailForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    // Set loading state
    submitBtn.innerHTML = '<span class="spinner"></span> Authenticating...';
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    
    const identifier = document.getElementById('identifier').value;
    const password = document.getElementById('password').value;
    
    const result = await fetchBackend('login', { 
        type: 'email_or_username', 
        identifier: identifier, 
        password: password 
    });
    
    if (result.success) {
        submitBtn.innerHTML = 'Success!';
        submitBtn.classList.remove('loading');
        submitBtn.classList.add('success-state');
        
        // Transition instantly for maximum speed
        transitionToDashboard(result.clientData);
        
        // Reset button state invisibly for when they log out later
        setTimeout(() => {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            submitBtn.classList.remove('success-state');
        }, 500);
    } else {
        // Reset and show error
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        loginError.textContent = result.message || "Authentication failed.";
    }
});

// --- Profile Setup Logic ---

// Check Username Availability
checkUsernameBtn.addEventListener('click', async () => {
    const username = setupUsername.value.trim();
    if (!username) {
        usernameStatus.textContent = "Please enter a username.";
        usernameStatus.className = 'status-msg error';
        return;
    }

    usernameStatus.textContent = "Checking...";
    usernameStatus.className = 'status-msg';

    const result = await fetchBackend('check_username', { username: username });
    
    if (result.success && result.available) {
        usernameStatus.textContent = "Available! Username held.";
        usernameStatus.className = 'status-msg success';
        isUsernameAvailable = true;
        heldUsername = username;
        
        // Enable password fields and submit
        setupUsername.disabled = true; // Lock it in
        checkUsernameBtn.disabled = true;
        setupPassword.disabled = false;
        setupConfirm.disabled = false;
        setupSubmitBtn.disabled = false;
    } else {
        usernameStatus.textContent = "Not available. Please try another.";
        usernameStatus.className = 'status-msg error';
        isUsernameAvailable = false;
    }
});

// Cancel Profile Setup
setupCancelBtn.addEventListener('click', async () => {
    if (confirm("Are you sure you want to cancel? You will be logged out and your profile will not be created.")) {
        if (heldUsername) {
            await fetchBackend('release_username', { username: heldUsername });
        }
        resetSetupForm();
        showView(loginView);
    }
});

// Submit Profile Setup
profileSetupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isUsernameAvailable) return;

    const password = setupPassword.value;
    const confirmPass = setupConfirm.value;

    if (password !== confirmPass) {
        setupError.textContent = "Passwords do not match.";
        return;
    }

    setupSubmitBtn.disabled = true;
    setupSubmitBtn.textContent = "Creating...";

    const result = await fetchBackend('register_user', {
        email: setupEmail.value,
        username: heldUsername,
        password: password,
        name: setupName.value.trim() || "Client"
    });

    if (result.success) {
        // Log them in automatically
        const loginResult = await fetchBackend('login', {
            type: 'email_or_username',
            identifier: heldUsername,
            password: password
        });
        
        if (loginResult.success) {
            transitionToDashboard(loginResult.clientData);
            resetSetupForm();
        }
    } else {
        setupError.textContent = result.message || "Failed to create account.";
        setupSubmitBtn.disabled = false;
        setupSubmitBtn.textContent = "Create Account";
    }
});

function resetSetupForm() {
    profileSetupForm.reset();
    setupUsername.disabled = false;
    setupName.value = '';
    checkUsernameBtn.disabled = false;
    setupPassword.disabled = true;
    setupConfirm.disabled = true;
    setupSubmitBtn.disabled = true;
    usernameStatus.textContent = "";
    setupError.textContent = "";
    isUsernameAvailable = false;
    heldUsername = "";
}

// --- Dashboard & Profile Management ---

let currentHardware = [];
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const dashboardControls = document.getElementById('dashboard-controls');
const refreshBtn = document.getElementById('refresh-btn');

function transitionToDashboard(clientData) {
    currentUser = clientData || {};
    
    showView(dashboardView);
    if (clientNameEl) clientNameEl.textContent = currentUser.name || "Client";
    
    // Default to showing dashboard content, hiding profile
    if (dashboardContent) dashboardContent.style.display = 'grid';
    if (profileContent) profileContent.style.display = 'none';

    // Populate profile fields
    if (profileUsername) profileUsername.value = currentUser.username || "";
    if (profileName) profileName.value = currentUser.name || "Client";
    if (profileEmail) profileEmail.value = currentUser.email || "";
    if (profileContact) profileContact.value = currentUser.contact || "";
    if (profilePassword) {
        profilePassword.value = "********";
        profilePassword.type = "password";
    }

    // Initiate async data fetching
    fetchItems();
    
    // Start session timeout
    resetInactivityTimer();
}

async function fetchItems() {
    // Show sleek skeleton loading state
    dashboardControls.style.display = 'none'; // hide controls while loading
    dashboardContent.innerHTML = `
        <div class="skeleton-card">
            <div class="skeleton-col">
                <div class="skeleton-line title"></div>
                <div class="skeleton-line spec"></div>
                <div class="skeleton-row" style="margin-top: 1rem;">
                    <div class="skeleton-line pill"></div>
                    <div class="skeleton-line pill"></div>
                </div>
                <div class="skeleton-line pill"></div>
            </div>
            <div class="skeleton-col" style="align-items: flex-end; justify-content: flex-end;">
                <div class="skeleton-line btn"></div>
            </div>
        </div>
        <div class="skeleton-card">
            <div class="skeleton-col">
                <div class="skeleton-line title" style="width: 250px;"></div>
                <div class="skeleton-line spec" style="width: 180px;"></div>
                <div class="skeleton-row" style="margin-top: 1rem;">
                    <div class="skeleton-line pill"></div>
                    <div class="skeleton-line pill"></div>
                </div>
            </div>
            <div class="skeleton-col" style="align-items: flex-end; justify-content: flex-end;">
                <div class="skeleton-line btn"></div>
            </div>
        </div>
    `;

    // Spin the refresh button if clicked
    if (refreshBtn) refreshBtn.classList.add('spinning');

    // Call the new backend action you will implement
    const result = await fetchBackend('get_items', { identifier: currentUser.username || currentUser.email });

    if (refreshBtn) refreshBtn.classList.remove('spinning');

    if (result.success) {
        // Pre-parse timestamps for high-performance sorting
        currentHardware = (result.hardware || []).map(item => ({
            ...item,
            _parsedPurchase: new Date(item.purchaseDate).getTime(),
            _parsedWarrantyEnd: new Date(item.warrantyEndDate).getTime()
        }));
        
        renderItems();
    } else {
        dashboardContent.innerHTML = `
            <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem;">
                <h3 style="color: var(--error-color);">Failed to load items</h3>
                <p style="color: var(--text-secondary);">${result.message || "An error occurred while fetching your workspace."}</p>
                <button class="btn secondary" style="margin-top: 1rem;" onclick="fetchItems()">Try Again</button>
            </div>
        `;
    }
}

if (refreshBtn) {
    refreshBtn.addEventListener('click', fetchItems);
}

function renderItems() {
    dashboardContent.innerHTML = ''; // clear current

    // Filter
    const query = searchInput.value.toLowerCase().trim();
    let filtered = currentHardware.filter(item => {
        const name = (item.itemName || "").toLowerCase();
        const sn = (item.serialNumber || "").toLowerCase();
        return name.includes(query) || sn.includes(query);
    });

    // Optimized Sort (O(N log N) using pre-calculated timestamps)
    const sortVal = sortSelect.value;
    const now = new Date();

    filtered.sort((a, b) => {
        if (sortVal === 'warranty-low') return a._parsedWarrantyEnd - b._parsedWarrantyEnd;
        if (sortVal === 'warranty-high') return b._parsedWarrantyEnd - a._parsedWarrantyEnd;
        if (sortVal === 'date-new') return b._parsedPurchase - a._parsedPurchase;
        if (sortVal === 'date-old') return a._parsedPurchase - b._parsedPurchase;
        return 0;
    });

    if (currentHardware.length > 0) {
        dashboardControls.style.display = 'flex';
    } else {
        dashboardControls.style.display = 'none';
        dashboardContent.innerHTML = `
            <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem;">
                <h3>Your Workspace is Empty</h3>
                <p style="color: var(--text-secondary);">Items and specifications will appear here once populated by the Kuzto team.</p>
            </div>
        `;
        return;
    }

    if (filtered.length === 0) {
        dashboardContent.innerHTML = `
            <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem;">
                <h3>No Items Found</h3>
                <p style="color: var(--text-secondary);">Try adjusting your search.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(item => {
        const purchaseDate = new Date(item.purchaseDate);
        const warrantyEnd = new Date(item.warrantyEndDate);
        
        const formattedDate = purchaseDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const formattedEnd = warrantyEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        
        // Warranty Math
        const timeDiff = warrantyEnd.getTime() - now.getTime();
        const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        let warrantyText = "";
        let isExpired = false;
        
        if (daysLeft < 0) {
            isExpired = true;
            warrantyText = "Expired";
        } else if (daysLeft < 30) {
            warrantyText = `${daysLeft} Days Left`;
        } else if (daysLeft < 365) {
            const months = Math.floor(daysLeft / 30);
            warrantyText = `${months} Month${months > 1 ? 's' : ''} Left`;
        } else {
            const years = (daysLeft / 365).toFixed(1);
            warrantyText = `${years} Year${years !== "1.0" ? 's' : ''} Left`;
        }

        const newCard = document.createElement('div');
        newCard.className = 'card item-card' + (item._syncing ? ' item-syncing' : '');
        const safeName = escapeHTML(item.itemName);
        const safeSpecs = escapeHTML(item.specs);
        const safeSN = escapeHTML(item.serialNumber);
        const safeDriveUrl = escapeHTML(item.driveUrl);

        const syncBadge = item._syncing ? `<span class="sync-badge">Saving…</span>` : '';

        newCard.innerHTML = `
            <div class="item-card-left">
                <div class="item-header" onclick="this.closest('.item-card-left').classList.toggle('expanded')">
                    <div class="item-header-text">
                        <h3>${safeName} ${syncBadge}</h3>
                        ${safeSpecs ? `<p class="item-spec">${safeSpecs}</p>` : ''}
                    </div>
                    <svg class="mobile-expand-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
                <div class="item-details-row">
                    ${safeSN ? `<span class="detail-pill sn-copy" onclick="copySN('${safeSN.replace(/'/g, "\\'")}', this)">
                        <span class="detail-label">SN:</span> <span class="detail-value">${safeSN}</span>
                    </span>` : ''}
                    <span class="detail-pill">
                        <span class="detail-label">Purchased:</span> <span class="detail-value">${formattedDate}</span>
                    </span>
                    <span class="detail-pill">
                        <span class="detail-label">Warranty till:</span> <span class="detail-value">${formattedEnd}</span>
                    </span>
                </div>
            </div>
            <div class="item-card-right">
                <div class="item-card-actions-top">
                    <div class="warranty-counter ${isExpired ? 'expired' : ''}">${warrantyText}</div>
                    ${!isExpired && !item._syncing ? `<a href="#" class="file-claim-link" onclick="event.preventDefault(); openClaimModal('${safeName.replace(/'/g, "\\'")}')">File Claim</a>` : ''}
                </div>
                <div class="item-card-actions-bottom">
                    ${safeDriveUrl ? `<a href="${safeDriveUrl}" target="_blank" class="invoice-btn">📄 View Invoice</a>` : ''}
                    ${!item._syncing ? `<button class="delete-btn" title="Delete Item" onclick="deleteItem('${safeName.replace(/'/g, "\\'")}', '${safeSN ? safeSN.replace(/'/g, "\\'") : ''}', '${safeDriveUrl || ''}')">🗑️</button>` : ''}
                </div>
            </div>
        `;
        dashboardContent.appendChild(newCard);
    });
}

// Debounce helper for high-performance search typing
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

const debouncedRenderItems = debounce(renderItems, 250);

searchInput.addEventListener('input', debouncedRenderItems);
sortSelect.addEventListener('change', renderItems);

profileBtn.addEventListener('click', () => {
    if (profileContent.style.display === 'block') {
        profileContent.style.display = 'none';
        dashboardContent.style.display = 'grid';
    } else {
        dashboardContent.style.display = 'none';
        profileContent.style.display = 'block';
    }
});

// Feature removed due to password hashing security upgrade
// viewPasswordBtn.addEventListener('click', async () => { ... });

// Edit Profile Fields Logic (Mock Frontend)
function setupEditToggle(inputEl, btnEl, fieldName) {
    btnEl.addEventListener('click', async () => {
        if (inputEl.hasAttribute('readonly')) {
            // Enable editing
            inputEl.removeAttribute('readonly');
            inputEl.removeAttribute('disabled');
            inputEl.focus();
            
            // If it's a password field and currently hidden, clear the "********"
            if (fieldName === 'Password' && inputEl.type === 'password' && inputEl.value === '********') {
                inputEl.value = '';
            }
            
            btnEl.textContent = 'Save';
            btnEl.classList.remove('secondary');
            btnEl.classList.add('primary');
        } else {
            // Save logic to backend
            const newValue = inputEl.value.trim();
            const originalValue = fieldName === 'Name' ? currentUser.name : 
                                  fieldName === 'Contact' ? currentUser.contact : 
                                  '********';

            // Optimistic UI updates
            inputEl.setAttribute('readonly', 'true');
            inputEl.setAttribute('disabled', 'true');
            btnEl.textContent = 'Saving...';
            btnEl.disabled = true;
            
            // Backend call
            const result = await fetchBackend('update_profile', {
                username: currentUser.username,
                field: fieldName,
                value: newValue
            });
            
            btnEl.disabled = false;
            
            if (result.success) {
                btnEl.textContent = fieldName === 'Password' ? 'Change' : 'Edit';
                btnEl.classList.remove('primary');
                btnEl.classList.add('secondary');
                
                // Update global state
                if (fieldName === 'Name') {
                    clientNameEl.textContent = newValue;
                    if (currentUser) currentUser.name = newValue;
                }
                if (fieldName === 'Contact') {
                    if (currentUser) currentUser.contact = newValue;
                }
                
                // Always clear password input after change
                if (fieldName === 'Password') {
                    inputEl.value = '********';
                }
                
                // Optional: show a small toast or inline success here
                
            } else {
                // Revert on failure
                alert(result.message || `Failed to update ${fieldName}`);
                inputEl.removeAttribute('readonly');
                inputEl.removeAttribute('disabled');
                btnEl.textContent = 'Save';
                if (fieldName !== 'Password') {
                    inputEl.value = originalValue;
                }
            }
        }
    });
}

setupEditToggle(profileName, editNameBtn, 'Name');
setupEditToggle(profileContact, editContactBtn, 'Contact');
setupEditToggle(profilePassword, editPasswordBtn, 'Password');

// Logout
logoutBtn.addEventListener('click', () => {
    showView(loginView);
    emailForm.reset();
    loginError.textContent = "";
    currentUser = null;
    
    // Reset all profile view state
    profileUsername.value = '';
    profileName.value = '';
    profileEmail.value = '';
    profileContact.value = '';
    profilePassword.value = '********';
    
    // Reset edit button states
    [editNameBtn, editContactBtn, editPasswordBtn].forEach(btn => {
        btn.textContent = btn === editPasswordBtn ? 'Change' : 'Edit';
        btn.classList.remove('primary');
        btn.classList.add('secondary');
    });
    [profileName, profileContact, profilePassword].forEach(input => {
        input.setAttribute('readonly', 'true');
        input.setAttribute('disabled', 'true');
    });
    
    // Hide profile, ready for next login
    profileContent.style.display = 'none';
    dashboardContent.style.display = 'grid';
    
    stopInactivityTimer();
});

// --- Inactivity Auto-Logout ---
function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    if (currentUser) {
        // 15 minutes = 900,000 ms
        inactivityTimer = setTimeout(() => {
            alert("Your session has expired due to inactivity.");
            logoutBtn.click();
        }, 900000);
    }
}

function stopInactivityTimer() {
    clearTimeout(inactivityTimer);
}

// Listen to user activity to reset timer
['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => 
    window.addEventListener(evt, resetInactivityTimer, { passive: true })
);

// --- (Old duplicate removed — transitionToDashboard is now defined above line 345) ---

// --- Modal Logic ---

// Extra DOM refs for new fields
const specInput = document.getElementById('item-specs');
const specCharCount = document.getElementById('spec-char-count');
const extWarrantyToggle = document.getElementById('item-ext-warranty');
const extWarrantyField = document.getElementById('ext-warranty-field');
const fileDropArea = document.getElementById('file-drop-area');
const fileInput2 = document.getElementById('item-invoice');
const fileNameDisplay = document.getElementById('file-name-display');
const fileUploadError = document.getElementById('file-upload-error');

// Spec character counter
specInput.addEventListener('input', () => {
    specCharCount.textContent = `(${specInput.value.length}/80)`;
});

// Extended warranty toggle
extWarrantyToggle.addEventListener('change', () => {
    if (extWarrantyToggle.checked) {
        extWarrantyField.classList.add('visible');
    } else {
        extWarrantyField.classList.remove('visible');
        document.getElementById('item-ext-val').value = '';
        document.getElementById('item-ext-unit').selectedIndex = 2; // Reset to 'Years'
    }
});

// File upload area click
fileDropArea.addEventListener('click', () => fileInput2.click());

fileInput2.addEventListener('change', () => {
    fileUploadError.textContent = "";
    const file = fileInput2.files[0];
    if (!file) {
        fileNameDisplay.textContent = "";
        return;
    }
    // Size limit temporarily removed for testing
    /*
    if (file.size > 50 * 1024) {
        fileUploadError.textContent = `File "${file.name}" exceeds 50 KB limit.`;
        fileInput2.value = "";
        fileNameDisplay.textContent = "";
        return;
    }
    */
    fileNameDisplay.textContent = file.name;
});

// Drag & drop
fileDropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropArea.style.borderColor = 'var(--accent-color)';
});
fileDropArea.addEventListener('dragleave', () => {
    fileDropArea.style.borderColor = '';
});
fileDropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropArea.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) {
        // Size limit temporarily removed for testing
        /*
        if (file.size > 50 * 1024) {
            fileUploadError.textContent = `File "${file.name}" exceeds 50 KB limit.`;
            return;
        }
        */
        // Assign dropped file to the input
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput2.files = dt.files;
        fileNameDisplay.textContent = file.name;
        fileUploadError.textContent = "";
    }
});

// Open / Close modal
addItemFab.addEventListener('click', () => {
    addItemModal.classList.add('active');
});

closeModalBtn.addEventListener('click', () => {
    addItemModal.classList.remove('active');
    resetAddForm();
});

// --- New Modals Logic (Warranty Claim & Forgot Password) ---

// Open Claim Modal (Global function for onclick)
window.openClaimModal = function(itemName) {
    currentClaimItem = itemName;
    claimItemNameLabel.textContent = itemName;
    claimForm.reset();
    if(claimStatus) claimStatus.textContent = '';
    
    // Reset Template UI
    claimOutputSection.style.display = 'none';
    copyStatus.textContent = '';
    
    claimModal.classList.add('active');
};

[closeClaimModalBtn, cancelClaimBtn].forEach(btn => {
    if(btn) btn.addEventListener('click', () => claimModal.classList.remove('active'));
});

claimForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submit-claim-btn');
    
    let displayName = claimDisplayName.value.trim();
    if (!displayName) {
        displayName = currentUser.name; // Fallback to profile name
    }
    
    // Find the full item object from currentHardware
    const item = currentHardware.find(h => h.itemName === currentClaimItem);
    
    if (!item) {
        alert("Error: Item data not found.");
        return;
    }

    const issueText = claimIssue.value.trim();

    // Generate Template Text
    const templateText = `Subject: Warranty Claim Request - ${item.itemName}

To the Warranty Department,

I am writing to formally file a warranty claim for my ${item.itemName}, which was purchased on ${item.purchaseDate.split('T')[0]}.

Item Details:
- Serial / Model Number: ${item.serialNumber || 'N/A'}
- Specifications: ${item.specs || 'N/A'}

Description of Issue:
${issueText}

Please find a copy of my original purchase invoice attached to this message for your reference. Kindly let me know the next steps required to resolve this issue.

Thank you,
${displayName}`;

    // Show output
    claimTemplateOutput.value = templateText;
    claimOutputSection.style.display = 'block';
    copyStatus.textContent = '';
    
    // Check if there is an invoice
    if (item.driveUrl) {
        downloadInvoiceBtn.style.display = 'block';
        downloadInvoiceBtn.onclick = () => window.open(item.driveUrl, '_blank');
    } else {
        downloadInvoiceBtn.style.display = 'none';
    }
});

// Copy Template Logic
copyTemplateBtn.addEventListener('click', () => {
    claimTemplateOutput.select();
    claimTemplateOutput.setSelectionRange(0, 99999); // For mobile devices
    
    try {
        navigator.clipboard.writeText(claimTemplateOutput.value).then(() => {
            copyStatus.textContent = "Template copied to clipboard!";
            copyStatus.className = "status-msg success";
        }).catch(err => {
            console.error("Async clipboard copy failed:", err);
            // Fallback
            document.execCommand('copy');
            copyStatus.textContent = "Template copied to clipboard!";
            copyStatus.className = "status-msg success";
        });
    } catch (err) {
        console.error("Clipboard API failed:", err);
        document.execCommand('copy');
        copyStatus.textContent = "Template copied to clipboard!";
        copyStatus.className = "status-msg success";
    }
});

// Forgot Password Logic
if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotPasswordForm.reset();
        forgotStatus.textContent = '';
        forgotPasswordModal.classList.add('active');
    });
}

if (closeForgotModalBtn) {
    closeForgotModalBtn.addEventListener('click', () => {
        forgotPasswordModal.classList.remove('active');
    });
}

forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-forgot-btn');
    btn.textContent = 'Sending...';
    btn.disabled = true;
    forgotStatus.textContent = '';
    
    const result = await fetchBackend('reset_password', { username: forgotUsername.value.trim() });
    
    btn.textContent = 'Send Temporary Password';
    btn.disabled = false;
    
    if (result.success) {
        alert("If the username exists, a temporary password has been emailed to the address on file.");
        forgotPasswordModal.classList.remove('active');
    } else {
        forgotStatus.textContent = result.message || "Failed to process request.";
    }
});

// Click outside modals to close them
window.addEventListener('click', (e) => {
    if (e.target === addItemModal) {
        addItemModal.classList.remove('active');
        resetAddForm();
    }
    if (e.target === claimModal) {
        claimModal.classList.remove('active');
    }
    if (e.target === forgotPasswordModal) {
        forgotPasswordModal.classList.remove('active');
    }
});


// Input validation for warranty fields
function validateWarrantyInput(valInput, unitSelect, errorElement) {
    const val = valInput.value;
    const unit = unitSelect.value;
    
    if (!val) {
        errorElement.textContent = "";
        return true;
    }
    
    const num = parseFloat(val);
    if (unit === 'years') {
        if (!/^\d+(\.\d)?$/.test(val)) {
            errorElement.textContent = "Years can have max 1 decimal place (e.g. 1.5).";
            return false;
        }
    } else {
        if (!Number.isInteger(num) || num < 1) {
            errorElement.textContent = "Days and Months must be whole numbers.";
            return false;
        }
    }
    errorElement.textContent = "";
    return true;
}

const warrantyVal = document.getElementById('item-warranty-val');
const warrantyUnit = document.getElementById('item-warranty-unit');
const warrantyError = document.getElementById('warranty-error');

const extWarrantyVal = document.getElementById('item-ext-val');
const extWarrantyUnit = document.getElementById('item-ext-unit');
const extWarrantyError = document.getElementById('ext-warranty-error');

warrantyVal.addEventListener('input', () => validateWarrantyInput(warrantyVal, warrantyUnit, warrantyError));
warrantyUnit.addEventListener('change', () => validateWarrantyInput(warrantyVal, warrantyUnit, warrantyError));

extWarrantyVal.addEventListener('input', () => validateWarrantyInput(extWarrantyVal, extWarrantyUnit, extWarrantyError));
extWarrantyUnit.addEventListener('change', () => validateWarrantyInput(extWarrantyVal, extWarrantyUnit, extWarrantyError));


// Submit
addItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate
    const isMainValid = validateWarrantyInput(warrantyVal, warrantyUnit, warrantyError);
    const hasExtWarranty = extWarrantyToggle.checked;
    let isExtValid = true;
    if (hasExtWarranty) {
        isExtValid = validateWarrantyInput(extWarrantyVal, extWarrantyUnit, extWarrantyError);
        if (!extWarrantyVal.value) {
            extWarrantyError.textContent = "Please enter an extended warranty period.";
            isExtValid = false;
        }
    }

    if (!isMainValid || !isExtValid) return;

    const itemName = document.getElementById('item-name').value;
    const itemSerial = document.getElementById('item-serial').value;
    const itemSpecs = document.getElementById('item-specs').value;
    const itemDate = document.getElementById('item-date').value;
    const submitBtn = addItemForm.querySelector('button[type="submit"]');

    // Calculate warranty end date
    const purchaseDate = new Date(itemDate);
    const warrantyEnd = new Date(purchaseDate);

    function addDuration(date, val, unit) {
        const num = parseFloat(val);
        if (unit === 'years') {
            date.setMonth(date.getMonth() + (num * 12));
        } else if (unit === 'months') {
            date.setMonth(date.getMonth() + num);
        } else if (unit === 'days') {
            date.setDate(date.getDate() + num);
        }
    }

    addDuration(warrantyEnd, warrantyVal.value, warrantyUnit.value);
    if (hasExtWarranty) {
        addDuration(warrantyEnd, extWarrantyVal.value, extWarrantyUnit.value);
    }

    // Read file before closing modal (needs DOM access)
    let fileBase64 = null;
    let fileName = null;
    let mimeType = null;
    const file = fileInput2.files[0];

    // Quick button flash to confirm click
    submitBtn.textContent = "Adding...";
    submitBtn.disabled = true;

    try {
        if (file) {
            fileBase64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = error => reject(error);
                reader.readAsDataURL(file);
            });
            fileName = file.name;
            mimeType = file.type;
        }
    } catch (readErr) {
        console.error("File read error:", readErr);
        submitBtn.textContent = "Add Item";
        submitBtn.disabled = false;
        alert("Could not read the selected file. Please try again.");
        return;
    }

    // --- OPTIMISTIC UI: Instantly show the item & close modal ---
    const optimisticItem = {
        itemName: itemName,
        serialNumber: itemSerial,
        specs: itemSpecs,
        purchaseDate: itemDate,
        warrantyEndDate: warrantyEnd.toISOString(),
        driveUrl: '', // Pending — will be filled by backend
        _parsedPurchase: new Date(itemDate).getTime(),
        _parsedWarrantyEnd: warrantyEnd.getTime(),
        _syncing: true // Flag for the syncing indicator
    };

    currentHardware.push(optimisticItem);
    renderItems();

    // Close modal & reset form instantly
    resetAddForm();
    addItemModal.classList.remove('active');
    submitBtn.textContent = "Add Item";
    submitBtn.disabled = false;

    // --- BACKGROUND: Send to backend silently ---
    const payload = {
        username: currentUser.username,
        itemName: itemName,
        serialNumber: itemSerial,
        specs: itemSpecs,
        purchaseDate: itemDate,
        warrantyEndDate: warrantyEnd.toISOString(),
        fileBase64: fileBase64,
        fileName: fileName,
        mimeType: mimeType
    };

    try {
        const result = await fetchBackend('add_hardware', payload);

        if (result.success) {
            // Backend confirmed — update the optimistic item with real data
            optimisticItem.driveUrl = result.driveUrl || '';
            optimisticItem._syncing = false;
            renderItems(); // Re-render to remove syncing indicator
        } else {
            // Backend rejected — rollback the optimistic item
            const idx = currentHardware.indexOf(optimisticItem);
            if (idx > -1) currentHardware.splice(idx, 1);
            renderItems();
            alert("Failed to save item: " + (result.message || "Unknown error. Please try again."));
        }
    } catch (netErr) {
        // Network failure — rollback
        const idx = currentHardware.indexOf(optimisticItem);
        if (idx > -1) currentHardware.splice(idx, 1);
        renderItems();
        alert("Network error while saving. The item was not saved. Please try again.");
    }
});

function resetAddForm() {
    addItemForm.reset();
    specCharCount.textContent = '(0/80)';
    extWarrantyField.classList.remove('visible');
    fileNameDisplay.textContent = '';
    fileUploadError.textContent = '';
}

// --- MOCK BACKEND FOR TESTING ---
function mockBackend(action, data) {
    console.log(`[Mock API] Action: ${action}`, data);
    return new Promise(resolve => {
        setTimeout(() => {
            if (action === 'login' && data.type === 'google') {
                resolve({ success: true, requiresProfileSetup: true, email: "test@google.com", name: "Google User" });
            } else if (action === 'check_username') {
                const isTaken = data.username.toLowerCase() === 'admin';
                resolve({ success: true, available: !isTaken });
            } else if (action === 'release_username') {
                resolve({ success: true, released: true });
            } else if (action === 'register_user') {
                resolve({ success: true, registered: true });
            } else if (action === 'login' && data.type === 'email_or_username') {
                resolve({ 
                    success: true, 
                    clientData: { name: "Test User", username: data.identifier, email: "test@example.com", contact: "+91 98765 43210" } 
                });
            } else if (action === 'get_password') {
                resolve({ success: true, password: "MySecretPassword123" });
            } else if (action === 'update_profile') {
                // Mock rate limit
                if (data.field === 'Name' && data.value === 'limit') {
                     resolve({ success: false, message: 'Name can only be changed once a week.'});
                } else {
                     resolve({ success: true, updated: true });
                }
            } else {
                resolve({ success: false, message: "Mock error." });
            }
        }, 500);
    });
}

// Helper function for inline onclick copy
window.copySN = function(sn, el) {
    navigator.clipboard.writeText(sn).then(() => {
        el.classList.add('copied');
        setTimeout(() => el.classList.remove('copied'), 2000);
    }).catch(err => {
        console.error("Failed to copy SN", err);
    });
};

// --- DELETE FUNCTIONALITY ---
window.deleteItem = async function(itemName, serialNumber, driveUrl) {
    if (!confirm(`Are you sure you want to delete "${itemName}"?\nThis action cannot be undone.`)) {
        return;
    }

    const payload = {
        username: currentUser.username,
        itemName: itemName,
        serialNumber: serialNumber,
        driveUrl: driveUrl
    };

    try {
        // Optimistically remove from UI
        const previousHardware = [...currentHardware];
        currentHardware = currentHardware.filter(item => 
            !(item.itemName === itemName && item.serialNumber === serialNumber)
        );
        renderItems();

        const result = await fetchBackend('delete_hardware', payload);
        
        if (!result.success) {
            // Revert on failure
            currentHardware = previousHardware;
            renderItems();
            alert("Failed to delete item: " + result.message);
        }
    } catch (e) {
        console.error(e);
        alert("An error occurred while deleting.");
    }
};
