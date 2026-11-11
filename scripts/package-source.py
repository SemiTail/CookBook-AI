from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
target = root / 'output/cookbook-ai-source.zip'
directories = ['backend/src', 'backend/prisma', 'backend/tests', 'frontend/src', 'docs', 'scripts']
files = ['package.json', '.gitignore', 'README.md', 'README-UK.md',
         'backend/package.json', 'backend/package-lock.json', 'backend/prisma7.config.ts',
         'backend/tsconfig.json', 'backend/tsconfig.build.json', 'backend/.env.example',
         'frontend/package.json', 'frontend/package-lock.json', 'frontend/tsconfig.json',
         'frontend/vite.config.ts', 'frontend/index.html', 'frontend/.env.example',
         'output/pdf/practical-report.pdf', 'output/pdf/er-diagram.pdf',
         'output/presentation/cookbook-ai.pdf', 'output/presentation/cookbook-ai.pptx']
paths = [root / name for name in files]
for directory in directories:
    paths.extend(p for p in (root / directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for p in sorted(set(paths)):
        if p.name == '.env' or p.suffix in ('.db', '.log'): raise ValueError('Private file cannot be packaged')
        archive.write(p, 'CookBook-AI/' + p.relative_to(root).as_posix())
with ZipFile(target) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(set(archive.namelist()))
    assert not any('/node_modules/' in p or p.endswith('/.env') or p.endswith('.db') for p in archive.namelist())
    print(f'Validated source archive: {len(archive.namelist())} files, {target.stat().st_size} bytes')
