# IRMS registracija firmi

Alat za registraciju firmi na portalu Poreske uprave Crne Gore (IRMS, https://irms.tax.gov.me).
Ima dva dijela:

| Dio | Šta radi |
|---|---|
| `app/` – web aplikacija | Unos podataka firme, automatska provjera (JMBG, PIB, žiro račun, zbir udjela, obavezna polja), lista dokumentacije, praćenje statusa (Nacrt → Spremno → Podneseno → Registrovano / Odbijeno), istorija, dugmad „Kopiraj” za ručni unos, izvoz/uvoz (JSON, CSV). |
| `asistent/` – IRMS asistent | Program koji na **vašem računaru** otvara IRMS u pregledaču i popunjava formular podacima izvezenim iz aplikacije. |

> **Važno:** asistent **nikad ne podnosi zahtjev**. Prijavu na portal (kvalifikovani sertifikat),
> provjeru unesenih podataka i klik na „Podnesi”/„Potpiši” uvijek radite vi.
> Dugmad koja liče na podnošenje asistent odbija da klikne.

## 1. Web aplikacija

Otvorite `app/index.html` u pregledaču (dupli klik) – nije potreban server ni internet.

- Podaci se čuvaju **u tom pregledaču na tom računaru** (localStorage). Redovno pravite
  rezervnu kopiju: **Podaci → Izvezi rezervnu kopiju (JSON)**. Na drugom računaru je vratite sa
  **Uvezi rezervnu kopiju**.
- Status **„Spremno za podnošenje”** može se postaviti samo kada nema grešaka u podacima.
- Lista dokumentacije je orijentaciona – konačne zahtjeve provjerite u uputstvima na portalu IRMS.

### Osnivačka dokumenta (opšti modeli)

U prikazu firme, blok **Osnivačka dokumenta** pravi dokumente iz unesenih podataka:

| Dokument | Kada |
|---|---|
| Odluka o osnivanju | DOO sa jednim osnivačem |
| Ugovor o osnivanju | DOO sa više osnivača (iznosi uloga i udjeli se računaju iz kapitala) |
| Statut | DOO |
| Odluka o imenovanju izvršnog direktora | svi osim preduzetnika |
| Izjava direktora o prihvatanju imenovanja | svi osim preduzetnika |
| Ovlašćenje za zastupanje pred Poreskom upravom (IRMS) | kad zahtjev podnosi punomoćnik (npr. računovođa) |

- **Pregled / štampa** otvara dokument spreman za štampu ili „Sačuvaj kao PDF”.
- **Word** preuzima .docx za doradu.
- Podaci koji nedostaju ostaju kao prazna linija `______________` i aplikacija ih navodi.
- Za mjesto i datum akata, mandat direktora i punomoćnika popunite odjeljak
  **Podaci za osnivačka dokumenta** u formi.

> Ovo su **opšti modeli** zasnovani na Zakonu o privrednim društvima („Sl. list CG”, br. 65/20 i 146/21),
> za novčani ulog i DOO bez odbora direktora. Prije potpisivanja neka ih pregleda pravnik ili
> ovlašćeni računovođa. Za AD i ostale oblike osnivački akt i statut se ne prave.

## 2. IRMS asistent

Potrebno: [Node.js](https://nodejs.org) 18+ i instaliran Google Chrome ili Microsoft Edge
(zbog izbora kvalifikovanog sertifikata/kartice).

```bash
cd irms-registracija/asistent
npm install
```

### Korak A – jednom: snimite polja stvarnog formulara

Tačna polja IRMS formulara zavise od portala i mogu se mijenjati, zato se mapiraju u fajlu
`mapa-polja.json`.

```bash
node irms-asistent.js snimi
```

Prijavite se, otvorite formular za registraciju i za svaki ekran pritisnite Enter.
Program ispisuje sva polja (labela, selektor, opcije) i čuva ih u `snimljena-polja-N.json`.

Zatim kopirajte `mapa-polja.primjer.json` u `mapa-polja.json` i upišite stvarne labele ili
selektore. Primjer mape **nije provjeren na stvarnom portalu**.

Opcije za polje u mapi:

| Ključ | Značenje |
|---|---|
| `izvor` | Podatak firme, npr. `naziv`, `sjediste.opstina`, `zastupnik.jmbg` |
| `labela` / `selektor` | Kako se polje nalazi na stranici (tekst labele ili CSS selektor, npr. `#legalForm`) |
| `tip` | `text` (podrazumijevano), `select`, `checkbox`, `radio`, `autocomplete` |
| `format` | `dd.mm.yyyy`, `dd/mm/yyyy`, `samoCifre`, `da/ne`, `broj` |
| `mapiranje` | Prevod vrijednosti, npr. `{ "Društvo sa ograničenom odgovornošću (DOO)": "DOO" }` |
| `indeksPolja` | `"posljednje"` ili broj – kad na stranici ima više istih polja |

Korak sa `"zaSvaki": "osnivaci"` (ili `"racuni"`) ponavlja polja za svakog osnivača; `prijeSvakog.dugme`
je dugme (npr. „Dodaj”) koje se klikne prije svakog sljedećeg reda.

### Korak B – popunjavanje

1. U aplikaciji: firma → **Izvoz za asistenta** (ili **Podaci → Izvezi “Spremne” za asistenta**).
2. Pokrenite:
   ```bash
   node irms-asistent.js popuni ~/Downloads/irms-test-solutions-doo.json
   # opcije: --firma "naziv ili PIB"  --mapa mapa-polja.json  --pregledac chrome|msedge|chromium
   ```
3. Prijavite se, otvorite ekran, pritisnite Enter – asistent popuni polja tog koraka i ispiše
   šta je popunjeno, a šta nije nađeno.
4. Provjerite sve i **sami podnesite zahtjev**. Broj zahtjeva i status upišite u aplikaciji.

Pregledač koristi zaseban profil (`asistent/.profil-pregledaca`), pa sesija ostaje sačuvana između pokretanja.

## Testovi

```bash
cd irms-registracija/asistent && npm test
```

Testira validaciju i popunjavanje lažnog formulara (`test/lazni-formular.html`) – uključujući
provjeru da se zahtjev ne podnosi.
