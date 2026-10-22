(() => {
'use strict';
const cfg = {apiKey:"AIzaSyAtTQzvodXhQmElO5s1oUPYAyx3jt_X8MA",authDomain:"kamigo-bb729.firebaseapp.com",projectId:"kamigo-bb729",storageBucket:"kamigo-bb729.firebasestorage.app",messagingSenderId:"252163017983",appId:"1:252163017983:web:e81e961d2b8454fbdbd0ca",measurementId:"G-SB5YFLFFP1"};
if (!firebase.apps.length) firebase.initializeApp(cfg);
try { if (window.KAMIGO_APPCHECK_KEY && firebase.appCheck) firebase.appCheck().activate(window.KAMIGO_APPCHECK_KEY, true); } catch (e) { console.warn('App Check not active:', e); }
const auth = firebase.auth(), db = firebase.firestore();
const $ = id => document.getElementById(id);
const ts = () => firebase.firestore.FieldValue.serverTimestamp();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const refOf = id => 'KM-' + String(id).slice(0, 8).toUpperCase();
const time = v => { try { return v && v.toDate ? v.toDate().toLocaleString() : ''; } catch (_) { return ''; } };

async function audit(action, target, detail) {
  const u = auth.currentUser; if (!u) return;
  try { await db.collection('auditLogs').add({ actorUid: u.uid, actorEmail: u.email || '', action, target: String(target || '').slice(0, 120), detail: String(detail || '').slice(0, 300), createdAt: ts() }); } catch (e) { console.warn('audit failed', e); }
}
let role = 'admin';
let bookings = [], services = [], workers = [], conversations = [], coupons = [];
let activeThread = null, bookingLimit = 300, firstBookingSnap = true, firstThreadSnap = true;
let stopThreads = null, stopThreadMessages = null, stopBookings = null;
const isFull = () => role === 'admin';

function notice(msg, bad = false) {
  const n = $('notice'); n.textContent = msg; n.style.background = bad ? '#fff0f0' : '#e9f7f0'; n.style.color = bad ? '#b42318' : '#176c5a';
  n.classList.add('show'); setTimeout(() => n.classList.remove('show'), 4000);
}

// ---------- alerts (sound + desktop notification + title flash) ----------
let audioCtx = null, titleTimer = null;
function beep() { try { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination); o.frequency.value = 880; g.gain.value = .08; o.start(); o.stop(audioCtx.currentTime + .18); } catch (_) {} }
function alertNew(title, body) {
  notice('🔔 ' + title + ' — ' + body);
  if (audioCtx) beep();
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body }); } catch (_) {}
  if (document.hidden && !titleTimer) { const base = document.title; let on = false; titleTimer = setInterval(() => { document.title = on ? base : '🔔 ' + title; on = !on; if (!document.hidden) { clearInterval(titleTimer); titleTimer = null; document.title = base; } }, 900); }
}
$('enableAlerts').addEventListener('click', async () => {
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); beep(); } catch (_) {}
  if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
  notice('Alerts enabled for new bookings and chats while this page is open.');
});

// ---------- auth ----------
async function getRole(user) { const s = await db.collection('admins').doc(user.uid).get(); return s.exists ? (s.data().role === 'support' ? 'support' : 'admin') : null; }
$('loginButton').addEventListener('click', async () => { try { const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); await auth.signInWithPopup(p); } catch (e) { $('loginError').textContent = 'Sign-in failed: ' + (e.message || e); } });
$('logoutButton').addEventListener('click', () => auth.signOut());

function teardown() {
  [stopThreads, stopThreadMessages, stopBookings].forEach(f => f && f());
  stopThreads = stopThreadMessages = stopBookings = null; activeThread = null; bookings = []; services = []; workers = []; conversations = []; coupons = [];
  $('replyInput').disabled = true; $('replyButton').disabled = true; $('toggleThread').hidden = true;
  $('chatTitle').firstChild.textContent = 'Select a conversation'; $('adminMessages').innerHTML = '<div class="empty">No conversation selected.</div>';
}
function applyRole() {
  document.querySelectorAll('[data-full]').forEach(el => el.classList.toggle('hidden', !isFull()));
  if (!isFull()) ['services', 'workers', 'coupons', 'logs'].forEach(n => $(n + 'Tab').classList.add('hidden'));
}
auth.onAuthStateChanged(async user => {
  if (!user) { teardown(); $('loginView').classList.remove('hidden'); $('adminView').classList.add('hidden'); return; }
  try {
    role = await getRole(user);
    if (!role) { await auth.signOut(); $('loginError').textContent = 'This Google account is not on the Kamigo staff allowlist. Add its UID to Firestore admins first.'; return; }
    $('loginView').classList.add('hidden'); $('adminView').classList.remove('hidden'); applyRole();
    $('adminIdentity').textContent = (user.displayName || 'Staff') + ' · ' + (user.email || user.uid) + ' · ' + (isFull() ? 'Admin' : 'Support (read-only except chat)');
    firstBookingSnap = true; firstThreadSnap = true;
    listenBookings(); listenThreads(); renderCanned();
    if (isFull()) await Promise.all([loadServices(), loadWorkers(), loadCoupons(), loadArea()]); else await loadWorkers().catch(() => {});
  } catch (e) { console.error(e); $('loginError').textContent = 'Admin verification failed. Check that Firestore rules are published and your UID exists in admins.'; }
});

