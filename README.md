# Pixel GP Racing

> ชื่อแพ็กเกจและตัวระบุภายใน (`@pixel-race/*`, คีย์ `pixel-race.*` ใน localStorage) ยังใช้ชื่อเดิม `pixel-race`

เกมทายผลแข่งรถพิกเซลอาร์ตบนเบราว์เซอร์ ผู้เล่นทายว่ารถสีใดในสี่สีจะเข้าเส้นชัยก่อน
เซิร์ฟเวอร์เป็นแหล่งความจริงของผลลัพธ์และคะแนน ที่เก็บโค้ดนี้เป็น **monorepo**
ที่ใช้ npm Workspaces

> สถานะปัจจุบัน: **Phase 0–7 เสร็จ** ได้แก่ authentication (JWT + Argon2id),
> race engine (สร้าง/เริ่ม/ตัดสินรอบ + คำทาย), เกม Phaser 3, leaderboard/stats/history,
> ชุดเทสต์ Vitest/RTL และ CI ข้อที่ยังค้าง: E2E ด้วย Playwright (6.4, ข้ามไว้โดยตั้งใจ)
> และการ deploy production ของ API (7.4 / Phase 8) ฝั่งเว็บ deploy บน Vercel แล้วในโหมด
> Guest อย่างเดียว (`VITE_AUTH_ENABLED=false`) รายละเอียดดูที่ `IMPLEMENTATION_CHECKLIST.md`

## โหมด Guest (เล่นโดยไม่ต้อง Login)

- เปิด `/play` ได้เลยโดยไม่ต้องเข้าสู่ระบบ หน้า Login และหน้าสมัครมีลิงก์ "เล่นแบบ Guest"
- Guest เล่นครบทุกขั้น (เริ่มรอบ → เลือกสี → ส่งคำทาย → เริ่มแข่ง → ดูผล → รอบถัดไป) ได้ไม่จำกัดรอบ
- ผู้ชนะของ Guest สุ่มในเบราว์เซอร์ (`apps/web/src/features/race/guest-round.ts`) โอกาสเท่ากันสีละ 1/4
- Guest **ไม่เรียก API** ไม่มีคะแนน และไม่บันทึกข้อมูลเกมใด ๆ ผลรอบหายไปเมื่อออกจากหน้า
  แผงผลมีลิงก์ชวนสมัครสมาชิกหรือเข้าสู่ระบบ (สิ่งที่เก็บใน `localStorage` มีเพียงค่าการตั้งค่า UI
  ซึ่งเก็บให้ผู้เล่นทุกคน ได้แก่ `pixel-race.sound`, `pixel-race.lang`, `pixel-race.theme`)
- หน้า `/leaderboard` และ `/profile` ยังต้อง Login ถ้า Guest เปิดจะถูกพาไปหน้า Login
- ไม่มี endpoint ใหม่ใน API และไม่ได้แก้การยืนยันตัวตนเดิม ผู้เล่นที่ Login ยังได้ผลและคะแนนจากเซิร์ฟเวอร์เหมือนเดิม

### ปิดระบบบัญชีทั้งหมด (`VITE_AUTH_ENABLED=false`)

เมื่อ build เว็บด้วย `VITE_AUTH_ENABLED=false` (ตรรกะอยู่ใน `apps/web/src/config/features.ts`)
หน้า `/login`, `/register`, `/leaderboard`, `/profile` จะไม่ถูกลงทะเบียนเลย ทุก path ไปที่ `/play`
และปุ่ม Login/สมัครถูกซ่อน เว็บจึงเป็นโหมด Guest อย่างเดียว ฝั่ง API ไม่ได้รับผลกระทบ

## หน้าเว็บ

กำหนดใน `apps/web/src/App.tsx`

