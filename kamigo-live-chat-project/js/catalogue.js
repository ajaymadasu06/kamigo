// Kamigo: syncs the public service grid with the admin-managed Firestore `services` collection.
// The static cards in index.html are the fallback; if Firestore is empty or unreachable nothing changes.
(() => {
  if (!window.firebase || !firebase.apps.length) return;
  const grid = document.getElementById('serviceGrid'), select = document.getElementById('serviceSelect');
  if (!grid || !select) return;
  const norm = s => String(s || '').trim().toLowerCase();

  firebase.firestore().collection('services').get().then(snap => {
    if (snap.empty) return;
    const cards = [...grid.querySelectorAll('.service')];
    const cardFor = name => cards.find(c => norm(c.dataset.service) === norm(name) || norm(c.querySelector('strong')?.textContent) === norm(name));
    const optionFor = name => [...select.options].find(o => norm(o.value) === norm(name));
    const other = [...grid.querySelectorAll('.service')].find(c => norm(c.dataset.service) === 'other service');

    snap.docs.map(d => d.data()).sort((a, b) => String(a.name).localeCompare(String(b.name))).forEach(s => {
      if (!s.name) return;
      const card = cardFor(s.name), opt = optionFor(s.name);

      if (s.active === false) {                      // hidden by admin
        if (norm(s.name) === 'other service') return;
        if (card) card.style.display = 'none';
        if (opt) opt.remove();
        return;
      }

      let target = card;
      if (!target) {                                 // new service added by admin
        target = document.createElement('button');
        target.type = 'button';
        target.className = 'service';
        target.dataset.service = s.name;
        const icon = document.createElement('span'); icon.className = 'serviceicon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = '🛠️';
        const title = document.createElement('strong'); title.textContent = s.name;
        const desc = document.createElement('small'); desc.textContent = s.description || 'Ask our team for details';
        const arrow = document.createElement('span'); arrow.className = 'arrow'; arrow.textContent = 'Request this service ↗';
        target.append(icon, title, desc, arrow);
        target.addEventListener('click', () => openBooking(s.name));
        grid.insertBefore(target, other || null);
        if (!opt) {
          const o = document.createElement('option'); o.textContent = s.name; o.value = s.name;
          const otherOpt = optionFor('Other service');
          select.insertBefore(o, otherOpt || null);
        }
      } else if (s.description) {
        const small = target.querySelector('small'); if (small) small.textContent = s.description;
      }

      if (Number.isFinite(s.rate) && !target.querySelector('.rate')) {
        const rate = document.createElement('small');
        rate.className = 'rate';
        rate.textContent = 'From ₹' + s.rate.toLocaleString('en-IN');
        target.querySelector('small').after(rate);
      }
    });
  }).catch(e => console.warn('Kamigo catalogue not synced:', e.code || e));
})();

// Average customer ratings per service (from the public `reviews` collection).
(() => {
  if (!window.firebase || !firebase.apps.length) return;
  const grid = document.getElementById('serviceGrid'); if (!grid) return;
  const norm = s => String(s || '').trim().toLowerCase();
  firebase.firestore().collection('reviews').limit(500).get().then(snap => {
    const agg = {};
    snap.forEach(d => { const r = d.data(); if (!r.service || !Number.isFinite(r.rating)) return; const k = norm(r.service); (agg[k] = agg[k] || { sum: 0, n: 0 }); agg[k].sum += r.rating; agg[k].n++; });
    grid.querySelectorAll('.service').forEach(card => {
      const a = agg[norm(card.dataset.service)]; if (!a || card.querySelector('.rating-line')) return;
      const line = document.createElement('small'); line.className = 'rating-line';
      line.textContent = '★ ' + (a.sum / a.n).toFixed(1) + ' (' + a.n + (a.n === 1 ? ' review)' : ' reviews)');
      card.querySelector('small').after(line);
    });
  }).catch(e => console.warn('Ratings not loaded:', e.code || e));
})();
