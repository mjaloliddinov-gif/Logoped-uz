# LOGOPED.UZ — Vercel uchun tayyor nusxa

Bu paket haqiqiy Next.js ilovasi. `npm run build` `.next` papkasini va `routes-manifest.json` faylini yaratadi. Cloudflare/Vinext kerak emas. Hozir ishlayotgan ChatGPT Sites sayti alohida saqlanadi.

## 1. Supabase loyihasini tayyorlang

1. Supabase’da yangi loyiha yarating. Baza parolini xavfsiz saqlang.
2. **SQL Editor → New query** ni oching. Shu paketdagi `supabase/setup.sql` faylining hammasini joylang va **Run** bosing. Skript `logoped` sxemasini va jadvallarni yaratadi. Mavjud jadvalni o‘chirmaydi.
3. **Authentication → Sign In / Providers → Email**: email/parol bilan kirishni va **Confirm email** ni yoqing. Minimal parol uzunligini 12 belgiga qo‘ying.
4. **Storage → New bucket**: `logoped-private` nomli bucket yarating. **Public bucket o‘chiq** bo‘lsin. Fayl hajmi chegarasi 4 MiB; turlar: PDF, PNG, JPEG, MPEG/MP3, WAV, MP4, WebM. Brauzer uchun ochiq read/write siyosatini qo‘shmang. Server fayl turini va foydalanuvchi huquqini tekshiradi.
5. **Connect** oynasidan **Transaction pooler** uchun PostgreSQL ulanish manzilini oling. `DATABASE_URL` ga kerak. Odatda port `6543`.
6. **Project Settings → API / API Keys** dan Project URL, publishable key va server uchun secret key ni oling. Eski loyihalarda `anon` key publishable o‘rnida, `service_role` key secret o‘rnida ishlatilishi mumkin.

## 2. GitHub va Vercel

1. ZIPni oching. Ichidagi `LOGOPED_UZ_VERCEL` papkasining **ichidagi fayllarni** yangi GitHub repository ildiziga yuklang. `package.json`, `package-lock.json`, `app`, `public` bir darajada tursin. `.env.example` — namuna; haqiqiy `.env.local` faylini GitHub’ga yuklamang.
2. Vercel → **Add New → Project** → repository’ni tanlang.
3. **Framework Preset: Next.js**. Node.js: **24.x**. Root Directory — `package.json` joylashgan papka.
4. Install Command: `npm ci`. Build Command: `npm run build`. Output Directory: `.next` (Next.js standartini qoldirish ham mumkin).
5. Quyidagi Environment Variables qiymatlarini **Production** uchun kiriting. Preview ishlatsangiz, alohida test Supabase loyihasi va mos domen qo‘llang.
6. **Deploy** bosing. Birinchi berilgan Vercel domenini quyidagi sozlamalarda ishlating; kerak bo‘lsa qiymatlarni yangilab **Redeploy** qiling.

| O‘zgaruvchi | Qiymat |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable yoki legacy anon key |
| `NEXT_PUBLIC_SITE_URL` | Saytning to‘liq manzili: `https://SIZNING-LOYIHA.vercel.app`; oxirida `/` qo‘ymang |
| `DATABASE_URL` | Transaction pooler PostgreSQL URI; paroldagi maxsus belgilar URL-encoded bo‘lsin |
| `SUPABASE_SECRET_KEY` | Supabase secret yoki legacy service_role key; faqat serverga |
| `SUPABASE_STORAGE_BUCKET` | `logoped-private` |
| `ADMIN_EMAIL` | Birinchi administrator bo‘ladigan o‘zingizning email manzilingiz |
| `DATABASE_CA_CERT` | TLS tekshiruvi talab qilsa, Supabase Database sozlamalaridan olingan CA sertifikati, PEM matni |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Ixtiyoriy: AI uchun. Sozlanmasa AI holati “ulanmagan” bo‘ladi |

