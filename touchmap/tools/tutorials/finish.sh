#!/bin/bash
# A raw recording → the tutorial in media/tutorials: H.264 + AAC with the music, fast start,
# plus the poster (title card) and the list thumbnail.
# Music: "Calm Piano 1 (Vaporware)" by The Cynic Project, CC0 (public domain), from OpenGameArt.
set -e
id=$1
here=$(cd "$(dirname "$0")" && pwd)
out="$here/../../media/tutorials"
raw="${TUT_OUT:-${TMPDIR:-/tmp}/touchmap-tutorials}/$id.raw.mp4"
music="${MUSIC:-${TMPDIR:-/tmp}/touchmap-calm-piano.mp3}"
[ -f "$music" ] || curl -sL -o "$music" https://opengameart.org/sites/default/files/003_Vaporware_2.mp3
mkdir -p "$out"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$raw")
FO=$(python3 -c "print(max(0, $D - 3.2))")
ffmpeg -v error -y -i "$raw" -i "$music" \
  -filter_complex "[1:a]atrim=0:$D,asetpts=PTS-STARTPTS,volume=${VOL:--1dB},afade=t=in:st=0:d=2,afade=t=out:st=$FO:d=3.2[a]" \
  -map 0:v -map "[a]" -c:v libx264 -preset slow -crf ${CRF:-27} -profile:v high -level 4.0 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 112k -ar 44100 -ac 2 -movflags +faststart -shortest "$out/$id.mp4"
ffmpeg -v error -y -ss 1.4 -i "$raw" -frames:v 1 -vf scale=540:720 -q:v 4 "$out/$id.jpg"
ffmpeg -v error -y -ss 5.2 -i "$raw" -frames:v 1 -vf "crop=760:1100:160:130,scale=240:-2" -q:v 5 "$out/$id-thumb.jpg"
echo "$id: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out/$id.mp4") s, $(du -h "$out/$id.mp4" | cut -f1)"
