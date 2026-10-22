// Sends a few client-side errors per session to Firestore `errorLogs` (signed-in users only) so admins can see failures.
(() => {
  if (!window.firebase || !firebase.apps.length) return;
  let sent = 0;
  const log = (message, source) => {
    const u = firebase.auth().currentUser; if (sent >= 5 || !u || u.isAnonymous) return; sent++;
    firebase.firestore().collection('errorLogs').add({ message: String(message || 'unknown').slice(0, 300), source: String(source || '').slice(0, 200), page: location.pathname.slice(0, 120), ua: navigator.userAgent.slice(0, 200), uid: u.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
  };
  window.addEventListener('error', e => log(e.message, (e.filename || '').split('/').pop() + ':' + e.lineno));
  window.addEventListener('unhandledrejection', e => log(e.reason && e.reason.message ? e.reason.message : e.reason, 'promise'));
})();
