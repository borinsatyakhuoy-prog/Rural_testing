import { test, expect, type Page, type Locator } from '@playwright/test';
import path from 'path';

/**
 * Lodge Owner CRUD: Create -> List/Read -> Edit -> Delete, run serially against ONE lodge created
 * in the first test (its randomized/timestamped name is shared via closure across the suite).
 * Kept as a single file (rather than one-scenario-per-file like the rest of this suite) because
 * tests 2-4 have a genuine DATA dependency on the lodge test 1 creates - Playwright test files
 * can't share in-memory state via closures across files.
 *
 * Based on the previously-debugged reference script
 * `C:\Users\khuoybo\Downloads\Project\Rural_lodge_testing\tests\001_ Create_Lodge.spec.ts`, updated
 * per `specs/exploratory-findings.md` ("Lodge Owner CRUD" section):
 *  - the lodge-name field's real placeholder is "Enter the loge name" (not "lodge name")
 *  - the wizard auto-persists a Draft row progressively, even before final submit
 *  - a bare `.gm-style` map click can hang/crash the browser context - guarded here with a single
 *    bounded, force-clicked attempt instead of the reference script's unguarded click
 *  - there is no Archive/Deactivate, only a hard Delete via the row kebab menu
 *
 * Uses TEST_USER_EMAIL/TEST_USER_PASSWORD (the main account, which already owns 40+ lodges on
 * staging), not OWNER_TEST_EMAIL.
 */

const BASE_URL = new URL(process.env.APP_URL!).origin;
const TEST_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD;

if (!TEST_EMAIL || !TEST_PASSWORD) {
  throw new Error('TEST_USER_EMAIL / TEST_USER_PASSWORD must be set in .env');
}

const TEST_IMAGE_PATH = path.resolve(__dirname, '..', 'fixtures', 'qa-test-image.png');

const randomString = (length = 6) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

/** Logs in and waits for the AUTH_TOKEN cookie to settle before any protected navigation. */
async function login(page: Page) {
  await page.goto(`${BASE_URL}/en/auth`);
  // pressSequentially, not fill: under WebKit, .fill() sets the DOM value but this app's React
  // controlled-input state never picks it up, so Continue stays disabled forever (confirmed via a
  // full WebKit run, Cycle 4). Real keystroke events fix it everywhere.
  await page.getByRole('textbox', { name: 'Email' }).pressSequentially(TEST_EMAIL!);
  await page.getByRole('textbox', { name: 'Password' }).pressSequentially(TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15000 });
  // The AUTH_TOKEN cookie settles asynchronously just after the redirect; touching a protected
  // route too early races the app into treating the session as logged-out (see
  // lodge-owner-modules/005_profile-display-name-edit.spec.ts for the identical race).
  await page.waitForFunction(() => document.cookie.includes('AUTH_TOKEN'), { timeout: 10000 });
  await page.waitForTimeout(1000);
}

/** Clicks "Manage Your Lodge" and lands on the owner dashboard, retrying on the auth race. */
async function openOwnerDashboard(page: Page) {
  const attempts = 3;
  for (let attempt = 0; attempt < attempts; attempt++) {
    await page.getByRole('button', { name: 'Manage Your Lodge' }).click();
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 12000 });
      return;
    } catch {
      if (attempt === attempts - 1) throw new Error('Could not reach the owner dashboard after logging in');
      await page.goto(`${BASE_URL}/en`);
      await page.waitForTimeout(2000);
    }
  }
}

async function gotoLodgesList(page: Page) {
  await page.goto(`${BASE_URL}/en/lodges?sort=updatedAt&sortOrder=desc`, { waitUntil: 'load' });
}

/** Filters the (40+ row) owner lodges table down to just the target lodge via the search box. */
async function searchForLodge(page: Page, name: string) {
  await page.getByPlaceholder('Search for loges...').fill(name);
  await page.waitForTimeout(1200); // debounce before the table re-queries
}

function lodgeRow(page: Page, name: string): Locator {
  return page.getByRole('row', { name });
}

