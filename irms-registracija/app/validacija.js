/*
 * Validacija podataka firme prije registracije na IRMS-u.
 * Radi u pregledaču (window.Validacija) i u Node-u (module.exports).
 *
 * Greške (errors) blokiraju status "Spremno"; upozorenja (warnings) samo
 * skreću pažnju i ne blokiraju ništa.
 */
(function (root) {
  'use strict';

  var PRAVNI_OBLICI = [
    'Društvo sa ograničenom odgovornošću (DOO)',
    'Akcionarsko društvo (AD)',
    'Preduzetnik',
    'Ortačko društvo (OD)',
    'Komanditno društvo (KD)',
    'Dio stranog privrednog društva',
    'Predstavništvo stranog društva',
    'Nevladina organizacija',
    'Ostalo'
  ];

  function samoCifre(s) {
    return String(s == null ? '' : s).replace(/\D/g, '');
  }

  function prazno(v) {
    return v == null || String(v).trim() === '';
  }

  /* JMBG: 13 cifara, kontrolna cifra po modulu 11, ispravan datum rođenja. */
  function provjeriJMBG(jmbg) {
    var s = String(jmbg || '').trim();
    if (!/^\d{13}$/.test(s)) return 'JMBG mora imati tačno 13 cifara';
    var d = s.split('').map(Number);
    var suma = 7 * (d[0] + d[6]) + 6 * (d[1] + d[7]) + 5 * (d[2] + d[8]) +
               4 * (d[3] + d[9]) + 3 * (d[4] + d[10]) + 2 * (d[5] + d[11]);
    var k = 11 - (suma % 11);
    if (k > 9) k = 0;
    if (k !== d[12]) return 'JMBG ima pogrešnu kontrolnu cifru';
    var dan = d[0] * 10 + d[1];
    var mj = d[2] * 10 + d[3];
    var god3 = d[4] * 100 + d[5] * 10 + d[6];
    var god = god3 >= 800 ? 1000 + god3 : 2000 + god3;
    var dt = new Date(god, mj - 1, dan);
    if (dt.getFullYear() !== god || dt.getMonth() !== mj - 1 || dt.getDate() !== dan) {
      return 'JMBG sadrži neispravan datum rođenja';
    }
    return null;
  }

  /* PIB pravnog lica u Crnoj Gori: 8 cifara (kontrolna cifra se ne provjerava). */
  function provjeriPIB(pib) {
    var s = String(pib || '').trim();
    if (!/^\d{8}$/.test(s)) return 'PIB mora imati tačno 8 cifara';
    return null;
  }

  /*
   * Žiro račun: 18 cifara u formatu 3-13-2 (banka-partija-kontrolni broj).
   * Kontrolni broj po ISO 7064 MOD 97-10. Vraća upozorenje, ne grešku.
   */
  function normalizujRacun(r) {
    var s = String(r || '').trim();
    var m = s.match(/^(\d{3})-?(\d{1,13})-?(\d{2})$/);
    if (!m) return null;
    var partija = m[2];
    while (partija.length < 13) partija = '0' + partija;
    return m[1] + partija + m[3];
  }

  function provjeriRacun(r) {
    var n = normalizujRacun(r);
    if (!n) return 'Račun treba biti u formatu 510-0000000000123-45';
    var osnova = n.slice(0, 16);
    var ostatak = 0;
    for (var i = 0; i < osnova.length; i++) ostatak = (ostatak * 10 + Number(osnova[i])) % 97;
    var kontrolni = 98 - ((ostatak * 100) % 97);
    if (kontrolni !== Number(n.slice(16))) return 'Kontrolni broj računa ne odgovara (provjerite broj)';
    return null;
  }

  function formatirajRacun(r) {
    var n = normalizujRacun(r);
    return n ? n.slice(0, 3) + '-' + n.slice(3, 16) + '-' + n.slice(16) : String(r || '');
  }

  function provjeriEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim()) ? null : 'Neispravna e-mail adresa';
  }

  /* Šifra djelatnosti (KD): npr. 62.01 ili 6201. */
  function provjeriSifruDjelatnosti(s) {
    return /^\d{2}\.?\d{2}$/.test(String(s || '').trim()) ? null : 'Šifra djelatnosti treba biti u obliku 62.01';
  }

  function jePreduzetnik(f) {
    return f.pravniOblik === 'Preduzetnik';
  }
  function jeDOO(f) {
    return /\(DOO\)|ograničenom odgovornošću/i.test(f.pravniOblik || '');
  }

  /* Poređenje teksta bez razlike u velikim slovima i kvačicama. */
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'dj')
      .replace(/\s+/g, ' ').trim();
  }
  function sadrzi(tekst, dio) {
    return !!dio && norm(tekst).indexOf(norm(dio)) !== -1;
  }
  function imaRijec(tekst, rijec) {
    return new RegExp('(^|[^a-z0-9])' + rijec + '($|[^a-z0-9])').test(norm(tekst));
  }

  /* Oznaka pravnog oblika u poslovnom imenu (član 23 stav 3 i član 85 stav 3 Zakona). */
  var OZNAKE = [
    { test: /\(DOO\)/, puna: 'društvo sa ograničenom odgovornošću', skr: 'doo', ispis: '„DOO”' },
    { test: /\(AD\)/, puna: 'akcionarsko društvo', skr: 'ad', ispis: '„AD”' },
    { test: /\(OD\)/, puna: 'ortačko društvo', skr: 'od', ispis: '„OD”' },
    { test: /\(KD\)/, puna: 'komanditno društvo', skr: 'kd', ispis: '„KD”' },
    { test: /^Preduzetnik$/, puna: 'preduzetnik', skr: 'pr', ispis: '„PR”' }
  ];
  function oznakaZa(f) {
    return OZNAKE.filter(function (o) { return o.test.test(f.pravniOblik || ''); })[0];
  }
  function imaOznaku(tekst, o) {
    return sadrzi(tekst, o.puna) || imaRijec(tekst, o.skr) || imaRijec(tekst, o.skr.split('').join('\\.?') + '\\.?');
  }

  /*
   * Automatski ispravlja poslovno ime i skraćeno poslovno ime tako da
   * zadovolje član 23, 24 i 85 Zakona: dodaje oznaku pravnog oblika
   * (DOO, AD, OD, KD, PR), sjedište i, kod preduzetnika, ime i prezime.
   * Vraća { naziv, skraceniNaziv, promjene: [opis] }; ništa ne mijenja ako je ime već ispravno.
   */
  function ispraviPoslovnoIme(f) {
    f = f || {};
    var oz = oznakaZa(f);
    var a = f.sjediste || {};
    var rez = { naziv: f.naziv || '', skraceniNaziv: f.skraceniNaziv || '', promjene: [] };
    if (!oz || prazno(rez.naziv)) return rez;
    var oznaka = oz.skr.toUpperCase();
    var pr = jePreduzetnik(f) ? (((f.osnivaci || [])[0] || {}).ime || '').trim() : '';

    var n = String(rez.naziv).trim().replace(/\s+/g, ' ');
    if (pr && !sadrzi(n, pr)) n = pr + ' ' + n;
    if (!imaOznaku(n, oz)) n = pr ? n.replace(pr, pr + ' ' + oznaka) : n + ' ' + oznaka;
    var sjediste = a.opstina || a.mjesto;
    if (sjediste && !sadrzi(n, a.opstina) && !sadrzi(n, a.mjesto)) n = n + ' ' + sjediste;
    if (n !== rez.naziv) {
      rez.promjene.push('poslovno ime „' + rez.naziv + '” → „' + n + '”');
      rez.naziv = n;
    }

    var s = String(rez.skraceniNaziv).trim().replace(/\s+/g, ' ');
    if (s) {
      var ns = s;
      if (pr && !sadrzi(ns, pr)) ns = pr + ' ' + ns;
      if (!imaOznaku(ns, oz)) ns = pr ? ns.replace(pr, pr + ' ' + oznaka) : ns + ' ' + oznaka;
      if (ns !== rez.skraceniNaziv) {
        rez.promjene.push('skraćeno poslovno ime „' + rez.skraceniNaziv + '” → „' + ns + '”');
        rez.skraceniNaziv = ns;
      }
    }
    return rez;
  }

  /*
   * Glavna provjera. Vraća { errors: [{polje, poruka}], warnings: [...] }.
   */
  function provjeriFirmu(f) {
    var errors = [];
    var warnings = [];
    function gr(polje, poruka) { errors.push({ polje: polje, poruka: poruka }); }
    function up(polje, poruka) { warnings.push({ polje: polje, poruka: poruka }); }

    f = f || {};
    var a = f.sjediste || {};
    var oz = oznakaZa(f);
    if (prazno(f.naziv)) gr('naziv', 'Poslovno ime je obavezno');
    else if (oz) {
      // Poslovno ime sadrži naziv, oznaku pravnog oblika i sjedište (član 23, član 85).
      if (!imaOznaku(f.naziv, oz)) {
        gr('naziv', 'Poslovno ime mora sadržati oznaku pravnog oblika ' + oz.ispis + ' ili „' + oz.puna + '” (član ' + (jePreduzetnik(f) ? '85' : '23') + ' Zakona)');
      }
      if ((a.opstina || a.mjesto) && !sadrzi(f.naziv, a.opstina) && !sadrzi(f.naziv, a.mjesto)) {
        gr('naziv', 'Poslovno ime mora sadržati sjedište (npr. „' + (a.opstina || a.mjesto) + '”) (član ' + (jePreduzetnik(f) ? '85' : '23') + ' Zakona)');
      }
      if (jePreduzetnik(f)) {
        var pr = (f.osnivaci || [])[0];
        if (pr && pr.ime && !sadrzi(f.naziv, pr.ime)) {
          gr('naziv', 'Poslovno ime preduzetnika mora sadržati njegovo ime i prezime (član 85 Zakona)');
        }
      }
      if (!prazno(f.skraceniNaziv) && !imaOznaku(f.skraceniNaziv, oz)) {
        gr('skraceniNaziv', 'Skraćeno poslovno ime mora sadržati oznaku pravnog oblika ' + oz.ispis + ' (član ' + (jePreduzetnik(f) ? '85' : '24') + ' Zakona)');
      }
    }
    if (prazno(f.pravniOblik)) gr('pravniOblik', 'Pravni oblik je obavezan');

    if (!prazno(f.pib)) {
      var p = provjeriPIB(f.pib);
      if (p) gr('pib', p);
    } else {
      up('pib', 'PIB nije unesen – IRMS ga dodjeljuje ili ga upišite nakon registracije u CRPS');
    }

    if (!prazno(f.registarskiBroj) && !/^[\d\/\-\s]+$/.test(f.registarskiBroj)) {
      gr('registarskiBroj', 'Registarski broj (CRPS) smije sadržati samo cifre, "/" i "-"');
    }

    if (prazno(f.datumOsnivanja)) {
      up('datumOsnivanja', 'Datum osnivanja / upisa u CRPS nije unesen');
    } else if (new Date(f.datumOsnivanja) > new Date()) {
      gr('datumOsnivanja', 'Datum osnivanja ne može biti u budućnosti');
    }

    if (prazno(a.opstina)) gr('sjediste.opstina', 'Opština sjedišta je obavezna');
    if (prazno(a.mjesto)) gr('sjediste.mjesto', 'Mjesto sjedišta je obavezno');
    if (prazno(a.ulica)) gr('sjediste.ulica', 'Ulica sjedišta je obavezna');
    if (prazno(a.broj)) up('sjediste.broj', 'Kućni broj nije unesen (upišite "bb" ako ga nema)');

    if (prazno(f.sifraDjelatnosti)) {
      gr('sifraDjelatnosti', 'Pretežna djelatnost (šifra) je obavezna');
    } else {
      var sd = provjeriSifruDjelatnosti(f.sifraDjelatnosti);
      if (sd) gr('sifraDjelatnosti', sd);
    }

    if (prazno(f.email)) gr('email', 'Adresa za prijem elektronske pošte je obavezna (član 19 Zakona)');
    else { var em = provjeriEmail(f.email); if (em) gr('email', em); }
    if (prazno(f.telefon)) up('telefon', 'Telefon nije unesen');

    var osnivaci = f.osnivaci || [];
    var doo = jeDOO(f);
    if (osnivaci.length === 0) {
      gr('osnivaci', jePreduzetnik(f) ? 'Unesite podatke o preduzetniku' : 'Unesite bar jednog osnivača');
    }
    if (doo && osnivaci.length > 30) gr('osnivaci', 'DOO može imati najviše 30 članova (član 358 Zakona)');
    if (doo) {
      var kap = Number(String(f.kapital || '').replace(/\s/g, '').replace(',', '.'));
      if (prazno(f.kapital)) gr('kapital', 'Osnovni kapital je obavezan (član 362 Zakona)');
      else if (isNaN(kap) || kap < 1) gr('kapital', 'Osnovni kapital DOO iznosi najmanje 1 € (član 361 Zakona)');
    }
    var ukupnoUdio = 0;
    var imaUdio = false;
    osnivaci.forEach(function (o, i) {
      var k = 'osnivaci.' + i;
      var oznaka = 'Osnivač ' + (i + 1);
      if (prazno(o.ime)) gr(k + '.ime', oznaka + ': ime / naziv je obavezno');
      // Podaci o osnivaču DOO po članu 362 tačka 1 Zakona.
      var obavezno = doo ? gr : up;
      if (o.tip === 'fizicko') {
        if (prazno(o.jmbg)) {
          if (o.drzavljanstvo && o.drzavljanstvo !== 'Crna Gora') {
            if (prazno(o.pasos)) gr(k + '.pasos', oznaka + ': za stranca unesite broj pasoša');
            if (prazno(o.pasosIzdat)) obavezno(k + '.pasosIzdat', oznaka + ': unesite datum izdavanja pasoša');
            if (prazno(o.pasosVazi)) obavezno(k + '.pasosVazi', oznaka + ': unesite datum važenja pasoša');
            else if (new Date(o.pasosVazi) < new Date()) gr(k + '.pasosVazi', oznaka + ': pasoš je istekao');
            if (prazno(o.datumRodjenja)) obavezno(k + '.datumRodjenja', oznaka + ': unesite datum rođenja');
            if (prazno(o.adresa)) obavezno(k + '.adresa', oznaka + ': unesite adresu boravka');
          } else {
            gr(k + '.jmbg', oznaka + ': JMBG je obavezan');
          }
        } else {
          var j = provjeriJMBG(o.jmbg);
          if (j) gr(k + '.jmbg', oznaka + ': ' + j);
          if (prazno(o.adresa)) obavezno(k + '.adresa', oznaka + ': unesite adresu prebivališta');
        }
      } else if (o.tip === 'pravno') {
        var strano = o.drzava && o.drzava !== 'Crna Gora';
        if (prazno(o.pib)) obavezno(k + '.pib', oznaka + ': unesite ' + (strano ? 'registarski broj u matičnom registru' : 'matični broj pravnog lica'));
        else if (!strano && !/^\d{8}$/.test(String(o.pib).trim())) {
          gr(k + '.pib', oznaka + ': matični broj domaćeg pravnog lica ima 8 cifara');
        }
        if (prazno(o.adresa)) obavezno(k + '.adresa', oznaka + ': unesite adresu sjedišta');
      }
      if (doo && prazno(o.udio) && osnivaci.length > 1) {
        gr(k + '.udio', oznaka + ': udio u osnovnom kapitalu u procentima je obavezan (član 362 Zakona)');
      }
      if (!prazno(o.udio)) {
        var u = Number(String(o.udio).replace(',', '.'));
        if (isNaN(u) || u <= 0 || u > 100) gr(k + '.udio', oznaka + ': udio mora biti između 0 i 100%');
        else { ukupnoUdio += u; imaUdio = true; }
      }
    });
    if (imaUdio && Math.abs(ukupnoUdio - 100) > 0.01) {
      gr('osnivaci', 'Zbir udjela osnivača je ' + Math.round(ukupnoUdio * 100) / 100 + '% (mora biti 100%)');
    }

    var z = f.zastupnik || {};
    if (prazno(z.ime)) gr('zastupnik.ime', jePreduzetnik(f) ? 'Ime preduzetnika (lica koje zastupa) je obavezno' : 'Direktor (lice ovlašćeno za zastupanje) je obavezan');
    if (!prazno(z.jmbg)) {
      var zj = provjeriJMBG(z.jmbg);
      if (zj) gr('zastupnik.jmbg', 'Zastupnik: ' + zj);
    } else if (!prazno(z.ime)) {
      up('zastupnik.jmbg', 'JMBG direktora nije unesen');
    }
    if (doo && !prazno(z.ime) && prazno(z.adresa)) up('zastupnik.adresa', 'Adresa direktora nije unesena (vodi se u evidenciji društva, član 432 Zakona)');

    var dk = f.dokumenta || {};
    if (!prazno(dk.mandat)) {
      var md = Number(dk.mandat);
      if (isNaN(md) || md < 1 || Math.round(md) !== md) gr('dokumenta.mandat', 'Mandat direktora je cijeli broj godina, ili ostavite prazno za neograničen mandat');
    }
    if (dk.nadoknada === 'da' && prazno(dk.troskovi)) {
      gr('dokumenta.troskovi', 'Ako se troškovi osnivanja nadoknađuju, osnivački akt mora navesti njihov procijenjeni iznos (čl. 362 i 365 Zakona)');
    }

    var pm = f.punomocnik || {};
    if (!prazno(pm.jmbg)) {
      var pj = provjeriJMBG(pm.jmbg);
      if (pj) gr('punomocnik.jmbg', 'Punomoćnik: ' + pj);
    }

    (f.racuni || []).forEach(function (r, i) {
      if (prazno(r.broj)) return;
      var rr = provjeriRacun(r.broj);
      if (rr) up('racuni.' + i, 'Račun ' + (i + 1) + ': ' + rr);
    });

    if (f.pdvObveznik === 'da' && prazno(f.pdvDatum)) {
      up('pdvDatum', 'Odaberite od kog datuma se firma registruje za PDV');
    }

    return { errors: errors, warnings: warnings };
  }

  var api = {
    PRAVNI_OBLICI: PRAVNI_OBLICI,
    provjeriJMBG: provjeriJMBG,
    provjeriPIB: provjeriPIB,
    provjeriRacun: provjeriRacun,
    formatirajRacun: formatirajRacun,
    provjeriEmail: provjeriEmail,
    provjeriSifruDjelatnosti: provjeriSifruDjelatnosti,
    provjeriFirmu: provjeriFirmu,
    ispraviPoslovnoIme: ispraviPoslovnoIme,
    samoCifre: samoCifre
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Validacija = api;
})(this);
