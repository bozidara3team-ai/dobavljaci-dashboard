'use strict';
/*
 * Logika popunjavanja formulara na osnovu mape polja (mapa-polja.json).
 *
 * Mapa izgleda ovako:
 * {
 *   "adresaPortala": "https://irms.tax.gov.me",
 *   "koraci": [
 *     {
 *       "naziv": "Osnovni podaci",
 *       "polja": [
 *         { "izvor": "naziv", "labela": "Naziv" },
 *         { "izvor": "pravniOblik", "selektor": "#legalForm", "tip": "select" },
 *         { "izvor": "datumOsnivanja", "labela": "Datum osnivanja", "format": "dd.mm.yyyy" }
 *       ]
 *     },
 *     {
 *       "naziv": "Osnivači",
 *       "zaSvaki": "osnivaci",
 *       "prijeSvakog": { "dugme": "Dodaj" },
 *       "polja": [ { "izvor": "ime", "labela": "Ime i prezime", "indeksPolja": "posljednje" } ]
 *     }
 *   ]
 * }
 *
 * Polje se traži po CSS/Playwright "selektor"-u ili po tekstu "labela".
 * "tip": text (podrazumijevano) | select | checkbox | radio | autocomplete
 */

// Dugmad koja asistent NIKAD ne klikće – podnošenje uvijek radi čovjek.
const ZABRANJENA_DUGMAD = /podne|pošalj|posalj|potpi|submit|send|sign|završi|zavrsi|potvrdi/i;

function getPath(o, p) {
  return String(p).split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
}

function formatiraj(v, format) {
  if (v == null || v === '') return '';
  if (!format) return String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const [y, m, d] = String(v).slice(0, 10).split('-');
    if (format === 'dd.mm.yyyy') return `${d}.${m}.${y}`;
    if (format === 'dd/mm/yyyy') return `${d}/${m}/${y}`;
    if (format === 'yyyy-mm-dd') return `${y}-${m}-${d}`;
  }
  if (format === 'samoCifre') return String(v).replace(/\D/g, '');
  if (format === 'da/ne') return v === 'da' || v === true ? 'Da' : 'Ne';
  if (format === 'broj') return String(v).replace(',', '.');
  return String(v);
}

/** Vrijednost za polje iz podataka firme (ili stavke iz liste kod "zaSvaki"). */
function vrijednost(izvorPodataka, polje) {
  if (Object.prototype.hasOwnProperty.call(polje, 'vrijednost')) return String(polje.vrijednost);
  let v = getPath(izvorPodataka, polje.izvor);
  if (polje.mapiranje && v != null && Object.prototype.hasOwnProperty.call(polje.mapiranje, v)) {
    v = polje.mapiranje[v];
  }
  return formatiraj(v, polje.format);
}

/** Validacija mape – vraća listu problema (prazna = ok). */
function provjeriMapu(mapa) {
  const p = [];
  if (!mapa || !Array.isArray(mapa.koraci)) return ['Mapa mora imati niz "koraci"'];
  mapa.koraci.forEach((k, i) => {
    const kn = `Korak ${i + 1}${k.naziv ? ` (${k.naziv})` : ''}`;
    if (!Array.isArray(k.polja) || !k.polja.length) p.push(`${kn}: nema "polja"`);
    (k.polja || []).forEach((f, j) => {
      if (!f.selektor && !f.labela) p.push(`${kn}, polje ${j + 1}: potreban je "selektor" ili "labela"`);
      if (!f.izvor && !Object.prototype.hasOwnProperty.call(f, 'vrijednost')) {
        p.push(`${kn}, polje ${j + 1}: potreban je "izvor" ili "vrijednost"`);
      }
    });
    if (k.prijeSvakog && k.prijeSvakog.dugme && ZABRANJENA_DUGMAD.test(k.prijeSvakog.dugme)) {
      p.push(`${kn}: dugme "${k.prijeSvakog.dugme}" izgleda kao podnošenje – asistent ga neće kliknuti`);
    }
  });
  return p;
}

async function nadjiElement(page, polje) {
  let loc;
  if (polje.selektor) loc = page.locator(polje.selektor);
  else loc = page.getByLabel(polje.labela, { exact: !!polje.tacnaLabela });
  const n = await loc.count();
  if (n === 0) return null;
  if (n > 1) {
    if (polje.indeksPolja === 'posljednje') return loc.last();
    if (typeof polje.indeksPolja === 'number') return loc.nth(polje.indeksPolja);
    // Uzmi prvo vidljivo
    for (let i = 0; i < n; i++) {
      if (await loc.nth(i).isVisible()) return loc.nth(i);
    }
  }
  return loc.first();
}

