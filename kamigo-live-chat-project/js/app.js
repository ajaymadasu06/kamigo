// Kamigo: UI interactions, service search, and booking modal.
const modalBack=document.getElementById('modalBack');const serviceSelect=document.getElementById('serviceSelect');const citySelect=document.getElementById('citySelect');const bookingCity=document.getElementById('bookingCity');const notice=document.getElementById('notice');let noticeTimer;
function showNotice(message){notice.textContent=message;notice.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.remove('show'),3200)}
function openBooking(service){const bookingForm=document.getElementById('bookingForm');bookingForm.reset();bookingForm.style.display='';const previousSuccess=document.getElementById('bookingSuccess');if(previousSuccess){previousSuccess.classList.remove('show');previousSuccess.style.display='none'}document.getElementById('modalTitle').textContent='Service Order Form';const sub=document.getElementById('orderSub');if(sub)sub.textContent='Fill in the details below and our team will get back to you within minutes.';if(service)serviceSelect.value=service;bookingCity.value=citySelect.value;const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());document.getElementById('bookingDate').min=d.toISOString().slice(0,10);window.dispatchEvent(new Event('kamigo:bookingopen'));modalBack.classList.add('open');if(window.kamigoI18n)kamigoI18n.apply();document.getElementById('customerName').focus()}
function closeBooking(){modalBack.classList.remove('open')}
document.getElementById('bookTop').addEventListener('click',()=>openBooking());document.getElementById('ctaBook').addEventListener('click',()=>openBooking());document.getElementById('closeModal').addEventListener('click',closeBooking);modalBack.addEventListener('click',e=>{if(e.target===modalBack)closeBooking()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeBooking()});citySelect.addEventListener('change',()=>{showNotice('Location set to '+citySelect.value+'.');});
document.querySelectorAll('.service').forEach(card=>card.addEventListener('click',()=>openBooking(card.dataset.service)));
document.getElementById('searchForm').addEventListener('submit',e=>{e.preventDefault();const q=document.getElementById('searchInput').value.trim().toLowerCase();let count=0;document.querySelectorAll('.service').forEach(card=>{const match=!q||card.dataset.service.toLowerCase().includes(q)||card.innerText.toLowerCase().includes(q);card.style.display=match?'flex':'none';if(match)count++});document.getElementById('emptyState').style.display=count?'none':'block';document.getElementById('services').scrollIntoView({behavior:'smooth'});if(q&&count===1){const visible=[...document.querySelectorAll('.service')].find(c=>c.style.display!=='none');if(visible)showNotice('Found '+visible.dataset.service+'. Select it to continue.')}else if(q&&count===0)showNotice('No exact match. You can request “Other service”.')});
document.getElementById('allServices').addEventListener('click',e=>{e.preventDefault();document.getElementById('searchInput').value='';document.querySelectorAll('.service').forEach(c=>c.style.display='flex');document.getElementById('emptyState').style.display='none';showNotice('Showing all services.')});

// Side popup (top-right) used for booking confirmations.
function sideToast(title, message, ms = 9000) {
  let el = document.getElementById('sideToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sideToast'; el.className = 'side-toast'; el.setAttribute('role', 'status');
    el.innerHTML = '<div class="st-icon" aria-hidden="true">✓</div><div><strong></strong><p></p></div><button type="button" aria-label="Dismiss">×</button>';
    el.querySelector('button').addEventListener('click', () => el.classList.remove('show'));
    document.body.appendChild(el);
  }
  el.querySelector('strong').textContent = title;
  el.querySelector('p').textContent = message;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms);
}

// Shared helpers (Indian mobile numbers).
window.kamigoUtil = {
  normPhone(v) {
    let p = String(v || '').replace(/[\s().-]/g, '');
    if (/^0[6-9]\d{9}$/.test(p)) p = p.slice(1);
    if (/^91[6-9]\d{9}$/.test(p)) p = '+' + p;
    return p;
  },
  validPhone(v) { return /^([+]91)?[6-9][0-9]{9}$/.test(window.kamigoUtil.normPhone(v)); }
};

// Stop the page behind a popup from scrolling while a popup is open.
(() => {
  const sync = () => { document.body.style.overflow = document.querySelector('.modalback.open') ? 'hidden' : ''; };
  new MutationObserver(sync).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
})();

// Installable app (PWA) + optional WhatsApp links.
(() => {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  const num = String(window.KAMIGO_WHATSAPP || '').replace(/\D/g, '');
  if (!num) return;
  const href = 'https://wa.me/' + num + '?text=' + encodeURIComponent('Hi Kamigo, I need help with a service.');
  const mk = text => { const a = document.createElement('a'); a.className = 'wa-link'; a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = text; return a; };
  const panel = document.getElementById('chatPanel');
  if (panel) { const row = document.createElement('div'); row.className = 'wa-row'; row.appendChild(mk('💬 Prefer WhatsApp? Chat with us there')); panel.appendChild(row); }
  const foot = document.querySelector('footer.footer'); if (foot) foot.appendChild(mk('WhatsApp us'));
})();

// Mobile menu.
(() => {
  const nav = document.querySelector('.nav'), btn = document.getElementById('menuBtn'); if (!nav || !btn) return;
  const set = open => { nav.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? '✕' : '☰'; btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); };
  btn.addEventListener('click', () => set(!nav.classList.contains('open')));
  nav.querySelectorAll('.navlinks a').forEach(a => a.addEventListener('click', () => set(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  const book = document.getElementById('bookMobile'), top = document.getElementById('bookTop');
  if (book && top) book.addEventListener('click', () => { set(false); top.click(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 850) set(false); });
})();
