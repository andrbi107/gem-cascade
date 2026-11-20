# Gem Cascade

> یک پازل match-3 جواهر با cascade، specialهای line-clearer و bomb، و ۱۲ مرحله — PWA با Vanilla JS.

[![Version](https://img.shields.io/badge/version-v0.0.4-blue)](https://github.com/andrbi107/gem-cascade/releases/tag/v0.0.4) [![PWA](https://img.shields.io/badge/PWA-installable-purple)](https://andrbi107.github.io/gem-cascade/) [![deps](https://img.shields.io/badge/deps-Howler.js_local-blueviolet)](https://github.com/andrbi107/gem-cascade) [![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

🎮 **[بازی کن](https://andrbi107.github.io/gem-cascade/)** — نسخه‌ی آنلاین روی GitHub Pages
📦 **[مخزن گیت‌هاب](https://github.com/andrbi107/gem-cascade)** · 🏷️ **[Release v0.0.4](https://github.com/andrbi107/gem-cascade/releases/tag/v0.0.4)**

---

## تغییرات v0.0.2 (جدید)

**Gem Cascade** — ۳ سطح جدید (۱۳-۱۵) با مکانیک frost: روی این سطح‌ها همه‌ی امتیازهای cascade ×۲ محاسبه می‌شوند. haptic روی هر cascade.

**همه‌ی بازی‌ها** — `mobile-ux.js` مشترک (haptics/install prompt/version stamp) + cache sw.js به v2.

---

## تغییرات v0.0.4 (جدید)

(v0.0.4 فقط کیت مشترک؛ گیم‌پلی v0.0.3 حفظ شد: شکل متمایز ترکیب‌های ۴تایی+ + پیشرفت مرحله‌ای).

**همه‌ی بازی‌ها (v0.0.4)** — `gamekit.js` مشترک + `vendor/howler.min.js` محلی: صدای Howler با SFX خودکار (pickup/collision/game-over از طریق پل MUX)، صفحه‌ی **راهنما**، صفحه‌ی **تنظیمات** (قطع/وصل صدا)، قلاب‌های تست (`render_game_to_text`/`advanceTime`)، **فول‌اسکرین** (کلید F)، و سیستم **دستاوردها**. cache سرویس‌ورکر به v4 ارتقا یافت (آفلاین کامل با vendor).

---

## تغییرات v0.0.3

**Gem Cascade** — جواهرهای ترکیب ۴تایی+ حالا شکل متمایز دارند (پرتو نوری دوطرفه برای line-clearer، ستاره‌ی ۸پر + هاله برای bomb).

---

## معرفی

Gem Cascade یک پازل match-3 ۸×۸ با هویت جواهر است. شش نوع جواهر تخته را پر می‌کنند، هر کدام به‌صورت یک چندضلعی facet رسم می‌شود: Ruby (هگزاگون red)، Sapphire (diamond blue)، Emerald (octagon green)، Topaz (مثلث yellow)، Amethyst (pentagon purple)، Pearl (دایره white). هر جواهر با primitives کانواس فقط رسم می‌شود — outline تیره، بدنه‌ی facet اصلی، برش‌های facet داخلی، highlight بالا-چپ، و نقطه‌ی sparkle.

هدف پاک‌کردن ۱۲ مرحله است، هر کدام با امتیاز هدف و محدودیت حرکت. بازیکن دو جواهر مجاور swap می‌کند؛ اگر swap یک ردیف/ستون از سه یا بیشتر بسازد، آن‌ها پاک می‌شوند، جواهرهای بالا می‌افتند، جواهرهای جدید از بالا spawn می‌شوند، و هر match جدید با افت cascade خودکار است — هر cascade در یک حرکت، ضریب combo را بالا می‌برد.

## ویژگی‌ها

- **match-3 با cascade** — هر cascade ضریب combo را ×۱، ×۲، ×۳... بالا می‌برد.
- **۲ special** — line clearer (match ۴، کل ردیف/ستون را پاک می‌کند) و bomb (match ۵ یا L/T، ۳×۳ را پاک می‌کند).
- **chain specialها** — انفجار یک special می‌تواند specialهای دیگر را در blast زنجیره کند.
- **۱۲ مرحله** با امتیاز هدف و محدودیت حرکت (مرحله‌ی ۱: ۵۰۰ در ۱۵ حرکت → مرحله‌ی ۱۲: ۸۰۰۰ در ۲۵ حرکت).
- **deadlock detection** — اگر swap معتبری نباشد، تخته reshuffle می‌شود.
- **progress persist** — `localStorage['gemCascade.progress']` مرحله‌ی unlock‌شده و بهترین امتیاز هر مرحله.
- **تخته responsive** — از ۳۷۵px portrait تا دسکتاپ.
- **کنترل کامل تاچ + کیبورد + موس**.
- **PWA آفلاین**.

## نحوه‌ی بازی

| دستگاه | انتخاب/swap | توقف |
|---|---|---|
| **تاچ** | tap یک جواهر سپس tap جواهر مجاور، یا swipe یک جواهر به سمت همسایه | — |
| **کیبورد** | ←/→/↑/↓ یا WASD مکان‌نمای طلا · Enter/Space انتخاب، سپس جهت + Enter swap | Esc |
| **موس** | کلیک یک جواهر سپس کلیک جواهر مجاور · کلیک مجدد روی انتخاب = deselect | — |

### مکانیک بازی

- **تخته**: ۸×۸، ۶ نوع. مقداردهی اولیه همواره بدون match پیش‌زمینه و با حداقل یک حرکت معتبر است.
- **swap**: دو جواهر غیر-special فقط اگر match بسازند swap می‌شوند؛ swap یک special همیشه معتبر و آن را منفجر می‌کند.
- **match detection**: runهای ≥۳ افقی/عمودی در clusterهای هم‌نوع merge می‌شوند.
- **special creation**: cluster با ۴-in-a-row → line clearer؛ cluster با ۵+ یا L/T → bomb.
- **امتیاز**: base ۳→۳۰، ۴→۴۰، ۵+→۶۰ × combo؛ bonus line clearer +۵۰، bomb +۸۰ (هم ×combo).
- **gravity & refill**: خانه‌های پاک‌شده null، ستون‌ها compact، خانه‌های خالی بالا با جواهر جدید (با موقعیت شروع بالای تخته).
- **cascade loop**: پس از clear+gravity، تخته دوباره چک می‌شود؛ تا وقتی match باشد، combo بالا و clear تکرار می‌شود.
- **مراحل**: ۱۲ مرحله با target و moves؛ رسیدن به target قبل از اتمام moves = کلیر.
- **persist**: `localStorage['gemCascade.progress']`.

## نصب روی موبایل/دسکتاپ (PWA)

1. لینک بازی را در **Chrome** یا **Edge** باز کنید (اندروید/دسکتاپ) یا **Safari** (iOS).
2. منوی مرورگر → **Install app** / **Add to Home screen** (اندروید) یا **Share → Add to Home Screen** (iOS).
3. آیکن روی صفحه‌ی اصلی ظاهر می‌شود؛ اجرای آن تمام‌صفحه و مستقل از مرورگر است.
4. پس از اولین بارگذاری، بازی **بدون اینترنت** هم کار می‌کند (service worker کل shell را cache کرده است).

## تکنولوژی

- **HTML5 `<canvas>`** — تمام رندر با primitives (`arc`, `fillRect`, `translate`, `rotate`, `shadowBlur`).
- **Vanilla JavaScript** — بدون هیچ کتابخانه، framework یا CDN.
- **CSS** با `clamp()` برای تایپوگرافی responsive، `safe-area-inset` برای notch موبایل، و `100dvh`.
- **PWA**: `manifest.json` + `sw.js` (service worker که کل shell را precache می‌کند) → بازی پس از اولین بارگذاری **کاملاً آفلاین** و **قابل نصب** روی اندروید/iOS/دسکتاپ است.
- بدون تصویر، فونت یا فایل صوتی خارجی — همه‌چیز با کد تولید می‌شود.

## ساختار پروژه

| فایل | نقش |
|---|---|
| `index.html` | HUD + canvas + overlay صفحه‌ها |
| `styles.css` | responsive (clamp، flex/grid، 100dvh، safe-area) |
| `main.js` | کل بازی: تخته، match detection، specialها، cascade، ذرات، render، input، state machine، loop |
| `manifest.json` | PWA، `orientation:portrait` |
| `sw.js` | precache shell و سرو آفلاین |
| `icon.svg` | diamond sapphire آبی روی مربع dark-slate |

## شخصی‌سازی

تمام tunableها بالای `main.js`:

- `GRID` (۸) — اندازه‌ی تخته (مربع نگه‌دارید).
- `NUM_TYPES` (۶) و آرایه `GEMS` — اضافه/حذف نوع جواهر، recolor هر gem (`primary`/`light`/`dark`) و تغییر `shape`.
- `SHAPES` — تعداد اضلاع و چرخش هر shape.
- `LEVELS` — `target` و `moves` هر مرحله؛ اضافه/حذف برای تغییر تعداد مراحل.
- `sizeBase(total)` (۳→۳۰، ۴→۴۰، ۵+→۶۰) و bonusهای special در `expandSpecials`.
- قوانین special در `findMatches`.
- timing انیمیشن: `phaseDur` در `attemptSwap`.
- `STORAGE_KEY` (`gemCascade.progress`).

## توسعه و اجرای محلی

```bash
git clone https://github.com/andrbi107/gem-cascade.git
cd gem-cascade
# سرویس‌ورکر فقط روی http(s) ثبت می‌شود، پس یک سرور محلی راه بیندازید:
python3 -m http.server 8080
# سپس http://localhost:8080/ را در مرورگر باز کنید
```

برای آزمایش روی موبایل، می‌توانید پوشه را روی گوشی با یک سرور استاتیک سرو کنید یا از `ngrok`/مرورگر موبایل روی همان شبکه استفاده کنید.

## استقرار

محتوای شاخه‌ی `main` به‌صورت خودکار از طریق **GitHub Pages** سرو می‌شود:

**https://andrbi107.github.io/gem-cascade/**

هیچ build stepی لازم نیست — همه‌ی مسیرها relative هستند (`./`)، پس بازی هم از root مخزن و هم از زیرپوشه کار می‌کند.

## نسخه‌گذاری (SemVer)

این پروژه از [Semantic Versioning](https://semver.org/lang/fa/) پیروی می‌کند:

- نسخه‌ها از **`0.0.1`** آغاز می‌شوند (مرحله‌ی پیش از پایداری نهایی؛ هر تغییر می‌تواند breaking باشد).
- قالب: `MAJOR.MINOR.PATCH` → در فاز 0.x: `0.MINOR.PATCH`.
- **هر توسعه یا شخصی‌سازی** در یک شاخه‌ی جداگانه انجام می‌شود:
  - `feat/<name>` برای قابلیت جدید یا شخصی‌سازی
  - `fix/<name>` برای رفع باگ
  - `docs/<name>` برای مستندسازی
  - `refactor/<name>` برای بازسازمان‌دهی کد
- پس از merge به `main`، تگ SemVer بعدی زده می‌شود و یک **GitHub Release** منتشر می‌گردد.
- RELEASE NOTES هر بار در صفحه‌ی Releases مخزن ثبت می‌شود.

### نقشه‌ی نسخه‌بندی پیشنهادی برای توسعه‌های بعدی

| نوع تغییر | bump | مثال |
|---|---|---|
| رفع باگ کوچک، tweak رنگ/عدد | PATCH | `0.0.1` → `0.0.2` |
| قابلیت جدید، مکانیک جدید، level جدید | MINOR | `0.0.1` → `0.1.0` |
| بازنویسی API/ساختار، تغییر breaking | MAJOR (هنوز در 0.x) | `0.1.0` → `0.2.0` |
| رسیدن به پایداری نهایی | — | `0.x.0` → `1.0.0` |

## لایسنس

MIT — استفاده، تغییر و بازنشر آزاد. ساختهشده بهعنوان یک مهارت/قالب آموزشی برای بازی‌سازی PWA با Vanilla JS.
