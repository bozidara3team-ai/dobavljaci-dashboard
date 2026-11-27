/*
 * Generator osnivačkih dokumenata (opšti modeli) za DOO u Crnoj Gori.
 * Radi u pregledaču (window.Dokumenti) i u Node-u (module.exports).
 *
 * Usklađeno sa Zakonom o privrednim društvima ("Službeni list Crne Gore",
 * br. 90/25, 121/25 i 44/26). Brojevi članova u komentarima i tekstu
 * odnose se na taj zakon. Prije potpisivanja modele treba da pregleda
 * pravnik ili ovlašćeni računovođa.
 *
 * Dokument je niz blokova:
 *   {t:'naslov', x} {t:'podnaslov', x} {t:'clan', x} {t:'p', x}
 *   {t:'stavka', x} {t:'razmak'} {t:'mjestoDatum', x}
 *   {t:'potpisi', lista:[{uloga, ime}]}
 * koji se pretvara u HTML (pregled/štampa) ili .docx (Word).
 */
(function (root) {
  'use strict';

  var ZAKON_NAZIV = 'Zakon o privrednim društvima („Službeni list Crne Gore”, br. 90/25, 121/25 i 44/26)';
  var ZAKON = 'Zakona o privrednim društvima („Službeni list Crne Gore”, br. 90/25, 121/25 i 44/26)';
  var PRAZNO = '______________';

  // ---------- pomoćne ----------
  function get(o, p) {
    return String(p).split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o);
  }
  function ima(v) { return v != null && String(v).trim() !== ''; }

  function datumKratko(iso) {
    if (!ima(iso)) return PRAZNO;
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + '.' + m[2] + '.' + m[1] + '.' : String(iso);
  }
  function datum(iso) {
    return ima(iso) ? datumKratko(iso) + ' godine' : PRAZNO;
  }

  function broj(v) {
    if (!ima(v)) return null;
    var n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  function euro(n) {
    if (n == null) return PRAZNO + ' €';
    var s = (Math.round(n * 100) / 100).toFixed(2).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return s[0] + ',' + s[1] + ' €';
  }

  function procenat(n) {
    return (Math.round(n * 100) / 100).toString().replace('.', ',') + '%';
  }

  function adresaSjedista(f) {
    var s = f.sjediste || {};
    var ulica = [s.ulica, s.broj].filter(ima).join(' ');
    var t = [ulica, [s.postanskiBroj, s.mjesto].filter(ima).join(' ')].filter(ima).join(', ');
    return t || PRAZNO;
  }

  /* Sjedište je jedinica lokalne samouprave (član 18), adresa je zaseban podatak. */
  function sjedisteTekst(f) {
    var op = get(f, 'sjediste.opstina');
    return 'Sjedište Društva je: Opština ' + (op || PRAZNO) + '. Adresa sjedišta Društva je: ' + adresaSjedista(f) + '.';
  }

  function mjestoSjedista(f) {
    return get(f, 'sjediste.mjesto') || get(f, 'sjediste.opstina') || PRAZNO;
  }

  function jeStranac(o) {
    return o.tip !== 'pravno' && !ima(o.jmbg) &&
      (ima(o.pasos) || (ima(o.drzavljanstvo) && o.drzavljanstvo !== 'Crna Gora'));
  }
  function jeStranoPravno(o) {
    return o.tip === 'pravno' && ima(o.drzava) && o.drzava !== 'Crna Gora';
  }

  /* Podaci o osnivaču tačno po članu 362 tačka 1. */
  function opisLica(o) {
    if (!o) return PRAZNO;
    if (o.tip === 'pravno') {
      if (jeStranoPravno(o)) {
        return (o.ime || PRAZNO) + ', adresa sjedišta: ' + (o.adresa || PRAZNO) +
          ', država registracije: ' + o.drzava + ', registarski broj u matičnom registru: ' + (o.pib || PRAZNO);
      }
      return (o.ime || PRAZNO) + ', matični broj ' + (o.pib || PRAZNO) + ', adresa sjedišta: ' + (o.adresa || PRAZNO);
    }
    if (jeStranac(o)) {
      return (o.ime || PRAZNO) + ', broj pasoša ' + (o.pasos || PRAZNO) +
        ', datum izdavanja pasoša ' + datumKratko(o.pasosIzdat) +
        ', pasoš važi do ' + datumKratko(o.pasosVazi) +
        ', država izdavanja pasoša: ' + (o.drzavaPasosa || o.drzavljanstvo || PRAZNO) +
        ', datum rođenja ' + datumKratko(o.datumRodjenja) +
        ', adresa boravka: ' + (o.adresa || PRAZNO);
    }
    return (o.ime || PRAZNO) + ', JMBG ' + (o.jmbg || PRAZNO) + ', adresa prebivališta: ' + (o.adresa || PRAZNO);
  }

  function opisDirektora(z) {
    z = z || {};
    return (z.ime || PRAZNO) + ', JMBG ' + (z.jmbg || PRAZNO) + ', adresa prebivališta: ' + (z.adresa || PRAZNO);
  }

  function djelatnost(f) {
    var s = f.sifraDjelatnosti || PRAZNO;
    return ima(f.opisDjelatnosti) ? s + ' – ' + f.opisDjelatnosti : s;
  }

  /* Osnivači sa izračunatim udjelom i iznosom uloga. */
  function clanovi(f) {
    var lista = (f.osnivaci || []).filter(function (o) { return ima(o.ime); });
    var kapital = broj(f.kapital);
    return lista.map(function (o) {
      var u = broj(o.udio);
      if (u == null && lista.length === 1) u = 100;
      return {
        o: o,
        udio: u,
        iznos: kapital != null && u != null ? kapital * u / 100 : null
      };
    });
  }

  function brojac() {
    var n = 0;
    return function () { n++; return 'Član ' + n; };
  }

  /* Mandat nije obavezan: ako ga statut ne odredi, nije ograničen (član 423 stav 2). */
  function mandat(f) {
    var m = broj(get(f, 'dokumenta.mandat'));
    return m && m > 0 ? Math.round(m) : null;
  }

  function godina(n) {
    var z = n % 10, zz = n % 100;
    if (z === 1 && zz !== 11) return n + ' godinu';
    if (z >= 2 && z <= 4 && (zz < 12 || zz > 14)) return n + ' godine';
    return n + ' godina';
  }

  function elektronski(f) {
    return get(f, 'dokumenta.oblik') === 'elektronski';
  }

  function mjestoDatum(f) {
    var mj = get(f, 'dokumenta.mjesto') || mjestoSjedista(f);
    return { t: 'mjestoDatum', x: mj + ', ' + datum(get(f, 'dokumenta.datum')) };
  }

  function potpisiOsnivaca(cl) {
    return {
      t: 'potpisi',
      lista: (cl.length ? cl : [{ o: {} }]).map(function (c) {
        var o = c.o;
        return {
          uloga: cl.length > 1 ? 'Osnivač' : 'OSNIVAČ',
          ime: o.tip === 'pravno' ? (o.ime || PRAZNO) + ', zastupnik ' + (o.zastupnik || PRAZNO) : (o.ime || PRAZNO)
        };
      })
    };
  }

  /* Podaci koji nedostaju za pojedini dokument. */
  function nedostaje(f, polja) {
    var opisi = {
      naziv: 'poslovno ime',
      'sjediste.opstina': 'opština sjedišta',
      'sjediste.ulica': 'ulica sjedišta',
      sifraDjelatnosti: 'šifra djelatnosti',
      kapital: 'osnovni kapital',
      'zastupnik.ime': 'ime izvršnog direktora',
      'zastupnik.jmbg': 'JMBG izvršnog direktora',
      'zastupnik.adresa': 'adresa izvršnog direktora',
      'zastupnik.drzavljanstvo': 'državljanstvo izvršnog direktora',
      'zastupnik.licnaKarta': 'broj lične karte / pasoša izvršnog direktora',
      'dokumenta.datum': 'datum donošenja akata',
      'punomocnik.ime': 'ime punomoćnika',
      'punomocnik.jmbg': 'JMBG punomoćnika'
    };
    var n = polja.filter(function (p) { return opisi[p] && !ima(get(f, p)); }).map(function (p) { return opisi[p]; });
    if (polja.indexOf('troskovi') !== -1 && get(f, 'dokumenta.nadoknada') === 'da' && !ima(get(f, 'dokumenta.troskovi'))) {
      n.push('procijenjeni troškovi osnivanja');
    }
    if (polja.indexOf('osnivaci') !== -1) {
      var cl = clanovi(f);
      if (!cl.length) n.push('osnivači');
      cl.forEach(function (c, i) {
        var o = c.o, k = ' osnivača ' + (i + 1);
        if (!ima(o.adresa)) n.push((o.tip === 'pravno' ? 'adresa sjedišta' : jeStranac(o) ? 'adresa boravka' : 'adresa prebivališta') + k);
        if (o.tip === 'pravno') {
          if (!ima(o.pib)) n.push((jeStranoPravno(o) ? 'registarski broj' : 'matični broj') + k);
        } else if (jeStranac(o)) {
          if (!ima(o.pasos)) n.push('broj pasoša' + k);
          if (!ima(o.pasosIzdat)) n.push('datum izdavanja pasoša' + k);
          if (!ima(o.pasosVazi)) n.push('važenje pasoša' + k);
          if (!ima(o.datumRodjenja)) n.push('datum rođenja' + k);
        } else if (!ima(o.jmbg)) {
          n.push('JMBG' + k);
        }
        if (c.udio == null) n.push('udio' + k);
      });
    }
    return n;
  }

  // ---------- osnivački akt (član 8, 9, 362) ----------
  function troskoviTekst(f, jedan) {
    var t = broj(get(f, 'dokumenta.troskovi'));
    var snosi = jedan ? 'Osnivač' : 'osnivači srazmjerno svojim udjelima u osnovnom kapitalu';
    if (get(f, 'dokumenta.nadoknada') === 'da') {
      return [
        'Procijenjeni troškovi osnivanja Društva iznose ' + euro(t) + '.',
        'Društvo će ' + (jedan ? 'Osnivaču' : 'osnivačima') + ' nadoknaditi stvarno nastale i dokumentovane troškove osnivanja, najviše do iznosa iz stava 1 ovog člana. Naknada troškova osnivanja ne može se platiti iz osnovnog kapitala Društva.'
      ];
    }
    return [
      (t != null ? 'Procijenjeni troškovi osnivanja Društva iznose ' + euro(t) + '. ' : '') +
      'Troškove osnivanja Društva snosi ' + snosi + ' i Društvo ih ne nadoknađuje.'
    ];
  }

  function clanoviAkta(f, cl, c, jedan) {
    var b = [];
    var skr = ima(f.skraceniNaziv) ? ' Skraćeno poslovno ime Društva je: ' + f.skraceniNaziv + '.' : '';
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Poslovno ime Društva je: ' + (f.naziv || PRAZNO) + '.' + skr },
      { t: 'p', x: sjedisteTekst(f) });

    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Pretežna djelatnost Društva, u skladu sa propisom kojim se uređuje klasifikacija djelatnosti, je: ' + djelatnost(f) + '.' },
      { t: 'p', x: 'Pored pretežne djelatnosti, Društvo može obavljati i druge djelatnosti u skladu sa zakonom, a djelatnosti za koje je posebnim zakonom propisano pribavljanje saglasnosti, odobrenja, dozvole ili drugog akta nadležnog organa – nakon njihovog pribavljanja.' });

    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Osnovni kapital Društva iznosi ' + euro(broj(f.kapital)) + ' i sastoji se isključivo od novčanih uloga. ' +
        (jedan ? 'Osnivač ne unosi nenovčani ulog.' : 'Osnivači ne unose nenovčane uloge.') });
    cl.forEach(function (x, i) {
      b.push({ t: 'stavka', x: (jedan ? '' : (i + 1) + ') ') + (x.o.ime || PRAZNO) + ' – ukupan iznos novčanog uloga ' + euro(x.iznos) +
        ', udio u osnovnom kapitalu Društva ' + (x.udio != null ? procenat(x.udio) : PRAZNO) + ';' });
    });
    b.push({ t: 'p', x: (jedan ? 'Osnivač je dužan' : 'Osnivači su dužni') +
      ' da novčani ulog uplati u cjelosti na račun Društva prije registracije Društva u Centralnom registru privrednih subjekata (u daljem tekstu: CRPS).' });

    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Društvo za svoje obaveze odgovara cjelokupnom svojom imovinom.' },
      { t: 'p', x: (jedan ? 'Osnivač, kao član Društva, ne odgovara' : 'Članovi Društva ne odgovaraju') +
        ' za obaveze Društva, osim u slučajevima propisanim zakonom.' });

    b.push({ t: 'clan', x: c() });
    troskoviTekst(f, jedan).forEach(function (x) { b.push({ t: 'p', x: x }); });

    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Organi Društva su skupština i izvršni direktor.' + (jedan ? ' Osnivač, kao jedini član Društva, ima ovlašćenja skupštine.' : ' Skupštinu čine svi članovi Društva.') },
      { t: 'p', x: 'Nadležnosti organa Društva, način sazivanja i rada skupštine, imenovanje i razrješenje izvršnog direktora, zastupanje Društva i druga pitanja uređuju se Statutom Društva.' });
    return b;
  }

  function zavrsneAkta(f, c, jedan, ugovor) {
    var b = [];
    var e = elektronski(f);
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: (ugovor ? 'Ovaj ugovor sačinjen je' : 'Ova odluka sačinjena je') + ' u ' + (e ? 'elektronskom' : 'pisanom') + ' obliku i ' +
        (e
          ? (jedan ? 'Osnivač je potpisuje' : 'osnivači ga potpisuju') + ' kvalifikovanim elektronskim potpisom, odnosno kvalifikovanim elektronskim pečatom.'
          : (jedan ? 'potpis Osnivača ovjerava se' : 'potpisi svih osnivača ovjeravaju se') + ' u skladu sa zakonom kojim se uređuje ovjera potpisa, rukopisa i prepisa.') },
      { t: 'p', x: 'Osnivački akt Društva ne može se mijenjati nakon registracije osnivanja Društva u CRPS.' });
    if (ugovor) {
      b.push({ t: 'p', x: 'Eventualne sporove iz ovog ugovora osnivači će rješavati sporazumno, a ako to nije moguće, nadležan je sud prema sjedištu Društva.' });
    }
    b.push({ t: 'p', x: (ugovor ? 'Ovaj ugovor stupa na snagu danom potpisivanja od strane svih osnivača.' : 'Ova odluka stupa na snagu danom donošenja.') +
      ' Društvo stiče svojstvo pravnog lica danom registracije u CRPS.' });
    if (ugovor && !e) {
      b.push({ t: 'p', x: 'Ugovor je sačinjen u ' + (clanovi(f).length + 2) + ' istovjetnih primjeraka, od kojih svaki osnivač zadržava po jedan, a ostali služe za potrebe registracije i Društva.' });
    }
    return b;
  }

  function ugovorOsnivanje(f) {
    var cl = clanovi(f);
    var c = brojac();
    var mj = get(f, 'dokumenta.mjesto') || mjestoSjedista(f);
    var b = [
      { t: 'naslov', x: 'UGOVOR' },
      { t: 'podnaslov', x: 'o osnivanju društva sa ograničenom odgovornošću' },
      { t: 'podnaslov', x: '„' + (f.naziv || PRAZNO) + '”' },
      { t: 'razmak' },
      { t: 'p', x: 'Zaključen dana ' + datum(get(f, 'dokumenta.datum')) + ' u mjestu ' + mj + ', na osnovu člana 8 i člana 362 ' + ZAKON + ', između:' }
    ];
    cl.forEach(function (x, i) { b.push({ t: 'stavka', x: (i + 1) + ') ' + opisLica(x.o) + ';' }); });
    b.push({ t: 'p', x: '(u daljem tekstu zajedno: osnivači, odnosno članovi Društva).' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Osnivači ovim ugovorom osnivaju društvo sa ograničenom odgovornošću (u daljem tekstu: Društvo).' });
    b = b.concat(clanoviAkta(f, cl, c, false), zavrsneAkta(f, c, false, true));
    b.push({ t: 'razmak' }, mjestoDatum(f), potpisiOsnivaca(cl));
    return b;
  }

  // ---------- šabloni po tekstovima koje je dostavio klijent ----------
  // Tekst je preuzet iz dostavljenih dokumenata; promjenljivi podaci
  // (ime, JMBG, adrese, poslovno ime, djelatnost, kapital, datum) dolaze iz forme.

  var LOKATIV = {
    'Andrijevica': 'Andrijevici', 'Bar': 'Baru', 'Berane': 'Beranama', 'Bijelo Polje': 'Bijelom Polju',
    'Budva': 'Budvi', 'Cetinje': 'Cetinju', 'Danilovgrad': 'Danilovgradu', 'Gusinje': 'Gusinju',
    'Herceg Novi': 'Herceg Novom', 'Kolašin': 'Kolašinu', 'Kotor': 'Kotoru', 'Mojkovac': 'Mojkovcu',
    'Nikšić': 'Nikšiću', 'Petnjica': 'Petnjici', 'Plav': 'Plavu', 'Pljevlja': 'Pljevljima',
    'Plužine': 'Plužinama', 'Podgorica': 'Podgorici', 'Rožaje': 'Rožajama', 'Šavnik': 'Šavniku',
    'Tivat': 'Tivtu', 'Tuzi': 'Tuzima', 'Ulcinj': 'Ulcinju', 'Zeta': 'Zeti', 'Žabljak': 'Žabljaku',
    'Golubovci': 'Golubovcima', 'Sutomore': 'Sutomoru', 'Petrovac': 'Petrovcu', 'Bečići': 'Bečićima',
    'Igalo': 'Igalu', 'Risan': 'Risnu', 'Perast': 'Perastu'
  };

  /* "u Baru", "u Herceg Novom"; za mjesto koje nije u listi "u mjestu X" (bez pogrešne promjene po padežu). */
  function uMjestu(mj) {
    if (!ima(mj)) return 'u ' + PRAZNO;
    var k = String(mj).trim();
    return LOKATIV[k] ? 'u ' + LOKATIV[k] : 'u mjestu ' + k;
  }

  function mjestoSjedistaKlijent(f) {
    return get(f, 'sjediste.mjesto') || get(f, 'sjediste.opstina');
  }

  function ulicaBroj(f) {
    var s = f.sjediste || {};
    var t = [s.ulica, s.broj].filter(ima).join(' ');
    return t || PRAZNO;
  }

  function uMjestuDana(f, tacka) {
    var mj = get(f, 'dokumenta.mjesto') || mjestoSjedistaKlijent(f);
    var t = uMjestu(mj);
    return { t: 'mjestoDatum', x: t.charAt(0).toUpperCase() + t.slice(1) + ', dana ' + datum(get(f, 'dokumenta.datum')) + (tacka ? '.' : '') };
  }

  /* Iznos bez oznake valute, npr. "1,00" (za tabele i "… EUR"). */
  function iznos(n) {
    return euro(n).replace(' €', '');
  }

  function velikaSlova(s) { return String(s || PRAZNO).toUpperCase(); }

  function naslovFirme(f) {
    return velikaSlova(f.skraceniNaziv || f.naziv);
  }

  /* Identifikacioni podatak osnivača / direktora (JMBG ili podaci o pasošu). */
  function identifikacija(o) {
    if (!o) return PRAZNO;
    if (o.tip === 'pravno') return (jeStranoPravno(o) ? 'registarski broj ' : 'matični broj ') + (o.pib || PRAZNO);
    if (jeStranac(o)) {
      return 'broj pasoša ' + (o.pasos || PRAZNO) + ', izdat ' + datumKratko(o.pasosIzdat) + ', važi do ' + datumKratko(o.pasosVazi) +
        ', država izdavanja ' + (o.drzavaPasosa || o.drzavljanstvo || PRAZNO) + ', datum rođenja ' + datumKratko(o.datumRodjenja);
    }
    return 'JMBG ' + (o.jmbg || PRAZNO);
  }

  function zakonKlijent() {
    return 'Zakona o privrednim društvima Crne Gore („Službeni list Crne Gore”, br. 90/25, 121/25 i 44/26)';
  }

  function clanNaslov(c, naslov) {
    return { t: 'clan', x: c(), naslov: naslov };
  }

  // ----- Osnivački akt: Odluka o osnivanju (jednočlano DOO) -----
  function odlukaOsnivanje(f) {
    var cl = clanovi(f);
    var x = cl[0] || { o: {}, udio: 100, iznos: broj(f.kapital) };
    var o = x.o;
    var c = brojac();
    var pravno = o.tip === 'pravno';
    var b = [
      { t: 'naslov', x: 'OSNIVAČKI AKT' },
      { t: 'podnaslov', x: 'ODLUKA O OSNIVANJU DRUŠTVA SA OGRANIČENOM ODGOVORNOŠĆU' },
      { t: 'podnaslov', x: naslovFirme(f) },
      { t: 'p', x: 'Na osnovu ' + zakonKlijent() + ', osnivač ' + (o.ime || PRAZNO) + ', ' + identifikacija(o) + ', ' +
        (pravno ? 'sa sjedištem na adresi ' : 'sa prebivalištem/boravištem na adresi ') + (o.adresa || PRAZNO) + ' donosi sljedeću:' },
      { t: 'naslov', x: 'ODLUKU O OSNIVANJU' },
      { t: 'podnaslov', x: 'DRUŠTVA SA OGRANIČENOM ODGOVORNOŠĆU' },

      clanNaslov(c, 'Osnivanje društva'),
      { t: 'p', x: 'Osniva se društvo sa ograničenom odgovornošću pod poslovnim imenom: ' + (f.naziv || PRAZNO) + '.' }
    ];
    if (ima(f.skraceniNaziv)) b.push({ t: 'p', x: 'Skraćeno poslovno ime društva glasi: ' + f.skraceniNaziv + '.' });
    b.push({ t: 'p', x: 'Društvo se osniva kao jednočlano društvo sa ograničenom odgovornošću.' });

    var redovi = pravno
      ? [['Naziv', o.ime || PRAZNO]]
        .concat(jeStranoPravno(o)
          ? [['Država registracije', o.drzava], ['Registarski broj', o.pib || PRAZNO]]
          : [['Matični broj', o.pib || PRAZNO]])
        .concat([['Adresa sjedišta', o.adresa || PRAZNO]])
      : [['Ime i prezime', o.ime || PRAZNO], ['Identifikacioni podatak', identifikacija(o).replace(/^JMBG /, '')],
        ['Adresa', o.adresa || PRAZNO]];
    redovi.push(['Iznos novčanog uloga', iznos(x.iznos) + ' EUR'], ['Udio u društvu', (x.udio != null ? procenat(x.udio) : PRAZNO)]);
    b.push(clanNaslov(c, 'Osnivač društva'),
      { t: 'p', x: 'Osnivač i jedini član društva je:' },
      { t: 'tabela', redovi: redovi });

    b.push(clanNaslov(c, 'Sjedište društva'),
      { t: 'p', x: 'Sjedište društva je ' + uMjestu(mjestoSjedistaKlijent(f)) + ', na adresi ' + ulicaBroj(f) + '.' });

    b.push(clanNaslov(c, 'Djelatnost društva'),
      { t: 'p', x: 'Pretežna djelatnost društva je: ' + djelatnost(f) + '.' },
      { t: 'p', x: 'Društvo može obavljati i druge djelatnosti koje nijesu zabranjene zakonom, uključujući djelatnosti za koje ispunjava posebne uslove propisane zakonom ili drugim propisom.' });

    b.push(clanNaslov(c, 'Osnovni kapital'),
      { t: 'p', x: 'Osnovni kapital društva iznosi ' + iznos(broj(f.kapital)) + ' EUR.' },
      { t: 'p', x: 'Osnovni kapital se sastoji od novčanog uloga osnivača.' },
      { t: 'p', x: 'Osnivač u osnovnom kapitalu društva ima udio od ' + (x.udio != null ? procenat(x.udio) : PRAZNO) + '.' });
    if (get(f, 'dokumenta.nadoknada') === 'da' || ima(get(f, 'dokumenta.troskovi'))) {
      troskoviTekst(f, true).forEach(function (t) { b.push({ t: 'p', x: t }); });
    }

    b.push(clanNaslov(c, 'Odgovornost'),
      { t: 'p', x: 'Društvo posluje kao društvo sa ograničenom odgovornošću.' },
      { t: 'p', x: 'Društvo stiče svojstvo pravnog lica danom registracije u Centralnom registru privrednih subjekata Crne Gore.' },
      { t: 'p', x: 'Osnivač ne odgovara za obaveze društva, osim do visine preuzetog, odnosno unesenog uloga, u skladu sa zakonom.' });

    b.push(clanNaslov(c, 'Organi društva'),
      { t: 'p', x: 'Organi društva su skupština društva i izvršni direktor.' },
      { t: 'p', x: 'Kod jednočlanog društva ovlašćenja skupštine vrši jedini član društva, a odluke se donose u pisanom obliku.' });

    b.push(clanNaslov(c, 'Izvršni direktor'),
      { t: 'p', x: 'Društvo ima jednog izvršnog direktora.' },
      { t: 'p', x: 'Za izvršnog direktora društva imenuje se ' + (get(f, 'zastupnik.ime') || PRAZNO) + '.' },
      { t: 'p', x: 'Izvršni direktor vodi poslovanje društva, organizuje rad društva, izvršava odluke jedinog člana društva, zastupa društvo i obavlja druge poslove u skladu sa zakonom, statutom društva i odlukama jedinog člana društva.' });

    b.push(clanNaslov(c, 'Zastupanje društva'),
      { t: 'p', x: 'Društvo zastupa izvršni direktor, samostalno i bez ograničenja, u skladu sa statutom društva i zakonom.' },
      { t: 'p', x: 'Ako se imenuju druga lica ovlašćena za zastupanje, njihov način zastupanja i eventualna ograničenja uređuju se posebnom odlukom jedinog člana društva i registruju kod nadležnog organa kada je to propisano zakonom.' });

    b.push(clanNaslov(c, 'Statut društva'),
      { t: 'p', x: 'Osnivač društva usvaja statut društva kojim se bliže uređuju poslovno ime, sjedište, djelatnost, osnovni kapital, udjeli, organi društva, način odlučivanja, zastupanje, izmjene statuta i druga pitanja od značaja za poslovanje društva.' });

    b.push(clanNaslov(c, 'Trajanje društva'),
      { t: 'p', x: 'Društvo se osniva na neodređeno vrijeme.' });

    b.push(clanNaslov(c, 'Završne odredbe'),
      { t: 'p', x: 'Ova odluka predstavlja osnivački akt društva i stupa na snagu danom potpisivanja, a primjenjuje se od dana registracije društva u Centralnom registru privrednih subjekata Crne Gore.' },
      { t: 'p', x: 'Na sva pitanja koja nijesu uređena ovom odlukom primjenjuju se odredbe Zakona o privrednim društvima Crne Gore i drugih važećih propisa.' });

    b.push(uMjestuDana(f), { t: 'potpisi', lista: [{ uloga: 'OSNIVAČ:', ime: pravno ? (o.ime || PRAZNO) + ', zastupnik ' + (o.zastupnik || PRAZNO) : (o.ime || PRAZNO) }] });
    return b;
  }

  // ----- Statut -----
  function statut(f) {
    var cl = clanovi(f);
    var jedan = cl.length <= 1;
    var m = mandat(f);
    var z = f.zastupnik || {};
    var c = brojac();
    var b = [
      { t: 'naslov', x: 'STATUT' },
      { t: 'podnaslov', x: naslovFirme(f) },
      { t: 'p', x: 'Na osnovu ' + zakonKlijent() + (jedan
        ? ' i odluke o osnivanju društva, osnivač društva usvaja sljedeći:'
        : ' i ugovora o osnivanju društva, osnivači društva usvajaju sljedeći:') },
      { t: 'podnaslov', x: 'STATUT DRUŠTVA SA OGRANIČENOM ODGOVORNOŠĆU' },

      clanNaslov(c, 'Opšte odredbe'),
      { t: 'p', x: 'Ovim statutom uređuju se poslovno ime, sjedište i pretežna djelatnost društva, iznos osnovnog kapitala, udjeli članova društva, način sazivanja i odlučivanja skupštine društva, organi upravljanja, zastupanje društva, postupak izmjena i dopuna statuta, kao i druga pitanja od značaja za poslovanje društva.' },

      clanNaslov(c, 'Pravna forma i odgovornost'),
      { t: 'p', x: 'Društvo posluje kao društvo sa ograničenom odgovornošću.' },
      { t: 'p', x: 'Društvo stiče svojstvo pravnog lica danom registracije u Centralnom registru privrednih subjekata Crne Gore.' },
      { t: 'p', x: 'Članovi društva ne odgovaraju za obaveze društva, osim do visine preuzetih, odnosno unesenih uloga, u skladu sa zakonom.' },

      clanNaslov(c, 'Poslovno ime'),
      { t: 'p', x: 'Puno poslovno ime društva glasi: ' + (f.naziv || PRAZNO) + '.' }
    ];
    if (ima(f.skraceniNaziv)) b.push({ t: 'p', x: 'Skraćeno poslovno ime društva glasi: ' + f.skraceniNaziv + '.' });
    b.push({ t: 'p', x: 'Društvo može u poslovanju koristiti i znak, logotip, memorandum i druge elemente vizuelnog identiteta, u skladu sa zakonom i odlukama nadležnih organa društva.' });

    b.push(clanNaslov(c, 'Sjedište'),
      { t: 'p', x: 'Sjedište društva je ' + uMjestu(mjestoSjedistaKlijent(f)) + ', na adresi ' + ulicaBroj(f) + '.' },
      { t: 'p', x: 'O promjeni adrese sjedišta odlučuje skupština društva, u skladu sa zakonom i ovim statutom.' });

    b.push(clanNaslov(c, 'Djelatnost'),
      { t: 'p', x: 'Pretežna djelatnost društva je: ' + djelatnost(f) + '.' },
      { t: 'p', x: 'Društvo može obavljati i druge djelatnosti koje nijesu zabranjene zakonom, uključujući djelatnosti za koje ispunjava posebne uslove propisane zakonom ili drugim propisom.' });

    b.push(clanNaslov(c, 'Osnovni kapital'),
      { t: 'p', x: 'Osnovni kapital društva iznosi ' + iznos(broj(f.kapital)) + ' EUR.' },
      { t: 'p', x: 'Osnovni kapital se sastoji od novčanog uloga članova društva. Ako postoje nenovčani ulozi, njihova vrsta, opis i procijenjena novčana vrijednost utvrđuju se osnivačkim aktom i evidencijama društva, u skladu sa zakonom.' },
      { t: 'p', x: 'Povećanje i smanjenje osnovnog kapitala vrši se u skladu sa zakonom, osnivačkim aktom i ovim statutom.' });

    b.push(clanNaslov(c, 'Udjeli članova društva'),
      { t: 'p', x: 'Udjeli članova društva u ukupnom osnovnom kapitalu izraženi su u procentima kako slijedi:' },
      { t: 'tabela', zaglavlje: ['Red. br.', 'Član društva', 'Iznos uloga (EUR)', 'Udio u osnovnom kapitalu (%)'],
        redovi: (cl.length ? cl : [{ o: {}, udio: null, iznos: null }]).map(function (x, i) {
          return [(i + 1) + '.', velikaSlova(x.o.ime), iznos(x.iznos), x.udio != null ? procenat(x.udio).replace('%', '') : PRAZNO];
        }) });

    b.push(clanNaslov(c, 'Prava i obaveze članova društva'),
      { t: 'p', x: 'Članovi društva imaju prava i obaveze utvrđene zakonom, osnivačkim aktom i ovim statutom.' },
      { t: 'p', x: 'Članovi društva imaju pravo na učešće u radu skupštine, pravo glasa, pravo na informisanje o poslovanju društva, pravo na učešće u raspodjeli dobiti i pravo na raspolaganje udjelom, u skladu sa zakonom i ovim statutom.' },
      { t: 'p', x: 'Pravo glasa se ostvaruje srazmjerno udjelu člana u osnovnom kapitalu, osim ako zakonom nije drugačije propisano.' });

    b.push(clanNaslov(c, 'Prenos udjela'),
      { t: 'p', x: 'Prenos udjela između članova društva je slobodan, osim ako članovi društva posebnom odlukom ili ugovorom ne urede drugačije, u granicama zakona.' },
      { t: 'p', x: 'U slučaju prenosa udjela trećem licu, ostali članovi društva imaju pravo preče kupovine, ukoliko zakonom ili ovim statutom nije drugačije propisano.' },
      { t: 'p', x: 'Postupak prenosa udjela sprovodi se u pisanom obliku i registruje kod nadležnog organa kada je to zakonom propisano.' });

    b.push(clanNaslov(c, 'Organi društva'),
      { t: 'p', x: 'Organi društva su skupština društva i izvršni direktor.' },
      { t: 'p', x: 'Društvo može imati i druge organe ili funkcije ako to odluči skupština društva, u skladu sa zakonom i ovim statutom.' });

    b.push(clanNaslov(c, 'Skupština društva'),
      { t: 'p', x: 'Skupštinu društva čine svi članovi društva.' },
      { t: 'p', x: 'Ako društvo ima jednog člana, ovlašćenja skupštine vrši jedini član društva, a odluke se donose u pisanom obliku.' },
      { t: 'p', x: 'Skupština odlučuje o pitanjima iz svoje nadležnosti utvrđenim zakonom i ovim statutom, uključujući usvajanje izmjena statuta, promjene osnovnog kapitala, raspodjelu dobiti, imenovanje i razrješenje izvršnog direktora, statusne promjene i prestanak društva.' });

    b.push(clanNaslov(c, 'Sazivanje i održavanje skupštine'),
      { t: 'p', x: 'Sjednicu skupštine saziva izvršni direktor, član društva ili drugo lice ovlašćeno zakonom ili ovim statutom.' },
      { t: 'p', x: 'Poziv za sjednicu dostavlja se članovima društva u pisanom ili elektronskom obliku, na adresu koju su članovi dostavili društvu, najkasnije osam dana prije dana održavanja sjednice, osim ako svi članovi pristanu na kraći rok.' },
      { t: 'p', x: 'Poziv sadrži mjesto i vrijeme održavanja sjednice, dnevni red i materijale potrebne za odlučivanje.' },
      { t: 'p', x: 'Skupština se može održati i bez formalnog sazivanja ako su prisutni svi članovi društva i ako se nijedan član ne protivi održavanju sjednice i odlučivanju.' });

    b.push(clanNaslov(c, 'Odlučivanje skupštine'),
      { t: 'p', x: 'Skupština donosi odluke običnom većinom glasova prisutnih članova, osim kada je zakonom, osnivačkim aktom ili ovim statutom propisana druga većina.' },
      { t: 'p', x: 'Odluke o izmjenama i dopunama statuta, povećanju ili smanjenju osnovnog kapitala, statusnim promjenama i prestanku društva donose se većinom propisanom zakonom, odnosno ovim statutom.' },
      { t: 'p', x: 'O radu skupštine vodi se zapisnik, osim kod jednočlanog društva, gdje se odluke jedinog člana unose u knjigu odluka ili posebnu evidenciju odluka društva.' });

    b.push(clanNaslov(c, 'Izvršni direktor'),
      { t: 'p', x: 'Društvo ima jednog izvršnog direktora, koga imenuje i razrješava skupština društva.' },
      { t: 'p', x: 'Izvršni direktor društva je: ' + (z.ime || PRAZNO) + '.' },
      { t: 'p', x: m
        ? 'Mandat izvršnog direktora traje ' + godina(m).replace('godinu', 'godinu dana') + ', osim ako odlukom o imenovanju nije drugačije određeno.'
        : 'Mandat izvršnog direktora traje do razrješenja, osim ako odlukom o imenovanju nije drugačije određeno.' },
      { t: 'p', x: 'Izvršni direktor vodi poslovanje društva, organizuje rad društva, izvršava odluke skupštine, zastupa društvo i obavlja druge poslove u skladu sa zakonom, ovim statutom i odlukama skupštine.' });

    b.push(clanNaslov(c, 'Zastupanje društva'),
      { t: 'p', x: 'Društvo zastupa i predstavlja izvršni direktor ' + velikaSlova(z.ime) + ', JMBG ' + (z.jmbg || PRAZNO) +
        ', adresa prebivališta: ' + (z.adresa || PRAZNO) + ', samostalno i sa neograničenim ovlašćenjima. ' +
        (jedan ? 'U saglasnosti sa Osnivačem, ' : 'Uz saglasnost skupštine društva, ') +
        'izvršni direktor može za zastupanje i predstavljanje društva ovlastiti i drugu osobu.' },
      { t: 'p', x: (jedan ? 'Osnivač' : 'Skupština društva') + ' može imenovati i ovlašćene zastupnike Društva, i odrediti njihova ovlašćenja i ograničenja za zastupanje.' },
      { t: 'p', x: 'Ako je imenovano više lica ovlašćenih za zastupanje, način zastupanja određuje se odlukom o imenovanju i registruje kod nadležnog organa.' },
      { t: 'p', x: 'Ograničenja ovlašćenja za zastupanje proizvode dejstvo prema trećim licima u skladu sa zakonom i pravilima registracije.' });

    b.push(clanNaslov(c, 'Dobit i pokriće gubitka'),
      { t: 'p', x: 'Dobit društva utvrđuje se godišnjim finansijskim iskazima i raspoređuje odlukom skupštine društva, u skladu sa zakonom.' },
      { t: 'p', x: 'Članovi društva učestvuju u raspodjeli dobiti srazmjerno svojim udjelima, osim ako skupština društva jednoglasno ne odluči drugačije, u skladu sa zakonom.' },
      { t: 'p', x: 'Gubitak društva pokriva se u skladu sa zakonom, odlukom skupštine društva i raspoloživim sredstvima društva.' });

    b.push(clanNaslov(c, 'Poslovne knjige, evidencije i akti društva'),
      { t: 'p', x: 'Društvo vodi poslovne knjige i evidencije u skladu sa zakonom.' },
      { t: 'p', x: 'Društvo čuva osnivački akt, statut, odluke organa društva, finansijske iskaze, evidenciju članova društva i drugu dokumentaciju koju je dužno da čuva u skladu sa zakonom.' },
      { t: 'p', x: 'Članovi društva imaju pravo uvida u akte i dokumentaciju društva u skladu sa zakonom i ovim statutom.' });

    b.push(clanNaslov(c, 'Izmjene i dopune statuta'),
      { t: 'p', x: 'Izmjene i dopune ovog statuta donosi skupština društva odlukom članova koji posjeduju udjele koji predstavljaju dvotrećinsku većinu glasačkih prava, osim ako je za pojedina pitanja zakonom propisana druga većina.' },
      { t: 'p', x: 'Ako društvo ima jednog člana, izmjene i dopune statuta donosi jedini član društva u pisanom obliku.' },
      { t: 'p', x: 'Izmjene i dopune statuta registruju se kod nadležnog organa kada je to propisano zakonom.' });

    b.push(clanNaslov(c, 'Prestanak društva'),
      { t: 'p', x: 'Društvo prestaje u slučajevima i na način propisan zakonom, odlukom skupštine društva, statusnom promjenom, likvidacijom, stečajem ili drugim zakonom predviđenim osnovom.' },
      { t: 'p', x: 'U slučaju prestanka društva sprovodi se postupak propisan zakonom.' });

    b.push(clanNaslov(c, 'Primjena zakona'),
      { t: 'p', x: 'Na sva pitanja koja nijesu uređena ovim statutom neposredno se primjenjuju odredbe Zakona o privrednim društvima Crne Gore i drugih važećih propisa.' });

    b.push(clanNaslov(c, 'Stupanje na snagu'),
      { t: 'p', x: 'Ovaj statut stupa na snagu danom usvajanja, a primjenjuje se od dana registracije društva u Centralnom registru privrednih subjekata Crne Gore.' });

    b.push(uMjestuDana(f), {
      t: 'potpisi',
      lista: (cl.length ? cl : [{ o: {} }]).map(function (x) {
        return { uloga: jedan ? 'Za društvo / osnivač:' : 'Osnivač:', ime: (x.o.ime || PRAZNO) + ', osnivač' };
      })
    });
    return b;
  }

  // ----- Odluka o imenovanju izvršnog direktora -----
  function odlukaDirektor(f) {
    var cl = clanovi(f);
    var jedan = cl.length <= 1;
    var m = mandat(f);
    var z = f.zastupnik || {};
    var dosadasnji = get(f, 'dokumenta.prethodniDirektor');
    var organ = jedan ? 'jedinog člana društva' : 'skupštine društva';
    var c = brojac();
    var b = [
      { t: 'naslov', x: 'ODLUKA O IMENOVANJU IZVRŠNOG DIREKTORA' },
      { t: 'podnaslov', x: naslovFirme(f) },
      { t: 'p', x: 'Na osnovu ' + zakonKlijent() + ', ' + (jedan ? 'Odluke' : 'Ugovora') + ' o osnivanju društva i Statuta društva ' + (f.naziv || PRAZNO) + ', ' +
        (jedan ? 'jedini osnivač i član društva ' + ((cl[0] && cl[0].o.ime) || PRAZNO) : 'skupština društva') + ' donosi sljedeću:' },
      { t: 'naslov', x: 'ODLUKU' },
      { t: 'podnaslov', x: 'O IMENOVANJU IZVRŠNOG DIREKTORA' }
    ];
    if (ima(dosadasnji)) {
      b.push(clanNaslov(c, 'Razrješenje'),
        { t: 'p', x: dosadasnji + ' razrješava se dužnosti izvršnog direktora društva ' + (f.naziv || PRAZNO) + ', danom donošenja ove odluke.' });
    }
    b.push(clanNaslov(c, 'Imenovanje'),
      { t: 'p', x: 'Za izvršnog direktora društva ' + (f.naziv || PRAZNO) + ', imenuje se:' },
      { t: 'p', x: (z.ime || PRAZNO) + ', JMBG ' + (z.jmbg || PRAZNO) + ', sa prebivalištem/boravištem na adresi ' + (z.adresa || PRAZNO) + '.' });
    b.push(clanNaslov(c, 'Mandat'),
      { t: 'p', x: m
        ? 'Izvršni direktor se imenuje na mandat od ' + godina(m).replace('godinu', 'godinu dana') + ', osim ako posebnom odlukom ' + organ + ' ne bude drugačije određeno.'
        : 'Izvršni direktor se imenuje na mandat koji traje do razrješenja, osim ako posebnom odlukom ' + organ + ' ne bude drugačije određeno.' });
    b.push(clanNaslov(c, 'Ovlašćenja izvršnog direktora'),
      { t: 'p', x: 'Izvršni direktor vodi poslovanje društva, organizuje rad društva, izvršava odluke ' + organ + ', zastupa društvo pred državnim organima, organima lokalne samouprave, bankama, pravnim i fizičkim licima, zaključuje ugovore i preduzima druge pravne i faktičke radnje u ime i za račun društva, u skladu sa zakonom, statutom društva i odlukama ' + organ + '.' });
    b.push(clanNaslov(c, 'Način zastupanja'),
      { t: 'p', x: 'Izvršni direktor zastupa društvo samostalno i bez ograničenja.' });
    b.push(clanNaslov(c, 'Registracija'),
      { t: 'p', x: 'Ova odluka se dostavlja Centralnom registru privrednih subjekata Crne Gore radi registracije podataka o izvršnom direktoru, u skladu sa zakonom.' });
    b.push(clanNaslov(c, 'Stupanje na snagu'),
      { t: 'p', x: ima(dosadasnji)
        ? 'Ova odluka stupa na snagu danom potpisivanja.'
        : 'Ova odluka stupa na snagu danom potpisivanja, a primjenjuje se od dana registracije društva u Centralnom registru privrednih subjekata Crne Gore.' });
    b.push(uMjestuDana(f), jedan
      ? { t: 'potpisi', lista: [{ uloga: 'JEDINI OSNIVAČ / ČLAN DRUŠTVA:', ime: (cl[0] && cl[0].o.ime) || PRAZNO }] }
      : { t: 'potpisi', lista: cl.map(function (x) { return { uloga: 'Član društva:', ime: x.o.ime }; }) });
    return b;
  }

  // ----- Saglasnost (izjava) za imenovanje izvršnog direktora -----
  function izjavaDirektor(f) {
    var z = f.zastupnik || {};
    return [
      { t: 'naslov', x: 'SAGLASNOST ZA IMENOVANJE IZVRŠNOG DIREKTORA' },
      { t: 'razmak' },
      { t: 'p', x: 'Ja, dolje potpisani/a:' },
      { t: 'tabela', redovi: [
        ['Ime i prezime', z.ime || PRAZNO],
        ['JMBG / broj pasoša', z.jmbg || PRAZNO],
        ['Adresa prebivališta', z.adresa || PRAZNO],
        ['Državljanstvo', z.drzavljanstvo || PRAZNO],
        ['Broj lične karte / pasoša', z.licnaKarta || PRAZNO]
      ] },
      { t: 'p', x: 'dajem saglasnost da budem imenovan/a za Izvršnog direktora privrednog društva:' },
      { t: 'podnaslov', x: f.skraceniNaziv || f.naziv || PRAZNO },
      { t: 'p', x: 'sa sjedištem na adresi: ' + ulicaBroj(f) + ', koje se osniva u skladu sa Zakonom o privrednim društvima Crne Gore.' },
      { t: 'p', x: 'Izjavljujem da prihvatam imenovanje na funkciju Izvršnog direktora navedenog društva i da sam saglasan/saglasna da se moje imenovanje registruje kod Centralnog registra privrednih subjekata Crne Gore.' },
      { t: 'p', x: 'Izjavljujem da ću poslove direktora obavljati u skladu sa zakonom, osnivačkim aktom, statutom društva i odlukama nadležnih organa društva.' },
      { t: 'p', x: 'Ova saglasnost se daje radi registracije osnivanja društva kod Centralnog registra privrednih subjekata Crne Gore.' },
      uMjestuDana(f, true),
      { t: 'potpisi', lista: [{ uloga: 'Davalac saglasnosti:', ime: velikaSlova(z.ime) }] }
    ];
  }

  function ovlascenje(f) {
    var p = f.punomocnik || {};
    var z = f.zastupnik || {};
    var pib = ima(f.pib) ? ', PIB ' + f.pib : '';
    var preduzetnik = f.pravniOblik === 'Preduzetnik';
    return [
      { t: 'naslov', x: 'OVLAŠĆENJE' },
      { t: 'razmak' },
      { t: 'p', x: (f.naziv || PRAZNO) + ', adresa sjedišta: ' + adresaSjedista(f) + pib +
        (preduzetnik ? '' : ', koje zastupa izvršni direktor ' + (z.ime || PRAZNO)) + ' (u daljem tekstu: Vlastodavac), ovim ovlašćuje' },
      { t: 'p', x: (p.ime || PRAZNO) + ', JMBG ' + (p.jmbg || PRAZNO) + ', adresa prebivališta: ' + (p.adresa || PRAZNO) +
        ' (u daljem tekstu: Punomoćnik),' },
      { t: 'p', x: 'da u ime i za račun Vlastodavca preduzima radnje pred Poreskom upravom Crne Gore, uključujući registraciju i upis u registar poreskih obveznika, registraciju za PDV, podnošenje zahtjeva, prijava i drugih podnesaka putem portala IRMS, prijem akata i davanje izjava, kao i pred Centralnim registrom privrednih subjekata i poslovnim bankama, ako je to potrebno radi registracije.' },
      { t: 'p', x: 'Ovim ovlašćenjem ne daje se prokura. Ovlašćenje važi do opoziva.' },
      { t: 'razmak' }, mjestoDatum(f),
      { t: 'potpisi', lista: [{ uloga: preduzetnik ? 'Preduzetnik' : 'Za Vlastodavca – izvršni direktor', ime: (preduzetnik ? get(f, 'osnivaci.0.ime') : z.ime) || PRAZNO }] }
    ];
  }

  /*
   * Lista dokumenata za firmu: [{id, naziv, dostupan, razlog, nedostaje[], blokovi}]
   */
  function zaFirmu(f) {
    f = f || {};
    var doo = /\(DOO\)|ograničenom odgovornošću/i.test(f.pravniOblik || '');
    var cl = clanovi(f);
    var viseClanova = cl.length > 1;
    var samoDoo = 'Šablon postoji samo za DOO';
    var osnovna = ['naziv', 'sjediste.opstina', 'sjediste.ulica', 'dokumenta.datum'];
    var direktor = ['zastupnik.ime', 'zastupnik.jmbg', 'zastupnik.adresa'];
    var akt = osnovna.concat(['sifraDjelatnosti', 'kapital', 'osnivaci', 'troskovi']);

    var lista = [
      viseClanova
        ? { id: 'ugovor-o-osnivanju', naziv: 'Ugovor o osnivanju', dostupan: doo, razlog: samoDoo, polja: akt.concat(direktor), fn: ugovorOsnivanje }
        : { id: 'odluka-o-osnivanju', naziv: 'Osnivački akt – Odluka o osnivanju', dostupan: doo, razlog: samoDoo,
          polja: akt.concat(['zastupnik.ime']), fn: odlukaOsnivanje },
      { id: 'statut', naziv: 'Statut', dostupan: doo, razlog: samoDoo,
        polja: osnovna.concat(['sifraDjelatnosti', 'kapital', 'osnivaci'], direktor), fn: statut },
      { id: 'odluka-o-imenovanju-direktora', naziv: 'Odluka o imenovanju izvršnog direktora', dostupan: doo, razlog: samoDoo,
        polja: osnovna.concat(direktor), fn: odlukaDirektor },
      { id: 'izjava-direktora', naziv: 'Saglasnost (izjava) za imenovanje izvršnog direktora', dostupan: doo, razlog: samoDoo,
        polja: osnovna.concat(direktor, ['zastupnik.drzavljanstvo', 'zastupnik.licnaKarta']), fn: izjavaDirektor },
      { id: 'ovlascenje', naziv: 'Ovlašćenje za zastupanje pred Poreskom upravom', dostupan: true,
        polja: osnovna.concat(['punomocnik.ime', 'punomocnik.jmbg']), fn: ovlascenje }
    ];
    return lista.map(function (d) {
      return {
        id: d.id,
        naziv: d.naziv,
        dostupan: d.dostupan,
        razlog: d.dostupan ? '' : d.razlog,
        nedostaje: d.dostupan ? nedostaje(f, d.polja) : [],
        blokovi: d.dostupan ? d.fn(f) : []
      };
    });
  }

  // ---------- HTML ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function uHTML(blokovi) {
    return blokovi.map(function (b) {
      switch (b.t) {
        case 'naslov': return '<h1>' + esc(b.x) + '</h1>';
        case 'podnaslov': return '<h2>' + esc(b.x) + '</h2>';
        case 'clan': return '<h3>' + esc(b.x) + (b.naslov ? '<br>' + esc(b.naslov) : '') + '</h3>';
        case 'tabela': return '<table class="podaci">' +
          (b.zaglavlje ? '<thead><tr>' + b.zaglavlje.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead>' : '') +
          '<tbody>' + b.redovi.map(function (r) {
            return '<tr>' + r.map(function (c, i) { return (b.zaglavlje || i > 0 ? '<td>' : '<th scope="row">') + esc(c) + (b.zaglavlje || i > 0 ? '</td>' : '</th>'); }).join('') + '</tr>';
          }).join('') + '</tbody></table>';
        case 'stavka': return '<p class="stavka">' + esc(b.x) + '</p>';
        case 'razmak': return '<div class="razmak"></div>';
        case 'mjestoDatum': return '<p class="mjesto-datum">' + esc(b.x) + '</p>';
        case 'potpisi': return '<div class="potpisi">' + b.lista.map(function (p) {
          return '<div class="potpis"><div class="uloga">' + esc(p.uloga) + '</div><div class="linija"></div><div>' + esc(p.ime) + '</div></div>';
        }).join('') + '</div>';
        default: return '<p>' + esc(b.x) + '</p>';
      }
    }).join('\n');
  }

  var STIL_STAMPE =
    '@page{size:A4;margin:2.2cm 2.2cm 2cm}' +
    'body{font:12pt/1.45 "Times New Roman",Times,serif;color:#000;background:#fff;max-width:17cm;margin:24px auto;padding:0 16px}' +
    'h1{text-align:center;font-size:15pt;margin:6px 0 2px;letter-spacing:.06em}' +
    'h2{text-align:center;font-size:12pt;margin:2px 0 10px}' +
    'h3{text-align:center;font-size:12pt;margin:14px 0 4px}' +
    'table.podaci{border-collapse:collapse;width:100%;margin:6px 0 10px}' +
    'table.podaci th,table.podaci td{border:1px solid #000;padding:4px 8px;text-align:left;vertical-align:top}' +
    'table.podaci tbody th{font-weight:normal;width:40%}' +
    'p{text-align:justify;margin:0 0 6px}' +
    'p.stavka{margin-left:1cm}' +
    '.razmak{height:12px}' +
    '.mjesto-datum{margin-top:18px}' +
    '.potpisi{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:24px 48px;margin-top:24px;page-break-inside:avoid}' +
    '.potpis{width:6.5cm;text-align:center}' +
    '.potpis .uloga{font-weight:bold}' +
    '.potpis .linija{border-bottom:1px solid #000;height:36px;margin-bottom:4px}' +
    '.alat{position:sticky;top:0;background:#f3f4f6;border:1px solid #d1d5db;padding:8px 12px;margin-bottom:16px;font:14px system-ui,sans-serif;display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
    '.alat button{font:inherit;padding:6px 12px;cursor:pointer}' +
    '@media print{.alat{display:none}body{margin:0;padding:0;max-width:none}}';

  function dokumentHTML(naslov, blokovi, saAlatom) {
    var alat = saAlatom
      ? '<div class="alat"><button onclick="window.print()">Štampaj / Sačuvaj kao PDF</button>' +
        '<span>Opšti model – provjerite tekst prije potpisivanja.</span></div>'
      : '';
    return '<!doctype html><html lang="sr-ME"><head><meta charset="utf-8"><title>' + esc(naslov) +
      '</title><style>' + STIL_STAMPE + '</style></head><body>' + alat + uHTML(blokovi) + '</body></html>';
  }

  // ---------- DOCX ----------
  function xml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function par(tekst, o) {
    o = o || {};
    var ppr = '<w:pPr>' + (o.keep ? '<w:keepNext/>' : '') +
      '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after == null ? 120 : o.after) + '"/>' +
      (o.ind ? '<w:ind w:left="' + o.ind + '"/>' : '') +
      '<w:jc w:val="' + (o.jc || 'both') + '"/></w:pPr>';
    var rpr = (o.b || o.sz) ? '<w:rPr>' + (o.b ? '<w:b/>' : '') + (o.sz ? '<w:sz w:val="' + o.sz + '"/><w:szCs w:val="' + o.sz + '"/>' : '') + '</w:rPr>' : '';
    var run = tekst ? '<w:r>' + rpr + '<w:t xml:space="preserve">' + xml(tekst) + '</w:t></w:r>' : '';
    return '<w:p>' + ppr + run + '</w:p>';
  }

  function tabelaPodataka(b) {
    var kolone = (b.zaglavlje || b.redovi[0] || []).length || 1;
    var sirina = Math.floor(9000 / kolone);
    var granica = '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>' +
      '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>' +
      '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
    var red = function (celije, podebljano) {
      return '<w:tr><w:trPr><w:cantSplit/></w:trPr>' + celije.map(function (c) {
        return '<w:tc><w:tcPr><w:tcW w:w="' + sirina + '" w:type="dxa"/></w:tcPr>' + par(c, { jc: 'left', after: 40, b: podebljano }) + '</w:tc>';
      }).join('') + '</w:tr>';
    };
    var grid = '';
    for (var i = 0; i < kolone; i++) grid += '<w:gridCol w:w="' + sirina + '"/>';
    return '<w:tbl><w:tblPr><w:tblW w:w="' + (sirina * kolone) + '" w:type="dxa"/><w:tblBorders>' + granica + '</w:tblBorders>' +
      '<w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
      '<w:tblGrid>' + grid + '</w:tblGrid>' +
      (b.zaglavlje ? red(b.zaglavlje, true) : '') +
      b.redovi.map(function (r) { return red(r, false); }).join('') + '</w:tbl>';
  }

  function tabelaPotpisa(lista) {
    // Potpisi u dvije kolone, bez okvira.
    var redovi = [];
    for (var i = 0; i < lista.length; i += 2) redovi.push(lista.slice(i, i + 2));
    var celija = function (p) {
      var sadrzaj = p
        ? par(p.uloga, { jc: 'center', b: true, after: 360 }) + par('______________________________', { jc: 'center', after: 0 }) + par(p.ime, { jc: 'center' })
        : par('', {});
      return '<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>' + sadrzaj + '</w:tc>';
    };
    return '<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:jc w:val="right"/>' +
      '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>' +
      '</w:tblPr><w:tblGrid><w:gridCol w:w="4500"/><w:gridCol w:w="4500"/></w:tblGrid>' +
      redovi.map(function (r) {
        // Jedan potpis ide u desnu kolonu.
        var celije = r.length === 1 ? celija(null) + celija(r[0]) : celija(r[0]) + celija(r[1]);
        return '<w:tr><w:trPr><w:cantSplit/></w:trPr>' + celije + '</w:tr>';
      }).join('') + '</w:tbl>';
  }

  function documentXML(blokovi) {
    var tijelo = blokovi.map(function (b) {
      switch (b.t) {
        case 'naslov': return par(b.x, { jc: 'center', b: true, sz: 30, before: 120, after: 40, keep: true });
        case 'podnaslov': return par(b.x, { jc: 'center', b: true, after: 160, keep: true });
        case 'clan': return b.naslov
          ? par(b.x, { jc: 'center', b: true, before: 200, after: 0, keep: true }) + par(b.naslov, { jc: 'center', b: true, after: 80, keep: true })
          : par(b.x, { jc: 'center', b: true, before: 200, after: 80, keep: true });
        case 'tabela': return tabelaPodataka(b) + par('', { after: 60 });
        case 'stavka': return par(b.x, { ind: 567 });
        case 'razmak': return par('', { after: 120 });
        case 'mjestoDatum': return par(b.x, { jc: 'left', before: 240 });
        case 'potpisi': return par('', { after: 240 }) + tabelaPotpisa(b.lista);
        default: return par(b.x);
      }
    }).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<w:body>' + tijelo +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1247" w:right="1247" w:bottom="1134" w:left="1247" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>' +
      '</w:body></w:document>';
  }

  var DOCX_FAJLOVI = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '</Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>',
    'word/_rels/document.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>',
    'word/styles.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>' +
      '<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="sr-Latn-ME"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
      '</w:styles>'
  };

  // Minimalni ZIP (bez kompresije) – dovoljan za .docx.
  var CRC_TABELA = (function () {
    var t = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(b) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < b.length; i++) c = CRC_TABELA[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    return new Uint8Array(Buffer.from(s, 'utf8'));
  }
  function zip(fajlovi) {
    var d = new Date();
    var vrijeme = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var dan = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    var lokalni = [], centralni = [], pomak = 0;
    Object.keys(fajlovi).forEach(function (ime) {
      var imeB = utf8(ime), pod = utf8(fajlovi[ime]), crc = crc32(pod);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
      h.setUint16(8, 0, true); h.setUint16(10, vrijeme, true); h.setUint16(12, dan, true);
      h.setUint32(14, crc, true); h.setUint32(18, pod.length, true); h.setUint32(22, pod.length, true);
      h.setUint16(26, imeB.length, true); h.setUint16(28, 0, true);
      lokalni.push(new Uint8Array(h.buffer), imeB, pod);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true); c.setUint16(12, vrijeme, true); c.setUint16(14, dan, true);
      c.setUint32(16, crc, true); c.setUint32(20, pod.length, true); c.setUint32(24, pod.length, true);
      c.setUint16(28, imeB.length, true); c.setUint32(42, pomak, true);
      centralni.push(new Uint8Array(c.buffer), imeB);
      pomak += 30 + imeB.length + pod.length;
    });
    var velCentralnog = centralni.reduce(function (s, a) { return s + a.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    var n = Object.keys(fajlovi).length;
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, n, true); e.setUint16(10, n, true);
    e.setUint32(12, velCentralnog, true); e.setUint32(16, pomak, true);
    var dijelovi = lokalni.concat(centralni, [new Uint8Array(e.buffer)]);
    var ukupno = dijelovi.reduce(function (s, a) { return s + a.length; }, 0);
    var out = new Uint8Array(ukupno), p = 0;
    dijelovi.forEach(function (a) { out.set(a, p); p += a.length; });
    return out;
  }

  function uDocx(blokovi) {
    var f = {};
    Object.keys(DOCX_FAJLOVI).forEach(function (k) { f[k] = DOCX_FAJLOVI[k]; });
    f['word/document.xml'] = documentXML(blokovi);
    return zip(f);
  }

  var api = {
    ZAKON: ZAKON_NAZIV,
    zaFirmu: zaFirmu,
    uHTML: uHTML,
    dokumentHTML: dokumentHTML,
    uDocx: uDocx,
    documentXML: documentXML,
    _: { euro: euro, godina: godina, clanovi: clanovi, crc32: crc32, opisLica: opisLica }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Dokumenti = api;
})(this);