/** Opens a lodge row's kebab/chevron Actions menu (the last button in its row). */
async function openRowActionsMenu(page: Page, name: string) {
  const row = lodgeRow(page, name);
  await row.scrollIntoViewIfNeeded();
  await row.getByRole('button').last().click();
}

/**
 * Opens the row's Actions menu and clicks a named menuitem, retrying the whole open+click
 * sequence a few times. The same kind of dropdown-menuitem instability documented on the
 * in-editor language switcher ("element is not stable" / "element was detached from the DOM")
 * also shows up here - re-opening the menu from scratch is cheap compared to losing the test to
 * a single flaky click.
 */
async function clickRowMenuItem(page: Page, lodgeName: string, itemName: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await openRowActionsMenu(page, lodgeName);
      await page.getByRole('menuitem', { name: itemName, exact: true }).click({ timeout: 10000 });
      return;
    } catch (err) {
      lastError = err;
      await page.waitForTimeout(800);
    }
  }
  throw lastError;
}

/** In-editor language switch: a button named EN/KH/FR opens a menu of English/Khmer/French. */
async function switchLanguage(page: Page, targetLang: 'EN' | 'KH' | 'FR') {
  const langMap = { EN: 'English', KH: 'Khmer', FR: 'French' } as const;
  // Immediately after the previous language's saveSection(), the panel can still be settling
  // (re-render following the save) - opening the dropdown during that window sometimes yields a
  // menuitem that is briefly unstable/gets detached from the DOM mid-click. Retry the whole
  // open-and-select sequence rather than letting a single flaky click eat the entire test
  // timeout. Deliberately does NOT press Escape between retries: that key can bubble up past the
  // language dropdown and close the entire Lodge Live Editor dialog itself (observed once as the
  // root cause of a much later, seemingly unrelated failure - every subsequent locator silently
  // waited forever for a "Description"/"Bathroom" button that no longer existed because the
  // whole editor had been dismissed back to the plain lodges list). Re-clicking the trigger
  // button on the next attempt is enough to toggle the dropdown back to a known state.
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.getByRole('button', { name: /^(EN|KH|FR)$/ }).first().click();
      await page.getByRole('menuitem', { name: langMap[targetLang] }).click({ timeout: 8000 });
      // Give the language's own translation-data fetch (see fillAndVerify's comment) a head
      // start before the caller starts filling fields - Khmer in particular seemed to need more
      // than the original 400ms margin in practice (observed as fields losing their typed value
      // a moment after switching specifically to Khmer, more often than for English/French).
      await page.waitForTimeout(900);
      return;
    } catch (err) {
      lastError = err;
      await page.waitForTimeout(800);
    }
  }
  throw lastError;
}

/**
 * Fills a textbox and verifies the value actually STAYS. Guards against a real race confirmed via
 * live diagnostics on staging: switchLanguage() (and creating a new Room/Bathroom) kicks off an
 * async fetch of that language's/room's translation data; if fill() runs before that fetch
 * resolves, the field briefly shows our typed value (an immediate inputValue() check right after
 * fill() would pass) but then gets silently overwritten back to empty once the fetch's ("no
 * translation yet") response lands a few hundred ms later - leaving Save permanently disabled
 * with no error ever thrown. A single immediate check is not enough; re-check after a short delay
 * and redo the whole fill if the value reverted.
 */