// ---------- bookings ----------
function listenBookings() {
  if (stopBookings) stopBookings();
  firstBookingSnap = true;
  stopBookings = db.collection('bookings').orderBy('createdAt', 'desc').limit(bookingLimit).onSnapshot(s => {
    if (!firstBookingSnap) s.docChanges().forEach(c => { if (c.type === 'added' && !c.doc.metadata.hasPendingWrites) { const b = c.doc.data(); alertNew('New booking: ' + (b.service || ''), (b.name || 'Customer') + ' · ' + (b.city || '')); } });
    firstBookingSnap = false;
    bookings = s.docs.map(d => ({ id: d.id, ...d.data() }));
    $('loadMore').hidden = s.size < bookingLimit;
    renderBookings(); renderStats(); renderInsights(); updateOverdue();
  }, e => { console.error(e); notice('Could not load bookings. Verify Firestore rules.', true); });
}
$('loadMore').addEventListener('click', () => { bookingLimit += 300; listenBookings(); });
function renderStats() {
  $('statBookings').textContent = bookings.length + ($('loadMore').hidden ? '' : '+');
  $('statPending').textContent = bookings.filter(b => (b.status || 'pending') === 'pending').length;
}
function filteredBookings() {
  const q = $('bookingSearch').value.toLowerCase(), st = $('bookingStatus').value, from = $('dateFrom').value, to = $('dateTo').value;
  return bookings.filter(b => (st === 'all' || (b.status || 'pending') === st)
    && (!from || (b.preferredDate || '') >= from) && (!to || (b.preferredDate || '') <= to)
    && [b.name, b.phone, b.service, b.city, b.customerEmail, b.pincode, b.assigneeName, b.id, refOf(b.id)].some(x => String(x || '').toLowerCase().includes(q)));
}
function workerOptions(selected) {
  return '<option value="">— Unassigned —</option>' + workers.filter(w => w.active !== false || w.email === selected).map(w => `<option value="${esc(w.email)}" ${w.email === selected ? 'selected' : ''}>${esc(w.name)}</option>`).join('');
}
const OVERDUE_MS = 15 * 60 * 1000;
const waitingMin = b => b.createdAt && b.createdAt.toMillis ? Math.floor((Date.now() - b.createdAt.toMillis()) / 60000) : 0;
const isOverdue = b => (b.status || 'pending') === 'pending' && b.createdAt && b.createdAt.toMillis && Date.now() - b.createdAt.toMillis() > OVERDUE_MS;
let lastOverdue = 0;
function updateOverdue() {
  const n = bookings.filter(isOverdue).length, bar = $('overdueBar');
  bar.classList.toggle('hidden', n === 0);
  bar.textContent = n ? `⚠ ${n} booking${n > 1 ? 's' : ''} still pending after 15+ minutes — please contact ${n > 1 ? 'these customers' : 'this customer'}.` : '';
  if (n > lastOverdue && audioCtx) beep();
  lastOverdue = n;
}
setInterval(() => { if (bookings.length && !$('adminView').classList.contains('hidden')) { renderBookings(); updateOverdue(); } }, 30000);

