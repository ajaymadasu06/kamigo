// Run with:  npm install && npm run test:rules      (needs Java + Firebase CLI for the emulator)
const test = require('node:test');
const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch } = require('firebase/firestore');

let env;
const google = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true, firebase: { sign_in_provider: 'google.com' } }).firestore();
const profile = (uid, email, extra = {}) => ({ uid, name: 'Test User', email, photoURL: '', phone: '9876543210', age: 30, gender: 'Male', city: 'Mangalagiri', address: '', consentAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });
const booking = (uid, email, extra = {}) => ({ service: 'Electrician', name: 'Test User', phone: '9876543210', city: 'Mangalagiri', preferredDate: '2030-01-01', timeSlot: 'Morning', address: '1 Main St', pincode: '522503', customerUid: uid, customerEmail: email, status: 'pending', createdAt: serverTimestamp(), ...extra });

test.before(async () => {
  env = await initializeTestEnvironment({ projectId: 'kamigo-test', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
});
test.after(() => env.cleanup());
test.beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/boss'), { role: 'admin' });
    await setDoc(doc(db, 'admins/helper'), { role: 'support' });
    await setDoc(doc(db, 'workers/tech@x.com'), { name: 'Tech', email: 'tech@x.com', active: true });
    await setDoc(doc(db, 'customers/cust1'), { ...profile('cust1', 'c1@x.com'), consentAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
    await setDoc(doc(db, 'bookings/b1'), { ...booking('cust1', 'c1@x.com'), createdAt: new Date(), assignee: 'tech@x.com', assigneeName: 'Tech' });
    await setDoc(doc(db, 'bookings/done1'), { ...booking('cust1', 'c1@x.com'), createdAt: new Date(), status: 'completed' });
  });
});

test('customer can create a valid profile; bad phone / non-Google provider rejected', async () => {
  await assertSucceeds(setDoc(doc(google('new1', 'n1@x.com'), 'customers/new1'), profile('new1', 'n1@x.com')));
  await assertFails(setDoc(doc(google('new2', 'n2@x.com'), 'customers/new2'), profile('new2', 'n2@x.com', { phone: '12345' })));
  const password = env.authenticatedContext('new3', { email: 'n3@x.com', email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore();
  await assertFails(setDoc(doc(password, 'customers/new3'), profile('new3', 'n3@x.com')));
});

test('customers cannot read other customers', async () => {
  await assertSucceeds(getDoc(doc(google('cust1', 'c1@x.com'), 'customers/cust1')));
  await assertFails(getDoc(doc(google('cust2', 'c2@x.com'), 'customers/cust1')));
});

test('valid booking is accepted (with throttle stamp); spoofed owner or bad slot rejected', async () => {
  const db = google('cust1', 'c1@x.com'), batch = writeBatch(db);
  batch.set(doc(db, 'bookings/new1'), booking('cust1', 'c1@x.com'));
  batch.update(doc(db, 'customers/cust1'), { lastBookingAt: serverTimestamp() });
  await assertSucceeds(batch.commit());
  await assertFails(setDoc(doc(db, 'bookings/spoof'), booking('someoneElse', 'c1@x.com')));
  await assertFails(setDoc(doc(db, 'bookings/badslot'), booking('cust1', 'c1@x.com', { timeSlot: 'Midnight' })));
});

test('booking throttle: second booking within 30s is rejected', async () => {
  const db = google('cust1', 'c1@x.com');
  await env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'customers/cust1'), { lastBookingAt: new Date() }));
  await assertFails(setDoc(doc(db, 'bookings/fast'), booking('cust1', 'c1@x.com')));
});

test('customer can cancel/reschedule own pending booking, not confirm it', async () => {
  const db = google('cust1', 'c1@x.com');
  await assertSucceeds(updateDoc(doc(db, 'bookings/b1'), { preferredDate: '2030-02-02', timeSlot: 'Evening', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, 'bookings/b1'), { status: 'confirmed', updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(db, 'bookings/b1'), { status: 'cancelled', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(google('cust2', 'c2@x.com'), 'bookings/done1'), { status: 'cancelled', updatedAt: serverTimestamp() }));
});

test('only full admins can update bookings; support is read-only', async () => {
  await assertSucceeds(updateDoc(doc(google('boss', 'boss@x.com'), 'bookings/b1'), { status: 'on_the_way', amount: 500, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(google('helper', 'h@x.com'), 'bookings/b1'), { status: 'confirmed', updatedAt: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(google('helper', 'h@x.com'), 'bookings/b1')));
});

test('technician can progress only their assigned job', async () => {
  const tech = google('techUid', 'tech@x.com');
  await assertSucceeds(updateDoc(doc(tech, 'bookings/b1'), { status: 'on_the_way', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(tech, 'bookings/done1'), { status: 'completed', updatedAt: serverTimestamp() }));
});

test('reviews: only the owner, only for completed bookings', async () => {
  const db = google('cust1', 'c1@x.com'), rv = { bookingId: 'done1', service: 'Electrician', rating: 5, comment: 'Great', authorName: 'Test', customerUid: 'cust1', createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(db, 'reviews/done1'), rv));
  await assertFails(setDoc(doc(db, 'reviews/b1'), { ...rv, bookingId: 'b1' }));
  await assertFails(setDoc(doc(google('cust2', 'c2@x.com'), 'reviews/done1'), { ...rv, customerUid: 'cust2' }));
});

test('services are public to read but admin-only to write', async () => {
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'services/anything')));
  await assertFails(setDoc(doc(google('cust1', 'c1@x.com'), 'services/x'), { name: 'X', rate: 1, active: true }));
  await assertSucceeds(setDoc(doc(google('boss', 'boss@x.com'), 'services/x'), { name: 'X', rate: 1, active: true }));
});

test('audit logs are append-only', async () => {
  const db = google('boss', 'boss@x.com');
  await assertSucceeds(setDoc(doc(db, 'auditLogs/a1'), { actorUid: 'boss', actorEmail: 'boss@x.com', action: 'test', target: 't', detail: 'd', createdAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, 'auditLogs/a1'), { detail: 'changed' }));
  await assertFails(deleteDoc(doc(db, 'auditLogs/a1')));
});

test('deletion request can only be filed by the account owner', async () => {
  const req = (uid, email) => ({ uid, email, name: 'Test', createdAt: serverTimestamp() });
  await assertSucceeds(setDoc(doc(google('cust1', 'c1@x.com'), 'deletionRequests/cust1'), req('cust1', 'c1@x.com')));
  await assertFails(setDoc(doc(google('cust2', 'c2@x.com'), 'deletionRequests/cust1'), req('cust1', 'c2@x.com')));
});
