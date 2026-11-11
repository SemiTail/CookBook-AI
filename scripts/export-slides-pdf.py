"""PDF handout from the inspected slide renders; editable source is the PPTX."""
from pathlib import Path
from reportlab.pdfgen.canvas import Canvas
import pypdfium2 as pdfium

root = Path(__file__).resolve().parents[1]
target = root / 'output/presentation/cookbook-ai.pdf'
c = Canvas(str(target), pagesize=(960, 540))
c.setTitle('CookBook AI - презентація MVP')
for i in range(1, 8):
    c.drawImage(str(root / f'tmp/presentation/slide-{i}.png'), 0, 0, width=960, height=540)
    c.showPage()
c.save()
doc = pdfium.PdfDocument(str(target))
assert len(doc) == 7
for i in range(len(doc)):
    doc[i].render(scale=1).to_pil().save(root / f'tmp/presentation/pdf-{i+1}.png')
print('Exported 7-page PDF handout. Editable content remains in cookbook-ai.pptx.')
