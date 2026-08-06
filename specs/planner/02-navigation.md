# Rural Lodge - Navigation and Localization

## Application Overview

Covers AC2 (Navigation): the top navigation bar (Stay / Offers / Activity) and the language toggle (English / French / Khmer). Exploration on staging confirmed the top nav has exactly three sections - Stay ('/'), Offers ('/offers'), Activity ('/activity') - and that the language toggle is a header icon button (present on every page, including the auth page, both logged-in and logged-out) that opens a 'Select Language' popover with English/French/Khmer radio options. Selecting a language rewrites the URL's locale segment ('/km', '/en', '/fr') and fully translates the header, hero copy, and nav labels (e.g. Stay / Sejour / Khmer script). One nuance for automation: the bare domain root ('/') hard-redirects to '/km' (Khmer) regardless of any previously selected language - locale is carried via the URL path, not a persisted cookie/session, so tests must navigate with an explicit locale prefix rather than assume the last-selected language sticks across a fresh visit to '/'.

## Test Scenarios

### 1. Navigation and Localization

**Seed:** `tests/seed.spec.ts`

#### 1.1. Top nav reaches the Stay (home/search) section

**File:** `tests/rural-lodge-test/navigation/nav-stay.spec.ts`

**Steps:**
  1. Navigate to https://staging-ruralloge.allweb.cloud/en
    - expect: Top nav shows links 'Stay', 'Offers', 'Activity'
  2. Click the 'Stay' nav link
    - expect: The app stays on/returns to the home listing view via client-side navigation (locale segment '/en' is preserved even though the link's raw href is '/')
    - expect: The 'Where do you want to go next?' search hero and lodge-listing carousels are visible

#### 1.2. Top nav reaches the Offers section

**File:** `tests/rural-lodge-test/navigation/nav-offers.spec.ts`

**Steps:**
  1. Navigate to /en, then click the 'Offers' nav link
    - expect: URL becomes '/en/offers'
    - expect: Page title is 'Offers'

#### 1.3. Top nav reaches the Activity section

**File:** `tests/rural-lodge-test/navigation/nav-activity.spec.ts`

**Steps:**
  1. Navigate to /en, then click the 'Activity' nav link
    - expect: URL becomes '/en/activity'
    - expect: Page title is 'Activities'

#### 1.4. Language toggle switches the site to English

**File:** `tests/rural-lodge-test/navigation/language-toggle-en.spec.ts`

**Steps:**
  1. Navigate to https://staging-ruralloge.allweb.cloud/km (Khmer default)
    - expect: Header shows a language icon button alongside 'Manage Your Lodge' equivalent, currency '$', and account icon
  2. Click the language icon button to open the selector, then click the 'English English' option
    - expect: A 'Select Language' panel lists English / French / Khmer as radio options before selection
    - expect: After selecting English, the URL changes to '/en'
    - expect: Nav labels read 'Stay', 'Offers', 'Activity' and the hero heading reads 'Where do you want to go next?'

#### 1.5. Language toggle switches the site to French

**File:** `tests/rural-lodge-test/navigation/language-toggle-fr.spec.ts`

**Steps:**
  1. Navigate to /en, open the language selector, and click the 'French Francais' option
    - expect: URL changes to '/fr'
    - expect: Nav labels become 'Sejour', 'Offres', 'Activite'
    - expect: Hero heading reads 'Ou voulez-vous aller ensuite ?'
    - expect: The 'Manage Your Lodge' button label becomes 'Gerer votre Lodge'

#### 1.6. Language toggle switches the site to Khmer

**File:** `tests/rural-lodge-test/navigation/language-toggle-km.spec.ts`

**Steps:**
  1. Navigate to /fr, open the language selector, and click the 'Khmer' option (native label in Khmer script)
    - expect: URL changes to '/km'
    - expect: Nav labels revert to Khmer script for Stay/Offers/Activity

#### 1.7. Language toggle is present and functional on the login page

**File:** `tests/rural-lodge-test/navigation/language-toggle-auth-page.spec.ts`

**Steps:**
  1. Navigate to /en/auth
    - expect: A language icon button is visible in the top-left of the auth panel, separate from the main site header
  2. Click it and select Khmer (ខ្មែរ) from the 'Select Language' / 'ជ្រើសរើសភាសា' panel
    - expect: URL becomes '/km/auth'
    - expect: Login form text switches to Khmer (heading 'ចូលប្រើគណនីរបស់អ្នក', fields 'អ៊ីមែល', 'ពាក្យសម្ងាត់')
    - expect: The Khmer radio option shows as checked when reopening the language panel

#### 1.8. Direct root URL defaults to the Khmer locale

**File:** `tests/rural-lodge-test/navigation/root-url-default-locale.spec.ts`

**Steps:**
  1. With a fresh browser context (no prior locale selection in this session), navigate to https://staging-ruralloge.allweb.cloud/
    - expect: The app redirects to '/km'
    - expect: This confirms '/' always resolves to the Khmer default rather than remembering a previous language choice; tests that need English or French must navigate to '/en' or '/fr' explicitly rather than '/'

#### 1.9. Header utility icons (language, currency, account, Manage Your Lodge) render consistently across every top-nav section

**File:** `tests/rural-lodge-test/navigation/009_header-consistency-across-sections.spec.ts`

**Steps:**
  1. Visit Stay ('/en'), Offers ('/en/offers'), and Activity ('/en/activity') in turn
    - expect: On every page the header consistently shows: the logo link, the Stay/Offers/Activity nav links, a 'Manage Your Lodge' button, the language toggle icon, a currency '$' button, and the login/account icon
    - expect: No section is missing any of these header elements

#### 1.10. Language toggle is present logged out (regression lock-in for the toggle's own visibility)

**File:** `tests/rural-lodge-test/navigation/010_language-toggle-present-logged-out.spec.ts`

**Added:** Cycle 3, retroactively documented Cycle 4 (script pre-dated this entry).

**Steps:**
  1. Navigate to `/en/auth` with no session
    - expect: The header's 'EN' language toggle button is visible within a generous 15s timeout (this button's accessible name lags slightly behind first paint, per `specs/exploratory-findings.md`)