| Path           | ต้องล็อกอิน | หมายเหตุ                             |
| -------------- | ----------- | ------------------------------------ |
| `/`            | ไม่         | Landing Page แนะนำเกม                |
| `/play`        | ไม่         | หน้าเกม (Guest หรือผู้ใช้ที่ Login)  |
| `/login`       | ไม่         | ไม่มีเมื่อ `VITE_AUTH_ENABLED=false` |
| `/register`    | ไม่         | ไม่มีเมื่อ `VITE_AUTH_ENABLED=false` |
| `/leaderboard` | ใช่         | ครอบด้วย `ProtectedRoute`            |
| `/profile`     | ใช่         | ครอบด้วย `ProtectedRoute`            |
| อื่น ๆ         | –           | redirect ไป `/play`                  |

## Landing Page (`/`)

หน้าแนะนำเกมอยู่ใน `apps/web/src/features/landing/` วางตาม `WIREFRAME_LANDING_PAGE.md`:
Header → Hero → ทำไมต้องเล่น → วิธีการเล่น → ภาพบรรยากาศ → CTA ท้าย → Footer
ทุกปุ่ม CTA ไปที่ `/play` ข้อความอยู่ใน section `landing` ของ `apps/web/src/i18n/messages.ts` (ไทย/อังกฤษ)
หน้านี้มี header และ footer ของตัวเอง จึงไม่ได้อยู่ใน `AppLayout`

- **สกรีนช็อต**: วางไฟล์ PNG อัตราส่วน 16:9 (แนะนำ 1280×720) ไว้ที่ `apps/web/public/landing/`
  ชื่อ `hero.png`, `start.png`, `race.png`, `finish.png` ถ้ายังไม่มีไฟล์ หน้าเว็บจะแสดงภาพพิกเซลแทนให้อัตโนมัติ
- **ลิงก์ใน footer**: Discord / X / YouTube / ข้อตกลงการใช้งาน / นโยบายความเป็นส่วนตัว ยังเป็น `#`
  แก้ได้ที่ `apps/web/src/features/landing/landing-content.ts` (ลิงก์ `http(s)` เปิดในแท็บใหม่)
- ประโยคเรื่องการเก็บคะแนนในส่วน "วิธีการเล่น" แสดงเฉพาะเมื่อเปิดระบบบัญชี (`VITE_AUTH_ENABLED` ไม่เป็น `false`)

## หน้าตาและแอนิเมชัน

- **Tailwind CSS v4** ผ่าน `@tailwindcss/vite` (ตรึงเวอร์ชัน 4.3.3) ธีมพิกเซลอยู่ใน `@theme` ของ
  `apps/web/src/index.css` และ class ที่ใช้ซ้ำ (ปุ่ม แผง ช่องกรอก หัวข้อ) อยู่ใน `apps/web/src/app/ui.ts`
- **ฟอนต์** ติดตั้งจาก npm และ bundle มากับแอป ไม่โหลดจากภายนอก (ทั้งคู่เป็น OFL):
  `@fontsource/press-start-2p` (น้ำหนัก 400) สำหรับหัวข้อ ปุ่ม และตัวเลข, `@fontsource/sarabun`
  (400 และ 700) สำหรับเนื้อหา token คือ `--font-pixel: "Press Start 2P", "Sarabun", sans-serif`
  และ `--font-body: "Sarabun", sans-serif` อักษรไทยจึงแสดงด้วย Sarabun
- **สองภาษา ไทย/อังกฤษ** (`apps/web/src/i18n/`) ค่าเริ่มต้นภาษาไทย สลับได้จากเมนู
  และอัปเดต `<html lang>` ตามภาษาที่เลือก
- **ธีมสว่าง/มืด** (`apps/web/src/theme/`) ค่าเริ่มต้นตามการตั้งค่าระบบ (ถ้าไม่มีใช้ธีมมืด)
  สคริปต์ใน `apps/web/index.html` ตั้งธีมก่อน first paint สนามแข่งมีชุดสีของตัวเองใน `game/palette.ts`
- **การแข่ง F1 แบบพิกเซล** (Phaser 3, พื้นที่ 640×360, `pixelArt: true`): รถ F1 4 คันวาดแบบ procedural
  พร้อมล้อหมุนและควัน, อัฒจันทร์คนดูขยับ, ขอบสนามแดงขาวและเส้นถนนเลื่อนระหว่างแข่ง, ธงตาหมากรุกที่เส้นชัย
  กล้องแพนตามสนามที่กว้างกว่าจอ (`game/camera-pan.ts`) และขยายเต็มจอได้เฉพาะสนาม (`game/fullscreen.ts`)