function renderBookings() {
  const rows = filteredBookings(), dis = isFull() ? '' : 'disabled';
  $('bookingRows').innerHTML = rows.length ? rows.map(b => {
    const st = b.status || 'pending', late = isOverdue(b);
    return `<tr class="${late ? 'overdue' : ''}"><td><strong>${esc(refOf(b.id))}</strong><br><span class="muted">${esc(time(b.createdAt))}</span>${late ? '<br><span class="late">⏰ waiting ' + waitingMin(b) + ' min</span>' : ''}</td>
<td>${esc(b.name)}<br><span class="muted"><a href="tel:${esc(b.phone)}">${esc(b.phone)}</a><br>${esc(b.customerEmail || '')}</span></td>
<td>${esc(b.service)}<br><span class="muted">${esc(b.city)}${b.couponCode ? '<br>Coupon: ' + esc(b.couponCode) : ''}</span></td>
<td>${esc(b.preferredDate)} ${esc(b.timeSlot || '')}<br><span class="muted">${esc(b.address || '')} ${esc(b.pincode || '')}</span>${b.photos && b.photos.length ? `<br><button class="rowbtn" data-photos="${esc(b.id)}">📷 ${b.photos.length} photo(s)</button>` : ''}</td>
<td><span class="pill ${esc(st)}">${esc(st.replace(/_/g, ' '))}</span>${b.assigneeName ? '<br><span class="muted">' + esc(b.assigneeName) + '</span>' : ''}${b.amount != null ? '<br><strong>₹' + esc(b.amount) + '</strong>' : ''}</td>
<td><div class="row-actions"><select ${dis} aria-label="Assign technician" data-assign-id="${esc(b.id)}">${workerOptions(b.assignee || '')}</select><select ${dis} aria-label="Update booking status" data-status-id="${esc(b.id)}">${['pending', 'confirmed', 'on_the_way', 'completed', 'cancelled'].map(x => `<option value="${x}" ${x === st ? 'selected' : ''}>${x.replace(/_/g, ' ')}</option>`).join('')}</select><input ${dis} type="number" min="0" step="1" placeholder="Amount ₹" aria-label="Final amount" data-amount-id="${esc(b.id)}" value="${b.amount != null ? esc(b.amount) : ''}"><button class="rowbtn" ${dis} data-save-booking="${esc(b.id)}">Save</button></div></td></tr>`;
  }).join('') : '<tr><td colspan="6" class="empty">No matching bookings.</td></tr>';
}
async function showPhotos(id) {
  const b = bookings.find(x => x.id === id); if (!b || !b.photos || !b.photos.length) return;
  try {
    const urls = await Promise.all(b.photos.map(p => firebase.storage().ref(p).getDownloadURL()));
    const o = document.createElement('div'); o.className = 'lightbox'; o.innerHTML = '<div class="lb-in"><button class="lb-close" aria-label="Close">×</button><h3></h3><div class="lb-grid"></div></div>';
    o.querySelector('h3').textContent = refOf(id) + ' — customer photos';
    const g = o.querySelector('.lb-grid'); urls.forEach(u => { const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; const im = document.createElement('img'); im.src = u; im.alt = 'Customer photo'; a.appendChild(im); g.appendChild(a); });
    o.addEventListener('click', ev => { if (ev.target === o || ev.target.classList.contains('lb-close')) o.remove(); }); document.body.appendChild(o);
  } catch (e) { console.error(e); notice('Could not load photos. Make sure storage.rules are deployed.', true); }
}
$('bookingRows').addEventListener('click', async e => {
  const ph = e.target.closest('[data-photos]'); if (ph) { showPhotos(ph.dataset.photos); return; }
  const btn = e.target.closest('[data-save-booking]'); if (!btn || !isFull()) return;
  const id = btn.dataset.saveBooking, sel = a => $('bookingRows').querySelector(`[${a}="${CSS.escape(id)}"]`);
  const email = sel('data-assign-id').value, w = workers.find(x => x.email === email), amountRaw = sel('data-amount-id').value.trim(), status = sel('data-status-id').value;
  const upd = { status, assignee: email, assigneeName: w ? w.name : '', updatedAt: ts() };
  if (amountRaw !== '') { const amt = Number(amountRaw); if (!Number.isFinite(amt) || amt < 0 || amt > 1000000) { notice('Enter a valid amount (0 – 10,00,000).', true); return; } upd.amount = amt; }
  try { await db.collection('bookings').doc(id).update(upd); audit('booking.update', refOf(id), 'status=' + status + '; technician=' + (w ? w.name : '-') + '; amount=' + (amountRaw || '-')); notice('Booking updated.'); }
  catch (err) { console.error(err); notice('Could not update booking. Check rules.', true); }
});
['input', 'change'].forEach(ev => ['bookingSearch', 'bookingStatus', 'dateFrom', 'dateTo'].forEach(id => $(id).addEventListener(ev, renderBookings)));
$('clearFilters').addEventListener('click', () => { $('bookingSearch').value = ''; $('bookingStatus').value = 'all'; $('dateFrom').value = ''; $('dateTo').value = ''; renderBookings(); });

