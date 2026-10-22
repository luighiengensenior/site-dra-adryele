'use strict';
(() => {
  // Contato CONFIRMADO pelo proprietário: não depender de config.js em cache.
  // Número público usado APENAS em links do WhatsApp, sem dados sensíveis.
  const number = '556192374671';
  const whatsappConfigured = /^55[1-9]\d(?:[2-9]\d{7}|9\d{8})$/.test(number);
  const $ = id => document.getElementById(id);
  const getToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
  const today = getToday();
  const dateKey = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const makeLocalDate = key => { const parts=key.split('-').map(Number); return new Date(parts[0],parts[1]-1,parts[2]); };
  const directMessage = 'Olá, Dra. Adryele! Gostaria de informações sobre um atendimento veterinário domiciliar.';
  const makeWA = message => whatsappConfigured ? 'https://wa.me/'+number+'?text='+encodeURIComponent(message) : null;
  document.querySelectorAll('[data-whatsapp="direct"]').forEach(link => {
    if (whatsappConfigured) {
      link.href = makeWA(directMessage);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.referrerPolicy = 'no-referrer';
    } else {
      link.removeAttribute('href');
      link.removeAttribute('target');
      link.setAttribute('aria-disabled','true');
      link.tabIndex = -1;
      link.classList.add('contact-unavailable');
      link.textContent = 'WhatsApp em configuração';
      link.setAttribute('title','WhatsApp aguardando configuracao');
    }
  });
  const setupAlert = $('whatsappSetupAlert');
  if (setupAlert && !whatsappConfigured) setupAlert.hidden = false;
  const sendButton = $('bookingForm')?.querySelector('button[type="submit"]');
  if (sendButton && !whatsappConfigured) {
    sendButton.disabled = true;
    sendButton.textContent = 'WhatsApp em configuração';
    sendButton.title = 'O número completo será configurado após confirmação';
  }

  const navToggle=$('navToggle'), navLinks=$('navLinks');
  navToggle?.addEventListener('click', () => {
    const opened=navLinks.classList.toggle('open');navToggle.setAttribute('aria-expanded',String(opened));
  });
  navLinks?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    navLinks.classList.remove('open');navToggle.setAttribute('aria-expanded','false');
  }));

  function initSlider(element) {
    if (!element) return;
    const track=element.querySelector('.slides-track');
    const slides=[...track.children];
    const dots=element.querySelector('.slide-dots');
    let index=0, startX=null;
    function go(nextIndex) {
      index=(nextIndex+slides.length)%slides.length;
      track.style.transform=`translateX(-${index*100}%)`;
      [...dots.children].forEach((node,i) => {
        node.classList.toggle('active',i===index);
        node.setAttribute('aria-pressed',String(i===index));
      });
    }
    slides.forEach((_,i)=>{
      const btn=document.createElement('button');btn.type='button';
      btn.setAttribute('aria-label','Mostrar foto '+(i+1)+' de '+slides.length);
      btn.addEventListener('click',()=>go(i));dots.appendChild(btn);
    });
    element.querySelector('[data-slide="prev"]').addEventListener('click',()=>go(index-1));
    element.querySelector('[data-slide="next"]').addEventListener('click',()=>go(index+1));
    element.addEventListener('touchstart',event=>{startX=event.changedTouches[0].clientX;},{passive:true});
    element.addEventListener('touchend',event=>{
      if(startX===null)return;
      const movement=event.changedTouches[0].clientX-startX;
      if(Math.abs(movement)>45)go(index+(movement<0?1:-1));
      startX=null;
    },{passive:true});
    element.tabIndex=0;
    element.addEventListener('keydown',event=>{
      if(event.target.tagName==='BUTTON')return;
      if(event.key==='ArrowRight'||event.key==='ArrowLeft'){
        event.preventDefault();go(index+(event.key==='ArrowRight'?1:-1));
      }
    });
    go(0);
  }
  initSlider($('heroSlider'));initSlider($('consultSlider'));

  // ADRYELE_CALENDARIO_V10: todos os dias futuros podem ser solicitados.
  // A data selecionada e somente uma preferencia; confirmacao no WhatsApp.
  const days=$('calendarDays'),monthLabel=$('monthLabel'),prev=$('prevMonth'),next=$('nextMonth');
  const notice=$('availabilityNotice'),hint=$('bookingHint');
  let viewing=new Date(today.getFullYear(),today.getMonth(),1);
  let chosen=null,loading=false,loadError=false;
  const maxMonth=new Date(today.getFullYear(),today.getMonth()+11,1);
  // Mantem compatibilidade com a verificacao feita ao enviar o formulario.
  async function getMonthStatus(){return {results:new Map(),defaultStatus:'available'};}
  function drawCalendar(){
    if(!days||!monthLabel||!prev||!next)return;
    const now=getToday();
    monthLabel.textContent=viewing.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    days.replaceChildren();
    const first=new Date(viewing.getFullYear(),viewing.getMonth(),1);
    const last=new Date(viewing.getFullYear(),viewing.getMonth()+1,0).getDate();
    prev.disabled=viewing.getFullYear()===now.getFullYear()&&viewing.getMonth()===now.getMonth();
    next.disabled=viewing.getFullYear()===maxMonth.getFullYear()&&viewing.getMonth()===maxMonth.getMonth();
    for(let i=0;i<first.getDay();i++){
      const space=document.createElement('span');space.className='day spacer';space.setAttribute('aria-hidden','true');
      days.appendChild(space);
    }
    for(let n=1;n<=last;n++){
      const date=new Date(viewing.getFullYear(),viewing.getMonth(),n);
      const key=dateKey(date),past=date<now;
      const button=document.createElement('button');button.type='button';button.textContent=String(n);
      button.className='day '+(past?'past':'available');button.disabled=past;
      button.setAttribute('aria-label',date.toLocaleDateString('pt-BR',{dateStyle:'full'})+(past?', data passada':', escolha esta data para consultar no WhatsApp'));
      button.title=past?'Data passada':'Solicitar esta data pelo WhatsApp';
      if(!past){
        button.setAttribute('aria-pressed',String(chosen===key));
        if(chosen===key)button.classList.add('selected');
        button.addEventListener('click',()=>{
          chosen=key;drawCalendar();
          if(hint)hint.textContent='Data preferida: '+date.toLocaleDateString('pt-BR')+'. A Dra. Adryele confirma a disponibilidade pelo WhatsApp.';
        });
      }
      days.appendChild(button);
    }
    if(notice){notice.textContent='Escolha qualquer dia futuro. A disponibilidade será confirmada pelo WhatsApp.';notice.classList.remove('warn');}
  }
  function refreshCalendar(){
    const now=getToday();
    if(viewing.getFullYear()<now.getFullYear()||(viewing.getFullYear()===now.getFullYear()&&viewing.getMonth()<now.getMonth()))
      viewing=new Date(now.getFullYear(),now.getMonth(),1);
    if(chosen&&makeLocalDate(chosen)<now){chosen=null;if(hint)hint.textContent='Selecione uma nova data de preferência.';}
    drawCalendar();
  }
  prev?.addEventListener('click',()=>{viewing=new Date(viewing.getFullYear(),viewing.getMonth()-1,1);refreshCalendar();});
  next?.addEventListener('click',()=>{viewing=new Date(viewing.getFullYear(),viewing.getMonth()+1,1);refreshCalendar();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCalendar();});

  const checkboxes=[...document.querySelectorAll('input[name="services"]')];
  const chosenServices=()=>checkboxes.filter(c=>c.checked).map(c=>c.value);
  function updateChecked(){
    const n=chosenServices().length;
    $('servicesPicked').textContent=n===0?'Nenhum serviço selecionado.':n===1?'1 serviço selecionado.':n+' serviços selecionados.';
  }
  checkboxes.forEach(c=>c.addEventListener('change',updateChecked));

  $('bookingForm').addEventListener('submit', async event=>{
    event.preventDefault();
    if(!chosen){alert('Selecione uma data disponível no calendário.');return;}
    if(makeLocalDate(chosen)<getToday()){alert('Selecione um dia futuro.');return;}
    if (!whatsappConfigured) { alert('WhatsApp ainda não configurado.'); return; }
    if(!chosenServices().length){alert('Marque pelo menos um serviço desejado.');return;}
    if(loading||loadError){alert('A disponibilidade não pôde ser confirmada no calendário. Use o botão de contato direto.');return;}
    const submit=event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled=true;
    try{
      // Evita enviar uma data que acabou de ser bloqueada no arquivo publicado.
      const fresh = await getMonthStatus();
      const freshStatus = fresh.results.get(chosen) || fresh.defaultStatus;
      if(freshStatus !== 'available' || makeLocalDate(chosen) < getToday()) {
        alert('Essa data foi bloqueada ou lotou. Selecione outra.');
        await refreshCalendar();return;
      }
      const get=id=>$(id).value.trim();
      const msg=[
        'Olá, Dra. Adryele! Gostaria de solicitar atendimento veterinário domiciliar.',
        '', 'Responsável: '+get('owner'),'Nome do pet: '+get('pet'),'Região: '+get('region'),
        'Serviços desejados: '+chosenServices().join(', '),
        'Data preferida: '+makeLocalDate(chosen).toLocaleDateString('pt-BR'),
        'Período de preferência: '+get('period'),'',
        'Poderia informar a disponibilidade e os valores?'
      ].join('\n');
      const url=makeWA(msg);
      // Navegação apenas com numero validado; nada é transmitido ao nosso servidor.
      if (!url) throw new Error('Contato nao configurado');
      window.location.assign(url);
    }catch(error){
      alert('Não foi possível confirmar a disponibilidade. Tente novamente ou fale pelo WhatsApp.');
      console.error(error);
    }finally{submit.disabled=false;}
  });
  $('year').textContent=new Date().getFullYear();
  refreshCalendar();
})();
