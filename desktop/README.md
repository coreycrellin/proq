# proq Desktop

Electron shell for proq. A thin wrapper that manages the proq web app lifecycle — clone, setup, build, and run, all from a native desktop app.

## What It Does

On first launch, a setup wizard walks you through:

1. **Install Location** — clone proq from GitHub, or point to an existing clone
2. **Dependencies** — checks Node.js 18+, tmux, Claude Code CLI, Xcode CLT (macOS). Installs what's missing
3. **Preferences** — port number (default 1337), production or development mode
4. **Build** — runs `npm install` and `npm run build` with live log output

On subsequent launches, the app shows a splash screen, starts the Next.js server as a child process, and loads the web UI once the server is ready.

## Architecture

The desktop shell is intentionally minimal. It does **not** embed or bundle the proq server — it spawns it as a separate process using your system's Node.js. This means:

- No `electron-rebuild` needed for node-pty or other native modules
- The proq server runs identically to `npm run start` in a terminal
- Updates are just `git pull` + `npm install` + `npm run build`

```
┌─────────────────────────────┐
│  Electron Shell             │
│  ┌───────────┐              │
│  │ Setup     │ First run    │
│  │ Wizard    │ only         │
│  └───────────┘              │
│  ┌───────────┐              │
│  │ Splash    │ Every launch │
│  └───────────┘              │
│         │                   │
│         ▼                   │
│  ┌───────────────────────┐  │
│  │ BrowserWindow         │  │
│  │ → localhost:{port}    │  │
│  └───────────────────────┘  │
└──────────┬──────────────────┘
           │ spawns
           ▼
┌─────────────────────────────┐
│  System Node.js             │
│  npm run start              │
│  (proq Next.js server)      │
└─────────────────────────────┘
```

## Development

```bash
cd desktop
npm install

# Build everything (main process + renderer)
npm run build

# Run in dev mode
npm run dev:main     # watch-compile main process
npm run dev:renderer # watch-compile renderer
npm run dev:electron # launch Electron
```

Or use `npm run dev` to run all three concurrently.

## Building for Distribution

```bash
# macOS (DMG + zip, universal binary)
npm run package

# Linux (AppImage + deb)
npm run package:linux

# All platforms
npm run package:all
```

Output goes to `desktop/release/`.

**macOS notes:** For distribution outside the App Store, you'll need to code-sign and notarize the app. Set `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables for electron-builder, and configure an `afterSign` hook for notarization.

## Project Structure

```
desktop/
├── package.json              # Separate from proq's package.json
├── tsconfig.json             # Main process TypeScript config
├── vite.config.ts            # Renderer build config
├── electron-builder.yml      # Packaging config
├── assets/
│   ├── entitlements.mac.plist
│   └── icon.icns/.png        # App icons (add before packaging)
├── src/
│   ├── main/
│   │   ├── index.ts          # App lifecycle, window creation
│   │   ├── server.ts         # Next.js child process manager
│   │   ├── setup.ts          # Dependency checks and installs
│   │   ├── config.ts         # JSON config persistence
│   │   ├── updater.ts        # Git-based update checker
│   │   └── preload.ts        # IPC bridge (contextBridge)
│   └── renderer/
│       ├── App.tsx            # Root component (wizard vs splash routing)
│       ├── Splash.tsx         # Server boot loading screen
│       ├── wizard/
│       │   ├── Wizard.tsx     # Multi-step wizard container
│       │   ├── Welcome.tsx    # Step 1: intro
│       │   ├── Location.tsx   # Step 2: clone or existing install
│       │   ├── Dependencies.tsx # Step 3: check Node, tmux, Claude
│       │   ├── Preferences.tsx  # Step 4: port, dev/prod mode
│       │   └── Installing.tsx   # Step 5: npm install + build
│       ├── styles.css         # Dark theme styles
│       └── types.ts           # TypeScript types + window API declaration
```

## Config

The desktop shell stores its own config separately from proq's `data/settings.json`. Location:

- **macOS:** `~/Library/Application Support/proq-desktop/config.json`
- **Linux:** `~/.config/proq-desktop/config.json`

Fields: `proqPath`, `port`, `devMode`, `setupComplete`, `claudeBinPath`, `windowBounds`.
