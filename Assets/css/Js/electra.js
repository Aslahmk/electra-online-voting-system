/* ============================================================
   ELECTRA — System Logic & UI Utilities
   ============================================================ */

'use strict';

// ── GLOBAL APP STATE ──────────────────────────────────────
const ELECTRA = {
  version: '1.0',
  currentUser: null,      // { id, name, email, role, college_id, dept, course_type, gender }
  currentCollege: null,   // { id, name, code }
  electionState: null,    // { id, status, start, end, seats: [] }
  votingSession: {},       // { seat_id: candidate_id }
};

// ── VOTE LOGIC ENGINE ─────────────────────────────────────
const VoteEngine = {

  /**
   * Returns the list of seat groups a student is eligible to vote in.
   * @param {Object} student - { course_type: 'UG'|'PG', gender: 'M'|'F', department: string }
   * @param {Array}  seats   - All seats from DB
   */
  getEligibleSeats(student, seats) {
    return seats.filter(seat => this._canVote(student, seat));
  },

  _canVote(student, seat) {
    switch (seat.category) {
      case 'GENERAL':
        return true; // Chairman, VC, Gen Sec, Arts, Magazine

      case 'UUC':
        return true; // UUC Reps — all students

      case 'LADY_REP':
        return student.gender === 'F'; // Female only

      case 'DEPT_REP':
        // Must match both department AND course level
        return seat.department === student.department
            && seat.level      === student.course_type;

      default:
        return false;
    }
  },

  /**
   * Validates a complete vote submission before sending to server.
   * Returns { valid: bool, errors: string[] }
   */
  validateSubmission(votingSession, eligibleSeats) {
    const errors = [];
    for (const seat of eligibleSeats) {
      const selected = votingSession[seat.id];
      if (!selected) {
        errors.push(`You must select a candidate for: ${seat.name}`);
        continue;
      }
      const count = Array.isArray(selected) ? selected.length : 1;
      if (seat.max_selections > 1 && count !== seat.max_selections) {
        errors.push(`${seat.name}: Select exactly ${seat.max_selections} candidates`);
      }
    }
    return { valid: errors.length === 0, errors };
  },

  /** Select/deselect a candidate in a multi-choice seat */
  toggleMultiVote(votingSession, seatId, candidateId, maxSelections) {
    const current = votingSession[seatId] || [];
    const idx = current.indexOf(candidateId);
    if (idx > -1) {
      return current.filter(id => id !== candidateId);
    }
    if (current.length >= maxSelections) {
      Toast.warning(`You can only select ${maxSelections} candidates for this seat`);
      return current;
    }
    return [...current, candidateId];
  }
};

// ── ELECTION TIMER ────────────────────────────────────────
const ElectionTimer = {
  interval: null,

  start(endTime, onTick, onEnd) {
    this.stop();
    this.interval = setInterval(() => {
      const remaining = new Date(endTime) - Date.now();
      if (remaining <= 0) {
        this.stop();
        onEnd?.();
        return;
      }
      onTick(this._parse(remaining));
    }, 1000);
  },

  stop() { clearInterval(this.interval); },

  _parse(ms) {
    const s = Math.floor(ms / 1000);
    return {
      hours:   String(Math.floor(s / 3600)).padStart(2, '0'),
      minutes: String(Math.floor((s % 3600) / 60)).padStart(2, '0'),
      seconds: String(s % 60).padStart(2, '0'),
    };
  }
};

// ── FORM VALIDATION ───────────────────────────────────────
const Validator = {
  rules: {
    required:  v => v && v.trim() !== '' ? null : 'This field is required',
    email:     v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Enter a valid email',
    minLen:    n => v => v?.length >= n ? null : `Minimum ${n} characters`,
    maxLen:    n => v => v?.length <= n ? null : `Maximum ${n} characters`,
    numeric:   v => /^\d+$/.test(v) ? null : 'Numbers only',
    noSpaces:  v => !/\s/.test(v) ? null : 'No spaces allowed',
    match:     other => v => v === other ? null : 'Passwords do not match',
    alphaNum:  v => /^[a-zA-Z0-9]+$/.test(v) ? null : 'Letters and numbers only',
  },

  field(value, ...ruleFns) {
    for (const fn of ruleFns) {
      const err = fn(value);
      if (err) return err;
    }
    return null;
  },

  form(fields) {
    // fields: { fieldName: { value, rules: [fn] } }
    const errors = {};
    let valid = true;
    for (const [name, cfg] of Object.entries(fields)) {
      const err = this.field(cfg.value, ...cfg.rules);
      if (err) { errors[name] = err; valid = false; }
    }
    return { valid, errors };
  },

  /** Attach live validation to a form group */
  attach(inputEl, ...ruleFns) {
    const group = inputEl.closest('.form-group');
    const hint  = group?.querySelector('.form-error');
    inputEl.addEventListener('blur', () => {
      const err = this.field(inputEl.value, ...ruleFns);
      inputEl.classList.toggle('error', !!err);
      if (hint) hint.textContent = err || '';
    });
    inputEl.addEventListener('input', () => {
      if (inputEl.classList.contains('error')) {
        const err = this.field(inputEl.value, ...ruleFns);
        inputEl.classList.toggle('error', !!err);
        if (hint) hint.textContent = err || '';
      }
    });
  }
};

