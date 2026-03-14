// electra.js - Centralized Frontend Logic for ELECTRA Voting System

// --- UTILITIES (Toast Notifications) ---
window.Toast = {
  container: null,
  init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:10px;';
    document.body.appendChild(this.container);
  },
  show(message, type = 'info') {
    this.init();
    const el = document.createElement('div');
    const colors = { 
      success: 'var(--status-live, #00C853)', 
      error: 'var(--rose, #D50000)', 
      warning: 'var(--gold, #FFD600)', 
      info: 'var(--sky, #00B0FF)' 
    };
    
    el.style.cssText = `
      background: var(--surface-card, #2A2A35); 
      border-left: 4px solid ${colors[type]}; 
      color: var(--text-primary, #fff); 
      padding: 12px 20px; 
      border-radius: 8px; 
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
      font-family: var(--font-body, system-ui); 
      font-size: 14px; 
      animation: electraSlideInX 0.3s ease;
    `;
    el.textContent = message;
    this.container.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'electraFadeOut 0.3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  },
  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  warning(msg) { this.show(msg, 'warning'); },
  info(msg) { this.show(msg, 'info'); }
};

// Add basic animations for toast
const style = document.createElement('style');
style.textContent = `
@keyframes electraSlideInX { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes electraFadeOut { from { opacity: 1; } to { opacity: 0; } }
`;
document.head.appendChild(style);


// --- AUTHENTICATION LOGIC ---

function handleSignup(event) {
  event.preventDefault();
  
  const terms = document.getElementById('terms');
  if (terms && !terms.checked) {
    Toast.warning('Please accept the terms to continue');
    return;
  }
  
  const collegeName = document.getElementById('collegeName')?.value;
  const collegeCode = document.getElementById('collegeCode')?.value;
  const adminName = document.getElementById('adminName')?.value;
  const password = document.getElementById('password')?.value;
  const confirmPassword = document.getElementById('confirmPassword')?.value;

  if (!collegeName || !collegeCode || !adminName || !password) {
    Toast.error('Please fill in all required fields');
    return;
  }

  if (password !== confirmPassword) {
    Toast.error('Passwords do not match');
    return;
  }

  // Save to localStorage
  const collegeData = {
    collegeName,
    collegeCode,
    adminName,
    password
  };
  localStorage.setItem('electra_college_data', JSON.stringify(collegeData));

  Toast.success('College registered! Redirecting to login...');
  setTimeout(() => {
    window.location.href = 'college-login.html'; 
  }, 1500);
}

function handleLogin(role, event) {
  if (event) event.preventDefault();

  if (role === 'admin') {
    const adminForm = document.getElementById('adminForm');
    const inputs = adminForm.querySelectorAll('.form-input');
    const code = inputs[0]?.value || '';
    const email = inputs[1]?.value || '';
    const pwd = inputs[2]?.value || '';

    if (!code || !email || !pwd) {
      Toast.error('Please fill in all admin login fields');
      return;
    }

    // Check with dummy data or localStorage
    const savedData = JSON.parse(localStorage.getItem('electra_college_data'));
    
    if (savedData && code === savedData.collegeCode && pwd === savedData.password) {
      localStorage.setItem('electra_user', JSON.stringify({ role: 'admin', code, email }));
      Toast.success('Admin login successful! Redirecting...');
      setTimeout(() => {
        window.location.href = '../admin/dashboard.html';
      }, 1200);
    } else if (code.toUpperCase() === 'SXC001' && pwd === 'admin123') {
       // Hardcoded fallback logic for testing without registration
      localStorage.setItem('electra_user', JSON.stringify({ role: 'admin', code, email }));
      Toast.success('Admin login successful! Redirecting...');
      setTimeout(() => {
        window.location.href = '../admin/dashboard.html';
      }, 1200);
    } else {
      Toast.error('Invalid admin credentials. Try registering first.');
    }

  } else if (role === 'student') {
    const studentForm = document.getElementById('studentForm');
    const inputs = studentForm.querySelectorAll('.form-input');
    const code = inputs[0]?.value || '';
    const identifier = inputs[1]?.value || ''; // email or regNo
    const pwd = inputs[2]?.value || '';

    if (!code || !identifier || !pwd) {
      Toast.error('Please fill in all required fields');
      return;
    }

    // Dummy student auth validation
    // Let any student login if they provide something
    localStorage.setItem('electra_user', JSON.stringify({ role: 'student', code, identifier }));
    Toast.success('Student login successful! Redirecting...');
    setTimeout(() => {
      window.location.href = '../student/dashboard.html';
    }, 1200);
  }
}

function protectAdminPages() {
  const user = JSON.parse(localStorage.getItem('electra_user'));
  if (!user || user.role !== 'admin') {
    window.location.href = '../public/college-login.html';
  }
}

function protectStudentPages() {
  const user = JSON.parse(localStorage.getItem('electra_user'));
  if (!user || user.role !== 'student') {
    window.location.href = '../public/college-login.html?type=student';
  }
}

function logoutUser(event) {
  if (event) event.preventDefault();
  localStorage.removeItem('electra_user');
  Toast.success('Logged out successfully.');
  setTimeout(() => {
      window.location.href = '../public/college-login.html';
  }, 1000);
}


// --- INITIALIZATION & BINDING ---
document.addEventListener('DOMContentLoaded', () => {
  // Page Protection
  const path = window.location.pathname.toLowerCase();
  
  // Exclude auth pages from protection, but apply to /admin/ and /student/ routes
  if (path.includes('/admin/') && !path.includes('login') && !path.includes('signup')) {
    protectAdminPages();
  }
  if (path.includes('/student/') && !path.includes('login') && !path.includes('signup')) {
    protectStudentPages();
  }

  // 1. Attach Signup Form Event
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    // We remove the old inline submit handler and use ours
    const newSignupForm = signupForm.cloneNode(true);
    signupForm.parentNode.replaceChild(newSignupForm, signupForm);
    newSignupForm.addEventListener('submit', handleSignup);
  }

  // 2. Attach Login Form Events
  // Provide globally so inline onclick="login(...)" works
  window.login = handleLogin;
  
  // 3. Attach Logout Event
  // We look for anything that looks like a logout button
  const logoutElements = document.querySelectorAll('a[href*="logout"], a[href*="login.html"], .logout-btn');
  logoutElements.forEach(el => {
    const text = el.textContent?.toLowerCase() || '';
    if (text.includes('logout') || text.includes('log out') || text.includes('sign out')) {
      el.addEventListener('click', logoutUser);
    }
  });
});