- **เสียง** สร้างสดด้วย Web Audio API ไม่มีไฟล์เสียง (`game/audio/race-audio.ts`): เสียงบี๊ปตอนไฟติด,
  เสียงออกตัว, เสียงเครื่องยนต์ และเสียงฉลองเมื่อเข้าเส้นชัย มีปุ่มเปิด/ปิดเสียงที่จำค่าไว้
- **ไฟสตาร์ท**: ไฟแดง 5 ดวงติดทีละดวงทุก 0.5 วินาที แล้วดับพร้อมกันที่ 2.8 วินาที (ไม่นับในเวลาแข่ง)
- **เวลาแข่ง 15 วินาที**: ผู้ชนะ (จากเซิร์ฟเวอร์ หรือจากเบราว์เซอร์สำหรับ Guest) เข้าเส้นชัยก่อนเสมอที่ 15 วินาทีพอดี
  ระหว่างทางคันนำเปลี่ยนอย่างน้อย 5 ครั้ง ตรรกะนี้เป็นฟังก์ชันล้วนใน `apps/web/src/game/race-plan.ts`
  (ไม่พึ่ง Phaser และมีเทสต์)
- **นิยามการนับคันนำ**: คันนำคือคันที่ `progress` (0–1) มากที่สุด ถ้าเสมอกันถือว่าคันนำเดิมยังนำ
  ช่วงที่ทุกคันยังเสมอกันที่เส้นสตาร์ทไม่นับ และการเปลี่ยนคันนำนับเมื่อคันใหม่นำต่อเนื่องอย่างน้อย 500 ms
  (เทสต์สุ่มตัวอย่างทุก 50 ms)
- **ส่วนประกอบอื่น**: ปุ่มบริจาคลอยอยู่ทุกหน้า (`app/DonateButton.tsx`, ลิงก์จาก `VITE_BUY_ME_A_COFFEE_URL`)
  และ Modal ที่รองรับการเข้าถึง (`app/Modal.tsx`)

## SEO

แผนและเหตุผลอยู่ใน `SEO_PLAN.md` สิ่งที่ทำแล้ว:

- meta Open Graph และ Twitter Card ใน `apps/web/index.html` (`lang="th"`)
- Vite plugin ใน `apps/web/vite.config.ts` (ใช้ helper จาก `apps/web/src/seo/site-meta.ts`)
  เติม `canonical`, `og:url` (ชี้หน้าแรก `/`), `og:image` และ `twitter:image` เมื่อรู้ URL ของเว็บ
  สร้าง `robots.txt` ทุกครั้ง และสร้าง `sitemap.xml` (`/` และ `/play`) เมื่อรู้ URL ของเว็บ
- `useCanonicalPath` (`app/use-document-title.ts`) ปรับ `canonical`/`og:url` ตามหน้าที่เปิดอยู่
  เพื่อไม่ให้ `/play` ถูกมองว่าซ้ำกับหน้าแรก
- URL ของเว็บมาจาก `VITE_SITE_URL` หรือ `VERCEL_PROJECT_PRODUCTION_URL` บน Vercel
- title ของแต่ละหน้าทั้งสองภาษา (`app/use-document-title.ts`)
- `apps/web/public/og-image.png` (1200×630) และ `apps/web/public/favicon.svg`

## โครงสร้างที่เก็บโค้ด

