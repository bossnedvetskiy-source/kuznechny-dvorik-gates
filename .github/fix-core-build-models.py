from pathlib import Path
p=Path('scripts/build.mjs')
s=p.read_text(encoding='utf-8')
old="""const gateModelsMatch = gateModelsScript.match(/window\\.GATE_CALC_MODELS\\s*=\\s*({[\\s\\S]*});?\\s*$/);\nif (!gateModelsMatch) throw new Error('Не удалось распаковать серверные модели ворот');\nconst rawGateModels = Function(`\"use strict\"; return (${gateModelsMatch[1]});`)();"""
new="""const rawGateModels = Function('window', '\"use strict\";\\n' + gateModelsScript + '\\nreturn window.GATE_CALC_MODELS;')({});\nif (!rawGateModels?.models) throw new Error('Не удалось распаковать серверные модели ворот');"""
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('gate model build block not found')
p.write_text(s,encoding='utf-8')
