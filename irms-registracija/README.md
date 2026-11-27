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

Odluka o osnivanju, statut, odluka o imenovanju izvršnog direktora i saglasnost izvršnog direktora
prave se po tekstovima koje je dostavio klijent; promjenljivi podaci
dolaze iz forme.

| Dokument | Kada |
|---|---|
| Osnivački akt – Odluka o osnivanju | DOO sa jednim osnivačem (tekst klijenta) |
| Ugovor o osnivanju | DOO sa više osnivača (opšti model; iznosi uloga i udjeli se računaju iz kapitala) |
| Statut | DOO (tekst klijenta, tabela udjela za sve članove) |
| Odluka o imenovanju izvršnog direktora | DOO (tekst klijenta); ako je upisan dosadašnji izvršni direktor, dodaje se razrješenje |
| Saglasnost (izjava) za imenovanje izvršnog direktora | DOO (tekst klijenta) |
| Ovlašćenje za zastupanje pred Poreskom upravom (IRMS) | kad zahtjev podnosi punomoćnik (npr. računovođa) |

- **Pregled / štampa** otvara dokument spreman za štampu ili „Sačuvaj kao PDF”.
- **Word** preuzima .docx za doradu.
- Podaci koji nedostaju ostaju kao prazna linija `______________` i aplikacija ih navodi.
- Za mjesto i datum akata, mandat direktora, način imenovanja direktora, oblik akta, troškove
  osnivanja i punomoćnika popunite odjeljak **Podaci za osnivačka dokumenta** u formi.

#### Usklađenost sa Zakonom o privrednim društvima

Provjere podataka u aplikaciji i ugovor o osnivanju (opšti model) usklađeni su sa Zakonom o
privrednim društvima („Službeni list Crne Gore”, br. 90/25, 121/25 i 44/26), prema prečišćenom tekstu.
Šabloni po tekstovima klijenta zadržavaju njegove formulacije (npr. „izvršni direktor”, direktor
imenovan i u osnivačkom aktu); pravnik treba da potvrdi te izbore. Pravila koja aplikacija provjerava:

| Pravilo | Član |
|---|---|
| Osnivački akt: ugovor (više osnivača) ili odluka (jedan); pisani sa ovjerenim potpisima ili elektronski sa kvalifikovanim el. potpisom; ne mijenja se nakon registracije | 8, 9 |
| Poslovno ime sadrži naziv, oznaku pravnog oblika (DOO) i sjedište; skraćeno ime sadrži oznaku | 23, 24 |
| Preduzetnik: poslovno ime sadrži ime i prezime, sjedište i oznaku „PR” | 85 |
| Društvo mora imati adresu za prijem elektronske pošte | 19 |
| Novčani ulog uplaćuje se u cjelosti prije registracije | 70 |
| DOO: najviše 30 članova, osnovni kapital najmanje 1 € | 358, 361 |
| Obavezna sadržina osnivačkog akta (podaci o osnivačima, za strance i podaci o pasošu, iznos uloga, udio u %, troškovi osnivanja) | 362 |
| Obavezna sadržina statuta, izmjena statuta dvotrećinskom većinom | 363 |
| Troškovi osnivanja: srazmjerno udjelima, ne iz osnovnog kapitala, najviše do iznosa iz akta | 365 |
| Prenos udjela, pravo preče kupovine (pisana ponuda, rok 30 dana), ugovor sa ovjerenim potpisima | 374–380 |
| Organi: skupština i direktor; nadležnosti, sazivanje (8 dana), kvorum, većina | 405–420 |
| Direktor: imenuje ga skupština ili statut pri osnivanju; mandat neograničen ako statut ne kaže drugačije; uslovi za imenovanje | 422–426 |

> Šabloni su za DOO sa novčanim ulozima i jednim izvršnim direktorom.
> Prije potpisivanja neka ih pregleda pravnik ili ovlašćeni računovođa. Za AD i ostale oblike
> osnivački akt i statut se ne prave.

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
