// Authentication and User Management System with Firebase
document.addEventListener('DOMContentLoaded', function() {
    console.log("Auth.js loaded with Firebase");
    
    // Listen for auth state changes
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log("User is signed in:", user.email);
        } else {
            console.log("No user is signed in");
        }
    });
    
    // Initialize admin modal if on login page
    if (document.getElementById('admin-access')) {
        initAdminAccess();
    }
    
    // Check auth state based on current page
    checkAuth();
    
    // Handle form submissions
    const loginForm = document.getElementById('login-form');
    const adminLoginForm = document.getElementById('admin-login-form');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLogin);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // If on profile page, load user data
    if (window.location.pathname.includes('profile.html')) {
        loadUserProfile();
    }
});

// Initialize Admin Access
function initAdminAccess() {
    console.log("Initializing admin access");
    const adminBtn = document.getElementById('admin-access');
    const adminModal = document.getElementById('admin-modal');
    const closeBtn = adminModal.querySelector('.close');
    
    // Open modal when admin button is clicked
    adminBtn.addEventListener('click', function() {
        adminModal.style.display = 'block';
    });
    
    // Close modal when X is clicked
    closeBtn.addEventListener('click', function() {
        adminModal.style.display = 'none';
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === adminModal) {
            adminModal.style.display = 'none';
        }
    });
}

// Get base path for determining correct URLs
function getBasePath() {
    const path = window.location.pathname;
    // Handles GitHub Pages like /RepoName/path/to/file.html -> /RepoName/
    // Handles local served from subdir like /ProjectFolder/path/to/file.html -> /ProjectFolder/
    // Handles local served from root like /path/to/file.html -> /
    const segments = path.split('/').filter(segment => segment.length > 0);

    // Common repository/project names used in this project.
    // Order matters if one is a substring of another, but not in this case.
    const projectFolders = ['Irismapper', 'Irismapper-main'];

    for (const folder of projectFolders) {
        if (segments.length > 0 && segments[0] === folder) {
            return `/${folder}/`;
        }
    }
    // If not in a recognized project subfolder (e.g. served from root, or a different structure)
    return '/';
}

// Check Authentication Status
function checkAuth() {
    console.log("Checking authentication");
    
    const path = window.location.pathname;
    const basePath = getBasePath();
    
    console.log("Current path:", path);
    console.log("Base path:", basePath);
    
    const isAdminPanel = path.includes('admin-panel.html');
    const isProfilePage = path.includes('profile.html');
    const isLoginPage = path.includes('login.html');
    // Main app pages are index.html or paths including Irismapper-main, EXCLUDING specific auth/profile/admin pages
    const isMainAppPage = (path.includes('index.html') || path.includes('Irismapper-main')) && 
                          !isLoginPage && !isAdminPanel && !isProfilePage;
    
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            // User is signed in
            if (isLoginPage) {
                console.log("User is authenticated, redirecting from login to app");
                window.location.href = basePath + 'index.html';
                return; // Prevent further execution for login page if redirecting
            }

            // Add user controls (like Profile button) if on a main app page
            if (isMainAppPage) {
                addUserControlsToMainApp();
            }

            // Specific check for admin panel access
            if (isAdminPanel) {
                checkAdminStatus().then(isAdmin => {
                    if (!isAdmin && !isLoginPage) { // Redirect if not admin AND not already on login page
                        console.log("Redirecting to login: user is not an admin for admin panel");
                        window.location.href = basePath + 'login.html';
                    }
                });
            }
            // No specific redirection needed from checkAuth for isProfilePage if user is logged in,
            // as loadUserProfile will handle data loading. The DOMContentLoaded already calls loadUserProfile.

        } else {
            // No user is signed in - protect pages
            if (isAdminPanel && !isLoginPage) {
                console.log("Redirecting to login: not authenticated for admin panel");
                window.location.href = basePath + 'login.html';
            } else if (isProfilePage && !isLoginPage) {
                console.log("Redirecting to login: not authenticated for profile page");
                window.location.href = basePath + 'login.html';
            } else if (isMainAppPage && !isLoginPage) { // isMainAppPage is already exclusive
                console.log("Redirecting to login: not authenticated for main app page");
                window.location.href = basePath + 'login.html';
            }
        }
    });
}