// ---------- CSV export ----------
function csvCell(v) { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
function downloadCSV(name, header, rows) {
  const text = [header.map(csvCell).join(',')].concat(rows.map(r => r.map(csvCell).join(','))).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$('exportBookings').addEventListener('click', () => {
  const rows = filteredBookings(); if (!rows.length) { notice('No bookings to export.', true); return; }
  downloadCSV('kamigo-bookings-' + new Date().toISOString().slice(0, 10) + '.csv', ['Reference', 'Created', 'Customer', 'Phone', 'Email', 'Service', 'City', 'Preferred date', 'Time slot', 'Address', 'PIN', 'Coupon', 'Status', 'Technician'],
    rows.map(b => [refOf(b.id), time(b.createdAt), b.name, b.phone, b.customerEmail, b.service, b.city, b.preferredDate, b.timeSlot, b.address, b.pincode, b.couponCode, b.status || 'pending', b.assigneeName]));
});
$('exportCustomers').addEventListener('click', async () => {
  try { const s = await db.collection('customers').limit(2000).get(); downloadCSV('kamigo-customers-' + new Date().toISOString().slice(0, 10) + '.csv', ['Name', 'Email', 'Phone', 'Age', 'Gender', 'City', 'Home address', 'Work address', 'Joined'], s.docs.map(d => { const c = d.data(); return [c.name, c.email, c.phone, c.age, c.gender, c.city, c.address, c.workAddress, time(c.createdAt)]; })); }
  catch (e) { console.error(e); notice('Could not export customers.', true); }
});

// ---------- insights ----------
function bar(label, n, max) { return `<div class="bar"><span>${esc(label)}</span><i style="width:${max ? Math.max(3, n / max * 100) : 3}%"></i><b>${n}</b></div>`; }
function renderInsights() {
  const by = {}; bookings.forEach(b => { by[b.service] = (by[b.service] || 0) + 1; });
  const list = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8), max = list.length ? list[0][1] : 0;
  $('chartServices').innerHTML = list.length ? list.map(([k, n]) => bar(k, n, max)).join('') : '<div class="empty">No data yet.</div>';
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const key = d => d.toLocaleDateString('en-CA'), counts = Object.fromEntries(days.map(d => [key(d), 0]));
  bookings.forEach(b => { if (b.createdAt && b.createdAt.toDate) { const k = key(b.createdAt.toDate()); if (k in counts) counts[k]++; } });
  const dmax = Math.max(0, ...Object.values(counts));
  $('chartDays').innerHTML = days.map(d => bar(d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }), counts[key(d)], dmax)).join('');
  const rate = {}; services.forEach(s => rate[(s.name || '').toLowerCase()] = Number(s.rate) || 0);
  const done = bookings.filter(b => b.status === 'completed'), real = done.reduce((t, b) => t + (Number(b.amount) || 0), 0);
  const est = done.reduce((t, b) => t + (b.amount != null ? 0 : (rate[String(b.service).toLowerCase()] || 0)), 0);
  $('insightSummary').textContent = `${done.length} completed jobs · recorded revenue ₹${real.toLocaleString('en-IN')}` + (est ? ` (+ ₹${est.toLocaleString('en-IN')} estimated at starting rates for jobs without an amount)` : '') + `. Based on the ${bookings.length} loaded bookings.`;
  renderReport();
}

// ---------- services ----------
function resetService() { $('serviceDocId').value = ''; $('serviceName').value = ''; $('serviceDescription').value = ''; $('serviceRate').value = ''; $('serviceActive').value = 'true'; $('serviceFormTitle').textContent = 'Add a service'; }
async function loadServices() {
  try {
    const s = await db.collection('services').get(); services = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')); $('statServices').textContent = services.length;
    $('serviceRows').innerHTML = services.length ? services.map(x => `<div class="service-row"><div><strong>${esc(x.name || x.id)}</strong><div class="muted">${esc(x.description || 'No description')} · ${x.active === false ? 'Hidden' : 'Active'}</div></div><strong>₹${esc(x.rate ?? '—')}</strong><div><button class="rowbtn" data-edit-service="${esc(x.id)}">Edit</button><button class="rowbtn" data-delete-service="${esc(x.id)}">Delete</button></div></div>`).join('') : '<div class="empty">No services yet. Add the first one using the form.</div>';
    renderInsights();
  } catch (e) { console.error(e); notice('Could not load services. Check rules.', true); }
}
$('serviceRows').addEventListener('click', async e => {
  const edit = e.target.closest('[data-edit-service]'), del = e.target.closest('[data-delete-service]');
  if (edit) { const s = services.find(x => x.id === edit.dataset.editService); if (!s) return; $('serviceDocId').value = s.id; $('serviceName').value = s.name || ''; $('serviceDescription').value = s.description || ''; $('serviceRate').value = s.rate ?? ''; $('serviceActive').value = String(s.active !== false); $('serviceFormTitle').textContent = 'Edit service'; $('serviceName').focus(); }
  if (del) { if (!confirm('Delete this service from the catalogue?')) return; try { await db.collection('services').doc(del.dataset.deleteService).delete(); audit('service.delete', del.dataset.deleteService, ''); notice('Service deleted.'); await loadServices(); } catch (err) { console.error(err); notice('Could not delete service.', true); } }
});
$('serviceForm').addEventListener('submit', async e => {
  e.preventDefault(); const id = $('serviceDocId').value.trim(), name = $('serviceName').value.trim();
  const data = { name, description: $('serviceDescription').value.trim(), rate: Number($('serviceRate').value), active: $('serviceActive').value === 'true', updatedAt: ts() };
  if (!name || !Number.isFinite(data.rate) || data.rate < 0) { notice('Enter a valid service name and rate.', true); return; }
  try { if (id) await db.collection('services').doc(id).set(data, { merge: true }); else await db.collection('services').add({ ...data, createdAt: ts() }); resetService(); await loadServices(); audit('service.save', name, 'rate=' + data.rate + '; active=' + data.active); notice('Service saved.'); }
  catch (err) { console.error(err); notice('Could not save service. Check rules.', true); }
});
$('resetService').addEventListener('click', resetService); $('refreshServices').addEventListener('click', loadServices);