`DATABASE_URL` va `SUPABASE_SECRET_KEY` oldiga **NEXT_PUBLIC_ qo‘shmang**. Server ulanishida sertifikat tekshiruvi yoqilgan; TLS xatosi bo‘lsa CA sertifikatini kiriting, tekshiruvni o‘chirmang.

## 3. Email havolalarini sozlang — majburiy

Supabase → **Authentication → URL Configuration**:

- **Site URL**: Vercel domeningiz, `NEXT_PUBLIC_SITE_URL` bilan bir xil.
- **Redirect URLs**: `https://SIZNING-LOYIHA.vercel.app/auth/confirm`.
- Lokal ishlab chiqish uchun alohida test loyihasida `http://localhost:3000/auth/confirm` qo‘shish mumkin.

**Email Templates → Confirm signup** dagi havola:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Emailni tasdiqlash</a>
```

**Email Templates → Reset password** dagi havola:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Parolni tiklash</a>
```

Oddiy ota-onalarga email yetib borishi uchun **Custom SMTP** sozlang. Supabase’ning standart email xizmati faqat loyiha tashkiloti a’zolariga yuborish bilan cheklangan. Emailni tasdiqlashni o‘chirib qo‘yish o‘rniga SMTP provayderini sozlang. Bu paket SMTP akkaunti yoki pullik xizmat yaratmaydi.

## 4. Birinchi administrator

1. Vercel saytida `/signup` ni oching, **ADMIN_EMAIL** dagi email bilan ro‘yxatdan o‘ting.
2. Emaildagi havolani ochib hisobni tasdiqlang.
3. `/admin` ni oching va **Administrator sifatida boshlash** tugmasini bosing. Boshqa email bu amalni bajara olmaydi.
4. Alohida 12–64 belgili **admin kodi** yarating. Tiklash kaliti bir marta ko‘rsatiladi — xavfsiz saqlang.
5. O‘quvchilar bilan ishlash uchun Admin → Sozlamalar’da alohida logoped vakolatini yoqing.
6. O‘quvchi qo‘shing. Ota-ona/o‘quvchini taklif havolasi bilan bog‘lang. Oddiy ro‘yxatdan o‘tish hech kimga admin vakolatini bermaydi.

Kirish: `/login`. Ro‘yxatdan o‘tish: `/signup`. Parolni tiklash: kirish oynasidagi havola. Admin: `/admin`.

## 5. Nimalar saqlangan

- O‘zbek, rus va ingliz interfeysi; dark/light; mobil CSS; tugma animatsiyalari.
- Mashqlar, o‘yinlar, video va kontent boshqaruvi.
- O‘quvchini tanlab baho/izoh/vazifa berish, baholar tabeli, bajarilgan vazifani tekshirish.
- Dars tugatilganda mavzu bo‘yicha avtomatik uy vazifasi; takroriy bosishda dublikat yaratilmaydi.
- Ota-ona/o‘quvchi bilan admin chat, bildirishnomalar, individual ruxsatlar.
- Kod bilan admin himoyasi, cheklangan urinishlar, tiklash kaliti, audit.
- Fayllar Supabase’ning yopiq bucketida. Vercel cheklovi sabab bir fayl **4 MiB gacha**. Katta videolar uchun YouTube havolasi ishlating.

PostgreSQL `logoped` sxemasi brauzer rollariga yopiq, jadvallarda RLS yoqilgan. Server bazaga maxfiy ulanish bilan ulanadi; har bir so‘rovda Supabase foydalanuvchisi tekshiriladi va bolaning biriktirilishi bo‘yicha ruxsatlar qo‘llanadi. Oddiy frontend Supabase Data API orqali bu jadvallarni o‘qiy olmaydi.

## 6. Muhim farqlar

