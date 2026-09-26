# Photo guide: taking a picture of your reading

User-facing guidance for the photo/OCR entry flow. The same six tips appear in the animated
guide (`assets/guides/photo-guide.webp`, GIF fallback `photo-guide.gif`) and as individual
slides (`assets/guides/photo-guide-slides/slide-0.jpg` … `slide-7.jpg`) for a swipeable,
self-paced version. Use the text below verbatim for in-app copy and accessibility labels.

## The six tips

1. **Wait for the final reading.** Take the photo only when the numbers have stopped changing
   and the result is on the screen.
2. **Get close.** The screen should fill most of the photo. You can crop away everything else
   before saving.
3. **Keep it straight and upright.** Face the screen straight on and hold the phone the same way
   up as the numbers. Don't turn it sideways.
4. **No glare or shine.** Move away from windows and lamps, and turn off the flash. If you see a
   reflection, tilt the meter slightly.
5. **Hold steady.** Rest the meter on a table, keep your phone still, and tap the screen to focus
   before taking the photo.
6. **Check before you save.** The app fills in the numbers for you. Always compare them with your
   meter's screen and fix anything that's wrong.

### Quick checklist

- Final reading on screen
- Screen fills the photo
- Straight on and upright
- No glare, no flash
- Steady and in focus
- Check the numbers before saving

## Notes for the team

- **Why these tips:** they target the failure modes seen in the crowdsourced sample
  (`bp monitor_images/`, `glucometer_images/`, 414 photos, ~15 brands): the display is
  often only 5–15% of the frame, glare/reflections, steep angles, 90° sideways shots, blank or
  mid-measurement screens, and blur. Each tip's "Avoid" example is a real photo from that set.
- **These tips are necessary but not sufficient.** On 12 photos from that set, cropped to the
  display (i.e. a user who followed tips 2–3 perfectly), the current seven-segment decoder read
  only 3/12 correctly (3/6 glucometers, 0/6 BP monitors). Framing isn't the bottleneck any more:
  the decoder is tuned to the Omron HEM-7111 and Accu-Chek Active fonts and doesn't yet generalize
  to other brands. Keep tip 6 prominent and the auto-filled values editable.
- **Image rights:** five example photos (tips 1–5 "Avoid", and the "Do this" crops for tips 2–4)
  come from the crowdsourced set. Confirm contributors consented to their photos being
  redistributed inside the app before shipping these assets; if not, swap in team-shot photos.
  Photos showing people's bodies were deliberately avoided, and the blur example is synthetic.
- **Format:** animated WebP (~0.75 MB, 540×960) plays in-app via `expo-image` on both platforms;
  the GIF (~1.2 MB, 360×640) is a fallback. There's no MP4 because ffmpeg isn't installed on the
  build machine; with ffmpeg, the slides convert directly.
