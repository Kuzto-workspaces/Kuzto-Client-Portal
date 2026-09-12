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

// Setup Inputs
const setupEmail = document.getElementById('setup-email');
const setupUsername = document.getElementById('setup-username');
const setupPassword = document.getElementById('setup-password');
const setupConfirm = document.getElementById('setup-confirm');
const checkUsernameBtn = document.getElementById('check-username-btn');
const setupSubmitBtn = document.getElementById('setup-submit-btn');
const setupCancelBtn = document.getElementById('setup-cancel-btn');

// Profile View Inputs
const profileUsername = document.getElementById('profile-username');
const profileEmail = document.getElementById('profile-email');
const profilePassword = document.getElementById('profile-password');
const viewPasswordBtn = document.getElementById('view-password-btn');

// Modal Elements
const addItemFab = document.getElementById('add-item-fab');
const addItemModal = document.getElementById('add-item-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const addItemForm = document.getElementById('add-item-form');

// Buttons
const profileBtn = document.getElementById('profile-fab');
const logoutBtn = document.getElementById('logout-btn');
const backToDashBtn = document.getElementById('back-to-dash-btn');
const clientNameEl = document.getElementById('client-name');

// State
let isUsernameAvailable = false;
let heldUsername = "";
let currentUser = null;

// --- Utility Functions ---
function showView(viewElement) {
    [loginView, profileSetupView, dashboardView].forEach(v => v.classList.remove('active'));
    viewElement.classList.add('active');
    
    // Toggle wide mode for dashboard
    if (viewElement === dashboardView) {
        container.classList.add('wide');
    } else {
        container.classList.remove('wide');
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
            showView(profileSetupView);
        } else {
            // Returning user
            transitionToDashboard(result.clientData);
        }
    } else {
        loginError.textContent = result.message || "Google Authentication failed.";
    }
}