```
.
├── apps/
│   ├── api/                  # Fastify + TypeScript — REST API
│   │   └── src/
│   │       ├── config/       #   อ่านและตรวจ env
│   │       ├── modules/      #   auth, users, races (รวม route คำทาย + settlement), guesses, leaderboard
│   │       ├── plugins/      #   auth (JWT), db, error-handler
│   │       ├── shared/       #   password (Argon2id), errors, clock, db
│   │       └── test-support/
│   └── web/                  # React + TypeScript + Vite + Phaser 3
│       ├── public/           #   favicon, og-image
│       ├── vercel.json       #   คอนฟิก deploy บน Vercel (SPA rewrite)
│       └── src/
│           ├── app/          #   layout, ui, Modal, DonateButton, hooks
│           ├── config/       #   feature flags (VITE_AUTH_ENABLED)
│           ├── features/     #   auth, landing, race, leaderboard, profile
│           ├── game/         #   Phaser wrapper, scenes, textures, race-plan, audio/
│           ├── i18n/         #   ข้อความไทย/อังกฤษ
│           ├── seo/          #   helper สำหรับ meta, robots, sitemap
│           ├── services/     #   API client (แนบ JWT จาก localStorage)
│           ├── theme/        #   ธีมสว่าง/มืด
│           └── test-support/
├── packages/
│   └── shared-types/         # ชนิดข้อมูล + Zod schema ที่ใช้ร่วมกัน
├── database/                 # SQLite + Drizzle
│   ├── src/                  #   schema, connection
│   ├── migrations/           #   ไฟล์ SQL migration
│   ├── scripts/              #   migrate, seed
│   └── tests/
├── .github/workflows/        # CI (lint, typecheck, test, build)
├── IMPLEMENTATION_PLAN.md    # แผนการพัฒนา
├── IMPLEMENTATION_CHECKLIST.md
├── SEO_PLAN.md
├── eslint.config.js
├── tsconfig.base.json
└── package.json
```

CORS ลงทะเบียนใน `apps/api/src/app.ts` และ rate limit อยู่ใน `apps/api/src/modules/auth/auth.routes.ts`

## ความต้องการของระบบ

- Node.js เวอร์ชัน 20 ขึ้นไป (กำหนดใน `engines` ของ `package.json`)
- npm เวอร์ชัน 10 ขึ้นไป (แนะนำ, รองรับ Workspaces)

## เริ่มต้นใช้งาน

```bash
npm install          # ติดตั้ง dependency ทั้งหมดจากราก
npm run db:migrate   # สร้าง/อัปเดตฐานข้อมูล SQLite (ต้องทำก่อนรัน API)
npm run db:seed      # (ไม่บังคับ) ใส่ข้อมูลตัวอย่าง
npm run dev          # รัน API (พอร์ต 3001) และเว็บ (พอร์ต 5173)
```

- **API และสคริปต์ฐานข้อมูลอ่านค่าจาก `process.env` เท่านั้น** ไม่โหลดไฟล์ `.env` ที่รากให้อัตโนมัติ
  `.env.example` เป็นรายการตัวแปรสำหรับอ้างอิง ให้ตั้งค่าเป็น environment variable ของ shell หรือของโฮสต์
  ในโหมด development ใช้ค่าเริ่มต้นได้เลยโดยไม่ต้องตั้งอะไร
- **ฝั่งเว็บ** Vite โหลดค่า `VITE_*` จาก `apps/web/.env`
- API จะไม่ยอมบูตถ้ายังไม่มีไฟล์ฐานข้อมูลหรือยังไม่ได้ migrate (ไม่สร้างไฟล์เปล่าให้)
- ไฟล์ `.env` ถูกใส่ไว้ใน `.gitignore` แล้ว ห้าม commit ค่าลับใด ๆ ในโหมด production
  ต้องตั้ง `JWT_SECRET` เสมอ (API จะไม่ยอมบูตถ้าว่าง) ในโหมด development มีค่า fallback ที่ไม่ปลอดภัยให้อัตโนมัติ

## คำสั่งสำหรับการพัฒนา

| คำสั่ง                | ความหมาย                                           |
| --------------------- | -------------------------------------------------- |
| `npm run dev`         | รัน dev server ของทุก workspace ที่มีสคริปต์ `dev` |
| `npm run dev:api`     | รัน dev server ของ API อย่างเดียว                  |
| `npm run dev:web`     | รัน dev server ของเว็บอย่างเดียว                   |
| `npm run build`       | build ทุก workspace                                |
| `npm run lint`        | ตรวจโค้ดด้วย ESLint ทั้งที่เก็บโค้ด                |
| `npm run typecheck`   | ตรวจชนิดข้อมูล TypeScript ทุก workspace            |
| `npm run test`        | รันเทสต์ทุก workspace                              |
| `npm run db:generate` | สร้างไฟล์ SQL migration จาก Drizzle schema         |
| `npm run db:migrate`  | รัน migration ทั้งหมดกับฐานข้อมูล                  |
| `npm run db:seed`     | ใส่ข้อมูลตัวอย่างสำหรับการพัฒนา (idempotent)       |

