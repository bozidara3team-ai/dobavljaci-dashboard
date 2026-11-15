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
  skraceniNaziv: 'Test Solutions',
  pravniOblik: 'Društvo sa ograničenom odgovornošću (DOO)',
  pib: '03123456',
  registarskiBroj: '5-0123456/001',
  datumOsnivanja: '2026-10-01',
  sifraDjelatnosti: '62.01',
  sjediste: { opstina: 'Podgorica', mjesto: 'Podgorica', ulica: 'Bulevar Svetog Petra Cetinjskog', broj: '1', postanskiBroj: '81000' },
  email: 'info@primjer.me',
  telefon: '+382 20 000 000',
  osnivaci: [
    { tip: 'fizicko', ime: 'Marko Marković', jmbg: '1503985210000', udio: '60' },
    { tip: 'fizicko', ime: 'Ana Anić', jmbg: '0101980215009', udio: '40' }
  ],
  zastupnik: { ime: 'Marko Marković', jmbg: '1503985210000' },
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
  await t('stranac bez JMBG traži pasoš', () => {
    const f = JSON.parse(JSON.stringify(FIRMA));
    f.osnivaci[1] = { tip: 'fizicko', ime: 'John Smith', drzavljanstvo: 'UK', udio: '40' };
    assert.ok(V.provjeriFirmu(f).errors.some((e) => e.polje === 'osnivaci.1.pasos'));
    f.osnivaci[1].pasos = 'X1234567';
    assert.deepStrictEqual(V.provjeriFirmu(f).errors, []);
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
    assert.strictEqual(await v('#skr'), 'Test Solutions');
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
