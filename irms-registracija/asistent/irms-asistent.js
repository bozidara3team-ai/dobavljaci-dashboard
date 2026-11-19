#!/usr/bin/env node
'use strict';
/*
 * IRMS asistent
 *
 *   node irms-asistent.js snimi                      – snima polja formulara sa trenutne stranice
 *   node irms-asistent.js popuni <izvoz.json> [opcije] – popunjava formular podacima firme
 *
 * Opcije:
 *   --firma "<dio naziva ili PIB>"   koja firma iz izvoza (podrazumijevano: pitaće vas)
 *   --mapa <fajl>                    mapa polja (podrazumijevano: mapa-polja.json)
 *   --pregledac chrome|msedge|chromium (podrazumijevano: chrome)
 *   --adresa <url>                   početna adresa (podrazumijevano iz mape ili https://irms.tax.gov.me)
 *
 * Asistent NIKAD ne podnosi zahtjev: prijavu (sertifikat), provjeru i klik na
 * "Podnesi"/"Potpiši" uvijek radite vi.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const P = require('./popunjavanje');

const PODRAZUMIJEVANA_ADRESA = 'https://irms.tax.gov.me';
const PROFIL = path.join(__dirname, '.profil-pregledaca');

function argumenti(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { a[argv[i].slice(2)] = argv[i + 1]; i++; }
    else a._.push(argv[i]);
  }
  return a;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const pitaj = (q) => new Promise((res) => rl.question(q, (o) => res(o.trim())));

async function pokreniPregledac(args, adresa) {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) {
    console.error('Playwright nije instaliran. Pokrenite: npm install  (u folderu asistent)');
    process.exit(1);
  }
  const kanal = args.pregledac || 'chrome';
  const opcije = { headless: false, viewport: null, args: ['--start-maximized'] };
  if (kanal !== 'chromium') opcije.channel = kanal;
  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(PROFIL, opcije);
  } catch (e) {
    if (kanal === 'chromium') throw e;
    console.warn(`Ne mogu da pokrenem "${kanal}" (${e.message.split('\n')[0]}). Pokušavam ugrađeni Chromium…`);
    console.warn('Napomena: za izbor kvalifikovanog sertifikata preporučuje se instalirani Chrome ili Edge.');
    delete opcije.channel;
    ctx = await chromium.launchPersistentContext(PROFIL, opcije);
  }
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(adresa).catch((e) => console.warn('Otvaranje portala nije uspjelo:', e.message.split('\n')[0]));
  return { ctx, page };
}

function aktivnaStranica(ctx, fallback) {
  const s = ctx.pages().filter((p) => !p.isClosed());
  return s.length ? s[s.length - 1] : fallback;
}

async function komandaSnimi(args) {
  const adresa = args.adresa || PODRAZUMIJEVANA_ADRESA;
  const { ctx, page } = await pokreniPregledac(args, adresa);
  console.log('\n1) U otvorenom pregledaču se prijavite na IRMS (sertifikatom).');
  console.log('2) Otvorite formular za registraciju (svaki korak/tab posebno).');
  console.log('3) Pritisnite Enter ovdje da snimite polja sa trenutne stranice. Upišite "k" za kraj.\n');
  let br = 0;
  for (;;) {
    const o = await pitaj(`[snimanje ${br + 1}] Enter = snimi, k = kraj: `);
    if (o.toLowerCase() === 'k') break;
    const p = aktivnaStranica(ctx, page);
    const polja = await P.snimiPolja(p);
    br++;
    const fajl = path.join(__dirname, `snimljena-polja-${br}.json`);
    fs.writeFileSync(fajl, JSON.stringify({ stranica: p.url(), naslov: await p.title(), okviri: polja }, null, 2));
    const ukupno = polja.reduce((s, o) => s + o.polja.length, 0);
    console.log(`Snimljeno ${ukupno} polja → ${path.basename(fajl)}`);
    polja.forEach((o) => o.polja.forEach((f) => {
      console.log(`  • ${f.labela || '(bez labele)'}  [${f.tag}${f.tip ? '/' + f.tip : ''}]  ${f.selektor || ''}${f.obavezno ? '  *obavezno' : ''}`);
    }));
  }
  console.log('\nNa osnovu snimljenih fajlova dopunite mapa-polja.json (vidi README).');
  await ctx.close();
}

function ucitajJSON(fajl, opis) {
  try { return JSON.parse(fs.readFileSync(fajl, 'utf8')); }
  catch (e) { console.error(`Ne mogu da pročitam ${opis} "${fajl}": ${e.message}`); process.exit(1); }
}

async function izaberiFirmu(firme, kriterijum) {
  if (!firme.length) { console.error('Izvoz ne sadrži nijednu firmu.'); process.exit(1); }
  if (kriterijum) {
    const k = kriterijum.toLowerCase();
    const n = firme.filter((f) => (f.naziv || '').toLowerCase().includes(k) || f.pib === kriterijum);
    if (n.length === 1) return n[0];
    if (!n.length) { console.error(`Nema firme koja odgovara "${kriterijum}".`); process.exit(1); }
    firme = n;
  }
  if (firme.length === 1) return firme[0];
  firme.forEach((f, i) => console.log(`  ${i + 1}) ${f.naziv}${f.pib ? ' (PIB ' + f.pib + ')' : ''}`));
  for (;;) {
    const i = Number(await pitaj('Izaberite broj firme: '));
    if (i >= 1 && i <= firme.length) return firme[i - 1];
  }
}

function stampajIzvjestaj(izv) {
  const ikone = { ok: '✓', prazno: '·', 'nije-nadjeno': '?', greska: '✗', preskoceno: '!' };
  izv.forEach((r) => console.log(`  ${ikone[r.status] || ' '} ${r.polje}${r.status !== 'ok' ? ' — ' + r.status : ''}${r.napomena ? ' (' + r.napomena + ')' : ''}`));
  const n = (s) => izv.filter((r) => r.status === s).length;
  console.log(`  Ukupno: ${n('ok')} popunjeno, ${n('nije-nadjeno')} nije nađeno, ${n('greska')} grešaka, ${n('prazno')} praznih.`);
}

async function komandaPopuni(args) {
  const izvozFajl = args._[1];
  if (!izvozFajl) { console.error('Upotreba: node irms-asistent.js popuni <izvoz.json> [--firma "naziv"]'); process.exit(1); }
  const izvoz = ucitajJSON(izvozFajl, 'izvoz');
  const firme = Array.isArray(izvoz) ? izvoz : izvoz.firme || [];

  let mapaFajl = args.mapa || path.join(__dirname, 'mapa-polja.json');
  if (!fs.existsSync(mapaFajl)) {
    const primjer = path.join(__dirname, 'mapa-polja.primjer.json');
    console.warn(`Nema ${path.basename(mapaFajl)} – koristim ${path.basename(primjer)}.`);
    console.warn('Primjer mape NIJE provjeren na stvarnom portalu; prvo pokrenite "snimi" i prilagodite mapu.\n');
    mapaFajl = primjer;
  }
  const mapa = ucitajJSON(mapaFajl, 'mapu polja');
  const problemi = P.provjeriMapu(mapa);
  if (problemi.length) { console.error('Mapa polja ima greške:\n  ' + problemi.join('\n  ')); process.exit(1); }

  const firma = await izaberiFirmu(firme, args.firma);
  console.log(`\nFirma: ${firma.naziv}`);

  const { ctx, page } = await pokreniPregledac(args, args.adresa || mapa.adresaPortala || PODRAZUMIJEVANA_ADRESA);
  console.log('\nU pregledaču se prijavite na IRMS i otvorite formular za registraciju.');
  console.log('Za svaki korak: otvorite odgovarajući ekran, pa ovdje pritisnite Enter da se popuni.');
  console.log('Asistent ne podnosi zahtjev – provjeru i podnošenje radite vi.\n');

  for (let i = 0; i < mapa.koraci.length; i++) {
    const korak = mapa.koraci[i];
    const o = await pitaj(`[${i + 1}/${mapa.koraci.length}] ${korak.naziv || 'Korak'} — Enter = popuni, p = preskoči, k = kraj: `);
    if (o.toLowerCase() === 'k') break;
    if (o.toLowerCase() === 'p') continue;
    const izv = await P.popuniKorak(aktivnaStranica(ctx, page), korak, firma);
    stampajIzvjestaj(izv);
    if (izv.some((r) => r.status === 'nije-nadjeno' || r.status === 'greska')) {
      const z = await pitaj('  Neka polja nisu popunjena. Enter = dalje, r = pokušaj ponovo ovaj korak: ');
      if (z.toLowerCase() === 'r') i--;
    }
  }

  console.log('\nGotovo. Provjerite sve podatke u pregledaču i sami podnesite zahtjev.');
  console.log('Nakon podnošenja upišite broj zahtjeva i status "Podneseno" u aplikaciji.');
  await pitaj('Enter = zatvori pregledač: ');
  await ctx.close();
}

(async () => {
  const args = argumenti(process.argv.slice(2));
  const komanda = args._[0];
  try {
    if (komanda === 'snimi') await komandaSnimi(args);
    else if (komanda === 'popuni') await komandaPopuni(args);
    else {
      console.log('Upotreba:\n  node irms-asistent.js snimi\n  node irms-asistent.js popuni <izvoz.json> [--firma "naziv"] [--mapa mapa-polja.json] [--pregledac chrome|msedge|chromium]');
    }
  } catch (e) {
    console.error('Greška:', e.message);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
})();