// Add user controls to main app
function addUserControlsToMainApp() {
    // Check if controls already exist
    if (document.getElementById('user-controls')) {
        return;
    }
    
    console.log("Creating user controls");
    
    // Create user controls container
    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'user-controls';
    controlsDiv.className = 'user-controls';
    
    // Get base path for correct URLs
    const basePath = getBasePath();
    
    // Determine profile link path
    const profilePath = basePath + 'profile.html';
    
    // Create profile link
    const profileLink = document.createElement('a');
    profileLink.href = profilePath;
    profileLink.innerText = 'Profile';
    profileLink.className = 'user-control-btn';
    
    // Create logout button
    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'logout-btn-main';
    logoutBtn.innerText = 'Logout';
    logoutBtn.className = 'user-control-btn secondary';
    logoutBtn.addEventListener('click', handleLogout);
    
    // Add elements to container
    controlsDiv.appendChild(profileLink);
    controlsDiv.appendChild(logoutBtn);
    
    // Add container to body
    document.body.appendChild(controlsDiv);
    
    console.log("User controls added with profile path:", profilePath);
}

// Modified version of handleLogin function with better error handling
async function handleLogin(e) {
    e.preventDefault();
    console.log("Processing login");
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-message');
    
    try {
        // Sign in with Firebase Authentication first
        console.log("Attempting to sign in with Firebase Authentication");
        await firebase.auth().signInWithEmailAndPassword(email, password);
        
        // Check if user exists in Firestore
        console.log("Checking user in Firestore");
        const uid = firebase.auth().currentUser.uid;
        
        try {
            const userDoc = await db.collection('users').doc(uid).get();
            
            if (!userDoc.exists) {
                console.log("User document doesn't exist in Firestore, creating it now");
                
                // Create user document if it doesn't exist
                await db.collection('users').doc(uid).set({
                    email: email,
                    name: email.split('@')[0], // Default name from email
                    status: 'active',
                    isAdmin: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastModified: firebase.firestore.FieldValue.serverTimestamp(),
                    modifiedBy: 'system'
                });
                
                console.log("User document created successfully");
            } else {
                console.log("User document found in Firestore");
                
                // Check if user is active
                const userData = userDoc.data();
                if (userData.status === 'inactive') {
                    console.log("User account is inactive");
                    await firebase.auth().signOut();
                    showError(errorMsg, 'Your account is inactive. Please contact support.');
                    return;
                }
            }
            
            // Get base path for redirection
            const basePath = getBasePath();
            
            console.log("Login successful, redirecting to app");
            
            // Redirect to app with correct path
            window.location.href = basePath + 'index.html';
        } catch (firestoreError) {
            console.error("Error checking user in Firestore:", firestoreError);
            
            // If we can't access Firestore but Auth succeeded, still allow login
            // This makes the app more resilient to temporary Firestore issues
            console.log("Continuing login despite Firestore error");
            
            const basePath = getBasePath();
            window.location.href = basePath + 'index.html';
        }
    } catch (error) {
        console.error("Login error:", error);
        showError(errorMsg, error.message || 'Invalid email or password');
    }
}

// Admin Login
async function handleAdminLogin(e) {
    e.preventDefault();
    console.log("Processing admin login");
    
    const ADMIN_EMAIL = 'team@irislab.com';
    
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;
    const errorMsg = document.getElementById('admin-error');
    
    try {
        // Attempt Firebase authentication
        await firebase.auth().signInWithEmailAndPassword(email, password);
        
        // Check if user is admin in Firestore
        const userDoc = await db.collection('users').doc(firebase.auth().currentUser.uid).get();
        
        if (!userDoc.exists || !userDoc.data().isAdmin) {
            // Not an admin, sign out and show error
            await firebase.auth().signOut();
            showError(errorMsg, 'You do not have admin privileges');
            return;
        }
        
        // Get base path
        const basePath = getBasePath();
        
        console.log("Admin login successful, redirecting to admin panel");
        
        // Redirect to admin panel
        window.location.href = basePath + 'admin-panel.html';
    } catch (error) {
        console.error("Admin login error:", error);
        showError(errorMsg, error.message || 'Invalid admin credentials');
    }
}

// User Logout
async function handleLogout() {
    console.log("Processing logout");
    
    try {
        await firebase.auth().signOut();
        
        // Get base path for redirection
        const basePath = getBasePath();
        
        console.log("Determining logout redirect path from basePath:", basePath);
        
        // Determine login page path based on current location
        const loginPath = basePath + 'login.html';
        
        console.log("Logout redirect path:", loginPath);
        window.location.href = loginPath;
    } catch (error) {
        console.error("Logout error:", error);
    }
}