Bu **Vercel uchun alohida nusxa**. Avvalgi saytdagi haqiqiy foydalanuvchilar, chatlar, yuklangan fayllar va baza yozuvlari ZIP ichida yo‘q va avtomatik ko‘chmaydi. Namuna o‘quv kontenti saqlangan. Eski hisoblar ChatGPT ID, yangi hisoblar Supabase ID ishlatadi; mavjud ma’lumotni ko‘chirish uchun keyin alohida moslashtirish kerak. Hozirgi Sites sayti ishlashda davom etadi.

Supabase/Vercel akkauntlaringizga ushbu paketdan haqiqiy ulanish o‘rnatilmadi. Siz URL, kalitlar, SQL, bucket va SMTP sozlamalarini bajargach, jonli muhitdagi qabul sinovlarini o‘tkazing:

- Ikki turli ota-ona hisobi bir-birining bolasi, vazifasi yoki chatini ko‘rmasin.
- Topshiriq → ota-ona javobi → admin tekshiruvi/baho → bildirishnoma.
- Sahifani yangilaganda natija saqlansin.
- Email tasdiqlash, parolni tiklash, chiqish va admin kodi ishlasin.
- Fayl yuklash, yopiq faylga begona hisobdan kirish rad etilishi.
- Telefon va planshetda tugmalar, o‘yinlar va jadvallarni ko‘ring.

## 7. Kompyuterda ishga tushirish

Node.js 24.x o‘rnating. Terminalni loyiha papkasida oching:

```sh
npm ci
```

`.env.example` dan `.env.local` nusxa yarating, haqiqiy qiymatlarni kiriting. Lokal manzil `http://localhost:3000` bo‘lsin.

```sh
node --env-file=.env.local scripts/check-env.mjs
npm run dev
```

Test va production build:

```sh
npm test
npm run typecheck
npm run build
npm start
```

`npm run build` uchun haqiqiy kalit talab qilinmaydi, lekin kirish va ma’lumotlarni saqlash ulanishlarsiz ishlamaydi. `tests/sqlite-fixtures` avvalgi API regressiya sinovlari uchun; production baza PostgreSQL. `tests/postgres.test.cjs` PGlite ichida haqiqiy PostgreSQL SQL semantikasini sinaydi.

## 8. Yangiliklar (2.1.0)

- **Baho va sharhlar**: mashq, maqola va videolarda 1–5 yulduzli baho hamda izoh. Tasdiqlangan ota-ona, logoped va administrator yozadi; hamma o‘qiydi. Bir foydalanuvchi — bir material uchun bitta sharh (qayta yozsa yangilanadi). Havola yozib bo‘lmaydi, soatiga 20 tagacha. Kartochkalarda o‘rtacha baho ko‘rinadi. Yangi SQL kerak emas.
- **Administrator → Sharhlar**: barcha sharhlar, o‘rtacha baho, yashirish/ko‘rsatish va o‘chirish.
- **Yuklab olish tugmasi** (yuqori panelda): brauzer ruxsat bersa — saytni ilova sifatida o‘rnatadi (Android, Chrome, Edge); bo‘lmasa (masalan iPhone) — sayt nusxasini bitta `.html` fayl qilib yuklaydi. Nusxa faqat ochiq bosh sahifadan tuziladi, shuning uchun unga hech qanday shaxsiy ma’lumot tushmaydi.
- **Dizayn**: tugmalarda yaltirash, bosilish va yuklanish animatsiyalari, yangi ikonka, qorong‘i rejim va `prefers-reduced-motion` hurmat qilinadi.
- **Vercel**: xavfsizlik sarlavhalari, `robots.txt`, `sitemap.xml`, PWA manifest, oflayn sahifa, `/api/health`.

## Sayt sozlamalarini tekshirish: `/api/health`

Joylangandan keyin brauzerda oching:

