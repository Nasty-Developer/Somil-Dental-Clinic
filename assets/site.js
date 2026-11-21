
(function(){
  "use strict";
  var WA="918591434914";
  function link(t){return "https://wa.me/"+WA+"?text="+encodeURIComponent(t);}

  // all static WhatsApp links
  var els=document.querySelectorAll("[data-wa]");
  for(var i=0;i<els.length;i++){els[i].href=link(els[i].getAttribute("data-wa"));
    els[i].target="_blank";els[i].rel="noopener";}

  // header shadow
  var top=document.getElementById("top");
  var onScroll=function(){top.classList.toggle("stuck",window.scrollY>8);};
  addEventListener("scroll",onScroll,{passive:true});onScroll();

  // mobile drawer
  var b=document.getElementById("burger"),dr=document.getElementById("drawer");
  if(b){b.addEventListener("click",function(){
    var open=dr.classList.toggle("open");
    document.body.classList.toggle("nav-open",open);
    b.setAttribute("aria-expanded",open?"true":"false");
    b.setAttribute("aria-label",open?"Close menu":"Open menu");
  });
  dr.addEventListener("click",function(e){
    if(e.target.tagName==="A"&&e.target.getAttribute("href")&&e.target.getAttribute("href").charAt(0)==="#"){
      dr.classList.remove("open");document.body.classList.remove("nav-open");b.setAttribute("aria-expanded","false");}
  });}

  // booking composer: real date + time slots
  var out=document.getElementById("bk");
  if(out){
    var t=document.getElementById("t"), n=document.getElementById("n"),
        dWrap=document.getElementById("dchips"), hWrap=document.getElementById("hchips"),
        sT=document.getElementById("sT"), sD=document.getElementById("sD"), sH=document.getElementById("sH");

    var DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var dates=[], selDate=null, selTime=null;

    // next 14 days
    var base=new Date(); base.setHours(0,0,0,0);
    for(var i=0;i<14;i++){
      var dt=new Date(base.getTime()+i*86400000);
      dates.push({d:dt, key:dt.toISOString().slice(0,10),
        top:i===0?"Today":(i===1?"Tomorrow":DAYS[dt.getDay()]),
        bottom:dt.getDate()+" "+MON[dt.getMonth()]});
    }

    // one evening session only: 6:30 pm through 10:30 pm (last start)
    var SLOTS=[]; for(var m=18*60+30; m<=22*60+30; m+=30) SLOTS.push(m);
    function fmt(mins){ var h=Math.floor(mins/60), mm=mins%60, ap=h>=12?"pm":"am", hh=h%12||12;
      return hh+":"+(mm<10?"0"+mm:mm)+" "+ap; }
    function isToday(key){ return new Date().toISOString().slice(0,10)===key; }
    function slotPast(mins){
      if(!selDate||!isToday(selDate.key)) return false;
      var now=new Date(); var minsNow=now.getHours()*60+now.getMinutes();
      return mins<minsNow;
    }

    function paintDates(){
      dWrap.innerHTML="";
      dates.forEach(function(o){
        var b=document.createElement("button");
        b.type="button"; b.className="slot date"+(selDate&&selDate.key===o.key?" on":"");
        b.innerHTML='<b>'+o.top+'</b><i>'+o.bottom+'</i>';
        b.setAttribute("aria-pressed",selDate&&selDate.key===o.key?"true":"false");
        b.addEventListener("click",function(){ selDate=o; selTime=null; paintDates(); paintTimes(); sync(); });
        dWrap.appendChild(b);
      });
    }
    function paintTimes(){
      hWrap.innerHTML="";
      SLOTS.forEach(function(mins){
        var past=slotPast(mins);
        var b=document.createElement("button");
        b.type="button"; b.className="slot time"+(selTime===mins?" on":"")+(past?" off":"");
        b.textContent=fmt(mins);
        b.disabled=past;
        if(past) b.title="This slot has already passed today";
        b.setAttribute("aria-pressed",selTime===mins?"true":"false");
        b.addEventListener("click",function(){ if(past) return; selTime=mins; paintTimes(); sync(); });
        hWrap.appendChild(b);
      });
    }

    function sync(){
      var msg="Hi Somil Dental Clinic, I'd like to book an appointment.\n"
        +"Treatment: "+t.value+"\n";
      if(selDate) msg+="Preferred date: "+selDate.top+", "+selDate.bottom+"\n";
      if(selTime!==null) msg+="Preferred time: "+fmt(selTime)+"\n";
      msg+="Clinic hours (6:30 pm to 10:30 pm) suit me.";
      if(n.value.trim()) msg+="\nName: "+n.value.trim();
      out.href=link(msg);

      sT.textContent=t.value;
      sD.textContent=selDate? selDate.top+", "+selDate.bottom : "Pick a date";
      sH.textContent=selTime!==null? fmt(selTime) : "Pick a time";
      var ready=selDate&&selTime!==null;
      out.classList.toggle("muted",!ready);
      out.setAttribute("aria-disabled",ready?"false":"true");
    }

    // default: tomorrow evening's first slot for a one-tap start
    selDate=dates[1]; selTime=SLOTS[0];
    paintDates(); paintTimes(); sync();
    t.addEventListener("change",sync);
    n.addEventListener("input",sync);

    out.addEventListener("click",function(e){
      if(!(selDate&&selTime!==null)){ e.preventDefault();
        var f=dWrap; if(!selDate) f=dWrap; else f=hWrap;
        f.scrollIntoView({behavior:"smooth",block:"center"});
        f.classList.add("nudge"); setTimeout(function(){f.classList.remove("nudge");},900);
      }
    });
    out.target="_blank";out.rel="noopener";
  }

  // reveal on scroll
  var rev=document.querySelectorAll("[data-reveal]");
  if("IntersectionObserver" in window){
    var io=new IntersectionObserver(function(en){
      en.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}});
    },{rootMargin:"0px 0px -8% 0px",threshold:.08});
    rev.forEach(function(el){io.observe(el);});
  }else{rev.forEach(function(el){el.classList.add("in");});}

  // active nav link on scroll
  var links=[].slice.call(document.querySelectorAll(".nav a"));
  var secs=links.map(function(a){var h=a.getAttribute("href")||"";
    return h.charAt(0)==="#"&&h.length>1?document.querySelector(h):null;});
  if("IntersectionObserver" in window){
    var spy=new IntersectionObserver(function(en){
      en.forEach(function(e){
        if(!e.isIntersecting)return;
        links.forEach(function(a){a.classList.remove("active");});
        var k=secs.indexOf(e.target);
        if(k>-1)links[k].classList.add("active");
      });
    },{rootMargin:"-45% 0px -50% 0px"});
    secs.forEach(function(x){if(x)spy.observe(x);});
    var bk=document.getElementById("book");
    if(bk){
      var clear=new IntersectionObserver(function(en){
        en.forEach(function(e){if(e.isIntersecting){links.forEach(function(a){a.classList.remove("active");});}});
      },{rootMargin:"-45% 0px -45% 0px"});
      clear.observe(bk);
    }
  }

  var y=document.getElementById("yr");if(y)y.textContent=new Date().getFullYear();
})();