// ---------- technicians ----------
async function loadWorkers() {
  const s = await db.collection('workers').get(); workers = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  $('workerRows').innerHTML = workers.length ? workers.map(w => `<div class="service-row"><div><strong>${esc(w.name)}</strong><div class="muted">${esc(w.email)} · ${esc(w.phone || '')} · ${w.active === false ? 'Inactive' : 'Active'}</div></div><div><button class="rowbtn" data-edit-worker="${esc(w.id)}">Edit</button><button class="rowbtn" data-delete-worker="${esc(w.id)}">Delete</button></div></div>`).join('') : '<div class="empty">No technicians yet.</div>';
  renderBookings();
}
$('workerRows').addEventListener('click', async e => {
  const edit = e.target.closest('[data-edit-worker]'), del = e.target.closest('[data-delete-worker]');
  if (edit) { const w = workers.find(x => x.id === edit.dataset.editWorker); if (w) { $('workerName').value = w.name || ''; $('workerEmail').value = w.email || ''; $('workerPhone').value = w.phone || ''; $('workerActive').value = String(w.active !== false); } }
  if (del) { if (!confirm('Remove this technician?')) return; try { await db.collection('workers').doc(del.dataset.deleteWorker).delete(); audit('worker.delete', del.dataset.deleteWorker, ''); notice('Technician removed.'); await loadWorkers(); } catch (err) { console.error(err); notice('Could not remove technician.', true); } }
});
$('workerForm').addEventListener('submit', async e => {
  e.preventDefault(); const email = $('workerEmail').value.trim().toLowerCase(), existing = workers.find(w => w.id === email);
  const data = { name: $('workerName').value.trim(), email, phone: $('workerPhone').value.trim(), active: $('workerActive').value === 'true', updatedAt: ts() };
  if (!existing) data.createdAt = ts();
  try { await db.collection('workers').doc(email).set(data, { merge: true }); $('workerForm').reset(); await loadWorkers(); audit('worker.save', email, data.name); notice('Technician saved.'); }
  catch (err) { console.error(err); notice('Could not save technician. Check rules.', true); }
});

// ---------- coupons + service area ----------
async function loadCoupons() {
  const s = await db.collection('coupons').get(); coupons = s.docs.map(d => ({ id: d.id, ...d.data() }));
  $('couponRows').innerHTML = coupons.length ? coupons.map(c => `<div class="service-row"><div><strong>${esc(c.code)}</strong><div class="muted">${esc(c.percent)}% off · ${c.active ? 'Active' : 'Inactive'}</div></div><div><button class="rowbtn" data-toggle-coupon="${esc(c.id)}">${c.active ? 'Deactivate' : 'Activate'}</button><button class="rowbtn" data-delete-coupon="${esc(c.id)}">Delete</button></div></div>`).join('') : '<div class="empty">No coupons yet.</div>';
}
$('couponRows').addEventListener('click', async e => {
  const t = e.target.closest('[data-toggle-coupon]'), d = e.target.closest('[data-delete-coupon]');
  try {
    if (t) { const c = coupons.find(x => x.id === t.dataset.toggleCoupon); await db.collection('coupons').doc(c.id).update({ active: !c.active, updatedAt: ts() }); audit('coupon.toggle', c.id, 'active=' + !c.active); await loadCoupons(); }
    if (d && confirm('Delete this coupon?')) { await db.collection('coupons').doc(d.dataset.deleteCoupon).delete(); audit('coupon.delete', d.dataset.deleteCoupon, ''); await loadCoupons(); }
  } catch (err) { console.error(err); notice('Coupon update failed.', true); }
});
$('couponForm').addEventListener('submit', async e => {
  e.preventDefault(); const code = $('couponCode').value.trim().toUpperCase(), percent = Number($('couponPercent').value);
  if (!/^[A-Z0-9]{3,20}$/.test(code) || !Number.isInteger(percent) || percent < 1 || percent > 90) { notice('Code: 3-20 letters/numbers. Discount: whole number 1-90.', true); return; }
  const existing = coupons.find(c => c.id === code), data = { code, percent, active: $('couponActive').value === 'true', updatedAt: ts() }; if (!existing) data.createdAt = ts();
  try { await db.collection('coupons').doc(code).set(data, { merge: true }); $('couponForm').reset(); await loadCoupons(); audit('coupon.save', code, percent + '%'); notice('Coupon saved.'); } catch (err) { console.error(err); notice('Could not save coupon.', true); }
});
async function loadArea() { try { const s = await db.collection('settings').doc('area').get(); $('areaPins').value = s.exists && s.data().pins ? s.data().pins.join(', ') : ''; } catch (e) { console.error(e); } }
$('areaForm').addEventListener('submit', async e => {
  e.preventDefault(); const pins = [...new Set($('areaPins').value.split(/[\s,;]+/).filter(Boolean))];
  if (pins.some(p => !/^[0-9]{6}$/.test(p))) { notice('Every PIN code must be exactly 6 digits.', true); return; }
  try { await db.collection('settings').doc('area').set({ pins, updatedAt: ts() }); audit('area.save', 'settings/area', pins.length + ' PIN codes'); notice(pins.length ? 'Service area saved.' : 'Service area cleared — all PIN codes allowed.'); } catch (err) { console.error(err); notice('Could not save service area.', true); }
});

