// Kamigo notifications. Writes documents to the `mail` collection, which the Firebase
// "Trigger Email from Firestore" extension (firebase/firestore-send-email) delivers via your SMTP provider.
// Requires the Blaze plan. Set ADMIN_EMAILS (comma separated) in functions/.env, e.g.
//   ADMIN_EMAILS=owner@example.com,ops@example.com
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
const staff = () => String(process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
const ref = id => 'KM-' + String(id).slice(0, 8).toUpperCase();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const send = (to, subject, html) => to.length ? db.collection('mail').add({ to, message: { subject, html } }) : null;

// 1) New booking -> email the team.
exports.onNewBooking = onDocumentCreated({ document: 'bookings/{id}', region: 'asia-south1' }, async event => {
  const b = event.data.data();
  await send(staff(), `New booking ${ref(event.params.id)} - ${b.service}`,
    `<p><b>${esc(b.name)}</b> (${esc(b.phone)}) booked <b>${esc(b.service)}</b>.</p>
     <p>When: ${esc(b.preferredDate)} ${esc(b.timeSlot)}<br>Where: ${esc(b.address)} ${esc(b.pincode)}, ${esc(b.city)}<br>Coupon: ${esc(b.couponCode || '-')}</p>`);
});

// 2) Booking status change -> email the customer (and the technician when newly assigned).
exports.onBookingUpdated = onDocumentUpdated({ document: 'bookings/{id}', region: 'asia-south1' }, async event => {
  const before = event.data.before.data(), after = event.data.after.data(), id = event.params.id;
  if (before.status !== after.status && after.customerEmail) {
    await send([after.customerEmail], `Your Kamigo request ${ref(id)} is ${after.status}`,
      `<p>Hi ${esc(after.name)},</p><p>Your <b>${esc(after.service)}</b> request (${ref(id)}) is now <b>${esc(after.status)}</b>.</p>${after.assigneeName ? `<p>Technician: ${esc(after.assigneeName)}</p>` : ''}<p>— Team Kamigo</p>`);
  }
  if ((before.preferredDate !== after.preferredDate || before.timeSlot !== after.timeSlot) && after.status !== 'cancelled') {
    await send(staff(), `Rescheduled: ${ref(id)} - ${after.service}`, `<p><b>${esc(after.name)}</b> (${esc(after.phone)}) moved <b>${esc(after.service)}</b> from ${esc(before.preferredDate)} ${esc(before.timeSlot)} to <b>${esc(after.preferredDate)} ${esc(after.timeSlot)}</b>.</p>`);
  }
  if (before.assignee !== after.assignee && after.assignee) {
    await send([after.assignee], `New Kamigo job ${ref(id)}`, `<p>You have been assigned <b>${esc(after.service)}</b> for ${esc(after.name)} on ${esc(after.preferredDate)} ${esc(after.timeSlot)}.</p><p>Open provider.html to see details.</p>`);
  }
});

// 3) Customer chat message -> email the team.
exports.onCustomerMessage = onDocumentCreated({ document: 'conversations/{cid}/messages/{mid}', region: 'asia-south1' }, async event => {
  const m = event.data.data(); if (m.senderRole !== 'customer') return;
  const c = (await db.collection('conversations').doc(event.params.cid).get()).data() || {};
  await send(staff(), `Support message from ${c.customerName || 'a customer'}`, `<p>${esc(m.text)}</p><p>Reply from the admin portal -> Live support.</p>`);
});

// 4) Privacy: erase everything about a customer who filed a deletion request (profile, bookings, photos, chats, reviews, notes, sign-in).
exports.onDeletionRequest = onDocumentCreated({ document: 'deletionRequests/{uid}', region: 'asia-south1', timeoutSeconds: 300 }, async event => {
  const uid = event.params.uid;
  const wipeQuery = async q => { const snap = await q.get(); for (const d of snap.docs) await db.recursiveDelete(d.ref); };
  await wipeQuery(db.collection('bookings').where('customerUid', '==', uid));
  await wipeQuery(db.collection('reviews').where('customerUid', '==', uid));
  await wipeQuery(db.collection('conversations').where('customerUid', '==', uid));
  await db.recursiveDelete(db.collection('conversations').doc(uid));      // new-style conversation (doc ID = uid), if it exists
  await db.collection('customerNotes').doc(uid).delete().catch(() => {});
  await db.collection('customers').doc(uid).delete().catch(() => {});
  try { await admin.storage().bucket().deleteFiles({ prefix: `bookingPhotos/${uid}/` }); } catch (e) { console.warn('photo cleanup:', e.message); }
  try { await admin.auth().deleteUser(uid); } catch (e) { console.warn('auth cleanup:', e.message); }
  await event.data.ref.update({ done: true, doneAt: admin.firestore.FieldValue.serverTimestamp() });
});

// 5) Daily Firestore backup to Cloud Storage. Needs env BACKUP_BUCKET (bucket name, no gs://) and IAM roles
//    (see README: "Cloud Datastore Import Export Admin" for the functions service account + Storage admin on the bucket).
exports.nightlyBackup = onSchedule({ schedule: 'every day 02:00', timeZone: 'Asia/Kolkata', region: 'asia-south1' }, async () => {
  const bucket = process.env.BACKUP_BUCKET; if (!bucket) { console.warn('BACKUP_BUCKET not set; skipping backup'); return; }
  const { v1 } = require('@google-cloud/firestore');
  const client = new v1.FirestoreAdminClient(), project = process.env.GCLOUD_PROJECT || admin.app().options.projectId;
  const stamp = new Date().toISOString().slice(0, 10);
  const [op] = await client.exportDocuments({ name: client.databasePath(project, '(default)'), outputUriPrefix: `gs://${bucket}/firestore-backups/${stamp}`, collectionIds: [] });
  console.log('Backup started:', op.name);
});
