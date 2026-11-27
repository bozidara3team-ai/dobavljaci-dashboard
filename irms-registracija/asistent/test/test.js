'use strict';
/* Testovi: validacija (app) + popunjavanje lažnog formulara (asistent). */
const assert = require('assert');
const path = require('path');
const V = require('../../app/validacija.js');
const P = require('../popunjavanje');

let prosli = 0;
async function t(ime, fn) {
  try { await fn(); prosli++; console.log('  ✓ ' + ime); }
  catch (e) { console.error('  ✗ ' + ime + '\n    ' + e.message); process.exitCode = 1; }
}

const FIRMA = {
  naziv: 'Test Solutions DOO Podgorica',
  skraceniNaziv: 'Test Solutions DOO',
  pravniOblik: 'Društvo sa ograničenom odgovornošću (DOO)',
  pib: '03123456',
  registarskiBroj: '5-0123456/001',
  datumOsnivanja: '2026-10-01',
  sifraDjelatnosti: '62.01',
  sjediste: { opstina: 'Podgorica', mjesto: 'Podgorica', ulica: 'Bulevar Svetog Petra Cetinjskog', broj: '1', postanskiBroj: '81000' },
  email: 'info@primjer.me',
  telefon: '+382 20 000 000',
  kapital: '1000',
  osnivaci: [
    { tip: 'fizicko', ime: 'Marko Marković', jmbg: '1503985210000', udio: '60', adresa: 'Podgorica, Njegoševa 1' },
    { tip: 'fizicko', ime: 'Ana Anić', jmbg: '0101980215009', udio: '40', adresa: 'Podgorica, Slobode 2' }
  ],
  zastupnik: { ime: 'Marko Marković', jmbg: '1503985210000', adresa: 'Podgorica, Njegoševa 1' },
  racuni: [{ banka: 'NLB Banka', broj: '510-0000123456789-20' }],
  pdvObveznik: 'da',
  pdvDatum: '2026-11-01'
};

