# Uputstva za rad u ovom repozitorijumu

Korisnik radi registraciju firmi u Crnoj Gori (CRPS, IRMS Poreske uprave). Komunikacija je na
crnogorskom (ijekavica). Aplikacija je u `irms-registracija/` (vidi njen README).

## Pravila za svako pravljenje firme i dokumenata

Važeći propis: **Zakon o privrednim društvima („Službeni list Crne Gore”, br. 90/25, 121/25 i 44/26)**.
Ne navoditi stari zakon (65/20, 146/21, 4/24). Ova pravila su ugrađena u aplikaciju; kod svake
izmjene šablona ili provjera ona moraju ostati ispunjena.

1. **Poslovno ime** sadrži naziv, oznaku pravnog oblika („DOO” ili „društvo sa ograničenom
   odgovornošću”) i sjedište (čl. 23). Primjer: „Jadran Soft DOO Bar”.
2. **Skraćeno poslovno ime** sadrži naziv i oznaku pravnog oblika (čl. 24). Primjer: „Jadran Soft DOO”.
3. **Preduzetnik**: poslovno ime sadrži ime i prezime, sjedište i oznaku „PR” (čl. 85).
   Primjer: „Milica Marić PR Kafe Tara Kolašin”.
   Pravila 1–3 aplikacija sama ispravlja (`ispraviPoslovnoIme` u `app/validacija.js`) pri čuvanju,
   provjeri i učitavanju firmi.
4. Društvo mora imati **adresu za prijem elektronske pošte** (čl. 19).
5. **DOO**: najviše 30 članova (čl. 358), osnovni kapital najmanje 1 € (čl. 361).
6. **Osnivački akt** (čl. 8, 9, 362): odluka (jedan osnivač) ili ugovor (više osnivača); za domaće
   fizičko lice ime, JMBG i adresa prebivališta; za stranca broj pasoša, datum izdavanja i važenja,
   država izdavanja, datum rođenja i adresa boravka; za pravno lice naziv, matični/registarski broj i
   adresa sjedišta; iznos novčanog uloga i udio u % za svakog osnivača; troškovi osnivanja ako se
   nadoknađuju. Potpisi se ovjeravaju (ili kvalifikovani elektronski potpis). Akt se ne mijenja nakon
   registracije, zato se **direktor ne imenuje osnivačkim aktom**, nego statutom (čl. 422 st. 4) i
   odlukom o imenovanju.
7. **Uplata uloga** u cjelosti prije registracije u CRPS (čl. 70).
8. **Statut** (čl. 363): poslovno ime, sjedište, djelatnost, kapital, udjeli u %, sazivanje skupštine i
   odlučivanje, organi i imenovanje/razrješenje, postupak izmjene (dvotrećinska većina).
9. **Naziv funkcije**: zakon za DOO koristi „direktor” (čl. 405). Podrazumijevano se piše „direktor”;
   „izvršni direktor” samo ako korisnik to izabere u formi (polje „Naziv funkcije u aktima”).
10. **Mjesto u tekstu**: „u Baru”, „u Herceg Novom” (lokativ iz liste); za nepoznato mjesto
    „u mjestu X”, nikad pogrešan padež poput „u Bar”.

## Šabloni

Odluka o osnivanju (jednočlano DOO), statut, odluka o imenovanju direktora i saglasnost direktora
prave se po tekstovima koje je dostavio korisnik (`app/dokumenti.js`), uz dopune iz pravila 6–7.
Ugovor o osnivanju (više osnivača) je opšti model.

## Lični podaci

Stvarne podatke klijenata (imena, JMBG, brojeve dokumenata, adrese) nikad ne stavljati u repozitorijum,
testove ni objavljene primjere. Za testove i primjere koristiti izmišljene podatke.

## Provjera

`cd irms-registracija/asistent && npm test` (ili `node test/test.js`) mora proći prije svakog commita.
