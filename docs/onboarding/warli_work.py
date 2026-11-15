"""One picture per kind of work, for the work tiles."""
import math

from warli_kit import INK, PAPER, basket, circ, ground, hut, line, person, poly, scene, sprig, sun

@scene("cook", "Someone cooking at a stove")
def cook():
    out = [ground()]
    p, *_ = person(70, 148, woman=True, arms=((96, 104), (100, 110)))
    out.append(p)
    # stove and pot
    out.append(f'<rect x="100" y="120" width="54" height="28" fill="{INK}"/>')
    for i in range(3):
        out.append(poly([(110 + i * 16, 120), (116 + i * 16, 110), (122 + i * 16, 120)]))
    out.append(f'<path d="M104 102 h46 l-4 16 h-38 z" fill="{INK}"/>')
    out.append(line([(118, 96), (120, 86), (117, 78)], 1.8))
    out.append(line([(132, 96), (134, 86), (131, 78)], 1.8))
    out.append(line([(98, 106), (90, 104)], 2.4))
    return "".join(out)


@scene("clean", "Someone sweeping with a broom")
def clean():
    out = [ground()]
    p, *_ = person(86, 148, woman=True, arms=((106, 116), (112, 126)), lean=0.6)
    out.append(p)
    out.append(line([(100, 106), (128, 142)], 2.6))
    out.append(poly([(124, 136), (136, 150), (146, 142)]))
    for i in range(4):
        out.append(circ(152 + i * 7, 146 - (i % 2) * 3, 1.6))
    out.append(sprig(34, 148, 0.85))
    return "".join(out)


@scene("care", "Someone helping an older person walk with a stick")
def care():
    out = [ground(), sprig(176, 148, 0.85)]
    a, *_ = person(74, 148, woman=True, arms=((60, 120), (92, 110)))
    b, *_ = person(108, 148, woman=False, arms=((94, 110), (128, 118)), lean=0.8, s=0.92)
    out += [a, b, line([(128, 116), (132, 148)], 2.6)]
    return "".join(out)


@scene("baby", "Someone holding a baby")
def baby():
    out = [ground(), sprig(36, 148, 0.85), sprig(168, 148, 0.85)]
    p, shL, shR, head = person(100, 148, woman=True, arms=((112, 112), (90, 112)))
    out.append(p)
    out.append(poly([(90, 106), (90, 116), (110, 111)]))
    out.append(poly([(110, 111), (104, 106), (104, 116)]))
    out.append(circ(115, 108, 4.6))
    return "".join(out)


@scene("drive", "Someone driving a car")
def drive():
    out = [ground()]
    out.append(f'<path d="M30 132 h140 l-8 -22 h-34 l-14 -18 h-44 l-14 18 h-18 z" fill="{INK}"/>')
    out.append(f'<path d="M78 98 h34 l10 12 h-48 z" fill="{PAPER}"/>')
    out.append(circ(94, 104, 5))
    out.append(circ(62, 136, 12) + circ(62, 136, 5, PAPER))
    out.append(circ(140, 136, 12) + circ(140, 136, 5, PAPER))
    return "".join(out)


@scene("plumb", "Someone fixing a pipe with a spanner")
def plumb():
    out = [ground()]
    p, *_ = person(72, 148, woman=False, arms=((98, 100), (96, 112)))
    out.append(p)
    out.append(line([(120, 66), (120, 92), (160, 92), (160, 148)], 7))
    out.append(f'<rect x="113" y="86" width="14" height="12" fill="{INK}"/>')
    out.append(line([(98, 100), (116, 92)], 3))
    out.append(circ(160, 60, 0.1))
    for i in range(3):
        out.append(circ(166 + i * 3, 100 + i * 7, 2))
    return "".join(out)


@scene("electric", "Someone on a ladder fixing a light bulb")
def electric():
    out = [ground()]
    out.append(line([(92, 148), (112, 50)], 2.6) + line([(122, 148), (138, 50)], 2.6))
    for i in range(5):
        y = 138 - i * 20
        out.append(line([(94 + (148 - y) * 0.2, y), (124 + (148 - y) * 0.16, y)], 2.2))
    p, *_ = person(116, 112, woman=False, arms=((130, 56), (108, 84)), s=0.85)
    out.append(p)
    out.append(circ(138, 36, 9))
    out.append(f'<rect x="133" y="44" width="10" height="7" fill="{INK}"/>')
    for a in (-0.6, 0, 0.6):
        out.append(line([(138 + math.sin(a) * 14, 36 - math.cos(a) * 14), (138 + math.sin(a) * 20, 36 - math.cos(a) * 20)], 2))
    return "".join(out)


@scene("paint", "Someone painting a wall with a roller")
def paint():
    out = [ground()]
    out.append(f'<rect x="112" y="40" width="64" height="108" fill="none" stroke="{INK}" stroke-width="2.6"/>')
    out.append(f'<rect x="112" y="40" width="64" height="62" fill="{INK}"/>')
    p, *_ = person(74, 148, woman=False, arms=((104, 96), (98, 112)))
    out.append(p)
    out.append(line([(104, 96), (110, 90)], 2.6))
    out.append(f'<rect x="106" y="98" width="22" height="9" rx="3" fill="{INK}"/>')
    return "".join(out)


@scene("carpentry", "Someone sawing a plank")
def carpentry():
    out = [ground()]
    out.append(f'<rect x="100" y="112" width="70" height="8" fill="{INK}"/>')
    out.append(line([(108, 120), (108, 148)], 3) + line([(162, 120), (162, 148)], 3))
    p, *_ = person(72, 148, woman=False, arms=((112, 104), (100, 112)), lean=0.4)
    out.append(p)
    out.append(poly([(112, 98), (140, 112), (138, 118), (110, 106)]))
    return "".join(out)


