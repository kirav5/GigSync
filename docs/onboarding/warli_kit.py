"""The drawing kit for GigSync's Warli-style pictures: whole figures and objects drawn as vectors, no crops.

Each scene is a 200x160 viewBox: figures are a circle head, a triangle torso (and skirt or lower triangle), line
limbs; one terracotta ink; a dotted ground. The scenes live in warli_start.py and warli_work.py; warli_art.py draws them.
"""
import math

INK = "#A4512B"
PAPER = "#FFFFFF"
SW = 3.2  # limb stroke


def line(pts, w=SW):
    d = " ".join(f"{'M' if i == 0 else 'L'}{x:.1f} {y:.1f}" for i, (x, y) in enumerate(pts))
    return f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'


def poly(pts, fill=INK):
    p = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    return f'<polygon points="{p}" fill="{fill}" stroke="{fill}" stroke-width="1.2" stroke-linejoin="round"/>'


def circ(x, y, r, fill=INK):
    return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{fill}"/>'


def person(x, ground, *, woman=True, s=1.0, arms=None, legs="stand", lean=0.0, bun=True):
    """A standing Warli figure with its feet on `ground`. `arms` is (left hand, right hand) as absolute points,
    or None for arms hanging. `legs`: stand | walk | sit. Returns svg and the shoulder points."""
    h = 58 * s
    top = ground - h
    hx = x + lean * 6 * s
    out = []
    head_y = top + 6 * s
    sh_y = top + 15 * s
    waist = (x + lean * 2 * s, top + 29 * s)
    shL = (hx - 9 * s, sh_y)
    shR = (hx + 9 * s, sh_y)
    out.append(poly([shL, shR, waist]))
    if woman:
        hem = top + 44 * s
        out.append(poly([waist, (waist[0] - 12 * s, hem), (waist[0] + 12 * s, hem)]))
        for i, (dx, dy) in enumerate([(-5, 37), (0, 40), (5, 37), (-2.5, 33), (2.5, 33)]):
            out.append(circ(waist[0] + dx * s, top + dy * s, 1.1 * s, PAPER))
        leg_top = (waist[0] - 4 * s, hem), (waist[0] + 4 * s, hem)
    else:
        hip = top + 40 * s
        out.append(poly([waist, (waist[0] - 9 * s, hip), (waist[0] + 9 * s, hip)]))
        leg_top = (waist[0] - 6 * s, hip), (waist[0] + 6 * s, hip)
    # head
    out.append(circ(hx, head_y, 6.5 * s))
    if woman and bun:
        out.append(circ(hx - 6 * s, head_y - 3 * s, 2.6 * s))
    out.append(line([(hx, head_y + 5 * s), (hx, sh_y)], 2.4 * s))
    # legs
    lt, rt = leg_top
    if legs == "walk":
        out.append(line([lt, (lt[0] - 7 * s, ground - 1), (lt[0] - 11 * s, ground)], SW * s))
        out.append(line([rt, (rt[0] + 6 * s, ground - 1), (rt[0] + 11 * s, ground)], SW * s))
    elif legs == "sit":
        out.append(line([lt, (lt[0] - 10 * s, lt[1] + 2 * s), (lt[0] - 10 * s, ground)], SW * s))
        out.append(line([rt, (rt[0] + 10 * s, rt[1] + 2 * s), (rt[0] + 10 * s, ground)], SW * s))
    else:
        out.append(line([lt, (lt[0] - 2 * s, ground), (lt[0] - 7 * s, ground)], SW * s))
        out.append(line([rt, (rt[0] + 2 * s, ground), (rt[0] + 7 * s, ground)], SW * s))
    # arms: shoulder to elbow to hand
    if arms is None:
        arms = ((shL[0] - 6 * s, sh_y + 20 * s), (shR[0] + 6 * s, sh_y + 20 * s))
    for sh, hand in ((shL, arms[0]), (shR, arms[1])):
        if hand is None:
            continue
        ex = (sh[0] + hand[0]) / 2 + (-3 if hand[0] < sh[0] else 3) * s
        ey = (sh[1] + hand[1]) / 2 + 3 * s
        out.append(line([sh, (ex, ey), hand], SW * s * 0.9))
    return "".join(out), shL, shR, (hx, head_y)


def ground(y=148, x0=18, x1=182):
    dots = "".join(circ(x, y + 4, 1.6) for x in range(int(x0), int(x1) + 1, 9))
    return line([(x0, y), (x1, y)], 2.2) + dots


def sprig(x, y, s=1.0):
    """A small Warli plant: a stem with paired leaves."""
    out = [line([(x, y), (x, y - 26 * s)], 2.2)]
    for i in range(3):
        yy = y - 8 * s - i * 7 * s
        out.append(f'<ellipse cx="{x - 5 * s:.1f}" cy="{yy:.1f}" rx="{5 * s:.1f}" ry="{2.4 * s:.1f}" transform="rotate(-30 {x - 5 * s:.1f} {yy:.1f})" fill="{INK}"/>')
        out.append(f'<ellipse cx="{x + 5 * s:.1f}" cy="{yy - 3 * s:.1f}" rx="{5 * s:.1f}" ry="{2.4 * s:.1f}" transform="rotate(30 {x + 5 * s:.1f} {yy - 3 * s:.1f})" fill="{INK}"/>')
    return "".join(out)


def sun(x, y, r=9):
    rays = "".join(
        line([(x + math.cos(a) * (r + 3), y + math.sin(a) * (r + 3)), (x + math.cos(a) * (r + 8), y + math.sin(a) * (r + 8))], 2.2)
        for a in [i * math.pi / 6 for i in range(12)]
    )
    return circ(x, y, r) + rays


def basket(x, y, w=26, h=14, fill=True):
    out = [f'<path d="M{x - w / 2} {y} Q{x} {y + h * 1.6} {x + w / 2} {y} Z" fill="{INK}"/>']
    for i in range(-2, 3):
        out.append(line([(x + i * w / 7, y + 2), (x + i * w / 9, y + h * 0.75)], 1.2).replace(INK, PAPER))
    if fill:
        for i in range(5):
            out.append(circ(x - 9 + i * 4.5, y - 3 - (2 if i % 2 else 0), 3))
    return "".join(out)


def hut(x, ground_y, w=70, h=60):
    roof_y = ground_y - h
    wall_top = roof_y + h * 0.42
    out = [poly([(x - w / 2 - 6, wall_top), (x, roof_y), (x + w / 2 + 6, wall_top)])]
    # thatch lines
    for i in range(1, 8):
        t = i / 8
        out.append(line([(x, roof_y + 4), (x - w / 2 - 6 + t * (w + 12), wall_top - 1)], 1.1).replace(INK, PAPER))
    out.append(f'<rect x="{x - w / 2:.1f}" y="{wall_top:.1f}" width="{w}" height="{ground_y - wall_top:.1f}" fill="none" stroke="{INK}" stroke-width="2.6"/>')
    for r in range(3):
        for c in range(6):
            out.append(circ(x - w / 2 + 7 + c * 11 + (r % 2) * 5, wall_top + 8 + r * 8, 1.5))
    out.append(f'<rect x="{x - 8:.1f}" y="{ground_y - 24:.1f}" width="16" height="24" fill="{INK}"/>')
    return "".join(out)


def svg(body, label):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" role="img" aria-label="{label}">'
        f"{body}</svg>"
    )


SCENES = {}


def scene(name, label):
    def wrap(fn):
        SCENES[name] = (label, fn)
        return fn

    return wrap