async function fillAndVerify(locator: Locator, value: string, options: { nudge?: boolean } = {}) {
  const { nudge = true } = options;
  for (let attempt = 0; attempt < 5; attempt++) {
    await locator.fill(value);
    const immediateOk = (await locator.inputValue().catch(() => '')) === value;
    if (immediateOk) {
      // A single re-check isn't always enough - on the Pricing field specifically, a clobber was
      // observed to land more than a second after the field looked stable. Poll across a longer
      // window (~3s total) so a slower-resolving fetch still gets caught before we declare victory.
      let stillOk = true;
      for (let i = 0; i < 3; i++) {
        await locator.page().waitForTimeout(1000);
        stillOk = (await locator.inputValue().catch(() => '')) === value;
        if (!stillOk) break;
      }
      if (stillOk) {
        if (nudge && value.length > 0) {
          // Some of this app's "unsaved changes" / Save-enablement tracking appears to key off
          // real keyboard events rather than the input/change events fill() dispatches (observed:
          // the field's value is confirmed correct, yet Save stays disabled indefinitely). Nudge
          // with a harmless keypress pair so any onKeyDown/onKeyUp-based dirty tracking still
          // sees a real typing signal. A plain space+backspace corrupted the currency-masked
          // Pricing field ("15" -> "1", confirmed via live diagnostics) - its own live-formatting
          // backspace handling (for the "$X including 10% VAT" preview) doesn't expect a space.
          // Duplicating the field's own last character then removing it uses only characters the
          // field already accepts, so it's safe for both plain text and masked numeric inputs.
          const lastChar = value[value.length - 1];
          await locator.press('End').catch(() => {});
          await locator.press(lastChar).catch(() => {});
          await locator.press('Backspace').catch(() => {});
          // Re-verify nothing drifted from the nudge itself before declaring success.
          if ((await locator.inputValue().catch(() => '')) !== value) continue;
        }
        return;
      }
      // Value reverted after the delay - a fetch response clobbered it. Fall through and retry.
    }
    await locator.page().waitForTimeout(500);
  }
  await expect(locator, `Value did not stick after repeated fill attempts: "${value}"`).toHaveValue(value);
}

/** Same as fillAndVerify, but for `contenteditable` rich-text editors (e.g. tiptap), which have
 * no `inputValue()` - text content is compared instead. */
async function fillContentEditableAndVerify(locator: Locator, value: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await locator.click();
    await locator.fill(value);
    const immediateOk = ((await locator.textContent().catch(() => '')) ?? '').trim() === value;
    if (immediateOk) {
      // Same longer stability window as fillAndVerify - a clobber from a slow-resolving fetch
      // isn't always caught by a single ~1s re-check.
      let stillOk = true;
      for (let i = 0; i < 3; i++) {
        await locator.page().waitForTimeout(1000);
        stillOk = ((await locator.textContent().catch(() => '')) ?? '').trim() === value;
        if (!stillOk) break;
      }
      if (stillOk) return;
    }
    await locator.page().waitForTimeout(500);
  }
  await expect(locator, `Content did not stick after repeated fill attempts: "${value}"`).toHaveText(value);
}

/**
 * Reads a section's own badge in the Lodge Live Editor's section list (e.g. "Policies* Required:
 * KM") and, if it isn't "Completed", re-runs `performLanguage` for just the language(s) still
 * listed as required. Despite every timing safeguard in fillAndVerify/fillContentEditableAndVerify,
 * one language out of three occasionally still doesn't stick end-to-end on a first pass (observed
 * for Policies specifically, never the same language twice) - re-driving only the missing
 * language is far cheaper than the whole section, and this check is the ground truth the app
 * itself uses to gate "Request to review & Publish", not a guess.
 */
async function retryMissingLanguages(
  page: Page,
  sectionPattern: RegExp,
  performLanguage: (lang: 'EN' | 'KH' | 'FR') => Promise<void>
) {
  const codeMap: Record<string, 'EN' | 'KH' | 'FR'> = { EN: 'EN', KM: 'KH', KH: 'KH', FR: 'FR' };
  for (let pass = 0; pass < 2; pass++) {
    const sectionBtn = page.getByRole('button', { name: sectionPattern }).first();
    const text = (await sectionBtn.textContent().catch(() => '')) ?? '';
    if (/Completed/i.test(text)) return;
    const requiredMatch = text.match(/Required:\s*([A-Z, ]+)/i);
    const missing = requiredMatch
      ? requiredMatch[1]
          .split(',')
          .map((s) => codeMap[s.trim().toUpperCase()])
          .filter((v): v is 'EN' | 'KH' | 'FR' => Boolean(v))
      : [];
    if (missing.length === 0) return;
    await sectionBtn.click();
    for (const lang of missing) {
      await performLanguage(lang);
    }
    await backToSectionList(page);
  }
}