@scene("tailor", "Someone sewing at a sewing machine")
def tailor():
    out = [ground()]
    p, *_ = person(60, 148, woman=True, arms=((92, 108), (96, 112)), legs="sit")
    out.append(p)
    out.append(f'<rect x="86" y="114" width="80" height="8" fill="{INK}"/>')
    out.append(line([(94, 122), (94, 148)], 3) + line([(158, 122), (158, 148)], 3))
    out.append(f'<path d="M104 112 v-26 h46 v12 h-10 v14 z" fill="{INK}"/>')
    out.append(line([(140, 112), (140, 118)], 2))
    out.append(circ(152, 92, 5) + circ(152, 92, 2, PAPER))
    return "".join(out)


@scene("garden", "Someone watering plants")
def garden():
    out = [ground()]
    p, *_ = person(66, 148, woman=True, arms=((92, 108), (88, 116)))
    out.append(p)
    out.append(f'<path d="M88 104 h18 v16 h-18 z" fill="{INK}"/>')
    out.append(line([(106, 108), (120, 98)], 3))
    for i in range(4):
        out.append(circ(124 + i * 3, 104 + i * 6, 1.6))
    out.append(sprig(132, 148, 1.1) + sprig(154, 148, 0.9) + sprig(174, 148, 1.0))
    return "".join(out)


@scene("laundry", "Clothes drying on a line")
def laundry():
    out = [ground()]
    out.append(line([(30, 148), (30, 60)], 3) + line([(170, 148), (170, 60)], 3))
    out.append(f'<path d="M30 64 Q100 76 170 64" fill="none" stroke="{INK}" stroke-width="2"/>')
    out.append(poly([(48, 68), (64, 70), (66, 96), (46, 96)]))
    out.append(f'<path d="M84 71 h22 v8 h-4 v20 h-14 v-20 h-4 z" fill="{INK}"/>')
    out.append(poly([(124, 71), (142, 69), (148, 104), (118, 104)]))
    p, *_ = person(150, 148, woman=True, arms=((142, 80), (162, 120)), s=0.95)
    out.append(p)
    return "".join(out)


@scene("move", "Two people carrying a box")
def move():
    out = [ground()]
    a, *_ = person(56, 148, woman=False, arms=((76, 100), (80, 108)))
    b, *_ = person(144, 148, woman=False, arms=((124, 100), (120, 108)))
    out += [a, b, f'<rect x="76" y="92" width="48" height="34" fill="{INK}"/>', line([(76, 109), (124, 109)], 1.6).replace(INK, PAPER)]
    return "".join(out)


@scene("teach", "Someone teaching at a board")
def teach():
    out = [ground()]
    out.append(f'<rect x="96" y="44" width="78" height="54" fill="{INK}"/>')
    out.append(line([(106, 60), (130, 60)], 2).replace(INK, PAPER) + line([(106, 72), (150, 72)], 2).replace(INK, PAPER) + line([(106, 84), (138, 84)], 2).replace(INK, PAPER))
    out.append(line([(110, 98), (104, 148)], 2.6) + line([(160, 98), (166, 148)], 2.6))
    p, *_ = person(64, 148, woman=True, arms=((50, 120), (96, 70)))
    out.append(p)
    return "".join(out)


@scene("guard", "A guard standing at a gate")
def guard():
    out = [ground()]
    out.append(f'<rect x="112" y="64" width="8" height="84" fill="{INK}"/><rect x="168" y="64" width="8" height="84" fill="{INK}"/>')
    for i in range(6):
        out.append(line([(124 + i * 8, 76), (124 + i * 8, 148)], 2))
    out.append(line([(120, 76), (168, 76)], 2.4))
    p, *_ = person(76, 148, woman=False, arms=((62, 120), (98, 112)))
    out.append(p)
    out.append(line([(98, 112), (102, 150)], 3))
    return "".join(out)


@scene("repair", "Someone repairing a washing machine")
def repair():
    out = [ground()]
    out.append(f'<rect x="108" y="76" width="58" height="72" rx="6" fill="{INK}"/>')
    out.append(circ(137, 116, 17, PAPER) + circ(137, 116, 11))
    out.append(line([(116, 88), (132, 88)], 2.4).replace(INK, PAPER))
    p, *_ = person(66, 148, woman=False, arms=((100, 104), (104, 118)), legs="sit")
    out.append(p)
    return "".join(out)


@scene("beauty", "Someone doing another's hair")
def beauty():
    out = [ground()]
    a, *_ = person(118, 148, woman=True, arms=((106, 118), (130, 118)), legs="sit", s=0.9)
    b, *_ = person(78, 148, woman=True, arms=((108, 96), (112, 104)))
    out += [a, b]
    return "".join(out)


@scene("events", "People drumming and dancing")
def events():
    out = [ground()]
    a, *_ = person(56, 148, woman=False, arms=((70, 104), (78, 112)))
    out.append(a)
    out.append(f'<rect x="72" y="104" width="22" height="16" rx="6" fill="{INK}"/>')
    b, *_ = person(126, 148, woman=True, arms=((110, 74), (144, 74)), legs="walk")
    c, *_ = person(160, 148, woman=True, arms=((146, 74), (176, 74)), legs="walk", s=0.9)
    out += [b, c]
    return "".join(out)
