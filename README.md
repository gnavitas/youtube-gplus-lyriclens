# G+ LyricLens

[![Version](https://img.shields.io/badge/version-1.0-blue.svg)](https://github.com/your-username/lyric-lens)

## Description
**G+ LyricLens** is a powerful Chrome extension that automatically romanizes Chinese, Japanese, and Korean (CJK) subtitles on YouTube. Whether you're a language learner, a music enthusiast, or just want to sing along to your favorite foreign tracks, this extension seamlessly overlays romanizations (Pinyin for Chinese, Romaji for Japanese, Romaja for Korean) right on top of YouTube's native subtitle display.

The extension pulls synchronized lyrics from an expansive array of global lyric databases to ensure the most accurate timing and translation mapping for any track you might listen to.

## Features
- **Comprehensive Subtitle Display**: Automatically displays the original CJK text, the romanized text (Pinyin/Romaji/Romaja), and an English translation simultaneously.
- **Auto-Sync & Manual Search**: Automatically syncs the fetched lyrics with the YouTube video timeline. You can also manually search for lyrics if automatic detection isn't perfect.
- **Automatic CJK Detection**: Detects and romanizes Chinese, Japanese, and Korean characters respectively.
- **Multiple Lyric Sources**: 
  - *Primary*: LRCLIB, NetEase Music
  - *Japanese Specialists*: PetitLyrics, Uta-Net, UtaTen, Kasitime, J-Lyric
  - *Korean Specialist*: Gasazip
  - *Global*: Genius
- **Lightweight & Seamless**: Efficiently runs right as the document starts and integrates cleanly over the video without extra configurations.

## Local Installation
1. Clone this repository or download the ZIP.
2. Open Chrome/Chromium and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the extension directory.
5. Enjoy romanized subtitles immediately on YouTube!

## Tech Stack
- **JavaScript**: Core logic for the background service worker, popup, and content script.
- **Manifest V3**: State of the art Chrome Extension specification.
- **Third-Party Romanizers**: Includes libraries for processing Kanji, Pinyin, and multiple other romanization scripts.

## License
MIT License
