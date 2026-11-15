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
    'Dio stranog društva',
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

  /*
   * Glavna provjera. Vraća { errors: [{polje, poruka}], warnings: [...] }.
   */
  function provjeriFirmu(f) {
    var errors = [];
    var warnings = [];
    function gr(polje, poruka) { errors.push({ polje: polje, poruka: poruka }); }
    function up(polje, poruka) { warnings.push({ polje: polje, poruka: poruka }); }

    f = f || {};
    if (prazno(f.naziv)) gr('naziv', 'Naziv firme je obavezan');
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

    var a = f.sjediste || {};
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

    if (prazno(f.email)) gr('email', 'E-mail za komunikaciju sa Poreskom upravom je obavezan');
    else { var em = provjeriEmail(f.email); if (em) gr('email', em); }
    if (prazno(f.telefon)) up('telefon', 'Telefon nije unesen');

    var osnivaci = f.osnivaci || [];
    if (osnivaci.length === 0) {
      gr('osnivaci', jePreduzetnik(f) ? 'Unesite podatke o preduzetniku' : 'Unesite bar jednog osnivača');
    }
    var ukupnoUdio = 0;
    var imaUdio = false;
    osnivaci.forEach(function (o, i) {
      var k = 'osnivaci.' + i;
      var oznaka = 'Osnivač ' + (i + 1);
      if (prazno(o.ime)) gr(k + '.ime', oznaka + ': ime / naziv je obavezno');
      if (o.tip === 'fizicko') {
        if (prazno(o.jmbg)) {
          if (o.drzavljanstvo && o.drzavljanstvo !== 'Crna Gora') {
            if (prazno(o.pasos)) gr(k + '.pasos', oznaka + ': za stranca unesite broj pasoša');
          } else {
            gr(k + '.jmbg', oznaka + ': JMBG je obavezan');
          }
        } else {
          var j = provjeriJMBG(o.jmbg);
          if (j) gr(k + '.jmbg', oznaka + ': ' + j);
        }
      } else if (o.tip === 'pravno') {
        if (prazno(o.pib)) up(k + '.pib', oznaka + ': PIB / matični broj pravnog lica nije unesen');
        else if (!/^\d{8}$/.test(String(o.pib).trim()) && (!o.drzava || o.drzava === 'Crna Gora')) {
          gr(k + '.pib', oznaka + ': PIB domaćeg pravnog lica mora imati 8 cifara');
        }
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
    if (prazno(z.ime)) gr('zastupnik.ime', 'Ovlašćeno lice za zastupanje je obavezno');
    if (!prazno(z.jmbg)) {
      var zj = provjeriJMBG(z.jmbg);
      if (zj) gr('zastupnik.jmbg', 'Zastupnik: ' + zj);
    } else if (!prazno(z.ime)) {
      up('zastupnik.jmbg', 'JMBG zastupnika nije unesen');
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
    samoCifre: samoCifre
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Validacija = api;
})(this);