// Load User Profile
async function loadUserProfile() {
    console.log("Loading user profile");
    
    const nameEl = document.getElementById('profile-name');
    const emailEl = document.getElementById('profile-email');
    const createdEl = document.getElementById('profile-created');

    try {
        const user = firebase.auth().currentUser;
        const basePath = getBasePath();
        const isLoginPage = window.location.pathname.includes('login.html');

        if (!user) {
            if (!isLoginPage) {
                console.log("User not authenticated in loadUserProfile, redirecting to login.");
                window.location.href = basePath + 'login.html';
            }
            return;
        }
        
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            console.error("User document not found for UID:", user.uid);
            if (nameEl) nameEl.textContent = 'User data not found.';
            if (emailEl) emailEl.textContent = 'N/A';
            if (createdEl) createdEl.textContent = 'N/A';
            return;
        }
        
        const userData = userDoc.data();
        
        if (nameEl) nameEl.textContent = userData.name || user.displayName || 'No name provided';
        if (emailEl) emailEl.textContent = userData.email || user.email;
        
        if (createdEl) {
            if (userData.createdAt && typeof userData.createdAt.toDate === 'function') {
                const createdDate = userData.createdAt.toDate();
                createdEl.textContent = createdDate.toLocaleDateString();
            } else {
                console.warn("User 'createdAt' field is missing or not a Firebase Timestamp for UID:", user.uid);
                createdEl.textContent = 'Not available';
            }
        }
        
        setupAppLink();
    } catch (error) {
        console.error("Error loading profile:", error);
        if (nameEl) nameEl.textContent = 'Error loading profile data.';
        if (emailEl) emailEl.textContent = 'Error';
        if (createdEl) createdEl.textContent = 'Error';
    }
}

// Set up app link with correct path
function setupAppLink() {
    const appLink = document.getElementById('app-link');
    if (!appLink) return;
    
    const basePath = getBasePath();
    const appPath = basePath + 'index.html'; // Link back to the main index page
    
    appLink.href = appPath;
    console.log("App link on profile page set to:", appPath);
}

// Check if current user is admin
async function checkAdminStatus() {
    try {
        const user = firebase.auth().currentUser;
        
        if (!user) {
            return false;
        }
        
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            return false;
        }
        
        return userDoc.data().isAdmin === true;
    } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
}

// Helper Functions for User Management

// Get all users from Firestore
async function getUsers() {
    try {
        const usersSnapshot = await db.collection('users').get();
        
        if (usersSnapshot.empty) {
            return [];
        }
        
        return usersSnapshot.docs.map(doc => {
            const data = doc.data();
            // Convert Firestore timestamp to string
            if (data.createdAt) {
                data.createdAt = data.createdAt.toDate().toISOString();
            }
            if (data.lastModified) {
                data.lastModified = data.lastModified.toDate().toISOString();
            }
            return {
                id: doc.id,
                ...data
            };
        });
    } catch (error) {
        console.error("Error getting users:", error);
        return [];
    }
}