### รันเฉพาะบาง workspace

```bash
npm run dev     --workspace apps/api
npm run dev     --workspace apps/web
npm run start   --workspace apps/api     # รัน API จาก dist/ หลัง build
npm run preview --workspace apps/web     # เปิดดูเว็บที่ build แล้ว
npm run test    --workspace @pixel-race/api
npm run test    --workspace @pixel-race/database
npm run test    --workspace @pixel-race/web
```

## ค่าคอนฟิก (environment variables)

### API และฐานข้อมูล

| ตัวแปร           | ค่าเริ่มต้น                         | คำอธิบาย                                                       |
| ---------------- | ----------------------------------- | -------------------------------------------------------------- |
| `PORT`           | `3001`                              | พอร์ตที่ API รับฟัง (จำนวนเต็ม 0–65535)                        |
| `HOST`           | `0.0.0.0`                           | interface ที่ API ผูกไว้                                       |
| `NODE_ENV`       | `development`                       | ชื่อสภาพแวดล้อมการทำงาน                                        |
| `JWT_SECRET`     | _(dev fallback)_                    | คีย์เซ็น JWT — **บังคับใน production**                         |
| `JWT_EXPIRES_IN` | `15m`                               | อายุ access token (ไม่มี refresh token)                        |
| `CORS_ORIGINS`   | `http://localhost:5173`             | origin ที่อนุญาต (คั่นด้วย comma)                              |
| `DATABASE_PATH`  | `<repo>/database/pixel-race.sqlite` | ไฟล์ SQLite; path สัมพัทธ์อิงรากที่เก็บโค้ด, รองรับ `:memory:` |

### เว็บ (`apps/web/.env`)

| ตัวแปร                          | ค่าเริ่มต้น             | คำอธิบาย                                                    |
| ------------------------------- | ----------------------- | ----------------------------------------------------------- |
| `VITE_API_BASE_URL`             | `http://localhost:3001` | URL ของ API                                                 |
| `VITE_AUTH_ENABLED`             | เปิด                    | `false`/`0`/`off`/`no` = โหมด Guest อย่างเดียว              |
| `VITE_BUY_ME_A_COFFEE_URL`      | ลิงก์ตัวอย่าง           | ลิงก์ของปุ่มบริจาค                                          |
| `VITE_SITE_URL`                 | _(ว่าง)_                | URL ของเว็บสำหรับ canonical, og:image, sitemap              |
| `VERCEL_PROJECT_PRODUCTION_URL` | _(Vercel ตั้งให้)_      | ใช้แทน `VITE_SITE_URL` ตอน build บน Vercel ถ้าไม่ได้ตั้งไว้ |

## API

ใช้ prefix แบบมีเวอร์ชัน `/api/v1` ทุก endpoint (ยกเว้น auth และ health) ต้องแนบ
`Authorization: Bearer <token>` รูปแบบ error เป็นมาตรฐานเดียวกัน
`{ "error": { "code": "...", "message": "..." } }`

