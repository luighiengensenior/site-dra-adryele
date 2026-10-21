#!/usr/bin/env python3
"""Auditoria estática reproduzível; não envia dados nem altera arquivos."""
from pathlib import Path
from html.parser import HTMLParser
import json,re,sys
root=Path(__file__).resolve().parents[2]
errors=[]
expected={'.gitignore','.nojekyll','index.html','styles.css','app.js','config.js','disponibilidade.json'}
images=sorted((root/'fotos').glob('*'))
class Parse(HTMLParser):
 def __init__(self): super().__init__();self.scripts=[];self.links=[];self.meta=[];self.events=[]
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if tag=='script': self.scripts.append(d)
  if tag=='a': self.links.append(d)
  if tag=='meta': self.meta.append(d)
  for key,value in d.items():
   if key.startswith('on'):self.events.append(key)
p=Parse();html=(root/'index.html').read_text(encoding='utf8');p.feed(html)
js=(root/'app.js').read_text(encoding='utf8');cfg=(root/'config.js').read_text(encoding='utf8');css=(root/'styles.css').read_text(encoding='utf8')
for path in expected:
 if not (root/path).exists():errors.append('Arquivo publico ausente: '+path)
if any(not x.get('src') for x in p.scripts):errors.append('Script inline detectado')
if any(not re.fullmatch(r'[A-Za-z0-9_.-]+\.js',x.get('src','')) for x in p.scripts):errors.append('Script remoto ou caminho suspeito')
if p.events: errors.append('Eventos HTML inline detectados')
if 'innerHTML' in js or re.search(r'\beval\s*\(|\bnew\s+Function\s*\(',js):errors.append('API perigosa de execução/HTML')
if any('wa.me' in a.get('href','') for a in p.links):errors.append('WhatsApp fixo dentro do HTML')
if not any(a.get('http-equiv','').lower()=='content-security-policy' for a in p.meta):errors.append('Sem CSP')
if "script-src 'self'" not in html or "object-src 'none'" not in html:errors.append('CSP enfraquecida')
if 'window.SITE_CONFIG' not in cfg:errors.append('Configuração ausente')
m=re.search(r"whatsappNumber:\s*'([^']*)'",cfg)
if not m:errors.append('Configuração de WhatsApp não reconhecida')
elif m.group(1) and not re.fullmatch(r'55[1-9]\d(?:[2-9]\d{7}|9\d{8})',m.group(1)):
 errors.append('WhatsApp inválido: confira o numero de contato previamente testado')
if re.search(r'(?i)(service[_-]?role|github_pat_|ghp_[a-z0-9]|sk_live_|BEGIN [A-Z ]*PRIVATE KEY)',html+'\n'+js+'\n'+cfg+'\n'+css):errors.append('Possível credencial em arquivos públicos')
try:
 data=json.loads((root/'disponibilidade.json').read_text(encoding='utf8'))
 if data.get('defaultStatus')!='blocked':errors.append('Calendário deve ser fechado por padrão')
 if not isinstance(data.get('days'),dict):errors.append('days deve ser objeto')
 else:
  import datetime
  for key,status in data['days'].items():
   try: datetime.date.fromisoformat(key)
   except: errors.append('Data impossível no calendário')
   if status not in ('available','blocked','full'): errors.append('Status inválido no calendário')
except Exception as exc: errors.append('JSON inválido: '+str(exc))
if len(images)!=13:errors.append('Fotos esperadas: 13; encontradas: '+str(len(images)))
for image in images:
 if image.suffix.lower() not in ('.jpeg','.jpg','.png'):errors.append('Extensão de imagem suspeita: '+image.name)
 if image.stat().st_size>5_000_000:errors.append('Imagem excessivamente grande: '+image.name)
 if b'Exif\x00\x00' in image.read_bytes():errors.append('Imagem pode conter metadados EXIF: '+image.name)
for key in ['backup','admin.html','admin.js','servidor.js']:
 if key in (root/'.gitignore').read_text().lower() and key!='backup': pass
print('Arquivos públicos verificados:',len(expected)+len(images))
print('Verificação:', 'APROVADA' if not errors else 'FALHOU')
for error in errors:print('ERRO:',error)
sys.exit(1 if errors else 0)
