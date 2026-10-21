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

  const days=$('calendarDays'),monthLabel=$('monthLabel'),prev=$('prevMonth'),next=$('nextMonth');
  const notice=$('availabilityNotice'),hint=$('bookingHint');
  let viewing=new Date(today.getFullYear(),today.getMonth(),1);
  let chosen=null, states=new Map(), defaultStatus='blocked', loading=false, loadError=false, requested=0;
  const maxMonth=new Date(today.getFullYear(),today.getMonth()+11,1);
  const stateFor=key=>states.get(key)||defaultStatus;
  const monthStart=()=>dateKey(new Date(viewing.getFullYear(),viewing.getMonth(),1));
  const monthEnd=()=>dateKey(new Date(viewing.getFullYear(),viewing.getMonth()+1,0));

  // A disponibilidade e PUBLICA e somente LEITURA. Visitantes nunca gravam alteracoes.
  // As datas sao alteradas pelo responsavel no arquivo disponibilidade.json e publicadas via GitHub.
  async function getMonthStatus() {
    const res = await fetch('disponibilidade.json', {cache:'no-store'});
    if (!res.ok) throw new Error('Agenda nao pode ser consultada ('+res.status+').');
    const data = await res.json();
    if (!data || !data.days || typeof data.days !== 'object' || Array.isArray(data.days) ||
        !['available','blocked','full'].includes(data.defaultStatus)) {
      throw new Error('Formato de agenda invalido.');
    }
    const results = new Map();
    for (const [day,status] of Object.entries(data.days)) {
      const validDay = /^\d{4}-\d{2}-\d{2}$/.test(day) && dateKey(makeLocalDate(day)) === day;
      if (!validDay || !['available','blocked','full'].includes(status)) {
        throw new Error('Data ou status incorreto no calendario.');
      }
      results.set(day,status);
    }
    return {results,defaultStatus:data.defaultStatus};
  }

  function drawCalendar(){
    monthLabel.textContent=viewing.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    days.replaceChildren();
    const first=new Date(viewing.getFullYear(),viewing.getMonth(),1);
    const total=new Date(viewing.getFullYear(),viewing.getMonth()+1,0).getDate();
    const currentToday = getToday();
    prev.disabled=viewing.getFullYear()===currentToday.getFullYear()&&viewing.getMonth()===currentToday.getMonth();
    next.disabled=viewing.getFullYear()===maxMonth.getFullYear()&&viewing.getMonth()===maxMonth.getMonth();
    for(let n=0;n<first.getDay();n++){
      const space=document.createElement('span');space.className='day spacer';days.appendChild(space);
    }
    for(let n=1;n<=total;n++){
      const date=new Date(viewing.getFullYear(),viewing.getMonth(),n),key=dateKey(date),status=stateFor(key);
      const btn=document.createElement('button');btn.type='button';btn.textContent=n;
      const canChoose=!loading&&!loadError&&date>=currentToday&&status==='available';
      btn.className='day '+(date<currentToday?'past':status==='full'?'lotado':status==='blocked'?'blocked':'available');
      btn.disabled=!canChoose;
      const note=date<currentToday?'dia passado':status==='full'?'lotado':status==='blocked'?'indisponível':'disponível';
      btn.setAttribute('aria-label',date.toLocaleDateString('pt-BR',{dateStyle:'full'})+', '+note);
      btn.setAttribute('title',note);
      btn.setAttribute('aria-pressed',String(chosen===key));
      if(chosen===key&&canChoose)btn.classList.add('selected');
      btn.addEventListener('click',()=>{
        chosen=key;drawCalendar();
        hint.textContent='Data solicitada: '+date.toLocaleDateString('pt-BR')+'. A reserva só acontece após confirmação pelo WhatsApp.';
      });
      days.appendChild(btn);
    }
  }
  async function refreshCalendar(){
    const requestId=++requested;
    loading=true;loadError=false;
    notice.textContent='Carregando disponibilidade…';notice.classList.remove('warn');
    drawCalendar();
    try {
      const data=await getMonthStatus();
      if(requestId!==requested)return;
      states=data.results;defaultStatus=data.defaultStatus;
      loading=false;
      if(chosen&&(stateFor(chosen)!=='available'||makeLocalDate(chosen)<getToday())){
        chosen=null;hint.textContent='A data escolhida ficou indisponivel. Selecione outra.';
      }
      const hasAvailableThisMonth = [...states.entries()].some(([key,status]) =>
        key >= monthStart() && key <= monthEnd() && status === 'available' && makeLocalDate(key) >= getToday());
      notice.textContent = hasAvailableThisMonth || defaultStatus === 'available'
        ? 'Datas livres podem ser solicitadas. A confirmação será feita somente pelo WhatsApp.'
        : 'Nenhuma data liberada neste mês. Consulte novamente em outro momento.';
      notice.classList.remove('warn');drawCalendar();
    }catch(error){
      if(requestId!==requested)return;
      loadError=true;loading=false;chosen=null;states=new Map();drawCalendar();
      notice.textContent='Calendario temporariamente indisponivel. Fale diretamente pelo WhatsApp.';
      notice.classList.add('warn');
      console.error('Falha ao carregar agenda:',error);
    }
  }
  prev.addEventListener('click',()=>{viewing=new Date(viewing.getFullYear(),viewing.getMonth()-1,1);refreshCalendar();});
  next.addEventListener('click',()=>{viewing=new Date(viewing.getFullYear(),viewing.getMonth()+1,1);refreshCalendar();});
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
