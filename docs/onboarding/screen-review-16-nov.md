# Screen review, 16 Nov 2026

Every screen on the "GigSync onboarding" review page (boards Now 1 to Now 7, captured 16 Nov), scored out of 10.
Anything under 9 is rebuilt in the app and captured again on new boards next to the old ones ("New · 16 Nov").

What a 9 needs: aligned to the 16 px grid; type on the scale (body 16, second 14, headings 28, greeting 24); one
idea per screen; no shape inside a shape that does not mean something (a circle in a square, a dot on a picture);
green only for money paid; plain words a first-time phone user knows ("assistant", never "agent"); nothing clipped
or overflowing at 360 px; motion that finishes what it starts.

## Problems that run across many screens

| Problem                                                                                                                                 | Where                                                                                                                          | Fix                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| "Agent" is a word most people do not know                                                                                               | Home ("What should your agent do?"), Jobs, chat, results, profile, website                                                     | "Assistant" everywhere: "your assistant", "Ganesh's assistant", "Take over from my assistant"                                          |
| The launch is about half a second, the name is cut mid-write ("gigsyn"), a white page flashes first, the sun flies over the next screen | First open                                                                                                                     | Rebuilt (see Launch below)                                                                                                             |
| Icon in a tinted square inside a row card (a box in a box)                                                                              | Profile, Help, Moving, People sheet, My QR "Scan a QR", Show my QR                                                             | Kept for now: you liked the profile sheet; listed as an open question                                                                  |
| Circle inside a square                                                                                                                  | Language mandala tile, role cards' radio dot on the picture, Get verified shield in a dashed ring, Jobs empty icon in a circle | Language: drawing without the tile; role: the whole card is the choice, a tick in the corner of the card only once picked; plain icons |
| Green used for things that are not money                                                                                                | "Private…" hint, code screen picture, "Phone verified", "Phone" badge, "Stays on this phone"                                   | Terracotta tint or muted ink; green stays for paid                                                                                     |
| A hint drawn like a button                                                                                                              | Name ("Goes on your card" / "Shown to your helper")                                                                            | Plain muted line under the field                                                                                                       |

## Sign-in (Now 1)

| Screen                   | Score | What is wrong                                                                                      | Rebuild                                                                                                       |
| ------------------------ | ----- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Launch                   | 4     | 0.5 s, word clipped, white flash, the mark lands over the language list                            | Inline first frame in index.html; sunrise over a horizon, letters in one by one, tagline, hold, glide to logo |
| Language                 | 7     | Round mandala boxed in a square tile; brand is tiny in the corner                                  | Drawing on the paper, no tile; brand centred above the greeting                                               |
| Welcome                  | 7     | Small sun and a big empty middle; promises read as a form                                          | Drawing on top, promises as three short lines with icons, terms line kept with the button                     |
| Terms                    | 8.5   | Fine; contents box a little heavy                                                                  | Kept                                                                                                          |
| Your mobile number       | 7.5   | Green privacy pill wraps "it." onto its own line                                                   | Muted lock line: "Only someone you agree a job with sees your number."                                        |
| Country sheet            | 8.5   | Fine                                                                                               | Kept                                                                                                          |
| Enter the code           | 7     | Six circles for digits; green picture tile; disabled "Send again" looks like a dead primary button | Rounded-square boxes with a caret, paper picture tile, "Send again in 30 s" as a quiet text link              |
| What are you looking for | 7     | Radio dot sits on the picture; Kannada sub-label beside an English title                           | Whole card picks; tick appears only when picked; Kannada sub-label kept (open question)                       |
| Name                     | 7.5   | Hint drawn as a chip                                                                               | Plain muted line                                                                                              |
| Signed out               | 7.5   | Explanation sits far from the field, next to the button                                            | Explanation under the heading                                                                                 |

## Find work (Now 2, Now 3)

| Screen                         | Score | What is wrong                              | Rebuild                          |
| ------------------------------ | ----- | ------------------------------------------ | -------------------------------- |
| What work do you do (4 states) | 8.5   | Fine; "Later" floats                       | Kept                             |
| Card chat turns (area, km)     | 8.5   | Fine                                       | Kept                             |
| Price card / lowest price      | 8.5   | Green "Stays on this phone" chip           | Muted lock line                  |
| Languages, one line, quote     | 8.5   | Fine                                       | Kept                             |
| Card read-back                 | 8.5   | Green "Phone" badge on a dark card         | Tint badge                       |
| Home (no card / card)          | 8     | "What should your agent do?"               | "What should your assistant do?" |
| + sheet, typed, listening      | 9     | Good                                       | Kept                             |
| Voice consent                  | 8.5   | Fine                                       | Kept                             |
| Jobs empty                     | 7.5   | Icon in a circle in a dashed card; "agent" | Plain icon, assistant wording    |
| Earnings                       | 8.5   | Fine                                       | Kept                             |
| Profile                        | 8     | Green "Phone verified"                     | Terracotta tick; rows kept       |
| My card                        | 8     | Green "Phone" badge                        | Tint badge                       |
| Work area (2)                  | 8.5   | Fine                                       | Kept                             |
| Get verified                   | 7.5   | Shield in a circle in a dashed ring        | Plain shield drawing, no rings   |
| People you know                | 8.5   | Fine                                       | Kept                             |
| Help (2)                       | 8.5   | Rows as Profile                            | Kept                             |
| Moving (4)                     | 8.5   | Rows as Profile                            | Kept                             |

## Find help (Now 4) and two people (Now 5)

| Screen                  | Score | What is wrong                                                       | Rebuild                                                                     |
| ----------------------- | ----- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Role, name              | 7.5   | As in sign-in                                                       | As in sign-in                                                               |
| Home, +, typed          | 8.5   | Fine                                                                | Kept                                                                        |
| Saved places, add, pin  | 8.5   | Fine                                                                | Kept                                                                        |
| Chat read-back, results | 8     | "Their agents will talk to yours"                                   | "Their assistant will talk to yours"                                        |
| Jobs, Payments          | 8     | "agent" wording                                                     | Assistant                                                                   |
| Profile, My QR          | 8     | Green tick; "what your agent remembers"                             | Terracotta tick; assistant                                                  |
| Jobs, both sides (18)   | 8     | "Agents talking", "Agent's Conversation", "Take over from my agent" | "Assistants talking", "The assistants' chat", "Take over from my assistant" |
| Paid (4)                | 8.5   | Fine; green kept for paid                                           | Kept                                                                        |

## Blocking (Now 6) and the kit

| Screen        | Score | What is wrong                | Rebuild                      |
| ------------- | ----- | ---------------------------- | ---------------------------- |
| People list   | 8.5   | Fine                         | Kept                         |
| Person sheet  | 8     | Person icon in a square tile | Avatar letter, like the list |
| Block confirm | 8     | Shield in a circle           | No icon; title carries it    |
| Blocked       | 8.5   | Fine                         | Kept                         |
