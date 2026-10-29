"""Build the self-contained offline HTML using Python's standard library."""
from pathlib import Path
root=Path(__file__).resolve().parent
html=(root/'src/page.html').read_text(encoding='utf-8')
html=html.replace('/* LAB_STYLES */',(root/'src/lab.css').read_text(encoding='utf-8'))
for token,file in [('<!-- COURSE_PANEL -->','course.html'),('<!-- PARTS_PANEL -->','parts.html')]:
    html=html.replace(token,(root/'src'/file).read_text(encoding='utf-8'))
scripts=[]
for name in ['vendor/three.min.js','src/core.js','src/courses.js','src/engine.js','src/app.js','src/director.js']:
    code=(root/name).read_text(encoding='utf-8').replace('</script','<\\/script')
    scripts.append('<script>\n'+code+'\n</script>')
html=html.replace('<!-- LAB_SCRIPTS -->','\n'.join(scripts))
with (root/'index.html').open('w',encoding='utf-8',newline='\n') as output:
    output.write(html)
print(f'Built index.html ({len(html.encode("utf-8")):,} bytes), all resources embedded.')