(async () => {
  console.log('Validacija');
  await t('ispravan JMBG prolazi', () => assert.strictEqual(V.provjeriJMBG('1503985210000'), null));
  await t('pogrešna kontrolna cifra JMBG', () => assert.match(V.provjeriJMBG('1503985210001'), /kontrolnu/));
  await t('JMBG sa nemogućim datumom', () => assert.ok(V.provjeriJMBG('3102985210000')));
  await t('PIB mora imati 8 cifara', () => { assert.strictEqual(V.provjeriPIB('03123456'), null); assert.ok(V.provjeriPIB('123')); });
  await t('račun: kontrolni broj', () => {
    assert.strictEqual(V.provjeriRacun('510-0000123456789-20'), null);
    assert.strictEqual(V.provjeriRacun('510-123456789-20'), null);
    assert.ok(V.provjeriRacun('510-0000123456789-21'));
    assert.strictEqual(V.formatirajRacun('510-123456789-20'), '510-0000123456789-20');
  });
  await t('kompletna firma nema grešaka', () => assert.deepStrictEqual(V.provjeriFirmu(FIRMA).errors, []));
  await t('prazna firma ima obavezna polja', () => {
    const p = V.provjeriFirmu({});
    ['naziv', 'pravniOblik', 'sjediste.opstina', 'sifraDjelatnosti', 'email', 'osnivaci', 'zastupnik.ime']
      .forEach((k) => assert.ok(p.errors.some((e) => e.polje === k), 'nedostaje greška za ' + k));
  });
  await t('zbir udjela mora biti 100%', () => {
    const f = JSON.parse(JSON.stringify(FIRMA));
    f.osnivaci[1].udio = '30';
    assert.ok(V.provjeriFirmu(f).errors.some((e) => /100%/.test(e.poruka)));
  });
  await t('stranac: podaci o pasošu po članu 362', () => {
    const f = JSON.parse(JSON.stringify(FIRMA));
    f.osnivaci[1] = { tip: 'fizicko', ime: 'John Smith', drzavljanstvo: 'Ujedinjeno Kraljevstvo', udio: '40' };
    const polja = V.provjeriFirmu(f).errors.map((e) => e.polje);
    ['pasos', 'pasosIzdat', 'pasosVazi', 'datumRodjenja', 'adresa'].forEach((k) => assert.ok(polja.includes('osnivaci.1.' + k), k));
    Object.assign(f.osnivaci[1], { pasos: 'X1234567', pasosIzdat: '2020-01-10', pasosVazi: '2030-01-09', datumRodjenja: '1985-05-05', adresa: 'Budva, Mediteranska 3' });
    assert.deepStrictEqual(V.provjeriFirmu(f).errors, []);
    f.osnivaci[1].pasosVazi = '2024-01-01';
    assert.ok(V.provjeriFirmu(f).errors.some((e) => /istekao/.test(e.poruka)));
  });
  await t('poslovno ime: oznaka DOO i sjedište (član 23)', () => {
    const greske = (naziv, skr) => V.provjeriFirmu(Object.assign({}, FIRMA, { naziv, skraceniNaziv: skr || '' }))
      .errors.filter((e) => e.polje === 'naziv' || e.polje === 'skraceniNaziv').length;
    assert.strictEqual(greske('Test Solutions DOO Podgorica'), 0);
    assert.strictEqual(greske('Test Solutions d.o.o. Podgorica'), 0);
    assert.strictEqual(greske('Društvo sa ograničenom odgovornošću Test Solutions, Podgorica'), 0);
    assert.strictEqual(greske('Test Solutions Podgorica'), 1);
    assert.strictEqual(greske('Test Solutions DOO'), 1);
    assert.strictEqual(greske('Test Solutions DOO Podgorica', 'Test Solutions'), 1);
  });
  await t('poslovno ime preduzetnika: ime i prezime, sjedište, PR (član 85)', () => {
    const f = { pravniOblik: 'Preduzetnik', sjediste: { opstina: 'Kolašin', mjesto: 'Kolašin' }, osnivaci: [{ tip: 'fizicko', ime: 'Milica Marić' }] };
    const g = (naziv) => V.provjeriFirmu(Object.assign({}, f, { naziv })).errors.filter((e) => e.polje === 'naziv').length;
    assert.strictEqual(g('Milica Marić PR Kafe Tara Kolašin'), 0);
    assert.strictEqual(g('Kafe Tara PR Kolašin'), 1);
  });
  await t('kapital DOO najmanje 1 € (član 361)', () => {
    const g = (kapital) => V.provjeriFirmu(Object.assign({}, FIRMA, { kapital })).errors.some((e) => e.polje === 'kapital');
    assert.ok(g(''));
    assert.ok(g('0,50'));
    assert.ok(!g('1'));
  });
  await t('DOO najviše 30 članova (član 358)', () => {
    const osnivaci = Array.from({ length: 31 }, () => ({ tip: 'fizicko', ime: 'A B', jmbg: '1503985210000', adresa: 'X' }));
    assert.ok(V.provjeriFirmu(Object.assign({}, FIRMA, { osnivaci })).errors.some((e) => /30 članova/.test(e.poruka)));
  });
  await t('nadoknada troškova osnivanja traži iznos (čl. 362 i 365)', () => {
    const f = Object.assign({}, FIRMA, { dokumenta: { nadoknada: 'da' } });
    assert.ok(V.provjeriFirmu(f).errors.some((e) => e.polje === 'dokumenta.troskovi'));
    f.dokumenta.troskovi = '300';
    assert.ok(!V.provjeriFirmu(f).errors.some((e) => e.polje === 'dokumenta.troskovi'));
  });

  console.log('Osnivačka dokumenta (šabloni po tekstovima klijenta)');
  const D = require('../../app/dokumenti.js');
  const tekst = (d) => d.blokovi.map((b) => {
    if (b.t === 'tabela') return [].concat(b.zaglavlje ? [b.zaglavlje.join(' | ')] : [], b.redovi.map((r) => r.join(' | '))).join('\n');
    if (b.t === 'potpisi') return b.lista.map((p) => p.uloga + ' ' + p.ime).join('\n');
    return b.x + (b.naslov ? '\n' + b.naslov : '');
  }).join('\n');
  // Izmišljeni podaci po strukturi dostavljenih dokumenata
  const PS = {
    naziv: 'Primjer društvo sa ograničenom odgovornošću Bar, Crna Gora', skraceniNaziv: 'Primjer d.o.o., Bar, Crna Gora',
    pravniOblik: 'Društvo sa ograničenom odgovornošću (DOO)',
    sjediste: { opstina: 'Bar', mjesto: 'Bar', ulica: 'Ulica Primjera', broj: '2a' },
    sifraDjelatnosti: '6391', opisDjelatnosti: 'Djelatnosti internet portala', kapital: '1', email: 'info@primjer.example',
    osnivaci: [{ tip: 'fizicko', ime: 'Petar Petrović', jmbg: '1503985210000', drzavljanstvo: 'Crna Gora', adresa: 'Ulica Primjera 2a, Bar, Crna Gora', udio: '100' }],
    zastupnik: { ime: 'Jovana Jovanović', jmbg: '0101980215009', adresa: 'Ulica Primjera 2a, Bar', drzavljanstvo: 'Crnogorsko', licnaKarta: 'LK0000000' },
    dokumenta: { mjesto: 'Bar', datum: '2026-06-04' }
  };
  const dok = (f, id) => D.zaFirmu(f).find((d) => d.id === id);
  await t('svi šabloni dostupni i kompletni', () => {
    ['odluka-o-osnivanju', 'statut', 'odluka-o-imenovanju-direktora', 'izjava-direktora'].forEach((id) => {
      const d = dok(PS, id);
      assert.ok(d && d.dostupan, id);
      assert.deepStrictEqual(d.nedostaje, [], id);
    });
  });
  await t('odluka o osnivanju: tekst klijenta sa podacima', () => {
    const x = tekst(dok(PS, 'odluka-o-osnivanju'));
    assert.match(x, /^OSNIVAČKI AKT$/m);
    assert.match(x, /^PRIMJER D\.O\.O\., BAR, CRNA GORA$/m);
    assert.match(x, /osnivač Petar Petrović, JMBG 1503985210000, sa prebivalištem\/boravištem na adresi Ulica Primjera 2a, Bar, Crna Gora donosi sljedeću:/);
    assert.match(x, /Osniva se društvo sa ograničenom odgovornošću pod poslovnim imenom: Primjer društvo sa ograničenom odgovornošću Bar, Crna Gora\./);
    assert.match(x, /Član 3\nSjedište društva\nSjedište društva je u Baru, na adresi Ulica Primjera 2a\./);
    assert.match(x, /Pretežna djelatnost društva je: 6391 – Djelatnosti internet portala\./);
    assert.match(x, /Osnovni kapital društva iznosi 1,00 EUR\./);
    assert.match(x, /Ime i prezime \| Petar Petrović\nIdentifikacioni podatak \| 1503985210000\nAdresa \| Ulica Primjera 2a, Bar, Crna Gora\nIznos novčanog uloga \| 1,00 EUR\nUdio u društvu \| 100%/);
    assert.match(x, /Za izvršnog direktora društva imenuje se Jovana Jovanović\./);
    assert.match(x, /Član 12\nZavršne odredbe/);
    assert.match(x, /U Baru, dana 04\.06\.2026\. godine\nOSNIVAČ: Petar Petrović/);
  });
  await t('statut: tekst klijenta, tabela udjela i zastupanje', () => {
    const x = tekst(dok(PS, 'statut'));
    assert.match(x, /Puno poslovno ime društva glasi: Primjer društvo sa ograničenom odgovornošću Bar, Crna Gora\./);
    assert.match(x, /Red\. br\. \| Član društva \| Iznos uloga \(EUR\) \| Udio u osnovnom kapitalu \(%\)\n1\. \| PETAR PETROVIĆ \| 1,00 \| 100/);
    assert.match(x, /Član 14\nIzvršni direktor\nDruštvo ima jednog izvršnog direktora/);
    assert.match(x, /Izvršni direktor društva je: Jovana Jovanović\./);
    assert.match(x, /Mandat izvršnog direktora traje do razrješenja/);
    assert.match(x, /Društvo zastupa i predstavlja izvršni direktor JOVANA JOVANOVIĆ, JMBG 0101980215009, adresa prebivališta: Ulica Primjera 2a, Bar, samostalno i sa neograničenim ovlašćenjima\. U saglasnosti sa Osnivačem/);
    assert.match(x, /dvotrećinsku većinu glasačkih prava/);
    assert.match(x, /Član 21\nStupanje na snagu/);
    assert.match(x, /Za društvo \/ osnivač: Petar Petrović, osnivač/);
  });
  await t('odluka o imenovanju izvršnog direktora', () => {
    const x = tekst(dok(PS, 'odluka-o-imenovanju-direktora'));
    assert.match(x, /^ODLUKA O IMENOVANJU IZVRŠNOG DIREKTORA$/m);
    assert.match(x, /jedini osnivač i član društva Petar Petrović donosi sljedeću:/);
    assert.match(x, /Jovana Jovanović, JMBG 0101980215009, sa prebivalištem\/boravištem na adresi Ulica Primjera 2a, Bar\./);
    assert.match(x, /Izvršni direktor se imenuje na mandat koji traje do razrješenja, osim ako posebnom odlukom jedinog člana društva/);
    assert.match(x, /Izvršni direktor zastupa društvo samostalno i bez ograničenja\./);
    assert.match(x, /JEDINI OSNIVAČ \/ ČLAN DRUŠTVA: Petar Petrović/);
    assert.ok(!/Razrješenje/.test(x));
  });
  await t('odluka o imenovanju: mandat i razrješenje dosadašnjeg', () => {
    const f = JSON.parse(JSON.stringify(PS));
    f.dokumenta.mandat = '4';
    f.dokumenta.prethodniDirektor = 'Petar Petrović';
    const x = tekst(dok(f, 'odluka-o-imenovanju-direktora'));
    assert.match(x, /Član 1\nRazrješenje\nPetar Petrović razrješava se dužnosti izvršnog direktora/);
    assert.match(x, /na mandat od 4 godine/);
    assert.match(x, /Ova odluka stupa na snagu danom potpisivanja\.$/m);
    assert.strictEqual(D._.godina(1), '1 godinu');
    assert.strictEqual(D._.godina(5), '5 godina');
  });
  await t('saglasnost (izjava) izvršnog direktora', () => {
    const x = tekst(dok(PS, 'izjava-direktora'));
    assert.match(x, /^SAGLASNOST ZA IMENOVANJE IZVRŠNOG DIREKTORA$/m);
    assert.match(x, /Ime i prezime \| Jovana Jovanović\nJMBG \/ broj pasoša \| 0101980215009\nAdresa prebivališta \| Ulica Primjera 2a, Bar\nDržavljanstvo \| Crnogorsko\nBroj lične karte \/ pasoša \| LK0000000/);
    assert.match(x, /dajem saglasnost da budem imenovan\/a za Izvršnog direktora privrednog društva:/);
    assert.match(x, /sa sjedištem na adresi: Ulica Primjera 2a, koje se osniva/);
    assert.match(x, /U Baru, dana 04\.06\.2026\. godine\./);
    assert.match(x, /Davalac saglasnosti: JOVANA JOVANOVIĆ/);
  });
  await t('mjesto u lokativu, a nepoznato mjesto bez pogrešnog padeža', () => {
    const f = JSON.parse(JSON.stringify(PS));
    f.sjediste = { opstina: 'Herceg Novi', mjesto: 'Herceg Novi', ulica: 'Njegoševa', broj: '1' };
    f.dokumenta.mjesto = '';
    assert.match(tekst(dok(f, 'statut')), /Sjedište društva je u Herceg Novom, na adresi Njegoševa 1\./);
    f.sjediste.mjesto = 'Baošići';
    assert.match(tekst(dok(f, 'statut')), /Sjedište društva je u mjestu Baošići, na adresi Njegoševa 1\./);
  });
  await t('više osnivača: ugovor o osnivanju i statut sa skupštinom', () => {
    const f = Object.assign(JSON.parse(JSON.stringify(FIRMA)), { dokumenta: { mjesto: 'Podgorica', datum: '2026-11-15' } });
    assert.ok(!dok(f, 'odluka-o-osnivanju'));
    const u = dok(f, 'ugovor-o-osnivanju');
    assert.ok(u.dostupan);
    assert.match(tekst(u), /Marko Marković – ukupan iznos novčanog uloga 600,00 €, udio u osnovnom kapitalu Društva 60%/);
    assert.match(tekst(u), /Organi Društva su skupština i izvršni direktor/);
    const s = tekst(dok(f, 'statut'));
    assert.match(s, /osnivači društva usvajaju sljedeći:/);
    assert.match(s, /1\. \| MARKO MARKOVIĆ \| 600,00 \| 60\n2\. \| ANA ANIĆ \| 400,00 \| 40/);
    assert.match(s, /Uz saglasnost skupštine društva, izvršni direktor može/);
    assert.match(tekst(dok(f, 'odluka-o-imenovanju-direktora')), /Ugovora o osnivanju društva i Statuta društva .*, skupština društva donosi sljedeću:/);
  });
  await t('stranac kao osnivač: podaci o pasošu', () => {
    const o = { tip: 'fizicko', ime: 'John Smith', drzavljanstvo: 'Ujedinjeno Kraljevstvo', pasos: 'X1234567', pasosIzdat: '2020-01-10', pasosVazi: '2030-01-09', datumRodjenja: '1985-05-05', adresa: 'Budva' };
    const f = Object.assign(JSON.parse(JSON.stringify(PS)), { osnivaci: [Object.assign({ udio: '100' }, o)] });
    assert.match(tekst(dok(f, 'odluka-o-osnivanju')), /osnivač John Smith, broj pasoša X1234567, izdat 10\.01\.2020\., važi do 09\.01\.2030\., država izdavanja Ujedinjeno Kraljevstvo, datum rođenja 05\.05\.1985\., sa prebivalištem\/boravištem na adresi Budva/);
  });
  await t('nedostajući podaci se prijavljuju i ostaje prazna linija', () => {
    const s = dok({ naziv: 'X DOO', pravniOblik: 'Društvo sa ograničenom odgovornošću (DOO)' }, 'statut');
    assert.ok(s.nedostaje.includes('osnovni kapital'));
    assert.match(tekst(s), /______________ EUR/);
    assert.ok(dok({ naziv: 'X', pravniOblik: 'Društvo sa ograničenom odgovornošću (DOO)' }, 'izjava-direktora').nedostaje.includes('broj lične karte / pasoša izvršnog direktora'));
  });
  await t('preduzetnik nema statut ni izvršnog direktora', () => {
    const docs = D.zaFirmu({ naziv: 'Y', pravniOblik: 'Preduzetnik' });
    assert.ok(!docs.find((d) => d.id === 'statut').dostupan);
    assert.ok(!docs.find((d) => d.id === 'odluka-o-imenovanju-direktora').dostupan);
    assert.ok(docs.find((d) => d.id === 'ovlascenje').dostupan);
  });
  await t('docx (sa tabelama) se otvara u Word formatu', () => {
    const fs = require('fs'), os = require('os'), cp = require('child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-'));
    const dostupni = D.zaFirmu(PS).filter((d) => d.dostupan);
    dostupni.forEach((d) => fs.writeFileSync(path.join(dir, d.id + '.docx'), Buffer.from(D.uDocx(d.blokovi))));
    const out = cp.execFileSync('python3', ['-c', `
import sys, glob, zipfile, docx
for f in sorted(glob.glob(sys.argv[1] + '/*.docx')):
    assert zipfile.ZipFile(f).testzip() is None
    d = docx.Document(f)
    print(f.split('/')[-1], len(d.paragraphs), len(d.tables))
`, dir]).toString();
    const linije = out.trim().split('\n');
    assert.strictEqual(linije.length, dostupni.length, out);
    assert.ok(linije.some((l) => /^statut\.docx \d+ 2$/.test(l)), out);
    process.env.DOCX_DIR = dir;
  });

  console.log('Asistent – logika');
  await t('formatiranje datuma', () => assert.strictEqual(P.formatiraj('2026-10-01', 'dd.mm.yyyy'), '01.10.2026'));
  await t('mapiranje vrijednosti', () => assert.strictEqual(P.vrijednost({ a: 'x' }, { izvor: 'a', mapiranje: { x: 'Iks' } }), 'Iks'));
  await t('primjer mape je ispravan', () => assert.deepStrictEqual(P.provjeriMapu(require('../mapa-polja.primjer.json')), []));
  await t('mapa sa dugmetom za podnošenje se odbija', () => {
    const p = P.provjeriMapu({ koraci: [{ zaSvaki: 'x', prijeSvakog: { dugme: 'Podnesi' }, polja: [{ izvor: 'a', labela: 'A' }] }] });
    assert.ok(p.some((s) => /podnošenje/.test(s)));
  });

  console.log('Asistent – lažni formular u pregledaču');
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { console.log('  (preskočeno – playwright nije instaliran)'); return kraj(); }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.join(__dirname, 'lazni-formular.html'));
  const mapa = require('../mapa-polja.primjer.json');
  const izv = [];
  for (const k of mapa.koraci.filter((k) => !['Ovlašćeno lice', 'Bankovni računi'].includes(k.naziv))) {
    izv.push(...await P.popuniKorak(page, k, FIRMA));
  }
  const v = (s) => page.inputValue(s);
  await t('osnovna polja popunjena', async () => {
    assert.strictEqual(await v('#naziv'), FIRMA.naziv);
    assert.strictEqual(await v('#skr'), 'Test Solutions DOO');
    assert.strictEqual(await v('#dat'), '01.10.2026');
    assert.strictEqual(await page.$eval('#pf', (s) => s.selectedOptions[0].text), 'Društvo sa ograničenom odgovornošću');
    assert.strictEqual(await page.$eval('#op', (s) => s.value), 'Podgorica');
    assert.strictEqual(await v('#ul'), FIRMA.sjediste.ulica);
    assert.strictEqual(await v('#em'), FIRMA.email);
    assert.ok(await page.isChecked('#pdv'));
  });
  await t('osnivači – dodat red za drugog i popunjen', async () => {
    assert.deepStrictEqual(await page.$$eval('.o-ime', (a) => a.map((x) => x.value)), ['Marko Marković', 'Ana Anić']);
    assert.deepStrictEqual(await page.$$eval('.o-udio', (a) => a.map((x) => x.value)), ['60', '40']);
  });
  await t('zahtjev NIJE podnesen', async () => assert.ok(!(await page.evaluate(() => window.podneseno))));
  await t('snimanje polja pronalazi labele', async () => {
    const s = await P.snimiPolja(page);
    const labele = s[0].polja.map((f) => f.labela);
    assert.ok(labele.includes('Pravni oblik') && labele.some((l) => l.startsWith('Naziv')));
  });
  const nenadjeno = izv.filter((r) => r.status !== 'ok' && r.status !== 'prazno');
  await t('sva mapirana polja nađena', () => assert.deepStrictEqual(nenadjeno, []));
  await browser.close();
  kraj();
})();

function kraj() { console.log(`\n${prosli} testova prošlo` + (process.exitCode ? ' (ima neuspjelih)' : '')); }
