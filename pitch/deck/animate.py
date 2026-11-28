"""Adds slide transitions and build animations to pitch/HisaabAI_Pitch.pptx.

pptxgenjs cannot write animations, so build.js names every animated object and writes the
plan to anim.json: per slide, a list of {name, effect, trigger, delay}.
  trigger "click": waits for a click   "after": starts when the previous one ends
  trigger "with":  starts with the previous one (plus delay, in ms)
  effect  "fade" | "wipe" (from the left, for arrows) | "zoom" (lands from big, for the stamp)
A slide whose first item is not "click" builds by itself when the slide opens.

    python animate.py
"""
import json
import os
import shutil
import time
import sys
import tempfile
import zipfile

from lxml import etree

HERE = os.path.dirname(os.path.abspath(__file__))
DECK = os.path.join(HERE, "..", "HisaabAI_Pitch.pptx")
NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}
P = "{%s}" % NS["p"]
DUR = {"fade": 500, "wipe": 450, "zoom": 450}


class Ids:
    def __init__(self):
        self.n = 2  # 1 = tmRoot, 2 = mainSeq

    def next(self):
        self.n += 1
        return self.n


def effect_xml(ids, spid, effect, start, node_type):
    dur = DUR[effect]
    tgt = f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>'
    show = (
        f'<p:set><p:cBhvr><p:cTn id="{ids.next()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>'
        f'{tgt}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>'
        f'<p:to><p:strVal val="visible"/></p:to></p:set>'
    )
    if effect == "fade":
        preset, sub = 10, 0
        body = show + f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{ids.next()}" dur="{dur}"/>{tgt}</p:cBhvr></p:animEffect>'
    elif effect == "wipe":
        preset, sub = 22, 8
        body = show + f'<p:animEffect transition="in" filter="wipe(left)"><p:cBhvr><p:cTn id="{ids.next()}" dur="{dur}"/>{tgt}</p:cBhvr></p:animEffect>'
    elif effect == "zoom":
        preset, sub = 53, 16

        def scale(attr):
            return (
                f'<p:anim calcmode="lin" valueType="num"><p:cBhvr><p:cTn id="{ids.next()}" dur="{dur}" fill="hold"/>{tgt}'
                f'<p:attrNameLst><p:attrName>{attr}</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst>'
                f'<p:tav tm="0"><p:val><p:strVal val="#{attr}*2.2"/></p:val></p:tav>'
                f'<p:tav tm="100000"><p:val><p:strVal val="#{attr}"/></p:val></p:tav></p:tavLst></p:anim>'
            )

        body = show + scale("ppt_w") + scale("ppt_h") + (
            f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{ids.next()}" dur="{dur}"/>{tgt}</p:cBhvr></p:animEffect>'
        )
    else:
        raise ValueError(effect)
    return (
        f'<p:par><p:cTn id="{ids.next()}" presetID="{preset}" presetClass="entr" presetSubtype="{sub}" fill="hold" grpId="0" '
        f'nodeType="{node_type}"><p:stCondLst><p:cond delay="{start}"/></p:stCondLst><p:childTnLst>{body}</p:childTnLst></p:cTn></p:par>'
    )


def timing_xml(plan, idmap):
    ids = Ids()
    groups = []  # [(is_click, [(spid, effect, start, nodeType)])]
    prev_start = prev_end = 0
    for i, item in enumerate(plan):
        spid = idmap.get(item["name"])
        if spid is None:
            sys.exit(f"animated object not found on the slide: {item['name']}")
        eff, trig, delay = item["effect"], item["trigger"], int(item.get("delay", 0))
        if trig == "click" or not groups:
            groups.append((trig == "click", []))
            start = delay
            node = "clickEffect" if trig == "click" else "afterEffect"
        elif trig == "after":
            start = prev_end + delay
            node = "withEffect"
        else:  # with
            start = prev_start + delay
            node = "withEffect"
        groups[-1][1].append((spid, eff, start, node))
        prev_start = start
        prev_end = max(prev_end if trig != "click" else 0, start + DUR[eff])
    pars = []
    for is_click, effects in groups:
        if is_click:
            cond = '<p:cond delay="indefinite"/>'
        else:  # builds by itself as the slide opens
            cond = '<p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond>'
        inner = "".join(effect_xml(ids, *e) for e in effects)
        pars.append(
            f'<p:par><p:cTn id="{ids.next()}" fill="hold"><p:stCondLst>{cond}</p:stCondLst><p:childTnLst>'
            f'<p:par><p:cTn id="{ids.next()}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst>'
            f'<p:childTnLst>{inner}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>'
        )
    return (
        f'<p:timing xmlns:p="{NS["p"]}"><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
        f'<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>{"".join(pars)}</p:childTnLst></p:cTn>'
        f'<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
        f'<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
        f'</p:childTnLst></p:cTn></p:par></p:tnLst><p:bldLst/></p:timing>'
    )


def process(xml_bytes, plan, slide_no):
    root = etree.fromstring(xml_bytes)
    # name -> shape id, and which ids are text shapes / charts (they need a build entry)
    idmap, kinds = {}, {}
    for el in root.iter(P + "sp", P + "pic", P + "graphicFrame", P + "cxnSp"):
        c = el.find(".//p:cNvPr", NS)
        if c is not None:
            idmap[c.get("name")] = c.get("id")
            kinds[c.get("id")] = etree.QName(el).localname
    # transition: a soft fade (through black into the hook)
    for old in root.findall("p:transition", NS) + root.findall("p:timing", NS):
        root.remove(old)
    trans = etree.fromstring(
        f'<p:transition xmlns:p="{NS["p"]}" spd="med"><p:fade{" thruBlk=\"1\"" if slide_no == 1 else ""}/></p:transition>'
    )
    clr = root.find("p:clrMapOvr", NS)
    clr.addnext(trans)
    if plan:
        timing = etree.fromstring(timing_xml(plan, idmap))
        bld = timing.find("p:bldLst", NS)
        seen = set()
        for item in plan:
            spid = idmap[item["name"]]
            if spid in seen:
                continue
            seen.add(spid)
            if kinds[spid] == "sp":
                etree.SubElement(bld, P + "bldP", spid=spid, grpId="0", animBg="1")
            elif kinds[spid] == "graphicFrame":
                g = etree.SubElement(bld, P + "bldGraphic", spid=spid, grpId="0")
                etree.SubElement(g, P + "bldAsOne")
        if len(bld) == 0:
            timing.remove(bld)
        trans.addnext(timing)
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def main():
    plan = json.load(open(os.path.join(HERE, "anim.json"), encoding="utf-8"))
    src = zipfile.ZipFile(DECK)
    fd, tmp = tempfile.mkstemp(suffix=".pptx")
    os.close(fd)
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as out:
        for info in src.infolist():
            data = src.read(info.filename)
            name = info.filename
            if name.startswith("ppt/slides/slide") and name.endswith(".xml"):
                n = int(name[len("ppt/slides/slide"):-4])
                data = process(data, plan.get(str(n), []), n)
            out.writestr(info, data)
    src.close()
    # A freshly written file is often scanned by antivirus or the indexer for a moment:
    # wait for the lock to go instead of failing.
    for attempt in range(20):
        try:
            os.replace(tmp, DECK)
            break
        except PermissionError:
            if attempt == 19:
                sys.exit(f"{DECK} is open in another program (close it in PowerPoint and run again)")
            time.sleep(0.5)
    print("animated", sum(len(v) for v in plan.values()), "objects on", len(plan), "slides; transitions on all slides")


if __name__ == "__main__":
    main()
