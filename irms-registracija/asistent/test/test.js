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

  console.log('Osnivačka dokumenta');
  const D = require('../../app/dokumenti.js');
  const tekst = (d) => d.blokovi.map((b) => b.x || (b.lista || []).map((p) => p.ime).join(' ')).join('\n');
  const FD = Object.assign(JSON.parse(JSON.stringify(FIRMA)), {
    opisDjelatnosti: 'Računarsko programiranje',
    dokumenta: { mjesto: 'Podgorica', datum: '2026-11-15', mandat: '4' },
    punomocnik: { ime: 'Jelena Jelić', jmbg: '0101980215009', adresa: 'Podgorica' }
  });
  const sviTekstovi = (f) => D.zaFirmu(f).filter((d) => d.dostupan).map(tekst).join('\n');
  await t('dva osnivača → ugovor o osnivanju sa iznosima uloga', () => {
    const docs = D.zaFirmu(FD);
    const u = docs.find((d) => d.id === 'ugovor-o-osnivanju');
    assert.ok(u && u.dostupan);
    assert.deepStrictEqual(u.nedostaje, []);
    const x = tekst(u);
    assert.match(x, /Marko Marković – ukupan iznos novčanog uloga 600,00 €, udio u osnovnom kapitalu Društva 60%/);
    assert.match(x, /Ana Anić – ukupan iznos novčanog uloga 400,00 €, udio u osnovnom kapitalu Društva 40%/);
    assert.match(x, /Marko Marković, JMBG 1503985210000, adresa prebivališta: Podgorica, Njegoševa 1/);
    assert.match(x, /uplate u cjelosti|uplati u cjelosti/);
    assert.match(x, /potpisi svih osnivača ovjeravaju se/);
    assert.match(x, /ne može se mijenjati nakon registracije/);
    assert.match(x, /Troškove osnivanja Društva snosi osnivači srazmjerno|snose osnivači|osnivači srazmjerno svojim udjelima/);
    assert.match(x, /90\/25, 121\/25 i 44\/26/);
    assert.match(x, /15\.11\.2026\. godine/);
  });
  await t('statut: obavezni elementi iz člana 363', () => {
    const s = tekst(D.zaFirmu(FD).find((d) => d.id === 'statut'));
    assert.match(s, /Poslovno ime Društva je: Test Solutions DOO Podgorica/);
    assert.match(s, /Sjedište Društva je: Opština Podgorica/);
    assert.match(s, /Marko Marković – 60%/);
    assert.match(s, /najkasnije osam dana prije dana održavanja sjednice/);
    assert.match(s, /više od polovine ukupnog broja glasova/);
    assert.match(s, /dvotrećinsku većinu glasačkih prava/);
    assert.match(s, /u roku od 30 dana od dana prijema ponude/);
    assert.match(s, /Za prvog direktora Društva imenuje se Marko Marković/);
  });
  await t('nigdje „izvršni direktor” ni stari zakon', () => {
    const x = sviTekstovi(FD);
    assert.ok(!/izvršn/i.test(x));
    assert.ok(!/65\/20|146\/21/.test(x));
  });
  await t('stranac u osnivačkom aktu: podaci o pasošu', () => {
    const o = { tip: 'fizicko', ime: 'John Smith', drzavljanstvo: 'Ujedinjeno Kraljevstvo', pasos: 'X1234567', pasosIzdat: '2020-01-10', pasosVazi: '2030-01-09', datumRodjenja: '1985-05-05', adresa: 'Budva' };
    assert.strictEqual(D._.opisLica(o), 'John Smith, broj pasoša X1234567, datum izdavanja pasoša 10.01.2020., pasoš važi do 09.01.2030., država izdavanja pasoša: Ujedinjeno Kraljevstvo, datum rođenja 05.05.1985., adresa boravka: Budva');
  });
  await t('troškovi osnivanja i elektronski oblik', () => {
    const f = JSON.parse(JSON.stringify(FD));
    f.dokumenta.nadoknada = 'da'; f.dokumenta.troskovi = '300'; f.dokumenta.oblik = 'elektronski';
    const x = tekst(D.zaFirmu(f).find((d) => d.id === 'ugovor-o-osnivanju'));
    assert.match(x, /Procijenjeni troškovi osnivanja Društva iznose 300,00 €/);
    assert.match(x, /ne može se platiti iz osnovnog kapitala/);
    assert.match(x, /kvalifikovanim elektronskim potpisom/);
    assert.ok(!/istovjetnih primjeraka/.test(x));
  });
  await t('jedan osnivač → odluka o osnivanju, 100%', () => {
    const f = JSON.parse(JSON.stringify(FD));
    f.osnivaci = [f.osnivaci[0]]; f.osnivaci[0].udio = '';
    const docs = D.zaFirmu(f);
    assert.ok(!docs.some((d) => d.id === 'ugovor-o-osnivanju'));
    const o = docs.find((d) => d.id === 'odluka-o-osnivanju');
    assert.match(tekst(o), /udio u osnovnom kapitalu Društva 100%/);
    assert.match(tekst(o), /jednočlano društvo/);
    assert.match(tekst(docs.find((d) => d.id === 'statut')), /1\.000,00 €/);
  });
  await t('mandat i oblik riječi "godina"', () => {
    assert.strictEqual(D._.godina(1), '1 godinu');
    assert.strictEqual(D._.godina(4), '4 godine');
    assert.strictEqual(D._.godina(5), '5 godina');
    // Kad je prvi direktor imenovan statutom, odluka služi za promjenu direktora.
    const promjena = D.zaFirmu(FD).find((d) => d.id === 'odluka-o-imenovanju-direktora');
    assert.ok(promjena.dostupan);
    assert.match(promjena.naziv, /promjena direktora/);
    assert.ok(promjena.nedostaje.includes('dosadašnji direktor'));
    const fp = JSON.parse(JSON.stringify(FD));
    fp.dokumenta.prethodniDirektor = 'Ana Anić';
    const xp = tekst(D.zaFirmu(fp).find((d) => d.id === 'odluka-o-imenovanju-direktora'));
    assert.match(xp, /o razrješenju i imenovanju direktora/);
    assert.match(xp, /^Ana Anić razrješava se dužnosti direktora/m);
    assert.match(xp, /Za direktora društva „Test Solutions DOO Podgorica”, Opština Podgorica, .*imenuje se Marko Marković/);
    assert.match(xp, /u roku od sedam dana/);
    const f = JSON.parse(JSON.stringify(FD));
    f.dokumenta.imenovanje = 'odluka';
    assert.match(tekst(D.zaFirmu(f).find((d) => d.id === 'odluka-o-imenovanju-direktora')), /period od 4 godine/);
    assert.ok(!/Za prvog direktora/.test(tekst(D.zaFirmu(f).find((d) => d.id === 'statut'))));
    f.dokumenta.mandat = '';
    assert.match(tekst(D.zaFirmu(f).find((d) => d.id === 'statut')), /Trajanje mandata direktora nije ograničeno/);
  });
  await t('nedostajući podaci se prijavljuju i ostaje prazna linija', () => {
    const docs = D.zaFirmu({ naziv: 'X DOO', pravniOblik: 'Društvo sa ograničenom odgovornošću (DOO)' });
    const s = docs.find((d) => d.id === 'statut');
    assert.ok(s.nedostaje.includes('osnovni kapital'));
    assert.match(tekst(s), /______________ €/);
  });
  await t('preduzetnik nema statut ni direktora', () => {
    const docs = D.zaFirmu({ naziv: 'Y', pravniOblik: 'Preduzetnik' });
    assert.ok(!docs.find((d) => d.id === 'statut').dostupan);
    assert.ok(!docs.find((d) => d.id === 'odluka-o-imenovanju-direktora').dostupan);
    assert.ok(docs.find((d) => d.id === 'ovlascenje').dostupan);
  });
  await t('docx je ispravan ZIP sa document.xml', () => {
    const fs = require('fs'), os = require('os'), cp = require('child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-'));
    const dostupni = D.zaFirmu(FD).filter((d) => d.dostupan);
    dostupni.forEach((d) => {
      fs.writeFileSync(path.join(dir, d.id + '.docx'), Buffer.from(D.uDocx(d.blokovi)));
    });
    const out = cp.execFileSync('python3', ['-c', `
import sys, glob, zipfile, docx
for f in sorted(glob.glob(sys.argv[1] + '/*.docx')):
    assert zipfile.ZipFile(f).testzip() is None
    d = docx.Document(f)
    print(f.split('/')[-1], len(d.paragraphs), len(d.tables))
`, dir]).toString();
    assert.strictEqual(out.trim().split('\n').length, dostupni.length, out);
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
