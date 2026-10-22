# แผนงาน SEO: Pixel GP Racing

## เป้าหมาย

ทำให้คนค้นเจอเกมจากคำทั่วไป (เช่น "เกมทายผลแข่งรถ") และให้ลิงก์ที่แชร์ใน LINE, Facebook และ X แสดงชื่อ คำอธิบาย และรูปตัวอย่าง

## สิ่งที่มีอยู่แล้ว

- `<title>` ที่มีชื่อเกมและคำอธิบาย, `meta description`, `theme-color` และ favicon (`apps/web/index.html`)
- `<html lang>` เปลี่ยนตามภาษาที่เลือก (`src/i18n/i18n-context.tsx`)

## ข้อจำกัดที่ต้องรู้

- **เว็บเป็น SPA**: ทุกหน้าใช้ `index.html` ไฟล์เดียว (`vercel.json` rewrite ทุก path ไปที่ไฟล์นี้) Google รัน JavaScript ได้ จึงเห็น title ที่ตั้งตามหน้า แต่ LINE และ Facebook ไม่รัน JavaScript ตอนสร้างการ์ดลิงก์ จะเห็นแค่ meta ใน `index.html` ทุกหน้าจึงได้การ์ดเดียวกัน ซึ่งพอสำหรับเกมนี้ เพราะหน้าที่เปิดให้ทุกคนเข้าได้มีแค่ `/play`
- **หน้าที่ควรให้ค้นเจอมีแค่ `/play`**: ส่วน `/` จะเด้งไป `/play` ส่วน `/leaderboard` กับ `/profile` ต้องล็อกอินก่อน และตอนนี้ปิดระบบบัญชีไว้ (`VITE_AUTH_ENABLED=false`) ทำให้ไม่มี route `/login`, `/register`, `/leaderboard` และ `/profile` เลย
- **ยังไม่ได้ซื้อ domain** (ยังใช้ `*.vercel.app`): `og:url`, `og:image` และ sitemap ต้องใช้ URL เต็ม จึงอ่านจาก env ตอน build ตามลำดับนี้
  1. `VITE_SITE_URL` ถ้าตั้งไว้ (ใช้ตอนมี domain ของตัวเองในอนาคต)
  2. `VERCEL_PROJECT_PRODUCTION_URL` ซึ่ง Vercel ตั้งให้อัตโนมัติตอน build เช่น `pixel-gp-racing.vercel.app`
  3. ถ้าไม่มีทั้งสองค่า (เช่น build ในเครื่อง) จะไม่ใส่แท็กที่ต้องใช้ URL เต็ม และไม่ใส่บรรทัด `Sitemap:` ใน robots.txt แต่ build ยังผ่านตามปกติ

## งานที่จะทำ

### 1. Open Graph และ Twitter card (ค่าคงที่ใน `index.html`)

เพิ่ม meta ที่ไม่ต้องใช้ URL เต็ม:

- `og:type=website`, `og:site_name=Pixel GP Racing`, `og:locale=th_TH`
- `og:title` และ `og:description` ใช้ข้อความเดียวกับ `<title>` และ `description` ที่มีอยู่
- `twitter:card=summary_large_image`

### 2. Vite plugin สำหรับ SEO (ส่วนที่ต้องใช้ URL เต็ม)

- **`apps/web/src/seo/site-meta.ts`** เป็นฟังก์ชันล้วนที่ไม่แตะ DOM ประกอบด้วย:
  - `resolveSiteUrl(env)`: เลือก URL ตามลำดับในหัวข้อข้อจำกัด และตัด `/` ท้ายออก
  - `buildHeadTags(siteUrl)`: คืน `canonical`, `og:url` และ `og:image`/`twitter:image` (ชี้ไปที่ `/og-image.png`) พร้อม `og:image:width/height/alt`
  - `buildRobotsTxt(siteUrl)` และ `buildSitemapXml(siteUrl)` โดย sitemap จะมีแค่ `/play`
