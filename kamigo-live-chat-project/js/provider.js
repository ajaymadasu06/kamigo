// Kamigo technician page: a technician sees and updates ONLY the bookings assigned to their Google email.
(() => {
'use strict';
const cfg = {apiKey:"AIzaSyAtTQzvodXhQmElO5s1oUPYAyx3jt_X8MA",authDomain:"kamigo-bb729.firebaseapp.com",projectId:"kamigo-bb729",storageBucket:"kamigo-bb729.firebasestorage.app",messagingSenderId:"252163017983",appId:"1:252163017983:web:e81e961d2b8454fbdbd0ca",measurementId:"G-SB5YFLFFP1"};
if (!firebase.apps.length) firebase.initializeApp(cfg);
try { if (window.KAMIGO_APPCHECK_KEY && firebase.appCheck) firebase.appCheck().activate(window.KAMIGO_APPCHECK_KEY, true); } catch (e) { console.warn(e); }
const auth = firebase.auth(), db = firebase.firestore(), $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const refOf = id => 'KM-' + String(id).slice(0, 8).toUpperCase();
let jobs = [], stop = null, first = true;
function notice(msg, bad = false) { const n = $('notice'); n.textContent = msg; n.style.background = bad ? '#fff0f0' : '#e9f7f0'; n.style.color = bad ? '#b42318' : '#176c5a'; n.classList.add('show'); setTimeout(() => n.classList.remove('show'), 4000); }

$('loginButton').addEventListener('click', async () => { try { const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); await auth.signInWithPopup(p); } catch (e) { $('loginError').textContent = 'Sign-in failed: ' + (e.message || e); } });
$('logoutButton').addEventListener('click', () => auth.signOut());

auth.onAuthStateChanged(async user => {
  if (stop) { stop(); stop = null; }
  if (!user) { $('loginView').classList.remove('hidden'); $('jobsView').classList.add('hidden'); return; }
  const email = String(user.email || '').toLowerCase();
  try {
    const w = await db.collection('workers').doc(email).get();
    if (!w.exists || w.data().active === false) { await auth.signOut(); $('loginError').textContent = 'This Google account is not an active Kamigo technician. Ask the admin to add ' + email + '.'; return; }
    $('loginView').classList.add('hidden'); $('jobsView').classList.remove('hidden'); $('who').textContent = w.data().name + ' · ' + email;
    first = true;
    stop = db.collection('bookings').where('assignee', '==', email).onSnapshot(s => {
      if (!first) s.docChanges().forEach(c => { if (c.type === 'added' && !c.doc.metadata.hasPendingWrites) notice('🔔 New job assigned: ' + (c.doc.data().service || '')); });
      first = false;
      jobs = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.preferredDate || '').localeCompare(String(b.preferredDate || '')));
      render();
    }, e => { console.error(e); $('jobs').innerHTML = '<div class="empty">Could not load jobs. Check Firestore rules.</div>'; });
  } catch (e) { console.error(e); $('loginError').textContent = 'Could not verify technician access. Check that the latest Firestore rules are published.'; }
});

function render() {
  const f = $('jobFilter').value, openSt = ['pending', 'confirmed', 'on_the_way'];
  const list = jobs.filter(j => f === 'all' || (f === 'completed' ? j.status === 'completed' : openSt.includes(j.status || 'pending')));
  $('jobs').innerHTML = list.length ? list.map(j => {
    const st = j.status || 'pending', canWork = openSt.includes(st);
    return `<div class="service-row" style="align-items:flex-start"><div><strong>${esc(j.service)}</strong> <span class="pill ${esc(st)}">${esc(st.replace(/_/g, ' '))}</span><div class="muted">${esc(refOf(j.id))} · ${esc(j.preferredDate)} ${esc(j.timeSlot || '')}</div><div>${esc(j.name)} · <a href="tel:${esc(j.phone)}">${esc(j.phone)}</a></div><div class="muted">${esc(j.address || '')} ${esc(j.pincode || '')}, ${esc(j.city || '')}</div>${j.couponCode ? '<div class="muted">Coupon: ' + esc(j.couponCode) + '</div>' : ''}${j.photos && j.photos.length ? `<div><button class="rowbtn" data-photos="${esc(j.id)}">📷 ${j.photos.length} photo(s)</button></div>` : ''}</div>
<div class="row-actions">${st === 'pending' ? `<button class="rowbtn" data-act="confirmed" data-id="${esc(j.id)}">Accept job</button>` : ''}${st === 'pending' || st === 'confirmed' ? `<button class="rowbtn" data-act="on_the_way" data-id="${esc(j.id)}">I'm on the way</button>` : ''}${canWork ? `<button class="rowbtn" data-act="completed" data-id="${esc(j.id)}">Mark completed</button>` : ''}</div></div>`;
  }).join('') : '<div class="empty">No jobs here.</div>';
}
async function showPhotos(id) {
  const j = jobs.find(x => x.id === id); if (!j || !j.photos) return;
  try {
    const urls = await Promise.all(j.photos.map(p => firebase.storage().ref(p).getDownloadURL()));
    const o = document.createElement('div'); o.className = 'lightbox'; o.innerHTML = '<div class="lb-in"><button class="lb-close" aria-label="Close">×</button><div class="lb-grid"></div></div>';
    const g = o.querySelector('.lb-grid'); urls.forEach(u => { const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; const im = document.createElement('img'); im.src = u; im.alt = 'Customer photo'; a.appendChild(im); g.appendChild(a); });
    o.addEventListener('click', ev => { if (ev.target === o || ev.target.classList.contains('lb-close')) o.remove(); }); document.body.appendChild(o);
  } catch (e) { console.error(e); notice('Could not load photos.', true); }
}
$('jobFilter').addEventListener('change', render);
$('jobs').addEventListener('click', async e => {
  const ph = e.target.closest('[data-photos]'); if (ph) { showPhotos(ph.dataset.photos); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  if (b.dataset.act === 'completed' && !confirm('Mark this job as completed?')) return;
  try { await db.collection('bookings').doc(b.dataset.id).update({ status: b.dataset.act, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); notice('Job updated.'); }
  catch (err) { console.error(err); notice('Could not update job.', true); }
});
})();
