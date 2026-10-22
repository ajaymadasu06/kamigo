// Lightweight English / Telugu / Hindi switcher for the public page.
// Only strings listed below are translated; everything else stays in English.
// NOTE: please have a native speaker review these translations before launch.
(() => {
  const D = {
    'Services':['సేవలు','सेवाएँ'],'How it works':['ఎలా పనిచేస్తుంది','यह कैसे काम करता है'],'About Kamigo':['కామిగో గురించి','कामिगो के बारे में'],
    'Sign in with Google':['Google తో సైన్ ఇన్','Google से साइन इन करें'],'My profile':['నా ప్రొఫైల్','मेरी प्रोफ़ाइल'],'Book a service':['సేవను బుక్ చేయండి','सेवा बुक करें'],
    'YOUR NEIGHBOURHOOD, SORTED':['మీ పరిసరాల్లో, అన్నీ సులభం','आपका मोहल्ला, सब आसान'],'Local help.':['స్థానిక సహాయం.','स्थानीय मदद.'],'Zero hassle.':['ఏ ఇబ్బంది లేకుండా.','बिना झंझट।'],
    'From fixing a leaky tap to finding a helping hand at home — get everyday things done with Kamigo.':['లీక్ అవుతున్న ట్యాప్ బాగు చేయడం నుండి ఇంట్లో సహాయం దొరకడం వరకు — కామిగోతో రోజువారీ పనులు పూర్తి చేసుకోండి.','टपकते नल को ठीक कराने से लेकर घर में मदद पाने तक — कामिगो के साथ रोज़मर्रा के काम निपटाइए।'],
    'What do you need help with?':['మీకు ఏ సహాయం కావాలి?','आपको किस मदद की ज़रूरत है?'],'Find help ↗':['సహాయం కనుగొనండి ↗','मदद खोजें ↗'],
    'Simple booking':['సులభమైన బుకింగ్','आसान बुकिंग'],'Local services':['స్థానిక సేవలు','स्थानीय सेवाएँ'],'One helpful place':['అన్నీ ఒకే చోట','एक ही जगह सब कुछ'],
    'A LITTLE HELP GOES A LONG WAY':['కొంచెం సహాయం ఎంతో ఉపయోగం','थोड़ी सी मदद, बड़ा सहारा'],'What can we help with?':['మేము ఏ విషయంలో సహాయం చేయగలం?','हम किस काम में मदद करें?'],
    "Choose what you need. We'll make the next step simple.":['మీకు కావాల్సినది ఎంచుకోండి. తరువాతి అడుగు మేము సులభం చేస్తాం.','जो चाहिए चुनें। अगला कदम हम आसान बना देंगे।'],'Explore services ↗':['సేవలు చూడండి ↗','सेवाएँ देखें ↗'],
    'Electrician':['ఎలక్ట్రీషియన్','इलेक्ट्रीशियन'],'Switches, lights & wiring':['స్విచ్‌లు, లైట్లు & వైరింగ్','स्विच, लाइट और वायरिंग'],'Find an electrician ↗':['ఎలక్ట్రీషియన్‌ను కనుగొనండి ↗','इलेक्ट्रीशियन खोजें ↗'],
    'Plumbing':['ప్లంబింగ్','प्लंबिंग'],'Taps, leaks & pipe fixes':['ట్యాప్‌లు, లీకులు & పైపు మరమ్మతులు','नल, रिसाव और पाइप की मरम्मत'],'Fix it today ↗':['ఈరోజే బాగు చేయించండి ↗','आज ही ठीक कराएँ ↗'],
    'Appliance repair':['ఉపకరణాల మరమ్మతు','उपकरण मरम्मत'],'Everyday appliances, sorted':['రోజువారీ ఉపకరణాలు, సులభంగా','रोज़ के उपकरण, आसानी से'],'Get it repaired ↗':['మరమ్మతు చేయించండి ↗','मरम्मत कराएँ ↗'],
    'Household help':['ఇంటి పనుల సహాయం','घरेलू मदद'],'A hand with everyday tasks':['రోజువారీ పనుల్లో చేయూత','रोज़मर्रा के कामों में हाथ'],'Find home help ↗':['ఇంటి సహాయం కనుగొనండి ↗','घरेलू मदद खोजें ↗'],
    'Home cleaning':['ఇంటి శుభ్రత','घर की सफ़ाई'],'Fresh, tidy and comfortable':['తాజాగా, శుభ్రంగా, సౌకర్యంగా','ताज़ा, साफ़ और आरामदायक'],'Make it sparkle ↗':['మెరిసేలా చేయండి ↗','चमका दें ↗'],
    'Fresh vegetables':['తాజా కూరగాయలు','ताज़ी सब्ज़ियाँ'],'Daily essentials made easier':['రోజువారీ అవసరాలు సులభంగా','रोज़ की ज़रूरतें आसान'],'Explore delivery ↗':['డెలివరీ చూడండి ↗','डिलीवरी देखें ↗'],
    'Appointment help':['అపాయింట్‌మెంట్ సహాయం','अपॉइंटमेंट सहायता'],'Help organising a hospital visit':['ఆసుపత్రి సందర్శనకు ఏర్పాట్లలో సహాయం','अस्पताल यात्रा की व्यवस्था में मदद'],'Get assistance ↗':['సహాయం పొందండి ↗','सहायता पाएँ ↗'],
    'Something else?':['ఇంకేమైనా?','कुछ और?'],'Tell us what you need':['మీకు ఏం కావాలో చెప్పండి','बताइए आपको क्या चाहिए'],"Let's figure it out ↗":['కలిసి చూద్దాం ↗','मिलकर हल करें ↗'],
    'NO COMPLICATED STEPS':['క్లిష్టమైన దశలు లేవు','कोई जटिल कदम नहीं'],'Getting help should be easy.':['సహాయం పొందడం సులభంగా ఉండాలి.','मदद पाना आसान होना चाहिए।'],
    'Choose a service':['సేవను ఎంచుకోండి','सेवा चुनें'],'Share your details':['మీ వివరాలు పంచుకోండి','अपनी जानकारी दें'],'Take the next step':['తదుపరి అడుగు వేయండి','अगला कदम उठाएँ'],
    'Pick the kind of help you need and tell us a little about the task.':['మీకు కావాల్సిన సహాయం ఎంచుకుని, పని గురించి కొంచెం చెప్పండి.','जिस तरह की मदद चाहिए वह चुनें और काम के बारे में थोड़ा बताएँ।'],
    'Choose your city and preferred date so the request has the right context.':['మీ నగరం, ఇష్టమైన తేదీ ఎంచుకోండి, అప్పుడు అభ్యర్థనకు సరైన వివరాలు ఉంటాయి.','अपना शहर और पसंदीदा तारीख़ चुनें ताकि अनुरोध में सही जानकारी रहे।'],
    "Sign in with Google and send your request. You'll get a reference number right away, and our team will follow up.":['Google తో సైన్ ఇన్ చేసి మీ అభ్యర్థన పంపండి. వెంటనే రిఫరెన్స్ నంబర్ వస్తుంది, మా బృందం మిమ్మల్ని సంప్రదిస్తుంది.','Google से साइन इन करके अपना अनुरोध भेजें। आपको तुरंत संदर्भ संख्या मिलेगी और हमारी टीम संपर्क करेगी।'],
    'One less thing on your mind.':['మీ మనసుపై ఒక భారం తక్కువ.','आपके मन पर एक बोझ कम।'],'Find your help ↗':['మీ సహాయం కనుగొనండి ↗','अपनी मदद खोजें ↗'],'Local help, made simple.':['స్థానిక సహాయం, సులభంగా.','स्थानीय मदद, आसान बनी।'],
    '💬 Chat with our team':['💬 మా బృందంతో చాట్','💬 हमारी टीम से चैट करें'],'Kamigo Support':['కామిగో సపోర్ట్','कामिगो सपोर्ट'],'Send us a message':['మాకు సందేశం పంపండి','हमें संदेश भेजें'],'Write your message…':['మీ సందేశం రాయండి…','अपना संदेश लिखें…'],'Send':['పంపండి','भेजें'],'Book':['బుక్','बुक'],
    'Service Order Form':['సేవా ఆర్డర్ ఫారమ్','सेवा ऑर्डर फ़ॉर्म'],'Fill in the details below and our team will get back to you within minutes.':['క్రింది వివరాలు నింపండి, మా బృందం నిమిషాల్లో మిమ్మల్ని సంప్రదిస్తుంది.','नीचे जानकारी भरें, हमारी टीम कुछ ही मिनटों में आपसे संपर्क करेगी।'],'Service details':['సేవ వివరాలు','सेवा का विवरण'],'Your details':['మీ వివరాలు','आपकी जानकारी'],'Schedule':['షెడ్యూల్','समय-सारणी'],'Service location':['సేవ ప్రదేశం','सेवा का स्थान'],'Offers':['ఆఫర్లు','ऑफ़र'],'Select service':['సేవను ఎంచుకోండి','सेवा चुनें'],
    'Service':['సేవ','सेवा'],'Your name':['మీ పేరు','आपका नाम'],'Phone number':['ఫోన్ నంబర్','फ़ोन नंबर'],'City':['నగరం','शहर'],'Preferred date':['ఇష్టమైన తేదీ','पसंदीदा तारीख़'],'Preferred time':['ఇష్టమైన సమయం','पसंदीदा समय'],
    'Service address':['సేవ చిరునామా','सेवा का पता'],'PIN code':['పిన్ కోడ్','पिन कोड'],'Coupon code (optional)':['కూపన్ కోడ్ (ఐచ్ఛికం)','कूपन कोड (वैकल्पिक)'],'Apply':['వర్తింపజేయి','लागू करें'],'Send service request ↗':['సేవ అభ్యర్థన పంపండి ↗','सेवा अनुरोध भेजें ↗'],
    'Your Kamigo account':['మీ కామిగో ఖాతా','आपका कामिगो खाता'],'Full name':['పూర్తి పేరు','पूरा नाम'],'Age':['వయస్సు','उम्र'],'Gender':['లింగం','लिंग'],'Preferred city':['ఇష్టమైన నగరం','पसंदीदा शहर'],
    'Home address (optional)':['ఇంటి చిరునామా (ఐచ్ఛికం)','घर का पता (वैकल्पिक)'],'Work address (optional)':['పని చిరునామా (ఐచ్ఛికం)','कार्यालय का पता (वैकल्पिक)'],'Save account details':['ఖాతా వివరాలు సేవ్ చేయండి','खाता विवरण सहेजें'],
    'My service requests':['నా సేవ అభ్యర్థనలు','मेरे सेवा अनुरोध'],'Sign out':['సైన్ అవుట్','साइन आउट'],'Continue with Google':['Google తో కొనసాగండి','Google से जारी रखें']
  };
  const IDX = { te: 0, hi: 1 };
  const origText = new WeakMap(), origPh = new WeakMap();
  let lang = 'en', busy = false;

  function tr(key) { const e = D[key]; return e && lang !== 'en' ? e[IDX[lang]] : null; }

  function apply() {
    if (busy) return; busy = true; observer.disconnect();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: n => /^(SCRIPT|STYLE|OPTION|TEXTAREA)$/.test(n.parentNode.nodeName) || !n.nodeValue.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const base = origText.has(n) ? origText.get(n) : n.nodeValue;
      const key = base.trim(), t = tr(key);
      if (t) {
        if (!origText.has(n)) origText.set(n, base);
        const next = base.match(/^\s*/)[0] + t + base.match(/\s*$/)[0];
        if (n.nodeValue !== next) n.nodeValue = next;
      } else if (origText.has(n) && lang === 'en' && n.nodeValue !== origText.get(n)) n.nodeValue = origText.get(n);
    });
    document.querySelectorAll('[placeholder]').forEach(el => {
      const base = origPh.has(el) ? origPh.get(el) : el.getAttribute('placeholder'), t = tr(base);
      if (t) { origPh.set(el, base); el.setAttribute('placeholder', t); }
      else if (origPh.has(el) && lang === 'en') el.setAttribute('placeholder', origPh.get(el));
    });
    document.documentElement.lang = lang;
    busy = false; observe();
  }

  let timer;
  const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(apply, 60); });
  function observe() { observer.observe(document.body, { childList: true, subtree: true, characterData: true }); }

  function setLang(l) {
    lang = D && (l === 'te' || l === 'hi') ? l : 'en';
    try { localStorage.setItem('kamigoLang', lang); } catch (_) {}
    const sel = document.getElementById('langSelect'); if (sel) sel.value = lang;
    apply();
  }

  window.kamigoI18n = { apply, setLang };
  document.addEventListener('DOMContentLoaded', () => {
    const sel = document.getElementById('langSelect');
    if (sel) sel.addEventListener('change', () => setLang(sel.value));
    let saved = 'en'; try { saved = localStorage.getItem('kamigoLang') || 'en'; } catch (_) {}
    observe(); setLang(saved);
  });
})();
