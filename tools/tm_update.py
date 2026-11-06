#!/usr/bin/env python3
"""Turtle Mania story updater. Downloads fresh AI-written dialogue pools into the game folder.
Usage: python tm_update.py [game_folder] [--url https://tmnt-story.<you>.workers.dev]
The game reads these loose files before the ones inside the .pak, and falls back to the
built-in pool whenever a file is missing - so deleting data/ removes the updates safely."""
import json, os, sys, urllib.request
URL = "https://tmnt-story.YOUR-SUBDOMAIN.workers.dev"
args = [a for a in sys.argv[1:]]
if "--url" in args:
    i = args.index("--url"); URL = args[i + 1]; del args[i:i + 2]
root = os.path.abspath(args[0]) if args else os.getcwd()
vfile = os.path.join(root, "tm_story_version.txt")
since = 0
try: since = int(open(vfile).read().strip())
except Exception: pass
req = urllib.request.Request(URL.rstrip("/") + "/pack?since=%d" % since, headers={"User-Agent": "tmnt-last-ronin-updater"})
try:
    pack = json.load(urllib.request.urlopen(req, timeout=20))
except Exception as e:
    print("Could not reach the story server (%s). The game keeps its built-in story." % e); sys.exit(0)
n = 0
for rel, text in pack.get("files", {}).items():
    if not rel.startswith("data/cutscenes/tm/pools/") or ".." in rel or not rel.endswith(".txt"): continue
    dst = os.path.join(root, *rel.split("/")); os.makedirs(os.path.dirname(dst), exist_ok=True)
    open(dst, "w", newline="\n").write(text); n += 1
open(vfile, "w").write(str(pack.get("version", since)))
print("Turtle Mania story updated: %d scene pools refreshed (version %s)." % (n, pack.get("version")))
