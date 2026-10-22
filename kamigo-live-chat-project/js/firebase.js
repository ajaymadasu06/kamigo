// Kamigo Firebase setup and authenticated support chat.
// Each signed-in customer has ONE support conversation (document ID = their Google UID).
// Anonymous visitors cannot create support threads.
(() => {
  const cfg = {
    apiKey: "AIzaSyAtTQzvodXhQmElO5s1oUPYAyx3jt_X8MA",
    authDomain: "kamigo-bb729.firebaseapp.com",
    projectId: "kamigo-bb729",
    storageBucket: "kamigo-bb729.firebasestorage.app",
    messagingSenderId: "252163017983",
    appId: "1:252163017983:web:e81e961d2b8454fbdbd0ca",
    measurementId: "G-SB5YFLFFP1"
  };
  if (!window.firebase) return;
  if (!firebase.apps.length) firebase.initializeApp(cfg);
  try { if (window.KAMIGO_APPCHECK_KEY && firebase.appCheck) firebase.appCheck().activate(window.KAMIGO_APPCHECK_KEY, true); } catch (e) { console.warn('App Check not active:', e); }

  const db = firebase.firestore(), auth = firebase.auth();
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();
  const $ = id => document.getElementById(id);
  const panel = $('chatPanel'), launch = $('chatLaunch'), closeBtn = $('chatClose'),
        form = $('chatForm'), input = $('chatInput'), list = $('chatMessages'), status = $('chatStatus');

  let user = null, threadId = null, stopMessages = null, ready = false, initPromise = Promise.resolve();

  const setStatus = (text, bad = false) => { status.textContent = text; status.classList.toggle('chat-error', bad); };
  const say = (text, role = 'team') => {
    const el = document.createElement('div');
    el.className = 'chat-bubble ' + (role === 'customer' ? 'user' : 'team');
    el.textContent = text;
    list.appendChild(el);
    list.scrollTop = list.scrollHeight;
  };
  const customerName = () => String(user.displayName || 'Customer').slice(0, 70);

  // Unread badge: admin messages newer than the last time the customer had the chat open.
  const seenKey = () => 'kamigoChatSeen:' + (user ? user.uid : '');
  const getSeen = () => { try { return Number(localStorage.getItem(seenKey())) || 0; } catch (_) { return 0; } };
  const markSeen = () => { try { localStorage.setItem(seenKey(), String(Date.now())); } catch (_) {} const b = $('chatBadge'); if (b) b.hidden = true; };
  function updateBadge(snap) {
    const b = $('chatBadge'); if (!b) return;
    if (panel.classList.contains('open')) { markSeen(); return; }
    const seen = getSeen(); let n = 0;
    snap.forEach(d => { const m = d.data(), t = m.createdAt && m.createdAt.toMillis ? m.createdAt.toMillis() : 0; if (m.senderRole === 'admin' && t > seen) n++; });
    b.textContent = n > 9 ? '9+' : String(n); b.hidden = n === 0;
    if (n && !b.dataset.n) b.dataset.n = '1';
  }

  function listen() {
    if (stopMessages) stopMessages();
    stopMessages = db.collection('conversations').doc(threadId).collection('messages')
      .orderBy('createdAt', 'asc')
      .onSnapshot(snap => {
        list.innerHTML = '';
        if (snap.empty) say('Hi! Welcome to Kamigo. Send a message and our team will reply here.');
        snap.forEach(d => {
          const m = d.data(), el = document.createElement('div');
          el.className = 'chat-bubble ' + (m.senderRole === 'customer' ? 'user' : 'team');
          el.textContent = m.text || '';
          const meta = document.createElement('span');
          meta.className = 'chat-time';
          meta.textContent = m.senderRole === 'customer' ? 'You' : 'Kamigo Support';
          el.appendChild(meta);
          list.appendChild(el);
        });
        list.scrollTop = list.scrollHeight;
        updateBadge(snap);
        setStatus('Connected to support');
      }, err => {
        console.error(err);
        setStatus('Chat unavailable. Check Firebase rules.', true);
      });
  }

  // Finds this customer's conversation (including older random-ID ones) or creates it.
  async function findOrCreateThread(u) {
    const col = db.collection('conversations');
    const find = async () => {
      const q = await col.where('customerUid', '==', u.uid).limit(1).get();
      return q.empty ? null : q.docs[0].id;
    };
    let id = await find();
    if (id) return id;
    try {
      await col.doc(u.uid).set({
        customerUid: u.uid,
        customerName: customerName(),
        customerEmail: u.email,
        createdAt: ts(),
        lastMessage: 'Support chat started',
        lastMessageAt: ts(),
        status: 'open'
      });
      return u.uid;
    } catch (e) {
      id = await find();          // another tab may have created it first
      if (id) return id;
      throw e;
    }
  }

  async function setupForUser(signedUser) {
    ready = false; user = signedUser; threadId = null;
    if (stopMessages) { stopMessages(); stopMessages = null; }
    list.innerHTML = '';
    if (!user || user.isAnonymous) {
      setStatus('Sign in with Google to use customer support.');
      say('Please sign in with Google to start a private support conversation.');
      return;
    }
    try {
      threadId = await findOrCreateThread(user);
      ready = true;
      setStatus('Connected to support');
      listen();
    } catch (e) {
      console.error('Kamigo support setup:', e);
      setStatus(e.code === 'permission-denied'
        ? 'Chat blocked by Firestore rules (permission-denied). Publish the latest firestore.rules in Firebase Console.'
        : 'Live chat unavailable (' + (e.code || 'error') + ').', true);
      say('Support chat could not start. Please try again later.');
    }
  }

  // Writes a customer message and updates the conversation summary atomically.
  async function postCustomerMessage(text) {
    const ref = db.collection('conversations').doc(threadId), batch = db.batch();
    batch.set(ref.collection('messages').doc(), { text, senderUid: user.uid, senderRole: 'customer', createdAt: ts() });
    batch.update(ref, { lastMessage: text.slice(0, 1000), lastMessageAt: ts(), status: 'open', customerName: customerName(), customerEmail: user.email });
    await batch.commit();
  }

  launch.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      if (!auth.currentUser || auth.currentUser.isAnonymous) {
        showNotice('Sign in with Google to use customer support.');
        if (window.kamigoAuth) window.kamigoAuth.openProfile();
      }
      input.focus();
      markSeen();
    }
  });
  closeBtn.addEventListener('click', () => panel.classList.remove('open'));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    if (!ready || !user || user.isAnonymous) {
      showNotice('Please sign in with Google before sending a message.');
      if (window.kamigoAuth) window.kamigoAuth.openProfile();
      return;
    }
    input.value = '';
    try { await postCustomerMessage(text); }
    catch (err) {
      console.error(err);
      input.value = text;
      setStatus('Message not sent. Check Firestore rules.', true);
    }
  });

  auth.onAuthStateChanged(u => { initPromise = setupForUser(u); });

  window.kamigoSupport = {
    attachBooking: async details => {
      await initPromise;
      if (!ready || !user || user.isAnonymous || !threadId) throw new Error('Sign in with Google to use support chat');
      const reference = 'KM-' + details.bookingId.slice(0, 8).toUpperCase();
      const message = 'SERVICE REQUEST RECEIVED — ' + details.service + ' in ' + details.city +
        '. Preferred: ' + details.preferredDate + ' (' + (details.timeSlot || 'any time') + '). Address: ' + (details.address || '-') + ' - ' + (details.pincode || '') +
        (details.couponCode ? '. Coupon: ' + details.couponCode : '') + '. Customer: ' + details.name +
        '. Phone: ' + details.phone + '. Booking reference: ' + reference +
        '. Please contact the customer to follow up.';
      await postCustomerMessage(message);
      return threadId;
    }
  };
})();
