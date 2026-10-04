# Private local field vault

Open the separate `private-vault.html` page from the field overlay. This page is empty on first use. It does not load source records, email, identity information, or public address parameters.

## User-operated workflow

1. Use a trusted, modern browser on HTTPS (localhost also qualifies). Web Crypto, Web Locks and local storage are required; unsupported environments fail closed.
2. Enter and confirm your own 12–256 character passphrase. A long, unique passphrase is strongly recommended. Nothing is persisted by creating an empty session.
3. Enter an optional private whole-field address and private contents. Optionally choose a local text/JSON file of at most 64 KiB. This reads only the chosen file, replaces the contents field in unlocked memory, and does not upload it. The original plaintext file remains unchanged on your device.
4. For a compatible addressed-index JSON, the unlocked page shows a searchable entry list. Select an entry to inspect its source role, WAS/IS/NEXT states, provenance, and incoming/outgoing binary edges. Edge buttons navigate to their local endpoints; Back and All entries navigate only in page memory. Editing the raw contents clears the viewer; choose **Explore addressed index** to rebuild it. Unsupported JSON remains plain editable text.
5. Click **Encrypt and save locally**, then download an encrypted backup. The download contains the last saved ciphertext, not unsaved edits.
6. Lock when finished. Locking, hiding the page, leaving the page, or five minutes without activity discards unsaved contents and clears the input controls, index display/search/navigation state and key references. A fresh page always starts locked.

There is **no recovery/reset**. Losing the passphrase makes the saved contents inaccessible. Browser storage can be deleted or evicted. Keep a separate encrypted backup and the passphrase safely. Backups can be imported into an empty browser vault only; the import path cannot replace existing saved data. A separate trusted browser profile can be used for restore testing.

## Security boundary

- AES-256-GCM with fresh random 96-bit IVs and 128-bit tags; PBKDF2-HMAC-SHA-256 with 600,000 iterations and a random 128-bit salt. Key material is non-extractable and retained only in the active page session.
- A random vault ID and fixed format context are authenticated as additional data. The ID is also verified inside the encrypted payload. The **private address is inside the ciphertext**, never an AAD label or public URL parameter.
- Only the versioned encrypted envelope is stored in local storage or exported. Its format, algorithms, salt, IV, random ID, work factor and ciphertext length are public metadata; encryption does not conceal approximate content size.
- Imports have a 150,000-byte upper bound; exact supported schemas, fixed KDF parameters, decoded byte lengths and payload limits are checked. Large or unsupported work factors are rejected before derivation. Imported ciphertext authenticity is established only when successfully unlocked.
- Web Locks serialize cooperating tabs; writes compare their original saved ciphertext to the current copy before replacing it. Storage events lock other tabs and require reload. Failed encryption or storage writes retain the existing saved copy. There is no automatic merge or destructive reset feature.
- The standalone page has no external dependencies. Hash-based CSP denies network connections, external scripts, frames, workers, forms and other resource loads. User contents are rendered only as input values or plain status text, never HTML. No plaintext is passed into public overlay URL serialization or exports.
- The optional addressed-index viewer bounds total input (99,000 bytes), entries (256), edges (2,048), nesting depth (8), visited values (10,000), and string/key lengths. Entry and edge IDs are unique and binary-edge endpoints must exist. It creates plain DOM elements and uses textContent; provenance/source values are inert text, never external links. The viewer and navigation history exist only while unlocked and never enter public URL state. It is an index explorer, not a truth/ownership verifier.
- This is **not account authentication, verified identity, access control for a backend, or a production legal-record system**. There is no server, sync, account grant, or recovery operator. A passphrase does not prove who someone is.
- Same-origin malicious code, a compromised future page update, browser extensions, malware and a compromised device can steal unlocked contents or passphrases. The separate page and CSP reduce accidental leakage, not this trust requirement. Same-origin scripts can access ciphertext and interfere with storage. Client encryption cannot prevent offline passphrase guessing, rollback to an old valid backup, storage deletion or denial of service.
- JavaScript cannot guarantee physical memory erasure. “Lock” clears page controls and drops references, invalidates pending asynchronous work and blocks subsequent persistence by that work; browser-managed memory and previously downloaded/opened files remain outside that guarantee.

## Verification

Run `node --experimental-strip-types --test tests/private-vault.test.ts`.

The synthetic suite evaluates the actual standalone script with Node WebCrypto and a small DOM/storage harness: correct/wrong unlock, binding and ciphertext tampering, fresh IVs, ciphertext-only persistence, reload locked, async lock cancellation, inactivity/page lifecycle, strict import bounds and KDF parameters, inert markup, failed storage writes, competing-tab changes, encrypted import, explicitly chosen local plaintext imports, inert addressed-node/edge navigation, search/back/root controls, bounded invalid-index fallback, and clearing/reconstruction of the viewer. These tests do not replace real-browser CSP/download/file-picker checks or an independent security audit. No real personal records or operational secrets belong in fixtures.
