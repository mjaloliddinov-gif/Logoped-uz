# Tekshiruv natijalari

2026-10-13, 2.1.1 versiya.

## Bu muhitda bajarilgan va o‘tgan

- `tests/api` 222, `admin-security` 56, `auth-account` 53 (17 edi), `reviews` 40 (yangi), `origin` 23 (yangi: CSRF va Vercel domenlari), `api-client` 9, `assistant` 32, `permissions` 8 va `preferences` 73 tekshiruv o‘tdi.
- Yangi sharh API: ruxsatlar, bir foydalanuvchi — bir sharh, havola/uzunlik/baho tekshiruvi, yashirin sharh tahrirdan keyin ochilib ketmasligi, email va egasi ID si chiqmasligi, administrator moderatsiyasi, soatlik limit.
- Kirish xatolari: sozlama yo‘qligi, Supabase uzilishi, email tasdiqlanmagan, SMTP, limit, zaif parol, sayt manzili mosligi alohida kod va xabar bilan qaytadi; parol va email loglarga yozilmaydi.
- Yangi komponentlar (`Reviews`, `ReviewModeration`, `InstallButton`) uz/ru/en tillarida birinchi renderdan o‘tdi.
- Oflayn nusxa generatori haqiqiy Chromium’da sinaldi (17 tekshiruv): skript yo‘q, cookie yuborilmaydi, rasmlar ichiga joylanadi, fayl internetsiz ochiladi.

## Bu muhitda bajarilmagan

Tarmoq yopiq bo‘lgani uchun `npm ci`, `npm run build`, `npm run typecheck` va PGlite sinovlari (`tests/postgres.test.cjs`) bu yerda ishga tushirilmadi; faqat sintaksis va bog‘liqliksiz modullarning qat’iy tur tekshiruvi o‘tdi. Joylashdan oldin o‘z kompyuteringizda quyidagini bajaring:

```
npm ci
npm run typecheck
npm test
npm run build
```

Haqiqiy Supabase/Vercel, email yuborish, jonli sharhlar oqimi, yulduzlar va yangi CSS ning telefon/kompyuterdagi ko‘rinishi hali ko‘zdan kechirilmagan.
