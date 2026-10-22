// Kamigo bookings: Google sign-in and a saved customer profile are required.
(() => {
  const $ = id => document.getElementById(id);
  const refOf = id => 'KM-' + String(id).slice(0, 8).toUpperCase();
  let coupon = null, areaPins = null;

  const profile = () => (window.kamigoAuth && kamigoAuth.getProfile && kamigoAuth.getProfile()) || {};
  const hint = (el, text, cls) => { el.textContent = text || ''; el.className = 'hint' + (cls ? ' ' + cls : ''); };
  const db = () => firebase.firestore();

  // Service-area PIN list is optional (Admin -> Service area). Empty / missing = no restriction.
  async function loadArea() {
    if (areaPins) return areaPins;
    try { const s = await db().collection('settings').doc('area').get(); areaPins = s.exists && Array.isArray(s.data().pins) ? s.data().pins.map(String) : []; }
    catch (_) { areaPins = []; }
    return areaPins;
  }
  async function checkPin(show = true) {
    const pin = $('bookingPin').value.trim(), el = $('pinHint');
    if (!/^[0-9]{6}$/.test(pin)) { if (show) hint(el, pin ? 'Enter a valid 6-digit PIN code.' : '', pin ? 'bad' : ''); return false; }
    const pins = await loadArea();
    if (pins.length && !pins.includes(pin)) { hint(el, 'Sorry, we do not serve this PIN code yet. Try chat support for help.', 'bad'); return false; }
    hint(el, pins.length ? '✓ We serve your area' : '', 'ok'); return true;
  }
  $('bookingPin').addEventListener('input', () => { if ($('bookingPin').value.length >= 6) checkPin(); else hint($('pinHint'), ''); });

  // Address choice (home / work / new)
  function fillAddress() {
    const p = profile(), c = $('bookingAddressChoice').value, box = $('bookingAddress');
    if (c === 'home') box.value = p.address || ''; else if (c === 'work') box.value = p.workAddress || ''; else box.value = '';
    if (c !== 'new' && !box.value) hint($('pinHint'), 'No ' + c + ' address saved in your profile yet — type it below.', '');
  }
  $('bookingAddressChoice').addEventListener('change', fillAddress);

  // Coupon
  $('applyCoupon').addEventListener('click', async () => {
    const code = $('bookingCoupon').value.trim().toUpperCase(), el = $('couponHint'); coupon = null;
    if (!code) { hint(el, ''); return; }
    if (!/^[A-Z0-9]{3,20}$/.test(code)) { hint(el, 'Coupon codes use letters and numbers only.', 'bad'); return; }
    try {
      const s = await db().collection('coupons').doc(code).get();
      if (s.exists && s.data().active === true) { coupon = { code, percent: s.data().percent }; hint(el, '✓ ' + s.data().percent + '% off applied. Final price is confirmed by our team.', 'ok'); }
      else hint(el, 'This coupon is not valid.', 'bad');
    } catch (e) { console.error(e); hint(el, 'Could not check the coupon right now.', 'bad'); }
  });
  $('bookingCoupon').addEventListener('input', () => { coupon = null; hint($('couponHint'), ''); });

  // Photos (optional, max 3, compressed in the browser before upload)
  let photoFiles = [];
  function compress(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const r = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => { URL.revokeObjectURL(url); b ? resolve(b) : reject(new Error('compress failed')); }, 'image/jpeg', 0.78);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
      img.src = url;
    });
  }
  function renderPhotos() {
    const strip = $('photoStrip'); strip.innerHTML = '';
    photoFiles.forEach(f => { const im = document.createElement('img'); im.alt = 'Selected photo'; im.src = URL.createObjectURL(f); im.onload = () => URL.revokeObjectURL(im.src); strip.appendChild(im); });
    hint($('photoHint'), photoFiles.length ? photoFiles.length + ' photo(s) selected.' : 'Up to 3 photos. They are compressed automatically.', photoFiles.length ? 'ok' : '');
  }
  $('bookingPhotos').addEventListener('change', e => {
    const picked = [...e.target.files].filter(f => f.type.startsWith('image/'));
    photoFiles = picked.slice(0, 3); if (picked.length > 3) showNotice('Only the first 3 photos were kept.');
    renderPhotos();
  });

  // Prefill when the modal opens
  window.addEventListener('kamigo:bookingopen', () => {
    coupon = null; hint($('couponHint'), ''); hint($('pinHint'), ''); photoFiles = []; $('bookingPhotos').value = ''; renderPhotos();
    const p = profile(), user = window.kamigoAuth && kamigoAuth.getUser();
    if (user && !user.isAnonymous) { $('customerName').value = p.name || user.displayName || ''; $('customerPhone').value = p.phone || ''; }
    $('bookingAddressChoice').value = p.address ? 'home' : (p.workAddress ? 'work' : 'new'); fillAddress();
  });

  document.addEventListener('submit', async event => {
    if (!event.target || event.target.id !== 'bookingForm') return;
    event.preventDefault(); event.stopImmediatePropagation();
    const form = event.target, button = form.querySelector('button[type="submit"]');
    const name = $('customerName').value.trim(), phone = kamigoUtil.normPhone($('customerPhone').value);
    const service = $('serviceSelect').value, city = $('bookingCity').value, preferredDate = $('bookingDate').value, timeSlot = $('bookingSlot').value;
    const address = $('bookingAddress').value.trim(), pincode = $('bookingPin').value.trim();
    if (name.length < 2) { showNotice('Please enter your full name.'); return; }
    if (!kamigoUtil.validPhone(phone)) { showNotice('Enter a valid Indian mobile number (10 digits starting with 6-9).'); return; }
    if (!preferredDate) { showNotice('Please choose a preferred date.'); return; }
    const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    if (preferredDate < today.toISOString().slice(0, 10)) { showNotice('Please choose today or a future date.'); return; }
    if (address.length < 5) { showNotice('Please enter the service address.'); return; }
    if (!(await checkPin())) { showNotice('Please enter a valid PIN code in our service area.'); return; }
    const user = window.kamigoAuth && kamigoAuth.getUser ? kamigoAuth.getUser() : null;
    if (!user || user.isAnonymous) { showNotice('Please sign in with Google before booking.'); if (window.kamigoAuth) kamigoAuth.openProfile(); return; }
    if (!window.firebase || !firebase.apps.length) { showNotice('Booking is unavailable right now. Please try again later.'); return; }
    button.disabled = true; button.textContent = 'Sending request…';
    try {
      const fs = db(), customerRef = fs.collection('customers').doc(user.uid), snap = await customerRef.get(), saved = snap.exists ? snap.data() : {};
      if (!saved.consentAt) { showNotice('Please tick the Privacy Policy consent in My profile and save it first.'); kamigoAuth.openProfile(); return; }
      if (!saved.name || !kamigoUtil.validPhone(saved.phone || '') || !saved.city) { showNotice('Please save a valid phone number and city in My profile first.'); kamigoAuth.openProfile(); return; }
      const bookingRef = fs.collection('bookings').doc();
      const data = { service, name, phone, city, preferredDate, timeSlot, address, pincode, customerUid: user.uid, customerEmail: user.email || '', status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() };
      if (coupon) data.couponCode = coupon.code;
      if (photoFiles.length) {
        try {
          if (!firebase.storage) throw new Error('storage SDK missing');
          button.textContent = 'Uploading photos…';
          const paths = [];
          for (let i = 0; i < photoFiles.length; i++) {
            const blob = await compress(photoFiles[i]), path = 'bookingPhotos/' + user.uid + '/' + bookingRef.id + '/' + i + '.jpg';
            await firebase.storage().ref(path).put(blob, { contentType: 'image/jpeg' }); paths.push(path);
          }
          data.photos = paths; button.textContent = 'Sending request…';
        } catch (upErr) { console.warn('Photo upload failed; continuing without photos:', upErr); showNotice('Photos could not be uploaded, so your request was sent without them.'); }
      }
      const batch = fs.batch();
      batch.set(bookingRef, data);
      batch.update(customerRef, { lastBookingAt: firebase.firestore.FieldValue.serverTimestamp() });   // powers the 30-second throttle rule
      await batch.commit();
      const booking = bookingRef;
      let chatLinked = false;
      try { if (window.kamigoSupport && typeof kamigoSupport.attachBooking === 'function') { await kamigoSupport.attachBooking({ bookingId: booking.id, service, name, phone, city, preferredDate, timeSlot, address, pincode, couponCode: coupon && coupon.code }); chatLinked = true; } }
      catch (err) { console.warn('Booking saved; chat link was not added:', err); }
      form.style.display = 'none';
      let success = $('bookingSuccess');
      if (!success) { success = document.createElement('div'); success.id = 'bookingSuccess'; success.className = 'success-view'; success.innerHTML = '<div class="success-mark" aria-hidden="true">✓</div><h3>Request received!</h3><p>Your request has been received by our team. We will contact you soon.</p><div class="success-ref"></div><button class="btn" type="button" id="successChat">Chat with our team ↗</button>'; document.querySelector('#modalBack .modal').appendChild(success); }
      success.querySelector('.success-ref').textContent = 'REFERENCE: ' + refOf(booking.id); success.style.display = 'block'; requestAnimationFrame(() => success.classList.add('show'));
      $('modalTitle').textContent = 'You’re all set'; if ($('orderSub')) $('orderSub').textContent = 'Your order has been submitted successfully.';
      $('successChat').onclick = () => { $('modalBack').classList.remove('open'); $('chatLaunch').click(); };
      const who = saved.name || name || user.displayName || 'there';
      if (typeof sideToast === 'function') sideToast('Thank you, ' + who + '! Your service is booked.', 'Your ' + service + ' request (' + refOf(booking.id) + ') for ' + preferredDate + ' (' + timeSlot.toLowerCase() + ') has been received. Our team will contact you within minutes.' + (chatLinked ? '' : ''));
    } catch (error) {
      console.error('Kamigo booking save:', error);
      showNotice(error.code === 'permission-denied' ? 'Could not save. If you just sent a request, please wait 30 seconds and try again — otherwise check the published Firestore rules.' : 'Could not save your request. Check your internet connection.');
    } finally { button.disabled = false; button.textContent = 'Send service request ↗'; }
  }, true);
})();