/** Saves the currently-open editor section, retrying once against the documented transient 502. */
async function saveSection(page: Page) {
  const saveBtn = page.getByRole('button', { name: 'Save', exact: true }).first();
  // Fail fast with a clear message instead of silently eating the whole test timeout: if Save is
  // still disabled after a generous settle window, the preceding fill (despite fillAndVerify)
  // never registered as a real form change. Poll manually (rather than a single expect) so we can
  // dump field diagnostics the moment it's clear this attempt has genuinely failed.
  const deadline = Date.now() + 15000;
  let saveBecameEnabled = await saveBtn.isEnabled().catch(() => false);
  while (!saveBecameEnabled && Date.now() < deadline) {
    await page.waitForTimeout(500);
    saveBecameEnabled = await saveBtn.isEnabled().catch(() => false);
  }
  if (!saveBecameEnabled) {
    const diagnostics = await page
      .evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, textarea')).map((el) => ({
          name: (el as HTMLInputElement).name,
          placeholder: (el as HTMLInputElement).placeholder,
          value: (el as HTMLInputElement).value,
          ariaLabel: el.getAttribute('aria-label'),
        }));
        return { inputs, url: location.href };
      })
      .catch((e) => ({ error: String(e) }));
    console.log('[saveSection] Save stayed disabled. Field diagnostics:', JSON.stringify(diagnostics, null, 2));
  }
  expect(saveBecameEnabled, 'Save stayed disabled - the preceding field edit was not detected as a change').toBe(true);
  await saveBtn.click();
  const failure = page.getByText(/Failed to save/i);
  if (await failure.isVisible({ timeout: 2000 }).catch(() => false)) {
    await saveBtn.click();
  }
  await page.waitForTimeout(800);
}

/** Returns to the section list from an open editor section via the chevron-left back button. */
async function backToSectionList(page: Page) {
  // Scoping to `svg.lucide-chevron-left` alone is not reliable here even inside the editor
  // dialog - the dialog can contain more than one such icon (and/or the underlying dashboard's
  // own sidebar-toggle chevron leaks in via an unscoped .first()), so a click can silently land
  // on the wrong one and leave the section open. Anchoring near the section's own H1 heading
  // (e.g. "Bedroom" / "Bathroom" / "Policies" - always exactly one visible at a time) is more
  // robust, but the accessibility-tree snapshot's "generic" wrapper node containing [button,
  // heading] actually collapses 3 real DOM levels (confirmed via direct page.evaluate DOM dump:
  // h1 -> div.flex.items-center.gap-2 -> div.flex.items-center.gap-3.flex-row -> div.flex.items-
  // center.gap-3.justify-between.w-full, and it's this 3rd-level-up div that directly contains
  // both the back-chevron button and the language-switcher button as siblings) - a naive
  // `xpath=..` (one raw DOM level) lands on a wrapper with no button in it at all, so the click
  // never resolves. Go up 3 real DOM levels to reach the actual shared container.
  const editorDialog = page.getByRole('dialog').first();
  // "Lodge Live Editor" is ITSELF a level-1 heading on the section list, so a generic "any h1"
  // locator never truly reaches count 0 after leaving a section - it just changes text. The one
  // unambiguous success signal is this specific heading becoming visible.
  const listHeading = editorDialog.getByRole('heading', { name: 'Lodge Live Editor' });

  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    // Already back on the list - e.g. a previous attempt's click actually succeeded but this
    // function hadn't returned yet for some other reason. Nothing left to do.
    if (await listHeading.isVisible().catch(() => false)) return;

    try {
      const sectionHeading = editorDialog.getByRole('heading', { level: 1 });
      const headerRow = sectionHeading.locator('xpath=../../..');
      const backBtn = headerRow.getByRole('button').first();
      await backBtn.click({ timeout: 10000 });
      await expect(
        listHeading,
        'Back button click did not return to the Lodge Live Editor section list'
      ).toBeVisible({ timeout: 8000 });
      await page.waitForTimeout(800);
      return;
    } catch (err) {
      lastError = err;
      await page.waitForTimeout(1000);
    }
  }
  throw lastError;
}

