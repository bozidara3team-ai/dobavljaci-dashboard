/* IRMS registracija firmi – aplikacija (bez servera, podaci u localStorage). */
(function () {
  'use strict';

  var V = window.Validacija;
  var KLJUC = 'irms-registracija.firme.v1';
  var VERZIJA_IZVOZA = 1;

  var STATUSI = [
    { id: 'nacrt', naziv: 'Nacrt' },
    { id: 'spremno', naziv: 'Spremno za podnošenje' },
    { id: 'podneseno', naziv: 'Podneseno na IRMS' },
    { id: 'registrovano', naziv: 'Registrovano' },
    { id: 'odbijeno', naziv: 'Odbijeno / dopuna' }
  ];

  var CHECKLISTA = [
    { id: 'sertifikat', tekst: 'Kvalifikovani elektronski sertifikat ovlašćenog lica (za prijavu i potpis na IRMS-u)' },
    { id: 'crps', tekst: 'Rješenje o upisu u CRPS' },
    { id: 'osnivackiAkt', tekst: 'Osnivački akt / ugovor o osnivanju i statut' },
    { id: 'odlukaDirektor', tekst: 'Odluka o imenovanju izvršnog direktora' },
    { id: 'prostor', tekst: 'Dokaz o pravu korišćenja poslovnog prostora (ugovor o zakupu / list nepokretnosti)' },
    { id: 'banka', tekst: 'Ugovor o otvaranju računa u banci' },
    { id: 'ovlascenje', tekst: 'Ovlašćenje za računovođu / zastupnika (ako zahtjev ne podnosi direktor)' },
    { id: 'pdv', tekst: 'Dokumentacija za PDV registraciju (ako se registruje za PDV)' }
  ];

  var OPSTINE = ['Andrijevica', 'Bar', 'Berane', 'Bijelo Polje', 'Budva', 'Cetinje', 'Danilovgrad',
    'Gusinje', 'Herceg Novi', 'Kolašin', 'Kotor', 'Mojkovac', 'Nikšić', 'Petnjica', 'Plav', 'Pljevlja',
    'Plužine', 'Podgorica', 'Rožaje', 'Šavnik', 'Tivat', 'Tuzi', 'Ulcinj', 'Zeta', 'Žabljak'];

  var BANKE = ['Crnogorska komercijalna banka', 'NLB Banka', 'Hipotekarna banka', 'Erste Bank',
    'Prva banka Crne Gore', 'Lovćen banka', 'Universal Capital Bank', 'Adriatic Bank', 'Ziraat Bank',
    'Zapad banka'];

  // ---------- pomoćne ----------
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function noviId() {
    return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function sada() { return new Date().toISOString(); }
  function datumPrikaz(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('sr-Latn-ME') + (iso.length > 10 ? ' ' + d.toLocaleTimeString('sr-Latn-ME', { hour: '2-digit', minute: '2-digit' }) : '');
  }
  function statusInfo(id) {
    return STATUSI.filter(function (s) { return s.id === id; })[0] || STATUSI[0];
  }
  function badge(id) {
    var s = statusInfo(id);
    return '<span class="badge s-' + s.id + '"><span class="dot"></span>' + esc(s.naziv) + '</span>';
  }
  function getPath(o, p) {
    return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o);
  }
  function setPath(o, p, v) {
    var ks = p.split('.');
    var last = ks.pop();
    var t = ks.reduce(function (a, k) { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; return a[k]; }, o);
    t[last] = v;
  }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('vidljiv');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('vidljiv'); }, 2600);
  }
  function preuzmi(ime, sadrzaj, tip) {
    var blob = new Blob([sadrzaj], { type: tip });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ime;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function danas() { return new Date().toISOString().slice(0, 10); }

  // ---------- skladište ----------
  var firme = [];
  var skladisteRadi = true;

  function ucitaj() {
    try {
      var raw = localStorage.getItem(KLJUC);
      firme = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(firme)) firme = [];
    } catch (e) {
      firme = [];
      skladisteRadi = false;
    }
  }
  function sacuvaj() {
    try {
      localStorage.setItem(KLJUC, JSON.stringify(firme));
    } catch (e) {
      if (skladisteRadi) toast('Upozorenje: pregledač ne dozvoljava čuvanje – napravite izvoz (JSON).');
      skladisteRadi = false;
    }
  }
  function nadji(id) { return firme.filter(function (f) { return f.id === id; })[0]; }

  // ---------- statistika i lista ----------
  var filterStatus = '';
  var pretraga = '';

  function renderStatistika() {
    var html = '<button class="stat' + (filterStatus === '' ? ' akt' : '') + '" data-status="">' +
      '<div class="n">' + firme.length + '</div><div class="l">Ukupno</div></button>';
    STATUSI.forEach(function (s) {
      var n = firme.filter(function (f) { return f.status === s.id; }).length;
      html += '<button class="stat' + (filterStatus === s.id ? ' akt' : '') + '" data-status="' + s.id + '">' +
        '<div class="n">' + n + '</div><div class="l s-' + s.id + '"><span class="dot"></span>' +
        '<span style="color:var(--muted)">' + esc(s.naziv) + '</span></div></button>';
    });
    $('#statistika').innerHTML = html;
  }

  function renderLista() {
    var q = pretraga.trim().toLowerCase();
    var lista = firme.filter(function (f) {
      if (filterStatus && f.status !== filterStatus) return false;
      if (!q) return true;
      var h = [f.naziv, f.skraceniNaziv, f.pib, f.registarskiBroj, getPath(f, 'sjediste.opstina'),
        getPath(f, 'sjediste.mjesto'), getPath(f, 'zastupnik.ime')].join(' ').toLowerCase();
      return h.indexOf(q) !== -1;
    }).sort(function (a, b) { return (b.izmijenjeno || '').localeCompare(a.izmijenjeno || ''); });

    if (!lista.length) {
      $('#lista').innerHTML = '<div class="prazno">' + (firme.length
        ? 'Nema firmi za zadati filter.'
        : 'Još nema unesenih firmi. Kliknite <strong>+ Nova firma</strong> da počnete.') + '</div>';
      return;
    }
    $('#lista').innerHTML = lista.map(function (f) {
      var p = V.provjeriFirmu(f);
      var gotovo = CHECKLISTA.filter(function (c) { return f.checklist && f.checklist[c.id]; }).length;
      var info = [f.pravniOblik, f.pib ? 'PIB ' + f.pib : null,
        [getPath(f, 'sjediste.mjesto'), getPath(f, 'sjediste.opstina')].filter(Boolean).join(', ')]
        .filter(Boolean).map(esc).join(' · ');
      var problemi = p.errors.length
        ? '<span class="meta" style="color:var(--danger)">' + p.errors.length + ' nedostaje / greška</span>'
        : '<span class="meta" style="color:var(--ok)">Podaci kompletni</span>';
      return '<article class="kartica" data-id="' + f.id + '" tabindex="0">' +
        '<div><div class="ime">' + esc(f.naziv || '(bez naziva)') + '</div><div class="meta">' + info + '</div></div>' +
        '<div class="desno">' + badge(f.status) + problemi + '</div>' +
        '<div class="meta">Dokumentacija: ' + gotovo + '/' + CHECKLISTA.length +
        (f.brojZahtjeva ? ' · Zahtjev br. ' + esc(f.brojZahtjeva) : '') + '</div>' +
        '<div class="meta" style="text-align:right">Izmijenjeno ' + esc(datumPrikaz(f.izmijenjeno)) + '</div>' +
        '</article>';
    }).join('');
  }

  function render() {
    renderStatistika();
    renderLista();
  }

  // ---------- forma ----------
  var forma = $('#forma');
  var dlgForma = $('#dlg-forma');
  var uredjujeId = null;

  function dodajRed(kont, tplId, podaci) {
    var node = $(tplId).content.firstElementChild.cloneNode(true);
    $$('[data-k]', node).forEach(function (inp) {
      var v = podaci && podaci[inp.dataset.k];
      if (v != null) inp.value = v;
    });
    $('.ukloni', node).addEventListener('click', function () { node.remove(); });
    var tip = $('[data-k="tip"]', node);
    if (tip) {
      var osvjezi = function () {
        $$('[data-za]', node).forEach(function (l) { l.hidden = l.dataset.za !== tip.value; });
      };
      tip.addEventListener('change', osvjezi);
      osvjezi();
    }
    kont.appendChild(node);
  }

  function citajRedove(kont) {
    return $$('.red', kont).map(function (red) {
      var o = {};
      $$('[data-k]', red).forEach(function (inp) {
        var lbl = inp.closest('[data-za]');
        if (lbl && lbl.hidden) return;
        o[inp.dataset.k] = inp.value.trim();
      });
      return o;
    }).filter(function (o) {
      return Object.keys(o).some(function (k) {
        return k !== 'tip' && k !== 'drzavljanstvo' && k !== 'drzava' && o[k];
      });
    });
  }

  function popuniFormu(f) {
    forma.reset();
    $$('[name]', forma).forEach(function (el) {
      var v = getPath(f, el.name);
      if (v != null) el.value = v;
    });
    $('#osnivaci').innerHTML = '';
    $('#racuni').innerHTML = '';
    (f.osnivaci && f.osnivaci.length ? f.osnivaci : [{ tip: 'fizicko' }]).forEach(function (o) {
      dodajRed($('#osnivaci'), '#tpl-osnivac', o);
    });
    (f.racuni && f.racuni.length ? f.racuni : [{}]).forEach(function (r) {
      dodajRed($('#racuni'), '#tpl-racun', r);
    });
    $('#forma-provjera').innerHTML = '';
    $$('.los', forma).forEach(function (el) { el.classList.remove('los'); });
  }

  function citajFormu() {
    var f = {};
    $$('[name]', forma).forEach(function (el) { setPath(f, el.name, el.value.trim()); });
    f.osnivaci = citajRedove($('#osnivaci'));
    f.racuni = citajRedove($('#racuni')).map(function (r) {
      if (r.broj && !V.provjeriRacun(r.broj)) r.broj = V.formatirajRacun(r.broj);
      return r;
    });
    return f;
  }

  function prikaziProvjeru(p, kont) {
    if (!p.errors.length && !p.warnings.length) {
      kont.innerHTML = '<p class="ok">✓ Svi obavezni podaci su uneseni i ispravni.</p>';
      return;
    }
    var html = '';
    if (p.errors.length) {
      html += '<strong class="g">Obavezno ispraviti (' + p.errors.length + '):</strong><ul class="g">' +
        p.errors.map(function (e) { return '<li>' + esc(e.poruka) + '</li>'; }).join('') + '</ul>';
    } else {
      html += '<p class="ok">✓ Obavezni podaci su kompletni.</p>';
    }
    if (p.warnings.length) {
      html += '<strong class="u">Upozorenja (' + p.warnings.length + '):</strong><ul class="u">' +
        p.warnings.map(function (e) { return '<li>' + esc(e.poruka) + '</li>'; }).join('') + '</ul>';
    }
    kont.innerHTML = html;
  }

  function oznaciPolja(p) {
    $$('.los', forma).forEach(function (el) { el.classList.remove('los'); });
    p.errors.forEach(function (e) {
      var el = forma.querySelector('[name="' + e.polje + '"]');
      if (!el) {
        var m = e.polje.match(/^osnivaci\.(\d+)\.(\w+)$/);
        if (m) {
          var red = $$('.osnivac', forma)[Number(m[1])];
          el = red && red.querySelector('[data-k="' + m[2] + '"]');
        }
      }
      if (el) el.classList.add('los');
    });
  }

  function otvoriFormu(id) {
    uredjujeId = id || null;
    var f = id ? nadji(id) : { pravniOblik: V.PRAVNI_OBLICI[0], pdvObveznik: 'ne' };
    $('#forma-naslov').textContent = id ? 'Izmjena: ' + (f.naziv || '') : 'Nova firma';
    popuniFormu(f);
    dlgForma.showModal();
    forma.querySelector('[name="naziv"]').focus();
  }

  forma.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var podaci = citajFormu();
    if (!podaci.naziv) {
      toast('Unesite bar naziv firme.');
      forma.querySelector('[name="naziv"]').classList.add('los');
      return;
    }
    var f;
    if (uredjujeId) {
      f = nadji(uredjujeId);
      Object.keys(podaci).forEach(function (k) { f[k] = podaci[k]; });
      // Ako podaci više nisu ispravni, "Spremno" vraćamo u "Nacrt".
      if (f.status === 'spremno' && V.provjeriFirmu(f).errors.length) {
        f.status = 'nacrt';
        f.istorija.push({ vrijeme: sada(), status: 'nacrt', napomena: 'Automatski vraćeno u nacrt – podaci nekompletni nakon izmjene' });
      }
    } else {
      f = podaci;
      f.id = noviId();
      f.status = 'nacrt';
      f.checklist = {};
      f.kreirano = sada();
      f.istorija = [{ vrijeme: f.kreirano, status: 'nacrt', napomena: 'Firma unesena' }];
      firme.push(f);
    }
    f.izmijenjeno = sada();
    sacuvaj();
    dlgForma.close();
    render();
    toast('Sačuvano.');
    otvoriDetalje(f.id);
  });

  $('#btn-provjeri').addEventListener('click', function () {
    var p = V.provjeriFirmu(citajFormu());
    prikaziProvjeru(p, $('#forma-provjera'));
    oznaciPolja(p);
    $('#forma-provjera').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  $('#dodaj-osnivaca').addEventListener('click', function () { dodajRed($('#osnivaci'), '#tpl-osnivac', { tip: 'fizicko' }); });
  $('#dodaj-racun').addEventListener('click', function () { dodajRed($('#racuni'), '#tpl-racun', {}); });

  // ---------- detalji ----------
  var dlgDet = $('#dlg-detalji');
  var detId = null;

  function polje(k, v) {
    if (v == null || v === '') return '';
    return '<div class="polje"><span class="k">' + esc(k) + '</span>' +
      '<button type="button" data-kopiraj="' + esc(v) + '" title="Kopiraj za lijepljenje na IRMS">Kopiraj</button>' +
      '<span class="v">' + esc(v) + '</span></div>';
  }

  function otvoriDetalje(id) {
    detId = id;
    var f = nadji(id);
    if (!f) return;
    var p = V.provjeriFirmu(f);
    $('#det-naslov').innerHTML = esc(f.naziv) + ' ' + badge(f.status);

    var sj = f.sjediste || {};
    var z = f.zastupnik || {};
    var html = '<div class="det-grid">';

    html += '<div class="blok"><h3>Status registracije</h3><div class="status-promjena">' +
      '<label class="napomena-mala">Novi status<select id="det-status">' +
      STATUSI.map(function (s) {
        return '<option value="' + s.id + '"' + (s.id === f.status ? ' selected' : '') + '>' + esc(s.naziv) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="napomena-mala">Broj zahtjeva / predmeta na IRMS-u<input id="det-broj" value="' + esc(f.brojZahtjeva || '') + '"></label>' +
      '<label class="napomena-mala">Napomena uz promjenu<input id="det-napomena" placeholder="npr. traže dopunu ugovora o zakupu"></label>' +
      '<button type="button" id="det-sacuvaj-status" class="primary">Sačuvaj status</button></div></div>';

    html += '<div class="blok"><h3>Provjera podataka</h3><div id="det-provjera" class="provjera"></div></div>';

    html += '<div class="blok"><h3>Podaci za unos na IRMS</h3>' +
      polje('Puni naziv', f.naziv) + polje('Skraćeni naziv', f.skraceniNaziv) +
      polje('Pravni oblik', f.pravniOblik) + polje('PIB', f.pib) +
      polje('Registarski broj (CRPS)', f.registarskiBroj) + polje('Datum osnivanja', f.datumOsnivanja) +
      polje('Šifra djelatnosti', f.sifraDjelatnosti) + polje('Opis djelatnosti', f.opisDjelatnosti) +
      polje('Osnovni kapital (€)', f.kapital) + polje('Broj zaposlenih', f.brojZaposlenih) +
      polje('E-mail', f.email) + polje('Telefon', f.telefon) +
      polje('PDV', f.pdvObveznik === 'da' ? 'Da' + (f.pdvDatum ? ', od ' + f.pdvDatum : '') : 'Ne') +
      '</div>';

    html += '<div class="blok"><h3>Sjedište i zastupnik</h3>' +
      polje('Opština', sj.opstina) + polje('Mjesto', sj.mjesto) + polje('Ulica', sj.ulica) +
      polje('Broj', sj.broj) + polje('Poštanski broj', sj.postanskiBroj) +
      polje('Zastupnik', z.ime) + polje('JMBG zastupnika', z.jmbg) + polje('Funkcija', z.funkcija) +
      polje('E-mail zastupnika', z.email) + '</div>';

    html += '<div class="blok"><h3>Osnivači</h3>' + ((f.osnivaci || []).map(function (o, i) {
      return '<div style="margin-bottom:6px"><strong>' + (i + 1) + '. ' + esc(o.ime) + '</strong>' +
        polje('Tip', o.tip === 'pravno' ? 'Pravno lice' : 'Fizičko lice') +
        polje('JMBG', o.jmbg) + polje('Pasoš', o.pasos) + polje('PIB', o.pib) +
        polje('Udio %', o.udio) + polje('Adresa', o.adresa) + '</div>';
    }).join('') || '<p class="napomena-mala">Nema unesenih osnivača.</p>') +
      '<h3 style="margin-top:10px">Računi</h3>' + ((f.racuni || []).map(function (r) {
        return polje(r.banka || 'Račun', r.broj);
      }).join('') || '<p class="napomena-mala">Nema unesenih računa.</p>') + '</div>';

    html += '<div class="blok checklist"><h3>Dokumentacija</h3>' + CHECKLISTA.map(function (c) {
      return '<label><input type="checkbox" data-check="' + c.id + '"' +
        (f.checklist && f.checklist[c.id] ? ' checked' : '') + '> ' + esc(c.tekst) + '</label>';
    }).join('') + '<p class="napomena-mala">Lista je orijentaciona – konačne zahtjeve provjerite u uputstvima na irms.tax.gov.me.</p></div>';

    html += '<div class="blok"><h3>Istorija</h3><ul class="istorija">' +
      (f.istorija || []).slice().reverse().map(function (h) {
        return '<li><span class="vr">' + esc(datumPrikaz(h.vrijeme)) + '</span> ' + badge(h.status) +
          (h.napomena ? '<div>' + esc(h.napomena) + '</div>' : '') + '</li>';
      }).join('') + '</ul></div>';

    if (f.napomena) html += '<div class="blok"><h3>Napomena</h3><p>' + esc(f.napomena) + '</p></div>';

    html += '</div>';
    $('#det-body').innerHTML = html;
    prikaziProvjeru(p, $('#det-provjera'));

    $('#det-sacuvaj-status').addEventListener('click', function () {
      var novi = $('#det-status').value;
      var broj = $('#det-broj').value.trim();
      var nap = $('#det-napomena').value.trim();
      if (novi === 'spremno' && V.provjeriFirmu(f).errors.length) {
        toast('Ne može “Spremno” dok postoje greške u podacima.');
        return;
      }
      if (novi === f.status && broj === (f.brojZahtjeva || '') && !nap) { toast('Nema promjena.'); return; }
      f.brojZahtjeva = broj;
      f.status = novi;
      f.istorija = f.istorija || [];
      f.istorija.push({ vrijeme: sada(), status: novi, napomena: nap });
      f.izmijenjeno = sada();
      sacuvaj();
      render();
      otvoriDetalje(f.id);
      toast('Status sačuvan.');
    });

    $$('[data-check]', $('#det-body')).forEach(function (cb) {
      cb.addEventListener('change', function () {
        f.checklist = f.checklist || {};
        f.checklist[cb.dataset.check] = cb.checked;
        f.izmijenjeno = sada();
        sacuvaj();
        render();
      });
    });

    if (!dlgDet.open) dlgDet.showModal();
  }

  $('#det-body').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-kopiraj]');
    if (!b) return;
    var t = b.getAttribute('data-kopiraj');
    var ok = function () { toast('Kopirano: ' + t); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(ok, function () { fallbackKopiraj(t); ok(); });
    } else { fallbackKopiraj(t); ok(); }
  });
  function fallbackKopiraj(t) {
    var ta = document.createElement('textarea');
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignorisano */ }
    ta.remove();
  }

  $('#det-uredi').addEventListener('click', function () { dlgDet.close(); otvoriFormu(detId); });
  $('#det-obrisi').addEventListener('click', function () {
    var f = nadji(detId);
    if (!f || !confirm('Obrisati firmu “' + f.naziv + '”? Ovo se ne može poništiti.')) return;
    firme = firme.filter(function (x) { return x.id !== detId; });
    sacuvaj();
    dlgDet.close();
    render();
    toast('Firma obrisana.');
  });
  $('#det-asistent').addEventListener('click', function () {
    var f = nadji(detId);
    var p = V.provjeriFirmu(f);
    if (p.errors.length && !confirm('Podaci imaju ' + p.errors.length + ' grešaka. Ipak izvesti?')) return;
    izvozZaAsistenta([f], 'irms-' + slug(f.naziv) + '.json');
  });

  // ---------- izvoz / uvoz ----------
  function slug(s) {
    return String(s || 'firma').toLowerCase()
      .replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'dj')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'firma';
  }

  function izvozZaAsistenta(lista, ime) {
    var podaci = {
      format: 'irms-asistent',
      verzija: VERZIJA_IZVOZA,
      izvezeno: sada(),
      firme: lista.map(function (f) {
        var c = JSON.parse(JSON.stringify(f));
        delete c.istorija; delete c.checklist;
        return c;
      })
    };
    preuzmi(ime, JSON.stringify(podaci, null, 2), 'application/json');
    toast('Izvezeno ' + lista.length + ' firm' + (lista.length === 1 ? 'a' : 'i') + ' za asistenta.');
  }

  $('#btn-izvoz-asistent').addEventListener('click', function () {
    var spremne = firme.filter(function (f) { return f.status === 'spremno'; });
    if (!spremne.length) { toast('Nema firmi sa statusom “Spremno za podnošenje”.'); return; }
    izvozZaAsistenta(spremne, 'irms-spremne-' + danas() + '.json');
  });

  $('#btn-izvoz-json').addEventListener('click', function () {
    preuzmi('irms-rezervna-kopija-' + danas() + '.json',
      JSON.stringify({ format: 'irms-registracija-backup', verzija: VERZIJA_IZVOZA, izvezeno: sada(), firme: firme }, null, 2),
      'application/json');
  });

  $('#btn-uvoz-json').addEventListener('click', function () { $('#uvoz-fajl').click(); });
  $('#uvoz-fajl').addEventListener('change', function (ev) {
    var file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        var lista = Array.isArray(d) ? d : d.firme;
        if (!Array.isArray(lista)) throw new Error('Fajl ne sadrži listu firmi');
        var dodato = 0, azurirano = 0;
        lista.forEach(function (f) {
          if (!f || typeof f !== 'object' || !f.naziv) return;
          f.id = f.id || noviId();
          f.status = statusInfo(f.status).id;
          f.istorija = Array.isArray(f.istorija) ? f.istorija : [{ vrijeme: sada(), status: f.status, napomena: 'Uvezeno' }];
          f.checklist = f.checklist || {};
          f.izmijenjeno = f.izmijenjeno || sada();
          var i = firme.findIndex(function (x) { return x.id === f.id; });
          if (i >= 0) { firme[i] = f; azurirano++; } else { firme.push(f); dodato++; }
        });
        sacuvaj();
        render();
        toast('Uvoz: ' + dodato + ' novih, ' + azurirano + ' ažuriranih.');
      } catch (e) {
        toast('Greška pri uvozu: ' + e.message);
      }
    };
    r.readAsText(file);
  });

  $('#btn-izvoz-csv').addEventListener('click', function () {
    var kol = [
      ['Naziv', 'naziv'], ['Pravni oblik', 'pravniOblik'], ['PIB', 'pib'], ['Reg. broj', 'registarskiBroj'],
      ['Opština', 'sjediste.opstina'], ['Mjesto', 'sjediste.mjesto'], ['Ulica', 'sjediste.ulica'], ['Broj', 'sjediste.broj'],
      ['Djelatnost', 'sifraDjelatnosti'], ['E-mail', 'email'], ['Telefon', 'telefon'], ['Zastupnik', 'zastupnik.ime'],
      ['PDV', 'pdvObveznik'], ['Status', 'status'], ['Broj zahtjeva', 'brojZahtjeva'], ['Izmijenjeno', 'izmijenjeno']
    ];
    var q = function (v) { v = v == null ? '' : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var redovi = [kol.map(function (k) { return k[0]; }).join(';')].concat(firme.map(function (f) {
      return kol.map(function (k) {
        var v = getPath(f, k[1]);
        if (k[1] === 'status') v = statusInfo(v).naziv;
        return q(v);
      }).join(';');
    }));
    // BOM da Excel ispravno prikaže č, ć, š, ž, đ
    preuzmi('irms-firme-' + danas() + '.csv', '﻿' + redovi.join('\r\n'), 'text/csv;charset=utf-8');
  });

  // ---------- inicijalizacija ----------
  $('#pravni-oblik').innerHTML = V.PRAVNI_OBLICI.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('');
  $('#filter-status').innerHTML += STATUSI.map(function (s) { return '<option value="' + s.id + '">' + esc(s.naziv) + '</option>'; }).join('');
  $('#opstine').innerHTML = OPSTINE.map(function (o) { return '<option value="' + esc(o) + '">'; }).join('');
  $('#banke').innerHTML = BANKE.map(function (o) { return '<option value="' + esc(o) + '">'; }).join('');

  $('#btn-nova').addEventListener('click', function () { otvoriFormu(null); });
  $$('[data-zatvori]').forEach(function (b) { b.addEventListener('click', function () { b.closest('dialog').close(); }); });
  $('#statistika').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-status]');
    if (!b) return;
    filterStatus = b.dataset.status;
    $('#filter-status').value = filterStatus;
    render();
  });
  $('#filter-status').addEventListener('change', function (ev) { filterStatus = ev.target.value; render(); });
  $('#pretraga').addEventListener('input', function (ev) { pretraga = ev.target.value; renderLista(); });
  $('#lista').addEventListener('click', function (ev) {
    var k = ev.target.closest('.kartica');
    if (k) otvoriDetalje(k.dataset.id);
  });
  $('#lista').addEventListener('keydown', function (ev) {
    var k = ev.target.closest('.kartica');
    if (k && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); otvoriDetalje(k.dataset.id); }
  });
  document.addEventListener('click', function (ev) {
    var m = $('.menu');
    if (m.open && !m.contains(ev.target)) m.open = false;
  });
  $$('.menu-list button').forEach(function (b) { b.addEventListener('click', function () { $('.menu').open = false; }); });

  ucitaj();
  render();
})();
