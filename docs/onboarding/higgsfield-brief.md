# Brief: Higgsfield pictures for onboarding (paste into a new Claude Code session)

Make onboarding pictures for the GigSync app with the Higgsfield connector (load its tools with ToolSearch
"higgsfield"). Use it sparingly: the plan has 120 credits a month (about 60 Nano Banana Pro images) and must last at
least a week.

## Round 1: two style samples, then stop

1. Generate exactly two images with Nano Banana Pro:
   - `welcome`: a circle of people holding hands, and in the middle two women carrying a basket of food between them.
   - `find-work`: three women walking together carrying baskets on their heads.
2. Style for both, identical so the set matches: Warli folk-art style from Maharashtra (stick figures with circle
   heads and two triangles for the body, simple line limbs), in one terracotta ink colour #A4512B on a plain warm
   cream background #FAF6EE; flat, no shading, texture, gradients, text, frame or border; generous empty space; the
   whole scene inside the image, nothing cut off at the edges; square 1:1.
3. Save each at full size in `docs/onboarding/higgsfield/` of the `.claude/worktrees/onboarding` worktree
   (`welcome.png`, `find-work.png`), and write `docs/onboarding/higgsfield/credits.md`: date, each prompt, the model,
   credits used per image and the balance left if the tool reports it.
4. Look at both images: nothing cut at an edge, no text or watermark, plain cream background, figures in one terracotta
   colour. A failed image may be regenerated once.
5. Show both images and the credits used, and ask whether to make the rest in this style.

## Round 2, only after a yes: 14 more

find-help (a home with someone welcoming a helper at the door), phone (a person holding a phone with a lock),
card-ready (two people greeting with folded hands), verified (a person with a shield), and ten work tiles: house
cleaning, cooking, driving, baby care, elder care, electrician, plumber, painter, carpenter, tailoring.

## Rules

- Write only inside `docs/onboarding/higgsfield/`: another session works on the app code in this worktree.
- No commits, pushes or branch changes. At most 6 credits in round 1, about 32 credits for all 16 images.