- **`vite.config.ts`** เพิ่ม plugin เล็กๆ ที่
  - ใช้ `transformIndexHtml` ใส่แท็กจาก `buildHeadTags` ลงใน `<head>`
  - ใช้ `generateBundle` สร้างไฟล์ `robots.txt` และ `sitemap.xml` ใน `dist/`
- เพิ่ม `src/seo/site-meta.ts` ใน `include` ของ `tsconfig.node.json` เพราะ `vite.config.ts` import ไฟล์นี้
- ประกาศ `VITE_SITE_URL` ใน `src/vite-env.d.ts` และ `.env.example`

### 3. รูปตอนแชร์ลิงก์ (`apps/web/public/og-image.png`, 1200×630)

- Facebook และ LINE ไม่รองรับ SVG จึงต้องเป็น PNG
- ออกแบบเป็นหน้า HTML ใช้ฟอนต์ Press Start 2P และ Sarabun จาก `node_modules/@fontsource` พื้นหลังสี ink `#10131a`
- องค์ประกอบในรูป:
  - ชื่อเกม "PIXEL GP RACING"
  - คำโปรย "ทายว่ารถสีไหนเข้าเส้นชัยก่อน"
  - รถพิกเซล 4 สี (แดง เหลือง ฟ้า ขาว) วาดแบบเดียวกับ favicon
  - ธงตาหมากรุก
- เรนเดอร์เป็น PNG ครั้งเดียวด้วย Microsoft Edge แบบ headless (`--screenshot`) แล้ว commit ไฟล์ PNG ไว้ ไม่ต้องเพิ่ม dependency ใหม่

### 4. title แยกตามหน้า (รองรับไทย/อังกฤษ)

- เพิ่ม hook `useDocumentTitle(title)` ใน `src/app/use-document-title.ts` ตั้ง `document.title` ทุกครั้งที่หน้าเปลี่ยนหรือเปลี่ยนภาษา
- เพิ่มคีย์ `seo.tagline` ใน `messages.ts` ทั้งสองภาษา:
  - ไทย: "เกมทายผลแข่งรถ F1 พิกเซล"
  - อังกฤษ: "Pixel F1 race prediction game"
- รูปแบบ title ที่ได้:
  - `/play`: `Pixel GP Racing - เกมทายผลแข่งรถ F1 พิกเซล` (ตรงกับ `index.html`)
  - หน้าอื่น: `<ชื่อหน้า> | Pixel GP Racing` โดยใช้ชื่อหน้าที่มีอยู่แล้วใน `messages.ts` (`nav.leaderboard`, `nav.profile`, `common.login`, `common.register`)

## เทสต์

- `src/seo/site-meta.test.ts`: ลำดับการเลือก URL, การตัด `/` ท้าย, กรณีไม่มี URL (ต้องไม่มี `Sitemap:`/canonical) และ XML ของ sitemap มีแค่ `/play`
- `src/app/use-document-title.test.tsx`: title ถูกต้องทั้งภาษาไทยและอังกฤษ และเปลี่ยนตามเมื่อสลับภาษา

## วิธีตรวจหลังทำเสร็จ

1. รัน `VITE_SITE_URL=https://example.vercel.app npx vite build` แล้วเปิด `dist/index.html` ดูว่ามี canonical/og:url/og:image ที่ใช้ URL เต็ม และมี `dist/robots.txt` กับ `dist/sitemap.xml`
2. รัน `npx vite build` แบบไม่ตั้ง URL แล้วดูว่า build ผ่าน และไม่มีแท็กที่ใช้ URL เต็ม
3. รัน `npx vitest run src/seo src/app` ให้ผ่าน
4. หลัง deploy ขึ้น Vercel แล้ว ตรวจการ์ดลิงก์ด้วย [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) และส่ง sitemap ใน Google Search Console

## ที่ไม่อยู่ในแผนนี้

- Server-side rendering หรือ prerender (เกินจำเป็น เพราะมีหน้าสาธารณะหน้าเดียว)
- แก้ปัญหา `RunningStatus` ใน `PlayPage.tsx` ที่ทำให้ `npm run build` และเทสต์ 8 ตัวพัง (เป็นปัญหาที่มีอยู่ก่อน แยกทำอีกงาน)