// ---------- live support ----------
const CANNED = ['Hi! Thanks for reaching out — we are checking this now.', 'We will call you within 10 minutes to confirm the details.', 'Could you share your exact address and a landmark?', 'Your technician is on the way.', 'Your request is confirmed. Thank you for choosing Kamigo!', 'Is there anything else we can help you with?'];
function renderCanned() { $('canned').innerHTML = CANNED.map((t, i) => `<button type="button" data-canned="${i}">${esc(t.length > 34 ? t.slice(0, 32) + '…' : t)}</button>`).join(''); }
$('canned').addEventListener('click', e => { const b = e.target.closest('[data-canned]'); if (b && !$('replyInput').disabled) { $('replyInput').value = CANNED[b.dataset.canned]; $('replyInput').focus(); } });
function listenThreads() {
  if (stopThreads) stopThreads(); firstThreadSnap = true;
  stopThreads = db.collection('conversations').orderBy('lastMessageAt', 'desc').limit(100).onSnapshot(s => {
    if (!firstThreadSnap) s.docChanges().forEach(c => { if (c.type !== 'removed' && !c.doc.metadata.hasPendingWrites) { const d = c.doc.data(); if (c.type === 'added' || d.status === 'open') alertNew('Support: ' + (d.customerName || 'Customer'), String(d.lastMessage || '').slice(0, 80)); } });
    firstThreadSnap = false;
    conversations = s.docs.map(d => ({ id: d.id, ...d.data() }));
    $('statChats').textContent = conversations.filter(c => (c.status || 'open') === 'open').length; renderThreads();
    if (activeThread) setChatHeader(conversations.find(x => x.id === activeThread));
  }, e => { console.error(e); notice('Could not load support conversations. Check rules.', true); });
}
function renderThreads() {
  $('threadList').innerHTML = conversations.length ? conversations.map(c => `<button class="thread ${activeThread === c.id ? 'active' : ''} ${(c.status || 'open') === 'closed' ? 'closed' : ''}" data-thread-id="${esc(c.id)}"><strong>${esc(c.customerName || 'Customer conversation')}</strong><small>${esc(c.customerEmail || '')}</small><small>${esc(c.lastMessage || 'No messages yet')}</small><small>${esc(c.status || 'open')} · ${esc(time(c.lastMessageAt || c.createdAt))}</small></button>`).join('') : '<div class="empty">No support conversations yet.</div>';
}
$('threadList').addEventListener('click', e => { const t = e.target.closest('[data-thread-id]'); if (t) selectThread(t.dataset.threadId); });
function setChatHeader(c) { const t = $('chatTitle'); t.firstChild.textContent = c ? ((c.customerName || 'Customer') + (c.customerEmail ? ' · ' + c.customerEmail : '')) : 'Select a conversation'; const b = $('toggleThread'); b.hidden = !c; if (c) b.textContent = (c.status || 'open') === 'closed' ? 'Reopen' : 'Mark resolved'; }
$('toggleThread').addEventListener('click', async () => {
  const c = conversations.find(x => x.id === activeThread); if (!c) return; const next = (c.status || 'open') === 'closed' ? 'open' : 'closed';
  try { await db.collection('conversations').doc(c.id).update({ status: next }); notice(next === 'closed' ? 'Conversation marked resolved.' : 'Conversation reopened.'); } catch (err) { console.error(err); notice('Could not update conversation.', true); }
});
function selectThread(id) {
  activeThread = id; renderThreads(); setChatHeader(conversations.find(x => x.id === id)); $('replyInput').disabled = false; $('replyButton').disabled = false;
  if (stopThreadMessages) stopThreadMessages();
  stopThreadMessages = db.collection('conversations').doc(id).collection('messages').orderBy('createdAt', 'asc').onSnapshot(s => {
    $('adminMessages').innerHTML = s.empty ? '<div class="empty">No messages yet.</div>' : s.docs.map(d => { const m = d.data(); return `<div class="bubble ${m.senderRole === 'admin' ? 'admin' : ''}">${esc(m.text)}<small>${esc(m.senderRole === 'admin' ? 'Kamigo Admin' : m.senderRole === 'customer' ? 'Customer' : 'Support')} · ${esc(time(m.createdAt))}</small></div>`; }).join('');
    $('adminMessages').scrollTop = $('adminMessages').scrollHeight;
  }, e => { console.error(e); notice('Could not read this conversation.', true); });
}
$('replyForm').addEventListener('submit', async e => {
  e.preventDefault(); const text = $('replyInput').value.trim(), user = auth.currentUser; if (!text || !activeThread || !user) return;
  const btn = $('replyButton'); btn.disabled = true;
  try { const ref = db.collection('conversations').doc(activeThread), batch = db.batch(); batch.set(ref.collection('messages').doc(), { text, senderUid: user.uid, senderRole: 'admin', createdAt: ts() }); batch.update(ref, { lastMessage: text, lastMessageAt: ts() }); await batch.commit(); $('replyInput').value = ''; }
  catch (err) { console.error(err); notice('Reply failed. Verify Firestore rules.', true); } finally { btn.disabled = false; }
});

