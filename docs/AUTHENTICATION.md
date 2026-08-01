# PRISM Authentication

**Status:** v1 shipped — local authentication over `IdentityManager`
**Governing decisions:** ADR #1 (Local-First), ADR #3 (Identity before Authentication), ADR #9 (Architecture Freeze)
**Code:** `desktop/src/lib/auth.ts` (`AuthenticationService`), `desktop/src/lib/identity.ts`

---

## 1. Architecture

```
AuthScreen / GlassLoginPanel        (UI — owns zero auth state)
        │
        ▼
AuthenticationService               login() · signup() · logout() ·
        │                           refreshSession() · restoreSession() ·
        │                           currentUser() · isAuthenticated() · subscribe()
        ▼
AuthenticationProvider              provider abstraction (registry)
        ├── LocalAuthenticationProvider   ← v1 default (ships)
        └── CloudAuthenticationProvider   ← interface reserved for v2
        │
        ▼
IdentityManager / LocalIdentityProvider   profiles.json in the app data dir
```

- **Profiles**: stored on disk in the per-user data directory. Passphrases are
  never persisted — only a PBKDF2-SHA-256 salt + verifier (100k iterations,
  256-bit), compared in constant time.
- **Sessions**: AES-GCM-encrypted blobs bound to a random 256-bit device key
  (`device.key` in the data dir). Restored automatically on cold start;
  expired or undecryptable sessions fall back to the login screen silently.
  TTL 30 days; `refreshSession()` re-issues.
- **Developer shortcut**: `loginDeveloper()` creates a real `prism_dev` profile
  with a random passphrase and a real encrypted session. It is rendered only in
  development builds (`import.meta.env.DEV`) and skips only the passphrase
  prompt — workspace, chat, providers, memory and the IDE remain production
  paths.

## 2. Cloud provider evaluation (Clerk — Google / GitHub)

Clerk was evaluated for v1 as requested. **Decision: do not integrate in v1.**
The local provider remains the shipping implementation; the provider
abstraction is the seam where a cloud provider lands in v2.

| Criterion | Clerk (Google/GitHub) | Local provider (shipped) |
|-----------|----------------------|--------------------------|
| ADR #3 — Identity before Authentication (frozen) | Violates: makes a cloud account the login primitive | Complies: identity is local configuration |
| ADR #1 — Local-First, fully functional offline | Violates: sign-in, token refresh and JWKS checks require network; offline cold-start would be degraded or blocked | Complies: fully offline |
| Desktop (Tauri WebView) OAuth mechanics | Google blocks OAuth inside embedded WebViews (`disallowed_useragent`); production flow requires the system browser + a deep-link callback (custom URI scheme) plus PKCE. Clerk has no desktop/Tauri SDK and its hosted flows expect `https` redirect URLs, so this path is custom work on top of Clerk, not "clean" integration | No browser handoff needed |
| Open-source posture (GPL v3, no mandatory subscriptions) | Adds a proprietary SaaS dependency in the critical path | No vendor dependency |
| Session security | JWT managed by Clerk | AES-GCM device-bound session, PBKDF2 verifier |
| Multi-device / team identity | Strong (v2 value) | Single device |

**Tradeoff summary**: Clerk's value (hosted OAuth, multi-device identity,
org/team accounts) belongs to the v2 cloud-sync milestone. In v1 it would
break two frozen ADRs and require a bespoke system-browser + deep-link flow
that Clerk does not provide out of the box for desktop apps.

## 3. v2 integration path (reserved, not implemented)

When cloud sync is scheduled, a `CloudAuthenticationProvider` implementation
must:

1. Open the provider's authorization URL in the **system browser** (never the
   embedded WebView) using the opener plugin.
2. Complete OAuth 2.0 + PKCE with a deep-link callback
   (`tauri-plugin-deep-link`, custom scheme registered by the installer).
3. Exchange/refresh tokens in the Rust core, storing refresh tokens with the
   OS keychain — not in the WebView.
4. Map the cloud account onto the existing local profile (cloud identity
   augments, never replaces, local identity — ADR #3).
5. Remain optional: offline/local login must always work.

The UI social buttons (Google / GitHub on the login panel) are part of the
approved Figma composition; in v1 they surface an informational notification
stating that cloud sign-in arrives with cloud sync. No fake auth flow exists.