- `https://SIZNING-SAYT.vercel.app/api/health` — qaysi sozlama yetishmayotganini ko‘rsatadi (faqat **nomlar**, qiymatlar hech qachon chiqmaydi).
- `https://SIZNING-SAYT.vercel.app/api/health?deep=1` — qo‘shimcha ravishda Supabase Auth va ma’lumotlar bazasiga ulanishni tekshiradi (`reason`: `tls_certificate`, `wrong_credentials`, `host_not_found`, `unreachable`, `tables_missing`, `key_rejected`).

`"ok": true` chiqquncha kirish va ro‘yxatdan o‘tish ishlamaydi.

### «Kirish xizmati sozlanmagan yoki vaqtincha ishlamayapti»

Eski versiyada ushbu bitta xabar hamma xatoni yashirar edi. Endi sabab aniq aytiladi va Vercel → Logs da `[auth/…]` qatorlari ko‘rinadi. Eng ko‘p uchraydigan sabablar:

1. `NEXT_PUBLIC_SUPABASE_URL` yoki `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` Vercel’da yo‘q (yoki **Production** muhitiga qo‘yilmagan).
2. `NEXT_PUBLIC_SITE_URL` `https://` siz yozilgan yoki joriy domen bilan mos emas (masalan `www` farqi).
3. O‘zgaruvchi qo‘shilgandan keyin **Redeploy** qilinmagan: `NEXT_PUBLIC_*` qiymatlari build vaqtida olinadi.
4. Publishable kalit o‘rniga **secret / service_role** kalit qo‘yilgan — sayt buni rad etadi (u brauzerga chiqib ketadi). Uni Supabase’da yangilang.
5. Supabase loyihasi pauza qilingan (bepul tarifda faolsizlik tufayli).

Qiymatdagi ortiqcha bo‘shliq, qator oxiridagi Enter, tirnoq belgilari va `/rest/v1/` qo‘shimchasi endi avtomatik tozalanadi.

## Xatolar

- **routes-manifest.json topilmadi**: Framework Next.js, build `npm run build`, root ichida shu paketning `package.json` bo‘lsin. Eski Vinext fayllari bilan aralashtirmang.
- **«Sayt manzili sozlanmagan»**: Vercel → Settings → Environment Variables → `NEXT_PUBLIC_SITE_URL` = saytingiz manzili (masalan `https://logoped-uz.vercel.app`), so‘ng Redeploy. `https://` yozilmasa ham qabul qilinadi; o‘zgaruvchi umuman bo‘lmasa, Vercel bergan asosiy domen ishlatiladi. Supabase → Authentication → URL Configuration da ham shu manzil bo‘lishi shart.
- **«So‘rov manbasi rad etildi»**: brauzer yuborgan manzil (Origin) saytning manzillaridan biriga mos kelmadi. Endi Host, `x-forwarded-host`, `NEXT_PUBLIC_SITE_URL` va Vercel domenlari qabul qilinadi. Hali chiqsa, Vercel → Logs da `[origin] rejected` qatorini oching: unda rad etilgan va ruxsat berilgan domenlar yoziladi. Odatda `NEXT_PUBLIC_SITE_URL` ni to‘g‘ri domenga o‘zgartirish va Redeploy yetarli.
- **«Tasdiqlash emailini yuborib bo‘lmadi»**: Supabase → Authentication → SMTP sozlamasi to‘g‘ri emas yoki yo‘q.
- **Email kelmayapti**: Confirm Email, SMTP, Site URL, email shablonlari va spam papkasini tekshiring.
- **Hisob ma’lumotlari ochilmadi**: SQL skript ishlatilganmi, DATABASE_URL va TLS sertifikati to‘g‘rimi?
- **Adminni yaratib bo‘lmadi**: tasdiqlangan email ADMIN_EMAIL bilan mos bo‘lsin.
- **Fayl yuklanmadi**: yopiq bucket nomi, server secret key va 4 MiB limitni tekshiring.
- **Urinishlar chegarasi**: 15 daqiqa kuting; kod urinishlari serverda cheklanadi.

Rasmiy manbalar (2026-10-12 tekshirilgan):
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://vercel.com/docs/functions/limitations
