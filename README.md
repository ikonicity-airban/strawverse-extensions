# StrawVerse OmniSave Movies & TV Shows Extension

A high-performance **StrawVerse** provider extension that indexes, streams, and batch-downloads movies and TV series from OmniSave (`videodownloader.site`).

---

## 🌟 Features

- **Movies & TV Series Support:** Full support for both standalone movies (with single-click resolution choice) and episodic series (with seasons and episode selectors).
- **Multiple Qualities:** Streams and downloads MP4 video files in 360p, 480p, and 720p HD.
- **Multilingual Subtitles:** Automatically extracts official subtitle tracks (`.srt`) in English, Spanish, French, Arabic, and more.
- **Direct High-Speed CDN:** Plays directly from fast CloudFront / Alibaba Cloud OSS nodes via StrawVerse's native MPV player and download manager.
- **Universal Compatibility:** Compatible with StrawVerse's **Movies & TV Shows** tab as well as the standard **Anime** scraper engine.

---

## 📁 Repository Structure

```
omnisave-strawverse-extension/
├── marketplace.json                      # StrawVerse extension registry manifest
├── extensions/
│   ├── movies-tvshows/
│   │   └── omnisave.js                  # Primary Movies & TV Shows scraper
│   ├── Movies/
│   │   └── omnisave.js                  # Direct Movies fallback path
│   └── Anime/
│       └── omnisave.js                  # Anime engine compatibility alias
├── ico/
│   └── omnisave.ico                     # Scraper favicon/icon
└── README.md
```

---

## 🚀 How to Add This Repository to StrawVerse

### Method 1: Host on GitHub (Recommended for community/sync)
1. Push this folder to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "Initial OmniSave StrawVerse extension"
   git branch -M main
   git remote add origin https://github.com/<your-username>/omnisave-strawverse-extension.git
   git push -u origin main
   ```
2. In StrawVerse:
   - Go to **Settings** → **Extensions** (Marketplace).
   - Click **+ Add Repo** in the top bar.
   - Paste your GitHub URL: `https://github.com/<your-username>/omnisave-strawverse-extension`.
   - Click **Add Repository**.
   - OmniSave will appear under **Movies & TV Shows** and **Anime**. Click **Install Scraper**!

### Method 2: Instant Local Installation (Already Deployed!)
The extension has already been pre-installed directly into your local StrawVerse installation at:
* `%APPDATA%\strawverse\scrapers\movies-tvshows\omnisave.js`
* `%APPDATA%\strawverse\scrapers\Anime\omnisave.js`
* `%APPDATA%\strawverse\scrapers\icons\omnisave.ico`

Simply open or restart **StrawVerse**, navigate to **Settings** → **Scraper Providers**, and select **omnisave** as your active provider for Movies & TV Shows!