(function(){
  var b=document.getElementById("progbar"); if(!b) return;
  var raf=false;
  function upd(){
    raf=false;
    var h=document.documentElement, max=h.scrollHeight-h.clientHeight;
    var p=max>0?(h.scrollTop||document.body.scrollTop)/max:0;
    b.style.width=(p*100).toFixed(2)+"%";
  }
  function onScroll(){ if(!raf){ raf=true; requestAnimationFrame(upd); } }
  window.addEventListener("scroll",onScroll,{passive:true});
  window.addEventListener("resize",onScroll);
  upd();
})();


(function(){
  var b=document.getElementById("boot"); if(!b) return;
  function done(){ if(!b||!b.parentNode) return; b.classList.add("done");
    setTimeout(function(){ if(b&&b.parentNode) b.parentNode.removeChild(b); },500); }
  if(document.readyState==="complete"){ setTimeout(done,220); }
  else { window.addEventListener("load",function(){ setTimeout(done,260); }); }
  setTimeout(done,1600);
})();


(function(){
  var WA="918591434914";
  function waLink(msg){ return "https://wa.me/"+WA+"?text="+encodeURIComponent(msg); }

  /* ---------- theme toggle ---------- */
  var root=document.documentElement, tt=document.getElementById("tt");
  function paint(){
    var dark=root.dataset.theme==="dark";
    if(tt){
      tt.setAttribute("aria-pressed",dark?"true":"false");
      tt.setAttribute("aria-label",dark?"Switch to light mode":"Switch to dark mode");
    }
    var m=document.querySelector('meta[name="theme-color"]');
    if(m) m.setAttribute("content",dark?"#0A1C29":"#123752");
  }
  paint();
  if(tt){
    tt.addEventListener("click",function(){
      var dark=root.dataset.theme==="dark";
      if(dark){ delete root.dataset.theme; } else { root.dataset.theme="dark"; }
      try{ localStorage.setItem("sdc-theme",dark?"light":"dark"); }catch(e){}
      paint();
    });
  }

  /* ---------- chat assistant ---------- */
  var chat=document.getElementById("chat"), btn=document.getElementById("chatBtn"),
      x=document.getElementById("chatX"), body=document.getElementById("chatBody"),
      chips=document.getElementById("chatChips"), form=document.getElementById("chatForm"),
      input=document.getElementById("chatIn");
  if(!chat||!btn) return;

  var WA_BTN='<a class="wa" target="_blank" rel="noopener" href="'+
    waLink("Hi Somil Dental Clinic, I found you on the website and I would like to book an appointment.")+
    '"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.5 12.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.5-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5 0-.2 0-.4-.1-.5l-.9-2.1c-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.2.2 2 3.1 4.9 4.3 2.4 1 2.9.8 3.4.8.5 0 1.6-.7 1.9-1.3.2-.7.2-1.2.1-1.3-.1-.2-.3-.2-.6-.4z"/></svg>Chat on WhatsApp</a>';

  var CHIPS_MAIN=["Book an appointment","Treatment prices","Clinic timings","I have tooth pain"];

  function has(t,arr){ for(var i=0;i<arr.length;i++){ if(t.indexOf(arr[i])>-1) return true; } return false; }

  function answer(raw){
    var t=" "+raw.toLowerCase().replace(/[^a-z0-9\s]/g," ")+" ";
    if(has(t,["pain","hurt","hurts","ache","aching","swelling","swollen","broken","emergency","urgent","bleed"]))
      return {a:"Message the clinic now and say it is urgent, same-day slots are kept for pain cases.\n\nIf swelling is spreading to your eye or jaw, or you have trouble breathing or swallowing, go to a hospital instead of waiting.",wa:1,chips:["Book an appointment","What happens after a root canal"]};
    if(has(t,["price","prices","pricing","cost","costs","fee","fees","charge","charges","rate","much","kitna","quote"]))
      return {a:"Quotes depend on the diagnosis: which tooth, how many canals, whether a crown is needed afterwards.\n\nThe clinic examines first, then gives you the full plan and price before anything starts. Ask on WhatsApp for a starting range for your case.",wa:1,chips:["Root canal treatment","Book an appointment"]};
    if(has(t,["time","timing","timings","hours","open","close","closes","closed","sunday","holiday","kab"]))
      return {a:"I do not have today's clinic hours in front of me, and I would rather not guess them.\n\nThe team replies on WhatsApp during clinic hours, so that is the fastest way to check a slot for today.",wa:1,chips:["Book an appointment"]};
    if(has(t,["where","address","location","directions","reach","clinic in","branch","map"]))
      return {a:"The clinic is in Mumbai, with Dr. Somil V Gupta consulting there.\n\nAsk on WhatsApp and the team will share the exact address and directions for your visit.",wa:1,chips:["Book an appointment"]};
    if(has(t,["insurance","mediclaim","cashless","claim","upi","card","payment","pay"]))
      return {a:"Payment and insurance details are best confirmed with the clinic directly, since they can vary by treatment.\n\nMessage them before your visit and they will tell you what is accepted.",wa:1,chips:["Book an appointment"]};
    if(has(t,["root canal","rct","canal"]))
      return {a:"A root canal removes the infected pulp from inside a tooth and seals it, so an aching tooth can be saved instead of removed.\n\nIt is done under local anaesthetic, often across one or two visits depending on the tooth. Mild tenderness for a day or two afterwards is normal.",wa:1,chips:["Treatment prices","Book an appointment"]};
    if(has(t,["brace","braces","aligner","aligners","straighten","crowd","gap","invisalign"]))
      return {a:"Braces and aligners straighten crowding and close gaps. Metal, ceramic and clear-aligner options are all available, and the choice depends on how much movement your case needs.\n\nBook a consultation and Dr. Somil will map out what fits your bite and budget.",wa:1,chips:["Treatment prices","Book an appointment"]};
    if(has(t,["whiten","whitening","bleach","bright","stain","stains","yellow"]))
      return {a:"In-clinic whitening lifts the shade of your teeth using enamel-safe protocols, usually in a single sitting.\n\nStains from tea, coffee and smoking respond best. Book a checkup first so the shade change can be planned safely.",wa:1,chips:["Treatment prices","Book an appointment"]};
    if(has(t,["kid","kids","child","children","baby","son","daughter"]))
      return {a:"Kids' dentistry covers first visits, fluoride, sealants and fillings, paced for children who get nervous.\n\nTell the clinic your child's age on WhatsApp and they will suggest the right first appointment.",wa:1,chips:["Book an appointment"]};
    if(has(t,["clean","cleaning","scale","scaling","polish","polishing","tartar","plaque","gum","bleed"]))
      return {a:"Cleaning is scaling and polishing that removes tartar and surface stains, and settles gum inflammation. It usually takes about 30 minutes.\n\nMost people benefit from it every six months.",wa:1,chips:["Treatment prices","Book an appointment"]};
    if(has(t,["veneer","veneers","bonding","cosmetic","smile","design","shape"]))
      return {a:"Cosmetic work covers veneers, composite bonding and smile design, planned around your face and bite rather than a template.\n\nThe clinic shows you the plan and cost before anything is prepared.",wa:1,chips:["Treatment prices","Book an appointment"]};
    if(has(t,["checkup","check up","examination","exam","xray","x-ray","consult"]))
      return {a:"A general checkup is a full examination, X-rays where they are needed, and a written plan with costs, so you can decide before committing to anything.\n\nIt is the right first step if you are not sure what is wrong.",wa:1,chips:["Book an appointment","Treatment prices"]};
    if(has(t,["after","afterwards","recover","recovery","numb","numbness","sore","tender","swallow"]))
      return {a:"After a filling or root canal: numbness usually fades in two to four hours, and mild tenderness for a day or two is normal.\n\nMessage the clinic if swelling keeps growing, you get a fever, bleeding will not stop, or pain is worse after day three.",wa:1,chips:["Book an appointment"]};
    if(has(t,["book","booking","appointment","appoint","slot","schedule","visit","come"]))
      return {a:"Booking takes one message. Tell me the treatment and the clinic will confirm a slot from there.\n\nYou can also use the booking form on this page and it will open WhatsApp with your details filled in.",wa:1,chips:["Root canal treatment","General checkup","Cleaning"]};
    if(has(t,["doctor","dr","somil","who","qualif","experience"]))
      return {a:"Dr. Somil V Gupta holds a BDS from JJ College and practises endodontic and comprehensive dentistry, with a patient-first approach: clear explanations and careful hands.\n\nHe consults at Somil Dental Clinic in Mumbai.",wa:1,chips:["Book an appointment"]};
    if(has(t,["hi","hello","hey","namaste","hii"]))
      return {a:"Hello. I can help with treatments, pricing questions, pain and booking.\n\nWhat would you like to know?",chips:CHIPS_MAIN};
    if(has(t,["thank","thanks","ok","okay","great","nice"]))
      return {a:"Anytime. If you book through WhatsApp, mention the treatment and your preferred day and the clinic takes it from there.",chips:CHIPS_MAIN};
    return {a:"I can help with treatments, booking, pain and aftercare.\n\nFor anything specific to your case, the clinic answers directly on WhatsApp, usually during clinic hours.",wa:1,chips:CHIPS_MAIN};
  }

  function scroll(){ body.scrollTop=body.scrollHeight; }

  function addMsg(text,who,wa){
    var d=document.createElement("div");
    d.className="msg "+(who==="me"?"me":"bot");
    d.textContent=text;
    if(wa) d.insertAdjacentHTML("beforeend",WA_BTN);
    body.appendChild(d); scroll(); return d;
  }

  function setChips(list){
    chips.innerHTML="";
    (list||[]).forEach(function(c){
      var b=document.createElement("button");
      b.type="button"; b.textContent=c;
      b.addEventListener("click",function(){ send(c); });
      chips.appendChild(b);
    });
  }

  function reply(text){
    var t=document.createElement("div");
    t.className="typing"; t.innerHTML="<i></i><i></i><i></i>";
    body.appendChild(t); scroll();
    setTimeout(function(){
      if(t.parentNode) t.parentNode.removeChild(t);
      var r=answer(text);
      addMsg(r.a,"bot",r.wa);
      setChips(r.chips);
    }, 620);
  }

  function send(text){
    if(!text||!text.trim()) return;
    addMsg(text.trim(),"me");
    input.value="";
    setChips([]);
    reply(text);
  }

  var started=false;
  function open(){
    chat.hidden=false;
    requestAnimationFrame(function(){ chat.classList.add("in"); });
    document.body.classList.add("chat-open");
    btn.setAttribute("aria-expanded","true");
    if(!started){
      started=true;
      addMsg("Hi, I am the clinic assistant. I can help with treatments, prices, pain and booking.\n\nWhat can I help with?","bot");
      setChips(CHIPS_MAIN);
    }
    setTimeout(function(){ if(window.innerWidth>860) input.focus(); },260);
  }
  function close(){
    chat.classList.remove("in");
    document.body.classList.remove("chat-open");
    btn.setAttribute("aria-expanded","false");
    setTimeout(function(){ chat.hidden=true; },220);
  }
  btn.addEventListener("click",function(){ chat.hidden?open():close(); });
  window.openClinicChat=open;
  var ask=document.getElementById("askAssistant");
  if(ask) ask.addEventListener("click",function(){ open(); });
  if(x) x.addEventListener("click",close);
  document.addEventListener("keydown",function(e){ if(e.key==="Escape"&&!chat.hidden) close(); });
  form.addEventListener("submit",function(e){ e.preventDefault(); send(input.value); });
})();
