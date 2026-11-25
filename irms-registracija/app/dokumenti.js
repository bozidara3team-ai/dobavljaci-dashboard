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

  function imenovanjeStatutom(f) {
    return (get(f, 'dokumenta.imenovanje') || 'statut') === 'statut';
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
      'zastupnik.ime': 'ime direktora',
      'zastupnik.jmbg': 'JMBG direktora',
      'zastupnik.adresa': 'adresa direktora',
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
      { t: 'p', x: 'Organi Društva su skupština i direktor.' + (jedan ? ' Osnivač, kao jedini član Društva, ima ovlašćenja skupštine.' : ' Skupštinu čine svi članovi Društva.') },
      { t: 'p', x: 'Nadležnosti organa Društva, način sazivanja i rada skupštine, imenovanje i razrješenje direktora, zastupanje Društva i druga pitanja uređuju se Statutom Društva.' });
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

  function odlukaOsnivanje(f) {
    var cl = clanovi(f);
    var c = brojac();
    var b = [
      { t: 'p', x: 'Na osnovu člana 8 i člana 362 ' + ZAKON + ', osnivač ' + opisLica(cl[0] && cl[0].o) + ', donosi' },
      { t: 'razmak' },
      { t: 'naslov', x: 'ODLUKU' },
      { t: 'podnaslov', x: 'o osnivanju društva sa ograničenom odgovornošću' },
      { t: 'podnaslov', x: '„' + (f.naziv || PRAZNO) + '”' },
      { t: 'clan', x: c() },
      { t: 'p', x: 'Ovom odlukom osniva se jednočlano društvo sa ograničenom odgovornošću (u daljem tekstu: Društvo).' },
      { t: 'p', x: 'Osnivač i jedini član Društva je: ' + opisLica(cl[0] && cl[0].o) + ' (u daljem tekstu: Osnivač).' }
    ].concat(clanoviAkta(f, cl, c, true), zavrsneAkta(f, c, true, false));
    b.push({ t: 'razmak' }, mjestoDatum(f), potpisiOsnivaca(cl));
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

  // ---------- statut (član 363) ----------
  function statut(f) {
    var cl = clanovi(f);
    var jedan = cl.length <= 1;
    var m = mandat(f);
    var c = brojac();
    var b = [];
    b.push({ t: 'p', x: 'Na osnovu člana 8 i člana 363 ' + ZAKON + ', ' + (jedan
      ? 'osnivač ' + opisLica(cl[0] && cl[0].o) + ', donosi'
      : 'osnivači društva sa ograničenom odgovornošću „' + (f.naziv || PRAZNO) + '” donose') });
    b.push({ t: 'razmak' }, { t: 'naslov', x: 'STATUT' },
      { t: 'podnaslov', x: 'društva sa ograničenom odgovornošću' },
      { t: 'podnaslov', x: '„' + (f.naziv || PRAZNO) + '”' });

    b.push({ t: 'podnaslov', x: 'I. OSNOVNE ODREDBE' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Ovim statutom uređuju se poslovno ime, sjedište i pretežna djelatnost društva sa ograničenom odgovornošću „' + (f.naziv || PRAZNO) +
        '” (u daljem tekstu: Društvo), osnovni kapital i udjeli, organi Društva i njihove nadležnosti, način sazivanja sjednice skupštine i donošenja odluka, imenovanje i razrješenje direktora, zastupanje, raspodjela dobiti, postupak izmjena statuta i druga pitanja od značaja za Društvo.' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Poslovno ime Društva je: ' + (f.naziv || PRAZNO) + '.' + (ima(f.skraceniNaziv) ? ' Skraćeno poslovno ime Društva je: ' + f.skraceniNaziv + '.' : '') },
      { t: 'p', x: sjedisteTekst(f) },
      { t: 'p', x: 'Adresa Društva za prijem elektronske pošte je: ' + (f.email || PRAZNO) + '.' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Društvo je pravno lice i za svoje obaveze odgovara cjelokupnom svojom imovinom. Članovi Društva ne odgovaraju za obaveze Društva, osim u slučajevima propisanim zakonom.' },
      { t: 'p', x: 'Društvo nije dužno da koristi pečat. Ako Društvo obavlja djelatnost elektronskim putem, koristi elektronski pečat u skladu sa zakonom.' });

    b.push({ t: 'podnaslov', x: 'II. DJELATNOST DRUŠTVA' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Pretežna djelatnost Društva, u skladu sa propisom kojim se uređuje klasifikacija djelatnosti, je: ' + djelatnost(f) + '.' },
      { t: 'p', x: 'Pored pretežne djelatnosti, Društvo može obavljati i druge djelatnosti u skladu sa zakonom.' });

    b.push({ t: 'podnaslov', x: 'III. OSNOVNI KAPITAL I UDJELI' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Osnovni kapital Društva iznosi ' + euro(broj(f.kapital)) + '.' },
      { t: 'p', x: 'Udjeli članova Društva u ukupnom osnovnom kapitalu su:' });
    cl.forEach(function (x, i) {
      b.push({ t: 'stavka', x: (i + 1) + ') ' + (x.o.ime || PRAZNO) + ' – ' + (x.udio != null ? procenat(x.udio) : PRAZNO) +
        ', nominalne vrijednosti ' + euro(x.iznos) + ';' });
    });
    b.push({ t: 'p', x: 'Član Društva sva prava ostvaruje srazmjerno svom udjelu u Društvu.' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'O povećanju i smanjenju osnovnog kapitala odlučuje skupština Društva. Prilikom povećanja osnovnog kapitala novim ulozima, članovi Društva imaju pravo prečeg upisa udjela srazmjerno svojim udjelima.' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Prenos udjela između članova Društva je slobodan.' },
      { t: 'p', x: 'Član Društva koji namjerava da prenese udio trećem licu dužan je da ga prethodno ponudi ostalim članovima Društva. Ponuda se daje u pisanom obliku i sadrži bitne elemente ugovora o prenosu udjela, adresu na koju se upućuje prihvat ponude i rok za zaključivanje ugovora.' },
      { t: 'p', x: 'Član koji koristi pravo preče kupovine dužan je da u pisanom obliku obavijesti člana koji prenosi udio o prihvatanju ponude u cjelosti, u roku od 30 dana od dana prijema ponude. Ako ponudu prihvati više članova, a ne postoji drugačiji sporazum, udio se dijeli među njima srazmjerno njihovim udjelima.' },
      { t: 'p', x: 'Ako nijedan član ne prihvati ponudu u roku iz stava 3 ovog člana, udio se može prenijeti trećem licu pod uslovima koji nijesu povoljniji od uslova ponuđenih članovima Društva.' },
      { t: 'p', x: 'Udio se prenosi na osnovu ugovora zaključenog u pisanom obliku, uz ovjeru potpisa u skladu sa zakonom kojim se uređuje ovjera potpisa, rukopisa i prepisa.' },
      { t: 'p', x: 'U slučaju smrti člana Društva, udio se prenosi na nasljednike u skladu sa zakonom.' });

    b.push({ t: 'podnaslov', x: 'IV. ORGANI DRUŠTVA' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Organi Društva su skupština i direktor. Društvo ima jednog direktora i nema odbor direktora.' },
      { t: 'p', x: 'Ako Društvo ima jednog člana, taj član ima ovlašćenja skupštine Društva, odluke donosi u pisanom obliku i vodi evidenciju donesenih odluka.' });

    b.push({ t: 'podnaslov', x: '1. Skupština' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Skupštinu Društva čine svi članovi Društva. Direktor obavezno prisustvuje sjednici skupštine.' },
      { t: 'p', x: 'Skupština Društva:' });
    ['vrši izmjene i dopune, odnosno donosi novi statut Društva i sačinjava prečišćeni tekst statuta;',
      'imenuje i razrješava direktora i utvrđuje njegovu zaradu i naknade;',
      'imenuje i razrješava revizora;',
      'imenuje i razrješava likvidatora;',
      'donosi odluku o dobrovoljnoj likvidaciji Društva ili podnošenju predloga za pokretanje stečajnog postupka;',
      'usvaja finansijske iskaze, kao i izvještaje revizora ako su finansijski iskazi bili predmet revizije;',
      'donosi odluku o raspodjeli dobiti i načinu pokrića gubitaka;',
      'donosi odluku o povećanju ili smanjenju osnovnog kapitala;',
      'donosi odluku o statusnim promjenama i promjenama pravnog oblika;',
      'donosi odluku o sticanju sopstvenih udjela;',
      'donosi odluku o zahtjevu za istupanje člana iz Društva;',
      'donosi odluku o pokretanju postupka i davanju punomoćja za zastupanje Društva u sporu sa prokuristom, direktorom ili članom Društva;',
      'donosi poslovnik o radu;',
      'odlučuje o drugim pitanjima u skladu sa zakonom i ovim statutom.'
    ].forEach(function (s, i) { b.push({ t: 'stavka', x: (i + 1) + ') ' + s }); });
    b.push({ t: 'p', x: 'Skupština može direktoru davati obavezujuća uputstva.' });

    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Sjednicu skupštine saziva direktor. Svaki član Društva može direktoru podnijeti pisani zahtjev za sazivanje sjednice, sa predlogom dnevnog reda i predlogom odluka sa obrazloženjem. Ako direktor ne sazove sjednicu u roku od deset dana od dana prijema zahtjeva, sjednicu može sazvati član koji je podnio zahtjev.' },
      { t: 'p', x: 'Poziv za sjednicu sadrži datum slanja poziva, vrijeme i mjesto održavanja sjednice, dnevni red sa naznakom tačaka o kojima skupština donosi odluku i obavještenje o tome gdje se može izvršiti uvid u materijale za sjednicu.' },
      { t: 'p', x: 'Poziv se upućuje svakom članu u pisanom obliku, preporučenom pošiljkom na adresu iz evidencije članova Društva ili elektronskom poštom članu koji je dao pisanu saglasnost za takav način dostavljanja, najkasnije osam dana prije dana održavanja sjednice. Materijali za sjednicu stavljaju se na raspolaganje istovremeno sa slanjem poziva.' },
      { t: 'p', x: 'Ako su na sjednici prisutni, lično ili preko punomoćnika, svi članovi Društva, skupština može donijeti odluku i bez poštovanja pravila o sazivanju sjednice, ako se nijedan član ne protivi takvom načinu odlučivanja.' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Svaki član Društva ima pravo glasa srazmjerno svom udjelu u osnovnom kapitalu.' },
      { t: 'p', x: 'Kvorum za rad sjednice skupštine čine članovi koji posjeduju udjele koji daju više od polovine ukupnog broja glasova. Ako se sjednica ne održi zbog nedostatka kvoruma, ponovljena sjednica sa istim dnevnim redom održava se najranije pet, a najkasnije 15 dana od dana neodržane sjednice.' },
      { t: 'p', x: 'Skupština donosi odluke većinom glasova prisutnih članova koji imaju pravo glasa po određenom pitanju, osim ako zakonom ili ovim statutom nije predviđena veća većina. Glasanje je javno.' },
      { t: 'p', x: 'Članovi Društva mogu glasati i pisanim putem, bez prisustva sjednici, kao i učestvovati u radu skupštine korišćenjem elektronskih oblika komunikacije, u skladu sa zakonom.' },
      { t: 'p', x: 'O radu sjednice vodi se zapisnik u skladu sa zakonom.' });

    b.push({ t: 'podnaslov', x: '2. Direktor' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Direktora imenuje i razrješava skupština Društva. Pravo na predlaganje kandidata za direktora ima svaki član Društva.' },
      { t: 'p', x: m
        ? 'Direktor se imenuje na period od ' + godina(m) + '. Po isteku mandata direktor može biti ponovo imenovan.'
        : 'Trajanje mandata direktora nije ograničeno.' },
      { t: 'p', x: 'Skupština može razriješiti direktora i prije isteka mandata, bez obaveze navođenja razloga.' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Direktor mora biti poslovno sposobno fizičko lice. Direktor ne može biti lice kod kojeg postoje smetnje za imenovanje propisane zakonom.' },
      { t: 'p', x: 'Ako za vrijeme trajanja mandata prestane da ispunjava uslove za imenovanje, direktor je dužan da o tome bez odlaganja obavijesti članove Društva.' });
    b.push({ t: 'clan', x: c() }, { t: 'p', x: 'Direktor:' });
    ['zastupa Društvo prema trećim licima u skladu sa ovim statutom i odlukama skupštine;',
      'vodi poslove Društva u skladu sa ovim statutom i odlukama skupštine;',
      'odlučuje o unutrašnjoj organizaciji Društva;',
      'vrši unutrašnji nadzor nad obavljanjem djelatnosti Društva;',
      'saziva sjednice skupštine i utvrđuje predlog dnevnog reda sa predlozima odluka;',
      'izvršava odluke skupštine;',
      'daje i opoziva prokuru;',
      'izvještava skupštinu u skladu sa zakonom i ovim statutom;',
      'vrši druge poslove u skladu sa zakonom i ovim statutom.'
    ].forEach(function (s, i) { b.push({ t: 'stavka', x: (i + 1) + ') ' + s }); });
    b.push({ t: 'p', x: 'Za pitanja koja nijesu u nadležnosti skupštine, pretpostavlja se nadležnost direktora.' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Društvo zastupa direktor, samostalno i bez ograničenja.' },
      { t: 'p', x: 'Direktor ne može zastupati Društvo niti izdati punomoćje u sporu u kojem je suprotna strana on ili sa njim povezano lice; u tom slučaju punomoćje izdaje skupština.' },
      { t: 'p', x: 'Direktor ima pravo na zaradu i naknade u skladu sa odlukom skupštine.' });

    b.push({ t: 'podnaslov', x: 'V. DOBIT I GUBITAK' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Skupština odlučuje o raspodjeli dobiti i načinu pokrića gubitaka, nakon usvajanja finansijskih iskaza. Dobit namijenjena isplati članovima raspoređuje se srazmjerno njihovim udjelima, u skladu sa zakonom.' });

    b.push({ t: 'podnaslov', x: 'VI. INFORMISANJE I EVIDENCIJE' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Član Društva ima pravo na informisanje u skladu sa zakonom.' },
      { t: 'p', x: 'Društvo trajno čuva osnivački akt, statut i sve njegove izmjene, druge opšte akte, knjigu zapisnika i odluke skupštine, i vodi evidencije propisane zakonom, u svom sjedištu.' });

    b.push({ t: 'podnaslov', x: 'VII. PRESTANAK DRUŠTVA' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Društvo prestaje u slučajevima i po postupku propisanom zakonom.' });

    b.push({ t: 'podnaslov', x: 'VIII. PRELAZNE I ZAVRŠNE ODREDBE' });
    if (imenovanjeStatutom(f)) {
      b.push({ t: 'clan', x: c() },
        { t: 'p', x: 'Za prvog direktora Društva imenuje se ' + opisDirektora(f.zastupnik) +
          (m ? ', na period od ' + godina(m) + '.' : ', bez ograničenja trajanja mandata.') });
    }
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Statut se mijenja odlukom članova Društva koji posjeduju udjele koji predstavljaju dvotrećinsku većinu glasačkih prava. Na isti način odlučuje se o promjeni poslovnog imena, sjedišta i pretežne djelatnosti Društva.' },
      { t: 'p', x: 'Nakon svake izmjene statuta sačinjava se prečišćeni tekst, koji se zajedno sa izmjenama registruje u CRPS.' },
      { t: 'p', x: 'Na pitanja koja nijesu uređena ovim statutom neposredno se primjenjuju odredbe zakona.' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Ovaj statut stupa na snagu danom donošenja, a primjenjuje se od dana registracije Društva u Centralnom registru privrednih subjekata.' },
      { t: 'razmak' }, mjestoDatum(f), potpisiOsnivaca(cl));
    return b;
  }

  // ---------- direktor (član 407, 422-426) ----------
  function odlukaDirektor(f) {
    var cl = clanovi(f);
    var jedan = cl.length <= 1;
    var m = mandat(f);
    var donosilac = jedan
      ? 'jedini član društva ' + ((cl[0] && cl[0].o.ime) || PRAZNO) + ', koji ima ovlašćenja skupštine Društva,'
      : 'skupština Društva';
    return [
      { t: 'p', x: 'Na osnovu člana 407 stav 1 tačka 2 i člana 422 ' + ZAKON + ' i Statuta društva „' + (f.naziv || PRAZNO) + '”, ' + donosilac +
        ' dana ' + datum(get(f, 'dokumenta.datum')) + ' donosi' },
      { t: 'razmak' },
      { t: 'naslov', x: 'ODLUKU' },
      { t: 'podnaslov', x: 'o imenovanju direktora' },
      { t: 'clan', x: 'I' },
      { t: 'p', x: 'Za direktora društva „' + (f.naziv || PRAZNO) + '”, Opština ' + (get(f, 'sjediste.opstina') || PRAZNO) +
        ', adresa sjedišta: ' + adresaSjedista(f) + ', imenuje se ' + opisDirektora(f.zastupnik) + '.' },
      { t: 'clan', x: 'II' },
      { t: 'p', x: m ? 'Direktor se imenuje na period od ' + godina(m) + ', počev od dana donošenja ove odluke.' : 'Trajanje mandata direktora nije ograničeno.' },
      { t: 'clan', x: 'III' },
      { t: 'p', x: 'Direktor zastupa Društvo prema trećim licima i vodi poslove Društva u skladu sa Statutom i odlukama skupštine Društva.' },
      { t: 'clan', x: 'IV' },
      { t: 'p', x: 'Ova odluka stupa na snagu danom donošenja. Direktor se registruje u Centralnom registru privrednih subjekata.' },
      { t: 'razmak' }, mjestoDatum(f),
      jedan ? potpisiOsnivaca(cl) : { t: 'potpisi', lista: cl.map(function (x) { return { uloga: 'Član Društva', ime: x.o.ime }; }) }
    ];
  }

  function izjavaDirektor(f) {
    var z = f.zastupnik || {};
    return [
      { t: 'naslov', x: 'IZJAVA' },
      { t: 'podnaslov', x: 'o prihvatanju imenovanja za direktora' },
      { t: 'razmak' },
      { t: 'p', x: 'Ja, ' + opisDirektora(z) + ', izjavljujem da prihvatam imenovanje za direktora društva sa ograničenom odgovornošću „' +
        (f.naziv || PRAZNO) + '”, Opština ' + (get(f, 'sjediste.opstina') || PRAZNO) + '.' },
      { t: 'p', x: 'Izjavljujem da sam poslovno sposobno fizičko lice i da u pogledu mene ne postoje smetnje za imenovanje iz člana 424 stav 2 ' + ZAKON + ', odnosno:' },
      { t: 'stavka', x: '1) da nijesam osuđivan za krivična djela protiv prava iz rada, intelektualne svojine, platnog prometa i privrednog poslovanja, imovine i službene dužnosti, u roku od tri godine od dana prestanka pravnih posljedica osude;' },
      { t: 'stavka', x: '2) da nijesam revizor Društva niti lice koje je bilo angažovano u vršenju revizije finansijskih izvještaja Društva;' },
      { t: 'stavka', x: '3) da mi nije izrečena mjera bezbjednosti zabrane obavljanja djelatnosti koja čini pretežnu djelatnost Društva.' },
      { t: 'p', x: 'Ako za vrijeme trajanja mandata prestanem da ispunjavam uslove za imenovanje, o tome ću bez odlaganja obavijestiti članove Društva.' },
      { t: 'p', x: 'Izjavu dajem pod punom materijalnom i krivičnom odgovornošću, radi registracije u Centralnom registru privrednih subjekata.' },
      { t: 'razmak' }, mjestoDatum(f),
      { t: 'potpisi', lista: [{ uloga: 'Davalac izjave', ime: z.ime || PRAZNO }] }
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
        (preduzetnik ? '' : ', koje zastupa direktor ' + (z.ime || PRAZNO)) + ' (u daljem tekstu: Vlastodavac), ovim ovlašćuje' },
      { t: 'p', x: (p.ime || PRAZNO) + ', JMBG ' + (p.jmbg || PRAZNO) + ', adresa prebivališta: ' + (p.adresa || PRAZNO) +
        ' (u daljem tekstu: Punomoćnik),' },
      { t: 'p', x: 'da u ime i za račun Vlastodavca preduzima radnje pred Poreskom upravom Crne Gore, uključujući registraciju i upis u registar poreskih obveznika, registraciju za PDV, podnošenje zahtjeva, prijava i drugih podnesaka putem portala IRMS, prijem akata i davanje izjava, kao i pred Centralnim registrom privrednih subjekata i poslovnim bankama, ako je to potrebno radi registracije.' },
      { t: 'p', x: 'Ovim ovlašćenjem ne daje se prokura. Ovlašćenje važi do opoziva.' },
      { t: 'razmak' }, mjestoDatum(f),
      { t: 'potpisi', lista: [{ uloga: preduzetnik ? 'Preduzetnik' : 'Za Vlastodavca – direktor', ime: (preduzetnik ? get(f, 'osnivaci.0.ime') : z.ime) || PRAZNO }] }
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
    var samoDoo = 'Opšti model postoji samo za DOO';
    var statutom = imenovanjeStatutom(f);
    var osnovna = ['naziv', 'sjediste.opstina', 'sjediste.ulica', 'dokumenta.datum'];
    var direktor = ['zastupnik.ime', 'zastupnik.jmbg', 'zastupnik.adresa'];
    var akt = osnovna.concat(['sifraDjelatnosti', 'kapital', 'osnivaci', 'troskovi']);

    var lista = [
      viseClanova
        ? { id: 'ugovor-o-osnivanju', naziv: 'Ugovor o osnivanju', dostupan: doo, razlog: samoDoo, polja: akt, fn: ugovorOsnivanje }
        : { id: 'odluka-o-osnivanju', naziv: 'Odluka o osnivanju', dostupan: doo, razlog: samoDoo, polja: akt, fn: odlukaOsnivanje },
      { id: 'statut', naziv: 'Statut', dostupan: doo, razlog: samoDoo,
        polja: osnovna.concat(['sifraDjelatnosti', 'kapital', 'osnivaci'], statutom ? direktor : []), fn: statut },
      { id: 'odluka-o-imenovanju-direktora', naziv: 'Odluka o imenovanju direktora', dostupan: doo && !statutom,
        razlog: doo ? 'Direktor je imenovan Statutom (član 422 stav 4)' : samoDoo, polja: osnovna.concat(direktor), fn: odlukaDirektor },
      { id: 'izjava-direktora', naziv: 'Izjava direktora o prihvatanju imenovanja', dostupan: doo,
        razlog: samoDoo, polja: osnovna.concat(direktor), fn: izjavaDirektor },
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
        case 'clan': return '<h3>' + esc(b.x) + '</h3>';
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
        case 'clan': return par(b.x, { jc: 'center', b: true, before: 200, after: 80, keep: true });
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
