from pathlib import Path
import base64,hashlib,json
root=Path('native/ei-core');wasm=root/'wasm/ei-core.wasm';b=wasm.read_bytes();sha=hashlib.sha256(b).hexdigest()
Path('src/model/ei-core-binary.ts').write_text('/** Generated from the retained C core; no downloaded runtime code. */\nexport const EI_CORE_WASM_SHA256='+json.dumps(sha)+'\nexport const EI_CORE_WASM_BASE64='+json.dumps(base64.b64encode(b).decode())+'\n')
(root/'wasm/manifest.json').write_text(json.dumps({'format':'ei-core-wasm-build/v1','compiler':'Zig0.17.0 C compiler','compilerSource':'https://ziglang.org/download/0.17.0/zig-x86_64-linux-0.17.0.tar.xz','target':'wasm32-freestanding','sourceSha256':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [root/'ei_core.c',root/'ei_core.h',root/'wasm/bridge.c',root/'wasm/memory.c',root/'wasm/include/string.h']},'binarySha256':sha,'binaryBytes':len(b),'imports':[],'memoryBytes':65536,'profile':{'nodes':64,'edges':128,'receipts':255},'compilerSelfHostedByUserMechanism':False,'physicalBoardTested':False},indent=2)+'\n')
print(json.dumps({'bytes':len(b),'sha256':sha}))
