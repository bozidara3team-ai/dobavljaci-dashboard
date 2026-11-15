/*
 * Generator osnivačkih dokumenata (opšti modeli) za DOO u Crnoj Gori.
 * Radi u pregledaču (window.Dokumenti) i u Node-u (module.exports).
 *
 * VAŽNO: ovo su opšti modeli zasnovani na Zakonu o privrednim društvima
 * ("Službeni list Crne Gore", br. 65/20 i 146/21). Prije potpisivanja ih
 * treba da pregleda pravnik ili ovlašćeni računovođa.
 *
 * Dokument je niz blokova:
 *   {t:'naslov', x} {t:'podnaslov', x} {t:'clan', x} {t:'p', x}
 *   {t:'stavka', x} {t:'razmak'} {t:'mjestoDatum', x}
 *   {t:'potpisi', lista:[{uloga, ime}]}
 * koji se pretvara u HTML (pregled/štampa) ili .docx (Word).
 */
(function (root) {
  'use strict';

  var ZAKON = 'Zakona o privrednim društvima („Službeni list Crne Gore”, br. 65/20 i 146/21)';
  var PRAZNO = '______________';

  // ---------- pomoćne ----------
  function get(o, p) {
    return String(p).split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o);
  }
  function ima(v) { return v != null && String(v).trim() !== ''; }

  function datum(iso) {
    if (!ima(iso)) return PRAZNO;
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + '.' + m[2] + '.' + m[1] + '. godine' : String(iso);
  }

  function broj(v) {
    if (!ima(v)) return null;
    var n = Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'));
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

  function adresaFirme(f) {
    var s = f.sjediste || {};
    var ulica = [s.ulica, s.broj].filter(ima).join(' ');
    var dijelovi = [ulica, s.mjesto].filter(ima);
    var t = dijelovi.length ? dijelovi.join(', ') : PRAZNO;
    if (ima(s.opstina) && s.opstina !== s.mjesto) t += ', Opština ' + s.opstina;
    return t;
  }

  function mjestoSjedista(f) {
    return get(f, 'sjediste.mjesto') || get(f, 'sjediste.opstina') || PRAZNO;
  }

  /* Opis osnivača za uvod akta. */
  function opisLica(o) {
    if (!o) return PRAZNO;
    if (o.tip === 'pravno') {
      return (o.ime || PRAZNO) + ', PIB/matični broj ' + (o.pib || PRAZNO) +
        ', sa sjedištem u ' + (o.adresa || PRAZNO) + (ima(o.drzava) && o.drzava !== 'Crna Gora' ? ', ' + o.drzava : '');
    }
    var id;
    if (ima(o.jmbg)) id = 'JMBG ' + o.jmbg;
    else if (ima(o.pasos)) id = 'broj pasoša ' + o.pasos + (ima(o.drzavljanstvo) ? ', državljanstvo: ' + o.drzavljanstvo : '');
    else id = 'JMBG ' + PRAZNO;
    return (o.ime || PRAZNO) + ', ' + id + ', sa prebivalištem u ' + (o.adresa || PRAZNO);
  }

  function opisDirektora(z) {
    z = z || {};
    return (z.ime || PRAZNO) + ', JMBG ' + (z.jmbg || PRAZNO) + ', sa prebivalištem u ' + (z.adresa || PRAZNO);
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

  function mandat(f) {
    var m = broj(get(f, 'dokumenta.mandat'));
    return m && m > 0 ? m : 4;
  }

  function godina(n) {
    var z = n % 10, zz = n % 100;
    if (z === 1 && zz !== 11) return n + ' godinu';
    if (z >= 2 && z <= 4 && (zz < 12 || zz > 14)) return n + ' godine';
    return n + ' godina';
  }

  function mjestoDatum(f) {
    var mj = get(f, 'dokumenta.mjesto') || mjestoSjedista(f);
    return { t: 'mjestoDatum', x: 'U ' + mj + ', ' + datum(get(f, 'dokumenta.datum')) };
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

  /* Provjera podataka koji nedostaju za pojedini dokument. */
  function nedostaje(f, polja) {
    var opisi = {
      naziv: 'naziv firme',
      'sjediste.mjesto': 'mjesto sjedišta',
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
    var n = polja.filter(function (p) { return !ima(get(f, p)); }).map(function (p) { return opisi[p] || p; });
    if (polja.indexOf('osnivaci') !== -1) {
      var cl = clanovi(f);
      if (!cl.length) n.push('osnivači');
      cl.forEach(function (c, i) {
        if (!ima(c.o.adresa)) n.push('adresa osnivača ' + (i + 1));
        if (c.o.tip !== 'pravno' && !ima(c.o.jmbg) && !ima(c.o.pasos)) n.push('JMBG/pasoš osnivača ' + (i + 1));
        if (c.udio == null) n.push('udio osnivača ' + (i + 1));
      });
    }
    return n;
  }

  // ---------- zajednički članovi osnivačkog akta ----------
  function clanoviAkta(f, cl, c, jedan) {
    var b = [];
    var skr = ima(f.skraceniNaziv) ? ' Skraćeni naziv Društva je: ' + f.skraceniNaziv + '.' : '';
    b.push({ t: 'clan', x: c() }, { t: 'p', x: 'Naziv Društva je: ' + (f.naziv || PRAZNO) + '.' + skr });
    b.push({ t: 'p', x: 'Sjedište Društva je: ' + adresaFirme(f) + '.' });

    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Pretežna djelatnost Društva je: ' + djelatnost(f) + '.' },
      { t: 'p', x: 'Društvo može obavljati i druge djelatnosti koje nijesu zakonom zabranjene, a djelatnosti za koje je posebnim propisom utvrđeno ispunjavanje posebnih uslova – nakon ispunjenja tih uslova.' });

    var kapital = broj(f.kapital);
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Osnovni kapital Društva iznosi ' + euro(kapital) + ' i čini ga novčani ulog ' + (jedan ? 'Osnivača' : 'Osnivača, i to:') });
    if (jedan) {
      b.push({ t: 'p', x: 'Osnivač je vlasnik udjela od 100% u osnovnom kapitalu Društva.' });
    } else {
      cl.forEach(function (x, i) {
        b.push({ t: 'stavka', x: (i + 1) + ') ' + (x.o.ime || PRAZNO) + ' – ulog u iznosu od ' + euro(x.iznos) +
          ', što čini udio od ' + (x.udio != null ? procenat(x.udio) : PRAZNO) + ' u osnovnom kapitalu Društva;' });
      });
    }
    b.push({ t: 'p', x: 'Novčani ulog uplaćuje se na račun Društva u roku i na način propisan zakonom.' });

    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Društvo za svoje obaveze odgovara cjelokupnom svojom imovinom.' },
      { t: 'p', x: (jedan ? 'Osnivač ne odgovara' : 'Članovi Društva ne odgovaraju') +
        ' za obaveze Društva, osim do iznosa neuplaćenog uloga i u drugim slučajevima propisanim zakonom.' });

    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Organi Društva su skupština i izvršni direktor.' },
      { t: 'p', x: jedan
        ? 'Ovlašćenja skupštine vrši Osnivač kao jedini član Društva, a odluke donosi u pisanoj formi.'
        : 'Skupštinu Društva čine svi članovi Društva. Svaki član ima broj glasova srazmjeran svom udjelu u osnovnom kapitalu Društva.' });

    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Za izvršnog direktora Društva imenuje se ' + opisDirektora(f.zastupnik) +
        ', na period od ' + godina(mandat(f)) + ', uz mogućnost ponovnog imenovanja.' },
      { t: 'p', x: 'Izvršni direktor zastupa Društvo u pravnom prometu sa trećim licima, bez ograničenja.' });

    if (!jedan) {
      b.push({ t: 'clan', x: c() },
        { t: 'p', x: 'Član Društva može slobodno prenijeti svoj udio, ili dio udjela, drugom članu Društva.' },
        { t: 'p', x: 'U slučaju prenosa udjela trećem licu, ostali članovi Društva imaju pravo preče kupovine srazmjerno svojim udjelima. Član koji namjerava da prenese udio dužan je da ostale članove pisanim putem obavijesti o namjeravanom prenosu i uslovima prenosa, a oni se o korišćenju prava preče kupovine izjašnjavaju u roku od 30 dana od dana prijema obavještenja.' });
    }

    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Troškove osnivanja Društva snosi ' + (jedan ? 'Osnivač' : 'svaki Osnivač srazmjerno svom udjelu') +
        ', s tim što ih Društvo može nadoknaditi nakon registracije.' });

    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Unutrašnja organizacija Društva, nadležnost i način rada organa Društva, raspodjela dobiti i druga pitanja od značaja za rad Društva bliže se uređuju Statutom Društva.' });
    return b;
  }

  // ---------- dokumenti ----------
  function odlukaOsnivanje(f) {
    var cl = clanovi(f);
    var c = brojac();
    var b = [
      { t: 'p', x: 'Na osnovu ' + ZAKON + ', osnivač ' + opisLica(cl[0] && cl[0].o) + ', donosi' },
      { t: 'razmak' },
      { t: 'naslov', x: 'ODLUKU' },
      { t: 'podnaslov', x: 'o osnivanju društva sa ograničenom odgovornošću' },
      { t: 'podnaslov', x: '„' + (f.naziv || PRAZNO) + '”' },
      { t: 'clan', x: c() },
      { t: 'p', x: 'Osnivač Društva je ' + opisLica(cl[0] && cl[0].o) + ' (u daljem tekstu: Osnivač).' },
      { t: 'p', x: 'Osnivač ovom odlukom osniva društvo sa ograničenom odgovornošću (u daljem tekstu: Društvo).' }
    ].concat(clanoviAkta(f, cl, c, true));
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Ova odluka stupa na snagu danom donošenja. Društvo stiče svojstvo pravnog lica danom registracije u Centralnom registru privrednih subjekata.' },
      { t: 'razmak' }, mjestoDatum(f), potpisiOsnivaca(cl));
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
      { t: 'p', x: 'Zaključen dana ' + datum(get(f, 'dokumenta.datum')) + ' u ' + mj + ', na osnovu ' + ZAKON + ', između:' }
    ];
    cl.forEach(function (x, i) { b.push({ t: 'stavka', x: (i + 1) + ') ' + opisLica(x.o) + ';' }); });
    b.push({ t: 'p', x: '(u daljem tekstu zajedno: Osnivači, odnosno članovi Društva).' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Osnivači ovim ugovorom osnivaju društvo sa ograničenom odgovornošću (u daljem tekstu: Društvo).' });
    b = b.concat(clanoviAkta(f, cl, c, false));
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Eventualne sporove iz ovog ugovora Osnivači će rješavati sporazumno, a ukoliko to nije moguće, nadležan je sud prema sjedištu Društva.' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Ovaj ugovor stupa na snagu danom potpisivanja od strane svih Osnivača. Sačinjen je u ' +
        (cl.length + 2) + ' istovjetnih primjeraka, od kojih svaki Osnivač zadržava po jedan, a ostali služe za potrebe registracije i Društva.' },
      { t: 'razmak' }, mjestoDatum(f), potpisiOsnivaca(cl));
    return b;
  }

  function statut(f) {
    var cl = clanovi(f);
    var jedan = cl.length <= 1;
    var c = brojac();
    var b = [];
    b.push({ t: 'p', x: 'Na osnovu ' + ZAKON + ', ' + (jedan
      ? 'osnivač ' + opisLica(cl[0] && cl[0].o) + ', donosi'
      : 'osnivači društva sa ograničenom odgovornošću „' + (f.naziv || PRAZNO) + '” donose') });
    b.push({ t: 'razmak' }, { t: 'naslov', x: 'STATUT' },
      { t: 'podnaslov', x: 'društva sa ograničenom odgovornošću' },
      { t: 'podnaslov', x: '„' + (f.naziv || PRAZNO) + '”' });

    b.push({ t: 'podnaslov', x: 'I. OSNOVNE ODREDBE' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Ovim statutom uređuju se naziv, sjedište i djelatnost društva sa ograničenom odgovornošću „' + (f.naziv || PRAZNO) +
        '” (u daljem tekstu: Društvo), osnovni kapital i udjeli, organi Društva, zastupanje, raspodjela dobiti i pokriće gubitka, prestanak Društva i druga pitanja od značaja za rad Društva.' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Naziv Društva je: ' + (f.naziv || PRAZNO) + '.' + (ima(f.skraceniNaziv) ? ' Skraćeni naziv Društva je: ' + f.skraceniNaziv + '.' : '') });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Sjedište Društva je: ' + adresaFirme(f) + '.' },
      { t: 'p', x: 'O promjeni sjedišta odlučuje skupština Društva.' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Društvo je pravno lice sa pravima, obavezama i odgovornostima utvrđenim zakonom i ovim statutom. Društvo za svoje obaveze odgovara cjelokupnom svojom imovinom.' },
      { t: 'p', x: 'Članovi Društva ne odgovaraju za obaveze Društva, osim do iznosa neuplaćenog uloga i u drugim slučajevima propisanim zakonom.' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Društvo može imati pečat. Izgled i upotrebu pečata utvrđuje izvršni direktor.' });

    b.push({ t: 'podnaslov', x: 'II. DJELATNOST DRUŠTVA' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Pretežna djelatnost Društva je: ' + djelatnost(f) + '.' },
      { t: 'p', x: 'Društvo može obavljati i druge djelatnosti koje nijesu zakonom zabranjene, a djelatnosti za koje je posebnim propisom utvrđeno ispunjavanje posebnih uslova – nakon ispunjenja tih uslova.' });

    b.push({ t: 'podnaslov', x: 'III. OSNOVNI KAPITAL I UDJELI' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Osnovni kapital Društva iznosi ' + euro(broj(f.kapital)) + ' i sastoji se od novčanih uloga članova Društva, i to:' });
    cl.forEach(function (x, i) {
      b.push({ t: 'stavka', x: (i + 1) + ') ' + (x.o.ime || PRAZNO) + ' – ' + euro(x.iznos) + ', udio ' +
        (x.udio != null ? procenat(x.udio) : PRAZNO) + ';' });
    });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'O povećanju i smanjenju osnovnog kapitala odlučuje skupština Društva, u skladu sa zakonom.' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Član Društva može slobodno prenijeti svoj udio, ili dio udjela, drugom članu Društva.' },
      { t: 'p', x: 'U slučaju prenosa udjela trećem licu, ostali članovi Društva imaju pravo preče kupovine srazmjerno svojim udjelima. Član koji namjerava da prenese udio dužan je da ostale članove pisanim putem obavijesti o namjeravanom prenosu i uslovima prenosa, a oni se o korišćenju prava preče kupovine izjašnjavaju u roku od 30 dana od dana prijema obavještenja. Ako u tom roku ne iskoriste pravo preče kupovine, udio se može prenijeti trećem licu pod uslovima koji nijesu povoljniji od ponuđenih članovima.' },
      { t: 'p', x: 'Udio se nasljeđuje u skladu sa zakonom.' });

    b.push({ t: 'podnaslov', x: 'IV. ORGANI DRUŠTVA' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Organi Društva su skupština i izvršni direktor.' },
      { t: 'p', x: 'Društvo nema odbor direktora. Skupština može izmjenom ovog statuta uvesti odbor direktora.' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Skupštinu čine svi članovi Društva. Skupština odlučuje o:' });
    ['izmjenama i dopunama statuta;',
      'povećanju i smanjenju osnovnog kapitala;',
      'imenovanju i razrješenju izvršnog direktora i utvrđivanju njegove naknade;',
      'usvajanju godišnjih finansijskih iskaza i izvještaja o poslovanju;',
      'raspodjeli dobiti i pokriću gubitka;',
      'statusnim promjenama i promjeni pravne forme;',
      'sticanju i raspolaganju imovinom velike vrijednosti, u skladu sa zakonom;',
      'prestanku Društva;',
      'drugim pitanjima utvrđenim zakonom i ovim statutom.'
    ].forEach(function (s, i) { b.push({ t: 'stavka', x: (i + 1) + ') ' + s }); });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Svaki član Društva ima broj glasova srazmjeran svom udjelu u osnovnom kapitalu Društva.' },
      { t: 'p', x: 'Skupština odluke donosi većinom glasova svih članova, osim odluka o izmjenama statuta, promjeni osnovnog kapitala, statusnim promjenama i prestanku Društva, koje se donose dvotrećinskom većinom glasova svih članova, ako zakonom nije propisana veća većina.' },
      { t: 'p', x: 'Ako Društvo ima jednog člana, taj član vrši sva ovlašćenja skupštine, a odluke donosi u pisanoj formi i čuva ih u knjizi odluka.' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Izvršnog direktora imenuje i razrješava skupština, na period od ' + godina(mandat(f)) + ', uz mogućnost ponovnog imenovanja.' },
      { t: 'p', x: 'Izvršni direktor organizuje i vodi poslovanje Društva, sprovodi odluke skupštine, zaključuje ugovore i preduzima druge pravne radnje u ime i za račun Društva, stara se o vođenju poslovnih knjiga i sastavljanju finansijskih iskaza, i odlučuje o svim pitanjima koja zakonom ili ovim statutom nijesu stavljena u nadležnost skupštine.' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Društvo zastupa izvršni direktor, bez ograničenja.' },
      { t: 'p', x: 'Izvršni direktor može, u granicama svojih ovlašćenja, dati pisano punomoćje drugom licu za zastupanje Društva.' });

    b.push({ t: 'podnaslov', x: 'V. DOBIT I GUBITAK' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Dobit Društva raspoređuje se odlukom skupštine, nakon usvajanja godišnjih finansijskih iskaza. Dobit namijenjena za isplatu članovima raspoređuje se srazmjerno njihovim udjelima.' },
      { t: 'p', x: 'Gubitak Društva pokriva se na način utvrđen odlukom skupštine, u skladu sa zakonom.' });

    b.push({ t: 'podnaslov', x: 'VI. PRAVO NA INFORMISANJE I POSLOVNA TAJNA' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Član Društva ima pravo uvida u poslovne knjige, odluke i druga dokumenta Društva, u skladu sa zakonom.' },
      { t: 'p', x: 'Poslovnom tajnom smatraju se podaci i dokumenta koje kao takve odredi izvršni direktor. Članovi Društva i zaposleni dužni su da čuvaju poslovnu tajnu.' });

    b.push({ t: 'podnaslov', x: 'VII. PRESTANAK DRUŠTVA' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Društvo prestaje u slučajevima i po postupku propisanom zakonom.' });

    b.push({ t: 'podnaslov', x: 'VIII. ZAVRŠNE ODREDBE' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Izmjene i dopune ovog statuta vrše se na način i po postupku propisanom za njegovo donošenje.' },
      { t: 'p', x: 'Na pitanja koja nijesu uređena ovim statutom neposredno se primjenjuju odredbe zakona.' });
    b.push({ t: 'clan', x: c() },
      { t: 'p', x: 'Ovaj statut stupa na snagu danom donošenja, a primjenjuje se od dana registracije Društva u Centralnom registru privrednih subjekata.' },
      { t: 'razmak' }, mjestoDatum(f), potpisiOsnivaca(cl));
    return b;
  }

  function odlukaDirektor(f) {
    var cl = clanovi(f);
    var jedan = cl.length <= 1;
    var donosilac = jedan
      ? 'osnivač i jedini član Društva ' + ((cl[0] && cl[0].o.ime) || PRAZNO)
      : 'skupština Društva';
    var z = f.zastupnik || {};
    return [
      { t: 'p', x: 'Na osnovu ' + ZAKON + ' i Statuta društva „' + (f.naziv || PRAZNO) + '”, ' + donosilac +
        ', dana ' + datum(get(f, 'dokumenta.datum')) + ', donosi' },
      { t: 'razmak' },
      { t: 'naslov', x: 'ODLUKU' },
      { t: 'podnaslov', x: 'o imenovanju izvršnog direktora' },
      { t: 'clan', x: 'I' },
      { t: 'p', x: 'Za izvršnog direktora društva „' + (f.naziv || PRAZNO) + '”, sa sjedištem u ' + adresaFirme(f) +
        ', imenuje se ' + opisDirektora(z) + '.' },
      { t: 'clan', x: 'II' },
      { t: 'p', x: 'Izvršni direktor se imenuje na period od ' + godina(mandat(f)) + ', počev od dana donošenja ove odluke.' },
      { t: 'clan', x: 'III' },
      { t: 'p', x: 'Izvršni direktor zastupa Društvo u pravnom prometu sa trećim licima, bez ograničenja, i ima prava i obaveze utvrđene zakonom i Statutom Društva.' },
      { t: 'clan', x: 'IV' },
      { t: 'p', x: 'Ova odluka stupa na snagu danom donošenja i dostavlja se Centralnom registru privrednih subjekata i Poreskoj upravi radi upisa.' },
      { t: 'razmak' }, mjestoDatum(f),
      jedan ? potpisiOsnivaca(cl) : { t: 'potpisi', lista: cl.map(function (x) { return { uloga: 'Član Društva', ime: x.o.ime }; }) }
    ];
  }

  function izjavaDirektor(f) {
    var z = f.zastupnik || {};
    return [
      { t: 'naslov', x: 'IZJAVA' },
      { t: 'podnaslov', x: 'o prihvatanju imenovanja za izvršnog direktora' },
      { t: 'razmak' },
      { t: 'p', x: 'Ja, ' + opisDirektora(z) + ', izjavljujem da prihvatam imenovanje za izvršnog direktora društva „' +
        (f.naziv || PRAZNO) + '”, sa sjedištem u ' + adresaFirme(f) + '.' },
      { t: 'p', x: 'Izjavljujem da ispunjavam uslove propisane zakonom i Statutom Društva za obavljanje funkcije izvršnog direktora i da ne postoje zakonske smetnje za moje imenovanje.' },
      { t: 'p', x: 'Izjavu dajem pod punom materijalnom i krivičnom odgovornošću, radi registracije Društva i upisa podataka o licu ovlašćenom za zastupanje.' },
      { t: 'razmak' }, mjestoDatum(f),
      { t: 'potpisi', lista: [{ uloga: 'Davalac izjave', ime: z.ime || PRAZNO }] }
    ];
  }

  function ovlascenje(f) {
    var p = f.punomocnik || {};
    var z = f.zastupnik || {};
    var pib = ima(f.pib) ? ', PIB ' + f.pib : '';
    return [
      { t: 'naslov', x: 'OVLAŠĆENJE' },
      { t: 'razmak' },
      { t: 'p', x: (f.naziv || PRAZNO) + ', sa sjedištem u ' + adresaFirme(f) + pib +
        ', koje zastupa izvršni direktor ' + (z.ime || PRAZNO) + ' (u daljem tekstu: Vlastodavac), ovim ovlašćuje' },
      { t: 'p', x: (p.ime || PRAZNO) + ', JMBG ' + (p.jmbg || PRAZNO) + ', sa prebivalištem u ' + (p.adresa || PRAZNO) +
        ' (u daljem tekstu: Punomoćnik),' },
      { t: 'p', x: 'da u ime i za račun Vlastodavca preduzima sve radnje pred Poreskom upravom Crne Gore, uključujući registraciju i upis u registar poreskih obveznika, registraciju za PDV, podnošenje zahtjeva, prijava i drugih podnesaka putem portala IRMS, prijem akata i davanje izjava, kao i pred Centralnim registrom privrednih subjekata i poslovnim bankama radi otvaranja računa, ukoliko je to potrebno za registraciju.' },
      { t: 'p', x: 'Ovlašćenje važi do opoziva.' },
      { t: 'razmak' }, mjestoDatum(f),
      { t: 'potpisi', lista: [{ uloga: 'Za Vlastodavca – izvršni direktor', ime: z.ime || PRAZNO }] }
    ];
  }

  /*
   * Lista dokumenata za firmu: [{id, naziv, dostupan, razlog, nedostaje[], blokovi}]
   */
  function zaFirmu(f) {
    f = f || {};
    var doo = /\(DOO\)|ograničenom odgovornošću/i.test(f.pravniOblik || '');
    var preduzetnik = f.pravniOblik === 'Preduzetnik';
    var cl = clanovi(f);
    var viseClanova = cl.length > 1;
    var samoDoo = 'Opšti model postoji samo za DOO';
    var osnovna = ['naziv', 'sjediste.mjesto', 'sjediste.ulica', 'dokumenta.datum'];
    var direktor = ['zastupnik.ime', 'zastupnik.jmbg', 'zastupnik.adresa'];

    var lista = [
      viseClanova
        ? { id: 'ugovor-o-osnivanju', naziv: 'Ugovor o osnivanju', dostupan: doo, razlog: samoDoo,
          polja: osnovna.concat(['sifraDjelatnosti', 'kapital', 'osnivaci'], direktor), fn: ugovorOsnivanje }
        : { id: 'odluka-o-osnivanju', naziv: 'Odluka o osnivanju', dostupan: doo, razlog: samoDoo,
          polja: osnovna.concat(['sifraDjelatnosti', 'kapital', 'osnivaci'], direktor), fn: odlukaOsnivanje },
      { id: 'statut', naziv: 'Statut', dostupan: doo, razlog: samoDoo,
        polja: osnovna.concat(['sifraDjelatnosti', 'kapital', 'osnivaci']), fn: statut },
      { id: 'odluka-o-imenovanju-direktora', naziv: 'Odluka o imenovanju izvršnog direktora', dostupan: !preduzetnik,
        razlog: 'Preduzetnik nema izvršnog direktora', polja: osnovna.concat(direktor), fn: odlukaDirektor },
      { id: 'izjava-direktora', naziv: 'Izjava direktora o prihvatanju imenovanja', dostupan: !preduzetnik,
        razlog: 'Preduzetnik nema izvršnog direktora', polja: osnovna.concat(direktor), fn: izjavaDirektor },
      { id: 'ovlascenje', naziv: 'Ovlašćenje za zastupanje pred Poreskom upravom', dostupan: true,
        polja: osnovna.concat(['zastupnik.ime', 'punomocnik.ime', 'punomocnik.jmbg']), fn: ovlascenje }
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
    zaFirmu: zaFirmu,
    uHTML: uHTML,
    dokumentHTML: dokumentHTML,
    uDocx: uDocx,
    documentXML: documentXML,
    _: { euro: euro, godina: godina, clanovi: clanovi, crc32: crc32 }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Dokumenti = api;
})(this);
