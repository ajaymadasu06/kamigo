// Kamigo customer authentication, profile, and "My service requests" (Google accounts only).
(() => {
  if (!window.firebase) return;
  const cfg = {apiKey:"AIzaSyAtTQzvodXhQmElO5s1oUPYAyx3jt_X8MA",authDomain:"kamigo-bb729.firebaseapp.com",projectId:"kamigo-bb729",storageBucket:"kamigo-bb729.firebasestorage.app",messagingSenderId:"252163017983",appId:"1:252163017983:web:e81e961d2b8454fbdbd0ca",measurementId:"G-SB5YFLFFP1"};
  if (!firebase.apps.length) firebase.initializeApp(cfg);
  const auth = firebase.auth(), db = firebase.firestore();
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();
  const byId = id => document.getElementById(id);
  const signInButton = byId('googleSignIn'), profileBack = byId('profileBack');
  let currentProfile = null, stopBookings = null, reviewed = new Set(), lastStatus = null, rawBookings = [];

  const openProfile = () => profileBack.classList.add('open');
  const closeProfile = () => profileBack.classList.remove('open');
  const safeText = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const refOf = id => 'KM-' + String(id).slice(0, 8).toUpperCase();

  // ---------- sign in ----------
  async function googleSignIn() {
    const provider = new firebase.auth.GoogleAuthProvider(); provider.setCustomParameters({prompt:'select_account'});
    try { await auth.signInWithPopup(provider); openProfile(); showNotice('Google account verified. Complete your Kamigo profile.'); }
    catch (e) {
      console.error('Kamigo Google sign-in:', e);
      // Popups are blocked in many mobile / in-app browsers; fall back to a full-page redirect.
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') { try { await auth.signInWithRedirect(provider); return; } catch (e2) { console.error(e2); } }
      showNotice(e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request' ? 'Sign-in was cancelled.' : e.code === 'auth/unauthorized-domain' ? 'This website domain is not authorized in Firebase Authentication.' : 'Google sign-in failed. Check Firebase Authentication settings.');
    }
  }
  auth.getRedirectResult().then(r => { if (r && r.user) openProfile(); }).catch(e => console.error('Redirect sign-in:', e));
  signInButton.addEventListener('click', () => auth.currentUser && !auth.currentUser.isAnonymous ? openProfile() : googleSignIn());
  byId('profileGoogleSignIn').addEventListener('click', googleSignIn);
  byId('closeProfile').addEventListener('click', closeProfile);
  profileBack.addEventListener('click', e => { if (e.target === profileBack) closeProfile(); });
  byId('signOutButton').addEventListener('click', async () => { try { await auth.signOut(); closeProfile(); showNotice('You have signed out of Kamigo.'); } catch (e) { console.error(e); showNotice('Could not sign out. Please try again.'); } });

  // ---------- profile summary + saved animation ----------
  function renderSummary(p) {
    let box = byId('profileSummary');
    if (!box) { box = document.createElement('div'); box.id = 'profileSummary'; box.className = 'profile-summary'; byId('profileForm').before(box); }
    if (!p || !p.name) { box.hidden = true; return; }
    box.hidden = false; box.innerHTML = '';
    [['Name',p.name],['Email',p.email],['Phone',p.phone],['Age',p.age],['Gender',p.gender],['City',p.city],['Home',p.address||'—'],['Work',p.workAddress||'—']].forEach(([k, v]) => {
      const row = document.createElement('div'), b = document.createElement('b'); b.textContent = k; row.append(b, ' ' + String(v ?? '')); box.appendChild(row);
    });
  }
  function playSaved(name) {
    const modal = document.querySelector('#profileBack .profile-modal'); let o = byId('saveSuccess');
    if (!o) { o = document.createElement('div'); o.id = 'saveSuccess'; o.className = 'save-success'; o.innerHTML = '<div class="tick"><svg viewBox="0 0 48 48"><path d="M10 25l9 9 19-20"/></svg></div><h3></h3><p>Your Kamigo account is ready.</p>'; modal.appendChild(o); }
    o.querySelector('h3').textContent = 'Saved, ' + (name.split(' ')[0] || 'friend') + '!';
    o.classList.add('show'); setTimeout(() => o.classList.remove('show'), 1800);
  }

  // ---------- My service requests (live) ----------
  const STEPS = ['Received', 'Confirmed', 'On the way', 'Completed'];
  const stepIndex = st => ({ pending: 0, confirmed: 1, on_the_way: 2, completed: 3, cancelled: 0 }[st] ?? 0);
  const label = st => String(st || 'pending').replace(/_/g, ' ');
  function renderBookings() {
    const target = byId('myBookings');
    if (!rawBookings.length) { target.innerHTML = '<p>You have not made any service requests yet.</p>'; return; }
    target.innerHTML = rawBookings.map(b => {
      const st = b.status || 'pending', open = st === 'pending' || st === 'confirmed', at = stepIndex(st);
      const timeline = `<div class="timeline ${st === 'cancelled' ? 'cancelled' : ''}">${STEPS.map((n, i) => `<div class="tl ${st !== 'cancelled' && i <= at ? 'done' : ''} ${st !== 'cancelled' && i === at ? 'now' : ''}">${n}</div>`).join('')}</div>`;
      let actions = '';
      if (open) actions += `<button type="button" class="mini-btn" data-resched="${safeText(b.id)}">Reschedule</button><button type="button" class="mini-btn danger" data-cancel="${safeText(b.id)}">Cancel request</button>`;
      if (st === 'completed') actions += `<button type="button" class="mini-btn" data-receipt="${safeText(b.id)}">Receipt</button>`;
      if (st === 'completed' && !reviewed.has(b.id)) actions += `<button type="button" class="mini-btn" data-rate="${safeText(b.id)}" data-service="${safeText(b.service)}">★ Rate this service</button>`;
      if (st === 'completed' && reviewed.has(b.id)) actions += '<span class="booking-meta">Thanks for your review ★</span>';
      actions += `<button type="button" class="mini-btn" data-again="${safeText(b.service)}" data-city="${safeText(b.city)}">Book again</button>`;
      return `<div class="booking-item" data-booking="${safeText(b.id)}"><strong>${safeText(b.service || 'Service request')}</strong><div class="booking-meta">Reference: ${refOf(b.id)}<br>City: ${safeText(b.city || 'Not provided')}<br>Preferred: ${safeText(b.preferredDate || '')} ${safeText(b.timeSlot || '')}${b.assigneeName ? '<br>Technician: ' + safeText(b.assigneeName) : ''}${b.amount != null ? '<br>Amount: ₹' + safeText(b.amount) : ''}</div><span class="booking-status ${safeText(st)}">${safeText(label(st))}</span>${timeline}<div class="booking-actions">${actions}</div></div>`;
    }).join('');
  }
  function printReceipt(b) {
    const w = window.open('', '_blank'); if (!w) { showNotice('Please allow pop-ups to print your receipt.'); return; }
    const p = currentProfile || {}, when = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().toLocaleDateString('en-IN') : '';
    const row = (k, v) => v ? `<tr><td>${safeText(k)}</td><td>${safeText(v)}</td></tr>` : '';
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Kamigo receipt ${refOf(b.id)}</title><style>body{font:15px/1.6 system-ui,Segoe UI,Roboto,sans-serif;max-width:640px;margin:30px auto;padding:0 20px;color:#18231c}h1{margin:0;color:#1d7c68}.top{display:flex;justify-content:space-between;border-bottom:3px solid #1d7c68;padding-bottom:10px;margin-bottom:16px}table{width:100%;border-collapse:collapse}td{padding:8px 4px;border-bottom:1px solid #e4e9e2;vertical-align:top}td:first-child{color:#52635a;width:38%}.amt{font-size:22px;font-weight:800;color:#1d7c68}.foot{margin-top:26px;color:#52635a;font-size:12px}@media print{button{display:none}}</style></head><body>
<div class="top"><div><h1>kamigo.</h1><div>Local help, made simple</div></div><div style="text-align:right"><b>SERVICE RECEIPT</b><br>${refOf(b.id)}<br>${safeText(when)}</div></div>
<table>${row('Customer', b.name || p.name)}${row('Phone', b.phone)}${row('Service', b.service)}${row('Service date', (b.preferredDate || '') + ' ' + (b.timeSlot || ''))}${row('Address', (b.address || '') + ' ' + (b.pincode || '') + ', ' + (b.city || ''))}${row('Technician', b.assigneeName)}${row('Coupon', b.couponCode)}${row('Status', 'Completed')}</table>
<p>${b.amount != null ? 'Amount: <span class="amt">₹' + safeText(Number(b.amount).toLocaleString('en-IN')) + '</span>' : 'Final amount as agreed with our team.'}</p>
<p class="foot">Thank you for choosing Kamigo. This is a computer-generated receipt. Questions? Chat with us on the website.</p><button onclick="window.print()">Print / Save as PDF</button></body></html>`);
    w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch (_) {} }, 500);
  }
  // Reschedule + receipt (separate listener keeps the original handler untouched)
  byId('myBookings').addEventListener('click', async e => {
    const rs = e.target.closest('[data-resched]'), save = e.target.closest('[data-resched-save]'), rc = e.target.closest('[data-receipt]');
    if (rc) { const b = rawBookings.find(x => x.id === rc.dataset.receipt); if (b) printReceipt(b); return; }
    if (rs) {
      const item = rs.closest('.booking-item'); if (item.querySelector('.resched-box')) return;
      const b = rawBookings.find(x => x.id === rs.dataset.resched), box = document.createElement('div'); box.className = 'resched-box'; box.dataset.id = b.id;
      const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
      box.innerHTML = `<input type="date" data-rdate min="${today.toISOString().slice(0, 10)}" value="${safeText(b.preferredDate || '')}"><select data-rslot>${['Morning', 'Afternoon', 'Evening'].map(t => `<option ${t === b.timeSlot ? 'selected' : ''}>${t}</option>`).join('')}</select><button type="button" class="mini-btn" data-resched-save="1">Save new time</button>`;
      item.appendChild(box); return;
    }
    if (save) {
      const box = save.closest('.resched-box'), date = box.querySelector('[data-rdate]').value, slot = box.querySelector('[data-rslot]').value;
      const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
      if (!date || date < today.toISOString().slice(0, 10)) { showNotice('Please choose today or a future date.'); return; }
      try { await db.collection('bookings').doc(box.dataset.id).update({ preferredDate: date, timeSlot: slot, updatedAt: ts() }); showNotice('Your request was rescheduled. Our team will confirm the new time.'); }
      catch (err) { console.error(err); showNotice('Could not reschedule. It may already be in progress.'); }
    }
  });
  byId('myBookings').addEventListener('click', async e => {
    const cancel = e.target.closest('[data-cancel]'), again = e.target.closest('[data-again]'), rate = e.target.closest('[data-rate]'), star = e.target.closest('[data-star]'), send = e.target.closest('[data-send-review]');
    if (cancel) {
      if (!confirm('Cancel this service request?')) return;
      try { await db.collection('bookings').doc(cancel.dataset.cancel).update({ status: 'cancelled', updatedAt: ts() }); showNotice('Your request was cancelled.'); }
      catch (err) { console.error(err); showNotice('Could not cancel. It may already be in progress.'); }
    } else if (again) {
      closeProfile(); openBooking(again.dataset.again);
      const c = byId('bookingCity'); if ([...c.options].some(o => o.value === again.dataset.city)) c.value = again.dataset.city;
    } else if (rate) {
      const item = rate.closest('.booking-item'); if (item.querySelector('.review-box')) return;
      const box = document.createElement('div'); box.className = 'review-box'; box.dataset.rating = '0'; box.dataset.service = rate.dataset.service; box.dataset.id = rate.dataset.rate;
      box.innerHTML = '<div class="stars">' + [1,2,3,4,5].map(n => `<span data-star="${n}">★</span>`).join('') + '</div><textarea maxlength="300" rows="2" placeholder="Tell us how it went (optional)"></textarea><div class="booking-actions"><button type="button" class="mini-btn" data-send-review="1">Submit review</button></div>';
      item.appendChild(box);
    } else if (star) {
      const box = star.closest('.review-box'), n = Number(star.dataset.star); box.dataset.rating = n;
      box.querySelectorAll('[data-star]').forEach(s => s.classList.toggle('on', Number(s.dataset.star) <= n));
    } else if (send) {
      const box = send.closest('.review-box'), rating = Number(box.dataset.rating), user = auth.currentUser;
      if (!rating) { showNotice('Please tap a star rating first.'); return; }
      try {
        await db.collection('reviews').doc(box.dataset.id).set({ bookingId: box.dataset.id, service: box.dataset.service, rating, comment: box.querySelector('textarea').value.trim().slice(0, 300), authorName: String((currentProfile && currentProfile.name) || user.displayName || 'Customer').split(' ')[0].slice(0, 40), customerUid: user.uid, createdAt: ts() });
        reviewed.add(box.dataset.id); renderBookings(); showNotice('Thank you for your review!');
      } catch (err) { console.error(err); showNotice('Could not save your review.'); }
    }
  });
  function watchBookings(user) {
    if (stopBookings) stopBookings();
    lastStatus = null; rawBookings = [];
    byId('myBookings').innerHTML = '<p>Loading your requests…</p>';
    db.collection('reviews').where('customerUid', '==', user.uid).get().then(s => { reviewed = new Set(s.docs.map(d => d.id)); renderBookings(); }).catch(() => {});
    stopBookings = db.collection('bookings').where('customerUid', '==', user.uid).onSnapshot(snap => {
      rawBookings = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ((b.createdAt && b.createdAt.seconds) || 9e12) - ((a.createdAt && a.createdAt.seconds) || 9e12));
      if (lastStatus) rawBookings.forEach(b => { const prev = lastStatus[b.id]; if (prev && prev !== b.status && b.status !== 'cancelled') sideToast('Update on your ' + (b.service || 'request'), refOf(b.id) + ' is now ' + label(b.status) + '.' + (b.status === 'confirmed' ? ' Our team will reach you soon.' : '') + (b.status === 'on_the_way' ? ' Your technician is on the way!' : '')); });
      lastStatus = Object.fromEntries(rawBookings.map(b => [b.id, b.status]));
      renderBookings();
    }, e => { console.error('Load customer bookings:', e); byId('myBookings').innerHTML = '<p>Could not load your requests. Check that the latest Firestore rules are published.</p>'; });
  }

  // ---------- save profile ----------
  byId('profileForm').addEventListener('submit', async e => {
    e.preventDefault(); const user = auth.currentUser; if (!user || user.isAnonymous) { showNotice('Please sign in with Google first.'); return; }
    const name = byId('profileFullName').value.trim(), phone = kamigoUtil.normPhone(byId('profilePhone').value), age = Number(byId('profileAge').value), gender = byId('profileGender').value, city = byId('profileCity').value, address = byId('profileAddress').value.trim(), workAddress = byId('profileWorkAddress').value.trim();
    if (name.length < 2) { showNotice('Please enter your full name.'); return; }
    if (!kamigoUtil.validPhone(phone)) { showNotice('Enter a valid Indian mobile number (10 digits starting with 6-9).'); return; }
    if (!Number.isInteger(age) || age < 18 || age > 120) { showNotice('You must be 18 or older to use Kamigo (age 18-120).'); return; }
    if (!byId('profileConsent').checked) { showNotice('Please accept the Privacy Policy and Terms to continue.'); return; }
    if (!gender) { showNotice('Please select your gender.'); return; }
    const button = byId('saveProfileButton'); button.disabled = true; button.textContent = 'Saving…';
    try {
      const ref = db.collection('customers').doc(user.uid), old = await ref.get();
      const data = { uid: user.uid, name, email: user.email || '', photoURL: user.photoURL || '', phone, age, gender, city, address, workAddress, updatedAt: ts() };
      if (!old.exists) data.createdAt = ts();
      if (!(old.exists && old.data().consentAt)) data.consentAt = ts();
      await ref.set(data, { merge: true }); currentProfile = { ...(old.exists ? old.data() : {}), ...data };
      byId('profilePhone').value = phone; renderSummary(currentProfile); playSaved(name);
      if (byId('customerName') && !byId('customerName').value) byId('customerName').value = name;
      if (byId('customerPhone') && !byId('customerPhone').value) byId('customerPhone').value = phone;
      byId('profileStatus').textContent = '✓ Account created and details saved. You can now book services and use support chat.'; showNotice('Your Kamigo account details are saved.');
    } catch (err) { console.error('Save profile:', err); byId('profileStatus').textContent = 'Could not save account details: ' + (err.code || 'error') + '. Check the published Firestore rules and browser console.'; showNotice('Could not save account details. Check the profile error message.'); }
    finally { button.disabled = false; button.textContent = 'Save account details'; }
  });

  // ---------- delete account & data (GDPR/DPDP-style erasure request; a Cloud Function performs the deletion) ----------
  byId('deleteAccountButton').addEventListener('click', async () => {
    const user = auth.currentUser; if (!user || user.isAnonymous) return;
    if (!confirm('This will permanently delete your profile, bookings, chats and reviews. This cannot be undone. Continue?')) return;
    if ((prompt('Type DELETE to confirm') || '').trim().toUpperCase() !== 'DELETE') { showNotice('Deletion cancelled.'); return; }
    try {
      await db.collection('deletionRequests').doc(user.uid).set({ uid: user.uid, email: user.email || '', name: String((currentProfile && currentProfile.name) || user.displayName || '').slice(0, 70), createdAt: ts() });
      closeProfile(); await auth.signOut();
      showNotice('Deletion requested. Your data will be erased within 7 days. You have been signed out.');
    } catch (e) { console.error('Deletion request:', e); showNotice('Could not send the deletion request (' + (e.code || 'error') + '). Please contact support.'); }
  });

  // ---------- auth state ----------
  auth.onAuthStateChanged(async user => {
    const signedIn = !!user && !user.isAnonymous;
    byId('profileSignedOut').hidden = signedIn; byId('profileSignedIn').hidden = !signedIn;
    signInButton.textContent = signedIn ? 'My profile' : 'Sign in with Google';
    if (!signedIn) { if (stopBookings) { stopBookings(); stopBookings = null; } renderSummary(null); byId('profileStatus').textContent = 'Sign in with Google to create your verified customer account, save your details, and view your service requests.'; currentProfile = null; return; }
    byId('profileStatus').textContent = 'Your Google account is connected. Complete the details below to make bookings.';
    byId('profileName').textContent = user.displayName || 'Kamigo customer'; byId('profileEmail').textContent = user.email || '';
    const photo = byId('profilePhoto'); if (user.photoURL) { photo.src = user.photoURL; photo.hidden = false; } else photo.hidden = true;
    try {
      const snap = await db.collection('customers').doc(user.uid).get(), p = snap.exists ? snap.data() : {}; currentProfile = p;
      byId('profileFullName').value = p.name || user.displayName || ''; byId('profilePhone').value = p.phone || ''; byId('profileAge').value = p.age ?? ''; byId('profileGender').value = p.gender || ''; byId('profileCity').value = p.city || 'Mangalagiri'; byId('profileAddress').value = p.address || ''; byId('profileWorkAddress').value = p.workAddress || ''; byId('profileConsent').checked = !!p.consentAt;
      if (byId('customerName') && !byId('customerName').value) byId('customerName').value = p.name || user.displayName || '';
      if (byId('customerPhone') && !byId('customerPhone').value) byId('customerPhone').value = p.phone || '';
      renderSummary(snap.exists ? p : null);
      byId('profileStatus').textContent = snap.exists ? 'Your account details are loaded. Update them and save when needed.' : 'Google sign-in successful. Complete the required details and save your profile.';
    } catch (e) { console.error('Read customer profile:', e); byId('profileStatus').textContent = 'Could not load your profile (' + (e.code || 'error') + '). Check Firestore Rules and the browser console.'; }
    watchBookings(user);
  });

  window.kamigoAuth = {
    getUser: () => auth.currentUser,
    getProfile: () => currentProfile,
    setProfile: p => { currentProfile = p; },
    openProfile,
    requireGoogleSignIn: async () => { if (auth.currentUser && !auth.currentUser.isAnonymous) return auth.currentUser; openProfile(); await googleSignIn(); if (auth.currentUser && !auth.currentUser.isAnonymous) return auth.currentUser; throw new Error('Google sign-in required'); }
  };
})();