| Method | Path                            | ต้องล็อกอิน | คำอธิบาย                                            |
| ------ | ------------------------------- | ----------- | --------------------------------------------------- |
| `GET`  | `/api/v1/health`                | ไม่         | ตรวจสถานะบริการ                                     |
| `POST` | `/api/v1/auth/register`         | ไม่         | สมัครสมาชิก (rate-limited), คืน user + token        |
| `POST` | `/api/v1/auth/login`            | ไม่         | เข้าสู่ระบบ (rate-limited), คืน user + token        |
| `GET`  | `/api/v1/users/me`              | ใช่         | ข้อมูลผู้ใช้ปัจจุบัน (ไม่มี password hash)          |
| `GET`  | `/api/v1/users/me/stats`        | ใช่         | สถิติ: คะแนนรวม, รอบที่จบ, ทายถูก, ความแม่นยำ       |
| `GET`  | `/api/v1/users/me/history`      | ใช่         | ประวัติการแข่งแบบ paginated                         |
| `POST` | `/api/v1/races`                 | ใช่         | สร้างรอบใหม่ (สุ่มผู้ชนะ + ซ่อนไว้)                 |
| `GET`  | `/api/v1/races/current`         | ใช่         | รอบ OPEN ล่าสุดของผู้เล่น                           |
| `GET`  | `/api/v1/races/:raceId`         | ใช่         | สถานะรอบ (เจ้าของเท่านั้น, ซ่อน winner ก่อน settle) |
| `POST` | `/api/v1/races/:raceId/start`   | ใช่         | เริ่มแข่ง: OPEN → RUNNING (ปิดรับคำทาย)             |
| `POST` | `/api/v1/races/:raceId/guesses` | ใช่         | ส่งคำทาย (เฉพาะตอน OPEN, กันซ้ำ)                    |
| `POST` | `/api/v1/races/:raceId/settle`  | ใช่         | ตัดสินผล + ให้คะแนน (idempotent)                    |
| `GET`  | `/api/v1/leaderboard`           | ใช่         | อันดับ `all-time`/`daily` + pagination              |

## ความปลอดภัย

- ตรวจทุก input ด้วย Zod; error envelope มาตรฐานผ่าน centralized error handler
- รหัสผ่าน hash ด้วย Argon2id ไม่เก็บ/ไม่คืน plaintext หรือ hash
- JWT อายุสั้น, `JWT_SECRET` มาจาก env; CORS จำกัดด้วย `CORS_ORIGINS`
- rate limiting เฉพาะ auth endpoints (register/login) ที่ 10 ครั้งต่อนาที
- การ settle ทำใน transaction เดียวและ idempotent (unique constraint บน score_ledger)

## ฐานข้อมูล (SQLite + Drizzle ORM)

ทุก connection เปิด foreign-key enforcement และรองรับ transaction
เก็บเวลาเป็น ISO-8601 UTC; การคำนวณขอบเขต daily leaderboard ใช้ Asia/Bangkok (UTC+7)

| ตาราง          | หน้าที่                                     | ข้อจำกัดสำคัญ                                    |
| -------------- | ------------------------------------------- | ------------------------------------------------ |
| `users`        | บัญชีผู้เล่น                                | `username`, `email` ไม่ซ้ำ                       |
| `races`        | รอบการแข่ง (`OPEN` / `RUNNING` / `SETTLED`) | มี `owner_id` (ลบตามผู้ใช้); ซ่อน `winner_color` |
| `guesses`      | คำทายของผู้เล่น                             | ไม่ซ้ำที่ `(race_id, user_id)`                   |
| `score_ledger` | คะแนนที่ได้รับต่อรอบ                        | ไม่ซ้ำที่ `(race_id, user_id)`                   |

Migration อยู่ใน `database/migrations/`: `0000` สร้างตารางเริ่มต้น และ `0001` เพิ่ม `races.owner_id`
มี index สำหรับคิวรีที่ใช้บ่อย ได้แก่ `races_owner_status_idx`, `guesses_user_idx`,
`score_ledger_user_idx` และ `score_ledger_user_created_idx`

## การทดสอบ

ใช้กลยุทธ์ Minimal (test-after) ด้วย Vitest:

- **Database**: เทสต์สคีมา (migration บน DB ในหน่วยความจำ), FK, unique, rollback
- **API**: unit ของ business logic (สุ่มผู้ชนะ, scoring 1/0, settle idempotent,
  state transition, leaderboard ordering/tie-break, accuracy) + integration ผ่าน
  Fastify `inject()` (register→login→me, ซ่อน winner, guess dedup/หลังปิดรับ, settle)