// ── TOAST NOTIFICATIONS ───────────────────────────────────
const Toast = {
  container: null,

  _init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'success', duration = 4000) {
    this._init();
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'fade-in .3s ease reverse both';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success: (msg) => Toast.show(msg, 'success'),
  error:   (msg) => Toast.show(msg, 'error'),
  warning: (msg) => Toast.show(msg, 'warning'),
  info:    (msg) => Toast.show(msg, 'info'),
};

// ── MODAL MANAGER ─────────────────────────────────────────
const Modal = {
  open(id) {
    const el = document.getElementById(id);
    el?.classList.add('open');
    document.body.style.overflow = 'hidden';
  },
  close(id) {
    const el = document.getElementById(id);
    el?.classList.remove('open');
    document.body.style.overflow = '';
  },
  closeAll() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
    document.body.style.overflow = '';
  }
};

// ── SIDEBAR TOGGLE ────────────────────────────────────────
const Sidebar = {
  collapsed: false,

  toggle() {
    const sidebar  = document.querySelector('.sidebar');
    const topbar   = document.querySelector('.topbar');
    const content  = document.querySelector('.main-content');
    this.collapsed = !this.collapsed;
    sidebar?.classList.toggle('collapsed', this.collapsed);
    topbar?.classList.toggle('expanded',   this.collapsed);
    content?.classList.toggle('expanded',  this.collapsed);
    localStorage.setItem('sidebar_collapsed', this.collapsed);
  },

  init() {
    const saved = localStorage.getItem('sidebar_collapsed') === 'true';
    if (saved) this.toggle();
  }
};

// ── CSV PARSER (frontend) ─────────────────────────────────
const CSVParser = {
  /** Parse CSV text into array of objects using first row as headers */
  parse(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim());
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']));
    });
  },

  /** Validate parsed student rows */
  validateStudents(rows) {
    const required = ['student_name','register_number','email','department','course_type','gender'];
    const valid = [], errors = [];
    rows.forEach((row, i) => {
      const missing = required.filter(k => !row[k]);
      if (missing.length) {
        errors.push(`Row ${i + 2}: Missing fields — ${missing.join(', ')}`);
      } else {
        valid.push(row);
      }
    });
    return { valid, errors };
  }
};

// ── RESULTS RENDERER ─────────────────────────────────────
const ResultsRenderer = {
  /**
   * Renders vote bars for a seat's results
   * @param {Array} candidates - [{ name, votes, photo }] sorted desc
   * @param {string} containerId
   */
  renderBars(candidates, containerId) {
    const el = document.getElementById(containerId);
    if (!el || !candidates.length) return;
    const max = Math.max(...candidates.map(c => c.votes), 1);
    el.innerHTML = candidates.map((c, i) => `
      <div class="vote-bar-wrap" style="animation-delay:${i * 0.12}s">
        <div class="vote-bar-header">
          <span class="vote-bar-name">${c.name} ${i === 0 ? '<span class="badge badge-teal">Winner</span>' : ''}</span>
          <span class="vote-bar-count">${c.votes} votes</span>
        </div>
        <div class="vote-bar">
          <div class="vote-bar-fill ${i === 0 ? 'winner' : ''}" style="width: ${(c.votes / max * 100).toFixed(1)}%"></div>
        </div>
      </div>
    `).join('');
  }
};

// ── PASSWORD GENERATOR ────────────────────────────────────
const PasswordGen = {
  /** Generates auto password: first3ofName + last4ofRegNo + 2-digit random */
  forStudent(name, regNo) {
    const prefix = name.replace(/\s+/g, '').substring(0, 3).toUpperCase();
    const suffix = regNo.slice(-4);
    const rand   = String(Math.floor(Math.random() * 90) + 10);
    return `${prefix}${suffix}${rand}`;
  },

  /** Generates 6-digit security code */
  securityCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
};

// ── DROPDOWN COMPONENT ────────────────────────────────────
const Dropdown = {
  init(toggleSelector) {
    document.querySelectorAll(toggleSelector).forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const target = document.getElementById(btn.dataset.dropdown);
        const isOpen = target?.classList.contains('open');
        document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
        if (!isOpen) target?.classList.add('open');
      });
    });
    document.addEventListener('click', () => {
      document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
    });
  }
};

// ── DATA TABLE SORT ───────────────────────────────────────
const DataTable = {
  sort(tableId, col, type = 'string') {
    const table = document.getElementById(tableId);
    if (!table) return;
    const tbody = table.querySelector('tbody');
    const rows  = [...tbody.querySelectorAll('tr')];
    rows.sort((a, b) => {
      const av = a.cells[col]?.textContent.trim() || '';
      const bv = b.cells[col]?.textContent.trim() || '';
      return type === 'number' ? +av - +bv : av.localeCompare(bv);
    });
    rows.forEach(r => tbody.appendChild(r));
  },

  filter(tableId, query) {
    const q = query.toLowerCase();
    document.getElementById(tableId)?.querySelectorAll('tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  }
};

// ── UPLOAD ZONE ───────────────────────────────────────────
const UploadZone = {
  init(zoneId, onFile) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    });
    zone.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv,.xlsx,.xls';
      input.onchange = () => input.files[0] && onFile(input.files[0]);
      input.click();
    });
  }
};

// ── DOM READY ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Sidebar.init();
  Dropdown.init('[data-dropdown]');

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) Modal.close(overlay.id);
    });
  });

  // Animate stats counters
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = +el.dataset.count;
    let current = 0;
    const step = target / 40;
    const t = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = Math.floor(current).toLocaleString();
      if (current >= target) clearInterval(t);
    }, 30);
  });
});