#### 1.11. Language toggle is present logged in

**File:** `tests/rural-lodge-test/navigation/011_language-toggle-present-logged-in.spec.ts`

**Added:** Cycle 3, retroactively documented Cycle 4 (script pre-dated this entry).

**Steps:**
  1. Log in with `TEST_USER_EMAIL` and land on `/en`
    - expect: The header's 'EN' language toggle button (scoped to the `banner` landmark) is still visible after authentication - the toggle isn't a logged-out-only affordance

#### 1.12. Offers page "Coming Soon" copy bug (documented, asserted as current behavior)

**File:** `tests/rural-lodge-test/navigation/012_offers-page-copy-bug.spec.ts`

**Added:** Cycle 3, retroactively documented Cycle 4 (script pre-dated this entry).

**Steps:**
  1. Navigate to `/en/offers`
    - expect: A 'Coming Soon' heading is visible
    - expect: The body text reads "We are working hard to bring you exciting activities. Stay tuned!" - copy-pasted verbatim from the Activity page and contextually wrong for Offers (see §New findings in `exploratory-findings.md`). Intentionally asserted as-is so a future copy fix changes this test's result rather than going unnoticed.

#### 1.13. Browser Back button unwinds in-app navigation history correctly (new, Cycle 4)

**File:** `tests/rural-lodge-test/navigation/013_browser-back-button-preserves-history.spec.ts`

**Added:** Cycle 4 - closes a real gap versus `user-stories/SCRUM.md`'s Technical Notes ("Test navigation flow and back button behavior"), which no prior script exercised (only in-app link clicks had been covered).

**Steps:**
  1. From `/en`, click 'Offers', then click 'Activity'
    - expect: URL becomes `/en/offers`, then `/en/activity`, in turn
  2. Press the browser's Back button twice
    - expect: First Back returns to `/en/offers` (with the 'Coming Soon' heading visible); second Back returns to `/en` (with the 'Where do you want to go next?' hero visible) - confirming the client-side router's history entries mirror real navigation rather than collapsing/skipping steps
  3. Press Forward once
    - expect: URL returns to `/en/offers`, confirming Back didn't destroy the forward-history entry

Confirmed live via Playwright MCP before automating: this passed cleanly on first exploration - not a defect, a regression lock-in for real browser-history behavior (which client-side routers can get wrong silently).
