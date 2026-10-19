"""Check real downloaded PDFs with pypdf/Pillow/Poppler, all synthetic fixtures.
Usage: python tests/pdf-render-check.py QUOTE_DIR DIARY_DIR OUTPUT_DIR
These tools are in the Codex bundled runtime; no app dependency is added.
"""
from pathlib import Path
import json,subprocess,sys
from PIL import Image,ImageChops,ImageStat
from pypdf import PdfReader

quote,diary,out=map(Path,sys.argv[1:4]);out.mkdir(parents=True,exist_ok=True)
results=[];renders={}
expected=[quote/f'quote-{w}-{n}.pdf' for w in [1440,390] for n in [1,35]]
expected += [quote/f'planning-{w}.pdf' for w in [1440,390]]
expected += [diary/f'diary-{w}.pdf' for w in [1440,390]]
for pdf in expected:
    reader=PdfReader(pdf);prefix=out/pdf.stem
    subprocess.run(['pdftoppm','-scale-to','1100','-png',str(pdf),str(prefix)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    pages=sorted(out.glob(pdf.stem+'-*.png'));assert len(pages)==len(reader.pages)
    ink=[];blue=0;images=[];photo_pages=[]
    for file in pages:
        im=Image.open(file).convert('RGB');images.append(im.copy())
        coverage=sum(pixel<220 for pixel in im.convert('L').get_flattened_data())/(im.width*im.height)
        assert coverage>0.001,f'Blank/near-blank exported page: {file}, ink={coverage}'
        ink.append(round(coverage,5))
        page_blue=sum(r<70 and 100<g<200 and b>150 for r,g,b in im.get_flattened_data());blue+=page_blue
        if page_blue>500:photo_pages.append(file.name)
    renders[pdf.stem]=images
    text='\n'.join(page.extract_text() for page in reader.pages).replace('\xa0',' ')
    if pdf.stem.startswith('diary'):
        for phrase in ['Régi napi bejegyzés','Mai ellenőrzött burkolás','Következő nap, új fotó nélkül.','12 700 Ft']:
            assert phrase in text,f'Missing actual PDF content: {phrase}'
        assert blue>3000,'Daily photo not rendered'
    if pdf.stem.startswith('planning'):
        assert blue>3000,'Planning photo not rendered'
        assert len(photo_pages)==1,'Single planning photo split across PDF pages'
    if pdf.stem.endswith('-1'):assert len(pages)==1,'A short quote has an unnecessary extra page'
    results.append({'pdf':pdf.name,'pages':len(pages),'ink_per_page':ink,'synthetic_photo_blue_pixels':blue,'searchable_text_characters':len(text)})
    thumbs=[]
    for im in images:im.thumbnail((390,552));thumbs.append(im)
    sheet=Image.new('RGB',(390*len(thumbs),552),'#eeeeee')
    for i,im in enumerate(thumbs):sheet.paste(im,(i*390,0))
    sheet.save(out/(pdf.stem+'-overview.png'))
for n in [1,35]:
    left,right=renders[f'quote-1440-{n}'],renders[f'quote-390-{n}'];assert len(left)==len(right)
    for a,b in zip(left,right):
        assert a.size==b.size
        difference=sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3
        assert difference<1.5,f'Mobile PDF layout differs from desktop: {difference}'
assert len(renders['planning-1440'])==len(renders['planning-390'])
(out/'pdf-validation.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(results,ensure_ascii=True,indent=2))
