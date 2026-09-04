# Prerecorded voice-guidance cues

`js/voice-guidance.js` → `playCue(key, thaiFallbackText)` looks for
`assets/audio/<key>.mp3` and plays it if present, otherwise falls back to the
browser's speech synthesis (`speakVoiceGuidance`).

Recorded clips are worth adding because many devices (desktop Chrome, some
Android builds) ship **no Thai TTS voice**, so synthesized guidance comes out
garbled or silent. A short recorded clip is crisp, consistent, and works
offline.

Record these as mono MP3, normal speaking pace, calm tone:

| key                | Thai line                                                        |
|--------------------|-----------------------------------------------------------------|
| `capture-success`  | ถ่ายภาพสำเร็จ กำลังอ่านข้อความ                                    |
| `no-text`          | ยังไม่เจอข้อความ ลองเล็งกล้องไปที่หนังสือหรือกระดาษ               |
| `too-dark`         | แสงน้อยไป ลองเปิดไฟหรือหาที่ที่สว่างกว่านี้                        |
| `glare`            | มีแสงสะท้อนบนหน้ากระดาษ เอียงหนังสือหนีแสงหน่อย                   |
| `lens-covered`     | มีอะไรบังกล้องอยู่ ขยับกล้องออกหน่อย                              |
| `person`           | กล้องเจอคน ยังไม่เจอเอกสาร ลองเล็งกล้องไปที่หนังสือ               |
| `hold-still`       | ตัวอักษรชัดเจนแล้ว ถือค้างไว้                                     |

Until a clip is added, the app just uses TTS for that cue — no code change
needed when you drop the files in.