/** A locator for the price input, tried by label first with CSS fallbacks documented in the reference script. */
function priceInput(page: Page): Locator {
  return page
    .getByLabel(/price per night/i)
    .or(page.locator('input[type="number"][name*="price" i], input[type="text"][name*="price" i], input[placeholder*="price" i]'))
    .first();
}

test.describe.serial('Lodge Owner CRUD', () => {
  let lodgeName = '';

  test('1. Create Lodge - happy path through to Pending Review', async ({ page }) => {
    // This is an inherently long, many-step wizard flow (language/type/info/location/amenities/
    // image/price, then 5 Lodge Live Editor sections x up to 3 languages each). Combined with the
    // defensive retries added around known transient-instability points (switchLanguage,
    // fillAndVerify, backToSectionList, the image step's Next click), a slow moment on staging
    // can legitimately need more than 180s end-to-end without any single step being truly stuck.
    test.setTimeout(360000);

    lodgeName = `QA_CRUD_${Date.now()}_${randomString(4)}`;

    await login(page);
    await openOwnerDashboard(page);

    await page.getByRole('button', { name: 'New Lodge' }).first().click();
    await page.waitForURL(/\/lodges\/new/, { timeout: 15000 });

    await test.step('Language and lodge type', async () => {
      // The wizard's own remembered language can render this heading in French even on /en - the
      // "English" option button is still reachable by its accessible name.
      await page.getByRole('button', { name: 'English' }).first().click();
      await page.getByRole('button', { name: 'Next' }).first().click();

      await expect(page.getByText(/Which of these best describes/i)).toBeVisible({ timeout: 15000 });
      await page.getByRole('button', { name: /^Entire Place/i }).first().click();
      await page.getByRole('button', { name: 'Next' }).first().click();
    });

    await test.step('Loge Information', async () => {
      // Corrected from the reference script: real placeholder is "Enter the loge name", not
      // "lodge name" - use the accessible-name role locator instead of a placeholder substring.
      const nameInput = page.getByRole('textbox', { name: /loge name/i });
      await nameInput.waitFor({ state: 'visible', timeout: 20000 });
      await nameInput.fill(lodgeName);
      await expect(nameInput).toHaveValue(lodgeName);

      const descEditor = page.locator('.tiptap[contenteditable="true"], [contenteditable="true"][role="textbox"]').first();
      await descEditor.fill('Automated QA lodge created by the lodge-owner-crud lifecycle test');

      await page.getByRole('button', { name: 'Beachfront Villa' }).first().click();
      await page.getByRole('button', { name: 'One Bedroom', exact: true }).first().click();
      await page.getByRole('button', { name: 'Couples' }).first().click();
      await page.getByRole('button', { name: 'Hiking' }).first().click();

      await page.getByRole('button', { name: 'Next' }).first().click();
    });

    await test.step('Location', async () => {
      const selectLocation = async (buttonName: string, optionName: string) => {
        await page.getByRole('button', { name: buttonName }).first().click();
        await page.getByRole('option', { name: optionName }).first().click();
        await page.waitForTimeout(400);
      };
      await selectLocation('City/Province*', 'Banteay Meanchey');
      await selectLocation('District', 'Malai');
      await selectLocation('Commune', 'Boeng Beng');
      await selectLocation('Village', 'Sangkae');

      // The map pin is a real required field, but a bare click on the raw .gm-style container has
      // caused a full browser-context crash in this environment (see exploratory-findings.md) -
      // make bounded, forced attempts (varying position/timing) instead of letting Playwright
      // retry indefinitely, and fail fast on the Next button rather than eating the whole test
      // timeout if the pin never registers.
      const map = page.locator('.gm-style').first();
      const nextBtn = page.getByRole('button', { name: 'Next' }).first();
      for (const pos of [{ x: 100, y: 100 }, { x: 150, y: 150 }]) {
        try {
          await map.waitFor({ state: 'visible', timeout: 5000 });
          await map.click({ position: pos, force: true, timeout: 5000 });
        } catch {
          // Swallow: if every attempt fails, the loop below reports it clearly.
        }
        if (await nextBtn.isEnabled({ timeout: 3000 }).catch(() => false)) break;
        await page.waitForTimeout(1000);
      }

      await expect(nextBtn, 'Map pin click did not enable Next - known flaky .gm-style interaction (see exploratory-findings.md)')
        .toBeEnabled({ timeout: 10000 });
      await nextBtn.click();
    });

    await test.step('Amenities, image upload (skipped), and price', async () => {
      const wifiChip = page.getByRole('button', { name: 'WiFi' }).first();
      await wifiChip.scrollIntoViewIfNeeded();
      await wifiChip.click({ force: true });
      const amenitiesNext = page.getByRole('button', { name: 'Next' }).first();
      await expect(amenitiesNext, 'Amenities Next did not enable after selecting WiFi').toBeEnabled({ timeout: 10000 });
      await amenitiesNext.click();

      // Corrected from the reference script/findings: the image-upload step is NOT skippable -
      // the app shows "You must upload at least 1 photo to start." and Next stays disabled with
      // zero images. There is no pre-existing <input type="file"> in the DOM and no native
      // filechooser dialog fires on click either - the drop-zone click lazily attaches a hidden
      // input instead. Click it, then wait for that input to attach and set the file directly.
      await page.getByText(/Click to browse/i).first().click({ force: true });
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.waitFor({ state: 'attached', timeout: 10000 });
      await fileInput.setInputFiles(TEST_IMAGE_PATH);

      // Uploading only adds the file to a shared "Gallery Media" asset-library modal - it is NOT
      // auto-selected (confirmed via the modal's own "(0) files selected" counter staying at 0
      // right after upload). This is true regardless of the uploaded image's dimensions - the
      // originally-broken 1x1px fixture and the corrected 1200x800 fixture both land here
      // unselected. The just-uploaded photo is prepended as the first asset card in the grid;
      // clicking its size caption (e.g. "9.82 KB") toggles selection to "(1) files selected".
      // Without this click, "Done" closes the modal with nothing selected and Next stays
      // disabled no matter how valid the uploaded image is.
      await page.getByText('Files uploaded successfully').waitFor({ timeout: 10000 }).catch(() => {});
      const galleryDialog = page.getByRole('dialog').filter({ hasText: 'Gallery Media' });
      const firstAssetSizeLabel = galleryDialog.getByText(/^[\d.]+ (KB|Bytes)$/).first();
      await firstAssetSizeLabel.waitFor({ state: 'visible', timeout: 10000 });
      await firstAssetSizeLabel.click();
      await expect(
        galleryDialog.getByText(/^\(\d+\) files selected$/),
        'Clicking the uploaded photo did not select it in the Gallery Media modal'
      ).not.toHaveText('(0) files selected', { timeout: 5000 });

      const doneBtn = page.getByRole('button', { name: 'Done' }).first();
      if (await doneBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await doneBtn.click();
      }
      const imageNext = page.getByRole('button', { name: 'Next' }).first();
      await expect(imageNext, 'Next did not enable after uploading and selecting a test image').toBeEnabled({ timeout: 15000 });
      await imageNext.click();

      // Occasionally the click on this step's "Next" doesn't advance the wizard on the first try
      // (observed on staging with no visible error - the image step just stays put). Re-click
      // once before failing, rather than assuming a single click is guaranteed to register.
      const price = priceInput(page);
      let priceVisible = await price.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
      if (!priceVisible) {
        await imageNext.click().catch(() => {});
        priceVisible = await price.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
      }
      expect(priceVisible, 'Price input never appeared after clicking Next on the image step (even after a retry)').toBe(true);
      await price.fill('10.00');
      await expect(price).toHaveValue('10.00');

      await page.getByRole('button', { name: /Submit|Next|Continue/i }).first().click();
      await page.waitForURL(/\/lodges\/editor\//, { timeout: 30000 });
    });

    await test.step('Lodge Live Editor: Titles and Description (KH + FR only, EN pre-filled)', async () => {
      await page.getByRole('button', { name: /Titles/i }).first().click();
      for (const lang of ['KH', 'FR'] as const) {
        await switchLanguage(page, lang);
        const titleInput = page.getByRole('textbox', { name: /type your lodge title/i }).first();
        await fillAndVerify(titleInput, `${lodgeName}_${lang}`);
        await saveSection(page);
      }
      await backToSectionList(page);

      await page.getByRole('button', { name: /Description/i }).first().click();
      for (const lang of ['KH', 'FR'] as const) {
        await switchLanguage(page, lang);
        const descEditor = page.locator('.tiptap[contenteditable="true"]').first();
        await fillContentEditableAndVerify(descEditor, `Automated QA description (${lang}).`);
        await saveSection(page);
      }
      await backToSectionList(page);
    });

    await test.step('Lodge Live Editor: Bedroom, Bathroom, Policies (all three languages required)', async () => {
      const fillOneBedroomLanguage = async (lang: 'EN' | 'KH' | 'FR') => {
        await switchLanguage(page, lang);
        const newRoomBtn = page.getByRole('button', { name: /New Room/i }).first();
        if (await newRoomBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await newRoomBtn.click();
          // Creating a room swaps the "New Room" prompt for the actual edit form - wait for that
          // transition to finish (rather than a fixed sleep) before grabbing field references, so
          // we don't fill into a form that's still being (re)mounted for the newly-created room.
          await newRoomBtn.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(500);
        }
        await fillAndVerify(page.getByRole('textbox', { name: /Title\*/i }).first(), `Bedroom ${lang}`);
        await fillAndVerify(page.getByRole('textbox', { name: /Description/i }).first(), `Bedroom description ${lang}`);
        await saveSection(page);
      };

      await page.getByRole('button', { name: /Bedroom/i }).first().click();
      for (const lang of ['EN', 'KH', 'FR'] as const) {
        await fillOneBedroomLanguage(lang);
      }
      await backToSectionList(page);
      await retryMissingLanguages(page, /Bedroom/i, fillOneBedroomLanguage);

      const fillOneBathroomLanguage = async (lang: 'EN' | 'KH' | 'FR') => {
        await switchLanguage(page, lang);
        const newBathBtn = page.getByRole('button', { name: /New Bathroom/i }).first();
        if (await newBathBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await newBathBtn.click();
          await newBathBtn.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(500);
        }
        await fillAndVerify(page.getByRole('textbox', { name: /Title\*/i }).first(), `Bathroom ${lang}`);
        await fillAndVerify(page.getByRole('textbox', { name: /Description/i }).first(), `Bathroom description ${lang}`);
        await saveSection(page);
      };

      await page.getByRole('button', { name: /Bathroom/i }).first().click();
      for (const lang of ['EN', 'KH', 'FR'] as const) {
        await fillOneBathroomLanguage(lang);
      }
      await backToSectionList(page);
      await retryMissingLanguages(page, /Bathroom/i, fillOneBathroomLanguage);

      const fillOnePolicyLanguage = async (lang: 'EN' | 'KH' | 'FR') => {
        await switchLanguage(page, lang);
        const addPolicyBtn = page.getByRole('button', { name: /Add Policy/i }).first();
        if (await addPolicyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await addPolicyBtn.click();
          const checkInOutPolicyBtn = page.getByRole('button', { name: 'Check-in/Check-out Policy' }).first();
          await checkInOutPolicyBtn.click();
          await checkInOutPolicyBtn.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(500);
        }
        await fillAndVerify(page.getByRole('textbox', { name: /Policy Title/i }).first(), `Policy ${lang}`);
        await fillContentEditableAndVerify(page.locator('.tiptap[contenteditable="true"]').last(), `Policy content ${lang}`);
        await saveSection(page);
      };

      await page.getByRole('button', { name: /Policies/i }).first().click();
      for (const lang of ['EN', 'KH', 'FR'] as const) {
        await fillOnePolicyLanguage(lang);
      }
      await backToSectionList(page);
      // Despite every timing safeguard above, one language out of three has occasionally still
      // not stuck end-to-end on the first pass (a different language each time it happened) -
      // check the section's own "Completed"/"Required: X" badge (the app's own ground truth) and
      // redo just what's missing before moving on.
      await retryMissingLanguages(page, /Policies/i, fillOnePolicyLanguage);
    });

    await test.step('Request to review & Publish', async () => {
      await page.getByRole('button', { name: 'Request to review & Publish' }).first().click();
      await page.getByRole('button', { name: 'Confirm' }).first().click();
      await page.waitForURL(/\/lodges\?sort=updatedAt/, { timeout: 30000 });

      await searchForLodge(page, lodgeName);
      await expect(lodgeRow(page, lodgeName)).toContainText('Pending Review', { timeout: 15000 });
    });
  });

  test('2. List/Read - created lodge appears with correct name and Pending Review status', async ({ page }) => {
    expect(lodgeName, 'Create test must have run first and set lodgeName').not.toBe('');

    await login(page);
    await gotoLodgesList(page);
    await searchForLodge(page, lodgeName);

    const row = lodgeRow(page, lodgeName);
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row).toContainText(lodgeName);
    await expect(row).toContainText('Pending Review');
  });

  test('3. Edit - updated description and price persist', async ({ page }) => {
    test.setTimeout(150000);
    expect(lodgeName, 'Create test must have run first and set lodgeName').not.toBe('');

    await login(page);
    await gotoLodgesList(page);
    await searchForLodge(page, lodgeName);

    await clickRowMenuItem(page, lodgeName, 'Edit');
    await page.waitForURL(/\/lodges\/editor\//, { timeout: 15000 });

    await test.step('Edit Description', async () => {
      await page.getByRole('button', { name: /Description/i }).first().click();
      const descEditor = page.locator('.tiptap[contenteditable="true"]').first();
      await descEditor.waitFor({ state: 'visible', timeout: 15000 });
      const currentText = (await descEditor.textContent()) ?? '';
      await fillContentEditableAndVerify(descEditor, `${currentText} UPDATED via edit test.`);
      await saveSection(page);
      await backToSectionList(page);
    });

    await test.step('Edit Price', async () => {
      await page.getByRole('button', { name: /Pricing/i }).first().click();
      const price = priceInput(page);
      await price.waitFor({ state: 'visible', timeout: 15000 });
      await fillAndVerify(price, '15');
      // Unlike every other field in this suite, editing an EXISTING lodge's price (as opposed to
      // entering it for the first time during Create) seems to additionally need a real blur
      // event before Save reacts - fillAndVerify's own keyboard nudge alone wasn't enough here.
      await price.blur().catch(() => {});
      await saveSection(page);
    });

    // Navigate away via a direct goto (not the editor's own "Close" control) to sidestep the
    // documented false-positive "Discard changes?" prompt - the change is already persisted.
    await gotoLodgesList(page);
    await searchForLodge(page, lodgeName);
    await expect(lodgeRow(page, lodgeName)).toContainText('$15', { timeout: 15000 });
  });

  test('4. Delete - lodge is removed from the list via kebab menu + confirmation dialog', async ({ page }) => {
    expect(lodgeName, 'Create test must have run first and set lodgeName').not.toBe('');

    await login(page);
    await gotoLodgesList(page);
    await searchForLodge(page, lodgeName);
    await expect(lodgeRow(page, lodgeName)).toBeVisible({ timeout: 15000 });

    await clickRowMenuItem(page, lodgeName, 'Delete');

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('This action cannot be undone');
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(lodgeRow(page, lodgeName)).toHaveCount(0, { timeout: 15000 });

    // Re-navigate fresh to confirm this is a genuine hard delete, not just optimistic client state.
    await gotoLodgesList(page);
    await searchForLodge(page, lodgeName);
    await expect(lodgeRow(page, lodgeName)).toHaveCount(0);
  });
});