// ---------- tabs ----------
const TABS = ['bookings', 'insights', 'customers', 'support', 'services', 'workers', 'coupons', 'logs'];
document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === btn));
  TABS.forEach(name => $(name + 'Tab').classList.toggle('hidden', name !== btn.dataset.tab));
  if (btn.dataset.tab === 'logs') loadLogs();
}));

// ---------- monthly report ----------
let reportRows = [];
function monthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function renderReport() {
  if (!$('reportMonth').value) $('reportMonth').value = monthKey(new Date());
  const m = $('reportMonth').value, inMonth = bookings.filter(b => b.createdAt && b.createdAt.toDate && monthKey(b.createdAt.toDate()) === m);
  const done = inMonth.filter(b => b.status === 'completed'), revenue = done.reduce((t, b) => t + (Number(b.amount) || 0), 0);
  const byCust = {}; inMonth.forEach(b => { byCust[b.customerUid] = (byCust[b.customerUid] || 0) + 1; });
  const repeat = Object.values(byCust).filter(n => n > 1).length;
  const svc = {}, tech = {};
  inMonth.forEach(b => { const k = b.service || '—'; (svc[k] = svc[k] || { n: 0, done: 0, rev: 0 }).n++; if (b.status === 'completed') { svc[k].done++; svc[k].rev += Number(b.amount) || 0; } });
  done.forEach(b => { const k = b.assigneeName || 'Unassigned'; (tech[k] = tech[k] || { done: 0, rev: 0 }); tech[k].done++; tech[k].rev += Number(b.amount) || 0; });
  const table = (head, rows) => `<table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="9" class="empty">No data</td></tr>'}</tbody></table>`;
  const svcRows = Object.entries(svc).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => [k, v.n, v.done, '₹' + v.rev.toLocaleString('en-IN')]);
  const techRows = Object.entries(tech).sort((a, b) => b[1].done - a[1].done).map(([k, v]) => [k, v.done, '₹' + v.rev.toLocaleString('en-IN')]);
  reportRows = [['Month', m], ['Bookings', inMonth.length], ['Completed', done.length], ['Cancelled', inMonth.filter(b => b.status === 'cancelled').length], ['Revenue (recorded amounts)', revenue], ['Average order value', done.length ? Math.round(revenue / done.length) : 0], ['Repeat customers', repeat], [], ['Service', 'Bookings', 'Completed', 'Revenue'], ...svcRows, [], ['Technician', 'Completed jobs', 'Revenue'], ...techRows];
  $('monthReport').innerHTML = `<div class="kpis"><div><small>Bookings</small><b>${inMonth.length}</b></div><div><small>Completed</small><b>${done.length}</b></div><div><small>Revenue</small><b>₹${revenue.toLocaleString('en-IN')}</b></div><div><small>Avg order</small><b>₹${(done.length ? Math.round(revenue / done.length) : 0).toLocaleString('en-IN')}</b></div><div><small>Repeat customers</small><b>${repeat}</b></div></div>${table(['Service', 'Bookings', 'Completed', 'Revenue'], svcRows)}${table(['Technician', 'Completed jobs', 'Revenue'], techRows)}<p class="muted">Based on the ${bookings.length} loaded bookings (use “Load more” on the Bookings tab for older months).</p>`;
}
$('reportMonth').addEventListener('change', renderReport);
$('exportReport').addEventListener('click', () => { if (!reportRows.length) { notice('Nothing to export.', true); return; } downloadCSV('kamigo-report-' + $('reportMonth').value + '.csv', ['Metric', 'Value', '', ''], reportRows.map(r => [r[0] ?? '', r[1] ?? '', r[2] ?? '', r[3] ?? ''])); });