async function popuniPolje(page, polje, v) {
  const el = await nadjiElement(page, polje);
  if (!el) return { status: 'nije-nadjeno' };
  const tip = polje.tip || 'text';
  if (tip === 'checkbox' || tip === 'radio') {
    const ukljuci = v === 'Da' || v === 'da' || v === 'true' || v === '1';
    if (tip === 'radio') { if (ukljuci) await el.check(); }
    else await el.setChecked(ukljuci);
    return { status: 'ok' };
  }
  if (v === '') return { status: 'prazno' };
  if (tip === 'select') {
    // Pokušaj po tekstu opcije, pa po vrijednosti, pa po djelimičnom poklapanju.
    try { await el.selectOption({ label: v }); return { status: 'ok' }; } catch (e) { /* sljedeći pokušaj */ }
    try { await el.selectOption(v); return { status: 'ok' }; } catch (e) { /* sljedeći pokušaj */ }
    const opcije = await el.locator('option').allTextContents();
    const vl = v.toLowerCase();
    const nadjena = opcije.find((o) => {
      const t = o.trim().toLowerCase();
      return t && (t.includes(vl) || vl.includes(t));
    });
    if (nadjena) { await el.selectOption({ label: nadjena }); return { status: 'ok', napomena: `izabrano "${nadjena.trim()}"` }; }
    return { status: 'greska', napomena: `nema opcije "${v}"` };
  }
  if (tip === 'autocomplete') {
    await el.fill('');
    await el.pressSequentially(v, { delay: 40 });
    await page.waitForTimeout(polje.cekanjeMs || 800);
    // Samo prilagođene liste prijedloga (ne <option> unutar <select>), i samo vidljive.
    const opcija = page.locator('[role="option"]:visible, [role="listbox"] li:visible')
      .filter({ hasText: new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
    if (await opcija.count()) { await opcija.click({ timeout: 5000 }); return { status: 'ok' }; }
    return { status: 'ok', napomena: 'upisano, izaberite ponuđenu stavku ručno' };
  }
  await el.fill(v);
  return { status: 'ok' };
}

/**
 * Popunjava jedan korak. Vraća izvještaj [{polje, status, napomena}].
 * Nikad ne klikće dugmad za podnošenje.
 */
async function popuniKorak(page, korak, firma) {
  const izvjestaj = [];
  const stavke = korak.zaSvaki ? (getPath(firma, korak.zaSvaki) || []) : [firma];
  for (let i = 0; i < stavke.length; i++) {
    const stavka = stavke[i];
    if (korak.zaSvaki && korak.prijeSvakog && korak.prijeSvakog.dugme && (i > 0 || korak.prijeSvakog.iZaPrvi)) {
      const ime = korak.prijeSvakog.dugme;
      if (ZABRANJENA_DUGMAD.test(ime)) {
        izvjestaj.push({ polje: `dugme "${ime}"`, status: 'preskoceno', napomena: 'izgleda kao podnošenje' });
      } else {
        const b = page.getByRole('button', { name: ime }).first();
        if (await b.count()) { await b.click(); await page.waitForTimeout(korak.prijeSvakog.cekanjeMs || 500); }
        else izvjestaj.push({ polje: `dugme "${ime}"`, status: 'nije-nadjeno' });
      }
    }
    for (const polje of korak.polja) {
      const oznaka = (korak.zaSvaki ? `${korak.zaSvaki}[${i + 1}].` : '') + (polje.izvor || polje.labela || polje.selektor);
      try {
        const r = await popuniPolje(page, polje, vrijednost(stavka, polje));
        izvjestaj.push({ polje: oznaka, ...r });
      } catch (e) {
        izvjestaj.push({ polje: oznaka, status: 'greska', napomena: e.message.split('\n')[0] });
      }
    }
  }
  return izvjestaj;
}

/** Skuplja opis svih polja forme na trenutnoj stranici (za pravljenje mape). */
async function snimiPolja(page) {
  const okviri = page.frames();
  const rezultat = [];
  for (const fr of okviri) {
    let polja = [];
    try {
      polja = await fr.evaluate(() => {
        function labelaZa(el) {
          if (el.id) {
            const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            if (l) return l.innerText.trim();
          }
          const p = el.closest('label');
          if (p) return p.innerText.trim();
          if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
          const lb = el.getAttribute('aria-labelledby');
          if (lb) return lb.split(/\s+/).map((id) => (document.getElementById(id) || {}).innerText || '').join(' ').trim();
          return el.getAttribute('placeholder') || '';
        }
        function selektor(el) {
          if (el.id) return `#${CSS.escape(el.id)}`;
          if (el.name) return `${el.tagName.toLowerCase()}[name="${el.name}"]`;
          return null;
        }
        return Array.from(document.querySelectorAll('input, select, textarea'))
          .filter((el) => el.type !== 'hidden' && el.offsetParent !== null)
          .map((el) => ({
            labela: labelaZa(el).replace(/\s+/g, ' ').slice(0, 120),
            selektor: selektor(el),
            tag: el.tagName.toLowerCase(),
            tip: el.type || null,
            obavezno: el.required || el.getAttribute('aria-required') === 'true',
            opcije: el.tagName === 'SELECT' ? Array.from(el.options).map((o) => o.text.trim()).slice(0, 60) : undefined
          }));
      });
    } catch (e) { /* okvir sa drugog domena ili zatvoren */ }
    if (polja.length) rezultat.push({ okvir: fr.url(), polja });
  }
  return rezultat;
}

module.exports = {
  ZABRANJENA_DUGMAD,
  getPath,
  formatiraj,
  vrijednost,
  provjeriMapu,
  popuniPolje,
  popuniKorak,
  snimiPolja
};
