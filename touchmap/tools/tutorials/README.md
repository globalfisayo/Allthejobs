# Recording the tutorials

The six videos in `media/tutorials/` are recorded from the real app, running inside a drawn
tablet (portrait, unbranded) in `studio.html`. A Playwright script taps, types, zooms and captions;
a screencast is piped to ffmpeg; `finish.sh` adds the music and makes the poster and thumbnail.
Re-record a tutorial when its screen changes.

1. Serve the app: `python3 -m http.server 8765 --bind 127.0.0.1` from `touchmap/`.
2. Record one (needs Node with `playwright`, and ffmpeg):
   `TM_USER_PASS=… TM_ADMIN_PASS=… node tools/tutorials/scripts.cjs capture`
   (ids: capture, log, guide, line, analysis, setup; passwords come from the environment only).
3. Finish it: `tools/tutorials/finish.sh capture`.
4. Put the new length in seconds in `js/tutorials.js` (`secs`).

Music: “Apple Cider” by Zane Little Music, released under CC0 (public domain) on OpenGameArt.
`finish.sh` downloads it the first time; it is not kept in the repository.