- **Frontend**: RTL happy-path (login validation, car selection, guess submit กันซ้ำ,
  result render, leaderboard render, Phaser wrapper cleanup โดย mock `phaser`),
  ตรรกะการแข่ง (`race-plan`: ผู้ชนะเข้าก่อนที่ 15 วินาที, คันนำเปลี่ยน ≥ 5 ครั้ง, ไม่ถอยหลัง),
  การสุ่มของ Guest (`guest-round`), โหมด Guest ใน PlayPage (ไม่เรียก API, ไม่มีคะแนน),
  เมนูของ Guest/ผู้ใช้ที่ Login และการกันเส้นทาง `/leaderboard`, `/profile`
- ยังไม่มี E2E (Playwright)

```bash
npm run test                                    # ทุก workspace
npm run test --workspace @pixel-race/api        # เฉพาะ API
npm run test --workspace @pixel-race/database   # เฉพาะฐานข้อมูล
npm run test --workspace @pixel-race/web        # เฉพาะเว็บ
```

## Continuous Integration

`.github/workflows/ci.yml` รันทุก push/PR ไปยัง `main` บน `ubuntu-latest` ด้วย Node 20:
`npm ci` → `lint` → `typecheck` → `test` → `build` ล้มเหลวขั้นใดขั้นหนึ่งถือว่า CI ไม่ผ่าน
(CI ไม่ได้รัน migration กับฐานข้อมูลจริง)

## การ deploy

### เว็บ (apps/web) — ใช้งานอยู่บน Vercel

- คอนฟิกอยู่ใน `apps/web/vercel.json`: framework `vite`, output `dist`, rewrite ทุก path ไป `/index.html`
- ตั้ง Root Directory ของโปรเจกต์ Vercel เป็น `apps/web`
- ตั้ง env ตอน build: `VITE_AUTH_ENABLED=false` (ตราบใดที่ยังไม่มี API บน production),
  `VITE_BUY_ME_A_COFFEE_URL` และ `VITE_SITE_URL` (หรือใช้ `VERCEL_PROJECT_PRODUCTION_URL` ที่ Vercel ตั้งให้)
- ถ้าจะเปิดระบบบัญชี ให้ตั้ง `VITE_API_BASE_URL` ชี้ไปยัง URL ของ API แล้ว build ใหม่

### API (apps/api) — ยังไม่ deploy (แนวทางที่แนะนำ)

1. `npm run build --workspace apps/api` ได้ `apps/api/dist` แล้วรันบนโฮสต์ Node.js ที่มี persistent volume
   ตั้ง `JWT_SECRET`, `CORS_ORIGINS`, `DATABASE_PATH`, `NODE_ENV=production`
   > ข้อควรระวัง: `@pixel-race/database` และ `@pixel-race/shared-types` ชี้ `main` ไปที่ไฟล์ `.ts`
   > การรัน `node apps/api/dist/server.js` ตรง ๆ บน Node 20 จึงอาจ import ไม่ได้
   > ต้อง bundle API หรือ build แพ็กเกจเหล่านั้นเป็น JavaScript ก่อน deploy จริง
2. **Database:** วางไฟล์ SQLite บน volume ถาวร (นอกโฟลเดอร์ static ที่เสิร์ฟสาธารณะ)
   รัน `npm run db:migrate` ก่อนสตาร์ท API; สำรองไฟล์ `.sqlite` เป็นระยะ
3. **ความพร้อมใช้งาน:** API มี `GET /api/v1/health` สำหรับ health check,
   แนบ `x-request-id` ทุกคำขอ, และ graceful shutdown เมื่อได้รับ SIGINT/SIGTERM
4. **HTTPS:** ให้ reverse proxy/platform จัดการ TLS; อย่าเปิด API ด้วย HTTP บน production

**Rollback:** เว็บย้อนกลับได้ด้วยการ promote deployment ก่อนหน้าใน Vercel ฝั่ง API ให้เก็บ build เดิมไว้
และกู้คืนไฟล์ฐานข้อมูลจาก backup หากจำเป็น เนื่องจาก migration เป็น forward-only
ให้สำรองไฟล์ `.sqlite` ก่อนทุกครั้งที่ migrate
