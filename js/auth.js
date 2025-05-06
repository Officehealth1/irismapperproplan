// Authentication and User Management System with Firebase
document.addEventListener('DOMContentLoaded', function() {
    console.log("Auth.js loaded with Firebase");
    
    // Listen for auth state changes (primarily for logging, checkAuth handles redirection)
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log("Global Auth State Change: User is signed in:", user.email);
        } else {
            console.log("Global Auth State Change: No user is signed in");
        }
    });
    
    // Initialize admin modal if on login page
    if (document.getElementById('admin-access')) {
        initAdminAccess();
    }
    
    // Check auth state based on current page - THIS IS THE MAIN AUTH GATEKEEPER
    checkAuth(); 
    
    // Handle form submissions for login/admin login
    const loginForm = document.getElementById('login-form');
    const adminLoginForm = document.getElementById('admin-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLogin);
    }
    
    // Handle logout button clicks (for buttons with id='logout-btn' like in profile/admin)
    // The logout button on index.html is handled in addUserControlsToMainApp
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // DO NOT call loadUserProfile here directly. checkAuth will handle it.
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
    const segments = path.split('/').filter(segment => segment.length > 0);

    // Ensure these are the canonical (lowercase) names of the project/repo folders
    const projectRepoNames = ['irismapper', 'irismapper-main', 'irismapperproplan'];

    if (segments.length > 0) {
        const firstSegmentLower = segments[0].toLowerCase();
        for (const repoName of projectRepoNames) {
            // repoName is already lowercase from the list
            if (firstSegmentLower === repoName) {
                return `/${repoName}/`; // Return the canonical (lowercase) repo name path
            }
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
    
    const isAdminPanel = path.includes('admin-panel.html');
    const isProfilePage = path.includes('profile.html');
    const isLoginPage = path.includes('login.html');
    const isMainAppPage = (path.includes('index.html') || path.includes('Irismapper-main')) && 
                          !isLoginPage && !isAdminPanel && !isProfilePage;
    
    firebase.auth().onAuthStateChanged((user) => {
        console.log("checkAuth - onAuthStateChanged fired. User:", user ? user.email : 'null', "Path:", path);
        if (user) {
            // User is signed in
            if (isLoginPage) {
                console.log("User is authenticated on login page, redirecting to app");
                window.location.href = basePath + 'index.html';
                return;
            }

            if (isMainAppPage) {
                addUserControlsToMainApp();
            }

            if (isAdminPanel) {
                checkAdminStatus().then(isAdmin => {
                    if (!isAdmin && !isLoginPage) {
                        console.log("User not admin for admin panel, redirecting to login");
                        window.location.href = basePath + 'login.html';
                    }
                });
            }

            if (isProfilePage) {
                console.log("User is authenticated on profile page, calling loadUserProfile.");
                loadUserProfile(user); // Pass the user object to avoid another fetch of currentUser
            }

        } else {
            // No user is signed in - protect pages
            console.log("User not authenticated. Path:", path, "isProfilePage:", isProfilePage, "isLoginPage:", isLoginPage);
            if (isAdminPanel && !isLoginPage) {
                console.log("Redirecting to login: not authenticated for admin panel");
                window.location.href = basePath + 'login.html';
            } else if (isProfilePage && !isLoginPage) {
                console.log("Redirecting to login: not authenticated for profile page");
                window.location.href = basePath + 'login.html';
            } else if (isMainAppPage && !isLoginPage) {
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

// Load User Profile - Modified to accept user object
async function loadUserProfile(authenticatedUser) {
    console.log("Loading user profile for:", authenticatedUser ? authenticatedUser.email : 'Unknown user');
    
    const nameEl = document.getElementById('profile-name');
    const emailEl = document.getElementById('profile-email');
    const createdEl = document.getElementById('profile-created');

    // Fallback if authenticatedUser is somehow null, though checkAuth should prevent this call
    if (!authenticatedUser) {
        console.error("loadUserProfile called without an authenticated user. This shouldn't happen.");
        const basePath = getBasePath();
        const isLoginPage = window.location.pathname.includes('login.html');
        if (!isLoginPage) {
             window.location.href = basePath + 'login.html';
        }
        return;
    }

    try {
        // We already have the user object from onAuthStateChanged, use its uid
        const userDoc = await db.collection('users').doc(authenticatedUser.uid).get();
        
        if (!userDoc.exists) {
            console.error("User document not found for UID:", authenticatedUser.uid);
            if (nameEl) nameEl.textContent = 'User data not found.';
            if (emailEl) emailEl.textContent = authenticatedUser.email || 'N/A (email from auth)'; // Show email from auth as fallback
            if (createdEl) createdEl.textContent = 'N/A';
            setupAppLink(); // Still setup app link
            return;
        }
        
        const userData = userDoc.data();
        
        if (nameEl) nameEl.textContent = userData.name || authenticatedUser.displayName || 'No name provided';
        if (emailEl) emailEl.textContent = userData.email || authenticatedUser.email; // Prefer Firestore email, fallback to auth email
        
        if (createdEl) {
            if (userData.createdAt && typeof userData.createdAt.toDate === 'function') {
                const createdDate = userData.createdAt.toDate();
                createdEl.textContent = createdDate.toLocaleDateString();
            } else {
                console.warn("User 'createdAt' field is missing or not a Firebase Timestamp for UID:", authenticatedUser.uid);
                createdEl.textContent = 'Not available';
            }
        }
        
        setupAppLink();
    } catch (error) {
        console.error("Error loading profile:", error);
        if (nameEl) nameEl.textContent = 'Error loading profile data.';
        if (emailEl) emailEl.textContent = authenticatedUser.email || 'Error'; // Fallback email
        if (createdEl) createdEl.textContent = 'Error';
        setupAppLink(); // Still setup app link
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