// 2. Email or Username / Password Login
emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = "Logging in...";
    
    const identifier = document.getElementById('identifier').value;
    const password = document.getElementById('password').value;
    
    const result = await fetchBackend('login', { 
        type: 'email_or_username', 
        identifier: identifier, 
        password: password 
    });
    
    if (result.success) {
        transitionToDashboard(result.clientData);
    } else {
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
        name: "Client" // Default name
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

function transitionToDashboard(clientData) {
    currentUser = clientData;
    
    // Pre-parse timestamps for high-performance sorting on large loads
    currentHardware = (clientData.hardware || []).map(item => ({
        ...item,
        _parsedPurchase: new Date(item.purchaseDate).getTime(),
        _parsedWarrantyEnd: new Date(item.warrantyEndDate).getTime()
    }));

    showView(dashboardView);
    clientNameEl.textContent = clientData.name;
    
    // Default to showing dashboard content, hiding profile
    dashboardContent.style.display = 'grid';
    profileContent.style.display = 'none';

    // Populate profile fields
    profileUsername.value = clientData.username || "";
    profileEmail.value = clientData.email || "";
    profilePassword.value = "********";
    profilePassword.type = "password";

    renderItems();
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
        newCard.className = 'card item-card';
        newCard.innerHTML = `
            <div class="item-card-left">
                <h3>${item.itemName}</h3>
                ${item.specs ? `<p class="item-spec">${item.specs}</p>` : ''}
                <div class="item-details-row">
                    ${item.serialNumber ? `<span class="sn-copy" onclick="copySN('${item.serialNumber}', this)">SN: ${item.serialNumber}</span>` : ''}
                    <span>Purchased: ${formattedDate}</span>
                    <span>Warranty till: ${formattedEnd}</span>
                </div>
            </div>
            <div class="item-card-right">
                <div class="warranty-counter ${isExpired ? 'expired' : ''}">${warrantyText}</div>
                <div style="display: flex; align-items: center; gap: 0.5rem; justify-content: flex-end;">
                    ${item.driveUrl ? `<a href="${item.driveUrl}" target="_blank" class="invoice-btn">📄 View Invoice</a>` : ''}
                    <button class="delete-btn" title="Delete Item" onclick="deleteItem('${item.itemName.replace(/'/g, "\\'")}', '${item.serialNumber ? item.serialNumber.replace(/'/g, "\\'") : ''}', '${item.driveUrl || ''}')">🗑️</button>
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
        if (currentHardware.length > 0) dashboardControls.style.display = 'flex';
    } else {
        dashboardContent.style.display = 'none';
        dashboardControls.style.display = 'none';
        profileContent.style.display = 'block';
    }
});

backToDashBtn.addEventListener('click', () => {
    profileContent.style.display = 'none';
    dashboardContent.style.display = 'grid';
    if (currentHardware.length > 0) dashboardControls.style.display = 'flex';
});

// View Password feature (MVP requirement)
viewPasswordBtn.addEventListener('click', async () => {
    if (profilePassword.type === "password") {
        viewPasswordBtn.textContent = "Loading...";
        viewPasswordBtn.disabled = true;

        const result = await fetchBackend('get_password', { username: currentUser.username });
        
        if (result.success) {
            profilePassword.value = result.password;
            profilePassword.type = "text";
            viewPasswordBtn.textContent = "Hide";
        } else {
            alert("Error fetching password: " + result.message);
            viewPasswordBtn.textContent = "View";
        }
        viewPasswordBtn.disabled = false;
    } else {
        profilePassword.value = "********";
        profilePassword.type = "password";
        viewPasswordBtn.textContent = "View";
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    showView(loginView);
    emailForm.reset();
    loginError.textContent = "";
    currentUser = null;
    
    // Reset profile view state
    profilePassword.value = "********";
    profilePassword.type = "password";
    viewPasswordBtn.textContent = "View";
});

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
        document.getElementById('item-ext-period').selectedIndex = 0;
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

window.addEventListener('click', (e) => {
    if (e.target === addItemModal) {
        addItemModal.classList.remove('active');
        resetAddForm();
    }
});

function resetAddForm() {
    addItemForm.reset();
    specCharCount.textContent = '(0/80)';
    extWarrantyField.classList.remove('visible');
    fileNameDisplay.textContent = '';
    fileUploadError.textContent = '';
}

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

    const formattedEnd = warrantyEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    // File handling
    let fileBase64 = null;
    let fileName = null;
    let mimeType = null;
    
    const file = fileInput2.files[0];
    
    // UI Loading state
    submitBtn.textContent = "Saving...";
    submitBtn.disabled = true;

    try {
        if (file) {
            fileBase64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]); // get base64 part
                reader.onerror = error => reject(error);
                reader.readAsDataURL(file);
            });
            fileName = file.name;
            mimeType = file.type;
        }

        // Build Payload
        const payload = {
            username: currentUser.username, // From global state
            itemName: itemName,
            serialNumber: itemSerial,
            specs: itemSpecs,
            purchaseDate: itemDate, // YYYY-MM-DD
            warrantyEndDate: warrantyEnd.toISOString(),
            fileBase64: fileBase64,
            fileName: fileName,
            mimeType: mimeType
        };

        // Send to Backend
        const result = await fetchBackend('add_hardware', payload);

        if (result.success) {
            // Update local state and render (including pre-parsed dates)
            currentHardware.push({
                itemName: itemName,
                serialNumber: itemSerial,
                specs: itemSpecs,
                purchaseDate: itemDate,
                warrantyEndDate: warrantyEnd.toISOString(),
                driveUrl: result.driveUrl,
                _parsedPurchase: new Date(itemDate).getTime(),
                _parsedWarrantyEnd: warrantyEnd.getTime()
            });
            
            renderItems();

            // Reset and close
            resetAddForm();
            addItemModal.classList.remove('active');
        } else {
            alert("Error adding item: " + result.message);
        }
    } catch (e) {
        console.error(e);
        alert("An error occurred while saving.");
    } finally {
        submitBtn.textContent = "Add Item";
        submitBtn.disabled = false;
    }
});

// --- MOCK BACKEND FOR TESTING ---
function mockBackend(action, data) {
    console.log(`[Mock API] Action: ${action}`, data);
    return new Promise(resolve => {
        setTimeout(() => {
            if (action === 'login' && data.type === 'google') {
                resolve({ success: true, requiresProfileSetup: true, email: "test@google.com" });
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
                    clientData: { name: "Test User", username: data.identifier, email: "test@example.com" } 
                });
            } else if (action === 'get_password') {
                resolve({ success: true, password: "MySecretPassword123" });
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