// ---------- customers (history + private notes) ----------
let customers = [];
$('loadCustomers').addEventListener('click', async () => {
  try { const s = await db.collection('customers').limit(500).get(); customers = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')); renderCustomers(); }
  catch (e) { console.error(e); notice('Could not load customers.', true); }
});
$('customerSearch').addEventListener('input', renderCustomers);
function renderCustomers() {
  const q = $('customerSearch').value.toLowerCase(), list = customers.filter(c => [c.name, c.email, c.phone, c.city].some(x => String(x || '').toLowerCase().includes(q)));
  $('customerList').innerHTML = list.length ? list.map(c => `<button class="thread" data-customer-id="${esc(c.id)}"><strong>${esc(c.name)}</strong><small>${esc(c.email)} · ${esc(c.phone || '')}</small><small>${esc(c.city || '')}</small></button>`).join('') : '<div class="empty">No customers found.</div>';
}
$('customerList').addEventListener('click', e => { const b = e.target.closest('[data-customer-id]'); if (b) showCustomer(b.dataset.customerId); });
async function showCustomer(id) {
  const c = customers.find(x => x.id === id); if (!c) return;
  const mine = bookings.filter(b => b.customerUid === id); let note = '';
  try { const n = await db.collection('customerNotes').doc(id).get(); note = n.exists ? n.data().note || '' : ''; } catch (_) {}
  $('customerDetail').innerHTML = `<h3>${esc(c.name)}</h3><p class="muted">${esc(c.email)} · <a href="tel:${esc(c.phone)}">${esc(c.phone || '')}</a><br>${esc(c.gender || '')}, ${esc(c.age || '')} · ${esc(c.city || '')}<br>Home: ${esc(c.address || '—')}<br>Work: ${esc(c.workAddress || '—')}<br>Joined: ${esc(time(c.createdAt))}${c.consentAt ? ' · Consent: ' + esc(time(c.consentAt)) : ''}</p>
<h4>Bookings (${mine.length})</h4>${mine.length ? mine.map(b => `<div class="service-row"><div><strong>${esc(b.service)}</strong><div class="muted">${esc(refOf(b.id))} · ${esc(b.preferredDate)} · ${esc((b.status || 'pending').replace(/_/g, ' '))}${b.amount != null ? ' · ₹' + esc(b.amount) : ''}</div></div></div>`).join('') : '<div class="empty">No bookings in the loaded set.</div>'}
<h4>Private staff notes</h4><textarea id="customerNote" rows="4" maxlength="1000" placeholder="Visible to staff only">${esc(note)}</textarea><p><button class="btn" id="saveNote" data-id="${esc(id)}">Save note</button></p>`;
  $('saveNote').addEventListener('click', async ev => {
    try { await db.collection('customerNotes').doc(ev.target.dataset.id).set({ note: $('customerNote').value.trim().slice(0, 1000), updatedAt: ts(), updatedBy: auth.currentUser.email }); audit('customer.note', c.email, 'note updated'); notice('Note saved.'); }
    catch (err) { console.error(err); notice('Could not save note.', true); }
  });
}

// ---------- audit log, deletion requests, error logs ----------
async function loadLogs() {
  if (!isFull()) return;
  const fill = (id, items, fn) => { $(id).innerHTML = items.length ? items.map(fn).join('') : '<div class="empty">Nothing yet.</div>'; };
  try { const s = await db.collection('auditLogs').orderBy('createdAt', 'desc').limit(100).get(); fill('auditList', s.docs, d => { const l = d.data(); return `<div class="logrow"><b>${esc(l.action)}</b> · ${esc(l.target)}<br><span class="muted">${esc(l.detail)}</span><br><small>${esc(l.actorEmail)} · ${esc(time(l.createdAt))}</small></div>`; }); } catch (e) { console.error(e); $('auditList').innerHTML = '<div class="empty">Could not load audit log.</div>'; }
  try { const s = await db.collection('deletionRequests').orderBy('createdAt', 'desc').limit(50).get(); fill('deletionList', s.docs, d => { const l = d.data(); return `<div class="logrow"><b>${esc(l.name || l.email)}</b> · ${esc(l.email)}<br><small>${esc(time(l.createdAt))} · ${l.done ? '✅ erased' : '⏳ pending (Cloud Function)'}</small></div>`; }); } catch (e) { console.error(e); $('deletionList').innerHTML = '<div class="empty">Could not load requests.</div>'; }
  try { const s = await db.collection('errorLogs').orderBy('createdAt', 'desc').limit(50).get(); fill('errorList', s.docs, d => { const l = d.data(); return `<div class="logrow"><b>${esc(l.message)}</b><br><span class="muted">${esc(l.source)} · ${esc(l.page)}</span><br><small>${esc(time(l.createdAt))}</small></div>`; }); } catch (e) { console.error(e); $('errorList').innerHTML = '<div class="empty">Could not load errors.</div>'; }
}
$('refreshLogs').addEventListener('click', loadLogs);
})();