// Modified version of createUser function to ensure Firestore document is created
async function createUser(userData) {
    try {
        console.log("Creating user in Firebase Authentication:", userData.email);
        
        // Create user in Firebase Auth
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(
            userData.email, 
            userData.password
        );
        
        const uid = userCredential.user.uid;
        console.log("User created in Authentication with UID:", uid);
        
        // Store additional user data in Firestore
        console.log("Creating user document in Firestore");
        const userDocRef = db.collection('users').doc(uid);
        
        // Create user data object without the password
        const userDataForFirestore = {
            name: userData.name,
            email: userData.email,
            status: userData.status || 'active',
            isAdmin: userData.isAdmin || false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastModified: firebase.firestore.FieldValue.serverTimestamp(),
            modifiedBy: userData.modifiedBy || 'system'
        };
        
        // Set the document with error handling
        try {
            await userDocRef.set(userDataForFirestore);
            console.log("User document created in Firestore successfully");
        } catch (firestoreError) {
            console.error("Error creating user document in Firestore:", firestoreError);
            // If Firestore fails but Auth succeeded, we should still consider it a success
            // but log the error for troubleshooting
        }
        
        return {
            success: true,
            userId: uid
        };
    } catch (error) {
        console.error("Error creating user:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Update user status in Firestore
async function updateUserStatus(userId, status, modifiedBy) {
    try {
        await db.collection('users').doc(userId).update({
            status: status,
            lastModified: firebase.firestore.FieldValue.serverTimestamp(),
            modifiedBy: modifiedBy || 'system'
        });
        
        return {
            success: true
        };
    } catch (error) {
        console.error("Error updating user status:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Utility functions

// Show error message
function showError(element, message) {
    if (!element) return;
    
    element.textContent = message;
    element.classList.add('active');
    
    // Hide after 3 seconds
    setTimeout(() => {
        element.classList.remove('active');
    }, 3000);
}

// Show success message
function showSuccess(element, message) {
    if (!element) return;
    
    element.textContent = message;
    element.classList.add('active');
    
    // Hide after 3 seconds
    setTimeout(() => {
        element.classList.remove('active');
    }, 3000);
}

// Generate random password
function generateRandomPassword(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let password = '';
    
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return password;
}

// Export functions for admin.js to use
window.getUsers = getUsers;
window.createUser = createUser;
window.updateUserStatus = updateUserStatus;
window.checkAdminStatus = checkAdminStatus;
window.showError = showError;
window.showSuccess = showSuccess;
window.generateRandomPassword = generateRandomPassword;

// Also modify the initialization function to be more robust
async function initializeAdminUser() {
    try {
        console.log("Checking for admin user");
        
        // Check if admin user exists in Authentication
        try {
            const adminSnapshot = await firebase.auth().fetchSignInMethodsForEmail('team@irislab.com');
            
            if (adminSnapshot && adminSnapshot.length > 0) {
                console.log("Admin user already exists in Authentication");
            } else {
                console.log("Admin user doesn't exist in Authentication, creating it");
                
                // Create admin user data
                const adminUserData = {
                    name: "Admin User",
                    email: "team@irislab.com",
                    password: "IrisAdmin2025!",
                    status: "active",
                    isAdmin: true,
                    modifiedBy: "system"
                };
                
                // Create admin user
                const result = await createUser(adminUserData);
                
                if (result.success) {
                    console.log("Admin user created successfully");
                } else {
                    console.error("Failed to create admin user:", result.error);
                }
            }
        } catch (authError) {
            console.error("Error checking admin user in Authentication:", authError);
        }
        
        // Make sure admin user exists in Firestore regardless of Authentication status
        try {
            const adminQuery = await db.collection('users')
                .where('email', '==', 'team@irislab.com')
                .where('isAdmin', '==', true)
                .limit(1)
                .get();
            
            if (!adminQuery.empty) {
                console.log("Admin user exists in Firestore");
            } else {
                console.log("Admin user doesn't exist in Firestore, checking if they exist in Authentication");
                
                // Try to find user by email in Authentication
                try {
                    const adminSignInMethods = await firebase.auth().fetchSignInMethodsForEmail('team@irislab.com');
                    
                    if (adminSignInMethods && adminSignInMethods.length > 0) {
                        console.log("Admin exists in Authentication but not in Firestore, trying to sign in");
                        
                        // Try to sign in as admin to get the UID
                        try {
                            await firebase.auth().signInWithEmailAndPassword('team@irislab.com', 'IrisAdmin2025!');
                            const adminUid = firebase.auth().currentUser.uid;
                            
                            // Create Firestore document
                            await db.collection('users').doc(adminUid).set({
                                name: "Admin User",
                                email: "team@irislab.com",
                                status: "active",
                                isAdmin: true,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                lastModified: firebase.firestore.FieldValue.serverTimestamp(),
                                modifiedBy: "system"
                            });
                            
                            console.log("Created admin document in Firestore");
                            
                            // Sign out again
                            await firebase.auth().signOut();
                        } catch (signInError) {
                            console.error("Could not sign in as admin to create Firestore document:", signInError);
                        }
                    } else {
                        console.log("Admin doesn't exist in Authentication either, creating from scratch");
                        
                        // Create admin user
                        const adminUserData = {
                            name: "Admin User",
                            email: "team@irislab.com",
                            password: "IrisAdmin2025!",
                            status: "active",
                            isAdmin: true,
                            modifiedBy: "system"
                        };
                        
                        await createUser(adminUserData);
                    }
                } catch (error) {
                    console.error("Error checking admin in Authentication:", error);
                }
            }
        } catch (firestoreError) {
            console.error("Error checking admin user in Firestore:", firestoreError);
        }
    } catch (error) {
        console.error("Error initializing admin user:", error);
    }
} 