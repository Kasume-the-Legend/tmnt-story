import ast,json,os,re
P='/home/claude/pk/data/cutscenes/tm/pools'
src=open('/home/claude/cs/tm_pools.py').read()
i=src.index('ST={');j=src.index('\n}',i)+2
ST=ast.literal_eval(src[i+3:j])
stages={k:dict(place=v[0],enemies=v[1],hazard=v[2],boss=v[3],boss_short=v[5],tier=v[6],objective=v[7]) for k,v in ST.items()}
bible=json.load(open('/home/claude/out/director/show_bible/bible.json'))
def unx(s):return '' if s=='-' else s.replace('_',' ')
pools={}
for f in sorted(os.listdir(P)):
    n=f[:-4];L=open(P+'/'+f).read().split('\n')[1:]
    seeds=[];sp={}
    for l in L:
        t=l.split(' ')
        if len(t)<6 or t[0]!='say':continue
        sp[t[1]]=unx(t[2]);seeds.append([t[1],unx(t[2])]+[unx(x) for x in t[3:6]])
    stage=None
    for s in stages:
        if n.endswith('_'+s) and (stage is None or len(s)>len(stage)):stage=s
    kind=n[:-len(stage)-1] if stage else re.sub(r'_[a-z]+$','',n) if re.match(r'^(invest|hurt|react|close|resolve|lair)_',n) else n
    if n.startswith('taunt_'):kind='taunt'
    if n.startswith('twist_'):kind='twist'
    hero=None
    m=re.match(r'^(invest|hurt|react|close|resolve|lair)_(\w+)$',n)
    if m:kind,hero=m.group(1),m.group(2)
    pools[n]=dict(kind=kind,stage=stage,hero=hero,speakers=sp,seeds=seeds)
json.dump(dict(pools=pools,stages=stages,bible=bible),open('src/data.json','w'),indent=0,ensure_ascii=False)
print(len(pools),len(stages),sorted({p['kind'] for p in pools.values()}))
