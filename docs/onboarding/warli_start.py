"""The start screens' pictures: the welcome circle, find work, find help, phone, code, greeting."""
import math

from warli_kit import INK, PAPER, basket, circ, ground, hut, line, person, poly, scene, sprig, sun

@scene("welcome", "People holding hands in a circle around two carrying a basket")
def welcome():
    out = []
    cx, cy, R = 100, 80, 66
    n = 14
    pts = []
    for i in range(n):
        a = i * 2 * math.pi / n - math.pi / 2
        pts.append((cx + math.cos(a) * R, cy + math.sin(a) * R, a))
    # joined hands ring
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{R - 1}" fill="none" stroke="{INK}" stroke-width="1.6" stroke-dasharray="1 5" stroke-linecap="round"/>')
    for x, y, a in pts:
        # small figure facing outward: head outside, triangle body toward centre
        ox, oy = math.cos(a), math.sin(a)
        px, py = -oy, ox
        k = 1.35
        head = (x + ox * 9 * k, y + oy * 9 * k)
        tri = [(x + ox * 3 * k + px * 5 * k, y + oy * 3 * k + py * 5 * k), (x + ox * 3 * k - px * 5 * k, y + oy * 3 * k - py * 5 * k), (x - ox * 5 * k, y - oy * 5 * k)]
        out.append(poly(tri))
        out.append(poly([(x - ox * 5 * k, y - oy * 5 * k), (x - ox * 12 * k + px * 5 * k, y - oy * 12 * k + py * 5 * k), (x - ox * 12 * k - px * 5 * k, y - oy * 12 * k - py * 5 * k)]))
        out.append(circ(*head, 3.6 * k))
        # arms to neighbours
        out.append(line([(x + ox * 2 * k + px * 5 * k, y + oy * 2 * k + py * 5 * k), (x + ox * 2 * k + px * 12.5, y + oy * 2 * k + py * 12.5)], 2.2))
        out.append(line([(x + ox * 2 * k - px * 5 * k, y + oy * 2 * k - py * 5 * k), (x + ox * 2 * k - px * 12.5, y + oy * 2 * k - py * 12.5)], 2.2))
    # centre: two figures carrying a basket, with a sun above
    g = 124
    a, _, shR, _ = person(78, g, s=1.08, arms=((64, g - 34), (94, g - 48)))
    b, shL2, _, _ = person(122, g, s=1.08, arms=((106, g - 48), (136, g - 34)))
    out += [a, b, basket(100, g - 50, 28, 13)]
    out.append(line([(66, g + 3), (134, g + 3)], 2))
    return "".join(out)


@scene("work", "Three women walking with baskets on their heads")
def work():
    out = [ground(), sprig(28, 148, 0.9), sprig(176, 148, 0.9)]
    for i, x in enumerate((62, 100, 138)):
        top = 148 - 58
        p, shL, shR, head = person(x, 148, legs="walk", arms=((x - 12, top - 4), (x + 12, top - 4)) if i != 1 else ((x - 12, top - 4), (x + 16, 120)))
        out.append(p)
        out.append(basket(x, head[1] - 8, 22, 10, fill=False))
    return "".join(out)


@scene("help", "A home with someone welcoming a helper at the door")
def help_():
    out = [ground(), hut(78, 148, 72, 66), sprig(176, 148, 0.85)]
    p, *_ = person(136, 148, woman=True, arms=((128, 108), (144, 98)), legs="walk")
    out.append(p)
    return "".join(out)


@scene("phone", "A person holding a phone with a lock on it")
def phone():
    out = [ground()]
    p, shL, shR, head = person(78, 148, woman=True, arms=((66, 112), (104, 96)))
    out.append(p)
    out.append(f'<rect x="104" y="58" width="44" height="74" rx="8" fill="none" stroke="{INK}" stroke-width="3"/>')
    out.append(f'<rect x="118" y="88" width="16" height="13" rx="2" fill="{INK}"/>')
    out.append(f'<path d="M121 88 v-5 a5 5 0 0 1 10 0 v5" fill="none" stroke="{INK}" stroke-width="2.6"/>')
    out.append(circ(126, 124, 2.4))
    out.append(sprig(176, 148, 0.8))
    return "".join(out)


@scene("code", "A phone with a message arriving")
def code():
    out = [ground()]
    out.append(f'<rect x="76" y="40" width="48" height="98" rx="9" fill="none" stroke="{INK}" stroke-width="3"/>')
    out.append(f'<path d="M84 62 h32 a4 4 0 0 1 4 4 v14 a4 4 0 0 1 -4 4 h-22 l-7 6 v-6 h-3 a4 4 0 0 1 -4 -4 v-14 a4 4 0 0 1 4 -4 z" fill="{INK}"/>')
    for i in range(3):
        out.append(circ(92 + i * 8, 73, 2.4, PAPER))
    out.append(circ(100, 128, 2.6))
    p, *_ = person(40, 148, woman=False, arms=((30, 112), (60, 92)), s=0.9)
    out.append(p)
    out.append(sprig(168, 148, 0.85))
    return "".join(out)


@scene("greet", "Two people greeting each other with folded hands")
def greet():
    out = [ground(), sprig(24, 148, 0.8), sprig(178, 148, 0.8)]
    a, *_ = person(74, 148, woman=True, arms=((86, 104), (86, 104)))
    b, *_ = person(126, 148, woman=False, arms=((114, 104), (114, 104)))
    out += [a, b]
    return "".join(out)
