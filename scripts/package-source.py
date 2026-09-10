from pathlib import Path
import zipfile
root=Path(__file__).resolve().parent.parent
out=root/'public/downloads/shieldpay-source.zip'
out.parent.mkdir(parents=True,exist_ok=True)
skip={'node_modules','.next','.git','artifacts','.cache','downloads','test-results','playwright-report','__pycache__'}
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  if not p.is_file(): continue
  rel=p.relative_to(root)
  if any(s in skip for s in rel.parts):continue
  if p.name.startswith('.env') and p.name!='.env.example':continue
  if p.suffix in {'.log','.tsbuildinfo','.zip'}:continue
  if p.name in {'next-env.d.ts'}:continue
  z.write(p,Path('shieldpay-integrated')/rel)
print(f'Created {out.name}: {out.stat().st_size/1024/1024:.1f} MB')
